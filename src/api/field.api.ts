import 'server-only';

import { db } from '@/api/db';
import { LIST_INCLUDE, PAGE_SIZE, type JobListItem } from '@/api/job.api';
import { JobStatus, SaturdayWork } from '@/enums';
import { compileField, isNarrowHcm, matchJob, type MatchResult } from '@/lib/field-match';
import { classifyPurchase, type PurchaseTypeResult } from '@/lib/purchase-type';

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
 * Hệ quả phải nói rõ: **phân trang và đếm facet làm trong bộ nhớ**. Ta lấy toàn
 * bộ tin còn sống trong phạm vi tỉnh của ngành (hiện ~800) rồi mới chấm, đếm và
 * cắt trang. Đây là đánh đổi có ý thức, không phải sơ suất — nó đổi lấy việc từ
 * điển và cách chia loại sửa được bằng một câu UPDATE hoặc một dòng hằng số,
 * không phải một lần migrate. Khi phạm vi vượt vài nghìn tin thì phải chuyển
 * sang cột tsvector + index GIN; con số cần theo dõi là `FieldPage.scanned`.
 */

/** Tin còn sống — cùng định nghĩa với `job.api.ts`, cố ý lặp lại để đọc là thấy. */
const ALIVE: string[] = [JobStatus.OPEN, JobStatus.STALE];

/** Coi là "vừa kiểm" nếu đã gọi HTTP/API vào tin trong ngần này giờ. */
export const FRESH_CHECK_HOURS = 48;

export interface FieldMatchedJob {
  job: JobListItem;
  match: MatchResult;
  purchase: PurchaseTypeResult;
}

/** Một dòng trong bảng đếm: giá trị, nhãn, số tin. */
export interface Facet {
  value: string;
  label: string;
  count: number;
  hint?: string;
}

export interface FieldPage {
  slug: string;
  name: string;
  keywordCount: number;
  excludeCount: number;
  provinces: string[];
  maxAgeDays: number | null;

  items: FieldMatchedJob[];
  total: number;
  strong: number;
  weak: number;
  /** Số tin đã chấm để ra được từng ấy — mẫu số của mọi tỷ lệ trên trang. */
  scanned: number;
  freshlyChecked: number;
  droppedByNarrowHcm: number;

  /**
   * Đếm theo từng chiều, tính TRƯỚC khi áp bộ lọc của chiều đó (nếu không thì
   * chọn một giá trị xong mọi giá trị khác hiện số 0 và không quay lại được).
   */
  facets: {
    purchaseTypes: Facet[];
    districts: Facet[];
    saturday: Facet[];
    experience: Facet[];
  };
  /** Bao nhiêu tin thuộc ngành có dữ liệu cho từng chiều — để nói thật về độ phủ. */
  coverage: {
    district: number;
    saturday: number;
    experience: number;
    salary: number;
  };

  page: number;
  pageCount: number;
}

export interface FieldQuery {
  page?: number;
  /** false = chỉ hiện tin "nhận chắc" (từ nhận nằm ở TIÊU ĐỀ). */
  includeWeak?: boolean;
  /** true = bỏ tin ở Bình Dương / Bà Rịa – Vũng Tàu (phần sáp nhập 2025). */
  strictHcm?: boolean;

  /** Slug loại mua hàng — xem `constants/purchase`. */
  purchaseType?: string;
  district?: string;
  /** Chỉ lấy tin đòi TỐI ĐA ngần này năm kinh nghiệm. */
  maxYears?: number;
  /** Chỉ lấy tin KHÔNG phải làm thứ Bảy (NONE), hoặc một giá trị cụ thể. */
  saturday?: string;
  /** VND/tháng. */
  salaryMin?: number;
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
      ...(filter.levels.length ? { level: { in: filter.levels } } : {}),
    },
    orderBy: { postedAt: 'desc' },
    include: LIST_INCLUDE,
  });

  const field = compileField({ keywords: filter.keywords, excludes: filter.excludes });

  // ── Bước 1: vào ngành hay không ────────────────────────────────────────────
  const inField: FieldMatchedJob[] = [];
  let droppedByNarrowHcm = 0;

  for (const job of candidates) {
    if (query.strictHcm && !isNarrowHcm(job.locations.map((l) => l.rawText))) {
      droppedByNarrowHcm += 1;
      continue;
    }
    const match = matchJob(field, { title: job.title, description: job.descriptionText });
    if (match.verdict === 'reject') continue;
    if (match.verdict === 'weak' && !query.includeWeak) continue;
    inField.push({ job, match, purchase: classifyPurchase(job) });
  }

  // ── Bước 2: đếm facet ──────────────────────────────────────────────────────
  //
  // Mỗi chiều được đếm trên tập đã áp MỌI bộ lọc KHÁC, trừ chính nó. Đếm trên
  // tập đã lọc hết thì vừa chọn "Sản xuất" xong là mọi loại khác hiện 0 và
  // người dùng không còn đường quay lại — lỗi kinh điển của giao diện lọc.
  const facets = {
    purchaseTypes: countBy(
      inField.filter((r) => keep(r, query, 'purchaseType')),
      (r) => [r.purchase.slug, r.purchase.label, r.purchase.hint],
    ),
    districts: countBy(
      inField.filter((r) => keep(r, query, 'district')),
      (r) => (r.job.district ? [r.job.district, r.job.district] : null),
    ),
    saturday: countBy(
      inField.filter((r) => keep(r, query, 'saturday')),
      (r) => (r.job.saturdayWork ? [r.job.saturdayWork, SATURDAY_LABELS[r.job.saturdayWork] ?? r.job.saturdayWork] : null),
    ),
    experience: countExperience(inField.filter((r) => keep(r, query, 'maxYears'))),
  };

  const coverage = {
    district: inField.filter((r) => r.job.district !== null).length,
    saturday: inField.filter((r) => r.job.saturdayWork !== null).length,
    experience: inField.filter((r) => r.job.yearsExpMin !== null || r.job.yearsExpMax !== null).length,
    salary: inField.filter((r) => r.job.salaryIsPublic).length,
  };

  // ── Bước 3: áp bộ lọc rồi mới cắt trang ────────────────────────────────────
  const matched = inField.filter((r) => keep(r, query, null));
  const strong = matched.filter((m) => m.match.verdict === 'strong').length;

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
    facets,
    coverage,

    page,
    pageCount,
  };
}

/**
 * Tin có lọt qua bộ lọc không.
 *
 * `except` cho phép bỏ qua đúng một chiều — dùng khi đếm facet của chính chiều
 * đó, để các lựa chọn còn lại vẫn hiện số thật thay vì 0.
 */
function keep(
  row: FieldMatchedJob,
  query: FieldQuery,
  except: 'purchaseType' | 'district' | 'saturday' | 'maxYears' | null,
): boolean {
  const { job } = row;

  if (except !== 'purchaseType' && query.purchaseType && row.purchase.slug !== query.purchaseType) {
    return false;
  }
  if (except !== 'district' && query.district && job.district !== query.district) return false;
  if (except !== 'saturday' && query.saturday && job.saturdayWork !== query.saturday) return false;

  if (except !== 'maxYears' && query.maxYears !== undefined) {
    // Tin không ghi kinh nghiệm thì GIỮ LẠI. Loại chúng đi là vứt 7% số tin vì
    // một điều mà nhà tuyển dụng chỉ đơn giản là không viết ra.
    const required = job.yearsExpMin;
    if (required !== null && required > query.maxYears) return false;
  }

  if (query.salaryMin) {
    // "Tới 30tr" có salaryMin null nhưng salaryMax 30tr — vẫn phải lọt bộ lọc
    // "từ 20tr". Tin thoả thuận thì giữ, vì loại chúng là bỏ 75% số tin.
    if (job.salaryIsPublic) {
      const best = Math.max(job.salaryMin ?? 0, job.salaryMax ?? 0);
      if (best < query.salaryMin) return false;
    }
  }

  return true;
}

const SATURDAY_LABELS: Record<string, string> = {
  [SaturdayWork.NONE]: 'Nghỉ thứ 7',
  [SaturdayWork.HALF_DAY]: 'Sáng thứ 7',
  [SaturdayWork.ALTERNATE]: 'Thứ 7 luân phiên',
  [SaturdayWork.FULL]: 'Làm cả thứ 7',
};

/** Các mốc kinh nghiệm. Cắt theo cách người đi làm tự mô tả mình. */
const EXPERIENCE_STEPS: readonly { value: number; label: string }[] = [
  { value: 0, label: 'Không đòi kinh nghiệm' },
  { value: 1, label: 'Tối đa 1 năm' },
  { value: 3, label: 'Tối đa 3 năm' },
  { value: 5, label: 'Tối đa 5 năm' },
];

function countExperience(rows: FieldMatchedJob[]): Facet[] {
  return EXPERIENCE_STEPS.map((step) => ({
    value: String(step.value),
    label: step.label,
    count: rows.filter((r) => {
      const required = r.job.yearsExpMin;
      return required === null || required <= step.value;
    }).length,
  })).filter((facet) => facet.count > 0);
}

function countBy(
  rows: FieldMatchedJob[],
  pick: (row: FieldMatchedJob) => readonly [string, string, string?] | null,
): Facet[] {
  const map = new Map<string, Facet>();
  for (const row of rows) {
    const picked = pick(row);
    if (!picked) continue;
    const [value, label, hint] = picked;
    const existing = map.get(value);
    if (existing) existing.count += 1;
    else map.set(value, { value, label, count: 1, ...(hint ? { hint } : {}) });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** Danh sách ngành đã định nghĩa, cho ô chọn ở đầu trang. */
export async function listFields(): Promise<{ slug: string; name: string }[]> {
  return db.savedFilter.findMany({
    select: { slug: true, name: true },
    orderBy: { slug: 'asc' },
  });
}
