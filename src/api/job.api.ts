import 'server-only';

import type { Prisma } from '@prisma/client';

import { db } from '@/api/db';
import { toMatchKey } from '@/crawler/normalize/text';
import { JobStatus } from '@/enums';

/**
 * Truy vấn tin cho phần web. Web **chỉ đọc** — mọi thứ ghi vào DB đều đi qua
 * crawler. Không có đường nào từ lượt truy cập của người dùng đi ra sàn nguồn,
 * nên trang vẫn chạy bình thường kể cả khi cả bốn nguồn cùng sập.
 */

export const PAGE_SIZE = 20;

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
  /** true = hiện cả tin đã hết hạn/đóng */
  includeDead?: boolean;
  sort?: SortKey;
  page?: number;
}

export type SortKey = 'moi' | 'luong' | 'han';

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'moi', label: 'Mới đăng trước' },
  { value: 'luong', label: 'Lương cao trước' },
  { value: 'han', label: 'Sắp hết hạn trước' },
];

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
    where.status = { in: [JobStatus.OPEN, JobStatus.STALE] };
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

export async function findJobs(filters: JobFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const where = buildWhere(filters);

  const [items, total] = await Promise.all([
    db.jobPosting.findMany({
      where,
      orderBy: buildOrderBy(filters.sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        company: { select: { name: true, logoUrl: true } },
        source: { select: { code: true, name: true } },
        locations: { include: { location: { select: { name: true, slug: true } } } },
      },
    }),
    db.jobPosting.count({ where }),
  ]);

  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getJob(id: number) {
  return db.jobPosting.findUnique({
    where: { id },
    include: {
      company: true,
      source: true,
      locations: { include: { location: true } },
    },
  });
}

/** Dữ liệu cho các ô lọc. Chỉ đếm trên tin còn sống để không hiện lựa chọn rỗng. */
export async function getFilterOptions() {
  const alive = { status: { in: [JobStatus.OPEN, JobStatus.STALE] } };

  const [provinces, levels, sources, total, withSalary] = await Promise.all([
    db.jobLocation.groupBy({
      by: ['locationId'],
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

  return {
    provinces: provinces
      .map((p) => {
        const location = locationRows.find((l) => l.id === p.locationId);
        return location ? { ...location, count: p._count } : null;
      })
      .filter((p): p is { id: number; name: string; slug: string; count: number } => p !== null),
    levels: levels
      .filter((l) => l.level !== null)
      .map((l) => ({ value: l.level!, count: l._count })),
    sources,
    total,
    withSalary,
  };
}

/**
 * Số liệu cho header — trả lời đúng một câu: **"dữ liệu này có đáng tin không"**.
 *
 * Đếm tin CÒN HIỆU LỰC chứ không đếm tổng số dòng trong bảng: khoe "5.000 tin"
 * trong khi một nửa đã hết hạn là tự nói dối mình.
 */
export async function getFreshness() {
  const [totalAlive, sourceCount, newest] = await Promise.all([
    db.jobPosting.count({ where: { status: { in: [JobStatus.OPEN, JobStatus.STALE] } } }),
    db.source.count({ where: { isActive: true } }),
    db.jobPosting.findFirst({ orderBy: { crawledAt: 'desc' }, select: { crawledAt: true } }),
  ]);
  return { totalAlive, sourceCount, lastCrawledAt: newest?.crawledAt ?? null };
}
