'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getDb } from '@/api/workspace-db';
import { WORKSPACES, isWorkspaceId } from '@/constants/workspace';
import { assertCanEdit } from '@/lib/edit-access';
import { applyDraft, draftHref, isGray, readDraftOps } from '@/lib/field-draft';
import type { SearchParams } from '@/lib/query';
import { wsHref } from '@/lib/workspace-path';

/**
 * Ghi bản nháp từ điển vào `SavedFilter`.
 *
 * Form chỉ gửi lên PHẦN THAY ĐỔI, không gửi cả từ điển. Máy chủ đọc bản đang
 * lưu NGAY LÚC NÀY rồi mới áp thay đổi — nên nếu từ điển vừa được sửa ở chỗ
 * khác (một câu UPDATE, một tab khác) thì hai lần sửa gộp vào nhau, chứ không
 * phải bản cũ trong tab này đè mất bản mới.
 *
 * Seed chạy bốn lần mỗi ngày KHÔNG ghi đè từ điển đã có (xem `prisma/seed.ts`),
 * nên sửa ở đây sống lâu dài — trừ khi ai đó chạy `db:seed -- --force-fields`.
 */
export async function saveDictionary(formData: FormData): Promise<void> {
  await assertCanEdit();

  const ws = formData.get('ws');
  if (!isWorkspaceId(ws)) throw new Error('Thiếu workspace của từ điển.');
  const db = getDb(ws);
  const defaultField = WORKSPACES[ws].defaultField;
  const settingsPath = wsHref(ws, '/cai-dat');

  const slug = String(formData.get('f') ?? '').trim() || defaultField;
  const fieldParam = slug === defaultField ? undefined : slug;

  const params: SearchParams = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue;
    const current = params[key];
    params[key] = current === undefined ? value : [...(Array.isArray(current) ? current : [current]), value];
  }

  const row = await db.savedFilter.findUnique({ where: { slug } });
  if (!row) throw new Error(`Không có ngành "${slug}".`);

  const draft = applyDraft(row, readDraftOps(params));

  // Không từ chắc nào thì ngành rỗng tuếch: từ xám không bao giờ tự kéo tin
  // vào. Chặn lại thay vì lưu một từ điển chắc chắn ra 0 tin.
  if (!draft.keywords.some((raw) => !isGray(raw))) {
    const back = draftHref(settingsPath, row, draft, fieldParam);
    redirect(`${back}${back.includes('?') ? '&' : '?'}loi=trong`);
  }

  // Slug tỉnh lạ (gõ tay vào URL) bị bỏ ở đây, không ghi vào CSDL: một slug
  // không có trong bảng Location làm truy vấn lọc tỉnh ra 0 tin mà không báo gì.
  const known = await db.location.findMany({
    where: { slug: { in: [...draft.provinces] } },
    select: { slug: true },
  });
  const knownSlugs = new Set(known.map((location) => location.slug));

  await db.savedFilter.update({
    where: { slug },
    data: {
      keywords: [...draft.keywords],
      excludes: [...draft.excludes],
      provinces: draft.provinces.filter((province) => knownSlugs.has(province)),
      maxAgeDays: draft.maxAgeDays,
    },
  });

  revalidatePath('/', 'layout');
  redirect(
    fieldParam
      ? `${settingsPath}?f=${encodeURIComponent(fieldParam)}&da-luu=1`
      : `${settingsPath}?da-luu=1`,
  );
}
