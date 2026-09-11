import { SOURCE_SEEDS } from '@/constants/source';
import { PoliteFetcher } from '@/crawler/fetcher';
import { applyFetchQuirks, getAdapter } from '@/crawler/sources/registry';
import type { SourceConfig } from '@/crawler/sources/types';
import { createBlobStore } from '@/crawler/storage/blob';
import type { SourceKind } from '@/enums';

import { loadEnv, parseArgs } from './_env';

/**
 * Dò một nguồn — chạy THẬT vào sàn thật, KHÔNG cần CSDL.
 *
 *   npm run probe -- --source topdev --limit 3
 *   npm run probe -- --source vnw --limit 5
 *
 * Đây là công cụ dùng nhiều nhất khi thêm nguồn mới: nó đi hết chuỗi
 * robots.txt → sitemap → JSON-LD → chuẩn hoá và in ra thứ parser đọc được,
 * trước khi cho phép bất cứ thứ gì chạm vào DB.
 *
 * Khác `npm run crawl -- --dry` ở chỗ lệnh kia vẫn đọc danh sách nguồn từ DB,
 * còn lệnh này lấy thẳng từ SOURCE_SEEDS nên chạy được trên máy trắng.
 */
async function main(): Promise<void> {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  const code = args.string('source');
  const limit = args.number('limit') ?? 3;

  if (!code) {
    console.log('Dùng: npm run probe -- --source <code> [--limit N]\n');
    console.log('Nguồn có sẵn:');
    for (const seed of SOURCE_SEEDS) {
      console.log(`  ${seed.code.padEnd(12)} ${seed.name.padEnd(16)} ${seed.kind}`);
    }
    return;
  }

  const seed = SOURCE_SEEDS.find((s) => s.code === code);
  if (!seed) {
    console.error(`Không có nguồn "${code}".`);
    process.exitCode = 1;
    return;
  }

  const source: SourceConfig = {
    id: -1,
    code: seed.code,
    name: seed.name,
    homeUrl: seed.homeUrl,
    kind: seed.kind as SourceKind,
    entryUrl: seed.entryUrl,
    jobUrlPattern: seed.jobUrlPattern,
    config: seed.config,
    priority: seed.priority,
  };

  const fetcher = new PoliteFetcher();
  applyFetchQuirks(fetcher, [source]);
  const adapter = getAdapter(source);

  console.log(`\n┌─ ${seed.name} (${seed.code}) · ${adapter.kind}`);
  console.log(`│  ${seed.entryUrl}`);
  console.log('└────────────────────────────────────────────────────\n');

  const counts = { seen: 0, job: 0, skipped: 0, error: 0 };
  const started = Date.now();

  try {
    for await (const item of adapter.run({
      source,
      fetcher,
      blobs: createBlobStore('null'),
      modifiedSince: null,
      limits: { maxDetailPages: limit, maxSitemaps: 5 },
      log: (message) => console.log(`  · ${message}`),
    })) {
      switch (item.kind) {
        case 'seen':
          counts.seen += 1;
          break;

        case 'skipped':
          counts.skipped += 1;
          break;

        case 'error':
          counts.error += 1;
          console.log(`  ✗ ${item.url}\n    ${item.message}`);
          break;

        case 'job': {
          counts.job += 1;
          const job = item.job;
          const salary = job.salary.isPublic
            ? `${money(job.salary.min)} – ${money(job.salary.max)}` +
              (job.salary.currency !== 'VND' ? ` (gốc ${job.salary.currency})` : '')
            : 'thoả thuận';
          const place = job.locations.map((l) => l.province?.name ?? `?${l.raw}`).join(', ') || '—';

          console.log(`\n  ✓ ${job.title}`);
          console.log(`    công ty   ${job.companyName}  [${job.companySlug}]`);
          console.log(`    lương     ${salary}`);
          console.log(`    cấp bậc   ${job.level ?? '—'}   kinh nghiệm ${job.yearsExpMin ?? '—'}–${job.yearsExpMax ?? '—'} năm`);
          console.log(`    nơi làm   ${place}   ${job.workMode ?? ''} ${job.employmentType ?? ''}`);
          console.log(`    hiệu lực  ${date(job.postedAt)} → ${date(job.expiresAt)}`);
          console.log(`    kỹ năng   ${job.skillTexts.slice(0, 8).join(', ') || '—'}`);
          console.log(`    id/url    ${job.externalId}  ${job.url}`);
          if (job.parseStatus !== 'OK') console.log(`    ⚠ ${job.parseStatus}: ${job.parseError}`);
          break;
        }
      }
    }
  } catch (err) {
    console.error(`\n  DỪNG: ${(err as Error).message}`);
    process.exitCode = 1;
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `\n─────────────────────────────────────────────────────\n` +
      `  ${counts.seen} URL thấy · ${counts.job} tin đọc được · ` +
      `${counts.skipped} bỏ qua · ${counts.error} lỗi\n` +
      `  ${fetcher.stats.requests} request · ` +
      `${(fetcher.stats.bytes / 1e6).toFixed(2)} MB · ${seconds}s` +
      (fetcher.stats.robotsBlocked ? ` · ${fetcher.stats.robotsBlocked} bị robots.txt chặn` : ''),
  );
}

function money(value: number | null): string {
  return value === null ? '?' : `${(value / 1e6).toFixed(1)}tr`;
}

function date(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : '—';
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
