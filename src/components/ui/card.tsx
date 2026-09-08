import type { ReactNode } from 'react';

import { cx } from './tone';

/**
 * Khung thẻ — đơn vị bố cục duy nhất của bảng điều khiển.
 *
 * Mọi thẻ dùng chung một viền mảnh và một nền, để mắt gom được "đây là một
 * khối" mà không cần đổ bóng nặng. Tiêu đề nằm trong `CardHead` chứ không để
 * người dùng component tự viết `<h2 className="...">`, nếu không thì mười thẻ
 * ra mười cỡ chữ.
 */

export function Card({
  children,
  className,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  return (
    <Tag
      className={cx(
        'rounded-card border border-border bg-surface',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * `title` nói biểu đồ VẼ CÁI GÌ, `subtitle` nói nó ĐƯỢC TÍNH TRÊN GÌ.
 *
 * Dòng thứ hai là chỗ trả nợ sự trung thực: "trên 96 tin có ghi lương / 218
 * tin" quan trọng ngang bản thân con số, vì nó cho biết mẫu có đủ để tin không.
 */
export function CardHead({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 text-xs">{action}</div>}
    </header>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('p-4', className)}>{children}</div>;
}

/** Chân thẻ — chỗ đặt "xem tất cả" hoặc ghi chú về cách tính. */
export function CardFoot({ children }: { children: ReactNode }) {
  return (
    <footer className="border-t border-border px-4 py-2.5 text-xs text-muted">{children}</footer>
  );
}
