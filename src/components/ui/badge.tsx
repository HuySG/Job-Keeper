import type { ReactNode } from 'react';

import type { Tone } from '@/utils/format';

import { TONE, cx } from './tone';

/**
 * Nhãn trạng thái: **chấm màu + chữ**, không bao giờ chỉ có màu.
 *
 * Vàng cảnh báo trên nền sáng chỉ đạt 1,8:1 độ tương phản. Nếu ý nghĩa nằm hết
 * ở màu thì người mù màu, người đang ra nắng, và bản in đen trắng đều đọc
 * thành cùng một thứ. Chấm màu là kênh phụ, chữ mới là kênh chính.
 */
export function Badge({
  tone = 'neutral',
  children,
  hint,
  dot = true,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  hint?: string;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      title={hint || undefined}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE[tone].soft,
        className,
      )}
    >
      {dot && <span aria-hidden className={cx('size-1.5 shrink-0 rounded-full', TONE[tone].dot)} />}
      {children}
    </span>
  );
}

/** Nhãn trung tính, không mang trạng thái: nơi làm việc, hình thức, cấp bậc. */
export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md bg-inset px-2 py-0.5 text-xs text-muted whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  );
}
