import { findJobs, getFilterOptions, SORT_OPTIONS, type SortKey } from '@/api/job.api';
import { ActiveFilters } from '@/components/active-filters';
import { FilterBar } from '@/components/filter-bar';
import { JobCard } from '@/components/job-card';

/** Luôn đọc DB mới, đừng phục vụ bản dựng sẵn từ lúc build. */
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const get = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const sort = (get('sort') ?? 'moi') as SortKey;

  const [{ items, total, page, pageCount }, options] = await Promise.all([
    findJobs({
      q: get('q'),
      province: get('province'),
      level: get('level'),
      source: get('source'),
      salaryMin: get('salaryMin') ? Number(get('salaryMin')) : undefined,
      salaryOnly: get('salaryOnly') === '1',
      days: get('days') ? Number(get('days')) : undefined,
      sort,
      page: get('page') ? Number(get('page')) : 1,
    }),
    getFilterOptions(),
  ]);

  const provinceNames = Object.fromEntries(options.provinces.map((p) => [p.slug, p.name]));
  const hasFilters = Object.keys(params).some((k) => k !== 'sort' && k !== 'page' && get(k));

  return (
    <>
      <FilterBar
        options={options}
        current={{
          q: get('q'),
          province: get('province'),
          level: get('level'),
          source: get('source'),
          salaryMin: get('salaryMin'),
          salaryOnly: get('salaryOnly'),
          days: get('days'),
          sort: get('sort'),
        }}
      />

      <ActiveFilters params={params} provinceNames={provinceNames} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>
          {/* Chỉ nói về KẾT QUẢ đang xem. Bản trước ghép thêm "42% tin trong kho
              có ghi lương" vào đây — một con số của toàn kho đứng cạnh một con
              số của kết quả lọc, đọc xong không biết 42% là của cái gì. */}
          <strong>{total.toLocaleString('vi-VN')}</strong> tin
          {hasFilters ? ' khớp bộ lọc' : ' còn hiệu lực'}
        </span>

        <SortLinks params={params} current={sort} />
      </div>

      {items.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <div className="grid gap-3">
          {items.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2 text-sm">
          <PageLink params={params} page={page - 1} disabled={page <= 1}>
            ← Trước
          </PageLink>
          <span className="px-2 text-muted">
            Trang {page} / {pageCount}
          </span>
          <PageLink params={params} page={page + 1} disabled={page >= pageCount}>
            Sau →
          </PageLink>
        </nav>
      )}
    </>
  );
}

/**
 * Sắp xếp bằng LINK chứ không bằng dropdown.
 * Dropdown thì phải chọn rồi bấm "Lọc" mới ăn — hai thao tác cho một ý định.
 */
function SortLinks({
  params,
  current,
}: {
  params: Record<string, string | string[] | undefined>;
  current: SortKey;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-muted">Sắp xếp:</span>
      {SORT_OPTIONS.map((option) => (
        <a
          key={option.value}
          href={urlWith(params, { sort: option.value, page: undefined })}
          className={`rounded-md px-2.5 py-1 ${
            current === option.value ? 'bg-accent/12 font-medium text-accent' : 'text-muted'
          }`}
        >
          {option.label}
        </a>
      ))}
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center">
      <p className="font-medium">Không có tin nào khớp</p>
      {hasFilters ? (
        <p className="mt-1 text-sm text-muted">
          Thử gỡ bớt một điều kiện ở dải chip phía trên, hoặc{' '}
          <a href="/" className="text-accent underline underline-offset-2">
            xem tất cả
          </a>
          .
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">
          Kho đang trống. Chạy{' '}
          <code className="rounded bg-bg px-1.5 py-0.5">npm run crawl -- --full</code> để lấy tin.
        </p>
      )}
    </div>
  );
}

/** Giữ nguyên mọi bộ lọc khi chuyển trang — mất bộ lọc lúc phân trang là lỗi kinh điển. */
function PageLink({
  params,
  page,
  disabled,
  children,
}: {
  params: Record<string, string | string[] | undefined>;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="px-3 py-1.5 text-muted opacity-40">{children}</span>;
  }
  return (
    <a
      href={urlWith(params, { page: String(page) })}
      className="rounded-lg border border-border px-3 py-1.5"
    >
      {children}
    </a>
  );
}

/** URL hiện tại, ghi đè hoặc xoá vài tham số. `undefined` nghĩa là xoá. */
function urlWith(
  params: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (key in overrides || raw === undefined) continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) query.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value) query.set(key, value);
  }
  const search = query.toString();
  return search ? `/?${search}` : '/';
}
