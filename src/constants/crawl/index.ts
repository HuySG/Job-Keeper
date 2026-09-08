/**
 * Quy tắc thu thập — CÀI CỨNG, không phải tuỳ chọn.
 *
 * Đây là chỗ duy nhất định nghĩa "lịch sự" nghĩa là gì. Đặt ở constants chứ
 * không rải trong từng adapter, để không adapter nào lách được.
 */

/** Nghỉ tối thiểu giữa hai request TỚI CÙNG MỘT HOST. */
export const MIN_DELAY_MS = Number(process.env.CRAWL_MIN_DELAY_MS ?? 2000);

/** Mỗi host chỉ một request tại một thời điểm. Song song là song song GIỮA các host. */
export const MAX_CONCURRENT_PER_HOST = 1;

/** Trần số host chạy song song, để không đốt hết băng thông máy chạy. */
export const MAX_CONCURRENT_HOSTS = 4;

export const REQUEST_TIMEOUT_MS = 25_000;

/**
 * Gặp các mã này là nguồn đang bảo "đừng nữa" -> DỪNG CẢ PHIÊN cho host đó,
 * không thử lại. Thử lại khi bị 429 là cách nhanh nhất để bị chặn vĩnh viễn.
 */
export const ABORT_STATUS_CODES: readonly number[] = [429, 503];

/** Chỉ thử lại với lỗi mạng thoáng qua và 5xx (trừ 503 ở trên). */
export const MAX_RETRIES = 2;
export const RETRY_BACKOFF_MS = 5_000;

/**
 * Mã trả về CHẬP CHỜN — thử lại đúng MỘT lần rồi thôi.
 *
 * Bình thường 403 nghĩa là "không cho phép" và phải tôn trọng ngay. Nhưng đo
 * thật trên `topcv.vn/sitemap.xml` ngày 25/08/2026: cùng một request, cùng một
 * User-Agent, ba lần liên tiếp cho ra **403 → 200 → 200**. Đó là hành vi chập
 * chờn của tầng biên (Cloudflare), không phải quyết định của toà soạn.
 *
 * Chính sách: thử lại một lần với backoff dài. **403 hai lần liên tiếp thì coi
 * là chặn thật và bỏ qua** — không thử lần thứ ba. Ranh giới này cố ý đặt thấp:
 * thà bỏ sót một trang còn hơn để crawler gõ cửa mãi một nơi đã nói không.
 */
export const FLAKY_STATUS_CODES: readonly number[] = [403, 408, 425];
export const FLAKY_MAX_RETRIES = 1;
export const FLAKY_BACKOFF_MS = 8_000;

/** robots.txt được nhớ trong bộ nhớ suốt phiên, hết hạn sau ngần này. */
export const ROBOTS_CACHE_TTL_MS = 60 * 60 * 1000;

/** Trần trang sitemap đọc mỗi nguồn mỗi lần chạy, tránh vô tình quét cả sàn. */
export const MAX_SITEMAP_PAGES_PER_SOURCE = Number(
  process.env.CRAWL_MAX_PAGES_PER_SOURCE ?? 50,
);

/** Sitemap index có thể lồng nhau; chặn lại để không đi vào vòng lặp. */
export const MAX_SITEMAP_DEPTH = 3;

/** Trần số trang chi tiết tải mỗi nguồn mỗi lần chạy. */
export const MAX_DETAIL_PAGES_PER_SOURCE = 300;

/**
 * User-Agent PHẢI định danh được và liên hệ được. Không giả làm Chrome.
 * Đây vừa là phép lịch sự vừa là tự bảo vệ: nguồn nào khó chịu thì họ email
 * cho ta trước khi họ chặn ta.
 */
export function buildUserAgent(): string {
  const bot = process.env.CRAWLER_BOT_NAME || 'BaeJobBot';
  const email = process.env.CRAWLER_CONTACT_EMAIL;
  if (!email) {
    throw new Error(
      'Thiếu CRAWLER_CONTACT_EMAIL. User-Agent bắt buộc phải liên hệ được — ' +
        'xem .env.example và TECHSTACK.md §4.',
    );
  }
  return `${bot}/0.1 (+mailto:${email})`;
}

// ─── Máy kiểm "còn sống" (TECHSTACK.md §4) ───────────────────────────────────

/** Vắng khỏi sitemap từng này lần liên tiếp -> STALE. */
export const MISS_COUNT_TO_STALE = 1;

/** Vắng khỏi sitemap từng này lần liên tiếp -> CLOSED. */
export const MISS_COUNT_TO_CLOSED = 3;

/**
 * Tầng 4 (GET thật, tốn request) chỉ chạy cho job thoả MỘT trong ba điều kiện.
 * Nhờ ba cái van này mà ngân sách là ~500–1.000 request/ngày thay vì 10.000.
 */
/** (a) validThrough còn <= ngần này ngày */
export const RECHECK_BEFORE_EXPIRY_DAYS = 3;
/** (b) đã vắng sitemap ít nhất 1 lần — dùng MISS_COUNT_TO_STALE ở trên */
/** (c) chưa gọi HTTP vào trang này quá ngần này ngày */
export const RECHECK_STALE_AFTER_DAYS = 7;

/** Trần request cho một lần chạy máy kiểm, để không bao giờ vượt ngân sách. */
export const MAX_RECHECKS_PER_RUN = 1_000;

/**
 * Dấu hiệu "tin đã hết hạn" viết bằng chữ trong trang. Tầng 4 dùng khi trang
 * vẫn trả 200 nhưng nội dung đã là trang báo hết hạn.
 */
export const EXPIRY_TEXT_MARKERS: readonly string[] = [
  'tin tuyển dụng đã hết hạn',
  'tin đã hết hạn',
  'việc làm đã hết hạn',
  'đã ngừng tuyển',
  'không còn tuyển dụng',
  'job has expired',
  'this job is no longer',
  'no longer available',
  // Thêm 08/09/2026 sau khi đo trượt một tin thật. vieclam24h
  // `.../truong-phong-mua-hang-c14p122id200731476.html` trả HTTP 200, khối
  // JSON-LD JobPosting VẪN CÒN NGUYÊN, `validThrough` đã qua 30 ngày, và câu
  // báo trong trang là "Việc làm NÀY đã hết hạn nộp hồ sơ" — chữ "này" ở giữa
  // làm mọi mẫu bên trên trượt hết. Bài học: khớp cụm ngắn, đừng khớp cả câu.
  'hết hạn nộp hồ sơ',
  'ngừng nhận hồ sơ',
  'đã đóng tuyển dụng',
  'tuyển dụng đã đóng',
  'position has been filled',
  'applications are closed',
];

// ─── Ngưỡng dữ liệu ──────────────────────────────────────────────────────────

/**
 * Khoảng lương coi là hợp lý cho VND/tháng. Ngoài khoảng này thì gần như chắc
 * chắn parser đọc sai đơn vị (nhầm "triệu" với "đồng") -> đánh dấu PARTIAL
 * thay vì để số rác lọt vào trung vị.
 */
export const SALARY_VND_MONTH_MIN = 1_000_000;
export const SALARY_VND_MONTH_MAX = 500_000_000;

/** Tin cũ hơn ngần này ngày thì không nạp nữa khi crawl thường (không phải backfill). */
export const MAX_POSTING_AGE_DAYS = 120;

/** Dữ liệu cũ hơn ngần này giờ thì /api/health trả 503. */
export const STALE_DATA_THRESHOLD_HOURS = 24;
