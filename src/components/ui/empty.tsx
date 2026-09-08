import type { ReactNode } from 'react';

/**
 * Trạng thái rỗng phải nói được **vì sao rỗng** và **bấm gì tiếp theo**.
 *
 * "Không có dữ liệu" là câu vô dụng nhất trong một bảng điều khiển: người dùng
 * không biết mình lọc quá tay hay crawler chưa chạy. Hai nguyên nhân đó dẫn
 * tới hai hành động hoàn toàn khác nhau.
 */
export function Empty({
  title,
  children,
  compact = false,
}: {
  title: string;
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? 'px-4 py-8 text-center'
          : 'rounded-card border border-dashed border-border-strong px-6 py-12 text-center'
      }
    >
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mx-auto mt-1.5 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

/** Lệnh gõ vào terminal. Hiện nhiều trong trạng thái rỗng vì đây là công cụ cá nhân. */
export function Cmd({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-inset px-1.5 py-0.5 font-mono text-[0.8em] text-text">
      {children}
    </code>
  );
}
