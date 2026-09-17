'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { cx } from '@/components/ui/tone';
import { NAV, isActivePath } from '@/constants/nav';
import { WORKSPACES, WORKSPACE_IDS, type WorkspaceId } from '@/constants/workspace';
import { pathWithinWorkspace, wsHref } from '@/lib/workspace-path';

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
 *
 * Mọi đường dẫn mang tiền tố workspace (`/bae/nganh`); mục "Ngành" lấy nhãn
 * của workspace — "Ngành của Bae" hay "Ngành của tôi".
 */
export function TopNavLinks({ ws }: { ws: WorkspaceId }) {
  const pathname = usePathname();

  return (
    // Màn hình hẹp: dải ngang cuộn được, chiếm trọn một hàng dưới logo. Không
    // dùng menu bật ra — năm mục thì một dải ngang gọn hơn.
    <nav
      aria-label="Điều hướng chính"
      className="no-scrollbar order-last -mx-1 flex w-full gap-5 overflow-x-auto px-1 text-sm lg:order-none lg:mx-0 lg:mr-auto lg:w-auto lg:flex-wrap lg:overflow-visible lg:px-0"
    >
      {NAV.map((item) => {
        const href = wsHref(ws, item.href);
        const active = isActivePath(href, pathname, item.href === '/');
        const label = item.href === '/nganh' ? WORKSPACES[ws].label : item.label;
        return (
          <a
            key={item.href}
            href={href}
            aria-current={active ? 'page' : undefined}
            title={item.question}
            className={cx(
              'navlink border-b-2 pb-0.75 whitespace-nowrap',
              active
                ? 'border-accent font-extrabold text-accent'
                : 'border-transparent text-neutral-700 hover:text-accent',
            )}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}

/**
 * Công tắc workspace — đứng cạnh logo, hai nửa của một khối `seg`.
 *
 * Chuyển workspace GIỮ trang đang đứng (`/bae/luong` → `/swe/luong`) nhưng BỎ
 * query string: bộ lọc của nghề này vô nghĩa với nghề kia. Riêng trang chi
 * tiết tin (`/viec/123`) thì về Kho tin — số hiệu tin chỉ có nghĩa trong CSDL
 * của nó. Là `<a>` thường: chạy được khi JavaScript chưa tải.
 */
export function WorkspaceSwitch({ ws }: { ws: WorkspaceId }) {
  const pathname = usePathname();
  const within = pathWithinWorkspace(pathname);
  const target = /^\/viec\/[^/]+/.test(within) ? '/viec' : within;

  return (
    <nav aria-label="Chọn ngành" className="seg w-fit text-[13px]">
      {WORKSPACE_IDS.map((id) => (
        <a
          key={id}
          href={wsHref(id, target)}
          aria-current={id === ws ? 'true' : undefined}
          className="seg-opt whitespace-nowrap"
        >
          {WORKSPACES[id].label}
        </a>
      ))}
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
