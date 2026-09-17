import { isWorkspaceConfigured } from '@/api/workspace-db';
import { Cmd, Empty } from '@/components/ui/empty';
import { WORKSPACES, WORKSPACE_IDS, type WorkspaceId } from '@/constants/workspace';
import { wsHref } from '@/lib/workspace-path';

/**
 * Workspace chưa khai CSDL trên máy chủ này — nói thẳng thiếu biến nào, và đưa
 * sang workspace kia. Vẽ thẳng từ layout, KHÔNG qua `notFound()`: Next 15.5
 * dựng giao diện của `notFound()` gọi giữa chừng chỉ trong payload JavaScript,
 * nên trình duyệt tắt JS sẽ nhận một trang trắng (đo 17/09/2026).
 */
export function WorkspaceMissing({ ws }: { ws: WorkspaceId }) {
  const other = WORKSPACE_IDS.find((id) => id !== ws && isWorkspaceConfigured(id));
  return (
    <Empty
      title={`${WORKSPACES[ws].label} chưa có CSDL trên máy chủ này`}
      actions={
        other && (
          <a href={wsHref(other, '/')} className="btn btn-primary h-11 px-5">
            Sang {WORKSPACES[other].label}
          </a>
        )
      }
    >
      Khai biến môi trường <Cmd>{WORKSPACES[ws].dbUrlEnv.join(' hoặc ')}</Cmd> (chuỗi kết nối pooled
      của Neon) — trên Vercel ở Settings → Environment Variables, ở máy thì trong <Cmd>.env</Cmd> — rồi
      tải lại trang.
    </Empty>
  );
}
