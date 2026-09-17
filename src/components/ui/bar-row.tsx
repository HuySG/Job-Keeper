import type { ReactNode } from 'react';

import { cx } from './tone';

/**
 * Một dòng phân bố: nhãn · rãnh · số. Dùng ở bảng lọc, trang Lương, Tổng quan.
 *
 * Màu thanh chỉ gánh ĐÚNG MỘT việc: đâu là dòng nổi bật (đang lọc, hoặc đông
 * nhất). Chiều dài đã nói độ lớn rồi — tô đậm dần theo giá trị là mã hoá hai
 * lần một thông tin và đốt mất kênh màu.
 */
const FILL = {
  accent: 'bg-accent',
  mid: 'bg-accent-400',
  soft: 'bg-accent-300',
  muted: 'bg-neutral-500',
} as const;

export function BarRow({
  label,
  count,
  ratio,
  fill = 'soft',
  strong = false,
  height = 14,
  labelWidth = 96,
  countWidth = 30,
  delay = 0,
  className,
}: {
  label: ReactNode;
  count: ReactNode;
  /** 0–1: chiều dài thanh so với thanh dài nhất. `null` = rãnh trống. */
  ratio: number | null;
  fill?: keyof typeof FILL;
  /** Nhãn và số in đậm — dòng đang được chọn hoặc dòng đông nhất. */
  strong?: boolean;
  height?: number;
  labelWidth?: number;
  countWidth?: number;
  /** Giây — để các thanh mọc so le chứ không mọc cùng lúc. */
  delay?: number;
  className?: string;
}) {
  return (
    <span className={cx('flex items-center gap-3', className)}>
      <span
        className={cx('bar-label flex-none truncate', strong && 'font-extrabold')}
        style={{ width: labelWidth }}
      >
        {label}
      </span>
      <span className="block min-w-0 flex-1 bg-neutral-200" style={{ height }}>
        {ratio !== null && ratio > 0 && (
          <span
            className={cx('bar-fill', FILL[fill])}
            style={{
              width: `${Math.max(2, Math.min(100, ratio * 100))}%`,
              height,
              animationDelay: delay ? `${delay}s` : undefined,
            }}
          />
        )}
      </span>
      <span
        className={cx('bar-count tnum flex-none text-right', strong && 'font-extrabold text-accent-700')}
        style={{ width: countWidth }}
      >
        {count}
      </span>
    </span>
  );
}
