import 'server-only';

import { cookies } from 'next/headers';

import {
  DEFAULT_THEME,
  MOTION_COOKIE,
  THEME_COOKIE,
  isThemeName,
  type Appearance,
} from '@/constants/appearance';

/** Bảng màu và công tắc chuyển động của máy đang xem — đọc từ cookie. */
export async function getAppearance(): Promise<Appearance> {
  const jar = await cookies();
  const theme = jar.get(THEME_COOKIE)?.value;
  return {
    theme: isThemeName(theme) ? theme : DEFAULT_THEME,
    motion: jar.get(MOTION_COOKIE)?.value !== 'off',
  };
}
