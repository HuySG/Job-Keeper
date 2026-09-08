import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/layout/app-shell';

import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Bae-Job — bảng điều khiển tin tuyển dụng',
    template: '%s · Bae-Job',
  },
  description:
    'Gom tin từ nhiều sàn, chỉ giữ tin còn hiệu lực, và nói thật về độ tươi của dữ liệu.',
};

/** Báo cho trình duyệt biết trang có CẢ hai chế độ, để nó tô đúng màu thanh cuộn. */
export const viewport: Viewport = {
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
