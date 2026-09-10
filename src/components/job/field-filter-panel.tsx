import type { Facet, FieldPage } from '@/api/field.api';
import { cx } from '@/components/ui/tone';
import { PURCHASE_TYPES, PURCHASE_TYPE_UNKNOWN } from '@/constants/purchase';
import { EXPERIENCE_BANDS, FACET_NONE, SALARY_BANDS } from '@/lib/field-bands';
import { readFlag, readParams, urlWithoutValue, type SearchParams } from '@/lib/query';

/**
 * Bảng lọc của trang "Ngành của tôi" — `<form method="get">` thuần, không một
 * dòng JavaScript.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VÌ SAO ĐỔI TỪ `<select>` SANG Ô TÍCH
 *
 * `<select>` một-giá-trị ép người tìm việc phải hỏi từng câu một: "tin mua
 * hàng ngành sản xuất" rồi mới tới "tin mua hàng ngành dệt may" — trong khi
 * câu họ thật sự muốn hỏi là "sản xuất HOẶC dệt may, ở Quận 7 HOẶC Bình Tân".
 * Ba lượt tìm cho một ý định, và không lượt nào xếp chung được thứ tự.
 *
 * Nhiều ô tích cùng `name` gửi lên `?loai=a&loai=b` — đúng thứ `readParams`
 * đọc ra, vẫn không cần một dòng JavaScript nào.
 *
 * BA CÁCH CHỐNG LỌC SÓT, tất cả đều nhìn thấy được trên màn hình:
 *
 *   1. **Mỗi ô mang số tin của chính nó**, đếm trên tập đã áp mọi bộ lọc KHÁC
 *      trừ chiều của nó. Nhìn là biết tích vào còn lại bao nhiêu, nên không ai
 *      chọn một ô để rồi nhận danh sách rỗng.
 *   2. **Ô 0 tin vẫn hiện**, chỉ làm mờ. Ẩn đi thì bảng lọc tự đổi hình mỗi
 *      lần chọn và người dùng tưởng mình bấm nhầm; tệ hơn, họ không biết chiều
 *      đó có tồn tại giá trị ấy.
 *   3. **Ô "Tin không ghi" là một lựa chọn thật**, không phải luật ngầm trong
 *      code — xem `FACET_NONE`. Cộng số trong các ô của một chiều lại đúng
 *      bằng tổng số tin, nên tự kiểm được là bảng lọc không nuốt mất ai.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ `<form>` không khai `action` nộp về đúng trang hiện tại, nhưng MỌI tham số
 *    không có ô nhập tương ứng sẽ bị xoá sạch. `page` thì đáng xoá — đổi bộ lọc
 *    mà giữ trang 7 là ra danh sách rỗng khó hiểu. Còn `f` (ngành đang xem)
 *    phải mang theo bằng input ẩn.
 */
export function FieldFilterPanel({
  result,
  params,
  fields,
}: {
  result: FieldPage;
  params: SearchParams;
  fields: { slug: string; name: string }[];
}) {
  const cover = (n: number): string | undefined =>
    n >= result.inFieldTotal ? undefined : `${n}/${result.inFieldTotal} tin có ghi`;

  return (
    <form method="get" className="rounded-card border border-border bg-surface">
      {/* Chỉ khi KHÔNG có ô chọn ngành bên dưới. Có cả hai thì `f` bị gửi lên
          hai lần và `readParam` lấy cái đầu — tức ô chọn ngành mất tác dụng. */}
      {fields.length <= 1 && <input type="hidden" name="f" value={result.slug} />}

      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-tight">Lọc</h2>
        <a href={`/nganh?f=${result.slug}`} className="text-xs text-muted hover:text-text">
          Xoá hết
        </a>
      </div>

      {fields.length > 1 && (
        <Group title="Ngành">
          <select
            name="f"
            defaultValue={result.slug}
            className="w-full cursor-pointer rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-sm"
          >
            {fields.map((field) => (
              <option key={field.slug} value={field.slug}>
                {field.name}
              </option>
            ))}
          </select>
        </Group>
      )}

      <Group title="Loại mua hàng">
        <Checks name="loai" options={result.facets.purchaseTypes} params={params} />
      </Group>

      <Group title="Kinh nghiệm" note={cover(result.coverage.experience)}>
        <Checks name="kn" options={result.facets.experience} params={params} />
      </Group>

      <Group title="Lương" note={cover(result.coverage.salary)}>
        <Checks name="luong" options={result.facets.salary} params={params} />
      </Group>

      {/* Quận có thể lên tới vài chục giá trị. Cho cuộn trong khung thay vì cắt
          bớt: cắt bớt là giấu mất chính cái quận người ta đang tìm. */}
      <Group title="Quận / khu" note={cover(result.coverage.district)}>
        <div className="max-h-56 overflow-y-auto pr-1">
          <Checks name="quan" options={result.facets.districts} params={params} />
        </div>
      </Group>

      <Group title="Lịch thứ 7" note={cover(result.coverage.saturday)}>
        <Checks name="t7" options={result.facets.saturday} params={params} />
      </Group>

      <Group title="Phạm vi">
        <Toggle
          name="weak"
          checked={readFlag(params, 'weak')}
          hint="Tin chỉ có từ khoá ở phần mô tả, không có ở tiêu đề"
        >
          Kể cả tin khớp yếu
        </Toggle>
        {/* Sáp nhập 2025 gộp Bình Dương và Bà Rịa – Vũng Tàu vào TP.HCM. Đúng về
            hành chính, nhưng Thủ Đức và Bến Cát là hai thế giới đi lại khác
            nhau — để người dùng tự chọn, đừng quyết hộ. */}
        <Toggle
          name="hep"
          checked={readFlag(params, 'hep')}
          hint="Bỏ tin ở Bình Dương và Bà Rịa – Vũng Tàu, phần sáp nhập vào TP.HCM năm 2025"
        >
          Chỉ TP.HCM cũ
        </Toggle>
      </Group>

      {/* Nút nộp DÍNH ĐÁY khung lọc: danh sách ô tích dài hơn một màn hình, mà
          tích xong không thấy nút thì tưởng bộ lọc đã tự áp. */}
      <div className="sticky bottom-0 rounded-b-card border-t border-border bg-surface px-4 py-3">
        <button
          type="submit"
          className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Áp bộ lọc
        </button>
      </div>
    </form>
  );
}

/**
 * Dải chip "đang lọc gì", bấm × là gỡ TỪNG GIÁ TRỊ.
 *
 * Với bộ lọc chọn nhiều thì đây không còn là tiện ích mà là thứ bắt buộc: đang
 * lọc ba loại mua hàng, muốn bỏ đúng một loại thì trong bảng ô tích phải tìm
 * lại đúng ô đó rồi bỏ tích rồi bấm "Áp bộ lọc". Ở đây một cú bấm là xong, và
 * `urlWithoutValue` giữ nguyên hai giá trị còn lại.
 */
export function FieldActiveFilters({
  pathname,
  params,
  result,
}: {
  pathname: string;
  params: SearchParams;
  result: FieldPage;
}) {
  const chips: { key: string; value: string; text: string }[] = [];

  /**
   * `strict` = chiều có từ vựng CỐ ĐỊNH, giá trị lạ thì KHÔNG vẽ chip.
   *
   * Phải khớp với `onlyKnown` ở page.tsx, nếu không thì lệch nhau theo đúng
   * kiểu tệ nhất: liên kết cũ `?kn=3` bị tầng dữ liệu bỏ qua (đúng) nhưng chip
   * vẫn hiện một ô ghi "3" (sai) — người dùng thấy mình đang lọc một thứ mà
   * thật ra không lọc gì, và con số kết quả thì không đổi dù bấm × hay không.
   *
   * Quận là dữ liệu tự do nên không strict: không có bảng nào để đối chiếu.
   */
  const add = (key: string, table: Record<string, string>, strict: boolean): void => {
    for (const value of readParams(params, key)) {
      if (strict && !(value in table)) continue;
      chips.push({ key, value, text: table[value] ?? value });
    }
  };

  add('loai', PURCHASE_LABELS, true);
  add('kn', EXPERIENCE_LABELS, true);
  add('luong', SALARY_LABELS, true);
  add('quan', DISTRICT_LABELS, false);
  add('t7', SATURDAY_LABELS, true);

  if (readFlag(params, 'weak')) chips.push({ key: 'weak', value: '1', text: 'Kể cả tin khớp yếu' });
  if (readFlag(params, 'hep')) chips.push({ key: 'hep', value: '1', text: 'Chỉ TP.HCM cũ' });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted">Đang lọc:</span>

      {chips.map((chip) => (
        <a
          key={`${chip.key}:${chip.value}`}
          href={urlWithoutValue(pathname, params, chip.key, chip.value)}
          title={`Bỏ lọc "${chip.text}"`}
          className="group inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft py-0.5 pr-1.5 pl-2.5 text-xs text-accent-ink"
        >
          {chip.text}
          <span
            aria-hidden
            className="grid size-3.5 place-items-center rounded-full leading-none opacity-60 group-hover:bg-accent group-hover:text-white group-hover:opacity-100"
          >
            ×
          </span>
        </a>
      ))}

      {chips.length > 1 && (
        <a
          href={`${pathname}?f=${result.slug}`}
          className="ml-1 text-xs text-muted underline underline-offset-2"
        >
          xoá tất cả
        </a>
      )}
    </div>
  );
}

// ─── Bảng tra nhãn ───────────────────────────────────────────────────────────
//
// Tra từ bảng CỐ ĐỊNH, không tra từ `result.facets`. Facet được đếm trên tập đã
// lọc nên nó rỗng đi được — và đúng lúc rỗng thì chip lại tụt xuống hiện slug
// trần (`san-xuat`) cho người dùng đọc. Nhãn của một giá trị không được phụ
// thuộc vào chuyện còn tin nào mang giá trị đó hay không.

const PURCHASE_LABELS: Record<string, string> = Object.fromEntries(
  [...PURCHASE_TYPES, PURCHASE_TYPE_UNKNOWN].map((type) => [type.slug, type.label]),
);

const EXPERIENCE_LABELS: Record<string, string> = Object.fromEntries(
  EXPERIENCE_BANDS.map((band) => [band.value, band.label]),
);

const SALARY_LABELS: Record<string, string> = Object.fromEntries(
  SALARY_BANDS.map((band) => [band.value, band.label]),
);

const SATURDAY_LABELS: Record<string, string> = {
  NONE: 'Nghỉ thứ 7',
  HALF_DAY: 'Sáng thứ 7',
  ALTERNATE: 'Thứ 7 luân phiên',
  FULL: 'Làm cả thứ 7',
  [FACET_NONE]: 'Không ghi lịch thứ 7',
};

/** Quận lưu thẳng tên đọc được, chỉ ô "không ghi" cần dịch. */
const DISTRICT_LABELS: Record<string, string> = { [FACET_NONE]: 'Không ghi quận' };

// ─── Mảnh giao diện ──────────────────────────────────────────────────────────

function Group({
  title,
  note,
  children,
}: {
  title: string;
  /** Dòng phụ — dùng cho ĐỘ PHỦ, không dùng cho lời giải thích dài. */
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border-b border-border px-4 py-3">
      <legend className="sr-only">{title}</legend>
      <p className="mb-2 text-xs font-medium text-muted">
        {title}
        {note && <span className="ml-1.5 font-normal text-faint">{note}</span>}
      </p>
      <div className="space-y-1">{children}</div>
    </fieldset>
  );
}

function Checks({
  name,
  options,
  params,
}: {
  name: string;
  options: Facet[];
  params: SearchParams;
}) {
  const selected = new Set(readParams(params, name));
  if (options.length === 0) return <p className="text-xs text-faint">Chưa có dữ liệu</p>;

  return (
    <>
      {options.map((option) => {
        const checked = selected.has(option.value);
        // Ô rỗng mà CHƯA chọn thì làm mờ — vẫn tích được, nhưng nhìn là biết
        // tích vào sẽ ra danh sách trống. Ô rỗng mà ĐANG chọn thì để sáng
        // bình thường, vì nó là lý do danh sách đang trống, phải thấy rõ.
        const empty = option.count === 0 && !checked;
        return (
          <label
            key={option.value}
            title={option.hint}
            className={cx(
              'flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-inset',
              empty && 'opacity-45',
            )}
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={checked}
              className="size-3.5 shrink-0 accent-accent"
            />
            <span className={cx('min-w-0 flex-1 truncate', checked && 'font-medium text-accent-ink')}>
              {option.label}
            </span>
            <span className="tnum shrink-0 text-xs text-muted">{option.count}</span>
          </label>
        );
      })}
    </>
  );
}

function Toggle({
  name,
  checked,
  hint,
  children,
}: {
  name: string;
  checked: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      title={hint}
      className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-inset"
    >
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={checked}
        className="size-3.5 shrink-0 accent-accent"
      />
      <span className={cx(checked && 'font-medium text-accent-ink')}>{children}</span>
    </label>
  );
}
