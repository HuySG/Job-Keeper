import type { ReactNode } from 'react';

/**
 * Bộ biểu tượng của hệ Modernist — chép ĐÚNG đường vẽ từ bản thiết kế.
 *
 * Vì sao không dùng thư viện icon: cả bộ dưới đây gọn hơn một lần `import` từ
 * bất kỳ gói nào, và quan trọng hơn — đường vẽ phải khớp từng nét với bản thiết
 * kế. Lấy `MapPin` của một thư viện bất kỳ ra là ra một cái ghim khác: khác độ
 * cong, khác tỷ lệ đầu ghim, khác chỗ đặt vòng tròn.
 *
 * Ba hằng số của cả bộ, KHÔNG được đổi lẻ ở nơi dùng:
 *
 *   · khung 24×24, nét 1.75, đầu nét bo tròn  — nét mảnh của Modernist
 *   · `fill: none`                            — bộ này thuần nét, không mảng
 *   · màu theo `currentColor`                 — icon ăn màu chữ quanh nó
 *
 * `stroke` truyền vào chỉ dùng khi icon CỐ Ý khác màu chữ — ví dụ ghim đỏ đứng
 * cạnh chữ xám trong một dòng thông tin việc làm. Đó là cách bản thiết kế dẫn
 * mắt: icon đỏ = thông tin tin này CÓ, icon xám = thông tin tin này THIẾU.
 *
 * Biểu tượng ở đây LUÔN đi kèm chữ, không bao giờ đứng một mình mang nghĩa.
 */

export type GlyphName =
  | 'alert'
  | 'bars'
  | 'briefcase'
  | 'building'
  | 'calendar'
  | 'check'
  | 'chevronDown'
  | 'clock'
  | 'external'
  | 'funnel'
  | 'globe'
  | 'menu'
  | 'money'
  | 'pin'
  | 'search'
  | 'shield'
  | 'sparkle'
  | 'trend';

const SHAPES: Record<GlyphName, ReactNode> = {
  alert: (
    <>
      <path d="M12 3l9 16H3z" />
      <path d="M12 9v4" />
      <circle cx="12" cy="16.5" r="0.7" fill="currentColor" />
    </>
  ),
  bars: <path d="M4 20V9M10 20V4M16 20v-7M22 20H2" />,
  briefcase: (
    <>
      <rect x="2" y="7" width="20" height="14" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" />
      <path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  check: <path d="M5 12l4 4 10-10" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4L10 14" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  funnel: <path d="M3 5h18l-7 8v6l-4-2v-4z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18-3-3-3-15 0-18" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  money: (
    <>
      <path d="M3 6h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H3z" />
      <path d="M3 6v13" />
      <circle cx="17" cy="12.5" r="1.5" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4.3-4.3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  sparkle: <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />,
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M21 7h-5v5" />
    </>
  ),
};

export function Glyph({
  name,
  size = 14,
  stroke,
  strokeWidth = 1.75,
  className,
}: {
  name: GlyphName;
  size?: number;
  /** Chỉ truyền khi icon CỐ Ý khác màu chữ quanh nó. Mặc định ăn `currentColor`. */
  stroke?: string;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke ?? 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      // `block` + `flex-none`: icon nằm trong dòng flex thì mặc định
      // `display:inline` cộng thêm khoảng trắng của baseline, đẩy lệch tâm so
      // với chữ bên cạnh — đúng cái làm mọi hàng icon+chữ trông "hơi lệch".
      className={className ? `block flex-none ${className}` : 'block flex-none'}
    >
      {SHAPES[name]}
    </svg>
  );
}
