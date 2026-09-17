import 'server-only';

import { getDb } from '@/api/workspace-db';
import type { WorkspaceId } from '@/constants/workspace';
import { JobStatus } from '@/enums';

/**
 * Sức khoẻ của cỗ máy thu thập.
 *
 * Đây là phần mà một trang việc làm thường không có, nhưng một **công cụ cá
 * nhân thì bắt buộc phải có**: kho tin chỉ đáng tin bằng đúng lần chạy gần
 * nhất của crawler. Không nhìn được crawler thì con số "185 tin còn hiệu lực"
 * ở trang chủ là một lời khẳng định không có gì bảo chứng — nó có thể là 185
 * tin của hôm nay, cũng có thể là 185 tin của ba tuần trước và crawler đã chết
 * âm thầm từ lâu.
 *
 * Bảng `CrawlRun` / `CrawlRunSource` sinh ra đúng để trả lời câu đó
 * (schema.prisma § VẬN HÀNH). Trang `/nguon` chỉ là cái cửa sổ nhìn vào chúng.
 */

const ALIVE: string[] = [JobStatus.OPEN, JobStatus.STALE];

export interface SourceHealth {
  id: number;
  code: string;
  name: string;
  homeUrl: string;
  kind: string;
  isActive: boolean;
  priority: number;
  /** Ghi chú khảo sát lưu trong `config.note` — bằng chứng cho mọi lựa chọn. */
  note: string | null;
  alive: number;
  total: number;
  withSalary: number;
  failed: number;
  /** Lần cuối còn thấy tin của nguồn này trong danh mục của họ. */
  lastSeenAt: Date | null;
}

/**
 * Một dòng cho mỗi nguồn, kể cả nguồn **chưa có tin nào**.
 *
 * Cố ý đi từ bảng `Source` rồi mới đếm sang `JobPosting`, chứ không gom nhóm
 * trên `JobPosting`. Gom nhóm trên tin đăng thì nguồn hỏng — nguồn đáng lo
 * nhất — sẽ biến mất khỏi danh sách, đúng lúc cần nhìn thấy nó nhất.
 */
export async function getSourceHealth(ws: WorkspaceId): Promise<SourceHealth[]> {
  const db = getDb(ws);
  const sources = await db.source.findMany({ orderBy: [{ isActive: 'desc' }, { priority: 'asc' }] });

  return Promise.all(
    sources.map(async (source) => {
      const [alive, total, withSalary, failed, newest] = await Promise.all([
        db.jobPosting.count({ where: { sourceId: source.id, status: { in: ALIVE } } }),
        db.jobPosting.count({ where: { sourceId: source.id } }),
        db.jobPosting.count({
          where: { sourceId: source.id, status: { in: ALIVE }, salaryIsPublic: true },
        }),
        db.jobPosting.count({ where: { sourceId: source.id, parseStatus: 'FAILED' } }),
        db.jobPosting.findFirst({
          where: { sourceId: source.id },
          orderBy: { lastSeenAt: 'desc' },
          select: { lastSeenAt: true },
        }),
      ]);

      const config = source.config as { note?: string } | null;

      return {
        id: source.id,
        code: source.code,
        name: source.name,
        homeUrl: source.homeUrl,
        kind: source.kind,
        isActive: source.isActive,
        priority: source.priority,
        note: config?.note ?? null,
        alive,
        total,
        withSalary,
        failed,
        lastSeenAt: newest?.lastSeenAt ?? null,
      };
    }),
  );
}

/**
 * Tên các sàn đang bật — đủ cho những chỗ chỉ cần biết "có những sàn nào",
 * không cần năm truy vấn đếm mỗi sàn như `getSourceHealth`.
 */
export async function getActiveSources(ws: WorkspaceId): Promise<{ code: string; name: string }[]> {
  const db = getDb(ws);
  return db.source.findMany({
    where: { isActive: true },
    orderBy: { priority: 'asc' },
    select: { code: true, name: true },
  });
}

export type RunWithSources = Awaited<ReturnType<typeof getRecentRuns>>[number];

/** Nhật ký các lần chạy gần nhất, kèm kết quả tách theo từng nguồn. */
export async function getRecentRuns(ws: WorkspaceId, limit = 10) {
  const db = getDb(ws);
  return db.crawlRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: Math.max(1, Math.min(50, Math.trunc(limit))),
    include: {
      sources: {
        include: { source: { select: { code: true, name: true } } },
        orderBy: { id: 'asc' },
      },
    },
  });
}

export interface ParseHealth {
  ok: number;
  partial: number;
  failed: number;
}

/**
 * Bộ giải mã đang âm thầm hỏng ở đâu.
 *
 * `PARTIAL` nghĩa là lấy được tin nhưng thiếu trường quan trọng — thường là
 * lương. Tỷ lệ này trôi lên là dấu hiệu một sàn vừa đổi bố cục, và đó là thứ
 * cần biết TRƯỚC khi các biểu đồ lương bắt đầu nói sai.
 */
export async function getParseHealth(ws: WorkspaceId): Promise<ParseHealth> {
  const db = getDb(ws);
  const rows = await db.jobPosting.groupBy({ by: ['parseStatus'], _count: true });
  const byStatus = new Map(rows.map((row) => [row.parseStatus, row._count]));
  return {
    ok: byStatus.get('OK') ?? 0,
    partial: byStatus.get('PARTIAL') ?? 0,
    failed: byStatus.get('FAILED') ?? 0,
  };
}

/**
 * Có bao nhiêu tin còn giữ được blob thô để `npm run reparse` tính lại.
 *
 * Đây là siêu năng lực quan trọng nhất của dự án (schema.prisma § rawKey): sửa
 * một lỗi trong parser rồi tính lại toàn bộ lịch sử mà không phải cào lại
 * nguồn. Tỷ lệ này tụt xuống là mất khả năng đó, và mất trong im lặng.
 */
export async function getReparseCoverage(ws: WorkspaceId): Promise<{ withBlob: number; total: number }> {
  const db = getDb(ws);
  const [withBlob, total] = await Promise.all([
    db.jobPosting.count({ where: { rawKey: { not: null } } }),
    db.jobPosting.count(),
  ]);
  return { withBlob, total };
}
