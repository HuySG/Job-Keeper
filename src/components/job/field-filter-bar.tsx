import type { Facet, FieldPage } from '@/api/field.api';
import { cx } from '@/components/ui/tone';
import { PURCHASE_TYPES, PURCHASE_TYPE_UNKNOWN } from '@/constants/purchase';
import { readFlag, readParam, urlWithout, type SearchParams } from '@/lib/query';

/**
 * Bảng tra nhãn ĐỘC LẬP với facet.
 *
 * Vì sao không tra thẳng trong `result.facets`: facet được đếm trên tập đã áp
 * các bộ lọc KHÁC, nên nó rỗng đi được. Lọc `loai=san-xuat` cộng `quan=Bình
 * Tân` ra 0 tin thì mọi facet đều rỗng, và chip "đang lọc" tụt xuống hiện slug
 * trần `san-xuat` cho người dùng đọc. Nhãn của một giá trị không được phụ
 * thuộc vào việc còn tin nào mang giá trị đó hay không.
 */
const PURCHASE_LABELS: Record<string, string> = Object.fromEntries(
  [...PURCHASE_TYPES, PURCHASE_TYPE_UNKNOWN].map((type) => [type.slug, type.label]),
);

/** Khớp `EXPERIENCE_STEPS` trong field.api — mốc nào đổi thì đổi cả hai. */
const EXPERIENCE_LABELS: Record<string, string> = {
  '0': 'Không đòi kinh nghiệm',
  '1': 'Tối đa 1 năm',
  '3': 'Tối đa 3 năm',
  '5': 'Tối đa 5 năm',
};

const SATURDAY_LABELS: Record<string, string> = {
  NONE: 'Nghỉ thứ 7',
  HALF_DAY: 'Sáng thứ 7',
  ALTERNATE: 'Thứ 7 luân phiên',
  FULL: 'Làm cả thứ 7',
};

/**
 * Bộ lọc của trang "Ngành của tôi" — `<form method="get">` thuần, không một
 * dòng JavaScript, giống hệt bộ lọc của Kho tin.
 *
 * Mỗi lựa chọn thành một URL chia sẻ được và đánh dấu trang được, trang chạy cả
 * khi JavaScript chưa tải xong, và không phải viết một dòng state nào.
 *
 * **Số tin nằm ngay trong tên lựa chọn** — "Sản xuất & nhà máy (68)". Đây không
 * phải trang trí: nó cho biết chọn xong còn lại bao nhiêu, nên không ai chọn
 * một bộ lọc để rồi nhận danh sách rỗng.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BẢN VẼ LẠI — vì sao mỗi ô phải có NHÃN RIÊNG bên trên
 *
 * Bản trước dùng chính câu placeholder làm nhãn ("Mọi quận/khu · 88/218 tin
 * có"). Nó chỉ đúng khi ô còn trống. Chọn xong một giá trị thì ô hiện "Quận 7
 * (12)" và **danh tính của ô biến mất** — sáu ô cạnh nhau, mỗi ô một giá trị,
 * không ô nào còn nói nó đang điều khiển chiều nào. Người dùng phải mở từng
 * dropdown ra mới nhớ lại mình đã lọc gì.
 *
 * Nay: nhãn nằm NGOÀI ô nên không bao giờ bị giá trị đè mất, còn độ phủ
 * ("88/218 tin có") xuống dòng phụ bên dưới — nó là lời cảnh báo về chất lượng
 * dữ liệu, không phải tên của ô, nên không được chiếm chỗ của tên.
 *
 * `<label>` bọc cả nhãn lẫn `<select>`: bấm vào chữ là nhảy đúng vào ô, và
 * trình đọc màn hình đọc được cặp nhãn–ô mà không cần `aria-label` vá víu.
 * ─────────────────────────────────────────────────────────────────────────────
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
  const cover = (n: number): string | undefined =>
    n >= result.inFieldTotal ? undefined : `${n}/${result.inFieldTotal} tin có ghi`;

  return (
    <form method="get" className="rounded-card border border-border bg-surface">
      {/* Ngành đang xem đi theo bằng input ẩn, nếu không mỗi lần bấm "Lọc" là
          rơi về ngành mặc định — xem cảnh báo về `action` ở đầu file. */}
      {fields.length <= 1 && <input type="hidden" name="f" value={result.slug} />}

      <div className="grid gap-x-4 gap-y-3 p-4 [grid-template-columns:repeat(auto-fit,minmax(11.5rem,1fr))]">
        {fields.length > 1 && (
          <Field label="Ngành" name="f" value={result.slug} required>
            {fields.map((field) => (
              <option key={field.slug} value={field.slug}>
                {field.name}
              </option>
            ))}
          </Field>
        )}

        <Field
          label="Loại mua hàng"
          name="loai"
          value={readParam(params, 'loai')}
          valueLabel={labelOf(PURCHASE_LABELS, readParam(params, 'loai'))}
          placeholder="Mọi loại"
          options={result.facets.purchaseTypes}
        />

        <Field
          label="Kinh nghiệm"
          name="kn"
          value={readParam(params, 'kn')}
          valueLabel={labelOf(EXPERIENCE_LABELS, readParam(params, 'kn'))}
          placeholder="Mọi mức"
          options={result.facets.experience}
          note={cover(result.coverage.experience)}
          available={result.coverage.experience > 0}
        />

        <Field
          label="Quận / khu"
          name="quan"
          value={readParam(params, 'quan')}
          placeholder="Mọi quận"
          options={result.facets.districts}
          note={cover(result.coverage.district)}
          available={result.coverage.district > 0}
        />

        {/* Cột này gần như rỗng ở phần lớn nguồn, và người dùng phải biết TRƯỚC
            khi chọn chứ không phải sau khi nhận danh sách trống — nên độ phủ
            nằm ngay dưới ô, không giấu trong dropdown. */}
        <Field
          label="Lịch thứ 7"
          name="t7"
          value={readParam(params, 't7')}
          valueLabel={labelOf(SATURDAY_LABELS, readParam(params, 't7'))}
          placeholder="Không xét"
          options={result.facets.saturday}
          note={cover(result.coverage.saturday)}
          available={result.coverage.saturday > 0}
        />

        <Field
          label="Lương tối thiểu"
          name="luong"
          value={readParam(params, 'luong')}
          placeholder="Mọi mức"
          note={cover(result.coverage.salary)}
        >
          {SALARY_STEPS.map((step) => (
            <option key={step.value} value={step.value}>
              {step.label}
            </option>
          ))}
        </Field>
      </div>

      {/* Chân thanh lọc: hai công tắc + hai nút. Tách khỏi lưới ô chọn bằng một
          đường kẻ vì chúng khác loại — ô chọn thu hẹp theo GIÁ TRỊ, còn công
          tắc đổi chính ĐỊNH NGHĨA của tập tin đang xem. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
        <Toggle name="weak" checked={readFlag(params, 'weak')} hint="Tin chỉ có từ khoá ở phần mô tả, không có ở tiêu đề">
          Kể cả tin khớp yếu
        </Toggle>

        {/* Sáp nhập 2025 gộp Bình Dương và Bà Rịa – Vũng Tàu vào TP.HCM. Đúng
            về hành chính, nhưng Thủ Đức và Bến Cát là hai thế giới đi lại khác
            nhau — để người dùng tự chọn, đừng quyết hộ. */}
        <Toggle name="hep" checked={readFlag(params, 'hep')} hint="Bỏ tin ở Bình Dương và Bà Rịa – Vũng Tàu, phần sáp nhập vào TP.HCM năm 2025">
          Chỉ TP.HCM cũ
        </Toggle>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={fields.length > 1 ? `?f=${result.slug}` : '?'}
            className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:text-text"
          >
            Xoá lọc
          </a>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Lọc
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * Dải chip "đang lọc gì", bấm × là gỡ từng cái.
 *
 * Vì sao cần dù thanh lọc ở ngay trên: thanh lọc trả lời "chọn được những gì",
 * còn dải này trả lời "TÔI ĐANG lọc gì" — và câu thứ hai phải đọc được trong
 * một cái liếc, không phải bằng cách rà lại sáu ô xem ô nào đang sáng. Nó cũng
 * là đường DUY NHẤT để gỡ đúng một điều kiện: bản trước chỉ có "Xoá lọc" xoá
 * sạch, nên bỏ một điều kiện đồng nghĩa với dựng lại cả bộ từ đầu.
 *
 * Nhãn viết bằng ngôn ngữ người — "Quận 7", "Từ 25 triệu" — chứ không phải
 * `quan=Quận 7`, `luong=25000000`. Slug và số thô là chuyện của URL.
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
  const active: { key: string; text: string }[] = [];
  const add = (key: string, text: string | undefined): void => {
    if (text) active.push({ key, text });
  };

  // Nhãn tra từ bảng CỐ ĐỊNH, không tra từ `result.facets` — xem chú thích ở
  // `PURCHASE_LABELS`: facet rỗng đi được, và khi đó chip tụt xuống hiện slug.
  add('loai', labelOf(PURCHASE_LABELS, readParam(params, 'loai')));
  add('kn', labelOf(EXPERIENCE_LABELS, readParam(params, 'kn')));
  // Quận lưu thẳng tên đọc được ("Bình Tân"), không phải slug — không cần tra.
  add('quan', readParam(params, 'quan'));
  add('t7', labelOf(SATURDAY_LABELS, readParam(params, 't7')));
  add(
    'luong',
    labelOf(
      Object.fromEntries(SALARY_STEPS.map((s) => [s.value, s.label])),
      readParam(params, 'luong'),
    ),
  );

  if (readFlag(params, 'weak')) add('weak', 'Kể cả tin khớp yếu');
  if (readFlag(params, 'hep')) add('hep', 'Chỉ TP.HCM cũ');

  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted">Đang lọc:</span>

      {active.map((item) => (
        <a
          key={item.key}
          href={urlWithout(pathname, params, item.key)}
          title={`Bỏ lọc "${item.text}"`}
          className="group inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft py-1 pr-2 pl-3 text-sm text-accent-ink"
        >
          {item.text}
          <span
            aria-hidden
            className="grid size-4 place-items-center rounded-full text-xs leading-none opacity-60 group-hover:bg-accent group-hover:text-white group-hover:opacity-100"
          >
            ×
          </span>
        </a>
      ))}

      {active.length > 1 && (
        <a
          href={`${pathname}?f=${result.slug}`}
          className="text-sm text-muted underline underline-offset-2"
        >
          xoá tất cả
        </a>
      )}
    </div>
  );
}

/**
 * Tra nhãn đọc được của một giá trị lọc.
 *
 * Trả `undefined` khi không có giá trị (chưa lọc chiều này), và trả về CHÍNH
 * giá trị khi bảng chưa có nhãn — thà hiện slug còn hơn làm biến mất một bộ
 * lọc đang bật khỏi dải "đang lọc".
 */
function labelOf(table: Record<string, string>, value: string | undefined): string | undefined {
  if (!value) return undefined;
  return table[value] ?? value;
}

/** Mốc lương, VND/tháng. Không đếm trước được nên cố ý không mang số tin. */
const SALARY_STEPS: readonly { value: string; label: string }[] = [
  { value: '15000000', label: 'Từ 15 triệu' },
  { value: '25000000', label: 'Từ 25 triệu' },
  { value: '40000000', label: 'Từ 40 triệu' },
];

/**
 * Một ô lọc = nhãn + `<select>` + (tuỳ chọn) dòng độ phủ.
 *
 * Ô đang có giá trị được tô khác hẳn: nhìn một cái là biết đang lọc những gì.
 *
 * Nhận `options` (dạng facet, có sẵn số tin) hoặc `children` (tự dựng option) —
 * hai đường vì có chiều đếm trước được, có chiều thì không.
 */
function Field({
  label,
  name,
  value,
  valueLabel,
  placeholder,
  options,
  children,
  note,
  required,
  available = true,
}: {
  label: string;
  name: string;
  value?: string;
  /** Tên đọc được của `value`, dùng khi facet không còn đếm ra nó — xem `list`. */
  valueLabel?: string;
  placeholder?: string;
  options?: Facet[];
  children?: React.ReactNode;
  /** Dòng phụ dưới ô — dùng cho ĐỘ PHỦ, không dùng cho lời giải thích dài. */
  note?: string;
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

  /**
   * Giá trị ĐANG CHỌN phải luôn có một `<option>` của nó, kể cả khi facet
   * không còn đếm ra nó nữa.
   *
   * Bẫy đã gặp thật: lọc `loai=san-xuat` cộng `quan=Bình Tân` ra 0 tin, nên
   * MỌI danh sách facet đều rỗng. `<select defaultValue="san-xuat">` không tìm
   * thấy option nào khớp thì trình duyệt lặng lẽ hiển thị option đầu tiên —
   * tức "Mọi loại". Người dùng nhìn thanh lọc thấy "Mọi loại" trong khi URL
   * vẫn đang lọc `san-xuat`, và bấm "Lọc" một lần nữa là bộ lọc bốc hơi mà
   * không ai ra lệnh. Thêm option bù vào thì ô luôn nói đúng trạng thái thật.
   */
  const list = options
    ? options.some((option) => option.value === value) || !value
      ? options
      : [...options, { value, label: valueLabel ?? value, count: 0 }]
    : undefined;

  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ''}
        className={cx(
          'w-full cursor-pointer truncate rounded-lg border px-2.5 py-1.5 text-sm outline-none',
          value ? 'border-accent bg-accent-soft text-accent-ink' : 'border-border bg-canvas',
        )}
      >
        {!required && <option value="">{placeholder}</option>}
        {list
          ? list.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
                {option.count > 0 ? ` (${option.count})` : ''}
              </option>
            ))
          : children}
      </select>
      {note && <span className="mt-1 block text-xs text-faint">{note}</span>}
    </label>
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
