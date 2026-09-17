import { getSavedState } from '@/api/saved.api';
import { getOverview } from '@/api/stats.api';
import { isWorkspaceConfigured } from '@/api/workspace-db';
import { Glyph } from '@/components/ui/glyph';
import { Mascot } from '@/components/ui/mascot';
import { IdleDot, LiveDot } from '@/components/ui/status';
import { NAV_ACTIONS } from '@/constants/nav';
import type { WorkspaceId } from '@/constants/workspace';
import { wsHref } from '@/lib/workspace-path';
import { formatCount, freshnessMeta, timeAgo } from '@/utils/format';

import { NavAction, TopNavLinks, WorkspaceSwitch } from './top-nav-links';

/**
 * Thanh trên cùng của MỌI trang — logo, năm mục, ba nút phụ, đồng hồ crawl.
 *
 * Dính đầu trang khi cuộn: danh sách tin dài vài màn hình, và "tôi đang ở
 * đâu, dữ liệu tươi tới đâu" phải luôn trong tầm mắt.
 *
 * Đồng hồ crawl chỉ nhấp nháy khi kho còn tươi (thu thập trong 24 giờ). Quá
 * ngưỡng thì chấm tắt thành ô vuông rỗng và chữ chuyển màu cảnh báo — một chấm
 * xanh nhấp nháy trên kho đã chết ba ngày là lời nói dối đẹp nhất trang.
 *
 * Mọi con số là của workspace đang mở. Workspace chưa khai CSDL thì vẫn vẽ
 * được thanh điều hướng (để còn chuyển sang workspace kia), chỉ không có số.
 */
export async function SiteHeader({ ws }: { ws: WorkspaceId }) {
  const configured = isWorkspaceConfigured(ws);
  const [overview, saved] = configured
    ? await Promise.all([getOverview(ws), getSavedState(ws)])
    : [null, null];
  const freshness = freshnessMeta(overview?.lastCrawledAt ?? null);
  const stale = freshness.tone === 'critical';
  const href = (path: string, scoped = true) => (scoped ? wsHref(ws, path) : path);

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-5 gap-y-2.5 border-b-2 border-divider bg-bg px-4 py-3 sm:px-6">
      <a href={href('/')} className="flex items-center gap-2.5 text-text hover:text-text">
        <Mascot pose="head" width={34} motion="bob" />
        <span className="font-heading text-[19px] font-extrabold tracking-[-0.02em]">Bae-Job</span>
      </a>

      <WorkspaceSwitch ws={ws} />

      <TopNavLinks ws={ws} />

      <div className="ml-auto flex items-center gap-1 lg:ml-0">
        <NavAction
          href={href(NAV_ACTIONS.components.href, NAV_ACTIONS.components.scoped)}
          label={NAV_ACTIONS.components.label}
          icon
        >
          <Glyph name="activity" size={17} />
        </NavAction>
        <NavAction
          href={href(NAV_ACTIONS.saved.href, NAV_ACTIONS.saved.scoped)}
          label={NAV_ACTIONS.saved.label}
          className="gap-1.75 text-[13px]"
        >
          <Glyph name="bookmark" size={15} />
          <span className="hidden sm:inline">Tin đã lưu ·</span>
          <span className="tnum">{saved?.count ?? 0}</span>
        </NavAction>
        <NavAction
          href={href(NAV_ACTIONS.settings.href, NAV_ACTIONS.settings.scoped)}
          label={NAV_ACTIONS.settings.label}
          icon
        >
          <Glyph name="settings" size={17} />
        </NavAction>
      </div>

      {overview && (
      <span
        title={freshness.hint}
        className={`hidden items-center gap-1.75 text-xs lg:inline-flex ${stale ? 'font-extrabold text-critical-ink' : 'text-neutral-700'}`}
      >
        {stale ? <IdleDot size={8} /> : <LiveDot size={8} />}
        Cập nhật {timeAgo(overview.lastCrawledAt)}
        <span className="hidden 2xl:inline">
          · {formatCount(overview.alive)} tin · {overview.activeSources} sàn
        </span>
      </span>
      )}
    </header>
  );
}
