import { DEFAULT_WORKSPACE, isWorkspaceId, type WorkspaceId } from '@/constants/workspace';

/**
 * Đường dẫn theo workspace — hàm THUẦN, dùng được cả phía trình duyệt.
 *
 * Mọi trang của một workspace nằm dưới `/{ws}` (docs/plan-swe.md §8.1), vì
 * mã tin tự tăng trong TỪNG CSDL: `/viec/123` ở hai workspace là hai tin khác
 * nhau. Không chỗ nào trong app được viết cứng "/nganh" nữa — đi qua `wsHref`.
 */

/** Cookie nhớ workspace vừa xem — `/` chuyển về đó. */
export const WORKSPACE_COOKIE = 'bj-ws';

/** Header middleware gắn vào request để layout gốc biết workspace (xem middleware.ts). */
export const WORKSPACE_HEADER = 'x-bj-workspace';

/** `wsHref('swe', '/nganh')` → `/swe/nganh`; `wsHref('bae', '/')` → `/bae`. */
export function wsHref(ws: WorkspaceId, path: string): string {
  if (path === '/' || path === '') return `/${ws}`;
  return `/${ws}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Workspace ở đoạn đầu của đường dẫn, hoặc null. */
export function workspaceFromPath(pathname: string): WorkspaceId | null {
  const first = pathname.split('/')[1] ?? '';
  return isWorkspaceId(first) ? first : null;
}

/**
 * Phần đường dẫn SAU tiền tố workspace: `/bae/viec/12` → `/viec/12`.
 * Không có tiền tố thì trả `/` — công tắc workspace ở trang dùng chung
 * (`/thanh-phan`) đưa về trang đầu của workspace kia.
 */
export function pathWithinWorkspace(pathname: string): string {
  if (!workspaceFromPath(pathname)) return '/';
  const rest = pathname.split('/').slice(2).join('/');
  return rest ? `/${rest}` : '/';
}

/** Đọc giá trị cookie/header thành workspace, rơi về mặc định. */
export function workspaceOr(value: string | null | undefined, fallback: WorkspaceId = DEFAULT_WORKSPACE): WorkspaceId {
  return isWorkspaceId(value) ? value : fallback;
}

/** Trang dùng chung, không thuộc workspace nào — đoạn đầu của đường dẫn. */
export const SHARED_ROUTES: readonly string[] = ['thanh-phan'];

/**
 * Đường dẫn nội bộ KHÔNG khớp route nào (5 đoạn, sâu hơn mọi route của app).
 * Middleware viết lại đường dẫn lạ sang đây để Next dựng 404 "không khớp".
 */
export const UNMATCHED_PATH = '/_/khong/co/trang/nay';

export type PathKind =
  | { kind: 'root' }
  | { kind: 'workspace'; ws: WorkspaceId }
  | { kind: 'shared' }
  | { kind: 'unknown' };

/**
 * Middleware xử lý đường dẫn theo loại. Tách ra để test được.
 *
 * `unknown` tồn tại vì một lý do đo được (17/09/2026, Next 15.5): `[ws]` khớp
 * MỌI đoạn đầu, nên `/abc` sẽ đi vào route rồi mới bị 404 — và 404 phát sinh
 * trong lúc dựng route chỉ nằm trong payload JavaScript, trình duyệt tắt JS
 * thấy trang trắng. 404 của đường dẫn không khớp route nào thì Next dựng đủ.
 */
export function classifyPath(pathname: string): PathKind {
  if (pathname === '/' || pathname === '') return { kind: 'root' };
  const ws = workspaceFromPath(pathname);
  if (ws) return { kind: 'workspace', ws };
  const first = pathname.split('/')[1] ?? '';
  return SHARED_ROUTES.includes(first) ? { kind: 'shared' } : { kind: 'unknown' };
}
