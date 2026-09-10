import type { ReactNode } from 'react';

import { getOverview } from '@/api/stats.api';
import { Glyph } from '@/components/ui/glyph';
import { timeAgo } from '@/utils/format';

import { TopNavLinks } from './top-nav-links';

/**
 * Khung ngoài của hệ Modernist: **thanh điều hướng NGANG**, nội dung tràn viền.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Vì sao ngang chứ không phải cột dọc như `AppShell`
 *
 * Trang Ngành có một dải hero đỏ chạy hết chiều ngang, và bên dưới là lưới
 * 272px/1fr — bảng lọc bên trái, danh sách tin bên phải. Cộng thêm một cột điều
 * hướng 240px nữa là ba cột dọc cạnh nhau, và cột giữa (bảng lọc) mất hết ý
 * nghĩa thị giác: mắt không phân biệt nổi "cột này để đi trang khác" với "cột
 * này để lọc trang hiện tại".
 *
 * Thanh ngang trả lại toàn bộ chiều ngang cho dải hero — thứ mang sức nặng của
 * cả bản thiết kế — và để dành trục dọc cho đúng một việc: đọc tin.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Chiều rộng chặn ở 1440px. Bản thiết kế vẽ trong khung 1180px, nhưng khung đó
 * là kích thước của ẢNH CHỤP chứ không phải một luật bố cục; thả tự do trên màn
 * 2560px thì dòng tiêu đề tin dài tới mức mắt không bắt được đầu dòng sau.
 */
export async function TopShell({ children }: { children: ReactNode }) {
  const { lastCrawledAt } = await getOverview();

  return (
    <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col bg-canvas">
      <header className="flex items-center gap-4 border-b-2 border-divider px-4 py-3.5 sm:gap-7 sm:px-7">
        <a
          href="/"
          className="text-[19px] font-extrabold tracking-[-0.02em] whitespace-nowrap text-text"
        >
          Bae-Job
        </a>

        <TopNavLinks />

        {/* Đồng hồ crawl. Ẩn dưới 640px: ở đó năm mục điều hướng đã chiếm hết
            chiều ngang, và con số này có mặt lại trong dải hero ngay bên dưới. */}
        <span className="hidden items-center gap-1.5 text-xs whitespace-nowrap text-neutral-700 sm:flex">
          <Glyph name="clock" size={14} />
          {timeAgo(lastCrawledAt)}
        </span>
      </header>

      <main className="min-w-0 flex-1">{children}</main>

      {/* Ranh giới phạm vi, KHÔNG phải khẩu hiệu: công cụ này gom và lọc tin,
          việc ứng tuyển diễn ra ở sàn nguồn. Giữ nguyên câu của khung cũ. */}
      <footer className="border-t-2 border-divider px-4 py-5 text-xs text-neutral-700 sm:px-7">
        Bae-Job chỉ gom và lọc tin. Mọi tin đều dẫn về bản gốc trên sàn nguồn — ứng tuyển tại đó.
      </footer>
    </div>
  );
}
