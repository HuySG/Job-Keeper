import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { isWorkspaceConfigured } from '@/api/workspace-db';
import { SiteHeader } from '@/components/layout/site-header';
import { WorkspaceMissing } from '@/components/layout/workspace-missing';
import { isWorkspaceId } from '@/constants/workspace';

/**
 * Khung của MỘT workspace (`/bae/...`, `/swe/...`): thanh điều hướng theo
 * workspace + thân trang.
 *
 * Đoạn đầu lạ (`/abc/nganh`) không tới được đây — middleware đã chuyển nó sang
 * 404 "không khớp", loại 404 duy nhất Next 15.5 dựng đủ trong HTML (xem
 * `classifyPath`). `notFound()` dưới đây chỉ là lưới an toàn.
 *
 * Workspace chưa khai CSDL thì vẽ lời nhắn THAY cho thân trang, cũng không đi
 * qua `notFound()` vì cùng lý do. Thanh điều hướng vẫn vẽ được để sang
 * workspace kia.
 */
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ ws: string }>;
}) {
  const { ws } = await params;
  if (!isWorkspaceId(ws)) notFound();

  return (
    <>
      <SiteHeader ws={ws} />
      <main className="min-w-0">{isWorkspaceConfigured(ws) ? children : <WorkspaceMissing ws={ws} />}</main>
    </>
  );
}
