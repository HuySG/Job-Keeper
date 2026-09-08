import type { FilterOptions } from '@/api/job.api';
import { readFlag, readParam, type SearchParams } from '@/lib/query';
import { cx } from '@/components/ui/tone';
import { levelLabelWithHint } from '@/utils/format';

/**
 * Bộ lọc dùng `<form method="get">` thuần, không một dòng JavaScript.
 *
 * Mỗi bộ lọc trở thành một URL chia sẻ được và đánh dấu trang được, trang chạy
 * cả khi JavaScript chưa tải xong, và không phải viết một dòng state nào.
 *
 * Bố cục chia hai tầng có chủ đích: ô tìm kiếm đứng riêng một hàng vì nó là
 * thứ được dùng nhiều nhất; các bộ lọc thu hẹp xếp hàng dưới. Bản trước dồn cả
 * sáu ô vào một hàng nên ô tìm kiếm bị bóp lại bằng đúng một cái dropdown.
 *
 * Form không khai `action`, nên nó nộp về chính trang hiện tại. Nhưng những
 * tham số KHÔNG có ô nhập tương ứng — `sort` — sẽ bị xoá sạch khi nộp, nên
 * phải mang chúng theo bằng input ẩn.
 */
export function FilterBar({
  options,
  params,
}: {
  options: FilterOptions;
  params: SearchParams;
}) {
  const sort = readParam(params, 'sort');

  return (
    <form method="get" className="rounded-card border border-border bg-surface p-3">
      <div className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={readParam(params, 'q') ?? ''}
          placeholder="Tìm theo chức danh, kỹ năng hoặc tên công ty…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-canvas px-3.5 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Tìm
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <Select name="province" value={readParam(params, 'province')} placeholder="Mọi tỉnh/thành">
          {options.provinces.map((province) => (
            <option key={province.slug} value={province.slug}>
              {province.name} ({province.count})
            </option>
          ))}
        </Select>

        <Select name="level" value={readParam(params, 'level')} placeholder="Mọi cấp bậc">
          {options.levels.map((level) => (
            <option key={level.value} value={level.value}>
              {levelLabelWithHint(level.value)} ({level.count})
            </option>
          ))}
        </Select>

        <Select name="salaryMin" value={readParam(params, 'salaryMin')} placeholder="Mọi mức lương">
          {[10, 15, 20, 30, 50].map((millions) => (
            <option key={millions} value={String(millions * 1e6)}>
              Từ {millions} triệu
            </option>
          ))}
        </Select>

        <Select name="days" value={readParam(params, 'days')} placeholder="Mọi thời điểm">
          <option value="1">Đăng hôm nay</option>
          <option value="3">3 ngày qua</option>
          <option value="7">7 ngày qua</option>
          <option value="30">30 ngày qua</option>
        </Select>

        <Select name="source" value={readParam(params, 'source')} placeholder="Mọi nguồn">
          {options.sources.map((source) => (
            <option key={source.code} value={source.code}>
              {source.name}
            </option>
          ))}
        </Select>

        <Toggle name="salaryOnly" checked={readFlag(params, 'salaryOnly')}>
          Chỉ tin có ghi lương
        </Toggle>

        {/* Mặc định giấu tin chết. Nhưng phải mở được: khi đối chiếu với một
            tin cũ, "tin này biến đâu mất" là câu hỏi tệ hơn nhiều so với việc
            thấy nó nằm đó với nhãn "đã gỡ". */}
        <Toggle name="includeDead" checked={readFlag(params, 'includeDead')}>
          Kể cả tin đã gỡ
        </Toggle>
      </div>

      {sort && <input type="hidden" name="sort" value={sort} />}
    </form>
  );
}

/** Ô đang có giá trị được tô khác hẳn: nhìn một cái là biết đang lọc những gì. */
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
  return (
    <select
      name={name}
      aria-label={placeholder}
      defaultValue={value ?? ''}
      className={cx(
        'cursor-pointer rounded-lg border px-2.5 py-1.5 text-sm outline-none',
        value ? 'border-accent bg-accent-soft text-accent-ink' : 'border-border bg-canvas',
      )}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

function Toggle({
  name,
  checked,
  children,
}: {
  name: string;
  checked: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cx(
        'flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm',
        checked ? 'border-accent bg-accent-soft text-accent-ink' : 'border-border bg-canvas',
      )}
    >
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={checked}
        className="size-3.5 accent-accent"
      />
      {children}
    </label>
  );
}
