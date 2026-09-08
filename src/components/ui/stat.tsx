import type { ReactNode } from 'react';

import type { Tone } from '@/utils/format';

import { TONE, cx } from './tone';

/**
 * Ô chỉ số — dạng đúng cho MỘT con số hiện tại.
 *
 * Một con số thì không vẽ biểu đồ một cột. Hợp đồng của ô này cố định:
 *
 *   nhãn (viết thường, không có dấu hai chấm cuối)
 *   giá trị (đậm, cỡ lớn)
 *   phần phụ (đơn vị, mẫu đã tính, hoặc so với kỳ trước)
 *
 * Cố ý KHÔNG dùng `tabular-nums` cho giá trị: chữ số rộng bằng nhau làm số
 * "121" trông rời rạc ở cỡ lớn. Số xếp thành cột trong bảng thì mới cần.
 */

export function Stat({
  label,
  value,
  sub,
  tone,
  hint,
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Tô màu giá trị. Chỉ dùng khi con số TỰ NÓ mang trạng thái tốt/xấu. */
  tone?: Tone;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-xs text-muted">{label}</p>
      <p className={cx('mt-1 text-2xl leading-none font-semibold', tone && TONE[tone].text)}>
        {value}
      </p>
      {sub && <div className="mt-1.5 text-xs text-muted">{sub}</div>}
    </>
  );

  const shell =
    'rounded-card border border-border bg-surface px-4 py-3.5 transition-colors';

  if (href) {
    return (
      <a href={href} title={hint} className={cx(shell, 'block hover:border-border-strong')}>
        {body}
      </a>
    );
  }
  return (
    <div title={hint} className={shell}>
      {body}
    </div>
  );
}

/**
 * Con số MỞ ĐẦU của cả bảng điều khiển — **đúng một cái cho mỗi màn hình**.
 *
 * Có hai con số cỡ hero là không còn con số nào là hero nữa.
 */
export function HeroStat({
  label,
  value,
  unit,
  sub,
  aside,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-5xl leading-none font-semibold tracking-tight">{value}</span>
          {unit && <span className="text-sm text-muted">{unit}</span>}
        </p>
        {sub && <div className="mt-2 text-sm text-muted">{sub}</div>}
      </div>
      {aside && <div className="text-right">{aside}</div>}
    </div>
  );
}

/** Dãy chỉ số. Số cột theo `min-width` chứ không theo mốc màn hình cố định. */
export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
      {children}
    </div>
  );
}
