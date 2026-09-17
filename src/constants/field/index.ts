/**
 * Định nghĩa "ngành của tôi" — nạp vào bảng `SavedFilter`.
 *
 * Đây là DỮ LIỆU seed, không phải cấu hình runtime. Sau khi seed, sửa từ điển
 * là `UPDATE SavedFilter SET keywords = ...` — **không deploy, không sửa code**.
 * Để ở đây chỉ để lần cài đặt đầu tiên có ngay thứ chạy được, giống cách
 * `SOURCE_SEEDS` làm với bảng `Source`.
 *
 * Vì sao không dùng một từ khoá: đo thật trên API VietnamWorks 08/09/2026 —
 * "mua hang" 1.258 tin · "purchasing" 1.200 · "procurement" 849 · "cung ung" 474
 * · "thu mua" 407 · "sourcing" 351 · "merchandiser" 112. Cùng một nghề, bảy
 * cách gọi, và một từ khoá bắt được chưa tới một phần ba.
 */

/**
 * Tiền tố đánh dấu từ **XÁM** trong `SavedFilter.keywords`.
 *
 * Từ xám là nghề *cạnh* ngành chứ không phải ngành: `logistics`,
 * `xuất nhập khẩu`, `kho vận`, `điều phối`. Lấy hết thì kho phồng gấp đôi bằng
 * việc kho bãi, bỏ hết thì mất mảng "supply chain có làm mua hàng".
 *
 * Quy ước: từ xám **chỉ được tính khi tiêu đề CŨNG có một từ nhận thật**. Nó
 * không bao giờ tự mình kéo một tin vào ngành.
 *
 * Dùng tiền tố thay vì thêm cột: `SavedFilter.keywords` là `String[]`, nhét
 * quy ước vào giá trị thì sửa bằng SQL được ngay, còn thêm cột là một lần
 * migrate cho một khái niệm chưa chắc sống quá tháng sau.
 */
export const GRAY_PREFIX = '~';

/**
 * Ngành mà mọi trang dùng khi URL không chỉ định `?f=`.
 *
 * Tổng quan, Kho tin, Lương và Nguồn đều nói về "ngành của bạn" ở số ít — công
 * cụ này là của một người. Có thêm ngành thì trang Ngành và Cài đặt đổi được
 * bằng `?f=`, còn bốn trang kia vẫn neo vào ngành này.
 */
export const DEFAULT_FIELD_SLUG = 'thu-mua-hcm';

/**
 * Coi là "vừa kiểm" nếu đã gọi HTTP/API vào tận trang tin trong ngần này giờ.
 * Ở đây chứ không ở `api/field.api` vì giao diện phía trình duyệt cũng cần.
 */
export const FRESH_CHECK_HOURS = 48;

export interface FieldSeed {
  slug: string;
  name: string;
  /** Từ NHẬN. Tiền tố `~` = từ xám, xem `GRAY_PREFIX`. */
  keywords: readonly string[];
  /** Khớp trong TIÊU ĐỀ là loại thẳng, kể cả khi từ nhận cũng khớp. */
  excludes: readonly string[];
  provinces: readonly string[];
  includeNoSalary: boolean;
  maxAgeDays: number | null;
  note: string;
}

export const FIELD_SEEDS: readonly FieldSeed[] = [
  {
    slug: 'thu-mua-hcm',
    name: 'Thu mua — TP.HCM',

    keywords: [
      // ── Lõi tiếng Việt ─────────────────────────────────────────────────────
      'thu mua',
      'mua hàng',
      'mua sắm',
      'vật tư',
      'nhà cung cấp',
      'cung ứng',
      'chuỗi cung ứng',
      'đấu thầu',
      'thầu mua sắm',
      // ── Lõi tiếng Anh ──────────────────────────────────────────────────────
      'purchasing',
      'purchaser',
      'procurement',
      'sourcing',
      'strategic sourcing',
      'buyer',
      'category buyer',
      'merchandiser',
      'merchandise',
      'supply chain',
      'supplier',
      'supplier quality',
      'sqe',
      'vendor',
      'commodity',
      'tender',
      'quotation',
      'rfq',
      // ── Xám: chỉ tính khi tiêu đề cũng có một từ lõi ở trên ────────────────
      `${GRAY_PREFIX}logistics`,
      `${GRAY_PREFIX}xuất nhập khẩu`,
      `${GRAY_PREFIX}kho vận`,
      `${GRAY_PREFIX}điều phối`,
      `${GRAY_PREFIX}planner`,
      `${GRAY_PREFIX}mrp`,
      `${GRAY_PREFIX}erp`,
    ],

    excludes: [
      // ── Nhiễu số 1: SALES đội lốt mua hàng ─────────────────────────────────
      // "Nhân viên tư vấn mua hàng" là bán hàng, không phải thu mua.
      'tư vấn mua hàng',
      'bán hàng',
      'nhân viên kinh doanh',
      'chuyên viên kinh doanh',
      'trưởng phòng kinh doanh',
      'kinh doanh vật tư',
      'kinh doanh đấu thầu',
      'telesale',
      'telesales',
      'chăm sóc khách hàng',
      // ── Nhiễu số 2: KHO BÃI — cùng danh mục c14 của sàn, khác nghề ─────────
      'thủ kho',
      'nhân viên kho',
      'phụ kho',
      'quản lý kho',
      'vận hành kho',
      'bốc xếp',
      'giao hàng',
      'giao nhận',
      'shipper',
      'tài xế',
      'lái xe',
      'đóng gói',
      // ── Nhiễu số 3: KẾ TOÁN ───────────────────────────────────────────────
      'kế toán kho',
      'kế toán mua hàng',
      'kế toán công nợ',
      // ── Nhiễu số 4: NHÂN SỰ — "sourcing" trong tuyển dụng là tìm ứng viên ──
      // Đo thật: "talent-sourcing-trainee-c22p122id..." lọt vào lát cắt HCM.
      'talent sourcing',
      'chuyên viên tuyển dụng',
      'nhân viên tuyển dụng',
      'recruitment',
      'headhunt',
    ],

    // TP.HCM theo bảng Location hiện hành, tức đã GỘP Bình Dương và
    // Bà Rịa – Vũng Tàu sau sáp nhập 2025. Muốn hẹp về HCM cũ thì lọc thêm
    // JobLocation.rawText — xem cờ --strict-hcm của scripts/match.ts.
    provinces: ['ho-chi-minh'],

    // Tin "Thoả thuận" chiếm khoảng một nửa thị trường; bỏ chúng là bỏ một nửa
    // cơ hội chỉ vì sàn không bắt buộc ghi lương.
    includeNoSalary: true,
    maxAgeDays: 90,

    note:
      'Từ điển dựng 08/09/2026. Ba tầng nhiễu đã thấy bằng mắt trên dữ liệu ' +
      'thật: sales đội lốt ("tư vấn mua hàng"), kho bãi cùng danh mục c14 của ' +
      'vieclam24h ("nhân viên kho hàng"), và nhân sự dùng chung chữ "sourcing".',
  },
];
