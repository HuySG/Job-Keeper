'use client';

import { Mascot } from '@/components/ui/mascot';

/**
 * Màn hình lỗi.
 *
 * Nguyên nhân số một ở dự án này là **không nối được CSDL** — Neon gói Free
 * cho compute ngủ sau vài phút không dùng, và cú truy vấn đầu tiên sau đó có
 * thể hết giờ chờ. Nói thẳng ra khả năng đó, kèm nút thử lại, thì tự chữa được
 * trong năm giây; còn một trang trắng thì phải đi đọc log mới biết.
 *
 * Nằm NGOÀI khung `(site)` (khung đó cũng đọc CSDL và chính nó có thể là thứ
 * vừa hỏng), nên màn này tự vẽ tờ giấy của mình và không có thanh điều hướng.
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
    <div className="pb-12">
      <div className="mx-auto flex min-h-screen max-w-360 flex-col items-center justify-center gap-6 bg-bg px-4 py-16 text-center shadow-md">
        <Mascot pose="head" width={96} motion="shake" />
        <div className="max-w-140">
          <h1 className="mb-3 text-[30px] leading-[1.12] sm:text-[34px]">Mèo không lấy được dữ liệu lần này</h1>
          <p className="text-base leading-[1.6] text-pretty text-neutral-800">
            Hay gặp nhất: CSDL gói Free ngủ sau vài phút im ắng, nên cú truy vấn đầu tiên có thể hết giờ chờ.
            Thử lại thường là xong.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          <button type="button" onClick={reset} className="btn btn-primary h-11.5 px-5">
            Thử lại
          </button>
          <a href="/" className="btn btn-ghost h-11.5 px-4">
            Về Tổng quan
          </a>
        </div>
        {error.digest && <p className="font-mono text-xs text-neutral-600">mã lỗi: {error.digest}</p>}
      </div>
    </div>
  );
}
