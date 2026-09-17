'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { lockEditing, unlockWith } from '@/lib/edit-access';

/**
 * Đường quay về sau khi nhập khoá — CHỈ nhận đường dẫn nội bộ.
 *
 * `back` đến từ form nên ai cũng sửa được; nhận `//evil.com` hay
 * `https://…` là biến nút "Mở khoá" thành một cú chuyển hướng ra ngoài.
 */
function safeBack(value: FormDataEntryValue | null): URL {
  const raw = typeof value === 'string' ? value : '';
  // Mặc định `/` — middleware đưa về workspace vừa xem.
  const path = raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') ? raw : '/';
  const url = new URL(path, 'http://local');
  url.searchParams.delete('khoa');
  return url;
}

const relative = (url: URL) => `${url.pathname}${url.search}`;

export async function unlockEditing(formData: FormData): Promise<void> {
  const back = safeBack(formData.get('back'));
  const ok = await unlockWith(String(formData.get('key') ?? ''));

  if (!ok) {
    // Chậm lại một nhịp khi sai: trang công khai, đoán khoá bằng vòng lặp thì
    // mỗi lần đoán phải tốn gần một giây.
    await new Promise((resolve) => setTimeout(resolve, 800));
    back.searchParams.set('khoa', 'sai');
    redirect(relative(back));
  }

  revalidatePath('/', 'layout');
  redirect(relative(back));
}

export async function lockEditingAction(formData: FormData): Promise<void> {
  await lockEditing();
  revalidatePath('/', 'layout');
  redirect(relative(safeBack(formData.get('back'))));
}
