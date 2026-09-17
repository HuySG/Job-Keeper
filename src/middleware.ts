import { NextResponse, type NextRequest } from 'next/server';

import {
  UNMATCHED_PATH,
  WORKSPACE_COOKIE,
  WORKSPACE_HEADER,
  classifyPath,
  workspaceOr,
} from '@/lib/workspace-path';

/**
 * Bốn việc, cả bốn chỉ đọc đường dẫn và cookie — không đụng CSDL:
 *
 *   1. `/` → chuyển về workspace vừa xem (cookie `bj-ws`), mặc định `bae`.
 *   2. `/{ws}/...` → gắn header `x-bj-workspace` vào request. Layout GỐC nằm
 *      trên đoạn `[ws]` nên không đọc được tham số đó, mà nó lại là chỗ phải
 *      gắn bảng màu lên `<html>` ngay trong lượt HTML đầu tiên.
 *   3. `/{ws}/...` → nhớ workspace vào cookie, cho bước 1 lần sau và cho trang
 *      dùng chung `/thanh-phan`.
 *   4. Đoạn đầu lạ (`/abc/...`) → viết lại sang một đường dẫn không khớp route
 *      nào, để Next dựng 404 đủ trong HTML — xem `classifyPath`.
 *
 * Đường dẫn CŨ (`/nganh`, `/viec/123`...) chuyển hướng ở `next.config.ts` —
 * chạy trước middleware.
 */
export function middleware(request: NextRequest): NextResponse {
  const remembered = request.cookies.get(WORKSPACE_COOKIE)?.value;
  const path = classifyPath(request.nextUrl.pathname);

  if (path.kind === 'root') {
    const target = request.nextUrl.clone();
    target.pathname = `/${workspaceOr(remembered)}`;
    return NextResponse.redirect(target, 307);
  }
  if (path.kind === 'shared') return NextResponse.next();
  if (path.kind === 'unknown') {
    const target = request.nextUrl.clone();
    target.pathname = UNMATCHED_PATH;
    return NextResponse.rewrite(target);
  }

  const { ws } = path;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(WORKSPACE_HEADER, ws);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (remembered !== ws) {
    response.cookies.set(WORKSPACE_COOKIE, ws, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }
  return response;
}

export const config = {
  // Bỏ tài nguyên tĩnh và đường nội bộ của Next/Vercel — nếu không, bước 4 sẽ
  // biến `/__nextjs_…` (lớp báo lỗi lúc dev) và `/_vercel/…` thành 404.
  matcher: ['/((?!_next/|_vercel/|__nextjs|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)'],
};
