import type { Facet, FieldPage } from '@/api/field.api';
import { cx } from '@/components/ui/tone';
import { readFlag, readParam, type SearchParams } from '@/lib/query';

/**
 * Bộ lọc của trang "Ngành của tôi" — `<form method="get">` thuần, không một
 * dòng JavaScript, giống hệt bộ lọc của Kho tin.
 *
 * Mỗi lựa chọn thành một URL chia sẻ được và đánh dấu trang được, trang chạy cả
 * khi JavaScript chưa tải xong, và không phải viết một dòng state nào.
 *
 * **Số tin nằm ngay trong tên lựa chọn** — "Sản xuất & nhà máy (68)". Đây không
 * phải trang trí: nó cho biết chọn xong còn lại bao nhiêu, nên không ai chọn
 * một bộ lọc để rồi nhận danh sách rỗng. Nó cũng chính là bảng liệt kê "ngành
 * mua hàng có những loại nào" — đọc được ngay tại chỗ chọn.
 *
 * ⚠️ Bẫy của `<form>` không khai `action`: nó nộp về đúng trang hiện tại, nhưng
 *    MỌI tham số không có ô nhập tương ứng sẽ bị xoá sạch. Ở đây là `f` (ngành
 *    đang xem) và `page`. `page` thì đáng xoá — đổi bộ lọc mà giữ trang 7 là ra
 *    một danh sách rỗng khó hiểu. Còn `f` phải mang theo bằng input ẩn.
 */
export function FieldFilterBar({
  result,
  params,
  fields,
}: {
  result: FieldPage;
  params: SearchParams;
  fields: { slug: string; name: string }[];
}) {
  // Mẫu số PHẢI là `inFieldTotal` (tin thuộc ngành trước khi lọc), không phải
  // `total` (sau khi lọc) — `coverage` được đếm trên tập trước. Ghép nhầm thì
  // ra nhãn "117/3 tin có".
  const cover = (n: number): string => `${n}/${result.inFieldTotal} tin có`;

  return (
    <form method="get" className="rounded-card border border-border bg-surface p-3">
      <div className="flex flex-wrap gap-2">
        {fields.length > 1 && (
          <Select name="f" value={result.slug} placeholder="Chọn ngành" required>
            {fields.map((field) => (
              <option key={field.slug} value={field.slug}>
                {field.name}
              </option>
            ))}
          </Select>
        )}

        <Select
          name="loai"
          value={readParam(params, 'loai')}
          placeholder="Mọi loại mua hàng"
          options={result.facets.purchaseTypes}
        />

        <Select
          name="kn"
          value={readParam(params, 'kn')}
          placeholder={`Mọi mức kinh nghiệm · ${cover(result.coverage.experience)}`}
          options={result.facets.experience}
          available={result.coverage.experience > 0}
        />

        <Select
          name="quan"
          value={readParam(params, 'quan')}
          placeholder={`Mọi quận/khu · ${cover(result.coverage.district)}`}
          options={result.facets.districts}
          available={result.coverage.district > 0}
        />

        {/* Cột này gần như rỗng và người dùng phải biết TRƯỚC khi chọn, chứ
            không phải sau khi nhận danh sách trống — nên số tin có dữ liệu nằm
            ngay trong tên lựa chọn mặc định. */}
        <Select
          name="t7"
          value={readParam(params, 't7')}
          placeholder={`Không xét thứ 7 · ${cover(result.coverage.saturday)}`}
          options={result.facets.saturday}
          available={result.coverage.saturday > 0}
        />

        <Select
          name="luong"
          value={readParam(params, 'luong')}
          placeholder={`Mọi mức lương · ${cover(result.coverage.salary)} ghi số`}
        >
          {SALARY_STEPS.map((step) => (
            <option key={step.value} value={step.value}>
              {step.label}
            </option>
          ))}
        </Select>

        <Toggle name="weak" checked={readFlag(params, 'weak')}>
          Kể cả tin khớp yếu
        </Toggle>

        {/* Sáp nhập 2025 gộp Bình Dương và Bà Rịa – Vũng Tàu vào TP.HCM. Đúng
            về hành chính, nhưng Thủ Đức và Bến Cát là hai thế giới đi lại khác
            nhau — để người dùng tự chọn, đừng quyết hộ. */}
        <Toggle name="hep" checked={readFlag(params, 'hep')}>
          Chỉ TP.HCM cũ
        </Toggle>

        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          Lọc
        </button>

        <a
          href={fields.length > 1 ? `?f=${result.slug}` : '?'}
          className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:text-text"
        >
          Xoá lọc
        </a>
      </div>
    </form>
  );
}

/** Mốc lương, VND/tháng. Không đếm trước được nên cố ý không mang số tin. */
const SALARY_STEPS: readonly { value: string; label: string }[] = [
  { value: '15000000', label: 'Từ 15 triệu' },
  { value: '25000000', label: 'Từ 25 triệu' },
  { value: '40000000', label: 'Từ 40 triệu' },
];

/**
 * Ô đang có giá trị được tô khác hẳn: nhìn một cái là biết đang lọc những gì.
 *
 * Nhận `options` (dạng facet, có sẵn số tin) hoặc `children` (tự dựng option) —
 * hai đường vì có chiều đếm trước được, có chiều thì không.
 */
function Select({
  name,
  value,
  placeholder,
  options,
  children,
  required,
  available = true,
}: {
  name: string;
  value?: string;
  placeholder: string;
  options?: Facet[];
  children?: React.ReactNode;
  required?: boolean;
  /**
   * Chiều này có dữ liệu trong kho hay không — tính trên tập TRƯỚC khi lọc.
   *
   * Cố ý KHÔNG dựa vào `options.length`: danh sách lựa chọn co lại theo các bộ
   * lọc khác, nên ô lọc sẽ tự biến mất rồi hiện lại tuỳ lần chọn trước đó. Một
   * thanh lọc mà số ô thay đổi giữa chừng thì người dùng tưởng mình bấm nhầm.
   * Neo vào độ phủ thì vị trí các ô đứng yên.
   */
  available?: boolean;
}) {
  if (!available && !value) return null;

  return (
    <select
      name={name}
      aria-label={placeholder}
      defaultValue={value ?? ''}
      className={cx(
        'max-w-full cursor-pointer rounded-lg border px-2.5 py-1.5 text-sm outline-none',
        value ? 'border-accent bg-accent-soft text-accent-ink' : 'border-border bg-canvas',
      )}
    >
      {!required && <option value="">{placeholder}</option>}
      {options
        ? options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
              {option.count > 0 ? ` (${option.count})` : ''}
            </option>
          ))
        : children}
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
