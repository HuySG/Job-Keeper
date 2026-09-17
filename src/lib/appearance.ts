import 'server-only';

import { cookies } from 'next/headers';

import { MOTION_COOKIE, isThemeName, themeCookie, type Appearance } from '@/constants/appearance';
import { WORKSPACES, type WorkspaceId } from '@/constants/workspace';

/**
 * Bảng màu và công tắc chuyển động của máy đang xem — đọc từ cookie.
 *
 * Bảng màu theo workspace: chưa chọn thì dùng màu mặc định của workspace đó
 * (bae xanh lá, swe xanh dương). Công tắc chuyển động thì dùng chung.
 */
export async function getAppearance(ws: WorkspaceId): Promise<Appearance> {
  const jar = await cookies();
  const theme = jar.get(themeCookie(ws))?.value;
  return {
    theme: isThemeName(theme) ? theme : WORKSPACES[ws].theme,
    motion: jar.get(MOTION_COOKIE)?.value !== 'off',
  };
}
