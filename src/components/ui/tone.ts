import type { Tone } from '@/utils/format';

/**
 * Vai trò màu -> lớp Tailwind. **Chỗ duy nhất** dịch từ ý nghĩa sang màu.
 *
 * Component ở tầng trên chỉ nói `tone="warn"`, không bao giờ tự viết
 * `text-amber-600`. Bản trước rải màu thẳng vào từng chỗ dùng — `text-amber-600`
 * cho tin sắp hết hạn ở `job-card`, `border-amber-500/40` cho hộp cảnh báo ở
 * trang chi tiết — nên đổi một sắc thái phải đi lục cả cây thư mục, và hai chỗ
 * cùng nghĩa lại ra hai màu khác nhau.
 *
 * Lưu ý cho Tailwind: phải viết ĐẦY ĐỦ tên lớp thành chuỗi ở đây. Ghép chuỗi
 * kiểu `text-${tone}-ink` thì trình quét không thấy và lớp đó không được sinh ra.
 */

export interface ToneClasses {
  /** Chữ trên nền thường — đã chọn bậc đủ tương phản để đọc ở cỡ chữ nhỏ. */
  text: string;
  /** Nền nhạt + chữ đậm, dùng cho nhãn và hộp thông báo. */
  soft: string;
  /** Viền cùng sắc. */
  border: string;
  /** Chấm tròn đặc — kênh nhận dạng THỨ HAI bên cạnh chữ. */
  dot: string;
  /** Mảng tô của biểu đồ (thanh, cột). */
  fill: string;
}

export const TONE: Record<Tone, ToneClasses> = {
  neutral: {
    text: 'text-muted',
    soft: 'bg-inset text-muted',
    border: 'border-border',
    dot: 'bg-faint',
    fill: 'bg-border-strong',
  },
  accent: {
    text: 'text-accent-ink',
    soft: 'bg-accent-soft text-accent-ink',
    border: 'border-accent',
    dot: 'bg-accent',
    fill: 'bg-accent',
  },
  good: {
    text: 'text-good-ink',
    soft: 'bg-good-soft text-good-ink',
    border: 'border-good',
    dot: 'bg-good',
    fill: 'bg-good',
  },
  warn: {
    text: 'text-warn-ink',
    soft: 'bg-warn-soft text-warn-ink',
    border: 'border-warn',
    dot: 'bg-warn',
    fill: 'bg-warn',
  },
  serious: {
    text: 'text-serious-ink',
    soft: 'bg-serious-soft text-serious-ink',
    border: 'border-serious',
    dot: 'bg-serious',
    fill: 'bg-serious',
  },
  critical: {
    text: 'text-critical-ink',
    soft: 'bg-critical-soft text-critical-ink',
    border: 'border-critical',
    dot: 'bg-critical',
    fill: 'bg-critical',
  },
};

/** Gộp danh sách lớp, bỏ qua `false`/`undefined`. Đủ dùng, không cần `clsx`. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
