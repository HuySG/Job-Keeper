'use client';

import { Empty } from '@/components/ui/empty';
import { PageHeader } from '@/components/ui/page-header';

/**
 * Màn hình lỗi.
 *
 * Nguyên nhân số một ở dự án này là **không nối được CSDL** — Neon gói Free
 * cho compute ngủ sau vài phút không dùng, và cú truy vấn đầu tiên sau đó có
 * thể hết giờ chờ. Nói thẳng ra khả năng đó, kèm nút thử lại, thì tự chữa được
 * trong năm giây; còn một trang trắng thì phải đi đọc log mới biết.
 *
 * Bắt buộc là component phía trình duyệt: React cần `reset()` chạy ở đó.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <PageHeader title="Có lỗi khi đọc dữ liệu" description="Trang không dựng được lần này." />
      <Empty title="Không lấy được dữ liệu từ CSDL">
        <p>
          Hay gặp nhất: Neon gói Free cho compute ngủ sau vài phút, nên cú truy vấn đầu tiên sau
          một lúc im ắng có thể hết giờ chờ. Thử lại thường là xong.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Thử lại
        </button>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-faint">mã lỗi: {error.digest}</p>
        )}
      </Empty>
    </>
  );
}
