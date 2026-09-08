import { buildUrl, type SearchParams } from '@/lib/query';

import { cx } from './tone';

/**
 * Phân trang giữ NGUYÊN mọi bộ lọc.
 *
 * Mất bộ lọc lúc chuyển trang là lỗi kinh điển, và `buildUrl` là chỗ chặn nó:
 * nó chép lại toàn bộ tham số hiện có rồi mới ghi đè `page`.
 */
export function Pagination({
  pathname,
  params,
  page,
  pageCount,
}: {
  pathname: string;
  params: SearchParams;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Phân trang" className="flex items-center justify-center gap-2 text-sm">
      <PageLink pathname={pathname} params={params} page={page - 1} disabled={page <= 1}>
        ← Trước
      </PageLink>
      <span className="tnum px-2 text-muted">
        Trang {page} / {pageCount}
      </span>
      <PageLink pathname={pathname} params={params} page={page + 1} disabled={page >= pageCount}>
        Sau →
      </PageLink>
    </nav>
  );
}

function PageLink({
  pathname,
  params,
  page,
  disabled,
  children,
}: {
  pathname: string;
  params: SearchParams;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span aria-disabled className="px-3 py-1.5 text-muted opacity-40">
        {children}
      </span>
    );
  }
  return (
    <a
      href={buildUrl(pathname, params, { page })}
      className={cx('rounded-lg border border-border px-3 py-1.5 hover:border-border-strong')}
    >
      {children}
    </a>
  );
}
