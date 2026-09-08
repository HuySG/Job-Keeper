import { percent } from '@/lib/chart';
import { formatCount } from '@/utils/format';

import { cx } from '../ui/tone';

/**
 * Danh sách thanh ngang — dạng đúng khi việc của người đọc là **so độ lớn**
 * giữa các hạng mục có tên dài (tỉnh/thành, nguồn, cấp bậc).
 *
 * Ba quyết định cố ý:
 *
 * 1. **Mọi thanh CÙNG MỘT MÀU.** Tô đậm dần theo giá trị là mã hoá hai lần
 *    cùng một thông tin mà chiều dài thanh đã nói rồi — và đốt mất kênh màu,
 *    kênh duy nhất còn trống để đánh dấu "hạng mục anh đang lọc".
 * 2. **Số nằm ngay cuối thanh.** Không bắt người đọc dóng mắt xuống trục.
 * 3. **Ngang chứ không dọc.** Tên tỉnh/thành tiếng Việt dài; xoay nghiêng nhãn
 *    45° là kiểu chữ khó đọc nhất trong mọi biểu đồ.
 */

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** Dòng phụ bên phải — thường là một tỷ lệ, ví dụ "48% ghi lương". */
  note?: string;
  href?: string;
  /** Đánh dấu hạng mục đang được lọc. Đây là việc mà kênh màu để dành cho. */
  highlight?: boolean;
}

export function BarList({
  data,
  max,
  unit = 'tin',
}: {
  data: BarDatum[];
  /** Trần thang. Truyền vào khi cần nhiều biểu đồ dùng CHUNG một thang. */
  max?: number;
  unit?: string;
}) {
  const ceiling = max ?? Math.max(1, ...data.map((d) => d.value));

  return (
    <ul className="space-y-2.5">
      {data.map((item) => {
        const row = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className={cx('truncate text-sm', item.highlight && 'font-medium')}>
                {item.label}
              </span>
              <span className="tnum shrink-0 text-sm text-muted">
                {item.note ? (
                  <>
                    <span className="text-text">{formatCount(item.value)}</span>
                    <span className="mx-1 opacity-40">·</span>
                    {item.note}
                  </>
                ) : (
                  <span className="text-text">{formatCount(item.value)}</span>
                )}
              </span>
            </div>
            {/* Rãnh nền là một bậc nhạt của chính ramp đó, để đọc được "còn
                bao xa nữa mới tới mức cao nhất" trên suốt chiều dài thanh. */}
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-[4px] bg-inset">
              <div
                className={cx(
                  'h-full rounded-r-[4px]',
                  item.highlight ? 'bg-accent' : 'bg-ramp-4',
                )}
                style={{ width: percent(item.value, ceiling) }}
                title={`${item.label}: ${formatCount(item.value)} ${unit}`}
              />
            </div>
          </>
        );

        return (
          <li key={item.key}>
            {item.href ? (
              <a href={item.href} className="block rounded-md hover:opacity-85">
                {row}
              </a>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}
