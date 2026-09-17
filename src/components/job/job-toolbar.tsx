import { SORT_OPTIONS, type FilterOptions, type SortKey } from '@/api/job.api';
import { Glyph } from '@/components/ui/glyph';
import { buildUrl, readFlag, readParam, type SearchParams } from '@/lib/query';
import { levelLabel, levelLabelWithHint, millions } from '@/utils/format';

/**
 * Thanh công cụ của Kho tin — ô tìm, chip đang lọc, "+ lọc thêm", sắp xếp.
 *
 * Toàn bộ là liên kết và `<form method="get">`, không một dòng JavaScript:
 * mỗi trạng thái lọc là một URL chia sẻ được, đánh dấu trang được.
 *
 * Chip "Còn hiệu lực ✕" luôn có mặt khi đang giấu tin chết. Đó là bộ lọc MẶC
 * ĐỊNH, và chính vì mặc định nên nó dễ bị quên nhất — gỡ nó là cách duy nhất
 * để đối chiếu một tin cũ đã biến mất khỏi danh sách.
 */
export function JobToolbar({
  pathname,
  params,
  options,
  sort,
}: {
  pathname: string;
  params: SearchParams;
  options: FilterOptions;
  sort: SortKey;
}) {
  const provinceName = new Map(options.provinces.map((p) => [p.slug, p.name]));
  const sourceName = new Map(options.sources.map((s) => [s.code, s.name]));
  const includeDead = readFlag(params, 'includeDead');

  const chips: { key: string; text: string; href: string }[] = [];
  const chip = (key: string, text: (value: string) => string) => {
    const value = readParam(params, key);
    if (value) chips.push({ key, text: text(value), href: buildUrl(pathname, params, { [key]: undefined }) });
  };
  chip('province', (v) => provinceName.get(v) ?? v);
  chip('level', (v) => levelLabel(v));
  chip('source', (v) => sourceName.get(v) ?? v);
  chip('salaryMin', (v) => `từ ${millions(Number(v))} triệu`);
  chip('days', (v) => (v === '1' ? 'đăng hôm nay' : `đăng trong ${v} ngày`));
  chip('salaryOnly', () => 'có ghi lương');
  chips.push(
    includeDead
      ? { key: 'includeDead', text: 'Kể cả tin đã gỡ', href: buildUrl(pathname, params, { includeDead: undefined }) }
      : { key: 'alive', text: 'Còn hiệu lực', href: buildUrl(pathname, params, { includeDead: '1' }) },
  );

  // Form không khai `action` nộp về chính trang này, nhưng xoá sạch mọi tham
  // số không có ô nhập. Hai form ở đây mỗi form giữ lại phần của form kia.
  const keep = (names: string[]) =>
    names.flatMap((name) => {
      const value = readParam(params, name);
      return value ? [<input key={name} type="hidden" name={name} value={value} />] : [];
    });

  return (
    <div className="relative flex flex-wrap items-center gap-2.5 border-b-2 border-divider bg-bg px-4 py-3.5 sm:px-6">
      <form method="get" role="search" className="relative flex-[1_1_280px] sm:max-w-105">
        {keep(['province', 'level', 'source', 'salaryMin', 'days', 'salaryOnly', 'includeDead', 'sort'])}
        <label>
          <span className="sr-only">Tìm trong kho tin</span>
          <Glyph
            name="search"
            size={16}
            stroke="var(--color-neutral-600)"
            className="absolute top-1/2 left-3 -translate-y-1/2"
          />
          <input
            type="search"
            name="q"
            defaultValue={readParam(params, 'q') ?? ''}
            placeholder="Chức danh, công ty, từ khoá…"
            className="input h-10.5 bg-neutral-100 pl-9"
          />
        </label>
      </form>

      {chips.map((item) => (
        <a
          key={item.key}
          href={item.href}
          title={item.key === 'alive' ? 'Đang giấu tin hết hạn và tin đã gỡ — bấm để hiện cả chúng' : `Bỏ lọc "${item.text}"`}
          className="tag tag-ink gap-1.5 px-3 py-2 hover:bg-accent-800"
        >
          {item.text}
          <span aria-hidden className="opacity-70">
            ✕
          </span>
        </a>
      ))}

      <details className="group">
        <summary className="tag tag-outline cursor-pointer list-none px-3 py-2 [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">+ lọc thêm</span>
          <span className="hidden group-open:inline">Đóng bộ lọc</span>
        </summary>

        <form
          method="get"
          className="absolute inset-x-0 top-full z-10 flex flex-wrap items-end gap-3 border-b-2 border-divider bg-bg px-4 py-4 shadow-md sm:px-6"
        >
          {keep(['q', 'sort'])}
          <Select name="province" label="Tỉnh / thành" value={readParam(params, 'province')} placeholder="Mọi nơi">
            {options.provinces.map((province) => (
              <option key={province.slug} value={province.slug}>
                {province.name} ({province.count})
              </option>
            ))}
          </Select>
          <Select name="level" label="Cấp bậc" value={readParam(params, 'level')} placeholder="Mọi cấp">
            {options.levels.map((level) => (
              <option key={level.value} value={level.value}>
                {levelLabelWithHint(level.value)} ({level.count})
              </option>
            ))}
          </Select>
          <Select name="salaryMin" label="Lương" value={readParam(params, 'salaryMin')} placeholder="Mọi mức">
            {[10, 15, 20, 30, 50].map((m) => (
              <option key={m} value={String(m * 1e6)}>
                Từ {m} triệu
              </option>
            ))}
          </Select>
          <Select name="days" label="Đăng trong" value={readParam(params, 'days')} placeholder="Mọi lúc">
            <option value="1">Hôm nay</option>
            <option value="3">3 ngày</option>
            <option value="7">7 ngày</option>
            <option value="30">30 ngày</option>
          </Select>
          <Select name="source" label="Sàn nguồn" value={readParam(params, 'source')} placeholder="Mọi sàn">
            {options.sources.map((source) => (
              <option key={source.code} value={source.code}>
                {source.name}
              </option>
            ))}
          </Select>
          <div className="flex flex-col gap-1.5 text-sm">
            <Check name="salaryOnly" checked={readFlag(params, 'salaryOnly')}>
              Chỉ tin có ghi lương
            </Check>
            {/* Mặc định giấu tin chết. Nhưng phải mở được: "tin này biến đâu
                mất" là câu hỏi tệ hơn nhiều so với thấy nó nằm đó với nhãn "đã gỡ". */}
            <Check name="includeDead" checked={includeDead}>
              Kể cả tin đã gỡ
            </Check>
          </div>
          <button type="submit" className="btn btn-primary h-10 gap-2 px-4">
            <Glyph name="check" size={15} strokeWidth={1.9} />
            Áp bộ lọc
          </button>
        </form>
      </details>

      <nav aria-label="Sắp xếp" className="seg sm:ml-auto">
        {SORT_OPTIONS.map((option) => (
          <a
            key={option.value}
            href={buildUrl(pathname, params, { sort: option.value === 'moi' ? undefined : option.value })}
            aria-current={option.value === sort ? 'true' : undefined}
            className="seg-opt"
          >
            {option.label}
          </a>
        ))}
      </nav>
    </div>
  );
}

function Select({
  name,
  label,
  value,
  placeholder,
  children,
}: {
  name: string;
  label: string;
  value?: string;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-40 flex-col gap-1 text-xs text-neutral-700">
      {label}
      <select
        name={name}
        defaultValue={value ?? ''}
        className={`input h-10 cursor-pointer ${value ? 'border-accent bg-accent-100 text-accent-800' : 'bg-neutral-100'}`}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
    </label>
  );
}

function Check({ name, checked, children }: { name: string; checked: boolean; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" name={name} value="1" defaultChecked={checked} className="size-3.5 accent-accent" />
      {children}
    </label>
  );
}
