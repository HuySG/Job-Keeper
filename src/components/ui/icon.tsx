import type { IconName } from '@/constants/nav';

/**
 * Bộ biểu tượng nhỏ, vẽ thẳng bằng SVG.
 *
 * Không kéo thư viện icon về cho bốn hình: một gói icon thường nặng hơn toàn
 * bộ CSS của trang này. Nét vẽ theo `currentColor` nên biểu tượng tự đổi màu
 * theo chữ quanh nó, kể cả ở chế độ tối.
 *
 * Biểu tượng ở đây LUÔN đi kèm chữ, không bao giờ đứng một mình mang nghĩa —
 * một hình 16px không phải là nhãn.
 */

const PATHS: Record<IconName, string> = {
  gauge: 'M12 14a2 2 0 100-4 2 2 0 000 4zm1.4-3.4L17 7M4 18a9 9 0 1116 0',
  target: 'M12 3a9 9 0 100 18 9 9 0 000-18zm0 5a4 4 0 100 8 4 4 0 000-8z',
  list: 'M4 6h16M4 12h16M4 18h10',
  money: 'M4 19V9m5 10V5m5 14v-7m5 7V8',
  plug: 'M9 3v6m6-6v6M6 9h12v3a6 6 0 01-12 0V9zm6 9v3',
};

export function Icon({ name, className = 'size-4' }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
