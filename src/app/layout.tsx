import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getFreshness } from '@/api/job.api';
import { timeAgo } from '@/utils/format';

import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Bae-Job — tin tuyển dụng đã gom và lọc',
  description: 'Gom tin từ nhiều sàn, chỉ giữ tin còn hiệu lực, lọc theo đúng thứ mình cần.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-muted">
          Bae-Job chỉ gom và lọc tin. Mọi tin đều dẫn về bản gốc trên sàn nguồn — ứng tuyển tại đó.
        </footer>
      </body>
    </html>
  );
}

/**
 * Header nói **số liệu**, không nói khẩu hiệu.
 *
 * Bản trước ghi "tin tuyển dụng đã gom và lọc" — đúng nhưng vô dụng: người dùng
 * đã ở trong trang rồi thì họ cần biết kho có bao nhiêu tin, từ mấy sàn, và
 * mới tới đâu. Ba con số đó trả lời câu "dữ liệu này có đáng tin không".
 */
async function SiteHeader() {
  const { totalAlive, sourceCount, lastCrawledAt } = await getFreshness();

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-4">
        <a href="/" className="text-lg font-semibold tracking-tight">
          Bae-Job
        </a>
        <p className="text-sm text-muted">
          <strong className="font-medium text-text">
            {totalAlive.toLocaleString('vi-VN')}
          </strong>{' '}
          tin còn hiệu lực từ {sourceCount} sàn
          <span className="mx-1.5 opacity-40">·</span>
          cập nhật {timeAgo(lastCrawledAt)}
        </p>
      </div>
    </header>
  );
}
