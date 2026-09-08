import type { ReactNode } from 'react';

import { getOverview } from '@/api/stats.api';
import { Badge } from '@/components/ui/badge';
import { formatCount, freshnessMeta, timeAgo } from '@/utils/format';

import { NavLinks } from './nav-links';

/**
 * Khung ngoài: điều hướng bên trái, nội dung bên phải.
 *
 * Cột trái cố định là hình dạng đúng cho một bảng điều khiển — bốn màn hình
 * luôn cách nhau đúng một cú bấm, và chỗ đứng của mỗi màn hình không đổi. Bản
 * trước chỉ có một thanh tiêu đề với đúng một liên kết "Bae-Job", tức là
 * không có điều hướng: mọi thứ ngoài danh sách tin đều không tới được.
 *
 * Dưới 1024px cột trái xếp thành một dải ngang cuộn được. Không dùng menu bật
 * ra — bốn mục thì một dải ngang gọn hơn, và không cần một dòng JavaScript nào.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const { alive, activeSources, lastCrawledAt } = await getOverview();
  const freshness = freshnessMeta(lastCrawledAt);

  return (
    <div className="lg:flex lg:min-h-screen">
      <header className="border-b border-border bg-surface lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-4 px-4 py-3.5 lg:block">
          <div>
            <a href="/" className="text-base font-semibold tracking-tight">
              Bae-Job
            </a>
            {/* Dòng này KHÔNG phải khẩu hiệu. Nó là ranh giới phạm vi, và nó
                phải đứng ở chỗ dễ thấy nhất: công cụ này gom và lọc tin, việc
                ứng tuyển diễn ra ở sàn nguồn. */}
            <p className="mt-0.5 hidden text-xs text-muted lg:block">
              Gom tin nhiều sàn, giữ tin còn sống
            </p>
          </div>

          <div className="lg:mt-4">
            <Badge tone={freshness.tone} hint={freshness.hint}>
              {timeAgo(lastCrawledAt)}
            </Badge>
          </div>
        </div>

        <nav aria-label="Điều hướng chính" className="px-2 pb-3 lg:px-3">
          <NavLinks />
        </nav>

        {/* Chân cột trái nói ba con số bảo chứng cho mọi thứ hiện ở bên phải.
            Ẩn trên màn hình hẹp: ở đó chúng đã có mặt trong dãy chỉ số. */}
        <div className="hidden border-t border-border px-4 py-3 text-xs text-muted lg:block">
          <p>
            <span className="tnum font-medium text-text">{formatCount(alive)}</span> tin còn hiệu lực
          </p>
          <p className="mt-0.5">
            từ <span className="tnum font-medium text-text">{activeSources}</span> sàn đang bật
          </p>
        </div>
      </header>

      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">{children}</main>

        <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted lg:px-8">
          Bae-Job chỉ gom và lọc tin. Mọi tin đều dẫn về bản gốc trên sàn nguồn — ứng tuyển tại đó.
        </footer>
      </div>
    </div>
  );
}
