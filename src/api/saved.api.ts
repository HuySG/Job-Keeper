import 'server-only';

import { Prisma } from '@prisma/client';
import { cache } from 'react';

import { LIST_INCLUDE, type JobListItem } from '@/api/job.api';
import { getDb } from '@/api/workspace-db';
import { SAVED_JOB_LIMIT } from '@/constants/saved';
import type { WorkspaceId } from '@/constants/workspace';
import { getEditAccess } from '@/lib/edit-access';

/**
 * Đọc "Tin đã lưu".
 *
 * Phần GHI nằm ở `actions/saved.ts`, sau cổng `assertCanEdit`. Tách đọc khỏi
 * ghi theo đúng ranh giới cũ của dự án: mọi thứ trong `api/` chỉ đọc.
 */

export interface SavedState {
  /** Mã tin đã lưu — để mọi danh sách tô được nút "đã lưu" mà không hỏi lại CSDL. */
  ids: ReadonlySet<number>;
  count: number;
  /**
   * `false` khi bảng `SavedJob` chưa có trong CSDL — tức code mới đã lên mà
   * chưa ai chạy `npm run db:push`. Giao diện nói thẳng điều đó thay vì để cả
   * trang đổ lỗi 500 chỉ vì một con số trên thanh điều hướng.
   */
  ready: boolean;
}

/**
 * Bảng chưa tồn tại → P2021. Chỉ nuốt ĐÚNG lỗi này; mọi lỗi khác (mất kết nối,
 * sai quyền) vẫn phải nổ ra để trang lỗi nói đúng nguyên nhân.
 */
function isMissingTable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021';
}

/** Bọc `cache()`: khung ngoài và thân trang cùng hỏi trong một lượt tải. */
export const getSavedState = cache(async (ws: WorkspaceId): Promise<SavedState> => {
  const db = getDb(ws);
  try {
    const rows = await db.savedJob.findMany({ select: { postingId: true } });
    return { ids: new Set(rows.map((row) => row.postingId)), count: rows.length, ready: true };
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    console.warn('[saved] Bảng SavedJob chưa có — chạy `npm run db:push`.');
    return { ids: new Set(), count: 0, ready: false };
  }
});

export interface SavedEntry {
  savedAt: Date;
  job: JobListItem;
}

/** Tin đã lưu, mới lưu lên trước. Kể cả tin sàn đã đóng — xem trang `/da-luu`. */
export async function listSavedJobs(ws: WorkspaceId): Promise<SavedEntry[]> {
  const db = getDb(ws);
  const { ready } = await getSavedState(ws);
  if (!ready) return [];

  const rows = await db.savedJob.findMany({
    orderBy: { savedAt: 'desc' },
    include: { posting: { include: LIST_INCLUDE } },
  });
  return rows.map((row) => ({ savedAt: row.savedAt, job: row.posting }));
}

/**
 * Mọi thứ một nút "Lưu tin" cần biết, gom một lần cho cả trang.
 *
 * Một trang Kho tin vẽ 20 nút; hỏi quyền sửa và đếm trần 20 lần là phí.
 */
export interface SaveContext {
  /** Workspace của các tin — nút lưu gửi kèm để server action ghi đúng CSDL. */
  ws: WorkspaceId;
  ids: ReadonlySet<number>;
  count: number;
  /** Nút có hiện không — ẩn hẳn khi bảng chưa có, vì bấm vào chắc chắn hỏng. */
  visible: boolean;
  /** Bấm "Lưu" có tác dụng không. "Bỏ lưu" thì luôn được nếu có quyền. */
  canSave: boolean;
  canUnsave: boolean;
  /** Vì sao không bấm được — hiện ở `title` của nút mờ. */
  reason: string | null;
}

export const getSaveContext = cache(async (ws: WorkspaceId): Promise<SaveContext> => {
  const [state, access] = await Promise.all([getSavedState(ws), getEditAccess()]);
  const full = state.count >= SAVED_JOB_LIMIT;

  const reason = !access.allowed
    ? access.reason === 'unconfigured'
      ? 'Máy chủ chưa đặt EDIT_KEY — giao diện đang chỉ đọc'
      : 'Nhập khoá sửa ở trang Cài đặt để lưu tin'
    : full
      ? `Đã đủ ${SAVED_JOB_LIMIT} tin — bỏ bớt một tin ở trang Tin đã lưu`
      : null;

  return {
    ws,
    ids: state.ids,
    count: state.count,
    visible: state.ready,
    canSave: access.allowed && !full,
    canUnsave: access.allowed,
    reason,
  };
});
