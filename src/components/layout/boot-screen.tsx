'use client';

import { useEffect, useState } from 'react';

import { Bae } from '@/components/ui/bae';
import { Mascot } from '@/components/ui/mascot';

/**
 * Màn chờ lúc mở web — mèo và Bae đứng cạnh nhau, thanh tiến trình chạy qua
 * bốn bước mà hệ thống thật sự làm để dựng nên trang Ngành.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BA RÀNG BUỘC CỦA APP NÀY ĐỊNH HÌNH CẢ COMPONENT, đừng gỡ cái nào:
 *
 * 1. **Không có JavaScript thì KHÔNG được hiện.** `(site)/layout.tsx` nói rõ
 *    app phải chạy được khi tắt JavaScript, và cũng vì lẽ đó mà `loading.tsx`
 *    đã bị gỡ. Một tấm phủ `fixed inset-0` dựng sẵn trong HTML mà chỉ gỡ được
 *    bằng JavaScript sẽ che vĩnh viễn cả trang trên máy tắt JS. Nên component
 *    này trả `null` ở lượt dựng trên máy chủ và chỉ hiện SAU khi gắn vào DOM —
 *    tắt JavaScript thì nó không tồn tại, thay vì kẹt lại mãi.
 *
 * 2. **Một lượt cho mỗi phiên, không phải mỗi trang.** Mọi liên kết trong app
 *    là `<a>` thường, tức mỗi lần chuyển trang là một lượt tải đầy đủ. Không
 *    chặn bằng `sessionStorage` thì người dùng lãnh trọn 2,5 giây mỗi lần bấm
 *    một liên kết — biến một chi tiết vui thành thuế đường.
 *
 * 3. **Tôn trọng công tắc chuyển động.** Tắt chuyển động, hoặc máy bật giảm
 *    hiệu ứng, thì bỏ qua hẳn. `[data-motion="off"]` chỉ tắt `animation` và
 *    `transition`; nó KHÔNG gỡ được một tấm phủ đứng chắn 2,5 giây.
 *
 * Nội dung trang đã nằm sẵn sau tấm phủ — đây là một nhịp chào, không phải một
 * màn hình chờ dữ liệu. Vì vậy nút "Vào luôn" luôn có, và bấm là vào ngay.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Một lượt cho mỗi tab. Đổi khoá là mọi tab đang mở chào lại một lần nữa. */
const SEEN_KEY = 'bj-boot-seen';

/** Nhịp mỗi bước, chép từ bản thiết kế: 4 bước × 620ms ≈ 2,5 giây. */
const STEP_MS = 620;

/**
 * `sessionStorage` ném lỗi trong chế độ ẩn danh của vài trình duyệt, và trả về
 * rỗng khi người dùng chặn dữ liệu trang. Hỏng theo hướng KHÔNG chào: một màn
 * chào bị bỏ sót thì không ai mất gì, còn một màn chào hiện lại mỗi trang thì
 * ai cũng thấy.
 */
function alreadyGreeted(): boolean {
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return true;
    sessionStorage.setItem(SEEN_KEY, '1');
    return false;
  } catch {
    return true;
  }
}

function motionIsOff(): boolean {
  return (
    document.documentElement.dataset.motion === 'off' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function BootScreen({ steps }: { steps: readonly string[] }) {
  // `null` = chưa quyết định xong (lượt dựng trên máy chủ và nhịp đầu sau khi
  // gắn). Không bao giờ vẽ gì ở trạng thái này.
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (steps.length === 0 || motionIsOff() || alreadyGreeted()) return;

    setStep(0);
    const timer = setInterval(() => {
      setStep((current) => {
        if (current === null) return null;
        // Chạy hết bước cuối thì gỡ tấm phủ, không dừng ở 100% một nhịp nữa.
        if (current + 1 > steps.length) {
          clearInterval(timer);
          return null;
        }
        return current + 1;
      });
    }, STEP_MS);

    return () => clearInterval(timer);
  }, [steps.length]);

  if (step === null) return null;

  const percent = Math.round(Math.min(1, step / steps.length) * 100);

  return (
    <div
      // CỐ Ý KHÔNG `aria-hidden`. Bên trong có một nút bấm được, và một nút
      // focus được nằm trong vùng `aria-hidden` là thứ bàn phím tới được nhưng
      // trình đọc màn hình không thấy — tệ hơn hẳn việc đọc thêm một dòng.
      //
      // Cũng KHÔNG phải `role="dialog"` + `aria-modal`: đúng khuôn cho một tấm
      // phủ có điều khiển, nhưng nó buộc phải kéo focus vào đây ngay lúc mở
      // trang. Đây là một nhịp chào tự tắt sau 2,5 giây, không phải một câu hỏi
      // — giật focus khỏi thứ người dùng đang làm là cái giá quá đắt.
      className="fixed inset-0 z-90 flex flex-col items-center justify-center gap-6.5 bg-brand-soft p-6"
    >
      {/* Mèo LUÔN bên trái và thấp hơn Bae — xem quy ước ở `ui/bae.tsx`. */}
      <div className="flex items-end gap-4 sm:gap-8 md:gap-12">
        <Mascot pose="sit" width={140} />
        <Bae action="none" width={144} />
      </div>

      <div className="flex w-full max-w-130 flex-col gap-3">
        <div className="flex items-baseline gap-2.5">
          <span className="font-heading text-[22px] font-extrabold sm:text-[32px]">
            Bae-Job đang dọn tin
          </span>
          <span className="tnum ml-auto font-heading text-[15px] font-extrabold text-accent-700">
            {percent}%
          </span>
        </div>

        <span className="block h-2.5 bg-accent-200">
          <span
            className="block h-2.5 bg-accent transition-[width] duration-300 ease-out-soft"
            style={{ width: `${percent}%` }}
          />
        </span>

        <div className="flex items-center gap-2 text-[13px] text-neutral-800">
          {steps[Math.min(step, steps.length - 1)]}
          <span className="d1">·</span>
          <span className="d2">·</span>
          <span className="d3">·</span>
        </div>
      </div>

      <button type="button" onClick={() => setStep(null)} className="btn btn-ghost text-xs">
        Vào luôn
      </button>
    </div>
  );
}
