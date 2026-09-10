import type { FieldPage } from '@/api/field.api';
import { Glyph } from '@/components/ui/glyph';
import { PURCHASE_TYPES, PURCHASE_TYPE_UNKNOWN } from '@/constants/purchase';
import { EXPERIENCE_BANDS, FACET_NONE, SALARY_BANDS } from '@/lib/field-bands';
import { readFlag, readParam, readParams, urlWithoutValue, type SearchParams } from '@/lib/query';

/**
 * Dải "Đang xét" — mọi thứ đang thu hẹp danh sách, trên MỘT dòng.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MỘT CHỖ LỆCH CÓ CHỦ Ý SO VỚI BẢN THIẾT KẾ
 *
 * Bản thiết kế vẽ cả bốn ô ở dải này thành chip đen kèm dấu ✕:
 *
 *     Đang xét: [chỉ tin còn sống ✕] [TP. Hồ Chí Minh ✕] [90 ngày ✕] [chỉ khớp chắc ✕]
 *
 * Nhưng ba ô đầu KHÔNG gỡ được. Chúng là định nghĩa của chính ngành này, nằm
 * trong bảng `SavedFilter`, đổi bằng SQL chứ không bằng giao diện. Vẽ dấu ✕
 * lên một thứ không bấm được là mời người ta bấm rồi để họ tự hiểu vì sao
 * không có gì xảy ra — lỗi tệ hơn hẳn việc thiếu mất một dấu ✕.
 *
 * Nên ở đây giữ NGUYÊN hình dạng chip đen của bản thiết kế, chỉ tách hai hạng:
 *
 *   · chip PHẠM VI  — đen, không ✕, không phải liên kết. Đây là luật của ngành.
 *   · chip BỘ LỌC   — đen, có ✕, là liên kết gỡ đúng một giá trị.
 *
 * Hai hạng vẫn cùng một ngôn ngữ thị giác, nên dải này vẫn đọc là một câu duy
 * nhất; chỉ có con trỏ chuột và dấu ✕ nói cho biết cái nào động vào được.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function FieldScopeBar({
  pathname,
  params,
  result,
}: {
  pathname: string;
  params: SearchParams;
  result: FieldPage;
}) {
  // ── Hạng 1: phạm vi cố định của ngành ──────────────────────────────────────
  const scope: { text: string; hint?: string }[] = [
    { text: 'chỉ tin còn sống', hint: 'Đã loại tin hết hạn, tin bị gỡ và tin nguồn không còn liệt kê' },
  ];
  for (const province of result.provinceNames) scope.push({ text: province });
  if (result.maxAgeDays) scope.push({ text: `${result.maxAgeDays} ngày`, hint: 'Chỉ tin đăng trong khoảng này' });

  const includeWeak = readFlag(params, 'weak');
  if (!includeWeak) {
    scope.push({
      text: 'chỉ tin khớp chắc',
      hint: 'Đang ẩn tin chỉ có từ khoá ở phần mô tả. Bật “Kể cả tin khớp yếu” ở bảng lọc để xem.',
    });
  }

  // ── Hạng 2: bộ lọc người dùng đang bật, gỡ được từng cái ───────────────────
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

  if (includeWeak) chips.push({ key: 'weak', value: '1', text: 'Kể cả tin khớp yếu' });
  if (readFlag(params, 'hep')) chips.push({ key: 'hep', value: '1', text: 'Chỉ TP.HCM cũ' });

  // Chuỗi tìm kiếm đứng CUỐI dải chip, và là thứ dễ quên nhất: nó không để lại
  // ô tích nào sáng lên trong bảng lọc, nên nếu không có chip này thì người
  // dùng thấy "11 việc làm" mà không hiểu vì sao ít thế.
  const q = readParam(params, 'q')?.trim();
  if (q) chips.push({ key: 'q', value: q, text: `tìm “${q}”` });

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b-2 border-divider bg-neutral-200 px-4 py-3 text-[13px] sm:px-7">
      <span className="inline-flex items-center gap-1.5 text-neutral-800">
        <Glyph name="shield" size={15} stroke="var(--color-accent)" />
        Đang xét:
      </span>

      {scope.map((item) => (
        <span
          key={item.text}
          title={item.hint}
          className="inline-flex items-center bg-text px-2.5 py-0.75 text-[11px] tracking-[0.02em] text-neutral-100"
        >
          {item.text}
        </span>
      ))}

      {chips.map((chip) => (
        <a
          key={`${chip.key}:${chip.value}`}
          href={urlWithoutValue(pathname, params, chip.key, chip.value)}
          title={`Bỏ lọc "${chip.text}"`}
          className="group inline-flex items-center gap-1.5 bg-text py-0.75 pr-2 pl-2.5 text-[11px] tracking-[0.02em] text-neutral-100 transition-colors hover:bg-accent-700"
        >
          {chip.text}
          <span aria-hidden className="text-[12px] leading-none opacity-70 group-hover:opacity-100">
            ✕
          </span>
        </a>
      ))}

      {chips.length > 0 && (
        <a
          href={`${pathname}?f=${result.slug}`}
          className="ml-auto px-1 text-[13px] font-extrabold text-accent hover:text-accent-600"
        >
          Xoá hết bộ lọc
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
