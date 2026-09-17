import type { ReactNode } from 'react';

import { AppShell } from '@/components/layout/app-shell';

/**
 * Khung của BỐN trang còn giữ cột điều hướng dọc: Tổng quan, Kho tin, Lương,
 * Nguồn & vận hành.
 *
 * `(dashboard)` là **route group** — cặp ngoặc khiến Next bỏ đoạn này khỏi
 * đường dẫn, nên `/`, `/viec`, `/luong`, `/nguon` giữ nguyên URL cũ. Không có
 * liên kết nào phải sửa, không có URL nào người dùng đã lưu bị hỏng.
 *
 * Vì sao tách: trang Ngành đã chuyển sang thanh điều hướng NGANG của hệ
 * Modernist, mà `AppShell` thì vẽ cột DỌC. Hai khung không thể cùng nằm trong
 * layout gốc. Bốn trang này sẽ lần lượt chuyển sang khung mới — lúc đó cả thư
 * mục `(dashboard)` biến mất chứ không phải đi gỡ điều kiện rải rác.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
