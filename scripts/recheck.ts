import { Prisma } from '@prisma/client';

import { db } from '@/api/db';
import {
  EXPIRY_TEXT_MARKERS,
  MAX_RECHECKS_PER_RUN,
  MISS_COUNT_TO_STALE,
  RECHECK_BEFORE_EXPIRY_DAYS,
  RECHECK_STALE_AFTER_DAYS,
} from '@/constants/crawl';
import { HostAbortedError, PoliteFetcher, RobotsDisallowedError } from '@/crawler/fetcher';
import { extractJobPostings } from '@/crawler/jsonld';
import { applyFetchQuirks } from '@/crawler/sources/registry';
import { SAVED_RECHECK_HOURS } from '@/constants/saved';
import { CrawlTrigger, JobStatus, RunStatus, StatusReason } from '@/enums';
import { matchKeyOf } from '@/lib/cv-profile';
import { compileField, matchJob } from '@/lib/field-match';

import { loadEnv, parseArgs } from './_env';

/**
 * Máy kiểm "tin còn tuyển không" — tầng 3 và tầng 4.
 *
 *   npm run recheck                             mọi tin đến hạn kiểm
 *   npm run recheck -- --filter thu-mua-hcm     chỉ tin thuộc một ngành  ← rẻ nhất
 *   npm run recheck -- --dry                    KHÔNG ghi DB, chỉ báo sẽ đổi gì
 *   npm run recheck -- --limit 50
 *   npm run recheck -- --all                    bỏ ba cái van, kiểm tất
 *
 * Tầng 1 và 2 (validThrough, vắng khỏi sitemap) đã nằm trong crawler và không
 * tốn request nào. Script này lo hai tầng còn lại, và cái đắt nhất — tầng 4 —
 * chỉ chạy cho tin thoả MỘT trong ba van:
 *
 *   (a) sắp hết validThrough (<= RECHECK_BEFORE_EXPIRY_DAYS ngày)
 *   (b) đã vắng khỏi sitemap ít nhất một lần (missCount >= 1)
 *   (c) quá RECHECK_STALE_AFTER_DAYS ngày chưa gọi HTTP vào trang
 *
 * Ba cái van đó là lý do ngân sách là vài trăm request/ngày chứ không phải
 * vài chục nghìn. Thêm `--filter` thì còn vài chục.
 */

/**
 * Tin sống hay chết được đọc bằng tín hiệu nào, tuỳ NGUỒN.
 *
 * Phải phân biệt, không được dùng chung một luật, vì luật "trang mất khối
 * JSON-LD nghĩa là tin đã gỡ" chỉ đúng với nguồn vốn CÓ JSON-LD.
 *
 * ĐO THẬT 08/09/2026 — trang tin VietnamWorks đang tuyển
 * (`/truong-phong-mua-hang-procurement-manager--2098170-jv`) trả HTTP 200,
 * 67 KB, và **không có một khối JSON-LD nào** (trang dựng bằng JS). Áp luật
 * chung vào đây là đánh dấu hết hạn toàn bộ tin VietnamWorks trong kho.
 */
type ProbeKind =
  /** Trạng thái HTTP + mất khối JSON-LD + validThrough + chữ báo hết hạn. */
  | 'jsonld'
  /** Chỉ trạng thái HTTP + chữ báo hết hạn. Cho nguồn không nhúng JSON-LD. */
  | 'text'
  /** Không gọi HTTP. Cho nguồn tự khai còn-sống ở chỗ khác. */
  | 'none';

interface Outcome {
  status: JobStatus | null;
  reason: string | null;
  /** validThrough mới đọc được — nguồn có thể GIA HẠN tin, không chỉ gỡ tin. */
  expiresAt?: Date | null;
  note: string;
}

/** Đúng những cột vòng kiểm cần — dùng chung cho tin thường và tin đã lưu. */
const POSTING_SELECT = {
  id: true,
  url: true,
  title: true,
  descriptionText: true,
  status: true,
  expiresAt: true,
  etag: true,
  lastModifiedHdr: true,
  missCount: true,
  // `homeUrl` chỉ dùng để biết host nào phải đi bằng curl — xem applyFetchQuirks.
  source: { select: { code: true, kind: true, config: true, homeUrl: true } },
} satisfies Prisma.JobPostingSelect;

/**
 * Tin đã lưu, còn sống, chưa được gọi lại trong SAVED_RECHECK_HOURS giờ.
 *
 * Bảng `SavedJob` chưa có (mã mới đã lên mà chưa `db:push`) thì bỏ qua bước
 * này thay vì làm đổ cả lượt kiểm — workflow chạy bốn lần một ngày, và lượt
 * kiểm tin thường không được phép chết vì một tính năng phụ.
 */
async function loadSavedDue(now: Date, sourceCode: string | undefined) {
  const before = new Date(now.getTime() - SAVED_RECHECK_HOURS * 60 * 60 * 1000);
  try {
    return await db.jobPosting.findMany({
      where: {
        status: { in: [JobStatus.OPEN, JobStatus.STALE] },
        saved: { isNot: null },
        OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: before } }],
        ...(sourceCode ? { source: { code: sourceCode } } : {}),
      },
      select: POSTING_SELECT,
      orderBy: { lastCheckedAt: { sort: 'asc', nulls: 'first' } },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      console.log('Bảng SavedJob chưa có — bỏ qua bước ưu tiên tin đã lưu (chạy npm run db:push).');
      return [];
    }
    throw error;
  }
}

async function main(): Promise<void> {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  const slug = args.string('filter');
  const dryRun = args.boolean('dry');
  const ignoreValves = args.boolean('all');
  const sourceCode = args.string('source');
  const limit = Math.min(args.number('limit') ?? MAX_RECHECKS_PER_RUN, MAX_RECHECKS_PER_RUN);

  const now = new Date();

  // ── Tầng 1 quét lại, 0 request ─────────────────────────────────────────────
  // validThrough trôi qua trong lúc ta không nhìn. Dọn ở đây trước cho sạch,
  // vừa miễn phí vừa bớt được đúng ngần ấy request ở tầng 4 bên dưới.
  const passedDeadline = await db.jobPosting.findMany({
    where: {
      status: { in: [JobStatus.OPEN, JobStatus.STALE] },
      expiresAt: { not: null, lt: now },
    },
    select: { id: true, status: true },
  });

  if (passedDeadline.length > 0 && !dryRun) {
    for (const posting of passedDeadline) {
      await recordStatus(posting.id, posting.status, JobStatus.EXPIRED, StatusReason.VALID_THROUGH_PASSED);
    }
  }
  console.log(
    `Tầng 1 (0 request): ${passedDeadline.length} tin quá validThrough → EXPIRED` +
      (dryRun ? ' [chạy khô, chưa ghi]' : ''),
  );

  // ── Chọn ứng viên cho tầng 3–4 ─────────────────────────────────────────────
  const soon = new Date(now.getTime() + RECHECK_BEFORE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const staleBefore = new Date(now.getTime() - RECHECK_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);

  const filter = slug ? await db.savedFilter.findUnique({ where: { slug } }) : null;
  if (slug && !filter) {
    console.error(`Không có ngành "${slug}". Chạy \`npm run db:seed\` trước.`);
    process.exitCode = 1;
    return;
  }

  const valves = ignoreValves
    ? {}
    : {
        OR: [
          { expiresAt: { lte: soon } },
          { missCount: { gte: MISS_COUNT_TO_STALE } },
          { lastCheckedAt: null },
          { lastCheckedAt: { lt: staleBefore } },
        ],
      };

  const candidates = await db.jobPosting.findMany({
    where: {
      status: { in: [JobStatus.OPEN, JobStatus.STALE] },
      ...(sourceCode ? { source: { code: sourceCode } } : {}),
      ...(filter?.provinces.length
        ? { locations: { some: { location: { slug: { in: filter.provinces } } } } }
        : {}),
      ...valves,
    },
    select: POSTING_SELECT,
    // Tin chưa kiểm lần nào đi trước, rồi tới tin sắp hết hạn nhất. Khi ngân
    // sách không đủ cho tất cả thì đây là thứ tự đáng tiêu tiền nhất.
    orderBy: [{ lastCheckedAt: { sort: 'asc', nulls: 'first' } }, { expiresAt: 'asc' }],
    take: limit,
  });

  const field = filter
    ? compileField(
        { keywords: filter.keywords, excludes: filter.excludes },
        { matchKey: matchKeyOf(filter.profile) },
      )
    : null;

  // ── Tin đã lưu đi TRƯỚC ────────────────────────────────────────────────────
  //
  // Trang "Tin đã lưu" hứa kiểm mỗi tin đã lưu mỗi ngày, ưu tiên hơn tin thường.
  // Nên chúng bỏ qua ba cái van và cả bộ lọc ngành: người dùng đã tự chọn,
  // không cần từ điển xác nhận lại. Trần SAVED_JOB_LIMIT giữ phần này ở mức vài
  // chục request một ngày.
  const savedDue = await loadSavedDue(now, sourceCode);
  const savedIds = new Set(savedDue.map((posting) => posting.id));

  const fieldQueue = (
    field
      ? candidates.filter(
          (posting) =>
            matchJob(field, { title: posting.title, description: posting.descriptionText })
              .verdict !== 'reject',
        )
      : candidates
  ).filter((posting) => !savedIds.has(posting.id));

  const queue = [...savedDue, ...fieldQueue].slice(0, limit);
  if (savedDue.length > 0) {
    console.log(`Ưu tiên ${savedDue.length} tin đã lưu quá ${SAVED_RECHECK_HOURS} giờ chưa kiểm.`);
  }

  console.log(
    `Tầng 3–4: ${queue.length} tin cần gọi HTTP` +
      (field ? ` (lọc từ ${candidates.length} tin trong phạm vi ngành "${slug}")` : '') +
      (ignoreValves ? ' [--all: bỏ qua ba van]' : '') +
      '\n',
  );

  if (queue.length === 0) {
    console.log('Không có tin nào đến hạn kiểm. Ngân sách request giữ nguyên.');
    return;
  }

  const fetcher = new PoliteFetcher();
  // Máy kiểm gọi thẳng vào trang chi tiết, không đi qua adapter nào — nên nó
  // phải tự khai lại những host cần curl. Thiếu dòng này thì đúng các nguồn mà
  // crawler đọc được sẽ trả 403 ở đây, và tin còn sống bị kết luận là đã chết.
  applyFetchQuirks(
    fetcher,
    queue.map((posting) => posting.source),
  );
  const run =
    dryRun || queue.length === 0
      ? null
      : await db.crawlRun.create({ data: { trigger: CrawlTrigger.RECHECK } });

  const tally = { checked: 0, notModified: 0, alive: 0, dead: 0, revived: 0, extended: 0, unknown: 0, skipped: 0 };

  for (const posting of queue) {
    const probe = probeKindOf(posting.source);
    if (probe === 'none') {
      tally.skipped += 1;
      continue;
    }

    let outcome: Outcome;
    try {
      outcome = await probeOne(fetcher, posting, probe);
    } catch (err) {
      if (err instanceof HostAbortedError) {
        console.log(`\n⏸ ${err.message} — dừng phiên, phần còn lại để lần sau.`);
        break;
      }
      if (err instanceof RobotsDisallowedError) {
        tally.skipped += 1;
        continue;
      }
      tally.unknown += 1;
      console.log(`  ? ${trim(posting.title, 44)} — ${(err as Error).message}`);
      continue;
    }

    tally.checked += 1;
    if (outcome.note === '304') tally.notModified += 1;

    const changedStatus = outcome.status !== null && outcome.status !== posting.status;
    const changedExpiry =
      outcome.expiresAt !== undefined &&
      outcome.expiresAt?.getTime() !== posting.expiresAt?.getTime();

    if (outcome.status === JobStatus.EXPIRED) tally.dead += 1;
    else if (changedStatus && outcome.status === JobStatus.OPEN) tally.revived += 1;
    else tally.alive += 1;
    if (changedExpiry && outcome.status !== JobStatus.EXPIRED) tally.extended += 1;

    const mark =
      outcome.status === JobStatus.EXPIRED ? '✗' : changedStatus ? '↺' : outcome.note === '304' ? '·' : '✓';
    console.log(
      `  ${mark} ${trim(posting.title, 44).padEnd(44)} ${posting.source.code.padEnd(11)} ${outcome.note}`,
    );

    if (dryRun) continue;

    if (changedStatus && outcome.status) {
      await recordStatus(posting.id, posting.status, outcome.status, outcome.reason);
    }
    if (changedExpiry) {
      await db.jobAudit.create({
        data: {
          postingId: posting.id,
          field: 'expiry',
          oldValue: posting.expiresAt?.toISOString() ?? null,
          newValue: outcome.expiresAt?.toISOString() ?? null,
          reason: 'source_edited',
        },
      });
    }

    await db.jobPosting.update({
      where: { id: posting.id },
      data: {
        lastCheckedAt: new Date(),
        ...(changedExpiry ? { expiresAt: outcome.expiresAt } : {}),
        // Tin gọi được vào tận nơi và còn sống thì lần vắng mặt khỏi sitemap
        // trước đó là báo động giả — xoá nó đi, đừng để cộng dồn tới mức đóng tin.
        ...(outcome.status === JobStatus.OPEN ? { missCount: 0 } : {}),
      },
    });
  }

  if (run) {
    await db.crawlRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: RunStatus.SUCCESS,
        pagesFetched: fetcher.stats.requests,
        pagesNotModified: fetcher.stats.notModified,
        postingsClosed: tally.dead,
        postingsUpdated: tally.alive + tally.revived,
      },
    });
  }

  console.log('\n┌─ Tổng kết kiểm còn-sống');
  console.log(`│  gọi HTTP           ${String(tally.checked).padStart(5)}`);
  console.log(`│  304 không đổi      ${String(tally.notModified).padStart(5)}   (tầng 3, gần như miễn phí)`);
  console.log(`│  còn tuyển          ${String(tally.alive).padStart(5)}`);
  console.log(`│  ĐÃ HẾT / ĐÃ GỠ     ${String(tally.dead).padStart(5)}`);
  console.log(`│  sống lại           ${String(tally.revived).padStart(5)}`);
  console.log(`│  được nguồn gia hạn ${String(tally.extended).padStart(5)}`);
  console.log(`│  không kết luận     ${String(tally.unknown).padStart(5)}   (403/5xx — cố ý KHÔNG đổi trạng thái)`);
  console.log(`│  bỏ qua             ${String(tally.skipped).padStart(5)}`);
  console.log(
    `└─ ${fetcher.stats.requests} request, ${(fetcher.stats.bytes / 1e6).toFixed(1)} MB` +
      (dryRun ? '  [CHẠY KHÔ — chưa ghi gì vào DB]' : ''),
  );
}

/**
 * Nguồn này đọc tín hiệu còn-sống kiểu gì.
 *
 * Lấy từ `Source.config.livenessProbe` nếu có, không thì suy theo `kind`.
 * Để nguồn tự khai được là để lần sau gặp một sàn JS-rendered nữa thì chỉ cần
 * `UPDATE`, không phải sửa file này.
 */
function probeKindOf(source: { kind: string; config: unknown }): ProbeKind {
  const declared = (source.config as { livenessProbe?: ProbeKind } | null)?.livenessProbe;
  if (declared === 'jsonld' || declared === 'text' || declared === 'none') return declared;
  // Nguồn API dựng trang bằng JS nên không có JSON-LD để mà mất — xem ProbeKind.
  return source.kind === 'api' ? 'text' : 'jsonld';
}

async function probeOne(
  fetcher: PoliteFetcher,
  posting: {
    url: string;
    etag: string | null;
    lastModifiedHdr: string | null;
    status: string;
  },
  probe: ProbeKind,
): Promise<Outcome> {
  // Tầng 3: có ETag/Last-Modified thì hỏi "có gì đổi không" thay vì tải cả trang.
  const res = await fetcher.fetch(posting.url, {
    etag: posting.etag,
    lastModified: posting.lastModifiedHdr,
  });

  if (res.status === 404 || res.status === 410) {
    return { status: JobStatus.EXPIRED, reason: StatusReason.HTTP_GONE, note: `HTTP ${res.status}` };
  }

  if (res.notModified) {
    // Trang không đổi kể từ lần kiểm trước, và lần trước nó còn sống.
    return { status: aliveStatus(posting.status), reason: StatusReason.SEEN_AGAIN, note: '304' };
  }

  if (res.status !== 200 || !res.body) {
    // 403 của tầng biên, 5xx lúc nguồn quá tải — KHÔNG phải bằng chứng tin đã gỡ.
    // Im lặng đổi trạng thái ở đây là cách biến một sự cố mạng thành mất dữ liệu.
    return { status: null, reason: null, note: `HTTP ${res.status} — không kết luận` };
  }

  const haystack = res.body.toLowerCase();
  const marker = EXPIRY_TEXT_MARKERS.find((m) => haystack.includes(m));
  if (marker) {
    return {
      status: JobStatus.EXPIRED,
      reason: StatusReason.EXPIRY_MARKER_IN_PAGE,
      note: `trang ghi "${marker}"`,
    };
  }

  if (probe === 'text') {
    return { status: aliveStatus(posting.status), reason: StatusReason.SEEN_AGAIN, note: '200, không thấy dấu hết hạn' };
  }

  const blocks = extractJobPostings(res.body);
  if (blocks.length === 0) {
    // Một trong ba tín hiệu hết hạn mà Google bắt các sàn tuân thủ.
    return { status: JobStatus.EXPIRED, reason: StatusReason.JSONLD_REMOVED, note: 'mất khối JSON-LD' };
  }

  const best = blocks.reduce((a, b) => (Object.keys(b).length > Object.keys(a).length ? b : a));
  const validThrough = readDate(best['validThrough']);

  if (validThrough && validThrough.getTime() < Date.now()) {
    return {
      status: JobStatus.EXPIRED,
      reason: StatusReason.VALID_THROUGH_PASSED,
      expiresAt: validThrough,
      note: `validThrough ${validThrough.toISOString().slice(0, 10)} đã qua`,
    };
  }

  return {
    status: aliveStatus(posting.status),
    reason: StatusReason.SEEN_AGAIN,
    expiresAt: validThrough,
    note: validThrough ? `còn hạn tới ${validThrough.toISOString().slice(0, 10)}` : '200, còn JSON-LD',
  };
}

/** Gọi được vào trang và trang còn sống thì tin quay lại OPEN, kể cả khi đang STALE. */
function aliveStatus(current: string): JobStatus {
  return current === JobStatus.STALE ? JobStatus.OPEN : (current as JobStatus);
}

/** Đổi trạng thái là phải để lại vết. Không có vết thì lúc nghi máy kiểm sai, không có gì để đối chiếu. */
async function recordStatus(
  postingId: number,
  from: string,
  to: JobStatus,
  reason: string | null,
): Promise<void> {
  await db.jobAudit.create({
    data: { postingId, field: 'status', oldValue: from, newValue: to, reason: reason ?? 'recheck' },
  });
  await db.jobPosting.update({
    where: { id: postingId },
    data: { status: to, statusReason: reason, lastCheckedAt: new Date() },
  });
}

function readDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function trim(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

main()
  .catch((err) => {
    console.error('Kiểm còn-sống hỏng:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect().catch(() => undefined);
  });
