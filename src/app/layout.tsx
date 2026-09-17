import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import type { ReactNode } from 'react';

import { getAppearance } from '@/lib/appearance';

import '@/styles/globals.css';

/**
 * Archivo — chữ của hệ Modernist.
 *
 * Bốn nét: 400 cho thân bài, 500 và 600 cho nhấn trong câu, 800 cho tiêu đề và
 * mọi con số lớn. Bản v2 dùng thêm 500 ở vài nhãn; mỗi nét thừa là một file
 * font nữa phải tải, nên không thêm nét nào ngoài bốn nét bản thiết kế nạp.
 *
 * `subsets` PHẢI có `vietnamese`. Thiếu nó thì trình duyệt vẫn hiện được chữ
 * tiếng Việt, nhưng bằng cách mượn font dự phòng cho riêng những ký tự có dấu —
 * ra một dòng chữ hai kiểu, cao thấp so le, thấy rõ nhất ở tiêu đề cỡ lớn.
 */
const archivo = Archivo({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '800'],
  variable: '--font-archivo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Bae-Job — tin tuyển dụng đúng ngành, còn sống',
    template: '%s · Bae-Job',
  },
  description:
    'Mèo Bae gom tin từ nhiều sàn, chấm điểm bằng từ điển ngành, loại tin hết hạn — và nói thật về độ tươi của dữ liệu.',
};

/**
 * Chỉ khai `light`. Hệ Modernist không có bảng màu tối; "xanh dương" là bảng
 * màu thứ hai trên cùng nền sáng. Khai đúng một chế độ để trình duyệt thôi tự
 * đảo màu thanh cuộn và ô nhập trên máy đang để chế độ tối.
 */
export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f3f2f2',
};

/**
 * Khung ngoài cùng CỐ Ý mỏng: `<html>`, `<body>`, font và hai công tắc giao
 * diện. Thanh điều hướng nằm ở `(site)/layout.tsx` — xem lý do ở đó.
 *
 * `data-theme` và `data-motion` gắn NGAY trên `<html>` từ cookie, trong lượt
 * HTML đầu tiên: đọc sau bằng JavaScript thì trang nháy bảng màu mặc định một
 * nhịp rồi mới đổi.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const appearance = await getAppearance();

  return (
    <html
      lang="vi"
      className={archivo.variable}
      data-theme={appearance.theme}
      data-motion={appearance.motion ? 'on' : 'off'}
    >
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
