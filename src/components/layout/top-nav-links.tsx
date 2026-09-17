'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { cx } from '@/components/ui/tone';
import { NAV, isActivePath } from '@/constants/nav';

/**
 * Liên kết của thanh điều hướng ngang.
 *
 * Phải chạy phía trình duyệt vì `layout.tsx` dựng trên máy chủ không biết URL
 * hiện tại, mà "tôi đang ở trang nào" thì không thể chờ JavaScript tải xong —
 * `usePathname` có giá trị ngay trong lượt HTML đầu tiên.
 *
 * Mục đang mở được đánh dấu bằng BA kênh cùng lúc — chữ accent, nét 800, và
 * gạch chân 2px. Chỉ đổi màu thì người mù màu mất dấu hoàn toàn, chỉ đổi nét
 * đậm thì ở cỡ 14px gần như không thấy.
 */
export function TopNavLinks() {
  const pathname = usePathname();

  return (
    // Màn hình hẹp: dải ngang cuộn được, chiếm trọn một hàng dưới logo. Không
    // dùng menu bật ra — năm mục thì một dải ngang gọn hơn.
    <nav
      aria-label="Điều hướng chính"
      className="no-scrollbar order-last -mx-1 flex w-full gap-5 overflow-x-auto px-1 text-sm lg:order-none lg:mx-0 lg:mr-auto lg:w-auto lg:flex-wrap lg:overflow-visible lg:px-0"
    >
      {NAV.map((item) => {
        const active = isActivePath(item.href, pathname);
        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            title={item.question}
            className={cx(
              'navlink border-b-2 pb-0.75 whitespace-nowrap',
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

/**
 * Nút phụ bên phải thanh điều hướng — sáng lên khi đang ở đúng trang đó, để
 * trang Cài đặt không trông như một trang "không thuộc về đâu".
 */
export function NavAction({
  href,
  label,
  icon,
  className,
  children,
}: {
  href: string;
  label: string;
  icon?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const active = isActivePath(href, usePathname());
  return (
    <a
      href={href}
      aria-label={icon ? label : undefined}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={cx('btn btn-ghost', icon && 'btn-icon', active && 'bg-accent-100', className)}
    >
      {children}
    </a>
  );
}
