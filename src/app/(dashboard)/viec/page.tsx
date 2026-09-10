import {
  findJobs,
  getFilterOptions,
  parseJobFilters,
  SORT_OPTIONS,
  type SortKey,
} from '@/api/job.api';
import { ActiveFilters } from '@/components/job/active-filters';
import { FilterBar } from '@/components/job/filter-bar';
import { JobCard } from '@/components/job/job-card';
import { Cmd, Empty } from '@/components/ui/empty';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SegmentedLinks } from '@/components/ui/segmented';
import { questionFor } from '@/constants/nav';
import { hasActiveFilter, type SearchParams } from '@/lib/query';
import { formatCount } from '@/utils/format';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Kho tin' };

const PATH = '/viec';

/**
 * Kho tin — trả lời **"tin nào khớp với thứ tôi đang tìm"**.
 *
 * Trước đây trang này chiếm luôn trang chủ, nên thứ duy nhất công cụ nói được
 * là "đây là một danh sách việc làm" — đúng cái việc mà TopCV làm tốt hơn và
 * có sẵn nút ứng tuyển. Đẩy nó về đây và để tổng quan lên trang chủ mới đúng
 * thứ tự giá trị: cái đáng xem trước là thứ không sàn đơn lẻ nào tính được.
 */
export default async function JobListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = parseJobFilters(params);

  const [{ items, total, page, pageCount }, options] = await Promise.all([
    findJobs(filters),
    getFilterOptions(),
  ]);

  const filtered = hasActiveFilter(params);
  const question = questionFor('/viec');

  return (
    <>
      <PageHeader title="Kho tin" description={question} />

      <div className="space-y-4">
        <FilterBar options={options} params={params} />

        <ActiveFilters
          pathname={PATH}
          params={params}
          context={{
            provinceNames: Object.fromEntries(options.provinces.map((p) => [p.slug, p.name])),
            sourceNames: Object.fromEntries(options.sources.map((s) => [s.code, s.name])),
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          {/* Chỉ nói về KẾT QUẢ đang xem. Bản trước ghép thêm "42% tin trong
              kho có ghi lương" vào đây — một con số của toàn kho đứng cạnh một
              con số của kết quả lọc, đọc xong không biết 42% là của cái gì. */}
          <span>
            <strong className="tnum">{formatCount(total)}</strong> tin
            {filtered ? ' khớp bộ lọc' : ' còn hiệu lực'}
          </span>

          <SegmentedLinks
            pathname={PATH}
            params={params}
            name="sort"
            label="Sắp xếp:"
            current={(filters.sort ?? 'moi') as SortKey}
            options={SORT_OPTIONS}
          />
        </div>

        {items.length === 0 ? (
          filtered ? (
            <Empty title="Không tin nào khớp bộ lọc">
              Thử gỡ bớt một điều kiện ở dải chip phía trên, hoặc{' '}
              <a href={PATH} className="text-accent-ink underline underline-offset-2">
                xem tất cả
              </a>
              .
            </Empty>
          ) : (
            <Empty title="Kho đang trống">
              Chạy <Cmd>npm run crawl -- --full</Cmd> để lấy tin về.
            </Empty>
          )
        ) : (
          <div className="grid gap-3">
            {items.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}

        <Pagination pathname={PATH} params={params} page={page} pageCount={pageCount} />
      </div>
    </>
  );
}
