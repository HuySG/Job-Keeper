import { lockEditingAction, unlockEditing } from '@/actions/access';
import { Callout } from '@/components/ui/callout';
import { Cmd } from '@/components/ui/empty';
import { Glyph } from '@/components/ui/glyph';
import { getEditAccess, hasEditKey } from '@/lib/edit-access';

/**
 * Ô mở khoá sửa — hiện ở những trang có nút ghi (Tin đã lưu, Cài đặt).
 *
 * Ba trạng thái, ba lời khác nhau:
 *   · đã mở khoá      — chỉ một nút nhỏ "khoá lại trên máy này" (nếu có khoá)
 *   · chưa nhập khoá  — ô mật khẩu
 *   · máy chủ chưa đặt `EDIT_KEY` — nói thẳng việc cần làm, không bày ô nhập vô dụng
 */
export async function EditLock({ back, wrong }: { back: string; wrong: boolean }) {
  const access = await getEditAccess();

  if (access.allowed) {
    if (!hasEditKey()) return null;
    return (
      <form action={lockEditingAction} className="text-xs text-neutral-700">
        <input type="hidden" name="back" value={back} />
        Máy này đang được sửa.{' '}
        <button type="submit" className="cursor-pointer text-accent-700 underline hover:text-accent">
          Khoá lại
        </button>
      </form>
    );
  }

  if (access.reason === 'unconfigured') {
    return (
      <Callout tone="warn" icon={<Glyph name="key" size={18} />}>
        Máy chủ chưa đặt <Cmd>EDIT_KEY</Cmd>, nên giao diện đang ở chế độ chỉ đọc. Đặt biến này trên
        Vercel (một chuỗi ngẫu nhiên dài) rồi deploy lại để lưu tin và sửa từ điển.
      </Callout>
    );
  }

  return (
    <form action={unlockEditing} className="flex flex-col gap-2 border-l-[6px] border-accent bg-brand-soft px-4 py-3.5">
      <input type="hidden" name="back" value={back} />
      <label htmlFor="edit-key" className="flex items-center gap-2 text-[13px] font-extrabold text-accent-900">
        <Glyph name="key" size={15} />
        Nhập khoá sửa để lưu tin và sửa từ điển
      </label>
      <div className="flex gap-2">
        <input
          id="edit-key"
          type="password"
          name="key"
          required
          autoComplete="current-password"
          className="input h-10 bg-neutral-100"
          aria-invalid={wrong || undefined}
        />
        <button type="submit" className="btn btn-primary h-10 px-4">
          Mở khoá
        </button>
      </div>
      {wrong && <p className="text-xs font-extrabold text-critical-ink">Khoá không đúng.</p>}
      <p className="text-xs text-neutral-700">Nhớ trên máy này 180 ngày. Người khác xem trang vẫn chỉ đọc.</p>
    </form>
  );
}
