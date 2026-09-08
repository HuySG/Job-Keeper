import { bandPosition, ratio } from '@/lib/chart';
import { millions } from '@/utils/format';

import { cx } from '../ui/tone';

/**
 * Thanh khoảng p25 - trung vị - p75. Xương sống của phần lương.
 *
 * Vì sao không vẽ cột "lương trung bình": trung bình lương bị một tin
 * "5-200 triệu" của môi giới kéo lệch hẳn, và người đọc không có cách nào biết
 * điều đó đã xảy ra. Khoảng tứ phân vị nói được thứ trung bình không nói được
 * — **mức phổ biến, và độ tản mát quanh nó**. Hai nhóm cùng trung vị 20 triệu
 * mà một nhóm trải 18-22 còn nhóm kia trải 8-60 là hai thị trường khác nhau.
 *
 * Mọi hàng dùng CHUNG một thang. Mỗi hàng tự co theo dữ liệu của nó thì hàng
 * nào cũng dài bằng nhau và biểu đồ không còn nói gì.
 */

export interface RangeDatum {
  key: string;
  label: string;
  p25: number;
  median: number;
  p75: number;
  /** Số tin CÓ ghi lương đã dùng để tính. Mẫu nhỏ thì phải nói ra. */
  sample: number;
  href?: string;
}

/**
 * Dưới ngưỡng này thì dải được vẽ NHẠT hơn: mẫu quá mỏng để đọc thành kết
 * luận. Khác với `MIN_BAND_SAMPLE` bên `stats.api.ts` — cái đó quyết định
 * nhóm có được VẼ RA hay không, còn cái này chỉ quyết định vẽ ĐẬM hay NHẠT.
 */
export const THIN_SAMPLE = 8;

export function RangeBar({ data, floor, ceil }: { data: RangeDatum[]; floor: number; ceil: number }) {
  const axis = [floor, floor + (ceil - floor) / 2, ceil];

  return (
    <div>
      <ul className="space-y-3">
        {data.map((item) => {
          const band = bandPosition(item.p25, item.p75, floor, ceil);
          const thin = item.sample < THIN_SAMPLE;
          const medianLeft = (ratio(item.median - floor, ceil - floor) * 100).toFixed(2);
          const tip =
            item.label +
            ': nửa số tin nằm trong ' +
            millions(item.p25) +
            '-' +
            millions(item.p75) +
            ' triệu, trung vị ' +
            millions(item.median) +
            ' triệu (' +
            item.sample +
            ' tin có ghi lương)';

          return (
            <li key={item.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">
                  {item.href ? (
                    <a href={item.href} className="hover:text-accent-ink hover:underline">
                      {item.label}
                    </a>
                  ) : (
                    item.label
                  )}
                </span>
                <span className="tnum shrink-0 text-muted">
                  <span className="font-medium text-text">{millions(item.median)} tr</span>
                  <span className="mx-1 opacity-40">·</span>
                  <span title={item.sample + ' tin có ghi lương'}>n={item.sample}</span>
                </span>
              </div>

              <div className="relative mt-1.5 h-4">
                <span aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-grid" />

                {/* Mẫu mỏng vẫn VẼ, nhưng vẽ nhạt và ghi n= bên cạnh - giấu đi
                    thì người đọc tưởng nhóm đó không có dữ liệu. */}
                <span
                  title={tip}
                  className={cx(
                    'absolute top-1/2 h-2.5 -translate-y-1/2 rounded-[4px]',
                    thin ? 'bg-ramp-2' : 'bg-ramp-3',
                  )}
                  style={band}
                />

                {/* Vạch trung vị: viền theo màu NỀN để nó luôn tách khỏi dải
                    kể cả khi dải hẹp - không phải vẽ thêm đường kẻ quanh mảng. */}
                <span
                  aria-hidden
                  className="absolute top-1/2 h-3.5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-[1px] bg-surface ring-2 ring-ramp-6"
                  style={{ left: medianLeft + '%' }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="tnum mt-3 flex justify-between border-t border-axis pt-1 text-[10px] text-faint">
        {axis.map((value) => (
          <span key={value}>{millions(value)} tr</span>
        ))}
      </div>

      <p className="mt-2 text-xs text-muted">
        Dải = nửa số tin ở giữa (p25-p75). Vạch đậm = trung vị. n = số tin có ghi lương.
      </p>
    </div>
  );
}
