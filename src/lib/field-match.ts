import { GRAY_PREFIX } from '@/constants/field';
import { toMatchKey, toTechKey } from '@/crawler/normalize/text';

/**
 * Chấm một tin có thuộc "ngành của tôi" hay không.
 *
 * Cố ý là hàm THUẦN, không đụng DB, không đụng mạng: script soi, máy kiểm
 * còn-sống và (sau này) phần web đều gọi cùng một bộ luật này. Ngành mà được
 * định nghĩa ở hai chỗ thì sớm muộn hai chỗ lệch nhau, và lúc đó không ai biết
 * con số nào đúng.
 *
 * Luật, theo đúng thứ tự — thứ tự chính là phần quan trọng nhất:
 *
 *   1. Từ LOẠI khớp trong TIÊU ĐỀ  -> loại thẳng, không xét gì thêm.
 *      "Kế toán mua hàng" có chữ "mua hàng" nhưng là nghề kế toán.
 *   2. Từ NHẬN khớp trong TIÊU ĐỀ  -> nhận, độ tin cao ("strong").
 *   3. Không có gì ở tiêu đề, nhưng >= 2 từ NHẬN KHÁC NHAU trong mô tả
 *                                  -> nhận, độ tin thấp ("weak"), cần soi tay.
 *      Một từ trong mô tả thì không đủ: tin nào chẳng nhắc tới "nhà cung cấp".
 *   4. Còn lại                     -> loại.
 *
 * Từ XÁM (`~logistics`, `~kho vận`, ...) không bao giờ tự kéo tin vào ngành;
 * nó chỉ cộng điểm khi tiêu đề đã có một từ nhận thật. Đây là cách trả lời cho
 * câu "logistics có tính là thu mua không" mà không phải trả lời có/không cứng.
 */

export interface FieldDictionary {
  keywords: readonly string[];
  excludes: readonly string[];
}

/**
 * Cách chuẩn hoá chữ trước khi so khớp.
 *
 *   plain — `toMatchKey`: bỏ dấu, chỉ giữ chữ và số. Mặc định; ngành thu mua.
 *   tech  — `toTechKey`: như trên nhưng giữ nghĩa ".NET", "C#", "C++"...
 *           Ngành lập trình (docs/plan-swe.md §4.3).
 *
 * Chọn theo TỪ ĐIỂN (khai ở `SavedFilter.profile.matchKey`), không theo
 * workspace: từ điển lẫn tin phải đi qua CÙNG một hàm, lệch nhau là không khớp gì.
 */
export type MatchKeyMode = 'plain' | 'tech';

export interface CompileOptions {
  matchKey?: MatchKeyMode;
}

export interface CompiledField {
  /** Hàm chuẩn hoá đã dùng cho từ điển — tin phải đi qua đúng hàm này. */
  key: (input: string) => string;
  strong: CompiledTerm[];
  gray: CompiledTerm[];
  excludes: CompiledTerm[];
}

interface CompiledTerm {
  /** Nguyên văn như người viết trong từ điển, để in ra cho người đọc hiểu. */
  label: string;
  re: RegExp;
}

export type Verdict = 'strong' | 'weak' | 'reject';

export interface MatchResult {
  verdict: Verdict;
  /** Càng cao càng chắc. Chỉ dùng để XẾP THỨ TỰ khi soi, không phải ngưỡng. */
  score: number;
  titleHits: string[];
  descHits: string[];
  grayHits: string[];
  /** Từ loại đã chặn tin này, nếu có. Luôn nêu tên để gỡ rối được. */
  rejectedBy: string | null;
}

/**
 * Biên dịch từ điển một lần rồi dùng lại cho cả vạn tin.
 *
 * Ranh giới đầu từ (`\b` phía trước, KHÔNG có phía sau) là có chủ đích:
 * "buyer" phải bắt được "buyers", "mua hàng" phải bắt được "mua hàng hoá".
 * Chặn hai đầu thì mất một mảng lớn tin chỉ vì hậu tố.
 */
export function compileField(
  dictionary: FieldDictionary,
  options: CompileOptions = {},
): CompiledField {
  const key = options.matchKey === 'tech' ? toTechKey : toMatchKey;
  const strong: CompiledTerm[] = [];
  const gray: CompiledTerm[] = [];

  for (const raw of dictionary.keywords) {
    const isGray = raw.startsWith(GRAY_PREFIX);
    const label = isGray ? raw.slice(GRAY_PREFIX.length) : raw;
    const term = compileTerm(label, key);
    if (!term) continue;
    (isGray ? gray : strong).push(term);
  }

  const excludes = dictionary.excludes
    .map((raw) => compileTerm(raw, key))
    .filter((term): term is CompiledTerm => term !== null);

  return { key, strong, gray, excludes };
}

function compileTerm(label: string, toKey: (input: string) => string): CompiledTerm | null {
  const key = toKey(label);
  if (!key) return null;
  // `key` chỉ còn chữ, số và khoảng trắng sau toMatchKey nên không cần thoát
  // ký tự đặc biệt — nhưng vẫn thoát cho chắc, phòng khi toMatchKey đổi.
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { label, re: new RegExp(`\\b${escaped}`) };
}

export interface JobText {
  title: string;
  description?: string | null;
}

export function matchJob(field: CompiledField, job: JobText): MatchResult {
  const titleKey = field.key(job.title);
  const descKey = job.description ? field.key(job.description) : '';

  const blocked = field.excludes.find((term) => term.re.test(titleKey));
  if (blocked) {
    return {
      verdict: 'reject',
      score: 0,
      titleHits: [],
      descHits: [],
      grayHits: [],
      rejectedBy: blocked.label,
    };
  }

  const titleHits = field.strong.filter((t) => t.re.test(titleKey)).map((t) => t.label);
  const descHits = field.strong.filter((t) => t.re.test(descKey)).map((t) => t.label);

  if (titleHits.length > 0) {
    // Từ xám chỉ được tính ở đây — sau khi tiêu đề đã có từ nhận thật.
    const grayHits = field.gray.filter((t) => t.re.test(titleKey) || t.re.test(descKey));
    return {
      verdict: 'strong',
      score: titleHits.length * 10 + grayHits.length * 2 + Math.min(descHits.length, 5),
      titleHits,
      descHits,
      grayHits: grayHits.map((t) => t.label),
      rejectedBy: null,
    };
  }

  if (descHits.length >= 2) {
    return {
      verdict: 'weak',
      score: Math.min(descHits.length, 5),
      titleHits: [],
      descHits,
      grayHits: [],
      rejectedBy: null,
    };
  }

  return {
    verdict: 'reject',
    score: 0,
    titleHits: [],
    descHits,
    grayHits: [],
    rejectedBy: descHits.length === 1 ? 'chỉ 1 từ trong mô tả, không đủ' : 'không khớp từ nào',
  };
}

/** Tin thuộc ngành ở mức được đưa vào kết quả. */
export function isInField(result: MatchResult): boolean {
  return result.verdict !== 'reject';
}

/**
 * Tin có nằm trong TP.HCM "hẹp" không — tức HCM trước sáp nhập 2025.
 *
 * Bảng Location cố ý gộp Bình Dương và Bà Rịa – Vũng Tàu vào `ho-chi-minh` cho
 * đúng đơn vị hành chính hiện hành. Nhưng với người đi làm thì Thủ Đức và Bến
 * Cát là hai thế giới đi lại khác nhau, nên phải có đường thu hẹp lại — và
 * đường đó đi qua `JobLocation.rawText`, đúng thứ cột đó sinh ra để làm.
 */
const MERGED_INTO_HCM = ['binh duong', 'ba ria', 'vung tau', 'thu dau mot', 'di an', 'ben cat'];

export function isNarrowHcm(rawTexts: readonly string[]): boolean {
  const keys = rawTexts.map(toMatchKey);
  if (keys.length === 0) return false;
  // Chỉ loại khi MỌI địa điểm của tin đều thuộc phần sáp nhập. Tin đăng "HCM và
  // Bình Dương" vẫn là tin ở HCM.
  return !keys.every((key) => MERGED_INTO_HCM.some((name) => key.includes(name)));
}
