import 'server-only';

import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { WorkspaceNotConfiguredError, isWorkspaceConfigured } from '@/api/workspace-db';
import { isWorkspaceId, type WorkspaceId } from '@/constants/workspace';
import { WORKSPACE_COOKIE, WORKSPACE_HEADER, workspaceOr } from '@/lib/workspace-path';

/**
 * Workspace của một trang, đọc từ đoạn `[ws]` của đường dẫn.
 *
 * Mỗi trang TỰ kiểm, không trông vào layout: Next 15 dựng layout và trang song
 * song, nên trang có thể chạy trước khi layout kịp gọi `notFound()`.
 *
 * Workspace chưa khai CSDL: layout vẽ lời nhắn THAY cho thân trang, nên trang
 * không bao giờ được dựng — nhưng vẫn chặn ở đây phòng khi Next đổi cách dựng.
 */
export async function workspaceParam(params: Promise<{ ws: string }>): Promise<WorkspaceId> {
  const { ws } = await params;
  if (!isWorkspaceId(ws)) notFound();
  if (!isWorkspaceConfigured(ws)) throw new WorkspaceNotConfiguredError(ws);
  return ws;
}

/**
 * Workspace của lượt tải hiện tại, cho những chỗ KHÔNG có `[ws]`: layout gốc
 * (bảng màu) và trang dùng chung `/thanh-phan`. Ưu tiên header middleware gắn
 * theo đường dẫn, rồi tới cookie "workspace vừa xem".
 */
export async function currentWorkspace(): Promise<WorkspaceId> {
  const [h, jar] = await Promise.all([headers(), cookies()]);
  const fromPath = h.get(WORKSPACE_HEADER);
  if (isWorkspaceId(fromPath)) return fromPath;
  return workspaceOr(jar.get(WORKSPACE_COOKIE)?.value);
}
