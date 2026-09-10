import type { ReactNode } from 'react';

import type { Facet, FieldPage } from '@/api/field.api';
import { Glyph, type GlyphName } from '@/components/ui/glyph';
import { cx } from '@/components/ui/tone';
import { readFlag, readParam, readParams, type SearchParams } from '@/lib/query';

/**
 * Bảng lọc của trang "Ngành của tôi" — `<form method="get">` thuần, không một
 * dòng JavaScript.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BA CÁCH CHỐNG LỌC SÓT, tất cả đều nhìn thấy được trên màn hình
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
 * MỘT CHỖ LỆCH CÓ CHỦ Ý SO VỚI BẢN THIẾT KẾ
 *
 * **Giữ đủ NĂM chiều lọc.** Bản thiết kế (phương án 1b) chỉ vẽ ba: loại mua
 * hàng, lương, quận. Nhưng "Kinh nghiệm", "Lịch thứ 7" và "Phạm vi" đang chạy
 * thật và đang được dùng — bỏ đi là lấy mất tính năng của người dùng nhân danh
 * một bản vẽ. Ba chiều thêm dùng đúng ngôn ngữ thị giác của bản thiết kế, nên
 * nhìn vẫn liền một khối.
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
    n >= result.inFieldTotal ? undefined : `${n}/${result.inFieldTotal} có ghi`;

  return (
    <form method="get" className="flex flex-col">
      {/* Chỉ khi KHÔNG có ô chọn ngành bên dưới. Có cả hai thì `f` bị gửi lên
          hai lần và `readParam` lấy cái đầu — tức ô chọn ngành mất tác dụng. */}
      {fields.length <= 1 && <input type="hidden" name="f" value={result.slug} />}

      {/* Ô tìm chữ. `defaultValue` chứ không phải `value`: đây là form thuần
          không JavaScript, ô phải tự giữ chữ người dùng gõ, còn React chỉ đặt
          giá trị ban đầu lấy từ URL để bấm F5 hay chia sẻ link vẫn ra đúng. */}
      <label className="relative mt-3 block">
        <span className="sr-only">Tìm trong ngành</span>
        <Glyph
          name="search"
          size={15}
          stroke="var(--color-neutral-600)"
          className="absolute top-1/2 left-2.5 -translate-y-1/2"
        />
        <input
          type="search"
          name="q"
          defaultValue={readParam(params, 'q') ?? ''}
          placeholder="Từ khoá, công ty…"
          className="h-9.5 w-full border border-divider bg-neutral-100 pr-2.5 pl-8 text-sm text-text placeholder:text-neutral-600"
        />
      </label>

      {fields.length > 1 && (
        <Section icon="globe" title="Ngành">
          <select
            name="f"
            defaultValue={result.slug}
            className="w-full cursor-pointer border border-divider bg-neutral-100 px-2.5 py-2 text-sm text-text"
          >
            {fields.map((field) => (
              <option key={field.slug} value={field.slug}>
                {field.name}
              </option>
            ))}
          </select>
        </Section>
      )}

      <Section icon="building" title="Loại mua hàng">
        <Checks name="loai" options={result.facets.purchaseTypes} params={params} />
      </Section>

      <Section icon="money" title="Lương" note={cover(result.coverage.salary)}>
        <Tags name="luong" options={result.facets.salary} params={params} />
      </Section>

      <Section icon="briefcase" title="Kinh nghiệm" note={cover(result.coverage.experience)}>
        <Tags name="kn" options={result.facets.experience} params={params} />
      </Section>

      {/* Quận có thể lên tới vài chục giá trị. Cho cuộn trong khung thay vì cắt
          bớt: cắt bớt là giấu mất chính cái quận người ta đang tìm. */}
      <Section icon="pin" title="Quận / khu" note={cover(result.coverage.district)}>
        <div className="max-h-56 overflow-y-auto">
          <Tags name="quan" options={result.facets.districts} params={params} />
        </div>
      </Section>

      <Section icon="calendar" title="Lịch thứ 7" note={cover(result.coverage.saturday)}>
        <Tags name="t7" options={result.facets.saturday} params={params} />
      </Section>

      <Section icon="funnel" title="Phạm vi">
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
      </Section>

      {/* Nút nộp DÍNH ĐÁY khung lọc: danh sách ô tích dài hơn một màn hình, mà
          tích xong không thấy nút thì tưởng bộ lọc đã tự áp. */}
      <div className="sticky bottom-0 mt-5 bg-canvas pt-1 pb-1">
        <button
          type="submit"
          className="flex h-11 w-full items-center justify-center gap-2 bg-accent text-sm font-extrabold text-canvas transition-colors hover:bg-accent-600 active:bg-accent-700"
        >
          <Glyph name="check" size={16} strokeWidth={1.9} />
          Áp bộ lọc
        </button>
      </div>
    </form>
  );
}

// ─── Mảnh giao diện ──────────────────────────────────────────────────────────

/**
 * Đầu mỗi nhóm lọc: vạch 2px, icon đỏ, tên nhóm nét 800, ghi chú độ phủ bên
 * phải.
 *
 * Vạch nằm TRÊN đầu nhóm chứ không phải dưới chân, nên mọi nhóm đều có vạch —
 * kể cả nhóm đầu, vì phía trên nó đã là ô tìm kiếm chứ không phải mép bảng.
 */
function Section({
  icon,
  title,
  note,
  children,
}: {
  icon: GlyphName;
  title: string;
  /** Dòng phụ — dùng cho ĐỘ PHỦ, không dùng cho lời giải thích dài. */
  note?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="mt-2.5 border-t-2 border-divider">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-center gap-2 py-3">
        <Glyph name={icon} size={15} stroke="var(--color-accent)" />
        <span className="text-[13px] font-extrabold">{title}</span>
        {note && <span className="ml-auto text-[11px] text-neutral-600">{note}</span>}
      </div>
      {children}
    </fieldset>
  );
}

/**
 * Ô tích vuông — dùng cho chiều có ÍT giá trị và nhãn DÀI (loại mua hàng).
 *
 * Ô tích thật bị ẩn bằng `sr-only` chứ không phải `display:none`: ẩn hẳn thì
 * bàn phím không tới được và trình đọc màn hình không thấy. Hình vuông vẽ bằng
 * `<span>` bên cạnh, đổi hình theo `peer-checked` — đây là lý do thứ tự
 * `input` rồi mới tới `span` là bắt buộc, `peer-*` chỉ nhìn được về phía trước.
 */
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
  if (options.length === 0) return <p className="text-xs text-neutral-600">Chưa có dữ liệu</p>;

  return (
    <div className="flex flex-col">
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
              'flex cursor-pointer items-center gap-2.5 px-1.5 py-1.75 text-sm transition-colors',
              'has-checked:bg-accent-100 hover:bg-[color-mix(in_srgb,var(--color-text)_6%,transparent)]',
              empty && 'opacity-45',
            )}
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={checked}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="size-3.5 flex-none border-[1.5px] border-neutral-500 peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
            />
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            <span className="tnum flex-none text-xs text-neutral-700 peer-checked:font-extrabold peer-checked:text-accent-700">
              {option.count}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Nhãn bấm được — dùng cho chiều có NHIỀU giá trị và nhãn NGẮN (lương, quận,
 * kinh nghiệm, lịch thứ 7). Xếp cuộn dòng nên hai chục quận vẫn gọn trong một
 * cột 272px, trong khi cùng bấy nhiêu ô tích thì dài gấp bốn màn hình.
 *
 * Số tin đi LIỀN trong nhãn (`Quận 7 · 17`) chứ không tách cột: ở cỡ 12px một
 * cột số riêng chỉ tạo ra một rãnh trắng lởm chởm giữa các nhãn dài ngắn khác nhau.
 */
function Tags({
  name,
  options,
  params,
}: {
  name: string;
  options: Facet[];
  params: SearchParams;
}) {
  const selected = new Set(readParams(params, name));
  if (options.length === 0) return <p className="text-xs text-neutral-600">Chưa có dữ liệu</p>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const checked = selected.has(option.value);
        const empty = option.count === 0 && !checked;
        return (
          <label
            key={option.value}
            title={option.hint}
            className={cx(
              'inline-flex cursor-pointer items-center px-2.5 py-1.5 text-xs tracking-[0.02em] transition-colors',
              'bg-neutral-100 text-neutral-800',
              'has-checked:bg-accent has-checked:font-extrabold has-checked:text-canvas',
              'hover:bg-neutral-200 has-checked:hover:bg-accent-600',
              empty && 'opacity-45',
            )}
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={checked}
              className="peer sr-only"
            />
            <span className="peer-focus-visible:underline peer-focus-visible:underline-offset-2">
              {option.label} · {option.count}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Công tắc bật/tắt một cờ — không có số đếm, vì nó đổi PHẠM VI chứ không lọc. */
function Toggle({
  name,
  checked,
  hint,
  children,
}: {
  name: string;
  checked: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label
      title={hint}
      className="flex cursor-pointer items-center gap-2.5 px-1.5 py-1.75 text-sm transition-colors has-checked:bg-accent-100 hover:bg-[color-mix(in_srgb,var(--color-text)_6%,transparent)]"
    >
      <input type="checkbox" name={name} value="1" defaultChecked={checked} className="peer sr-only" />
      <span
        aria-hidden
        className="size-3.5 flex-none border-[1.5px] border-neutral-500 peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
      />
      <span className="peer-checked:font-extrabold peer-checked:text-accent-700">{children}</span>
    </label>
  );
}
