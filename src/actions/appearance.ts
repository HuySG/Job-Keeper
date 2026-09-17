'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { MOTION_COOKIE, THEME_COOKIE, isThemeName } from '@/constants/appearance';

const ONE_YEAR = 365 * 24 * 60 * 60;

/**
 * Đổi bảng màu hoặc công tắc chuyển động của MÁY NÀY.
 *
 * Không qua cổng khoá sửa: đây là cookie của chính trình duyệt đang xem, không
 * đụng vào CSDL, không ảnh hưởng ai khác.
 */
export async function setAppearance(formData: FormData): Promise<void> {
  const jar = await cookies();
  const options = { path: '/', maxAge: ONE_YEAR, sameSite: 'lax' as const };

  const theme = formData.get('theme');
  if (isThemeName(theme)) jar.set(THEME_COOKIE, theme, options);

  const motion = formData.get('motion');
  if (motion === 'on' || motion === 'off') jar.set(MOTION_COOKIE, motion, options);

  revalidatePath('/', 'layout');
}
