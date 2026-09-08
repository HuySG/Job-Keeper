import type { ReactNode } from 'react';

/**
 * Đầu trang: **tên trang + câu trả lời trang này trả lời**.
 *
 * Câu mô tả không phải khẩu hiệu. Nó nói trang này dùng để quyết định điều gì,
 * vì bốn trang của bảng điều khiển nhìn na ná nhau nếu chỉ có tiêu đề.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
