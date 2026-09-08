import { axisScale, percent } from '@/lib/chart';
import { formatCount } from '@/utils/format';

import { cx } from '../ui/tone';

/**
 * Cột theo thời gian — một chuỗi số liệu, một màu.
 *
 * Dựng bằng CSS chứ không bằng `<svg viewBox>`: viewBox co giãn cả CHỮ theo
 * chiều rộng khung, nên trên màn hình hẹp nhãn trục nhỏ đi tới mức không đọc
 * được, còn trên màn hình rộng thì phình ra. Ở đây chỉ có hình học co giãn,
 * chữ giữ nguyên cỡ thật.
 *
 * Khung tính CẢ dải nhãn trục dưới. Cho khung một chiều cao cố định rồi nhét
 * trục vào trong là lỗi kinh điển: đồ thị vừa khít, nhãn trục thì không, và
 * thẻ mọc ra một thanh cuộn dọc tí hon.
 */

export interface ColumnDatum {
  key: string;
  /** Nhãn dưới trục. Để rỗng thì cột đó không có nhãn — xem `labelEvery`. */
  label: string;
  value: number;
  /** Chữ hiện khi rê chuột. Nói đầy đủ, vì nhãn trục đã bị thưa đi. */
  title: string;
  /** Tô nhấn đúng một cột — dùng cho "hôm nay". */
  highlight?: boolean;
}

export function ColumnChart({
  data,
  height = 140,
  labelEvery = 1,
}: {
  data: ColumnDatum[];
  height?: number;
  /** Chỉ hiện nhãn ở mỗi N cột. Nhãn dày quá thì chồng lên nhau và thành nhiễu. */
  labelEvery?: number;
}) {
  const { max, ticks } = axisScale(Math.max(...data.map((d) => d.value), 0));

  return (
    <div className="flex gap-2">
      {/* Trục dọc mang những giá trị KHÔNG được gắn nhãn trực tiếp lên cột. */}
      <div
        className="tnum relative w-8 shrink-0 text-right text-[10px] text-faint"
        style={{ height }}
        aria-hidden
      >
        {ticks.map((tick) => (
          <span
            key={tick}
            className="absolute right-0 -translate-y-1/2 leading-none"
            style={{ bottom: percent(tick, max) }}
          >
            {formatCount(tick)}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }}>
          {/* Lưới: nét MẢNH, LIỀN, lùi một bậc so với nền. Nét đứt đọc thành
              "ngưỡng" hoặc "dự báo" trong khi nó chỉ là cái lưới. */}
          {ticks.map((tick) => (
            <span
              key={tick}
              aria-hidden
              className="absolute inset-x-0 border-t border-grid"
              style={{ bottom: percent(tick, max) }}
            />
          ))}

          <div className="absolute inset-0 flex items-end gap-px">
            {data.map((item) => (
              <div key={item.key} className="flex h-full flex-1 items-end">
                <div
                  title={item.title}
                  className={cx(
                    'w-full max-w-6 rounded-t-[4px]',
                    item.highlight ? 'bg-accent' : 'bg-ramp-3',
                    // Giá trị 0 vẫn để lại một vạch mờ: "hôm đó không có tin"
                    // khác hẳn "hôm đó không có dữ liệu".
                    item.value === 0 && 'bg-border',
                  )}
                  style={{ height: item.value === 0 ? 2 : percent(item.value, max) }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-1.5 flex gap-px border-t border-axis pt-1">
          {data.map((item, index) => (
            <span
              key={item.key}
              className="tnum min-w-0 flex-1 text-center text-[10px] whitespace-nowrap text-faint"
            >
              {index % labelEvery === 0 ? item.label : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
