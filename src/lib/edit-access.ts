import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';

import { cookies } from 'next/headers';

/**
 * Ai được GHI vào CSDL từ giao diện web.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Vì sao cần, dù đây là công cụ cá nhân
 *
 * Trang chạy công khai trên Vercel, không có đăng nhập. Trước bản v2 điều đó
 * vô hại vì web chỉ ĐỌC. Nay có hai đường ghi — lưu tin và sửa từ điển ngành —
 * nên không chặn thì bất kỳ ai có đường link cũng xoá được từ điển của bạn.
 *
 * Cách chặn cố ý tối giản, đủ cho một người dùng:
 *
 *   · Biến môi trường `EDIT_KEY` là mật khẩu sửa.
 *   · Nhập đúng một lần → cookie `httpOnly` mang BĂM của khoá (không phải khoá
 *     thật), sống 180 ngày.
 *   · Đổi `EDIT_KEY` là mọi cookie cũ mất hiệu lực — đó là nút "đăng xuất khỏi
 *     mọi máy".
 *
 * Chưa đặt `EDIT_KEY`: máy dev được ghi thoải mái, bản production thì KHOÁ hẳn.
 * Mặc định khoá là cố ý — quên đặt biến thì mất tính năng, chứ không mở toang.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const COOKIE = 'bj-edit';
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export type EditAccess =
  | { allowed: true }
  /** `locked` = đã cấu hình khoá nhưng máy này chưa nhập; `unconfigured` = production chưa đặt `EDIT_KEY`. */
  | { allowed: false; reason: 'locked' | 'unconfigured' };

function configuredKey(): string | null {
  const key = process.env.EDIT_KEY?.trim();
  return key ? key : null;
}

/** Muối cố định để cookie không phải là SHA-256 trần của mật khẩu. */
function digest(value: string): string {
  return createHash('sha256').update(`bae-job:edit:${value}`).digest('hex');
}

function sameDigest(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function getEditAccess(): Promise<EditAccess> {
  const key = configuredKey();
  if (!key) {
    return process.env.NODE_ENV === 'production'
      ? { allowed: false, reason: 'unconfigured' }
      : { allowed: true };
  }

  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  return token && sameDigest(token, digest(key))
    ? { allowed: true }
    : { allowed: false, reason: 'locked' };
}

/**
 * Chặn ở đầu MỌI server action có ghi.
 *
 * Nút bấm bị ẩn khi không có quyền chỉ là chuyện giao diện; server action thì
 * gọi được bằng một POST tay, nên phải tự kiểm lại ở đây.
 */
export async function assertCanEdit(): Promise<void> {
  const access = await getEditAccess();
  if (!access.allowed) {
    throw new Error(
      access.reason === 'unconfigured'
        ? 'Chưa đặt EDIT_KEY trên máy chủ — giao diện đang ở chế độ chỉ đọc.'
        : 'Máy này chưa nhập khoá sửa.',
    );
  }
}

/** Nhập khoá: đúng thì đặt cookie và trả `true`. */
export async function unlockWith(input: string): Promise<boolean> {
  const key = configuredKey();
  if (!key || !sameDigest(digest(input.trim()), digest(key))) return false;

  const jar = await cookies();
  jar.set(COOKIE, digest(key), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
  return true;
}

export async function lockEditing(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Có đặt khoá không — để giao diện biết nên hiện ô nhập khoá hay lời dặn đặt biến. */
export function hasEditKey(): boolean {
  return configuredKey() !== null;
}
