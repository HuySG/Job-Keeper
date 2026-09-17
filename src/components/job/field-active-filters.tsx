import { PURCHASE_TYPES, PURCHASE_TYPE_UNKNOWN } from '@/constants/purchase';
import { EXPERIENCE_BANDS, FACET_NONE, SALARY_BANDS } from '@/lib/field-bands';
import { readFlag, readParam, readParams, urlWithoutValue, type SearchParams } from '@/lib/query';

import { SATURDAY_TEXT } from './field-job-card';

export interface ActiveFilter {
  key: string;
  value: string;
  text: string;
}

/**
 * Mọi thứ người dùng đang bật để thu hẹp danh sách Ngành — đọc từ URL.
 *
 * Một nguồn duy nhất cho ba chỗ: dải chip gỡ được, con số "n điều kiện" ở đầu
 * bảng lọc, và câu "Bộ lọc đang chặt quá: …" của trạng thái rỗng. Ba chỗ tự
 * đếm riêng là ba con số lệch nhau.
 *
 * Chiều có từ vựng CỐ ĐỊNH bỏ qua giá trị lạ — phải khớp với `onlyKnown` ở
 * trang, nếu không liên kết cũ `?kn=3` bị tầng dữ liệu bỏ qua (đúng) mà chip
 * vẫn hiện "3" (sai). Quận là dữ liệu tự do nên không có bảng để đối chiếu.
 */
export function activeFieldFilters(params: SearchParams): ActiveFilter[] {
  const out: ActiveFilter[] = [];

  const add = (key: string, table: Record<string, string>, strict: boolean): void => {
    for (const value of readParams(params, key)) {
      if (strict && !(value in table)) continue;
      out.push({ key, value, text: table[value] ?? value });
    }
  };

  add('loai', PURCHASE_LABELS, true);
  add('luong', SALARY_LABELS, true);
  add('kn', EXPERIENCE_LABELS, true);
  add('quan', DISTRICT_LABELS, false);
  add('t7', SATURDAY_LABELS, true);

  if (readFlag(params, 'weak')) out.push({ key: 'weak', value: '1', text: 'kể cả tin khớp yếu' });
  if (readFlag(params, 'hep')) out.push({ key: 'hep', value: '1', text: 'chỉ TP.HCM cũ' });

  // Chuỗi tìm kiếm là thứ dễ quên nhất: nó không để lại ô tích nào sáng lên
  // trong bảng lọc, nên không có chip này thì người dùng thấy "11 việc làm" mà
  // không hiểu vì sao ít thế.
  const q = readParam(params, 'q')?.trim();
  if (q) out.push({ key: 'q', value: q, text: `tìm “${q}”` });

  return out;
}

/**
 * Dải chip "Đang lọc" phía trên danh sách — mỗi chip là một liên kết gỡ đúng
 * một giá trị.
 *
 * Bản v2 không vẽ dải này: ở đó bảng lọc bên trái đã sáng lên những gì đang
 * chọn. Nhưng bảng lọc nằm ngoài tầm mắt khi đang đọc tin thứ mười, và ô tìm
 * kiếm thì không sáng lên chỗ nào cả — nên dải này ở lại, chỉ hiện khi đang
 * lọc thật, dùng đúng chip mực của thanh công cụ Kho tin.
 */
export function FieldActiveFilters({
  pathname,
  params,
  field,
}: {
  pathname: string;
  params: SearchParams;
  field: string;
}) {
  const chips = activeFieldFilters(params);
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      <span className="text-neutral-700">Đang lọc:</span>
      {chips.map((chip) => (
        <a
          key={`${chip.key}:${chip.value}`}
          href={urlWithoutValue(pathname, params, chip.key, chip.value)}
          title={`Bỏ lọc "${chip.text}"`}
          className="tag tag-ink gap-1.5 px-2.5 py-1 hover:bg-accent-800"
        >
          {chip.text}
          <span aria-hidden className="opacity-70">
            ✕
          </span>
        </a>
      ))}
      <a href={`${pathname}?f=${encodeURIComponent(field)}`} className="btn btn-ghost text-[13px]">
        Xoá hết bộ lọc
      </a>
    </div>
  );
}

// ─── Bảng tra nhãn ───────────────────────────────────────────────────────────
//
// Tra từ bảng CỐ ĐỊNH, không tra từ `result.facets`. Facet được đếm trên tập đã
// lọc nên nó rỗng đi được — và đúng lúc rỗng thì chip lại tụt xuống hiện slug
// trần (`san-xuat`) cho người dùng đọc.

const PURCHASE_LABELS: Record<string, string> = Object.fromEntries(
  [...PURCHASE_TYPES, PURCHASE_TYPE_UNKNOWN].map((type) => [type.slug, type.label]),
);

const EXPERIENCE_LABELS: Record<string, string> = Object.fromEntries(
  EXPERIENCE_BANDS.map((band) => [band.value, band.value === FACET_NONE ? 'không ghi kinh nghiệm' : band.label]),
);

const SALARY_LABELS: Record<string, string> = Object.fromEntries(
  SALARY_BANDS.map((band) => [band.value, band.value === FACET_NONE ? 'lương thoả thuận' : band.label]),
);

const SATURDAY_LABELS: Record<string, string> = {
  ...SATURDAY_TEXT,
  [FACET_NONE]: 'không ghi lịch thứ 7',
};

/** Quận lưu thẳng tên đọc được, chỉ ô "không ghi" cần dịch. */
const DISTRICT_LABELS: Record<string, string> = { [FACET_NONE]: 'không ghi quận' };
