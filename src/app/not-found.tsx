import { NotFoundView } from '@/components/layout/not-found-view';

export const metadata = { title: 'Không tìm thấy' };

/**
 * 404 cho đường dẫn KHÔNG khớp trang nào — Next dựng nó ngoài khung `(site)`,
 * nên tự vẽ tờ giấy. 404 do `notFound()` trong một trang thì dùng
 * `(site)/not-found.tsx` và có đủ thanh điều hướng.
 */
export default function NotFound() {
  return (
    <div className="pb-12">
      <div className="mx-auto min-h-screen max-w-360 bg-bg shadow-md">
        <NotFoundView />
      </div>
    </div>
  );
}
