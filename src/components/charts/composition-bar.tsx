import type { Tone } from '@/utils/format';
import { formatCount, formatPercent } from '@/utils/format';
import { ratio } from '@/lib/chart';

import { TONE, cx } from '../ui/tone';

/**
 * Một thanh chia phần - dùng cho cơ cấu **trạng thái** của kho tin.
 *
 * Dùng bảng màu trạng thái chứ không dùng bảng màu phân loại: OPEN / STALE /
 * EXPIRED / CLOSED không phải bốn "hạng mục ngang hàng", chúng là bốn mức lành
 * mạnh khác nhau. Lấy màu series 1-4 cho chúng là nói dối bằng màu.
 *
 * Hai đoạn cạnh nhau tách nhau bằng **khe hở màu nền 2px**, không phải bằng
 * đường viền. Viền là mực không mang dữ liệu; khe hở làm đúng việc đó mà không
 * thêm gì lên màn hình.
 *
 * Chú giải luôn có mặt và luôn kèm số - thanh chỉ để thấy tỷ lệ trong nháy
 * mắt, còn giá trị thì đọc được thành chữ, không bị khoá sau con trỏ chuột.
 */

export interface Segment {
  key: string;
  label: string;
  value: number;
  tone: Tone;
  hint?: string;
}

export function CompositionBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[4px] bg-inset">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <span
              key={segment.key}
              title={
                segment.label +
                ': ' +
                formatCount(segment.value) +
                ' tin (' +
                formatPercent(segment.value, total) +
                ')'
              }
              className={cx(
                'h-full first:rounded-l-[4px] last:rounded-r-[4px]',
                TONE[segment.tone].fill,
              )}
              style={{ width: (ratio(segment.value, total) * 100).toFixed(2) + '%' }}
            />
          ))}
      </div>

      <ul className="mt-3 grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-baseline gap-2 text-xs" title={segment.hint}>
            <span
              aria-hidden
              className={cx('size-2 shrink-0 translate-y-px rounded-full', TONE[segment.tone].dot)}
            />
            <span className="min-w-0 flex-1 truncate text-muted">{segment.label}</span>
            <span className="tnum shrink-0 font-medium">{formatCount(segment.value)}</span>
            <span className="tnum w-9 shrink-0 text-right text-muted">
              {formatPercent(segment.value, total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
