import type { ReactNode } from 'react';

import { cx } from './tone';

/**
 * Bảng — dạng đúng khi có quá ~7 hạng mục mà hạng mục nào cũng có nghĩa.
 *
 * Bảng cũng là **bản song sinh đọc được** của biểu đồ: mọi giá trị mà biểu đồ
 * chỉ nói bằng chiều dài cột đều phải đọc được thành chữ ở đâu đó, nếu không
 * thì ai không phân biệt được màu hoặc đang dùng trình đọc màn hình sẽ không
 * lấy được số.
 *
 * `numeric` bật `tabular-nums`: số xếp thành cột phải thẳng hàng thì mới so
 * sánh được bằng mắt.
 */

export function Table({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  numeric = false,
  className,
}: {
  children: ReactNode;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cx(
        'border-b border-border px-3 py-2 text-xs font-medium text-muted',
        numeric ? 'text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  numeric = false,
  className,
}: {
  children: ReactNode;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cx(
        'border-b border-border px-3 py-2 align-middle',
        numeric && 'tnum text-right',
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({ children }: { children: ReactNode }) {
  return <tr className="hover:bg-inset/60">{children}</tr>;
}
