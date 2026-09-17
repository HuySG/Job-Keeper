import { toggleSavedJob } from '@/actions/saved';
import type { SaveContext } from '@/api/saved.api';
import { Glyph } from '@/components/ui/glyph';
import { LiveDot } from '@/components/ui/status';
import { cx } from '@/components/ui/tone';

/**
 * Nút lưu / bỏ lưu một tin — một `<form>` thuần gọi server action.
 *
 * Bốn hình dạng cho bốn chỗ đứng, cùng một hành vi:
 *
 *   · `icon`   — cột cuối bảng Kho tin. Đã lưu thì hiện nhãn "● đã lưu" thay
 *                cho biểu tượng, đúng như bản thiết kế; bấm vào nhãn là bỏ lưu.
 *   · `block`  — cột phải trang Chi tiết.
 *   · `ghost`  — dưới nút "Xem tin gốc" của thẻ tin trang Ngành.
 *   · `remove` — trang Tin đã lưu, chỉ có chiều bỏ.
 *
 * Không có quyền ghi thì nút vẫn HIỆN nhưng mờ, kèm `title` nói vì sao —
 * giấu hẳn thì người dùng không biết tính năng tồn tại để đi mở khoá.
 */
export function SaveJobButton({
  jobId,
  context,
  variant,
  className,
}: {
  jobId: number;
  context: SaveContext;
  variant: 'icon' | 'block' | 'ghost' | 'remove';
  className?: string;
}) {
  if (!context.visible) return null;

  const saved = context.ids.has(jobId);
  const enabled = saved ? context.canUnsave : context.canSave;
  const title = enabled ? (saved ? 'Bỏ lưu tin này' : 'Lưu tin để mèo kiểm mỗi ngày') : (context.reason ?? undefined);

  return (
    <form action={toggleSavedJob} className={cx(variant === 'block' ? 'w-full' : 'inline-flex', className)}>
      <input type="hidden" name="postingId" value={jobId} />
      <input type="hidden" name="intent" value={saved ? 'unsave' : 'save'} />
      <button
        type="submit"
        disabled={!enabled}
        title={title}
        aria-pressed={variant === 'remove' ? undefined : saved}
        className={buttonClass(variant, saved)}
      >
        {label(variant, saved)}
      </button>
    </form>
  );
}

function buttonClass(variant: 'icon' | 'block' | 'ghost' | 'remove', saved: boolean): string {
  switch (variant) {
    case 'icon':
      return saved
        ? 'inline-flex cursor-pointer items-center gap-1.5 px-1 text-xs font-extrabold text-live-700 hover:underline disabled:cursor-not-allowed'
        : 'btn btn-ghost btn-icon size-8';
    case 'block':
      return cx('btn btn-secondary btn-block h-11 gap-2', saved && 'border-live-700 text-live-700 hover:text-live-700');
    case 'ghost':
      return 'btn btn-ghost gap-1.5 text-[13px]';
    case 'remove':
      return 'btn btn-ghost gap-1.5 text-[13px]';
  }
}

function label(variant: 'icon' | 'block' | 'ghost' | 'remove', saved: boolean) {
  if (variant === 'icon') {
    return saved ? (
      <>
        <LiveDot size={7} />
        đã lưu
      </>
    ) : (
      <>
        <Glyph name="bookmark" size={15} />
        <span className="sr-only">Lưu tin</span>
      </>
    );
  }
  if (variant === 'remove') {
    return (
      <>
        <Glyph name="bookmark" size={14} />
        Bỏ lưu
      </>
    );
  }
  return saved ? (
    <>
      <LiveDot size={8} />
      {variant === 'block' ? 'Đã lưu · bấm để bỏ lưu' : 'Đã lưu'}
    </>
  ) : (
    <>
      <Glyph name="bookmark" size={15} />
      {variant === 'block' ? 'Lưu tin này' : 'Lưu tin'}
    </>
  );
}
