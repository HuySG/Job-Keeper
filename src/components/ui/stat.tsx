import type { ReactNode } from 'react';

import { Glyph, type GlyphName } from './glyph';
import { cx } from './tone';

/**
 * Dải chỉ số — một hàng ô số liệu ngăn nhau bằng vạch mảnh, KHÔNG có khoảng
 * cách giữa các ô: đây là một cụm số liệu, không phải bốn thẻ rời.
 *
 * Hai nền:
 *   · `brand` — nằm trong dải hero pastel, vạch trên 2px `accent-700`, chữ nhãn
 *     `accent-800` (chữ `accent` đặt trên pastel không đủ tương phản).
 *   · `plain` — nằm trên nền kem, vạch dưới 2px mực như mọi phân đoạn khác.
 */
export function StatStrip({
  tone,
  className,
  children,
}: {
  tone: 'brand' | 'plain';
  className?: string;
  children: ReactNode;
}) {
  return (
    <dl
      className={cx(
        'rise-list flex flex-wrap',
        tone === 'brand' ? 'border-t-2 border-accent-700' : 'border-b-2 border-divider',
        // Vạch dọc giữa các ô; ô cuối không có để cụm không treo một nét thừa ở mép.
        tone === 'brand'
          ? '[&>*:not(:last-child)]:border-r [&>*:not(:last-child)]:border-accent-600'
          : '[&>*:not(:last-child)]:border-r [&>*:not(:last-child)]:border-divider',
        className,
      )}
    >
      {children}
    </dl>
  );
}

const SIZE = {
  // Nền 10rem trên điện thoại: hai ô một hàng thay vì bốn ô chồng dọc chiếm
  // trọn màn hình đầu tiên. Từ `sm` trở lên mới về đúng nền của bản thiết kế.
  /** Hero trang Ngành. */
  lg: { cell: 'basis-40 px-5 pt-4.5 pb-5 sm:basis-50', value: 'text-[34px]', unit: 'text-[17px]' },
  /** Dải chỉ số dưới hero Tổng quan. */
  xl: { cell: 'basis-40 px-6 py-5.5 sm:basis-55', value: 'text-[38px]', unit: 'text-[18px]' },
  /** Dải mảnh của Kho tin. */
  md: { cell: 'basis-40 px-5 pt-4 pb-4.5 sm:basis-45', value: 'text-[30px]', unit: 'text-base' },
} as const;

export function StatCell({
  tone,
  size = 'lg',
  icon,
  label,
  value,
  unit,
  sub,
  emphasis = false,
  hint,
}: {
  tone: 'brand' | 'plain';
  size?: keyof typeof SIZE;
  icon?: GlyphName;
  label: ReactNode;
  value: ReactNode;
  /** Phần đuôi nhỏ, xám ("/ 318") — mẫu số đứng ngay cạnh con số. */
  unit?: ReactNode;
  sub?: ReactNode;
  /** Con số chính của cả dải: tô màu accent. */
  emphasis?: boolean;
  hint?: string;
}) {
  const s = SIZE[size];
  return (
    <div title={hint} className={cx('min-w-0 flex-1', s.cell)}>
      <dt
        className={cx(
          'mb-2 flex items-center gap-1.75 text-xs',
          tone === 'brand' ? 'text-accent-800' : 'text-neutral-700',
          size === 'md' && 'mb-1.5',
        )}
      >
        {icon && <Glyph name={icon} size={14} />}
        {label}
      </dt>
      <dd className="m-0">
        <span
          className={cx(
            'block font-heading leading-none font-extrabold',
            s.value,
            emphasis ? (tone === 'brand' && size === 'md' ? 'text-accent-800' : 'text-accent-700') : 'text-text',
          )}
        >
          {value}
          {unit && (
            <span
              className={cx(
                s.unit,
                tone === 'brand' && size === 'md' ? 'text-accent-800' : 'text-neutral-700',
              )}
            >
              {unit}
            </span>
          )}
        </span>
        {sub && (
          <span
            className={cx(
              'mt-1.5 block text-xs',
              tone === 'brand' ? 'text-neutral-800' : 'text-neutral-600',
            )}
          >
            {sub}
          </span>
        )}
      </dd>
    </div>
  );
}

/** Dòng kicker viết hoa phía trên tiêu đề hero. */
export function Kicker({
  icon,
  className,
  children,
}: {
  icon?: GlyphName;
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      className={cx(
        'mb-3 flex flex-wrap items-center gap-2 text-[11px] tracking-[0.12em] text-accent-800 uppercase',
        className,
      )}
    >
      {icon && <Glyph name={icon} size={14} />}
      {children}
    </p>
  );
}

/**
 * Một con số lớn kèm nhãn viết hoa — dùng ở mép phải hero (lương của tin,
 * ba con số trang Lương). Vạch trái 2px là thứ gom chúng thành một cụm.
 */
export function Figure({
  label,
  value,
  size = 40,
  divided = false,
  hint,
}: {
  label: ReactNode;
  value: ReactNode;
  size?: 29 | 40 | 42;
  divided?: boolean;
  hint?: string;
}) {
  return (
    <div title={hint} className={cx(divided && 'border-l-2 border-accent-600 px-5.5')}>
      <p className="mb-1.5 text-[11px] tracking-widest text-accent-800 uppercase">{label}</p>
      <p
        className={cx(
          'font-heading leading-none font-extrabold text-accent-800',
          size === 42 ? 'text-[34px] sm:text-[42px]' : size === 40 ? 'text-[32px] sm:text-[40px]' : 'text-[29px]',
        )}
      >
        {value}
      </p>
    </div>
  );
}
