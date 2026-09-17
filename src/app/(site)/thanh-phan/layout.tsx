import type { ReactNode } from 'react';

import { SiteHeader } from '@/components/layout/site-header';
import { currentWorkspace } from '@/lib/workspace-route';

/**
 * Bộ thành phần dùng chung cho mọi workspace; thanh điều hướng lấy theo
 * workspace vừa xem (cookie), để "Về app" đưa người đọc về đúng chỗ cũ.
 */
export default async function GalleryLayout({ children }: { children: ReactNode }) {
  const ws = await currentWorkspace();
  return (
    <>
      <SiteHeader ws={ws} />
      <main className="min-w-0">{children}</main>
    </>
  );
}
