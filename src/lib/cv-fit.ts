import { toTechKey } from '@/crawler/normalize/text';
import { Level, WorkMode } from '@/enums';
import type { CvProfile } from '@/lib/cv-profile';
import { matchSkills, type CompiledSkills, type SkillOrigin } from '@/lib/skill-match';

/**
 * "Độ hợp CV" — tầng thứ hai của ngành lập trình (docs/plan-swe.md §5).
 *
 * Thuộc ngành chưa đủ: "Java Developer" thuộc ngành nhưng vô dụng với CV .NET.
 * Hàm THUẦN: nhận hồ sơ, danh mục kỹ năng và một tin đã bóc sẵn kỹ năng; không
 * đụng DB, không đọc mô tả — mô tả chỉ được đọc lúc cào để ghi `JobSkill`
 * (plan §8.6), nên chấm cả nghìn tin lúc tải trang vẫn nhẹ.
 *
 *   tin ─► cờ cứng? ── có ──► "Lệch" (vẫn nêu lý do)
 *            │ không
 *            ▼
 *          điểm 0–100 ──► Rất hợp / Hợp / Với tới / Lệch
 *
 * Điểm chỉ để XẾP THỨ TỰ. Giao diện hiện mức + lời giải, KHÔNG hiện phần trăm:
 * một con số chính xác tới hàng đơn vị cho một phép cộng trọng số tự đặt là độ
 * chính xác giả (plan §5.4).
 */

export interface FitJob {
  title: string;
  level: string | null;
  yearsExpMin: number | null;
  workMode: string | null;
  district: string | null;
  /** Kỹ năng đã bóc (bảng `JobSkill`): slug → nguồn gốc. */
  skills: ReadonlyMap<string, SkillOrigin>;
}

export type FitBand = 'great' | 'good' | 'stretch' | 'off' | 'unknown';

/** Cờ cứng — có là "Lệch", bất kể điểm. */
export type FitFlag = 'too-senior' | 'other-stack' | 'lang-required';

export interface FitResult {
  band: FitBand;
  score: number;
  flags: FitFlag[];
  /** Kỹ năng CV có mà tin đòi (lõi + cộng thêm), theo thứ tự của hồ sơ. */
  matched: string[];
  /** Kỹ năng thị trường hay đòi mà CV chưa có (`profile.gaps`), tin này có nhắc. */
  missing: string[];
  /** Lời giải bằng tiếng Việt, theo thứ tự quan trọng. */
  reasons: string[];
}

export const FIT_BAND_LABELS: Readonly<Record<FitBand, string>> = {
  great: 'Rất hợp',
  good: 'Hợp',
  stretch: 'Với tới',
  off: 'Lệch',
  unknown: 'Không đủ dữ liệu',
};

const BAND_RANK: Readonly<Record<FitBand, number>> = { unknown: 0, off: 1, stretch: 2, good: 3, great: 4 };

export function scoreFit(profile: CvProfile, catalog: CompiledSkills, job: FitJob): FitResult {
  const titleKey = toTechKey(job.title);
  const titleSkills = matchSkills(catalog, job.title);

  /** Tiêu đề + nguồn khai — bằng chứng mạnh. */
  const strong = new Set<string>(titleSkills);
  /** Mọi kỹ năng, kể cả chỉ thấy trong mô tả. */
  const any = new Set<string>(titleSkills);
  for (const [slug, origin] of job.skills) {
    any.add(slug);
    if (origin === 'declared') strong.add(slug);
  }

  const flags: FitFlag[] = [];
  const reasons: string[] = [];
  const matched: string[] = [];
  let score = 0;

  // ── Lõi stack ──────────────────────────────────────────────────────────────
  for (const group of profile.core) {
    const inStrong = group.skills.filter((s) => strong.has(s));
    const inAny = group.skills.filter((s) => any.has(s));
    if (inStrong.length > 0) score += group.weight;
    else if (inAny.length > 0) score += group.weight / 2;
    for (const s of inAny) if (!matched.includes(s)) matched.push(s);
  }

  // ── Cộng thêm ──────────────────────────────────────────────────────────────
  const bonus = profile.bonus.skills.filter((s) => any.has(s));
  score += Math.min(bonus.length * profile.bonus.each, profile.bonus.cap);
  matched.push(...bonus.filter((s) => !matched.includes(s)));

  // ── Stack khác ─────────────────────────────────────────────────────────────
  // "Stack của CV" là phần lõi KHÔNG phải CSDL: "Java Developer SQL" vẫn là việc
  // Java, dù SQL nằm trong CV.
  const cvStack = profile.core
    .flatMap((g) => g.skills)
    .filter((s) => catalog.info.get(s)?.category !== 'DB');
  const otherInTitle = profile.otherStacks.skills.filter((s) => titleSkills.has(s));
  const exclusiveInTitle = profile.otherStacks.exclusive.filter((s) => titleSkills.has(s));
  if (exclusiveInTitle.length > 0) {
    flags.push('other-stack');
    reasons.push(`nghề khác: ${exclusiveInTitle.map((s) => nameOf(catalog, s)).join(', ')}`);
  } else if (otherInTitle.length > 0) {
    const names = otherInTitle.map((s) => nameOf(catalog, s)).join(', ');
    if (cvStack.some((s) => titleSkills.has(s))) {
      score += profile.otherStacks.mixedPenalty;
      reasons.push(`trộn stack khác: ${names}`);
    } else {
      flags.push('other-stack');
      reasons.push(`stack chính: ${names}`);
    }
  }

  const mismatch = profile.frontendMismatch.skills.filter((s) => strong.has(s));
  const hasCvFrontend = profile.frontendMismatch.unless.some((s) => any.has(s));
  if (mismatch.length > 0 && !hasCvFrontend) {
    score += profile.frontendMismatch.penalty;
    const wanted = profile.frontendMismatch.unless.map((s) => nameOf(catalog, s)).join('/');
    reasons.push(`frontend ${mismatch.map((s) => nameOf(catalog, s)).join('/')} thay vì ${wanted}`);
  }

  // ── Cấp bậc ────────────────────────────────────────────────────────────────
  const seniorWord = profile.level.seniorTitleWords.find((w) => hasWord(titleKey, w));
  const gap = job.yearsExpMin === null ? null : job.yearsExpMin - profile.yearsExp;

  if (seniorWord || job.level === Level.LEAD || job.level === Level.MANAGER) {
    flags.push('too-senior');
    reasons.push(seniorWord ? `vị trí "${seniorWord}"` : `cấp ${job.level}`);
  } else if (gap !== null && gap >= profile.level.tooSeniorGap) {
    flags.push('too-senior');
    reasons.push(`đòi ${job.yearsExpMin} năm (CV ${profile.yearsExp} năm)`);
  }

  const underLevel = job.level === Level.INTERN || job.level === Level.FRESHER;
  let levelPoints: number;
  if (underLevel) {
    levelPoints = profile.level.underLevel;
    reasons.push('cấp thực tập / mới ra trường');
  } else if (gap === null) {
    levelPoints = profile.level.unknown;
    reasons.push('không ghi số năm');
  } else if (gap <= 0) {
    levelPoints = profile.level.within;
  } else if (gap === 1) {
    levelPoints = profile.level.plusOne;
  } else {
    levelPoints = profile.level.plusTwo;
  }
  if (gap !== null && gap > 0 && gap < profile.level.tooSeniorGap) {
    reasons.push(`đòi ${job.yearsExpMin} năm`);
  }
  if (job.level === Level.SENIOR) {
    levelPoints = Math.min(levelPoints, profile.level.seniorCap);
    reasons.push('cấp Senior');
  }
  score += levelPoints;

  // ── Ngoại ngữ ──────────────────────────────────────────────────────────────
  const langWord = profile.language.hardTitleWords.find((w) => hasWord(titleKey, w));
  const langDeclared = profile.language.requiredSkills.filter((s) => job.skills.get(s) === 'declared');
  if (langWord || langDeclared.length > 0) {
    flags.push('lang-required');
    reasons.push(`đòi ${langWord ?? langDeclared.map((s) => nameOf(catalog, s)).join(', ')}`);
  } else {
    const langText = profile.language.requiredSkills.filter((s) => any.has(s));
    if (langText.length > 0) {
      score += profile.language.softPenalty;
      reasons.push(`mô tả nhắc ${langText.map((s) => nameOf(catalog, s)).join(', ')}`);
    }
  }

  if (
    any.has(profile.language.englishSkill) ||
    profile.language.englishTitleWords.some((w) => hasWord(titleKey, w))
  ) {
    score += profile.language.englishPenalty;
    reasons.push('đòi tiếng Anh tốt');
  }

  // ── Điều kiện làm việc ─────────────────────────────────────────────────────
  if (job.workMode === WorkMode.REMOTE || job.workMode === WorkMode.HYBRID) {
    score += profile.conditions.remoteOrHybrid;
    reasons.push(job.workMode === WorkMode.REMOTE ? 'làm từ xa' : 'hybrid');
  }
  if (job.district && profile.conditions.homeDistricts.some((d) => sameText(d, job.district!))) {
    score += profile.conditions.homeDistrict;
    reasons.push(`gần nhà (${job.district})`);
  }
  const domain = profile.conditions.domain.skills.filter((s) => any.has(s));
  if (domain.length > 0) {
    score += profile.conditions.domain.points;
    reasons.push(`miền ${domain.map((s) => nameOf(catalog, s)).join(', ')}`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const missing = profile.gaps.filter((s) => any.has(s));

  // Không một kỹ năng kỹ thuật nào (REQ không tính) → không có gì để chấm.
  const technical = [...any].some((s) => catalog.info.get(s)?.category !== 'REQ');

  let band: FitBand;
  if (flags.length > 0) band = 'off';
  else if (!technical) band = 'unknown';
  else if (score >= profile.bands.great) band = 'great';
  else if (score >= profile.bands.good) band = 'good';
  else if (score >= profile.bands.stretch) band = 'stretch';
  else band = 'off';

  if (underLevel && BAND_RANK[band] > BAND_RANK[profile.level.underLevelMaxBand]) {
    band = profile.level.underLevelMaxBand;
  }

  return { band, score, flags, matched, missing, reasons };
}

/**
 * Một dòng đọc được: "khớp .NET, SQL Server · thiếu Azure · đòi 3 năm".
 * Không có phần trăm, không có điểm — xem chú thích đầu file.
 */
export function explainFit(result: FitResult, catalog: CompiledSkills): string {
  const parts: string[] = [];
  if (result.matched.length > 0) {
    parts.push(`khớp ${result.matched.map((s) => nameOf(catalog, s)).join(', ')}`);
  }
  if (result.missing.length > 0) {
    parts.push(`thiếu ${result.missing.map((s) => nameOf(catalog, s)).join(', ')}`);
  }
  parts.push(...result.reasons);
  return parts.join(' · ');
}

function nameOf(catalog: CompiledSkills, slug: string): string {
  return catalog.info.get(slug)?.name ?? slug;
}

/** Từ (hoặc cụm từ) đứng riêng trong chuỗi đã qua `toTechKey`. */
function hasWord(key: string, word: string): boolean {
  const w = toTechKey(word);
  return w.length > 0 && ` ${key} `.includes(` ${w} `);
}

function sameText(a: string, b: string): boolean {
  return toTechKey(a) === toTechKey(b);
}
