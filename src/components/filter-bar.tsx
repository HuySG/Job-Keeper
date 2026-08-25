import { levelLabelWithHint } from '@/utils/format';

interface FilterBarProps {
  options: {
    provinces: { name: string; slug: string; count: number }[];
    levels: { value: string; count: number }[];
    sources: { code: string; name: string }[];
  };
  current: Record<string, string | undefined>;
}

/**
 * Bộ lọc dùng `<form method="get">` thuần, không JavaScript.
 *
 * Mỗi bộ lọc trở thành một URL chia sẻ được và đánh dấu trang được, trang chạy
 * cả khi JS chưa tải xong, và không phải viết một dòng state nào.
 *
 * Bố cục chia hai tầng có chủ đích: ô tìm kiếm đứng riêng một hàng vì nó là
 * thứ được dùng nhiều nhất; các bộ lọc thu hẹp xếp hàng dưới. Bản trước dồn cả
 * sáu ô vào một hàng nên ô tìm kiếm bị bóp lại bằng cái dropdown.
 */
export function FilterBar({ options, current }: FilterBarProps) {
  return (
    <form
      method="get"
      className="mb-4 rounded-xl border border-border bg-surface p-4"
    >
      <div className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={current['q'] ?? ''}
          placeholder="Tìm theo chức danh, kỹ năng hoặc tên công ty…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white"
        >
          Tìm
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Select name="province" value={current['province']} placeholder="Mọi tỉnh/thành">
          {options.provinces.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name} ({p.count})
            </option>
          ))}
        </Select>

        <Select name="level" value={current['level']} placeholder="Mọi cấp bậc">
          {options.levels.map((l) => (
            <option key={l.value} value={l.value}>
              {levelLabelWithHint(l.value)} ({l.count})
            </option>
          ))}
        </Select>

        <Select name="salaryMin" value={current['salaryMin']} placeholder="Mọi mức lương">
          {[10, 15, 20, 30, 50].map((tr) => (
            <option key={tr} value={String(tr * 1e6)}>
              Từ {tr} triệu
            </option>
          ))}
        </Select>

        <Select name="days" value={current['days']} placeholder="Mọi thời điểm">
          <option value="1">Đăng hôm nay</option>
          <option value="3">3 ngày qua</option>
          <option value="7">7 ngày qua</option>
          <option value="30">30 ngày qua</option>
        </Select>

        <Select name="source" value={current['source']} placeholder="Mọi nguồn">
          {options.sources.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </Select>

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm">
          <input
            type="checkbox"
            name="salaryOnly"
            value="1"
            defaultChecked={current['salaryOnly'] === '1'}
            className="size-4 accent-accent"
          />
          Chỉ tin có ghi lương
        </label>
      </div>

      {/* Giữ kiểu sắp xếp khi bấm Tìm, nếu không mỗi lần lọc lại nhảy về mặc định */}
      {current['sort'] && <input type="hidden" name="sort" value={current['sort']} />}
    </form>
  );
}

function Select({
  name,
  value,
  placeholder,
  children,
}: {
  name: string;
  value?: string;
  placeholder: string;
  children: React.ReactNode;
}) {
  const isActive = Boolean(value);
  return (
    <select
      name={name}
      defaultValue={value ?? ''}
      className={`cursor-pointer rounded-lg border px-3 py-2 text-sm outline-none ${
        // Ô đang có giá trị được tô khác hẳn: nhìn một cái là biết đang lọc gì
        isActive
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-border bg-bg'
      }`}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}
