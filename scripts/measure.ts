import { sourceSeedsFor, type SourceSeed } from '@/constants/source';
import { walkSitemap } from '@/crawler/discover/sitemap';
import { PoliteFetcher } from '@/crawler/fetcher';
import { applyFetchQuirks } from '@/crawler/sources/registry';
import type { GenericJsonLdConfig } from '@/crawler/sources/types';
import { SourceKind } from '@/enums';

import { loadEnv, parseArgs } from './_env';

/**
 * Đo LÁT CẮT của một nguồn — không tải trang chi tiết nào, không cần CSDL.
 *
 *   npm run measure -- --ws swe --source careerviet --sitemaps 5
 *   npm run measure -- --ws swe --source vnw
 *   npm run measure -- --ws swe --source vnw --queries "dotnet,net developer"
 *   npm run measure -- --ws swe --source vieclam24h --pattern "c8p122id\d+||c14p122id\d+"
 *
 * Trả lời câu mà `probe` không trả lời được: mẫu `urlIncludePattern` (hoặc bộ
 * từ khoá `queries`) giữ lại BAO NHIÊU phần của sàn. `probe` dừng ở trần vài
 * tin, nên nó chỉ nói "mẫu có ăn không", không nói "ăn bao nhiêu".
 *
 * Sitemap được tải MỘT lần, không kèm mẫu lọc; mẫu áp trong bộ nhớ — nên cùng
 * một lượt ra được cả mẫu số (tổng URL tin) lẫn tử số (URL khớp), và `--pattern`
 * so được nhiều mẫu (ngăn bằng `||`) mà không tải lại. Mẫu được biên dịch kèm
 * cờ `i`, đúng như generic-jsonld và pipeline.
 *
 * Đọc ít file hơn tổng số file thì con số là MẪU, không phải toàn sàn — dòng
 * kết quả ghi rõ "(chạm trần)" để không ai đem nó ra ngoại suy mà quên điều đó.
 */
async function main(): Promise<void> {
  const ws = loadEnv({ db: false });
  const args = parseArgs(process.argv.slice(2));
  const code = args.string('source');
  const seed = sourceSeedsFor(ws).find((s) => s.code === code);
  if (!seed) {
    console.error(
      'Dùng: npm run measure -- [--ws <workspace>] --source <code> ' +
        '[--sitemaps N] [--sample N] [--pattern "a||b"] [--queries "x,y"]',
    );
    process.exitCode = 1;
    return;
  }

  const fetcher = new PoliteFetcher();
  applyFetchQuirks(fetcher, [seed]);
  const started = Date.now();

  if (seed.kind === SourceKind.API) {
    const override = args.string('queries');
    const queries = override
      ? override.split(',').map((q) => q.trim()).filter(Boolean)
      : ((seed.config?.queries as string[] | undefined) ?? []);
    await measureApi(fetcher, seed, queries);
  } else {
    await measureSitemap(fetcher, seed, {
      maxSitemaps: args.number('sitemaps') ?? 5,
      sample: args.number('sample') ?? 8,
      patterns: args.string('pattern')?.split('||') ?? null,
    });
  }

  console.log(
    `\n  ${fetcher.stats.requests} request · ${(fetcher.stats.bytes / 1e6).toFixed(2)} MB · ` +
      `${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
}

interface VnwSearch {
  meta?: { nbHits?: number };
  data?: { jobTitle?: string; workingLocations?: { cityName?: string }[] }[];
}

async function measureApi(fetcher: PoliteFetcher, seed: SourceSeed, queries: string[]): Promise<void> {
  console.log(`\n┌─ ${seed.name} · ${queries.length} từ khoá\n`);
  for (const query of queries) {
    const res = await fetcher.fetchJson<VnwSearch>(seed.entryUrl!, {
      method: 'POST',
      body: { query, filter: [], ranges: [], order: [], hitsPerPage: 5, page: 0 },
    });
    const hits = res.meta?.nbHits ?? 0;
    console.log(`  ${String(hits).padStart(6)}  "${query}"`);
    for (const job of res.data ?? []) {
      const city = job.workingLocations?.map((l) => l.cityName).filter(Boolean).join(', ') || '?';
      console.log(`            · ${job.jobTitle ?? '?'}  [${city}]`);
    }
  }
}

async function measureSitemap(
  fetcher: PoliteFetcher,
  seed: SourceSeed,
  options: { maxSitemaps: number; sample: number; patterns: string[] | null },
): Promise<void> {
  const config = (seed.config ?? {}) as GenericJsonLdConfig;
  const walk = await walkSitemap(fetcher, seed.entryUrl!, {
    ...(seed.jobUrlPattern ? { jobUrlPattern: new RegExp(seed.jobUrlPattern) } : {}),
    ...(config.sitemapUrlPattern ? { sitemapUrlPattern: new RegExp(config.sitemapUrlPattern) } : {}),
    maxSitemaps: options.maxSitemaps,
    maxUrls: 1_000_000,
  });

  const exclude = (config.excludePatterns ?? []).map((p) => new RegExp(p));
  const jobs = walk.entries.filter((e) => !exclude.some((re) => re.test(e.url)));

  console.log(`\n┌─ ${seed.name} · ${walk.sitemapsFetched} file sitemap${walk.truncated ? ' (chạm trần)' : ''}`);
  for (const error of walk.errors) console.log(`│  ✗ ${error.url}: ${error.message}`);
  console.log(`└─ ${jobs.length} URL tin`);

  const patterns = options.patterns ?? [config.urlIncludePattern ?? null];
  for (const pattern of patterns) {
    report(jobs, pattern ? new RegExp(pattern, 'i') : null, options.sample);
  }
}

function report(jobs: readonly { url: string }[], include: RegExp | null, sample: number): void {
  const kept = include ? jobs.filter((e) => include.test(e.url)) : [...jobs];
  const dropped = include ? jobs.filter((e) => !include.test(e.url)) : [];
  const pct = jobs.length ? ((kept.length / jobs.length) * 100).toFixed(1) : '0';

  console.log(`\n  mẫu: ${include ? include.source.slice(0, 100) : '(không lọc)'}`);
  console.log(`  → ${kept.length}/${jobs.length} khớp (${pct}%)`);
  console.log('  Khớp (rải đều):');
  for (const entry of pick(kept, sample)) console.log(`    + ${entry.url}`);
  if (dropped.length) {
    console.log('  Bị loại (rải đều) — soi xem có tin đúng nghề bị bỏ sót không:');
    for (const entry of pick(dropped, sample)) console.log(`    - ${entry.url}`);
  }
}

/** Lấy mẫu rải đều thay vì vài dòng đầu — đầu file thường là tin cùng một ngày. */
function pick<T>(items: readonly T[], n: number): T[] {
  if (items.length <= n) return [...items];
  const step = items.length / n;
  return Array.from({ length: n }, (_, i) => items[Math.floor(i * step)]!);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
