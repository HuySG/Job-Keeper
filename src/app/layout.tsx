import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import type { ReactNode } from 'react';

import '@/styles/globals.css';

/**
 * Archivo — chữ của hệ Modernist.
 *
 * Ba nét, không hơn: 400 cho thân bài, 600 cho nhấn trong câu, 800 cho tiêu đề
 * và mọi con số lớn. Mỗi nét thừa là một file font nữa phải tải.
 *
 * `subsets` PHẢI có `vietnamese`. Thiếu nó thì trình duyệt vẫn hiện được chữ
 * tiếng Việt, nhưng bằng cách mượn font dự phòng cho riêng những ký tự có dấu —
 * ra một dòng chữ hai kiểu, cao thấp so le, thấy rõ nhất ở tiêu đề cỡ lớn.
 *
 * `display: 'swap'` để chữ hiện ngay bằng font dự phòng rồi mới đổi, thay vì
 * để trống một khoảng trắng trong lúc chờ tải.
 */
const archivo = Archivo({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '600', '800'],
  variable: '--font-archivo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Bae-Job — bảng điều khiển tin tuyển dụng',
    template: '%s · Bae-Job',
  },
  description:
    'Gom tin từ nhiều sàn, chỉ giữ tin còn hiệu lực, và nói thật về độ tươi của dữ liệu.',
};

/**
 * Chỉ khai `light`.
 *
 * Hệ Modernist không có bảng màu tối và dự án đã chốt bỏ chế độ tối. Khai đúng
 * một chế độ để trình duyệt thôi tự đảo màu thanh cuộn và ô nhập trên máy đang
 * để chế độ tối — thứ tạo ra ô nhập nền đen nằm giữa một trang nền kem.
 */
export const viewport: Viewport = {
  colorScheme: 'light',
};

/**
 * Khung ngoài cùng CỐ Ý mỏng: chỉ có `<html>`, `<body>` và font.
 *
 * Điều hướng không nằm ở đây nữa. Hai nhóm trang đang có hai khung khác nhau —
 * `(dashboard)` giữ cột dọc bên trái, `nganh` dùng thanh ngang của bản thiết kế
 * mới — nên khung phải do từng nhóm tự khai. Nhét `AppShell` vào đây thì trang
 * Ngành lĩnh cả hai thanh điều hướng cùng lúc.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={archivo.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
