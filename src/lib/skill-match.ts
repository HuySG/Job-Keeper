import { toTechKey } from '@/crawler/normalize/text';

/**
 * Bóc KỸ NĂNG khỏi một tin — hàm thuần, không đụng DB.
 *
 * Crawler, `reparse`, `match` và (sau này) phần web dùng chung bộ luật này, cùng
 * lý do với `field-match`: một khái niệm định nghĩa ở hai chỗ thì sớm muộn hai
 * chỗ lệch nhau.
 *
 * Hai tầng, như `classifyPurchase`:
 *   declared — nguồn tự khai (`skills` của JSON-LD, `skills[].skillName` của
 *              VNW). Tin cậy.
 *   text     — quét tiêu đề + mô tả. Dự phòng; mô tả hay liệt kê "nice to have".
 *
 * Khớp CẢ HAI ĐẦU từ trên chuỗi đã qua `toTechKey` — "java" không khớp
 * "javascript", "react" không khớp "reactnative".
 */

export interface SkillDefinition {
  slug: string;
  name: string;
  category: string;
  aliases: readonly string[];
}

export type SkillOrigin = 'declared' | 'text';

export interface CompiledSkills {
  size: number;
  info: ReadonlyMap<string, { name: string; category: string }>;
  terms: readonly { slug: string; re: RegExp }[];
}

export function compileSkills(definitions: readonly SkillDefinition[]): CompiledSkills {
  const info = new Map<string, { name: string; category: string }>();
  const terms: { slug: string; re: RegExp }[] = [];

  for (const def of definitions) {
    info.set(def.slug, { name: def.name, category: def.category });
    for (const alias of def.aliases) {
      const key = toTechKey(alias);
      if (!key) continue;
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // `toTechKey` chỉ để lại chữ, số và MỘT khoảng trắng giữa các từ, nên
      // "ranh giới từ" chính là khoảng trắng hoặc đầu/cuối chuỗi.
      terms.push({ slug: def.slug, re: new RegExp(`(?:^| )${escaped}(?= |$)`) });
    }
  }

  return { size: info.size, info, terms };
}

/** Mọi kỹ năng nhắc tới trong một đoạn chữ. */
export function matchSkills(catalog: CompiledSkills, text: string | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!text || catalog.size === 0) return out;
  const key = toTechKey(text);
  for (const term of catalog.terms) {
    if (!out.has(term.slug) && term.re.test(key)) out.add(term.slug);
  }
  return out;
}

export interface SkillSourceText {
  title: string;
  description: string | null;
  /** Từng mục kỹ năng nguồn khai, đã tách — xem `NormalizedJob.skillTexts`. */
  declared: readonly string[];
}

/** Kỹ năng của một tin, kèm nguồn gốc. Nguồn khai thắng khi có cả hai. */
export function extractSkills(
  catalog: CompiledSkills,
  job: SkillSourceText,
): Map<string, SkillOrigin> {
  const out = new Map<string, SkillOrigin>();
  if (catalog.size === 0) return out;

  for (const item of job.declared) {
    for (const slug of matchSkills(catalog, item)) out.set(slug, 'declared');
  }
  const text = `${job.title}\n${job.description ?? ''}`;
  for (const slug of matchSkills(catalog, text)) {
    if (!out.has(slug)) out.set(slug, 'text');
  }
  return out;
}
