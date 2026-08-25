/**
 * Giá trị hằng dùng chung giữa crawler, DB và (sau này) web.
 *
 * Cố ý dùng object + `as const` thay vì `enum` của TypeScript: `enum` sinh ra
 * mã runtime và không so sánh được trực tiếp với chuỗi đọc từ DB, còn thứ ta
 * cần là một union kiểu chuỗi khớp thẳng với cột String trong Prisma.
 */

/**
 * Vòng đời một tin đăng. Máy trạng thái đầy đủ ở TECHSTACK.md §4.
 *
 *   OPEN    — còn hiệu lực, được vào thống kê và kết quả tìm kiếm
 *   STALE   — đã vắng khỏi sitemap 1–2 lần, vẫn hiện nhưng gắn nhãn "chưa xác nhận"
 *   EXPIRED — hết hạn theo đúng ba tín hiệu Google bắt các sàn tuân thủ:
 *             validThrough đã qua, HTTP 404/410, hoặc khối JSON-LD biến mất
 *   CLOSED  — vắng khỏi sitemap từ 3 lần liên tiếp trở lên
 */
export const JobStatus = {
  OPEN: 'OPEN',
  STALE: 'STALE',
  EXPIRED: 'EXPIRED',
  CLOSED: 'CLOSED',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

/** Chỉ tin OPEN mới được đưa vào SalaryStat và kết quả tìm kiếm mặc định. */
export const COUNTABLE_STATUSES: readonly JobStatus[] = [JobStatus.OPEN];

/** Lý do chuyển trạng thái — ghi vào JobPosting.statusReason để gỡ rối được. */
export const StatusReason = {
  VALID_THROUGH_PASSED: 'valid_through_passed',
  HTTP_GONE: 'http_gone',
  JSONLD_REMOVED: 'jsonld_removed',
  EXPIRY_MARKER_IN_PAGE: 'expiry_marker_in_page',
  MISSING_FROM_SITEMAP: 'missing_from_sitemap',
  SEEN_AGAIN: 'seen_again',
  REPOSTED: 'reposted',
} as const;
export type StatusReason = (typeof StatusReason)[keyof typeof StatusReason];

/** schema.org/JobPosting employmentType, giữ nguyên tên chuẩn. */
export const EmploymentType = {
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  CONTRACT: 'CONTRACT',
  TEMPORARY: 'TEMPORARY',
  INTERN: 'INTERN',
  OTHER: 'OTHER',
} as const;
export type EmploymentType = (typeof EmploymentType)[keyof typeof EmploymentType];

export const WorkMode = {
  ONSITE: 'ONSITE',
  HYBRID: 'HYBRID',
  REMOTE: 'REMOTE',
} as const;
export type WorkMode = (typeof WorkMode)[keyof typeof WorkMode];

/**
 * Cấp bậc. Thứ tự trong mảng LEVEL_ORDER là thứ tự thăng tiến, dùng khi cần so
 * sánh "cao hơn/thấp hơn" trong thống kê.
 */
export const Level = {
  INTERN: 'INTERN',
  FRESHER: 'FRESHER',
  JUNIOR: 'JUNIOR',
  MID: 'MID',
  SENIOR: 'SENIOR',
  LEAD: 'LEAD',
  MANAGER: 'MANAGER',
} as const;
export type Level = (typeof Level)[keyof typeof Level];

export const LEVEL_ORDER: readonly Level[] = [
  Level.INTERN,
  Level.FRESHER,
  Level.JUNIOR,
  Level.MID,
  Level.SENIOR,
  Level.LEAD,
  Level.MANAGER,
];

export const Currency = {
  VND: 'VND',
  USD: 'USD',
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

/** Chu kỳ lương gốc trong tin. Mọi thứ được quy về MONTH trước khi thống kê. */
export const SalaryPeriod = {
  HOUR: 'HOUR',
  DAY: 'DAY',
  WEEK: 'WEEK',
  MONTH: 'MONTH',
  YEAR: 'YEAR',
} as const;
export type SalaryPeriod = (typeof SalaryPeriod)[keyof typeof SalaryPeriod];

/**
 * Kiểu adapter của một nguồn.
 *
 *   api            — nguồn có API JSON (VietnamWorks). Rẻ nhất, sạch nhất.
 *   sitemap-jsonld — đi sitemap để tìm URL, đọc JSON-LD ở trang chi tiết.
 *                    Đây là đường chính: 6/6 nguồn đã kiểm đều có JobPosting,
 *                    vì Google bắt buộc thế để lên Google Jobs. TECHSTACK.md §2
 *   list-jsonld    — không có sitemap dùng được, phải bò qua trang danh sách
 */
export const SourceKind = {
  API: 'api',
  SITEMAP_JSONLD: 'sitemap-jsonld',
  LIST_JSONLD: 'list-jsonld',
} as const;
export type SourceKind = (typeof SourceKind)[keyof typeof SourceKind];

export const CrawlTrigger = {
  CRON: 'cron',
  MANUAL: 'manual',
  BACKFILL: 'backfill',
  REPARSE: 'reparse',
  RECHECK: 'recheck',
} as const;
export type CrawlTrigger = (typeof CrawlTrigger)[keyof typeof CrawlTrigger];

export const RunStatus = {
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  /** Dừng giữa chừng vì nguồn trả 429/503 — không phải lỗi của ta. */
  ABORTED: 'ABORTED',
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export const ParseStatus = {
  OK: 'OK',
  /** Lấy được tin nhưng thiếu trường quan trọng (thường là lương). */
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
} as const;
export type ParseStatus = (typeof ParseStatus)[keyof typeof ParseStatus];

export const SkillCategory = {
  LANG: 'LANG',
  FRAMEWORK: 'FRAMEWORK',
  DB: 'DB',
  CLOUD: 'CLOUD',
  TOOL: 'TOOL',
  DOMAIN: 'DOMAIN',
  SOFT: 'SOFT',
} as const;
export type SkillCategory = (typeof SkillCategory)[keyof typeof SkillCategory];
