/**
 * Workspace — một CSDL + một bộ cấu hình nguồn + một ngành mặc định.
 *
 * Bae-Job phục vụ hai người tìm hai nghề khác hẳn nhau: thu mua (của Bae) và
 * lập trình phần mềm (của tôi). Hai nghề cào những lát khác nhau của cùng các
 * sàn, chấm bằng hai bộ luật khác nhau, nên dữ liệu nằm ở HAI CSDL riêng —
 * xem docs/plan-swe.md §6–§7.
 *
 * Ranh giới giữa hai chỗ chứa cấu hình:
 *   · thứ gì là CODE (CSDL nào, bộ chấm nào, màu gì) nằm ở ĐÂY;
 *   · thứ gì người dùng CHỈNH (từ điển, cấu hình nguồn) nằm trong CSDL.
 *
 * Không gọi khái niệm này là "kho": "Kho tin" đã là tên trang `/viec`.
 */

export const WORKSPACE_IDS = ['bae', 'swe'] as const;

export type WorkspaceId = (typeof WORKSPACE_IDS)[number];

/**
 * Workspace khi không ai nói gì. Là `bae` để mọi thứ có từ trước ngày tách —
 * lệnh không có `--ws`, secret `DATABASE_URL`, lịch GitHub Actions — chạy
 * đúng như cũ mà không phải sửa một dòng nào.
 */
export const DEFAULT_WORKSPACE: WorkspaceId = 'bae';

/**
 * Biến môi trường mang workspace của MỘT TIẾN TRÌNH script.
 *
 * Tiền tố `BJ_` (như cookie `bj-theme`) là cố ý: Jenkins tự đặt biến
 * `WORKSPACE` thành đường dẫn thư mục làm việc, nên một cái tên trơn sẽ đụng
 * nhau ngay trên máy chạy CI.
 */
export const WORKSPACE_ENV = 'BJ_WORKSPACE';

export interface WorkspaceConfig {
  id: WorkspaceId;
  /** Nhãn của mục "Ngành" trên thanh điều hướng. */
  label: string;
  /**
   * Biến môi trường chứa chuỗi kết nối, đọc LẦN LƯỢT, lấy cái đầu tiên có giá
   * trị. Workspace bae đọc `DATABASE_URL` cũ ở cuối để không secret nào phải
   * đổi tên.
   */
  dbUrlEnv: readonly string[];
  /**
   * Tiền tố khoá blob. Khoá cũ của bae KHÔNG có tiền tố và giữ nguyên như vậy,
   * để không phải di chuyển file nào. Xem docs/plan-swe.md §9.5.
   */
  blobPrefix: string;
  /** Slug `SavedFilter` mà mọi trang của workspace neo vào. */
  defaultField: string;
  /** Bảng màu mặc định — hai workspace khác màu để nhìn là biết đang ở đâu. */
  theme: 'pastel-green' | 'blue';
}

export const WORKSPACES: Readonly<Record<WorkspaceId, WorkspaceConfig>> = {
  bae: {
    id: 'bae',
    label: 'Ngành của Bae',
    dbUrlEnv: ['DATABASE_URL_BAE', 'DATABASE_URL'],
    blobPrefix: '',
    defaultField: 'thu-mua-hcm',
    theme: 'pastel-green',
  },
  swe: {
    id: 'swe',
    label: 'Ngành của tôi',
    // CỐ Ý không rơi về `DATABASE_URL`: thiếu biến này mà lặng lẽ dùng chuỗi
    // của Bae là ghi tin lập trình vào CSDL thu mua.
    dbUrlEnv: ['DATABASE_URL_SWE'],
    blobPrefix: 'swe/',
    defaultField: 'phan-mem-hcm',
    theme: 'blue',
  },
};

export function isWorkspaceId(value: unknown): value is WorkspaceId {
  return typeof value === 'string' && (WORKSPACE_IDS as readonly string[]).includes(value);
}
