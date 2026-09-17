'use server';

import { revalidatePath } from 'next/cache';

import { getDb } from '@/api/workspace-db';
import { SAVED_JOB_LIMIT } from '@/constants/saved';
import { isWorkspaceId } from '@/constants/workspace';
import { assertCanEdit } from '@/lib/edit-access';

/**
 * Lưu / bỏ lưu một tin.
 *
 * Gọi từ `<form action>` thuần nên chạy được cả khi JavaScript chưa tải: trình
 * duyệt POST lên, máy chủ ghi, rồi dựng lại đúng trang đang đứng.
 *
 * `intent` do nút gửi lên chứ không tự đảo trạng thái: bấm hai lần liền (mạng
 * chậm) thì lưu hai lần vẫn là lưu, không thành lưu-rồi-bỏ.
 */
export async function toggleSavedJob(formData: FormData): Promise<void> {
  await assertCanEdit();

  // Số hiệu tin chỉ có nghĩa trong CSDL của workspace — không có `ws` hợp lệ
  // thì không đoán, bỏ qua.
  const ws = formData.get('ws');
  if (!isWorkspaceId(ws)) return;
  const db = getDb(ws);

  const postingId = Number(formData.get('postingId'));
  if (!Number.isInteger(postingId) || postingId <= 0) return;

  if (formData.get('intent') === 'unsave') {
    await db.savedJob.deleteMany({ where: { postingId } });
  } else {
    const [count, exists, already] = await Promise.all([
      db.savedJob.count(),
      db.jobPosting.count({ where: { id: postingId } }),
      db.savedJob.count({ where: { postingId } }),
    ]);
    // Trần được giao diện chặn trước (nút mờ đi); ở đây chặn lần nữa cho POST
    // gõ tay. Hai cú bấm cùng lúc có thể lọt lên 21 — một người dùng thì chấp
    // nhận được, không đáng một giao dịch khoá bảng.
    if (exists === 0 || already > 0 || count >= SAVED_JOB_LIMIT) return;
    await db.savedJob.create({ data: { postingId } });
  }

  revalidatePath('/', 'layout');
}
