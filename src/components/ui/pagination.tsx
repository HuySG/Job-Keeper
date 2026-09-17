import { buildUrl, type SearchParams } from '@/lib/query';

import { Glyph } from './glyph';

/**
 * Phân trang có số — giữ NGUYÊN mọi bộ lọc.
 *
 * Mất bộ lọc lúc chuyển trang là lỗi kinh điển, và `buildUrl` là chỗ chặn nó:
 * nó chép lại toàn bộ tham số hiện có rồi mới ghi đè `page`.
 *
 * Hiện tối đa năm số: trang đầu, quanh trang hiện tại, trang cuối — đủ để
 * nhảy xa mà không thành một dải 263 ô.
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

  const href = (target: number) => buildUrl(pathname, params, { page: target });

  return (
    <nav aria-label="Phân trang" className="flex flex-wrap items-center gap-2">
      <Step href={page > 1 ? href(page - 1) : null} label="Trang trước" icon="chevronLeft" />

      {pageWindow(page, pageCount).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} aria-hidden className="px-1 text-[13px] text-neutral-700">
            …
          </span>
        ) : (
          <a
            key={item}
            href={href(item)}
            aria-current={item === page ? 'page' : undefined}
            className={`btn tnum h-10 px-4 ${item === page ? 'btn-primary' : 'btn-secondary'}`}
          >
            {item}
          </a>
        ),
      )}

      <Step href={page < pageCount ? href(page + 1) : null} label="Trang sau" icon="chevronRight" />
    </nav>
  );
}

function Step({
  href,
  label,
  icon,
}: {
  href: string | null;
  label: string;
  icon: 'chevronLeft' | 'chevronRight';
}) {
  const className = 'btn btn-secondary btn-icon size-10';
  if (!href) {
    return (
      <span aria-disabled="true" aria-label={label} className={className}>
        <Glyph name={icon} size={16} />
      </span>
    );
  }
  return (
    <a href={href} aria-label={label} className={className}>
      <Glyph name={icon} size={16} />
    </a>
  );
}

/** `[1, 'gap', 6, 7, 8, 'gap', 263]` — số trang cần vẽ, kèm chỗ ngắt. */
export function pageWindow(page: number, pageCount: number): (number | 'gap')[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  // Ở hai đầu thì bù cho đủ ba số liền nhau, để "1 2 3 … 263" không co lại
  // thành "1 2 … 263" chỉ vì đang đứng ở trang 1.
  if (page <= 2) [2, 3].forEach((n) => wanted.add(n));
  if (page >= pageCount - 1) [pageCount - 1, pageCount - 2].forEach((n) => wanted.add(n));

  const pages = [...wanted].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  for (const n of pages) {
    const last = out[out.length - 1];
    if (typeof last === 'number' && n - last > 1) out.push(n - last === 2 ? last + 1 : 'gap');
    out.push(n);
  }
  return out;
}
