import type { ReactNode } from 'react';

import { Mascot } from './mascot';
import { cx } from './tone';

/**
 * Trạng thái rỗng phải nói được **vì sao rỗng** và **bấm gì tiếp theo**.
 *
 * "Không có dữ liệu" là câu vô dụng nhất trong một bảng điều khiển: người dùng
 * không biết mình lọc quá tay hay crawler chưa chạy. Hai nguyên nhân đó dẫn
 * tới hai hành động hoàn toàn khác nhau — nên `children` là bắt buộc trong
 * thực tế, dù kiểu cho phép bỏ trống.
 *
 * Mèo ngủ trên khối mực là hình của bản thiết kế cho mọi chỗ "không có gì":
 * nó nói "chưa có gì để làm", không phải "hỏng rồi".
 */
export function Empty({
  title,
  children,
  actions,
  compact = false,
  className,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex flex-col items-center gap-5 text-center',
        compact ? 'px-4 py-8' : 'px-4 py-12 sm:py-14',
        className,
      )}
    >
      {!compact && (
        <div className="bg-text px-8 py-6">
          <Mascot pose="sleep" width={110} ink="light" zzz />
        </div>
      )}
      <div className="max-w-145">
        <h2 className={compact ? 'text-[19px]' : 'text-[26px] leading-[1.15] sm:text-[30px]'}>{title}</h2>
        {children && (
          <div className="mt-2.5 text-[15px] leading-[1.6] text-pretty text-neutral-800">{children}</div>
        )}
      </div>
      {actions && <div className="flex flex-wrap justify-center gap-2.5">{actions}</div>}
    </div>
  );
}

/** Lệnh gõ vào terminal. Hiện nhiều trong trạng thái rỗng vì đây là công cụ cá nhân. */
export function Cmd({ children }: { children: ReactNode }) {
  return (
    <code className="bg-neutral-200 px-1.5 py-0.5 font-mono text-[0.85em] text-text">{children}</code>
  );
}
