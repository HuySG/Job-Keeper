/**
 * Hai công tắc giao diện của bản v2: bảng màu và chuyển động.
 *
 * Lưu bằng cookie chứ không bằng localStorage: layout dựng trên máy chủ và phải
 * gắn `data-theme` vào `<html>` NGAY trong lượt HTML đầu tiên. Đọc từ
 * localStorage thì trang hiện bảng xanh lá một nhịp rồi mới nhảy sang xanh
 * dương — đúng kiểu nháy màu làm người ta tưởng trang lỗi.
 */

export const THEME_COOKIE = 'bj-theme';
export const MOTION_COOKIE = 'bj-motion';

export const THEMES = [
  { value: 'pastel-green', label: 'Xanh lá pastel', swatch: '#b7e5cb', ink: '#2c7857' },
  { value: 'blue', label: 'Xanh dương', swatch: '#c7ddfa', ink: '#0d4794' },
] as const;

export type ThemeName = (typeof THEMES)[number]['value'];

export const DEFAULT_THEME: ThemeName = 'pastel-green';

export function isThemeName(value: unknown): value is ThemeName {
  return THEMES.some((theme) => theme.value === value);
}

export interface Appearance {
  theme: ThemeName;
  /** `false` = tắt mọi chuyển động, kể cả khi máy không bật giảm hiệu ứng. */
  motion: boolean;
}
