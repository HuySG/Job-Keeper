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

const SOURCES: Record<string, string> = {
  vnw: 'VietnamWorks',
  topcv: 'TopCV',
  topdev: 'TopDev',
  itviec: 'ITviec',
  vieclam24h: 'Việc Làm 24h',
  careerviet: 'CareerViet',
};

export function sourceLabel(code: string): string {
  return SOURCES[code] ?? code;
}
