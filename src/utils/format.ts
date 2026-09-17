/** Định dạng cho phần hiển thị. Chỉ nhận dữ liệu đã chuẩn hoá, không tính toán. */

/** "15,0 – 20,0 tr" hoặc "Thoả thuận". */
export function formatSalary(
  min: number | null,
  max: number | null,
  isPublic: boolean,
): string {
  if (!isPublic) return 'Thoả thuận';
  const tr = (value: number): string => {
    const millions = value / 1e6;
    // Số tròn thì bỏ phần thập phân: "20 tr" đọc nhanh hơn "20,0 tr"
    return millions % 1 === 0 ? String(millions) : millions.toFixed(1).replace('.', ',');
  };
  if (min !== null && max !== null) {
    return min === max ? `${tr(min)} tr` : `${tr(min)}–${tr(max)} tr`;
  }
  if (min !== null) return `từ ${tr(min)} tr`;
  if (max !== null) return `tới ${tr(max)} tr`;
  return 'Thoả thuận';
}

/** "3 giờ trước", "hôm qua", "12 ngày trước". */
export function timeAgo(date: Date | string | null): string {
  if (!date) return '—';
  const then = typeof date === 'string' ? new Date(date) : date;
  const minutes = Math.floor((Date.now() - then.getTime()) / 60000);

  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'hôm qua';
  if (days < 30) return `${days} ngày trước`;

  const months = Math.floor(days / 30);
  return `${months} tháng trước`;
}

/**
 * Tuổi gọn cho cột hẹp: "hôm nay", "hôm qua", "3 ngày", "2 tháng".
 *
 * Tính theo NGÀY LỊCH giờ Việt Nam chứ không theo 24 giờ trôi: tin đăng 23 giờ
 * đêm qua đọc lúc 7 giờ sáng nay là "hôm qua", dù mới cách tám tiếng.
 */
export function shortAge(date: Date | null): string {
  if (!date) return '—';
  const day = (value: Date) =>
    Math.floor((value.getTime() + 7 * 60 * 60 * 1000) / (24 * 60 * 60 * 1000));
  const days = day(new Date()) - day(date);
  if (days <= 0) return 'hôm nay';
  if (days === 1) return 'hôm qua';
  if (days < 30) return `${days} ngày`;
  return `${Math.floor(days / 30)} tháng`;
}

/** Còn bao lâu tới hạn nộp. null nếu nguồn không khai. */
export function daysLeft(expiresAt: Date | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/**
 * Nhãn cấp bậc.
 *
 * Trước đây lẫn lộn: "Junior"/"Senior" để tiếng Anh còn "Trung cấp"/"Quản lý"
 * dịch ra tiếng Việt, đọc rất khó chịu. Nay theo đúng cách thị trường lao động
 * Việt Nam thật sự gọi — giữ tiếng Anh những từ đã thành thông dụng, dịch những
 * từ mà tiếng Việt tự nhiên hơn. Kèm số năm để người mới nhìn là hiểu ngay.
 */
const LEVELS: Record<string, { label: string; hint: string }> = {
  INTERN: { label: 'Thực tập', hint: 'còn đi học' },
  FRESHER: { label: 'Mới ra trường', hint: 'chưa cần kinh nghiệm' },
  JUNIOR: { label: 'Junior', hint: '1–2 năm' },
  MID: { label: 'Middle', hint: '2–5 năm' },
  SENIOR: { label: 'Senior', hint: 'từ 5 năm' },
  LEAD: { label: 'Trưởng nhóm', hint: 'dẫn dắt nhóm' },
  MANAGER: { label: 'Quản lý', hint: 'quản lý phòng ban' },
};

export function levelLabel(level: string | null): string {
  return level ? (LEVELS[level]?.label ?? level) : 'Không rõ cấp';
}

/** Nhãn kèm gợi ý số năm — dùng trong ô lọc để không phải đoán nghĩa. */
export function levelLabelWithHint(level: string): string {
  const entry = LEVELS[level];
  return entry ? `${entry.label} · ${entry.hint}` : level;
}

const EMPLOYMENT: Record<string, string> = {
  FULL_TIME: 'Toàn thời gian',
  PART_TIME: 'Bán thời gian',
  CONTRACT: 'Hợp đồng',
  TEMPORARY: 'Thời vụ',
  INTERN: 'Thực tập',
};

/**
 * `null` cho cả trường hợp thiếu lẫn `OTHER`.
 *
 * TopDev gửi `employmentType: ["OTHER"]` cho phần lớn tin. Hiện chữ "Khác" lên
 * thẻ là chiếm một ô mà không nói được gì — thà bỏ trống còn hơn.
 */
export function employmentLabel(value: string | null): string | null {
  return value ? (EMPLOYMENT[value] ?? null) : null;
}

const WORK_MODE: Record<string, string> = {
  REMOTE: 'Làm từ xa',
  HYBRID: 'Kết hợp',
  ONSITE: 'Tại văn phòng',
};

export function workModeLabel(value: string | null): string | null {
  return value ? (WORK_MODE[value] ?? null) : null;
}

/* Cố ý KHÔNG có `sourceLabel(code)`: bảng `Source` đã giữ tên hiển thị của
   từng sàn, nên một bảng tên cài cứng ở đây là nguồn sự thật THỨ HAI. Đổi tên
   một sàn trong CSDL mà quên sửa ở đây thì hai chỗ nói hai kiểu, và chỗ sai
   lại là chỗ người dùng nhìn thấy. Mọi nơi dùng `source.name` đọc từ CSDL. */

/* ═══════════════════════════════════════════════════════════════════════════
   SỐ LIỆU — dùng chung cho chỉ số, biểu đồ và bảng
   ═══════════════════════════════════════════════════════════════════════════ */

/** "1.284". Dấu phân cách theo tiếng Việt là DẤU CHẤM, không phải dấu phẩy. */
export function formatCount(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('vi-VN') : '—';
}

/**
 * Tỷ lệ 0–1 thành "42%".
 *
 * `null` khi mẫu rỗng — KHÁC HẲN với 0%. "0% tin ghi lương" là một phát hiện;
 * "0% vì chưa có tin nào" là chưa biết gì. Hiện nhầm cái sau thành cái trước
 * là tự bịa ra một kết luận.
 */
export function formatPercent(part: number, whole: number, digits = 0): string {
  if (!Number.isFinite(whole) || whole <= 0) return '—';
  return `${((part / whole) * 100).toFixed(digits).replace('.', ',')}%`;
}

/** Số triệu gọn: "15" hoặc "15,5". Dùng cho nhãn trục lương. */
export function millions(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return trim(value / 1e6);
}

function trim(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1).replace('.', ',');
}

/** "25/08/2026". */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const value = typeof date === 'string' ? new Date(date) : date;
  return value.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** "25/08 14:30" — dùng trong nhật ký chạy, nơi giờ mới là thứ đáng xem. */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const value = typeof date === 'string' ? new Date(date) : date;
  return value.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "2 phút 13 giây" — thời lượng một lần chạy crawler. */
export function formatDuration(from: Date | null, to: Date | null): string {
  if (!from || !to) return '—';
  const seconds = Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút ${seconds % 60} giây`;
  return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRẠNG THÁI — nhãn + vai trò màu, khai ở MỘT chỗ
   ═══════════════════════════════════════════════════════════════════════════

   Mỗi trạng thái đi kèm `tone` chứ không đi kèm mã màu: component quyết định
   vẽ ra sao, còn ở đây chỉ nói "cái này là tốt / cảnh báo / hỏng". Nhờ vậy
   đổi bảng màu không phải lục lại từng chỗ dùng.

   Và mỗi trạng thái LUÔN có chữ đi kèm màu. Màu vàng cảnh báo trên nền sáng
   chỉ đạt 1,8:1 — ai không phân biệt được màu, hoặc đang đứng ngoài nắng, thì
   chữ là thứ duy nhất còn đọc được. */

export type Tone = 'neutral' | 'accent' | 'good' | 'warn' | 'serious' | 'critical';

export interface StatusMeta {
  label: string;
  tone: Tone;
  /** Câu giải thích cho `title=` — nói THẬT vì sao tin ở trạng thái này. */
  hint: string;
}

const JOB_STATUS: Record<string, StatusMeta> = {
  OPEN: {
    label: 'Còn tuyển',
    tone: 'good',
    hint: 'Lần quét gần nhất vẫn thấy tin trong danh mục của nguồn và chưa quá hạn nộp',
  },
  STALE: {
    label: 'Chưa xác nhận lại',
    tone: 'warn',
    hint: 'Tin đã vắng khỏi danh mục của nguồn ở lần quét gần nhất — có thể đã bị gỡ',
  },
  EXPIRED: {
    label: 'Hết hạn',
    tone: 'serious',
    hint: 'Đã qua hạn nộp mà nguồn khai trong tin',
  },
  CLOSED: {
    label: 'Đã gỡ',
    tone: 'critical',
    hint: 'Vắng khỏi danh mục của nguồn từ 3 lần quét liên tiếp trở lên',
  },
};

export function jobStatusMeta(status: string): StatusMeta {
  return JOB_STATUS[status] ?? { label: status, tone: 'neutral', hint: '' };
}

const RUN_STATUS: Record<string, StatusMeta> = {
  RUNNING: { label: 'Đang chạy', tone: 'accent', hint: 'Lần chạy chưa kết thúc' },
  SUCCESS: { label: 'Xong', tone: 'good', hint: 'Mọi nguồn đều chạy trọn vẹn' },
  PARTIAL: { label: 'Xong một phần', tone: 'warn', hint: 'Có nguồn hỏng, các nguồn còn lại vẫn xong' },
  FAILED: { label: 'Hỏng', tone: 'critical', hint: 'Lần chạy kết thúc bằng lỗi' },
  ABORTED: {
    label: 'Nguồn chặn',
    tone: 'serious',
    hint: 'Nguồn trả 429/503 — đã dừng để không bị chặn vĩnh viễn. Không phải lỗi của ta',
  },
};

export function runStatusMeta(status: string): StatusMeta {
  return RUN_STATUS[status] ?? { label: status, tone: 'neutral', hint: '' };
}

/**
 * Kho dữ liệu còn tươi không.
 *
 * Ngưỡng lấy đúng theo hợp đồng đã chốt ở TECHSTACK.md §4: `/api/health` trả
 * 503 khi lô kiểm gần nhất quá 24 giờ. Giao diện phải nói cùng một câu với
 * máy giám sát, nếu không thì một bên báo động còn một bên vẫn xanh.
 */
export function freshnessMeta(lastCrawledAt: Date | null): StatusMeta {
  if (!lastCrawledAt) {
    return { label: 'Chưa chạy lần nào', tone: 'critical', hint: 'Kho chưa có lần thu thập nào' };
  }
  const hours = (Date.now() - lastCrawledAt.getTime()) / 3_600_000;
  if (hours <= 6) return { label: 'Mới', tone: 'good', hint: 'Thu thập trong vòng 6 giờ qua' };
  if (hours <= 24) return { label: 'Chấp nhận được', tone: 'warn', hint: 'Thu thập trong vòng 24 giờ qua' };
  return {
    label: 'Đã cũ',
    tone: 'critical',
    hint: 'Quá 24 giờ chưa thu thập — đúng ngưỡng mà /api/health báo động',
  };
}
