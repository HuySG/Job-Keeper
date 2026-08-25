import { db } from '@/api/db';
import {
  MAX_DETAIL_PAGES_PER_SOURCE,
  MAX_SITEMAP_PAGES_PER_SOURCE,
  MISS_COUNT_TO_CLOSED,
  MISS_COUNT_TO_STALE,
} from '@/constants/crawl';
import {
  CrawlTrigger,
  JobStatus,
  ParseStatus,
  RunStatus,
  StatusReason,
  type SourceKind,
} from '@/enums';

import { HostAbortedError, PoliteFetcher } from './fetcher';
import type { NormalizedJob } from './normalize';
import { toMatchKey } from './normalize/text';
import { getAdapter } from './sources/registry';
import type { SourceConfig } from './sources/types';
import { createBlobStore, type BlobStore } from './storage/blob';

/**
 * Đường đi của dữ liệu:
 *
 *   DISCOVER ─► FETCH ─► EXTRACT ─► NORMALIZE ─► UPSERT ─► REAP ─► LOG
 *
 * Hai nguyên tắc cứng:
 *
 * 1. **Crawler chỉ GHI, web chỉ ĐỌC.** Không có đường nào từ lượt truy cập của
 *    người dùng đi thẳng ra sàn nguồn. Trang vẫn chạy bình thường kể cả khi
 *    cả sáu nguồn cùng sập.
 *
 * 2. **Một nguồn hỏng không được kéo theo nguồn khác.** Mỗi nguồn có bản ghi
 *    CrawlRunSource riêng, và lỗi được bắt ở ranh giới từng nguồn.
 */

export interface CrawlOptions {
  trigger?: CrawlTrigger;
  /** Chỉ chạy các nguồn có code trong danh sách này. */
  sourceCodes?: string[];
  /** Bỏ qua mốc thời gian, quét đầy đủ. Dùng cho backfill. */
  full?: boolean;
  maxDetailPages?: number;
  maxSitemaps?: number;
  /** Chạy khô: không ghi DB, chỉ in ra. Dùng để kiểm parser trên nguồn thật. */
  dryRun?: boolean;
  log?: (message: string) => void;
}

export interface CrawlSummary {
  runId: number | null;
  status: RunStatus;
  bySource: {
    code: string;
    status: RunStatus;
    discovered: number;
    fetched: number;
    created: number;
    updated: number;
    failed: number;
    closed: number;
    error?: string;
  }[];
  totals: { created: number; updated: number; failed: number; closed: number };
}

export async function runCrawl(options: CrawlOptions = {}): Promise<CrawlSummary> {
  const {
    trigger = CrawlTrigger.MANUAL,
    sourceCodes,
    full = false,
    maxDetailPages = MAX_DETAIL_PAGES_PER_SOURCE,
    maxSitemaps = MAX_SITEMAP_PAGES_PER_SOURCE,
    dryRun = false,
    log = (message: string) => console.log(message),
  } = options;

  const sources = await loadSources(sourceCodes);
  if (sources.length === 0) {
    log('Không có nguồn nào đang bật. Chạy `npm run db:seed` trước.');
    return { runId: null, status: RunStatus.FAILED, bySource: [], totals: zeroTotals() };
  }

  const fetcher = new PoliteFetcher();
  const blobs = dryRun ? createBlobStore('null') : createBlobStore();

  const run = dryRun ? null : await db.crawlRun.create({ data: { trigger } });
  const summary: CrawlSummary = {
    runId: run?.id ?? null,
    status: RunStatus.RUNNING,
    bySource: [],
    totals: zeroTotals(),
  };

  for (const source of sources) {
    const result = await crawlOneSource({
      source,
      fetcher,
      blobs,
      runId: run?.id ?? null,
      full,
      maxDetailPages,
      maxSitemaps,
      dryRun,
      log: (message) => log(`[${source.code}] ${message}`),
    });

    summary.bySource.push(result);
    summary.totals.created += result.created;
    summary.totals.updated += result.updated;
    summary.totals.failed += result.failed;
    summary.totals.closed += result.closed;
  }

  const anyFailed = summary.bySource.some((s) => s.status === RunStatus.FAILED);
  const allFailed = summary.bySource.every((s) => s.status === RunStatus.FAILED);
  summary.status = allFailed ? RunStatus.FAILED : anyFailed ? RunStatus.PARTIAL : RunStatus.SUCCESS;

  if (run) {
    await db.crawlRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: summary.status,
        pagesFetched: fetcher.stats.requests,
        pagesNotModified: fetcher.stats.notModified,
        postingsNew: summary.totals.created,
        postingsUpdated: summary.totals.updated,
        postingsFailed: summary.totals.failed,
        postingsClosed: summary.totals.closed,
        urlsDiscovered: summary.bySource.reduce((sum, s) => sum + s.discovered, 0),
        errorLog: summary.bySource.filter((s) => s.error).map((s) => `${s.code}: ${s.error}`).join('\n') || null,
      },
    });
  }

  log(
    `\nXong: ${summary.totals.created} tin mới, ${summary.totals.updated} cập nhật, ` +
      `${summary.totals.closed} đóng, ${summary.totals.failed} lỗi. ` +
      `${fetcher.stats.requests} request, ${(fetcher.stats.bytes / 1e6).toFixed(1)} MB, ` +
      `${fetcher.stats.notModified} lần 304.`,
  );
  if (fetcher.stats.robotsBlocked > 0) {
    log(`${fetcher.stats.robotsBlocked} URL bị robots.txt chặn — đã tôn trọng.`);
  }

  return summary;
}

// ─────────────────────────────────────────────────────────────────────────────

interface CrawlSourceArgs {
  source: SourceConfig;
  fetcher: PoliteFetcher;
  blobs: BlobStore;
  runId: number | null;
  full: boolean;
  maxDetailPages: number;
  maxSitemaps: number;
  dryRun: boolean;
  log: (message: string) => void;
}

async function crawlOneSource(args: CrawlSourceArgs): Promise<CrawlSummary['bySource'][number]> {
  const { source, fetcher, blobs, runId, full, dryRun, log } = args;

  const result = {
    code: source.code,
    status: RunStatus.RUNNING as RunStatus,
    discovered: 0,
    fetched: 0,
    created: 0,
    updated: 0,
    failed: 0,
    closed: 0,
    error: undefined as string | undefined,
  };

  const runSource =
    runId && !dryRun
      ? await db.crawlRunSource.create({ data: { runId, sourceId: source.id } })
      : null;

  // Mốc crawl tăng dần: lần chạy thành công gần nhất của CHÍNH nguồn này.
  // Lùi lại 1 giờ để không bỏ sót tin đăng ngay lúc lần chạy trước kết thúc.
  const modifiedSince = full ? null : await lastSuccessfulRun(source.id);

  /** Tập externalId còn thấy trong lượt quét này — tầng 2 của máy kiểm còn-sống. */
  const seen = new Set<string>();
  /** true nếu adapter quét được toàn bộ danh mục; chỉ khi đó mới dám đóng tin. */
  let sweptFully = !full ? false : true;

  try {
    const adapter = getAdapter(source);
    // Hai khái niệm khác nhau, đừng gộp làm một trong log:
    //   `modifiedSince` = có mốc để crawl tăng dần hay không
    //   `full`          = có quét HẾT danh mục hay không (chỉ khi đó mới dám đóng tin)
    // Log cũ ghi "quét đầy đủ" cho cả hai, khiến người đọc tưởng tin vắng mặt
    // đã được đối chiếu xong trong khi thật ra chưa.
    const scope = full ? 'quét HẾT danh mục' : 'quét có trần, KHÔNG đóng tin vắng mặt';
    const since = modifiedSince ? `từ ${modifiedSince.toISOString()}` : 'không có mốc tăng dần';
    log(`bắt đầu (${adapter.kind} · ${since} · ${scope})`);

    for await (const item of adapter.run({
      source,
      fetcher,
      blobs,
      modifiedSince,
      limits: { maxDetailPages: args.maxDetailPages, maxSitemaps: args.maxSitemaps },
      log,
    })) {
      switch (item.kind) {
        case 'seen':
          seen.add(item.externalId);
          result.discovered += 1;
          break;

        case 'job': {
          result.fetched += 1;
          if (dryRun) {
            log(preview(item.job));
            result.created += 1;
            break;
          }
          const outcome = await upsertJob(source, item.job, item.rawKey);
          if (outcome === 'created') result.created += 1;
          else result.updated += 1;
          break;
        }

        case 'skipped':
          break;

        case 'error':
          result.failed += 1;
          log(`lỗi: ${item.url} — ${item.message}`);
          break;
      }
    }

    // Chỉ dám kết luận "tin biến mất" khi đã quét ĐẦY ĐỦ danh mục. Quét tăng
    // dần thì đương nhiên phần lớn tin không xuất hiện — đóng chúng lại là xoá
    // sổ cả kho dữ liệu chỉ vì một lần chạy nhanh.
    sweptFully = full;
    if (sweptFully && !dryRun && seen.size > 0) {
      result.closed = await reapMissing(source.id, seen);
    }

    result.status = result.failed > 0 ? RunStatus.PARTIAL : RunStatus.SUCCESS;
  } catch (err) {
    // Nguồn bảo dừng thì đó không phải lỗi của ta — ghi ABORTED chứ không FAILED,
    // để giám sát không báo động nhầm.
    const aborted = err instanceof HostAbortedError;
    result.status = aborted ? RunStatus.ABORTED : RunStatus.FAILED;
    result.error = (err as Error).message;
    log(`DỪNG: ${result.error}`);
  }

  if (runSource) {
    await db.crawlRunSource.update({
      where: { id: runSource.id },
      data: {
        status: result.status,
        urlsDiscovered: result.discovered,
        pagesFetched: result.fetched,
        postingsNew: result.created,
        postingsUpdated: result.updated,
        postingsFailed: result.failed,
        errorLog: result.error ?? null,
      },
    });
  }

  log(
    `xong: ${result.discovered} URL, ${result.created} mới, ${result.updated} cập nhật, ` +
      `${result.closed} đóng, ${result.failed} lỗi`,
  );
  return result;
}

async function loadSources(codes?: string[]): Promise<SourceConfig[]> {
  const rows = await db.source.findMany({
    where: { isActive: true, ...(codes?.length ? { code: { in: codes } } : {}) },
    orderBy: { priority: 'asc' },
  });

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    homeUrl: row.homeUrl,
    kind: row.kind as SourceKind,
    entryUrl: row.entryUrl,
    jobUrlPattern: row.jobUrlPattern,
    config: (row.config ?? null) as Record<string, unknown> | null,
    priority: row.priority,
  }));
}

async function lastSuccessfulRun(sourceId: number): Promise<Date | null> {
  const last = await db.crawlRunSource.findFirst({
    where: { sourceId, status: { in: [RunStatus.SUCCESS, RunStatus.PARTIAL] } },
    orderBy: { id: 'desc' },
    include: { run: true },
  });
  if (!last?.run.finishedAt) return null;
  return new Date(last.run.finishedAt.getTime() - 60 * 60 * 1000);
}

/**
 * Tầng 2 của máy kiểm còn-sống: tin nào không xuất hiện trong lượt quét đầy đủ
 * thì missCount tăng. Gần như miễn phí — đằng nào cũng phải đọc sitemap.
 */
async function reapMissing(sourceId: number, seen: Set<string>): Promise<number> {
  const alive = await db.jobPosting.findMany({
    where: { sourceId, status: { in: [JobStatus.OPEN, JobStatus.STALE] } },
    select: { id: true, externalId: true, missCount: true },
  });

  const missing = alive.filter((posting) => !seen.has(posting.externalId));
  let closed = 0;

  for (const posting of missing) {
    const missCount = posting.missCount + 1;
    const status =
      missCount >= MISS_COUNT_TO_CLOSED
        ? JobStatus.CLOSED
        : missCount >= MISS_COUNT_TO_STALE
          ? JobStatus.STALE
          : JobStatus.OPEN;

    await db.jobPosting.update({
      where: { id: posting.id },
      data: { missCount, status, statusReason: StatusReason.MISSING_FROM_SITEMAP },
    });
    if (status === JobStatus.CLOSED) closed += 1;
  }

  // Tin thấy lại thì reset — tin có thể tạm vắng khỏi sitemap rồi quay lại,
  // và không reset là nó sẽ bị đóng oan sau ba lần vắng rải rác.
  await db.jobPosting.updateMany({
    where: { sourceId, externalId: { in: [...seen] }, missCount: { gt: 0 } },
    data: { missCount: 0, statusReason: StatusReason.SEEN_AGAIN },
  });

  return closed;
}

/**
 * Ghi một tin vào DB.
 *
 * Trả 'created' hay 'updated' để đếm đúng — con số "bao nhiêu tin MỚI" là thứ
 * duy nhất cho biết crawler còn sống hay đã chết lặng lẽ.
 */
async function upsertJob(
  source: SourceConfig,
  job: NormalizedJob,
  rawKey: string | null,
): Promise<'created' | 'updated'> {
  const company = await upsertCompany(job);

  const existing = await db.jobPosting.findUnique({
    where: { sourceId_externalId: { sourceId: source.id, externalId: job.externalId } },
    select: { id: true, contentHash: true, salaryMin: true, salaryMax: true, status: true },
  });

  const now = new Date();
  const data = {
    sourceId: source.id,
    externalId: job.externalId,
    url: job.url,
    title: job.title,
    titleNorm: job.titleNorm,
    companyId: company.id,
    descriptionText: job.descriptionText,
    contentHash: job.contentHash,
    rawKey,
    salaryMin: job.salary.min,
    salaryMax: job.salary.max,
    salaryCurrency: job.salary.currency,
    salaryPeriod: job.salary.period,
    salaryIsPublic: job.salary.isPublic,
    salaryRaw: job.salary.raw,
    fxRate: job.salary.fxRate,
    fxRateDate: job.salary.fxRateDate,
    employmentType: job.employmentType,
    workMode: job.workMode,
    level: job.level,
    yearsExpMin: job.yearsExpMin,
    yearsExpMax: job.yearsExpMax,
    postedAt: job.postedAt,
    expiresAt: job.expiresAt,
    lastSeenAt: now,
    missCount: 0,
    parseStatus: job.salary.outOfRange ? ParseStatus.PARTIAL : job.parseStatus,
    parseError: job.parseError,
    ...deriveStatus(job),
  };

  if (!existing) {
    const created = await db.jobPosting.create({ data });
    await linkLocations(created.id, job);
    return 'created';
  }

  // Tin bị nguồn sửa: lưu vết trước khi ghi đè. Không có bảng audit thì số cũ
  // biến mất im lặng và không cách nào đối chiếu khi nghi ngờ.
  if (existing.contentHash !== job.contentHash) {
    const salaryChanged =
      existing.salaryMin !== job.salary.min || existing.salaryMax !== job.salary.max;
    if (salaryChanged) {
      await db.jobAudit.create({
        data: {
          postingId: existing.id,
          field: 'salary',
          oldValue: `${existing.salaryMin}-${existing.salaryMax}`,
          newValue: `${job.salary.min}-${job.salary.max}`,
          reason: 'source_edited',
        },
      });
    }
  }

  await db.jobPosting.update({ where: { id: existing.id }, data });
  await linkLocations(existing.id, job);
  return 'updated';
}

/**
 * Trạng thái ban đầu — tầng 1 của máy kiểm, 0 request.
 * `validThrough` đã qua là một trong ba tín hiệu hết hạn mà Google bắt các sàn
 * tuân thủ, nên nó đáng tin.
 */
function deriveStatus(job: NormalizedJob): { status: JobStatus; statusReason: string | null } {
  if (job.expiresAt && job.expiresAt.getTime() < Date.now()) {
    return { status: JobStatus.EXPIRED, statusReason: StatusReason.VALID_THROUGH_PASSED };
  }
  return { status: JobStatus.OPEN, statusReason: null };
}

async function upsertCompany(job: NormalizedJob): Promise<{ id: number }> {
  const alias = await db.companyAlias.findUnique({
    where: { raw: job.companyKey },
    select: { companyId: true },
  });
  if (alias) return { id: alias.companyId };

  const company = await db.company.upsert({
    where: { slug: job.companySlug },
    update: {
      // Chỉ điền vào chỗ còn trống, không ghi đè: nguồn có priority tốt hơn đã
      // ghi trước rồi thì nguồn kém hơn không được phép sửa lại.
      website: job.companyWebsite ?? undefined,
      logoUrl: job.companyLogoUrl ?? undefined,
    },
    create: {
      slug: job.companySlug,
      name: job.companyName,
      website: job.companyWebsite,
      logoUrl: job.companyLogoUrl,
    },
    select: { id: true },
  });

  await db.companyAlias.upsert({
    where: { raw: job.companyKey },
    update: {},
    create: { raw: job.companyKey, companyId: company.id },
  });

  return company;
}

async function linkLocations(postingId: number, job: NormalizedJob): Promise<void> {
  const slugs = [...new Set(job.locations.map((l) => l.province?.slug).filter(Boolean))] as string[];
  if (slugs.length === 0) return;

  const rows = await db.location.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });

  for (const row of rows) {
    const raw = job.locations.find((l) => l.province?.slug === row.slug)?.raw ?? row.slug;
    await db.jobLocation.upsert({
      where: { postingId_locationId: { postingId, locationId: row.id } },
      update: { rawText: raw },
      create: { postingId, locationId: row.id, rawText: raw },
    });
  }
}

function preview(job: NormalizedJob): string {
  const salary = job.salary.isPublic
    ? `${fmt(job.salary.min)}–${fmt(job.salary.max)}`
    : 'thoả thuận';
  const place = job.locations.map((l) => l.province?.name ?? l.raw).join(', ') || '?';
  return `  ${job.title} · ${job.companyName} · ${salary} · ${job.level ?? '?'} · ${place}`;
}

function fmt(value: number | null): string {
  return value === null ? '?' : `${(value / 1e6).toFixed(1)}tr`;
}

function zeroTotals(): CrawlSummary['totals'] {
  return { created: 0, updated: 0, failed: 0, closed: 0 };
}

/** Tra cứu phụ dùng khi ánh xạ kỹ năng — để sẵn cho chặng sau. */
export { toMatchKey };
