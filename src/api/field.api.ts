import 'server-only';

import { db } from '@/api/db';
import { LIST_INCLUDE, PAGE_SIZE, type JobListItem } from '@/api/job.api';
import { JobStatus } from '@/enums';
import { compileField, isNarrowHcm, matchJob, type MatchResult } from '@/lib/field-match';

/**
 * Đọc tin theo "ngành của tôi" — bộ lọc do người dùng định nghĩa, lưu trong
 * bảng `SavedFilter`.
 *
 * Khác `job.api.ts` ở đúng một điểm, nhưng là điểm quan trọng: ở đó bộ lọc là
 * những gì gõ được thành SQL (tỉnh, cấp bậc, lương), còn ở đây bộ lọc là một
 * TỪ ĐIỂN có luật ưu tiên — từ loại thắng từ nhận, tiêu đề nặng hơn mô tả,
 * từ xám không tự kéo tin vào ngành. Luật đó sống ở `lib/field-match.ts` và
 * chạy trong JS.
 *
 * Hệ quả phải nói rõ: **phân trang làm trong bộ nhớ**. Ta lấy toàn bộ tin còn
 * sống trong phạm vi tỉnh của ngành (hiện là vài trăm) rồi mới chấm và cắt
 * trang. Đây là đánh đổi có ý thức, không phải sơ suất — nó đổi lấy việc từ
 * điển sửa được bằng một câu UPDATE mà không phải đụng vào SQL sinh động.
 * Khi phạm vi vượt vài nghìn tin thì phải chuyển sang cột tsvector + GIN, và
 * lúc đó ngưỡng này sẽ tự nhắc: xem `FieldPage.scanned`.
 */

/** Tin còn sống — cùng định nghĩa với `job.api.ts`, cố ý lặp lại để đọc là thấy. */
const ALIVE: string[] = [JobStatus.OPEN, JobStatus.STALE];

/** Coi là "vừa kiểm" nếu đã gọi HTTP/API vào tin trong ngần này giờ. */
export const FRESH_CHECK_HOURS = 48;

export interface FieldMatchedJob {
  job: JobListItem;
  match: MatchResult;
}

export interface FieldPage {
  slug: string;
  name: string;
  keywordCount: number;
  excludeCount: number;
  provinces: string[];
  maxAgeDays: number | null;

  items: FieldMatchedJob[];
  /** Tổng số tin THUỘC ngành (chắc + yếu). */
  total: number;
  strong: number;
  weak: number;
  /** Số tin đã chấm để ra được từng ấy — mẫu số của "độ chính xác". */
  scanned: number;
  /** Bao nhiêu tin thuộc ngành đã được kiểm còn-sống trong FRESH_CHECK_HOURS. */
  freshlyChecked: number;
  /** Bao nhiêu tin bị loại vì nằm ngoài HCM cũ (chỉ khi bật strictHcm). */
  droppedByNarrowHcm: number;

  page: number;
  pageCount: number;
}

export interface FieldQuery {
  page?: number;
  /** false = chỉ hiện tin "nhận chắc" (từ nhận nằm ở TIÊU ĐỀ). */
  includeWeak?: boolean;
  /** true = bỏ tin ở Bình Dương / Bà Rịa – Vũng Tàu (phần sáp nhập 2025). */
  strictHcm?: boolean;
}

export async function findFieldJobs(
  slug: string,
  query: FieldQuery = {},
): Promise<FieldPage | null> {
  const filter = await db.savedFilter.findUnique({ where: { slug } });
  if (!filter) return null;

  const since = filter.maxAgeDays
    ? new Date(Date.now() - filter.maxAgeDays * 24 * 60 * 60 * 1000)
    : null;

  const candidates = await db.jobPosting.findMany({
    where: {
      status: { in: ALIVE },
      ...(filter.provinces.length
        ? { locations: { some: { location: { slug: { in: filter.provinces } } } } }
        : {}),
      ...(since ? { postedAt: { gte: since } } : {}),
      ...(filter.salaryMin
        ? {
            OR: [
              { salaryMin: { gte: filter.salaryMin } },
              { salaryMax: { gte: filter.salaryMin } },
              ...(filter.includeNoSalary ? [{ salaryIsPublic: false }] : []),
            ],
          }
        : {}),
      ...(filter.levels.length ? { level: { in: filter.levels } } : {}),
    },
    orderBy: { postedAt: 'desc' },
    include: LIST_INCLUDE,
  });

  const field = compileField({ keywords: filter.keywords, excludes: filter.excludes });

  const matched: FieldMatchedJob[] = [];
  let droppedByNarrowHcm = 0;

  for (const job of candidates) {
    if (query.strictHcm && !isNarrowHcm(job.locations.map((l) => l.rawText))) {
      droppedByNarrowHcm += 1;
      continue;
    }
    const match = matchJob(field, { title: job.title, description: job.descriptionText });
    if (match.verdict === 'reject') continue;
    if (match.verdict === 'weak' && !query.includeWeak) continue;
    matched.push({ job, match });
  }

  const strong = matched.filter((m) => m.match.verdict === 'strong').length;

  // Tin chắc chắn trước, rồi mới tới tin mới. Người dùng vào đây để tìm việc
  // đúng nghề, nên độ chắc chắn đáng lên trước độ tươi.
  matched.sort((a, b) => {
    if (a.match.verdict !== b.match.verdict) return a.match.verdict === 'strong' ? -1 : 1;
    return b.job.postedAt.getTime() - a.job.postedAt.getTime();
  });

  const freshBefore = new Date(Date.now() - FRESH_CHECK_HOURS * 60 * 60 * 1000);
  const freshlyChecked = matched.filter(
    ({ job }) => job.lastCheckedAt !== null && job.lastCheckedAt >= freshBefore,
  ).length;

  const total = matched.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(query.page ?? 1)), pageCount);

  return {
    slug: filter.slug,
    name: filter.name,
    keywordCount: filter.keywords.length,
    excludeCount: filter.excludes.length,
    provinces: filter.provinces,
    maxAgeDays: filter.maxAgeDays,

    items: matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total,
    strong,
    weak: total - strong,
    scanned: candidates.length,
    freshlyChecked,
    droppedByNarrowHcm,

    page,
    pageCount,
  };
}

/** Danh sách ngành đã định nghĩa, cho ô chọn ở đầu trang. */
export async function listFields(): Promise<{ slug: string; name: string }[]> {
  return db.savedFilter.findMany({
    select: { slug: true, name: true },
    orderBy: { slug: 'asc' },
  });
}
