import 'server-only';

import { Prisma } from '@prisma/client';
import { cache } from 'react';

import { db } from '@/api/db';
import { JobStatus } from '@/enums';

/**
 * Số liệu tổng hợp cho bảng điều khiển.
 *
 * Tách khỏi `job.api.ts` vì hai tệp trả lời hai câu khác nhau: `job.api` trả
 * lời "cho tôi xem những tin nào", còn tệp này trả lời "kho tin đang nói lên
 * điều gì". Trộn chung thì tệp phình ra và không ai biết sửa một truy vấn có
 * làm hỏng trang kia hay không.
 *
 * Cũng như phần web nói chung: **chỉ đọc**. Không có đường nào từ một lượt
 * truy cập của người dùng đi ra sàn nguồn.
 */

/** Chỉ tin còn sống mới vào thống kê — trang đầy tin chết còn tệ hơn không có trang. */
const ALIVE: string[] = [JobStatus.OPEN, JobStatus.STALE];

/**
 * Mọi phép gom theo NGÀY đều quy về múi giờ Việt Nam.
 *
 * Postgres lưu `timestamptz`, còn máy chạy web có thể đang ở UTC. Gom ngày
 * theo giờ máy chủ thì tin đăng lúc 6 giờ sáng ở Việt Nam rơi vào ngày hôm
 * trước — biểu đồ lệch đúng một cột mà nhìn bằng mắt không ra.
 */
const TZ = 'Asia/Ho_Chi_Minh';

/**
 * Mức lương ĐẠI DIỆN của một tin, dùng cho mọi phép tính phân vị.
 *
 * Quy ước, viết ra để ai đọc số cũng biết nó tính từ đâu:
 *   - có cả khoảng   -> lấy trung điểm
 *   - chỉ có một đầu -> lấy đầu đó
 *   - "Thoả thuận"   -> KHÔNG vào mẫu (đã lọc bằng `salaryIsPublic`)
 *
 * Tuyệt đối không quy "Thoả thuận" thành 0: một số 0 lọt vào là mọi trung vị
 * đều sai, và sai theo hướng không ai phát hiện được.
 */
const SALARY_VALUE = Prisma.sql`COALESCE(("salaryMin" + "salaryMax") / 2.0, "salaryMin"::numeric, "salaryMax"::numeric)`;

const aliveWhere = { status: { in: ALIVE } };

/* ─────────────────────────────────────────────────────────────────────────────
   TỔNG QUAN
   ───────────────────────────────────────────────────────────────────────────*/

export interface Overview {
  alive: number;
  byStatus: Record<string, number>;
  withSalary: number;
  companies: number;
  activeSources: number;
  /**
   * Sàn đang bật VÀ đang có ít nhất một tin còn sống. Chênh lệch với
   * `activeSources` là số sàn bật mà không trả về gì — thứ đáng lo nhất.
   */
  sourcesWithAlive: number;
  postedToday: number;
  /** Tin đăng trong 24 giờ trượt — khác `postedToday` (tính từ nửa đêm). */
  postedLast24h: number;
  postedLast7: number;
  /** Bảy ngày TRƯỚC đó — chỉ có so với kỳ liền trước thì con số mới có nghĩa. */
  postedPrev7: number;
  lastCrawledAt: Date | null;
}

/**
 * Bọc trong `cache()` của React — **bắt buộc**, không phải tối ưu vặt.
 *
 * Khung ngoài (`AppShell`) cần con số này cho dải trạng thái ở cột trái, và ba
 * trong bốn trang cũng cần nó cho phần thân. Không bọc thì mỗi lượt truy cập
 * chạy TRỌN BỘ chín truy vấn này đúng hai lần. `cache()` ghi nhớ trong phạm vi
 * MỘT request, nên lần gọi thứ hai lấy lại kết quả cũ — và vẫn là dữ liệu tươi
 * cho lượt truy cập kế tiếp, khác hẳn với việc nhớ theo thời gian.
 */
export const getOverview = cache(async (): Promise<Overview> => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    statusRows,
    alive,
    withSalary,
    companies,
    activeSources,
    aliveBySource,
    postedToday,
    postedLast24h,
    postedLast7,
    postedPrev7,
    newest,
  ] = await Promise.all([
    db.jobPosting.groupBy({ by: ['status'], _count: true }),
    db.jobPosting.count({ where: aliveWhere }),
    db.jobPosting.count({ where: { ...aliveWhere, salaryIsPublic: true } }),
    db.company.count(),
    db.source.count({ where: { isActive: true } }),
    db.jobPosting.groupBy({
      by: ['sourceId'],
      where: { ...aliveWhere, source: { isActive: true } },
      _count: true,
    }),
    db.jobPosting.count({ where: { postedAt: { gte: startOfToday } } }),
    db.jobPosting.count({ where: { ...aliveWhere, postedAt: { gte: new Date(now - day) } } }),
    db.jobPosting.count({ where: { postedAt: { gte: new Date(now - 7 * day) } } }),
    db.jobPosting.count({
      where: { postedAt: { gte: new Date(now - 14 * day), lt: new Date(now - 7 * day) } },
    }),
    db.jobPosting.findFirst({ orderBy: { crawledAt: 'desc' }, select: { crawledAt: true } }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of statusRows) byStatus[row.status] = row._count;

  return {
    alive,
    byStatus,
    withSalary,
    companies,
    activeSources,
    sourcesWithAlive: aliveBySource.length,
    postedToday,
    postedLast24h,
    postedLast7,
    postedPrev7,
    lastCrawledAt: newest?.crawledAt ?? null,
  };
});

/* ─────────────────────────────────────────────────────────────────────────────
   NHỊP TIN MỚI
   ───────────────────────────────────────────────────────────────────────────*/

export interface DayCount {
  day: string;
  count: number;
}

/**
 * Số tin ĐĂNG theo từng ngày, đã vá đủ những ngày không có tin thành 0.
 *
 * Vá bằng `generate_series` ngay trong SQL chứ không vá ở tầng JavaScript: cả
 * dãy ngày lẫn phép gom nhóm cùng sinh ra từ MỘT múi giờ, nên không có cách
 * nào lệch nhau. Vá bằng JavaScript là mở đúng cái cửa cho lỗi lệch một ngày.
 *
 * Ngày trống phải hiện thành cột 0 chứ không được bỏ qua — bỏ qua thì một tuần
 * crawler chết trông y hệt một tuần bình thường, chỉ hẹp hơn.
 */
export async function getDailyIntake(days = 30): Promise<DayCount[]> {
  const span = Math.max(1, Math.min(180, Math.trunc(days)));

  return db.$queryRaw<DayCount[]>`
    WITH scale AS (
      SELECT to_char(d, 'YYYY-MM-DD') AS day
      FROM generate_series(
        (NOW() AT TIME ZONE ${TZ})::date - (${span}::int - 1),
        (NOW() AT TIME ZONE ${TZ})::date,
        INTERVAL '1 day'
      ) AS d
    ),
    posted AS (
      SELECT
        to_char("postedAt" AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS count
      FROM "JobPosting"
      GROUP BY 1
    )
    SELECT scale.day, COALESCE(posted.count, 0)::int AS count
    FROM scale
    LEFT JOIN posted ON posted.day = scale.day
    ORDER BY scale.day
  `;
}

/* ─────────────────────────────────────────────────────────────────────────────
   LƯƠNG
   ───────────────────────────────────────────────────────────────────────────*/

/**
 * Cỡ mẫu tối thiểu để một nhóm được VẼ RA ở dạng khoảng.
 *
 * Với một tin duy nhất thì p25 = trung vị = p75 = chính tin đó — đó không phải
 * một phân bố, và vẽ nó lên là bịa ra một khoảng không tồn tại. Tệ hơn: một
 * tin lẻ 88 triệu ở Đà Nẵng kéo thang chung của cả biểu đồ lên gấp đôi, ép
 * mọi nhóm có thật xẹp lại thành những vạch không đọc được.
 *
 * Ba là ngưỡng thấp nhất còn nói được điều gì. Nhóm bị loại không biến mất
 * khỏi hệ thống — chúng vẫn nằm trong bảng số liệu và trong kho tin.
 */
export const MIN_BAND_SAMPLE = 3;

export interface SalaryBand {
  key: string;
  name: string;
  /** Số tin CÓ ghi lương đã đưa vào tính phân vị. */
  sample: number;
  p25: number;
  median: number;
  p75: number;
  /** Tổng số tin trong nhóm, KỂ CẢ tin ghi "Thoả thuận". */
  total: number;
}

/**
 * Phân vị lương theo cấp bậc.
 *
 * Tính thẳng bằng `percentile_cont` của Postgres chứ không đọc bảng
 * `SalaryStat`. Lý do: `SalaryStat` là bảng tổng hợp theo LÔ, do một tác vụ
 * định kỳ ghi vào — khi tác vụ đó chưa chạy lần nào thì trang sẽ trắng trơn mà
 * không nói được vì sao. Ở quy mô vài chục nghìn tin, tính thẳng vẫn nằm dưới
 * một nhịp mắt, và luôn khớp với thứ đang thật sự nằm trong kho.
 */
export async function getSalaryByLevel(): Promise<SalaryBand[]> {
  const [rows, totals] = await Promise.all([
    db.$queryRaw<{ key: string; sample: number; p25: number; median: number; p75: number }[]>`
      SELECT
        j."level" AS key,
        COUNT(*)::int AS sample,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY j.v)::int AS p25,
        percentile_cont(0.50) WITHIN GROUP (ORDER BY j.v)::int AS median,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY j.v)::int AS p75
      FROM (
        SELECT "level", ${SALARY_VALUE} AS v
        FROM "JobPosting"
        WHERE "salaryIsPublic" = true
          AND "status" = ANY(${ALIVE})
          AND "level" IS NOT NULL
      ) AS j
      WHERE j.v IS NOT NULL
      GROUP BY j."level"
      HAVING COUNT(*) >= ${MIN_BAND_SAMPLE}
    `,
    db.jobPosting.groupBy({
      by: ['level'],
      where: { ...aliveWhere, level: { not: null } },
      _count: true,
    }),
  ]);

  const totalByLevel = new Map(totals.map((row) => [row.level, row._count]));

  return rows.map((row) => ({
    ...row,
    name: row.key,
    total: totalByLevel.get(row.key) ?? row.sample,
  }));
}

/**
 * Phân vị lương của TOÀN KHO — con số mở đầu trang lương.
 *
 * Trả `null` khi chưa có tin nào ghi lương, chứ không trả 0. "Trung vị 0 đồng"
 * là một khẳng định sai; "chưa đủ dữ liệu" mới là sự thật.
 */
export async function getSalaryOverall(): Promise<Omit<SalaryBand, 'key' | 'name'> | null> {
  const rows = await db.$queryRaw<
    { sample: number; p25: number; median: number; p75: number }[]
  >`
    SELECT
      COUNT(*)::int AS sample,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY j.v)::int AS p25,
      percentile_cont(0.50) WITHIN GROUP (ORDER BY j.v)::int AS median,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY j.v)::int AS p75
    FROM (
      SELECT ${SALARY_VALUE} AS v
      FROM "JobPosting"
      WHERE "salaryIsPublic" = true AND "status" = ANY(${ALIVE})
    ) AS j
    WHERE j.v IS NOT NULL
  `;

  const row = rows[0];
  if (!row || row.sample === 0) return null;

  const total = await db.jobPosting.count({ where: aliveWhere });
  return { ...row, total };
}


/** Phân vị lương theo tỉnh/thành, xếp theo nơi nhiều tin nhất. */
export async function getSalaryByProvince(limit = 8): Promise<SalaryBand[]> {
  const take = Math.max(1, Math.min(34, Math.trunc(limit)));

  return db.$queryRaw<SalaryBand[]>`
    SELECT
      l."slug" AS key,
      l."name" AS name,
      COUNT(*) FILTER (WHERE p."salaryIsPublic")::int AS sample,
      COUNT(*)::int AS total,
      percentile_cont(0.25) WITHIN GROUP (
        ORDER BY CASE WHEN p."salaryIsPublic" THEN ${SALARY_VALUE} END
      )::int AS p25,
      percentile_cont(0.50) WITHIN GROUP (
        ORDER BY CASE WHEN p."salaryIsPublic" THEN ${SALARY_VALUE} END
      )::int AS median,
      percentile_cont(0.75) WITHIN GROUP (
        ORDER BY CASE WHEN p."salaryIsPublic" THEN ${SALARY_VALUE} END
      )::int AS p75
    FROM "JobPosting" p
    JOIN "JobLocation" jl ON jl."postingId" = p."id"
    JOIN "Location" l ON l."id" = jl."locationId"
    WHERE p."status" = ANY(${ALIVE})
    GROUP BY l."slug", l."name"
    HAVING COUNT(*) FILTER (WHERE p."salaryIsPublic") >= ${MIN_BAND_SAMPLE}
    ORDER BY COUNT(*) DESC
    LIMIT ${take}
  `;
}

export interface SalaryBucket {
  floor: number;
  count: number;
}

/**
 * Phân bố lương theo bậc 5 triệu.
 *
 * Bậc cuối gộp thành "từ 60 triệu trở lên": đuôi trên của lương rất dài và rất
 * thưa — để nguyên thì hai chục cột cuối đều cao một pixel, đọc không ra gì.
 */
export async function getSalaryHistogram(
  bucketSize = 5_000_000,
  cap = 60_000_000,
): Promise<SalaryBucket[]> {
  const rows = await db.$queryRaw<{ floor: number; count: number }[]>`
    SELECT
      LEAST(
        FLOOR(j.v / ${bucketSize}::numeric) * ${bucketSize}::numeric,
        ${cap}::numeric
      )::int AS floor,
      COUNT(*)::int AS count
    FROM (
      SELECT ${SALARY_VALUE} AS v
      FROM "JobPosting"
      WHERE "salaryIsPublic" = true AND "status" = ANY(${ALIVE})
    ) AS j
    WHERE j.v IS NOT NULL AND j.v > 0
    GROUP BY 1
    ORDER BY 1
  `;

  // Vá bậc rỗng ở giữa: một khoảng trống trong phân bố là một PHÁT HIỆN, nhưng
  // chỉ khi nó hiện ra thành cột 0 chứ không phải biến mất khỏi trục.
  const found = new Map(rows.map((row) => [row.floor, row.count]));
  const buckets: SalaryBucket[] = [];
  for (let floor = 0; floor <= cap; floor += bucketSize) {
    buckets.push({ floor, count: found.get(floor) ?? 0 });
  }
  return buckets;
}

/* ─────────────────────────────────────────────────────────────────────────────
   XẾP HẠNG
   ───────────────────────────────────────────────────────────────────────────*/

export interface RankRow {
  key: string;
  name: string;
  count: number;
  /** Trong số đó bao nhiêu tin dám ghi số lương. */
  withSalary: number;
}

/** Tỉnh/thành nhiều tin nhất, kèm tỷ lệ dám ghi lương của từng nơi. */
export async function getTopProvinces(limit = 8): Promise<RankRow[]> {
  const take = Math.max(1, Math.min(34, Math.trunc(limit)));

  return db.$queryRaw<RankRow[]>`
    SELECT
      l."slug" AS key,
      l."name" AS name,
      COUNT(*)::int AS count,
      COUNT(*) FILTER (WHERE p."salaryIsPublic")::int AS "withSalary"
    FROM "JobPosting" p
    JOIN "JobLocation" jl ON jl."postingId" = p."id"
    JOIN "Location" l ON l."id" = jl."locationId"
    WHERE p."status" = ANY(${ALIVE})
    GROUP BY l."slug", l."name"
    ORDER BY COUNT(*) DESC
    LIMIT ${take}
  `;
}

/** Công ty đăng nhiều tin nhất. Đăng dày bất thường tự nó cũng là một tín hiệu. */
export async function getTopCompanies(limit = 8): Promise<RankRow[]> {
  const take = Math.max(1, Math.min(50, Math.trunc(limit)));

  return db.$queryRaw<RankRow[]>`
    SELECT
      c."slug" AS key,
      c."name" AS name,
      COUNT(*)::int AS count,
      COUNT(*) FILTER (WHERE p."salaryIsPublic")::int AS "withSalary"
    FROM "JobPosting" p
    JOIN "Company" c ON c."id" = p."companyId"
    WHERE p."status" = ANY(${ALIVE})
    GROUP BY c."slug", c."name"
    ORDER BY COUNT(*) DESC
    LIMIT ${take}
  `;
}

/** Cấp bậc — để đối chiếu với biểu đồ lương theo cấp bậc đứng cạnh nó. */
export async function getLevelSpread(): Promise<RankRow[]> {
  return db.$queryRaw<RankRow[]>`
    SELECT
      COALESCE("level", 'UNKNOWN') AS key,
      COALESCE("level", 'UNKNOWN') AS name,
      COUNT(*)::int AS count,
      COUNT(*) FILTER (WHERE "salaryIsPublic")::int AS "withSalary"
    FROM "JobPosting"
    WHERE "status" = ANY(${ALIVE})
    GROUP BY 1
    ORDER BY COUNT(*) DESC
  `;
}
