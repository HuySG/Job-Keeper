import { setAppearance } from '@/actions/appearance';
import { cx } from '@/components/ui/tone';
import { THEMES, type Appearance } from '@/constants/appearance';

/**
 * Hai công tắc giao diện — bảng màu và chuyển động — của MÁY ĐANG XEM.
 *
 * Mỗi nút là một `<form>` gọi server action đặt cookie, nên đổi được cả khi
 * JavaScript chưa tải. Không cần khoá sửa: không có gì ghi vào CSDL.
 */
export function AppearanceForm({ appearance }: { appearance: Appearance }) {
  return (
    <div className="flex flex-col gap-3">
      <h6>Giao diện trên máy này</h6>

      <form action={setAppearance} className="seg w-fit" aria-label="Bảng màu">
        {THEMES.map((theme) => (
          <button
            key={theme.value}
            type="submit"
            name="theme"
            value={theme.value}
            aria-current={appearance.theme === theme.value ? 'true' : undefined}
            className="seg-opt cursor-pointer"
          >
            <span
              aria-hidden
              className="size-3 flex-none border border-divider"
              style={{ background: theme.swatch, boxShadow: `inset -4px 0 0 ${theme.ink}` }}
            />
            {theme.label}
          </button>
        ))}
      </form>

      {/* Máy đã bật "giảm hiệu ứng" thì chuyển động tắt sẵn bất kể công tắc
          này — CSS lo, không cần hỏi lại ở đây. */}
      <form action={setAppearance}>
        <input type="hidden" name="motion" value={appearance.motion ? 'off' : 'on'} />
        <button
          type="submit"
          role="switch"
          aria-checked={appearance.motion}
          className="flex cursor-pointer items-center gap-3 text-sm"
        >
          <span
            aria-hidden
            className={cx(
              'block h-6 w-11 flex-none p-0.75 transition-colors',
              appearance.motion ? 'bg-accent' : 'bg-neutral-400',
            )}
          >
            <span
              className={cx(
                'block size-4.5 bg-white transition-transform duration-200',
                appearance.motion && 'translate-x-5',
              )}
            />
          </span>
          Chuyển động {appearance.motion ? 'đang bật' : 'đang tắt'}
        </button>
      </form>
    </div>
  );
}
