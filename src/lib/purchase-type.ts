import {
  NOISE_TOKENS,
  PURCHASE_TYPES,
  PURCHASE_TYPE_UNKNOWN,
  type PurchaseType,
} from '@/constants/purchase';
import { toMatchKey } from '@/crawler/normalize/text';

/**
 * Xếp một tin thu mua vào LOẠI: sản xuất, thương mại, xây dựng, dệt may...
 *
 * Hàm THUẦN, không đụng DB — cùng một bộ luật chạy cho trang web, cho script
 * soi và cho thống kê. Ngành mà định nghĩa ở hai chỗ thì sớm muộn hai chỗ lệch
 * nhau, và lúc đó không ai biết con số nào đúng.
 *
 * Hai tầng, theo đúng thứ tự tin cậy:
 *
 *   1. `industry` — do NGUỒN khai, có ở 258/258 tin đã đo. Đây là tín hiệu chính.
 *   2. tiêu đề + mô tả — chỉ dùng khi tầng 1 không nói gì.
 *
 * Tầng 2 cố ý yếu và đứng sau, vì đếm từ khoá trên mô tả tiếng Việt rất dễ sai:
 * đo thật cho ra "43% tin ngành dược" chỉ vì bỏ dấu xong "dược" trùng "được".
 */

export interface PurchaseTypeResult {
  slug: string;
  label: string;
  hint: string;
  /** Dựa vào đâu mà xếp — để người dùng biết có nên tin hay không. */
  basis: 'industry' | 'keyword' | 'none';
  /** Token ngành đã làm căn cứ, nếu có. */
  evidence: string | null;
}

const UNKNOWN: PurchaseTypeResult = {
  slug: PURCHASE_TYPE_UNKNOWN.slug,
  label: PURCHASE_TYPE_UNKNOWN.label,
  hint: PURCHASE_TYPE_UNKNOWN.hint,
  basis: 'none',
  evidence: null,
};

/** Biên dịch một lần lúc nạp module: bảng tra chạy cho cả nghìn tin mỗi lần tải trang. */
const NOISE = new Set(NOISE_TOKENS.map(toMatchKey));
const COMPILED = PURCHASE_TYPES.map((type) => ({
  type,
  industryKeys: type.industryKeys.map(toMatchKey).filter(Boolean),
  keywordRes: type.keywords
    .map(toMatchKey)
    .filter(Boolean)
    .map((k) => new RegExp(String.raw`\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)),
}));

export function classifyPurchase(job: {
  industry?: string | null;
  title?: string | null;
  descriptionText?: string | null;
}): PurchaseTypeResult {
  // ── Tầng 1: ngành do nguồn khai ────────────────────────────────────────────
  //
  // Tách theo dấu phẩy trước: vieclam24h nối danh mục nghề vào cùng ô, kiểu
  // "Xây dựng,Thu mua - Kho Vận - Chuỗi cung ứng". Không tách và không loại
  // token rác thì mọi tin của nguồn đó đều rơi vào "hậu cần".
  const tokens = (job.industry ?? '')
    .split(',')
    .map((t) => toMatchKey(t))
    .filter((t) => t && !NOISE.has(t));

  for (const { type, industryKeys } of COMPILED) {
    for (const token of tokens) {
      const hit = industryKeys.find((key) => token.includes(key));
      if (hit) {
        return { ...toResult(type), basis: 'industry', evidence: token };
      }
    }
  }

  // ── Tầng 2: từ khoá, chỉ khi ngành im lặng ─────────────────────────────────
  const haystack = toMatchKey(`${job.title ?? ''} ${job.descriptionText ?? ''}`);
  if (haystack) {
    for (const { type, keywordRes } of COMPILED) {
      if (keywordRes.some((re) => re.test(haystack))) {
        return { ...toResult(type), basis: 'keyword', evidence: null };
      }
    }
  }

  return UNKNOWN;
}

function toResult(type: PurchaseType): PurchaseTypeResult {
  return {
    slug: type.slug,
    label: type.label,
    hint: type.hint,
    basis: 'none',
    evidence: null,
  };
}

/** Mọi loại, kèm mục "chưa phân loại" ở cuối — cho ô lọc trên giao diện. */
export function allPurchaseTypes(): { slug: string; label: string; hint: string }[] {
  return [
    ...PURCHASE_TYPES.map((t) => ({ slug: t.slug, label: t.label, hint: t.hint })),
    { ...PURCHASE_TYPE_UNKNOWN },
  ];
}
