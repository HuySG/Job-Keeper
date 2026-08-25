import { z } from 'zod';

/**
 * Bộ bóc JSON-LD `JobPosting` dùng chung cho MỌI nguồn.
 *
 * Đây là trái tim của kiến trúc. Sáu nguồn đã kiểm (TopCV, ITviec, CareerViet,
 * vieclam24h, TopDev, + bất kỳ sàn nào lên được Google Jobs) đều nhúng khối này,
 * vì Google BẮT BUỘC thế. Nghĩa là Google đã ép cả thị trường chuẩn hoá dữ liệu
 * giúp ta — ta chỉ việc đọc, thay vì viết CSS selector riêng cho từng sàn.
 *
 * Nhưng: tin JSON-LD về CẤU TRÚC, không tin về CHẤT LƯỢNG. Mọi bẫy dưới đây
 * đều gặp thật khi khảo sát:
 *   - một trang có nhiều khối, JobPosting không phải khối đầu
 *   - khối bọc trong @graph, hoặc bản thân khối là một MẢNG
 *   - JSON bị HTML-escape (&quot;) thay vì để nguyên
 *   - bọc trong CDATA
 *   - `jobLocation` là mảng khi công ty có nhiều chi nhánh
 *   - `baseSalary` khi là QuantitativeValue, khi là số trần, khi thiếu hẳn
 *   - `validThrough` khi có timezone khi không
 */

const SCRIPT_RE =
  /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

/**
 * Lấy mọi khối ld+json trong trang và parse thành object.
 *
 * Khối nào parse hỏng thì BỎ QUA lặng lẽ chứ không ném lỗi: một trang có 4 khối,
 * hỏng 1 khối quảng cáo không được phép làm mất 3 khối còn lại.
 */
export function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  SCRIPT_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = SCRIPT_RE.exec(html)) !== null) {
    const raw = match[1];
    if (!raw) continue;
    const parsed = parseLoosely(raw);
    if (parsed !== undefined) blocks.push(parsed);
  }
  return blocks;
}

/**
 * Parse JSON theo kiểu "cố hết sức".
 *
 * Thứ tự thử phản ánh tần suất gặp thật: JSON sạch trước, rồi CDATA, rồi
 * HTML-escape, cuối cùng là dấu phẩy thừa.
 */
function parseLoosely(raw: string): unknown {
  const attempts = [
    (s: string) => s,
    stripCdata,
    (s: string) => decodeHtmlEntities(stripCdata(s)),
    (s: string) => stripTrailingCommas(decodeHtmlEntities(stripCdata(s))),
  ];

  for (const transform of attempts) {
    try {
      const text = transform(raw).trim();
      if (!text) return undefined;
      return JSON.parse(text);
    } catch {
      // thử cách tiếp theo
    }
  }
  return undefined;
}

function stripCdata(s: string): string {
  return s.replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '');
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&'); // &amp; PHẢI đứng cuối, nếu không &amp;quot; hỏng
}

function stripTrailingCommas(s: string): string {
  return s.replace(/,\s*([}\]])/g, '$1');
}

/**
 * Đi khắp cây JSON-LD nhặt mọi node có @type là JobPosting.
 *
 * Đi đệ quy chứ không chỉ nhìn cấp trên cùng, vì khối thật hay nằm trong
 * `@graph`, trong `mainEntity`, hoặc trong `itemListElement`. Nhìn nông là
 * bỏ sót đúng những nguồn mình cần.
 */
export function collectJobPostings(root: unknown, maxDepth = 8): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const seen = new Set<unknown>();

  const walk = (node: unknown, depth: number): void => {
    if (depth > maxDepth || node === null || typeof node !== 'object') return;
    if (seen.has(node)) return; // JSON-LD có thể tự tham chiếu vòng
    seen.add(node);

    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }

    const obj = node as Record<string, unknown>;
    if (isJobPostingType(obj['@type'])) {
      found.push(obj);
      // Không return: một JobPosting về lý thuyết vẫn có thể lồng cái khác.
    }

    for (const value of Object.values(obj)) walk(value, depth + 1);
  };

  walk(root, 0);
  return found;
}

/** `@type` có thể là chuỗi hoặc mảng chuỗi ("JobPosting" hoặc ["JobPosting"]). */
function isJobPostingType(type: unknown): boolean {
  if (typeof type === 'string') return type.endsWith('JobPosting');
  if (Array.isArray(type)) return type.some((t) => typeof t === 'string' && t.endsWith('JobPosting'));
  return false;
}

/** Đường tắt dùng thường xuyên nhất: HTML vào, danh sách JobPosting ra. */
export function extractJobPostings(html: string): Record<string, unknown>[] {
  const blocks = extractJsonLdBlocks(html);
  const all: Record<string, unknown>[] = [];
  for (const block of blocks) all.push(...collectJobPostings(block));
  return all;
}

/** Trang này có còn khối JobPosting không? Tầng 4 của máy kiểm còn-sống dùng. */
export function hasJobPosting(html: string): boolean {
  return extractJobPostings(html).length > 0;
}

// ─── Kiểm kiểu ───────────────────────────────────────────────────────────────

/**
 * Schema CỐ Ý LỎNG.
 *
 * Chỉ năm trường Google bắt buộc mới coi là bắt buộc, và ngay cả chúng cũng
 * nhận nhiều kiểu, vì mục đích ở đây là "chặn rác" chứ không phải "ép chuẩn".
 * Ép chặt thì nguồn nào lệch một tí là mất trắng tin đó — mà lệch là chuyện
 * hằng ngày. Việc nắn về đúng dạng là của tầng normalize.
 */
const flexibleString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .optional()
  .nullable();

export const JobPostingLdSchema = z
  .object({
    '@type': z.union([z.string(), z.array(z.string())]),
    title: flexibleString,
    description: flexibleString,
    datePosted: flexibleString,
    validThrough: flexibleString,
    employmentType: z.union([z.string(), z.array(z.string())]).optional().nullable(),
    identifier: z.unknown().optional(),
    hiringOrganization: z.unknown().optional(),
    jobLocation: z.unknown().optional(),
    jobLocationType: flexibleString,
    applicantLocationRequirements: z.unknown().optional(),
    baseSalary: z.unknown().optional(),
    estimatedSalary: z.unknown().optional(),
    industry: z.unknown().optional(),
    occupationalCategory: z.unknown().optional(),
    skills: z.unknown().optional(),
    experienceRequirements: z.unknown().optional(),
    qualifications: z.unknown().optional(),
    responsibilities: flexibleString,
    jobBenefits: z.unknown().optional(),
    totalJobOpenings: z.unknown().optional(),
    url: flexibleString,
    directApply: z.unknown().optional(),
  })
  .passthrough();

export type JobPostingLd = z.infer<typeof JobPostingLdSchema>;

export interface ValidationResult {
  posting: JobPostingLd | null;
  /** Trường Google bắt buộc mà khối này thiếu. Thiếu -> parseStatus PARTIAL. */
  missingRequired: string[];
}

/** Năm trường Google bắt buộc với JobPosting. Thiếu là tin có vấn đề thật. */
const GOOGLE_REQUIRED = ['title', 'description', 'datePosted', 'hiringOrganization', 'jobLocation'] as const;

export function validateJobPosting(raw: unknown): ValidationResult {
  const parsed = JobPostingLdSchema.safeParse(raw);
  if (!parsed.success) return { posting: null, missingRequired: ['@type'] };

  const posting = parsed.data;
  const missingRequired = GOOGLE_REQUIRED.filter((field) => {
    const value = (posting as Record<string, unknown>)[field];
    return value === undefined || value === null || value === '';
  });

  // jobLocation được phép vắng nếu tin khai là làm từ xa hoàn toàn — đúng theo
  // quy định của Google, và bỏ qua điều này là đánh dấu sai hàng loạt tin remote.
  //
  // CHỈ xét `jobLocationType`. `applicantLocationRequirements` KHÔNG có nghĩa
  // là làm từ xa — nó nói "ứng viên phải ở nước này". Fixture TopDev có cả
  // `jobLocation` (Hà Nội) lẫn `applicantLocationRequirements` (Vietnam); coi
  // trường sau là dấu hiệu remote là gán nhầm nhãn cho hàng loạt tin onsite.
  const isRemote = String(posting.jobLocationType ?? '').toUpperCase() === 'TELECOMMUTE';
  const filtered = isRemote
    ? missingRequired.filter((f) => f !== 'jobLocation')
    : missingRequired;

  return { posting, missingRequired: filtered };
}
