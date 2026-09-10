'use client';

import { usePathname } from 'next/navigation';

import { cx } from '@/components/ui/tone';
import { NAV } from '@/constants/nav';

/**
 * Liên kết điều hướng của thanh NGANG (hệ Modernist).
 *
 * Cùng lý do tồn tại như `nav-links.tsx` của khung cũ: `layout.tsx` chạy trên
 * máy chủ nên không biết URL hiện tại, mà "tôi đang ở trang nào" thì không thể
 * chờ JavaScript tải xong.
 *
 * Mục đang mở được đánh dấu bằng BA kênh cùng lúc — chữ đỏ, nét 800, và gạch
 * chân 2px. Bản thiết kế vẽ đủ cả ba, và đó là lựa chọn đúng: chỉ đổi màu thì
 * người mù màu đỏ-lục mất dấu hoàn toàn, chỉ đổi nét đậm thì ở cỡ 14px gần như
 * không thấy.
 */
export function TopNavLinks() {
  const pathname = usePathname();

  return (
    // Màn hình hẹp: dải ngang cuộn được, giấu thanh cuộn. Không dùng menu bật
    // ra — năm mục thì một dải ngang gọn hơn, và không tốn một dòng JS nào.
    <nav
      aria-label="Điều hướng chính"
      className="-mx-1 flex min-w-0 flex-1 gap-5 overflow-x-auto px-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {NAV.map((item) => {
        // `/viec/123` vẫn phải sáng ở mục "Kho tin" — nhưng `/` thì chỉ khớp
        // đúng chính nó, nếu không thì mục đầu tiên lúc nào cũng sáng.
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            title={item.question}
            className={cx(
              'border-b-2 pb-0.5 whitespace-nowrap transition-colors',
              active
                ? 'border-accent font-extrabold text-accent'
                : 'border-transparent text-neutral-700 hover:text-accent',
            )}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
