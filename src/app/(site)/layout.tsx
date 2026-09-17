import type { ReactNode } from 'react';

import { SiteHeader } from '@/components/layout/site-header';

/**
 * Khung chung của MỌI trang: một tờ giấy kem rộng tối đa 1440px, đổ bóng nhẹ,
 * nằm trên nền pastel.
 *
 * `(site)` là **route group** — cặp ngoặc khiến Next bỏ đoạn này khỏi đường
 * dẫn, nên `/`, `/viec`, `/nganh`… giữ nguyên URL cũ.
 *
 * Vì sao khung nằm ở đây chứ không ở `app/layout.tsx`: `SiteHeader` đọc CSDL.
 * Error boundary của Next chỉ bắt lỗi của các tầng BÊN DƯỚI nó, nên nếu khung
 * nằm ở layout gốc thì lần Neon ngủ quên đầu tiên sẽ cho ra một trang trắng
 * thay vì màn hình "thử lại" ở `app/error.tsx`.
 *
 * Chiều rộng chặn ở 1440px: thả tự do trên màn 2560px thì dòng tiêu đề tin dài
 * tới mức mắt không bắt được đầu dòng sau.
 *
 * ⚠️ CỐ Ý KHÔNG có `loading.tsx` — ở đây lẫn ở `app/`. Đã thử và gỡ (17/09/2026)
 *    vì hai lỗi đo được bằng trình duyệt thật:
 *
 *    1. `loading.tsx` bọc trang trong Suspense, nên HTML gửi khung xương trước
 *       rồi mới gửi nội dung trong một khối ẩn, chờ script lật ra. Trình duyệt
 *       TẮT JavaScript thì mãi mãi chỉ thấy khung xương — trái hẳn lời hứa
 *       "chạy được khi chưa có JS" của cả app.
 *    2. Server action gọi `redirect()` về chính trang đang đứng (nhập sai khoá
 *       sửa → `/cai-dat?khoa=sai`) thì router của Next 15.5 dựng ra một thân
 *       trang RỖNG khi có ranh giới đó.
 *
 *    Mọi liên kết trong app là `<a>` thường, tức mỗi lần chuyển trang là một
 *    lượt tải trang đầy đủ — khung xương vốn chẳng che được bao nhiêu.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="pb-12">
      <div className="mx-auto min-h-screen max-w-360 bg-bg shadow-md">
        <SiteHeader />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
