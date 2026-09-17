import 'server-only';

import { PrismaClient } from '@prisma/client';

import type { WorkspaceId } from '@/constants/workspace';
import { assertDistinctDatabases } from '@/lib/workspace';

/**
 * Prisma client theo WORKSPACE — cửa DUY NHẤT của phần web vào CSDL.
 *
 * Web phục vụ cả hai workspace trong cùng một tiến trình (`/bae/...`,
 * `/swe/...`), nên không thể dùng `db` của `api/db.ts` — client đó đọc
 * `DATABASE_URL` mà script đã chọn lúc khởi động. Quên truyền workspace ở một
 * hàm là đọc nhầm CSDL mà không lỗi nào báo; test `workspace-isolation` cấm
 * phần web import `@/api/db` để chặn đúng chuyện đó.
 *
 * Một client mỗi workspace, nhớ trên `globalThis` — cùng lý do với `api/db.ts`:
 * Next nạp lại module khi sửa file, tạo client mới mỗi lần là hết slot kết nối.
 */

type Clients = Map<WorkspaceId, PrismaClient>;
const globalForPrisma = globalThis as unknown as { prismaByWorkspace?: Clients };
const clients: Clients = (globalForPrisma.prismaByWorkspace ??= new Map());

/** Workspace chưa khai chuỗi kết nối — trang hiện lời nhắn thay vì lỗi 500. */
export class WorkspaceNotConfiguredError extends Error {
  constructor(readonly ws: WorkspaceId) {
    super(`Workspace "${ws}" chưa có CSDL (thiếu biến môi trường).`);
    this.name = 'WorkspaceNotConfiguredError';
  }
}

export function isWorkspaceConfigured(ws: WorkspaceId): boolean {
  return assertDistinctDatabases(process.env)[ws] !== null;
}

export function getDb(ws: WorkspaceId): PrismaClient {
  const existing = clients.get(ws);
  if (existing) return existing;

  // Kiểm lại "hai workspace trỏ cùng một CSDL" ở phía web: khai nhầm biến trên
  // Vercel thì trang của nghề này sẽ hiện tin của nghề kia.
  const resolved = assertDistinctDatabases(process.env)[ws];
  if (!resolved) throw new WorkspaceNotConfiguredError(ws);

  const client = new PrismaClient({
    datasourceUrl: resolved.url,
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  });
  clients.set(ws, client);
  return client;
}
