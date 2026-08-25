import { levelLabel, sourceLabel } from '@/utils/format';

/**
 * Thanh "đang lọc gì" — dải chip hiện mọi bộ lọc đang bật, bấm X là gỡ từng cái.
 *
 * Đây là thứ thiếu nhất ở bản trước: người dùng lọc bốn tầng rồi nhìn màn hình
 * mà không biết mình đang lọc gì, muốn bỏ một điều kiện thì phải mò lại đúng
 * cái dropdown đã chọn. Nút "Xoá bộ lọc" xoá sạch thì quá tay.
 */

export interface ActiveFiltersProps {
  params: Record<string, string | string[] | undefined>;
  provinceNames: Record<string, string>;
}

const LABELS: Record<string, (value: string, ctx: ActiveFiltersProps) => string> = {
  q: (value) => `“${value}”`,
  province: (value, ctx) => ctx.provinceNames[value] ?? value,
  level: (value) => levelLabel(value),
  source: (value) => sourceLabel(value),
  salaryMin: (value) => `từ ${Number(value) / 1e6} triệu`,
  salaryOnly: () => 'có ghi lương',
  days: (value) => (value === '1' ? 'đăng hôm nay' : `${value} ngày qua`),
};

/** `sort` và `page` không phải bộ lọc — đừng hiện chúng thành chip. */
const NOT_A_FILTER = new Set(['sort', 'page']);

export function ActiveFilters(props: ActiveFiltersProps) {
  const { params } = props;

  const active = Object.entries(params)
    .map(([key, raw]) => {
      const value = Array.isArray(raw) ? raw[0] : raw;
      if (!value || NOT_A_FILTER.has(key) || !LABELS[key]) return null;
      return { key, value, label: LABELS[key]!(value, props) };
    })
    .filter((item): item is { key: string; value: string; label: string } => item !== null);

  if (active.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted">Đang lọc:</span>

      {active.map((item) => (
        <a
          key={item.key}
          href={urlWithout(params, item.key)}
          title={`Bỏ lọc ${item.label}`}
          className="group inline-flex items-center gap-1.5 rounded-full border border-accent/35 bg-accent/10 py-1 pl-3 pr-2 text-sm text-accent"
        >
          {item.label}
          <span className="grid size-4 place-items-center rounded-full text-xs leading-none opacity-60 group-hover:bg-accent group-hover:text-white group-hover:opacity-100">
            ×
          </span>
        </a>
      ))}

      {active.length > 1 && (
        <a href="/" className="text-sm text-muted underline underline-offset-2">
          xoá tất cả
        </a>
      )}
    </div>
  );
}

/** URL hiện tại nhưng bỏ đi một tham số. Luôn reset về trang 1. */
function urlWithout(
  params: Record<string, string | string[] | undefined>,
  removeKey: string,
): string {
  const query = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (key === removeKey || key === 'page' || raw === undefined) continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) query.set(key, value);
  }
  const search = query.toString();
  return search ? `/?${search}` : '/';
}
