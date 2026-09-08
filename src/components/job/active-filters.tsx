import { isFilterKey, readParam, urlWithout, type SearchParams } from '@/lib/query';
import { levelLabel, millions } from '@/utils/format';

/**
 * Thanh "đang lọc gì" — dải chip hiện mọi bộ lọc đang bật, bấm × là gỡ từng cái.
 *
 * Đây là thứ thiếu nhất ở bản trước: người dùng lọc bốn tầng rồi nhìn màn hình
 * mà không biết mình đang lọc gì; muốn bỏ một điều kiện thì phải mò lại đúng
 * cái ô đã chọn. Một nút "Xoá bộ lọc" xoá sạch thì quá tay.
 *
 * Nhãn phải nói bằng NGÔN NGỮ NGƯỜI: chip ghi "TP. Hồ Chí Minh" chứ không ghi
 * "ho-chi-minh", "từ 20 triệu" chứ không ghi "20000000". Slug và số thô là
 * chuyện của URL, không phải chuyện của người đọc.
 */

export interface FilterLabelContext {
  provinceNames: Record<string, string>;
  sourceNames: Record<string, string>;
}

const LABELS: Record<string, (value: string, ctx: FilterLabelContext) => string> = {
  q: (value) => '“' + value + '”',
  province: (value, ctx) => ctx.provinceNames[value] ?? value,
  level: (value) => levelLabel(value),
  source: (value, ctx) => ctx.sourceNames[value] ?? value,
  salaryMin: (value) => 'từ ' + millions(Number(value)) + ' triệu',
  salaryOnly: () => 'có ghi lương',
  includeDead: () => 'kể cả tin đã gỡ',
  days: (value) => (value === '1' ? 'đăng hôm nay' : value + ' ngày qua'),
};

export function ActiveFilters({
  pathname,
  params,
  context,
}: {
  pathname: string;
  params: SearchParams;
  context: FilterLabelContext;
}) {
  const active = Object.keys(params).flatMap((key) => {
    const value = readParam(params, key);
    const label = LABELS[key];
    if (!value || !isFilterKey(key) || !label) return [];
    return [{ key, label: label(value, context) }];
  });

  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted">Đang lọc:</span>

      {active.map((item) => (
        <a
          key={item.key}
          href={urlWithout(pathname, params, item.key)}
          title={'Bỏ lọc ' + item.label}
          className="group inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft py-1 pr-2 pl-3 text-sm text-accent-ink"
        >
          {item.label}
          <span
            aria-hidden
            className="grid size-4 place-items-center rounded-full text-xs leading-none opacity-60 group-hover:bg-accent group-hover:text-white group-hover:opacity-100"
          >
            ×
          </span>
        </a>
      ))}

      {active.length > 1 && (
        <a href={pathname} className="text-sm text-muted underline underline-offset-2">
          xoá tất cả
        </a>
      )}
    </div>
  );
}
