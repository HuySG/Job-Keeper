import type { ReactNode } from 'react';

import { cx } from './tone';

/**
 * Hộp lời nhắn — vạch trái 6px, nền nhạt, chữ 13px.
 *
 * Đây là giọng nói của Mèo Bae: chỗ công cụ tự nói về giới hạn của chính nó.
 * Mỗi sắc một vai, đừng chọn theo thẩm mỹ:
 *
 *   · `brand`  — ghi chú về cách đọc số liệu (nền pastel)
 *   · `accent` — chỗ yếu đã biết, cần để mắt (nền xanh nhạt)
 *   · `live`   — nói về độ tươi của dữ liệu
 *   · `ink`    — lời khuyên dè dặt, mẫu nhỏ (vạch mực)
 *   · `quiet`  — tin chưa có bằng chứng còn sống (vạch xám)
 *   · `warn`   — người dùng cần làm gì đó
 */
const TONES = {
  brand: 'bg-brand-soft border-accent text-accent-900',
  accent: 'bg-accent-100 border-accent text-accent-900',
  live: 'bg-live-100 border-live text-text',
  ink: 'bg-neutral-200 border-text text-text',
  quiet: 'bg-neutral-200 border-neutral-600 text-text',
  warn: 'bg-warn-soft border-warn text-warn-ink',
} as const;

export type CalloutTone = keyof typeof TONES;

export function Callout({
  tone,
  icon,
  action,
  align = 'center',
  className,
  children,
}: {
  tone: CalloutTone;
  icon?: ReactNode;
  action?: ReactNode;
  align?: 'center' | 'start';
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        'flex flex-wrap gap-x-3.5 gap-y-3 border-l-[6px] px-4 py-3.5 text-[13px] leading-[1.55]',
        align === 'center' ? 'items-center' : 'items-start',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {/* Nền co 8rem chứ không phải 260px: hộp này đứng cả trong cột hẹp
          360px, và ở đó mèo phải đứng CẠNH chữ chứ không bị đẩy lên một dòng riêng. */}
      <div className="min-w-0 flex-[1_1_8rem]">{children}</div>
      {action}
    </div>
  );
}
