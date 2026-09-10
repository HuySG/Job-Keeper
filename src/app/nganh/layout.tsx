import type { ReactNode } from 'react';

import { TopShell } from '@/components/layout/top-shell';

/**
 * Trang Ngành là trang ĐẦU TIÊN chuyển sang hệ Modernist, nên nó có khung
 * riêng. Bốn trang còn lại vẫn nằm trong `(dashboard)` với cột dọc cũ.
 *
 * Khi trang kế tiếp chuyển sang, việc cần làm là chuyển nó vào một route group
 * dùng chung `TopShell` — chứ không phải chép lại file này.
 */
export default function FieldLayout({ children }: { children: ReactNode }) {
  return <TopShell>{children}</TopShell>;
}
