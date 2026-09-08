import { ratio } from '@/lib/chart';

/**
 * Một tỷ lệ trên một trần - ví dụ "48% tin có ghi lương".
 *
 * Rãnh nền là **bậc nhạt của chính ramp đó** chứ không phải xám: xanh-trên-xanh
 * cho biết ngay phần chưa đạt thuộc cùng một thang, còn xám-trên-xanh đọc
 * thành "phần xám là một loại khác".
 *
 * Không dùng bảng màu trạng thái ở đây: 48% tin ghi lương không phải "cảnh
 * báo", nó chỉ là một con số. Màu trạng thái để dành cho thứ thật sự có
 * tốt/xấu.
 */
export function Meter({
  value,
  max = 1,
  label,
  caption,
}: {
  value: number;
  max?: number;
  label: string;
  caption?: string;
}) {
  const pct = ratio(value, max) * 100;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted">{label}</span>
        <span className="tnum text-sm font-medium">{pct.toFixed(0)}%</span>
      </div>
      <div
        role="meter"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="mt-1.5 h-2 w-full overflow-hidden rounded-[4px] bg-ramp-1"
      >
        <div className="h-full rounded-r-[4px] bg-ramp-4" style={{ width: pct.toFixed(2) + '%' }} />
      </div>
      {caption && <p className="mt-1 text-xs text-muted">{caption}</p>}
    </div>
  );
}
