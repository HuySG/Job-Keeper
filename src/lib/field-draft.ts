import { GRAY_PREFIX } from '@/constants/field';
import { toMatchKey } from '@/crawler/normalize/text';
import { readParam, readParams, type SearchParams } from '@/lib/query';

/**
 * Bản NHÁP của từ điển ngành — sống trong URL cho tới lúc bấm "Lưu từ điển".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Vì sao nháp nằm trong URL chứ không ghi thẳng vào CSDL
 *
 * Trang Cài đặt hứa hai điều cùng lúc: "thêm từ là số tin khớp đổi ngay" VÀ
 * "có nút Lưu từ điển". Ghi thẳng từng cú bấm thì điều thứ hai vô nghĩa, và
 * lỡ tay gỡ nhầm "mua hàng" là danh sách mất 189 tin ngay lập tức.
 *
 * Nên mỗi cú bấm chỉ đổi URL. Trang đọc URL, dựng bản nháp, chấm lại toàn bộ
 * tin bằng bản nháp đó rồi hiện số — không ghi gì cả. Chỉ nút "Lưu" mới ghi.
 * Được thêm ba thứ không tốn công: chạy không cần JavaScript, nút Back của
 * trình duyệt là nút hoàn tác, và gửi link cho chính mình để sửa tiếp trên máy
 * khác vẫn ra đúng bản nháp.
 *
 * URL chỉ mang PHẦN KHÁC so với bản đã lưu (`them=`, `bo=`…), không mang cả
 * từ điển: từ điển thật có ~70 từ, chép hết vào URL là vượt trần độ dài URL
 * của Vercel (14 KB) sau vài lần sửa.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface Dictionary {
  /** Nguyên văn như trong `SavedFilter.keywords` — từ xám mang tiền tố `~`. */
  keywords: readonly string[];
  excludes: readonly string[];
  provinces: readonly string[];
  maxAgeDays: number | null;
}

export interface DraftOps {
  /** Thêm từ khớp chắc. Từ đã có ở dạng xám thì được nâng lên. */
  add: string[];
  /** Thêm từ khớp yếu (xám). Bỏ qua nếu từ đã có ở bất kỳ dạng nào. */
  addGray: string[];
  /** Gỡ hẳn một từ, dù đang chắc hay xám. */
  remove: string[];
  /** Nâng từ xám thành từ khớp chắc. */
  promote: string[];
  addExclude: string[];
  removeExclude: string[];
  addProvince: string[];
  removeProvince: string[];
  /** `undefined` = giữ nguyên; `null` = không giới hạn tuổi tin. */
  maxAgeDays?: number | null;
}

/** Tên tham số trên URL. Tiếng Việt không dấu cho khớp phần còn lại của app. */
export const DRAFT_KEYS = {
  add: 'them',
  addGray: 'themxam',
  remove: 'bo',
  promote: 'nang',
  addExclude: 'themloai',
  removeExclude: 'boloai',
  addProvince: 'themtinh',
  removeProvince: 'botinh',
  maxAgeDays: 'ngay',
} as const;

/** Ba mốc tuổi tin của bản thiết kế. */
export const FRESHNESS_CHOICES = [30, 60, 90] as const;

/** Một từ dài hơn thế này gần như chắc là dán nhầm cả câu. */
export const TERM_MAX_LENGTH = 60;

/**
 * Trần số từ mỗi danh sách. Mỗi từ là một biểu thức chính quy chạy trên mọi
 * tin mỗi lần tải trang Ngành, nên đây là trần hiệu năng chứ không phải thẩm mỹ.
 */
export const MAX_TERMS = 150;

const EMPTY_OPS: DraftOps = {
  add: [],
  addGray: [],
  remove: [],
  promote: [],
  addExclude: [],
  removeExclude: [],
  addProvince: [],
  removeProvince: [],
};

export function emptyOps(): DraftOps {
  return structuredClone(EMPTY_OPS);
}

export function isGray(raw: string): boolean {
  return raw.startsWith(GRAY_PREFIX);
}

/** Từ như người đọc thấy — bỏ tiền tố xám. */
export function termLabel(raw: string): string {
  return isGray(raw) ? raw.slice(GRAY_PREFIX.length) : raw;
}

/**
 * Làm sạch một từ người dùng gõ vào. `null` = không nhận.
 *
 * Chữ thường vì cả từ điển seed đều viết thường, và so khớp vốn không phân
 * biệt hoa thường — để "Mua hàng" và "mua hàng" cùng nằm trong danh sách là
 * đếm một từ hai lần. Tiền tố `~` gõ tay bị bỏ: xám hay không là do NÚT quyết
 * định, không phải do một ký tự người dùng không biết nghĩa.
 */
export function cleanTerm(input: string): string | null {
  const text = input.replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi-VN');
  const bare = text.startsWith(GRAY_PREFIX) ? text.slice(GRAY_PREFIX.length).trim() : text;
  if (bare.length === 0 || bare.length > TERM_MAX_LENGTH) return null;
  // Một chữ cái đơn lẻ khớp vào gần như mọi tiêu đề.
  if (toMatchKey(bare).length < 2) return null;
  return bare;
}

/** Slug tỉnh/thành hợp lệ về HÌNH DẠNG. Có tồn tại hay không do CSDL trả lời lúc lưu. */
function isSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 60;
}

/** Hai từ là MỘT nếu so khớp ra cùng một khoá — "Mua Hàng" = "mua hang". */
function sameTerm(a: string, b: string): boolean {
  return toMatchKey(a) === toMatchKey(b);
}

function uniqueTerms(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = toMatchKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function readDraftOps(params: SearchParams): DraftOps {
  const terms = (key: string): string[] =>
    uniqueTerms(
      readParams(params, key)
        .map(cleanTerm)
        .filter((term): term is string => term !== null),
    );
  const slugs = (key: string): string[] => [...new Set(readParams(params, key).filter(isSlug))];

  const ops: DraftOps = {
    add: terms(DRAFT_KEYS.add),
    addGray: terms(DRAFT_KEYS.addGray),
    remove: terms(DRAFT_KEYS.remove),
    promote: terms(DRAFT_KEYS.promote),
    addExclude: terms(DRAFT_KEYS.addExclude),
    removeExclude: terms(DRAFT_KEYS.removeExclude),
    addProvince: slugs(DRAFT_KEYS.addProvince),
    removeProvince: slugs(DRAFT_KEYS.removeProvince),
  };

  const age = readParam(params, DRAFT_KEYS.maxAgeDays);
  if (age === '0') ops.maxAgeDays = null;
  else if (age !== undefined) {
    const days = Number(age);
    if (Number.isInteger(days) && days >= 1 && days <= 365) ops.maxAgeDays = days;
  }

  return ops;
}

/**
 * Bản đã lưu + các thay đổi = bản nháp.
 *
 * Thứ tự áp là cố ý: GỠ trước, THÊM sau. Nhờ vậy "hạ một từ chắc xuống xám"
 * diễn đạt được bằng `bo=x&themxam=x` mà không cần thêm một loại thao tác nữa.
 */
export function applyDraft(saved: Dictionary, ops: DraftOps): Dictionary {
  let keywords = saved.keywords.filter(
    (raw) => !ops.remove.some((term) => sameTerm(termLabel(raw), term)),
  );

  keywords = keywords.map((raw) =>
    isGray(raw) && ops.promote.some((term) => sameTerm(termLabel(raw), term))
      ? termLabel(raw)
      : raw,
  );

  for (const term of ops.add) {
    const index = keywords.findIndex((raw) => sameTerm(termLabel(raw), term));
    const existing = keywords[index];
    if (existing === undefined) keywords.push(term);
    else if (isGray(existing)) keywords[index] = termLabel(existing);
  }

  for (const term of ops.addGray) {
    if (!keywords.some((raw) => sameTerm(termLabel(raw), term))) keywords.push(GRAY_PREFIX + term);
  }

  const excludes = saved.excludes.filter(
    (raw) => !ops.removeExclude.some((term) => sameTerm(raw, term)),
  );
  for (const term of ops.addExclude) {
    if (!excludes.some((raw) => sameTerm(raw, term))) excludes.push(term);
  }

  const provinces = saved.provinces.filter((slug) => !ops.removeProvince.includes(slug));
  for (const slug of ops.addProvince) if (!provinces.includes(slug)) provinces.push(slug);

  return {
    keywords: keywords.slice(0, MAX_TERMS),
    excludes: excludes.slice(0, MAX_TERMS),
    provinces,
    maxAgeDays: ops.maxAgeDays === undefined ? saved.maxAgeDays : ops.maxAgeDays,
  };
}

/**
 * Ngược của `applyDraft`: từ hai bản từ điển, suy ra tập thay đổi NHỎ NHẤT.
 *
 * Mọi liên kết trên trang Cài đặt đi qua hàm này, nên URL luôn gọn: thêm một
 * từ rồi gỡ chính nó thì URL trở về rỗng, chứ không thành `them=x&bo=x`.
 */
export function diffDraft(saved: Dictionary, draft: Dictionary): DraftOps {
  const ops = emptyOps();

  const savedByKey = new Map(saved.keywords.map((raw) => [toMatchKey(termLabel(raw)), raw]));
  const draftKeys = new Set(draft.keywords.map((raw) => toMatchKey(termLabel(raw))));

  for (const [key, raw] of savedByKey) {
    if (!draftKeys.has(key)) ops.remove.push(termLabel(raw));
  }

  for (const raw of draft.keywords) {
    const label = termLabel(raw);
    const before = savedByKey.get(toMatchKey(label));
    if (before === undefined) {
      (isGray(raw) ? ops.addGray : ops.add).push(label);
    } else if (isGray(before) && !isGray(raw)) {
      ops.promote.push(label);
    } else if (!isGray(before) && isGray(raw)) {
      ops.remove.push(label);
      ops.addGray.push(label);
    }
  }

  const savedExcludes = new Set(saved.excludes.map(toMatchKey));
  const draftExcludes = new Set(draft.excludes.map(toMatchKey));
  ops.removeExclude = saved.excludes.filter((raw) => !draftExcludes.has(toMatchKey(raw)));
  ops.addExclude = draft.excludes.filter((raw) => !savedExcludes.has(toMatchKey(raw)));

  ops.removeProvince = saved.provinces.filter((slug) => !draft.provinces.includes(slug));
  ops.addProvince = draft.provinces.filter((slug) => !saved.provinces.includes(slug));

  if (draft.maxAgeDays !== saved.maxAgeDays) ops.maxAgeDays = draft.maxAgeDays;

  return ops;
}

export function hasChanges(ops: DraftOps): boolean {
  return opsToEntries(ops).length > 0;
}

/** Thay đổi dưới dạng cặp khoá–giá trị: dùng cho URL lẫn input ẩn của form Lưu. */
export function opsToEntries(ops: DraftOps): [string, string][] {
  const entries: [string, string][] = [];
  const push = (key: string, values: readonly string[]) => {
    for (const value of values) entries.push([key, value]);
  };

  push(DRAFT_KEYS.remove, ops.remove);
  push(DRAFT_KEYS.promote, ops.promote);
  push(DRAFT_KEYS.add, ops.add);
  push(DRAFT_KEYS.addGray, ops.addGray);
  push(DRAFT_KEYS.removeExclude, ops.removeExclude);
  push(DRAFT_KEYS.addExclude, ops.addExclude);
  push(DRAFT_KEYS.removeProvince, ops.removeProvince);
  push(DRAFT_KEYS.addProvince, ops.addProvince);
  if (ops.maxAgeDays !== undefined) {
    entries.push([DRAFT_KEYS.maxAgeDays, ops.maxAgeDays === null ? '0' : String(ops.maxAgeDays)]);
  }

  return entries;
}

/**
 * Liên kết tới trang Cài đặt mang đúng bản nháp `draft`.
 *
 * `field` chỉ ghi khi khác ngành mặc định — URL ngắn hơn cho trường hợp phổ
 * biến nhất, và vẫn đúng khi có nhiều ngành.
 */
export function draftHref(
  pathname: string,
  saved: Dictionary,
  draft: Dictionary,
  field?: string,
): string {
  const query = new URLSearchParams();
  if (field) query.set('f', field);
  for (const [key, value] of opsToEntries(diffDraft(saved, draft))) query.append(key, value);
  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}

// ─── Các phép sửa một bước, dùng để dựng liên kết ────────────────────────────

export function withoutKeyword(draft: Dictionary, label: string): Dictionary {
  return {
    ...draft,
    keywords: draft.keywords.filter((raw) => !sameTerm(termLabel(raw), label)),
  };
}

export function withPromoted(draft: Dictionary, label: string): Dictionary {
  return {
    ...draft,
    keywords: draft.keywords.map((raw) =>
      isGray(raw) && sameTerm(termLabel(raw), label) ? termLabel(raw) : raw,
    ),
  };
}

export function withoutExclude(draft: Dictionary, term: string): Dictionary {
  return { ...draft, excludes: draft.excludes.filter((raw) => !sameTerm(raw, term)) };
}

export function withProvince(draft: Dictionary, slug: string, on: boolean): Dictionary {
  const rest = draft.provinces.filter((item) => item !== slug);
  return { ...draft, provinces: on ? [...rest, slug] : rest };
}

export function withMaxAge(draft: Dictionary, days: number | null): Dictionary {
  return { ...draft, maxAgeDays: days };
}
