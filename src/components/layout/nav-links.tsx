'use client';

import { usePathname } from 'next/navigation';

import { NAV } from '@/constants/nav';
import { Icon } from '@/components/ui/icon';
import { cx } from '@/components/ui/tone';

/**
 * Danh sách liên kết điều hướng, có đánh dấu trang đang mở.
 *
 * **Đây là component phía trình duyệt DUY NHẤT của cả ứng dụng.** Mọi thứ còn
 * lại — bộ lọc, sắp xếp, phân trang, toàn bộ biểu đồ — đều dựng sẵn trên máy
 * chủ và chạy được khi JavaScript chưa tải xong.
 *
 * Nó phải nằm ở đây vì `layout.tsx` không biết URL hiện tại, mà "tôi đang ở
 * trang nào" thì không thể chờ JavaScript: nếu thiếu, người dùng mất phương
 * hướng ngay giây đầu tiên. Đổi lại chỉ là một hook `usePathname`.
 */
export function NavLinks() {
  const pathname = usePathname();

  return (
    // Màn hình hẹp: một dải NGANG cuộn được. Xếp dọc bốn mục trên điện thoại
    // là ăn mất một phần tư màn hình đầu tiên trước khi thấy được số liệu nào.
    <ul className="flex gap-1 overflow-x-auto lg:block lg:space-y-0.5 lg:overflow-visible">
      {NAV.map((item) => {
        // `/viec/123` vẫn phải sáng ở mục "Kho tin" — nhưng `/` thì chỉ khớp
        // đúng chính nó, nếu không thì mục đầu tiên lúc nào cũng sáng.
        const active =
          item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

        return (
          <li key={item.href}>
            <a
              href={item.href}
              aria-current={active ? 'page' : undefined}
              title={item.question}
              className={cx(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors',
                active
                  ? 'bg-accent-soft font-medium text-accent-ink'
                  : 'text-muted hover:bg-inset hover:text-text',
              )}
            >
              <Icon name={item.icon} />
              {item.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
