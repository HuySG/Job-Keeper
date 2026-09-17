import { fieldJudge, findFieldJobs, getFieldDefinition } from '@/api/field.api';
import { findJobs, getFilterOptions, parseJobFilters, PAGE_SIZE } from '@/api/job.api';
import { getSaveContext } from '@/api/saved.api';
import { getOverview } from '@/api/stats.api';
import { JobTable, SHORT_RUNWAY_DAYS } from '@/components/job/job-table';
import { JobToolbar } from '@/components/job/job-toolbar';
import { Callout } from '@/components/ui/callout';
import { Cmd, Empty } from '@/components/ui/empty';
import { Glyph } from '@/components/ui/glyph';
import { Pagination } from '@/components/ui/pagination';
import { Kicker, StatCell, StatStrip } from '@/components/ui/stat';
import { WORKSPACES } from '@/constants/workspace';
import { hasActiveFilter, type SearchParams } from '@/lib/query';
import { wsHref } from '@/lib/workspace-path';
import { workspaceParam } from '@/lib/workspace-route';
import { formatCount } from '@/utils/format';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Kho tin' };

/**
 * Kho tin — trả lời **"tin nào khớp với thứ tôi đang tìm"**.
 *
 * Toàn bộ tin đã gom, CHƯA lọc theo ngành. Dùng khi muốn tự tìm bằng từ khoá
 * ngoài ngành đã định nghĩa — nên hero có sẵn nút quay về danh sách ngành,
 * và mỗi dòng có ô vuông cho biết tin đó có nằm trong ngành không.
 */
export default async function JobListPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ ws: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const ws = await workspaceParam(routeParams);
  const PATH = wsHref(ws, '/viec');
  const fieldSlug = WORKSPACES[ws].defaultField;
  const params = await searchParams;
  const filters = parseJobFilters(params);

  const [page, options, overview, definition, field, save] = await Promise.all([
    findJobs(ws, filters),
    getFilterOptions(ws),
    getOverview(ws),
    getFieldDefinition(ws, fieldSlug),
    findFieldJobs(ws, fieldSlug),
    getSaveContext(ws),
  ]);

  const judge = definition ? fieldJudge(definition) : null;
  const listedHere = judge ? page.items.filter((job) => judge(job).listed).length : 0;
  const from = page.total === 0 ? 0 : (page.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page.page * PAGE_SIZE, page.total);
  const filtered = hasActiveFilter(params);

  return (
    <>
      <section className="brand-field px-4 pt-8 sm:px-6">
        <div className="flex flex-wrap items-end gap-6 pb-6.5">
          <div className="min-w-0 flex-[1_1_420px]">
            <Kicker>Toàn bộ tin đã gom · chưa lọc theo ngành</Kicker>
            <h1 className="mb-2.5 text-[34px] leading-[1.04] sm:text-[42px]">Kho tin</h1>
            <p className="max-w-140 text-base leading-normal text-pretty text-neutral-800">
              Dùng khi bạn muốn tự tìm bằng từ khoá, ngoài ngành mình đã lọc sẵn. Ô vuông đậm đầu dòng
              là tin đúng ngành của bạn.
            </p>
          </div>
          {field && (
            <a
              href={wsHref(ws, '/nganh')}
              className="btn btn-secondary h-11 gap-2 border-accent-700 text-accent-800 hover:text-accent-800"
            >
              <Glyph name="funnel" size={15} />
              Chỉ xem {formatCount(field.total)} tin đúng ngành
            </a>
          )}
        </div>

        <StatStrip tone="brand" className="[&>*:first-child]:pl-0 [&>*:last-child]:pr-0">
          <StatCell tone="brand" size="md" label="Tin còn hiệu lực" value={formatCount(overview.alive)} />
          <StatCell
            tone="brand"
            size="md"
            label="Đúng ngành bạn"
            value={field ? formatCount(field.total) : '—'}
            emphasis
          />
          <StatCell tone="brand" size="md" label="Mới trong 24h" value={formatCount(overview.postedLast24h)} />
          <StatCell
            tone="brand"
            size="md"
            label="Sàn đang trả tin"
            value={overview.sourcesWithAlive}
            unit={` / ${overview.activeSources}`}
            hint="Sàn đang bật và đang có ít nhất một tin còn hiệu lực"
          />
        </StatStrip>
      </section>

      <JobToolbar pathname={PATH} params={params} options={options} sort={filters.sort ?? 'moi'} />

      {page.items.length === 0 ? (
        filtered ? (
          <Empty
            title="Không tin nào khớp bộ lọc"
            actions={
              <a href={PATH} className="btn btn-primary h-11 px-5">
                Xem tất cả tin còn hiệu lực
              </a>
            }
          >
            Thử gỡ bớt một chip ở thanh công cụ phía trên, hoặc gõ từ khoá ngắn hơn — mình tìm trong
            tiêu đề, mô tả và tên công ty.
          </Empty>
        ) : (
          <Empty title="Kho đang trống">
            Chạy <Cmd>npm run crawl -- --ws {ws} --full</Cmd> để mèo đi gom tin về.
          </Empty>
        )
      ) : (
        <>
          <JobTable ws={ws} items={page.items} judge={judge} save={save} />

          <div className="flex flex-wrap items-center gap-4 border-t-2 border-divider px-4 pt-5 pb-3 sm:px-6">
            <p className="text-[13px] text-neutral-700">
              Đang xem{' '}
              <strong className="text-text">
                {formatCount(from)}–{formatCount(to)}
              </strong>{' '}
              trong {formatCount(page.total)} tin
              {judge && ` · ${listedHere} tin đúng ngành trên trang này`}
            </p>
            <div className="sm:ml-auto">
              <Pagination pathname={PATH} params={params} page={page.page} pageCount={page.pageCount} />
            </div>
          </div>
        </>
      )}

      <Callout
        tone="brand"
        className="mx-4 mt-3 mb-10 sm:mx-6"
        icon={<Glyph name="shield" size={16} stroke="var(--color-accent-700)" />}
      >
        Cột “còn lại” lấy theo ngày hết hạn sàn nguồn ghi, không phải mình kiểm. Tin dưới{' '}
        {SHORT_RUNWAY_DAYS} ngày mình để màu xám cho bạn để mắt.
      </Callout>
    </>
  );
}
