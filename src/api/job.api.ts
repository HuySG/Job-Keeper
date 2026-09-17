import 'server-only';

import type { Prisma } from '@prisma/client';

import { getDb } from '@/api/workspace-db';
import type { WorkspaceId } from '@/constants/workspace';
import { toMatchKey } from '@/crawler/normalize/text';
import { JobStatus } from '@/enums';
import { readFlag, readNumber, readParam, type SearchParams } from '@/lib/query';

/**
 * Truy vấn tin cho phần web. Web **chỉ đọc** — mọi thứ ghi vào CSDL đều đi qua
 * crawler. Không có đường nào từ lượt truy cập của người dùng đi ra sàn nguồn,
 * nên trang vẫn chạy bình thường kể cả khi cả bốn nguồn cùng sập.
 */

export const PAGE_SIZE = 20;

/** Tin còn sống. Dùng chung với `stats.api.ts` — hai chỗ phải cùng một định nghĩa. */
const ALIVE: string[] = [JobStatus.OPEN, JobStatus.STALE];

export interface JobFilters {
  q?: string;
  province?: string;
  level?: string;
  source?: string;
  /** VND/tháng */
  salaryMin?: number;
  /** true = chỉ tin có ghi lương thật */
  salaryOnly?: boolean;
  /** Chỉ tin đăng trong N ngày gần đây */
  days?: number;
  /** true = hiện cả tin đã hết hạn/đã gỡ */
  includeDead?: boolean;
  sort?: SortKey;
  page?: number;
}

export type SortKey = 'moi' | 'luong' | 'han';

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'moi', label: 'Mới nhất' },
  { value: 'luong', label: 'Lương cao' },
  { value: 'han', label: 'Sắp hết hạn' },
];

const SORT_KEYS = new Set<string>(SORT_OPTIONS.map((option) => option.value));

/**
 * URL -> bộ lọc. **Chỗ duy nhất** biết tên tham số trên thanh địa chỉ.
 *
 * Bản trước đọc tay từng tham số ngay trong `page.tsx`, kể cả `Number(...)` cho
 * `salaryMin` và `page`. Hệ quả: `?page=abc` biến thành `NaN`, chui thẳng vào
 * `skip: NaN` của Prisma và làm cả trang đổ vỡ. Ở đây mọi thứ đi qua
 * `readNumber`, thứ gì không phải số thì rơi về mặc định.
 */
export function parseJobFilters(params: SearchParams): JobFilters {
  const sort = readParam(params, 'sort');

  return {
    q: readParam(params, 'q'),
    province: readParam(params, 'province'),
    level: readParam(params, 'level'),
    source: readParam(params, 'source'),
    salaryMin: readNumber(params, 'salaryMin'),
    salaryOnly: readFlag(params, 'salaryOnly'),
    days: readNumber(params, 'days'),
    includeDead: readFlag(params, 'includeDead'),
    sort: sort && SORT_KEYS.has(sort) ? (sort as SortKey) : 'moi',
    page: readNumber(params, 'page'),
  };
}

function buildOrderBy(sort: SortKey = 'moi'): Prisma.JobPostingOrderByWithRelationInput[] {
  switch (sort) {
    case 'luong':
      // `nulls: 'last'` là bắt buộc: tin "Thoả thuận" có salaryMax = null, và
      // mặc định của Postgres đẩy NULL lên ĐẦU khi sắp giảm dần — tức là sắp
      // theo "lương cao trước" lại ra toàn tin không ghi lương.
      return [{ salaryMax: { sort: 'desc', nulls: 'last' } }, { postedAt: 'desc' }];
    case 'han':
      return [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { postedAt: 'desc' }];
    case 'moi':
    default:
      return [{ postedAt: 'desc' }];
  }
}

function buildWhere(filters: JobFilters): Prisma.JobPostingWhereInput {
  const where: Prisma.JobPostingWhereInput = {};
  const and: Prisma.JobPostingWhereInput[] = [];

  if (!filters.includeDead) {
    // Mặc định chỉ tin còn sống. Đây là điểm khác biệt so với việc tự tìm trên
    // các sàn — ở đó tin hết hạn vẫn nằm đầy trong kết quả.
    where.status = { in: ALIVE };
  }

  if (filters.q?.trim()) {
    const raw = filters.q.trim();
    // Tìm trên CẢ hai: `title` giữ nguyên dấu, `titleNorm` đã bỏ dấu.
    // Nhờ vậy gõ "ke toan" vẫn ra "Kế Toán" mà không cần extension unaccent.
    and.push({
      OR: [
        { title: { contains: raw, mode: 'insensitive' } },
        { titleNorm: { contains: toMatchKey(raw) } },
        { descriptionText: { contains: raw, mode: 'insensitive' } },
        { company: { name: { contains: raw, mode: 'insensitive' } } },
      ],
    });
  }

  if (filters.province) {
    and.push({ locations: { some: { location: { slug: filters.province } } } });
  }
  if (filters.level) and.push({ level: filters.level });
  if (filters.source) and.push({ source: { code: filters.source } });

  if (filters.salaryOnly) and.push({ salaryIsPublic: true });

  if (filters.salaryMin) {
    // Tin "Tới 30tr" có salaryMin = null nhưng salaryMax = 30tr — vẫn phải lọt
    // qua bộ lọc "từ 20tr", nếu không là mất một mảng tin hợp lệ.
    and.push({
      OR: [{ salaryMin: { gte: filters.salaryMin } }, { salaryMax: { gte: filters.salaryMin } }],
    });
  }

  if (filters.days) {
    const since = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000);
    and.push({ postedAt: { gte: since } });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

/** Quan hệ cần kèm theo cho mỗi thẻ tin. Khai một chỗ để mọi nơi lấy đúng một hình dạng. */
export const LIST_INCLUDE = {
  company: { select: { name: true, logoUrl: true } },
  source: { select: { code: true, name: true } },
  locations: { include: { location: { select: { name: true, slug: true } } } },
} satisfies Prisma.JobPostingInclude;

export type JobListItem = Prisma.JobPostingGetPayload<{ include: typeof LIST_INCLUDE }>;

export interface JobPage {
  items: JobListItem[];
  total: number;
  page: number;
  pageCount: number;
}

export async function findJobs(ws: WorkspaceId, filters: JobFilters): Promise<JobPage> {
  const db = getDb(ws);
  const where = buildWhere(filters);
  const requested = Math.max(1, Math.trunc(filters.page ?? 1));

  const total = await db.jobPosting.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Chặn trang vượt quá cuối danh sách. `?page=999` mà không chặn thì ra một
  // trang rỗng không nói được vì sao — trông y hệt "bộ lọc không khớp gì".
  const page = Math.min(requested, pageCount);

  const items = await db.jobPosting.findMany({
    where,
    orderBy: buildOrderBy(filters.sort),
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: LIST_INCLUDE,
  });

  return { items, total, page, pageCount };
}

/** Tin mới nhất cho trang tổng quan. Luôn là tin còn sống. */
export async function getRecentJobs(ws: WorkspaceId, limit = 6): Promise<JobListItem[]> {
  const db = getDb(ws);
  return db.jobPosting.findMany({
    where: { status: { in: ALIVE } },
    orderBy: { postedAt: 'desc' },
    take: Math.max(1, Math.min(20, Math.trunc(limit))),
    include: LIST_INCLUDE,
  });
}

const DETAIL_INCLUDE = {
  company: true,
  source: true,
  locations: { include: { location: true } },
} satisfies Prisma.JobPostingInclude;

export type JobDetail = Prisma.JobPostingGetPayload<{ include: typeof DETAIL_INCLUDE }>;

export async function getJob(ws: WorkspaceId, id: number): Promise<JobDetail | null> {
  const db = getDb(ws);
  if (!Number.isInteger(id) || id <= 0) return null;
  return db.jobPosting.findUnique({ where: { id }, include: DETAIL_INCLUDE });
}

export interface FilterOptions {
  provinces: { id: number; name: string; slug: string; count: number }[];
  levels: { value: string; count: number }[];
  sources: { code: string; name: string }[];
  total: number;
  withSalary: number;
}

/** Dữ liệu cho các ô lọc. Chỉ đếm trên tin còn sống để không hiện lựa chọn rỗng. */
export async function getFilterOptions(ws: WorkspaceId): Promise<FilterOptions> {
  const db = getDb(ws);
  const alive = { status: { in: ALIVE } };

  const [provinces, levels, sources, total, withSalary] = await Promise.all([
    db.jobLocation.groupBy({
      by: ['locationId'],
      // Lọc theo trạng thái của TIN, không chỉ gom nhóm suông. Thiếu điều kiện
      // này thì ô lọc ghi "Hà Nội (80)" trong khi danh sách chỉ ra 71 tin —
      // con số trong ngoặc đếm cả tin đã hết hạn.
      where: { posting: alive },
      _count: true,
      orderBy: { _count: { locationId: 'desc' } },
      take: 20,
    }),
    db.jobPosting.groupBy({
      by: ['level'],
      where: alive,
      _count: true,
      orderBy: { _count: { level: 'desc' } },
    }),
    db.source.findMany({ where: { isActive: true }, select: { code: true, name: true } }),
    db.jobPosting.count({ where: alive }),
    db.jobPosting.count({ where: { ...alive, salaryIsPublic: true } }),
  ]);

  const locationRows = await db.location.findMany({
    where: { id: { in: provinces.map((p) => p.locationId) } },
    select: { id: true, name: true, slug: true },
  });
  const byId = new Map(locationRows.map((row) => [row.id, row]));

  return {
    provinces: provinces.flatMap((row) => {
      const location = byId.get(row.locationId);
      return location ? [{ ...location, count: row._count }] : [];
    }),
    levels: levels.flatMap((row) => (row.level ? [{ value: row.level, count: row._count }] : [])),
    sources,
    total,
    withSalary,
  };
}
