import { createHash } from 'node:crypto';

import { EmploymentType, ParseStatus, WorkMode, type Level } from '@/enums';

import type { JobPostingLd } from '../jsonld';
import { inferLevel } from './level';
import { extractLocations, isRemoteText, type Province } from './location';
import { parseSalaryJsonLd, parseSalaryText, type NormalizedSalary } from './salary';
import {
  canonicalizeUrl,
  htmlToText,
  normalizeCompanyName,
  normalizeTitle,
  normalizeWhitespace,
  toSlug,
  truncateBytes,
} from './text';

export { parseSalaryText, parseSalaryJsonLd } from './salary';
export { inferLevel, parseYearsOfExperience } from './level';
export { resolveProvince, extractLocations, PROVINCES } from './location';
export * from './text';

/** Trần cho descriptionText lưu trong Postgres. Toàn văn nằm ở blob store. */
const DESCRIPTION_MAX_BYTES = 8 * 1024;

export interface NormalizedJob {
  externalId: string;
  url: string;
  title: string;
  titleNorm: string;

  companyName: string;
  companyKey: string;
  companySlug: string;
  companyWebsite: string | null;
  companyLogoUrl: string | null;

  descriptionText: string | null;
  contentHash: string;

  salary: NormalizedSalary;

  employmentType: EmploymentType | null;
  workMode: WorkMode | null;
  level: Level | null;
  yearsExpMin: number | null;
  yearsExpMax: number | null;

  postedAt: Date;
  expiresAt: Date | null;

  locations: { raw: string; province: Province | null }[];
  skillTexts: string[];

  parseStatus: ParseStatus;
  parseError: string | null;
}

export interface NormalizeContext {
  /** URL trang chi tiết, dùng khi JSON-LD không tự khai `url`. */
  pageUrl: string;
  /** Hàm rút externalId từ URL — mỗi nguồn một kiểu. */
  externalIdFromUrl: (url: string) => string;
  /** Trường mà JSON-LD thiếu, adapter vá vào từ HTML (thường là lương). */
  fallback?: {
    salaryText?: string | null;
    skills?: string[];
    workMode?: WorkMode | null;
  };
}

/**
 * Nắn một khối JSON-LD `JobPosting` về bản ghi của ta.
 *
 * Nguyên tắc: **không bao giờ ném lỗi**. Một tin thiếu trường phải trở thành
 * `parseStatus = PARTIAL` chứ không được làm đổ cả lô — sáu nguồn chạy chung
 * một pipeline, và một tin dị dạng ở nguồn thứ tư không được phép xoá sổ ba
 * nguồn trước đó.
 */
export function normalizeJobPosting(
  ld: JobPostingLd,
  ctx: NormalizeContext,
): NormalizedJob {
  const problems: string[] = [];

  const url = canonicalizeUrl(str(ld.url) || ctx.pageUrl);
  const externalId = ctx.externalIdFromUrl(url) || hash(url).slice(0, 24);

  const title = normalizeWhitespace(str(ld.title));
  if (!title) problems.push('thiếu title');

  // ── Công ty ────────────────────────────────────────────────────────────────
  const org = asRecord(ld.hiringOrganization);
  const companyName = normalizeWhitespace(str(org?.['name'])) || 'Không rõ';
  if (companyName === 'Không rõ') problems.push('thiếu hiringOrganization.name');
  const companyKey = normalizeCompanyName(companyName);

  // ── Mô tả ──────────────────────────────────────────────────────────────────
  const descriptionRaw = str(ld.description);
  const descriptionText = descriptionRaw
    ? truncateBytes(htmlToText(descriptionRaw), DESCRIPTION_MAX_BYTES)
    : null;
  if (!descriptionText) problems.push('thiếu description');

  // ── Lương ──────────────────────────────────────────────────────────────────
  // JSON-LD trước (đã có cấu trúc), thất bại thì mới đọc chuỗi thô của adapter.
  let salary = parseSalaryJsonLd(ld.baseSalary);
  if (!salary || !salary.isPublic) {
    const fromText = parseSalaryText(ctx.fallback?.salaryText ?? null);
    if (fromText.isPublic) salary = fromText;
  }
  salary ??= parseSalaryText(null);
  if (salary.outOfRange) problems.push(`lương ngoài khoảng hợp lý: ${salary.raw}`);

  // ── Ngày tháng ─────────────────────────────────────────────────────────────
  const postedAt = parseDate(str(ld.datePosted));
  if (!postedAt) problems.push('thiếu/sai datePosted');
  const expiresAt = parseDate(str(ld.validThrough), { endOfDay: true });

  // ── Địa điểm ───────────────────────────────────────────────────────────────
  const locations = extractLocations(ld.jobLocation);
  const remote =
    String(ld.jobLocationType ?? '').toUpperCase() === 'TELECOMMUTE' ||
    isRemoteText(title) ||
    isRemoteText(descriptionText?.slice(0, 400) ?? '');
  const workMode: WorkMode | null =
    ctx.fallback?.workMode ??
    (remote ? WorkMode.REMOTE : isHybrid(title, descriptionText) ? WorkMode.HYBRID : WorkMode.ONSITE);
  if (locations.length === 0 && !remote) problems.push('thiếu jobLocation');

  // ── Cấp bậc ────────────────────────────────────────────────────────────────
  //
  // `experienceRequirements` trong thực tế hầu như LUÔN là object dạng
  // OccupationalExperienceRequirements với `monthsOfExperience` — cả ba fixture
  // thật đều thế (TopCV 36, TopDev 60, ITviec 10 tháng). Đây là tín hiệu kinh
  // nghiệm duy nhất có trong JSON-LD, nên phải đổi ra năm chứ không thể bỏ qua:
  // bỏ qua là mọi tin không ghi cấp bậc trong tiêu đề đều mất `level`.
  const months = toNumberOrNull(asRecord(ld.experienceRequirements)?.['monthsOfExperience']);
  const experienceText = [
    str(ld.experienceRequirements),
    months !== null ? `${Math.round(months / 12)} năm kinh nghiệm` : '',
    descriptionText?.slice(0, 1200) ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  const levelInfo = inferLevel(title, experienceText);

  return {
    externalId,
    url,
    title,
    titleNorm: normalizeTitle(title),

    companyName,
    companyKey,
    companySlug: toSlug(companyKey || companyName),
    companyWebsite: str(org?.['sameAs']) || str(org?.['url']) || null,
    companyLogoUrl: extractLogo(org),

    descriptionText,
    // Băm trên nội dung ĐÃ chuẩn hoá, không phải HTML thô: nguồn đổi một khoảng
    // trắng hay một thẻ div thì không được tính là "tin bị sửa".
    contentHash: hash(`${title}|${companyKey}|${descriptionText ?? ''}|${salary.min}|${salary.max}`),

    salary,

    employmentType: normalizeEmploymentType(ld.employmentType),
    workMode,
    level: levelInfo.level,
    yearsExpMin: levelInfo.yearsMin,
    yearsExpMax: levelInfo.yearsMax,

    postedAt: postedAt ?? new Date(),
    expiresAt,

    locations,
    skillTexts: extractSkillTexts(ld, ctx.fallback?.skills),

    parseStatus: problems.length === 0 ? ParseStatus.OK : ParseStatus.PARTIAL,
    parseError: problems.length ? problems.join('; ') : null,
  };
}

// ─── Phụ trợ ─────────────────────────────────────────────────────────────────

function str(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (Array.isArray(value) && value[0] && typeof value[0] === 'object') {
    return value[0] as Record<string, unknown>;
  }
  return null;
}

function hash(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

/**
 * Đọc ngày theo nhiều dạng gặp thật: "2026-08-06", "2026-09-05T23:59:59+07:00".
 *
 * Ngày trần không có giờ: `new Date("2026-08-06")` được hiểu là UTC nên ở
 * Việt Nam (UTC+7) sẽ hiện thành 07/08 — lệch một ngày. Với `validThrough`
 * thì lệch ấy nghĩa là tin bị coi là hết hạn sớm mất một ngày, nên ngày trần
 * được đẩy về cuối ngày.
 */
function parseDate(input: string, opts: { endOfDay?: boolean } = {}): Date | null {
  const text = input.trim();
  if (!text) return null;

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const iso = dateOnly ? `${text}T${opts.endOfDay ? '23:59:59' : '00:00:00'}+07:00` : text;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  // Chặn ngày phi lý: nguồn thỉnh thoảng trả 1970 hoặc 2099
  const year = date.getUTCFullYear();
  if (year < 2000 || year > 2100) return null;

  return date;
}

const EMPLOYMENT_MAP: Record<string, EmploymentType> = {
  FULL_TIME: EmploymentType.FULL_TIME,
  FULLTIME: EmploymentType.FULL_TIME,
  'TOÀN THỜI GIAN': EmploymentType.FULL_TIME,
  PART_TIME: EmploymentType.PART_TIME,
  PARTTIME: EmploymentType.PART_TIME,
  'BÁN THỜI GIAN': EmploymentType.PART_TIME,
  CONTRACTOR: EmploymentType.CONTRACT,
  CONTRACT: EmploymentType.CONTRACT,
  TEMPORARY: EmploymentType.TEMPORARY,
  INTERN: EmploymentType.INTERN,
  INTERNSHIP: EmploymentType.INTERN,
  'THỰC TẬP': EmploymentType.INTERN,
  OTHER: EmploymentType.OTHER,
};

function normalizeEmploymentType(value: unknown): EmploymentType | null {
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    const key = String(candidate ?? '').toUpperCase().replace(/[\s-]+/g, '_');
    const mapped = EMPLOYMENT_MAP[key];
    if (mapped) return mapped;
  }
  return null;
}

function isHybrid(title: string, description: string | null): boolean {
  const text = `${title} ${description?.slice(0, 400) ?? ''}`.toLowerCase();
  return /\bhybrid\b|\bket hop\b|\bkết hợp\b/.test(text);
}

function extractLogo(org: Record<string, unknown> | null): string | null {
  if (!org) return null;
  const logo = org['logo'];
  if (typeof logo === 'string') return logo;
  const record = asRecord(logo);
  return str(record?.['url']) || null;
}

/**
 * Gom mọi chuỗi có thể chứa kỹ năng. Việc ánh xạ chúng về bảng Skill là của
 * tầng sau (cần đọc SkillAlias trong DB), ở đây chỉ thu thập.
 */
function extractSkillTexts(ld: JobPostingLd, fallback?: string[]): string[] {
  const out = new Set<string>();

  const collect = (value: unknown): void => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) collect(item);
      return;
    }
    if (typeof value === 'string') {
      // Nguồn hay nhồi cả danh sách vào một chuỗi: "React, Node.js; TypeScript"
      for (const part of value.split(/[,;|/]|\s-\s/)) {
        const clean = normalizeWhitespace(part);
        if (clean && clean.length <= 40) out.add(clean);
      }
      return;
    }
    const record = asRecord(value);
    if (record) collect(record['name']);
  };

  collect(ld.skills);
  collect(ld.occupationalCategory);
  collect(ld.qualifications);
  for (const item of fallback ?? []) collect(item);

  return [...out];
}
