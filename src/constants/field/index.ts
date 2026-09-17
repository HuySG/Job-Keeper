import { DEFAULT_WORKSPACE, WORKSPACES, type WorkspaceId } from '@/constants/workspace';
import { REMOTE_SLUG } from '@/crawler/normalize/location';

/**
 * Định nghĩa ngành — nạp vào bảng `SavedFilter` của từng workspace.
 *
 * Đây là DỮ LIỆU seed, không phải cấu hình runtime. Sau khi seed, sửa từ điển
 * là `UPDATE SavedFilter SET keywords = ...` — **không deploy, không sửa code**.
 * Để ở đây chỉ để lần cài đặt đầu tiên có ngay thứ chạy được, giống cách
 * `sourceSeedsFor` làm với bảng `Source`. Mỗi workspace một danh sách, nạp vào
 * CSDL của riêng nó.
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
export const DEFAULT_FIELD_SLUG = WORKSPACES[DEFAULT_WORKSPACE].defaultField;

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

const PURCHASE_FIELDS: readonly FieldSeed[] = [
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

/**
 * Nghề lập trình, khớp CV .NET/React — docs/plan-swe.md §4.
 *
 * ⚠️ BẢN NHÁP (17/09/2026), chưa soi trên dữ liệu thật. Và còn một giới hạn
 *    biết trước: bộ chuẩn hoá hiện tại xoá `.`, `#`, `+`, nên ".NET" thành
 *    "net" và "C#" thành "c". Cho tới khi có `toTechKey` (việc C7) thì chỉ
 *    những từ viết được bằng chữ thường mới khớp — đó là lý do có
 *    `net develop`, `net core`, `asp net` bên cạnh `dotnet`/`csharp`.
 */
const SOFTWARE_FIELDS: readonly FieldSeed[] = [
  {
    slug: 'phan-mem-hcm',
    name: 'Phần mềm .NET/React — TP.HCM',

    keywords: [
      // ── Vai trò ────────────────────────────────────────────────────────────
      'lập trình viên',
      'lập trình',
      'developer',
      'software engineer',
      'kỹ sư phần mềm',
      // Đo 17/09 — bốn tin lập trình bị loại oan vì thiếu các cụm này:
      // "01 Chuyên Viên Phát Triển Phần Mềm", "Kỹ Sư Phát Triển Ứng Dụng",
      // "ATS Software Development Engineer".
      'phát triển phần mềm',
      'phát triển ứng dụng',
      'software develop',
      'backend',
      'back end',
      'fullstack',
      'full stack',
      'frontend',
      'front end',
      'web developer',
      // ── Công nghệ của CV ───────────────────────────────────────────────────
      'dotnet',
      // Tiền tố chứ không phải cả chữ: khớp cả "developer" lẫn "development".
      // Đo 17/09: VNW trả "NET Development Engineer" — dấu chấm đã mất từ nguồn.
      'net develop',
      // Đo 17/09: "Senior .NET Engineer Fintech domain" bị loại oan — `engineer`
      // chỉ là từ xám.
      'net engineer',
      'net core',
      'asp net',
      'csharp',
      'reactjs',
      'react',
      // ── Xám: "Kỹ sư xây dựng", "Sales Engineer" cũng có chữ này ────────────
      `${GRAY_PREFIX}engineer`,
      `${GRAY_PREFIX}kỹ sư`,
      `${GRAY_PREFIX}it`,
      `${GRAY_PREFIX}erp`,
      `${GRAY_PREFIX}devops`,
      `${GRAY_PREFIX}system`,
    ],

    excludes: [
      // ── Kiểm thử ───────────────────────────────────────────────────────────
      'tester',
      'qa',
      'qc',
      'kiểm thử',
      'automation test',
      // ── Không viết code ────────────────────────────────────────────────────
      'business analyst',
      'product owner',
      'project manager',
      'scrum master',
      'comtor',
      // ── Bán hàng ───────────────────────────────────────────────────────────
      'sales',
      'kinh doanh',
      'presales',
      'tư vấn',
      // ── Nhân sự — "IT Recruiter" có chữ IT ─────────────────────────────────
      // KHÔNG dùng "tuyển dụng" trần: VNW mở đầu tiêu đề bằng chữ đó
      // ("Tuyển Dụng Kỹ Sư Phát Triển Ứng Dụng" — đo 17/09, bị loại oan).
      'chuyên viên tuyển dụng',
      'nhân viên tuyển dụng',
      'thực tập sinh tuyển dụng',
      'recruiter',
      'talent acquisition',
      'headhunt',
      // ── Hỗ trợ ─────────────────────────────────────────────────────────────
      'helpdesk',
      'it support',
      'hỗ trợ kỹ thuật',
      'kỹ thuật viên',
      // ── Đào tạo ────────────────────────────────────────────────────────────
      'giảng viên',
      'giáo viên',
      'trainer',
      // ── Nghề khác có chữ "developer"/"kỹ sư" ───────────────────────────────
      'designer',
      'ui ux',
      'game',
      'embedded',
      'nhúng',
      'kỹ sư cơ khí',
      'kỹ sư xây dựng',
      'kỹ sư điện',
      // ── "Lập trình" không phải phần mềm — đo 17/09 trên CareerViet và
      //    vieclam24h: "Lập trình CNC", "Lập trình khuôn mẫu chính xác cao" ─────
      'cnc',
      'plc',
      'khuôn',
      'gia công',
      // ── "Product Developer" của ngành may (CareerViet) ─────────────────────
      'merchandiser',
    ],

    // TP.HCM (đã gộp Bình Dương, Bà Rịa – Vũng Tàu) + làm từ xa.
    provinces: ['ho-chi-minh', REMOTE_SLUG],
    includeNoSalary: true,
    // Giữ như bên thu mua cho tới khi có số đo về vòng đời tin IT.
    maxAgeDays: 90,

    note:
      'Bản nháp dựng 17/09/2026 từ CV (2 năm .NET/React/SQL, Thủ Đức). ' +
      'Chưa soi tay trên dữ liệu thật — việc K1 trong docs/plan-swe.md.',
  },
];

export const FIELD_SEEDS: Readonly<Record<WorkspaceId, readonly FieldSeed[]>> = {
  bae: PURCHASE_FIELDS,
  swe: SOFTWARE_FIELDS,
};
