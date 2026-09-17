import { findFieldJobs } from '@/api/field.api';
import { getActiveSources } from '@/api/ops.api';
import { getOverview } from '@/api/stats.api';
import { BarRow } from '@/components/ui/bar-row';
import { Cmd, Empty } from '@/components/ui/empty';
import { Glyph } from '@/components/ui/glyph';
import { Mascot } from '@/components/ui/mascot';
import { Kicker, StatCell, StatStrip } from '@/components/ui/stat';
import { cx } from '@/components/ui/tone';
import { DEFAULT_FIELD_SLUG, FRESH_CHECK_HOURS } from '@/constants/field';
import { salaryValue } from '@/lib/field-bands';
import {
  formatCount,
  formatPercent,
  formatSalary,
  freshnessMeta,
  millions,
  shortAge,
  timeAgo,
} from '@/utils/format';

/** Luôn đọc CSDL mới, đừng phục vụ bản dựng sẵn từ lúc build. */
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Tổng quan' };

/**
 * Tổng quan — trả lời **"kho tin đang có gì, và có đáng tin không"**.
 *
 * Bản v2 viết trang này như một LỜI CHÀO chứ không như một bảng điều khiển:
 * một câu nói hai con số (còn bao nhiêu tin, bao nhiêu đúng ngành bạn), hai
 * nút đi tiếp, rồi mới tới bằng chứng. Người mở trang này buổi sáng muốn biết
 * "có gì mới cho mình không", không muốn đọc biểu đồ trạng thái crawler.
 *
 * Thứ tự vẫn là thứ tự câu hỏi:
 *
 *   1. Kho có bao nhiêu tin sống, bao nhiêu đúng ngành     -> hero + dải số
 *   2. Có gì mới cho tôi                                   -> bốn tin mới nhất
 *   3. Con số đó dựa vào đâu                                -> sàn nào đang trả tin
 *   4. Tin được tới đâu                                     -> lời dặn của mèo
 *
 * Biểu đồ trạng thái, nhịp tin theo ngày, sức khoẻ bóc tách — những thứ bản
 * trước để ở đây — là việc của trang Nguồn & vận hành.
 */
export default async function OverviewPage() {
  const [overview, field, activeSources] = await Promise.all([
    getOverview(),
    findFieldJobs(DEFAULT_FIELD_SLUG),
    getActiveSources(),
  ]);

  const freshness = freshnessMeta(overview.lastCrawledAt);
  const greeting = !overview.lastCrawledAt
    ? 'Chào bạn — mình chưa quét lần nào'
    : freshness.tone === 'critical'
      ? `Chào bạn — lần quét gần nhất đã ${timeAgo(overview.lastCrawledAt)}, hơi lâu rồi`
      : `Chào bạn — mình đã quét xong ${timeAgo(overview.lastCrawledAt)}`;

  if (overview.alive === 0) {
    return (
      <Empty title="Kho chưa có tin nào còn hiệu lực">
        Mọi con số ở đây tính từ CSDL, nên trước khi crawler chạy lần đầu thì chưa có gì để nói. Chạy{' '}
        <Cmd>npm run crawl -- --source vnw --full</Cmd> để mèo đi gom tin.
      </Empty>
    );
  }

  const judged = field ? field.scanned - field.droppedByNarrowHcm : 0;
  const latest = field?.items.slice(0, 4) ?? [];

  // Sàn đang bật mà KHÔNG trả tin nào cho ngành — gộp một dòng rỗng. Đây là
  // dòng đáng đọc nhất khối này: nó cho biết con số phía trên đang dựa vào
  // ít sàn tới mức nào.
  const sourceRows = field?.stats.sources ?? [];
  const silent = activeSources.filter(
    (source) => !sourceRows.some((row) => row.label === source.name),
  );
  const sourceCeil = Math.max(1, ...sourceRows.map((row) => row.count));

  return (
    <>
      {/* ── 1. Lời chào ─────────────────────────────────────────────────── */}
      <section className="flex flex-wrap items-center gap-7 border-b-2 border-divider px-4 pt-10 pb-8 sm:px-6">
        <div className="min-w-0 flex-[1_1_420px]">
          <Kicker>{greeting}</Kicker>
          <h1 className="mb-3.5 text-[34px] leading-[1.03] text-pretty sm:text-[46px]">
            {formatCount(overview.alive)} tin còn hiệu lực
            {field && <>, {formatCount(field.total)} tin đúng ngành bạn</>}
          </h1>
          <p className="mb-5.5 max-w-145 text-base leading-[1.55] text-pretty text-neutral-800">
            Mèo Bae gom tin từ {overview.activeSources} sàn tuyển dụng, chấm điểm bằng từ điển ngành rồi
            loại tin hết hạn. Bạn chỉ cần chọn tin và bấm sang bản gốc.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <a href="/nganh" className="btn btn-primary h-11.5 gap-2 px-5">
              Vào ngành của tôi
              <Glyph name="arrowRight" size={16} strokeWidth={1.9} />
            </a>
            <a href="/viec" className="btn btn-secondary h-11.5 px-5">
              Xem toàn bộ kho tin
            </a>
          </div>
        </div>
        <div className="hidden flex-[0_1_300px] sm:block">
          <Mascot pose="sit" width={230} />
        </div>
      </section>

      {/* ── Dải số ──────────────────────────────────────────────────────── */}
      <StatStrip tone="plain">
        <StatCell
          tone="plain"
          size="xl"
          label="Tin còn hiệu lực"
          value={formatCount(overview.alive)}
          sub={`từ ${overview.activeSources} sàn đang bật`}
        />
        <StatCell
          tone="plain"
          size="xl"
          label="Đúng ngành của bạn"
          value={field ? formatCount(field.total) : '—'}
          emphasis
          sub={
            field
              ? `${formatPercent(field.dictionaryAccepted, judged)} số tin đã chấm điểm`
              : 'chưa định nghĩa ngành nào'
          }
          hint="Tỷ lệ tin từ điển ngành nhận, trên số tin đã đưa qua từ điển"
        />
        <StatCell
          tone="plain"
          size="xl"
          label="Tin mới trong 24h"
          value={formatCount(overview.postedLast24h)}
          sub={field ? `${formatCount(field.stats.postedLast24h)} tin thuộc ngành bạn` : 'trên toàn kho'}
        />
        <StatCell
          tone="plain"
          size="xl"
          label="Lương trung vị ngành"
          value={field?.stats.salaryMedian ? `${millions(field.stats.salaryMedian)} tr` : '—'}
          sub={
            field
              ? `${formatCount(field.stats.salaryCount)}/${formatCount(field.total)} tin ghi số`
              : 'chưa có ngành để tính'
          }
        />
      </StatStrip>

      <section className="flex flex-wrap items-start">
        {/* ── 2. Có gì mới cho tôi ──────────────────────────────────────── */}
        <div className="min-w-0 flex-[1_1_420px] border-divider px-4 pt-6.5 pb-9 sm:px-6 md:border-r-2">
          <h5 className="mb-4">Tin mới cho ngành của bạn</h5>
          {latest.length === 0 ? (
            <p className="text-sm text-neutral-700">
              {field
                ? 'Từ điển ngành chưa nhận tin nào. Thử nới từ điển ở trang Cài đặt.'
                : 'Chưa có ngành nào — chạy npm run db:seed để nạp ngành mẫu.'}
            </p>
          ) : (
            <div className="rise-list flex flex-col border-b border-divider">
              {latest.map(({ job }) => {
                const recent = Date.now() - job.postedAt.getTime() < 2 * 24 * 60 * 60 * 1000;
                const hasSalary = salaryValue(job) !== null;
                return (
                  <a
                    key={job.id}
                    href={`/viec/${job.id}?tu=nganh`}
                    className="jrow flex items-baseline gap-3.5 border-t border-divider px-2.5 py-3.5 text-text hover:text-text"
                  >
                    <span
                      className={cx(
                        'w-14 flex-none font-heading text-[13px] font-extrabold',
                        recent ? 'text-accent' : 'text-neutral-700',
                      )}
                    >
                      {shortAge(job.postedAt)}
                    </span>
                    <span className="min-w-0 flex-[1_1_200px] text-[15px]">
                      {job.title} · <span className="text-neutral-700">{job.company.name}</span>
                    </span>
                    {hasSalary ? (
                      <span className="flex-none font-heading text-sm font-extrabold text-accent-700">
                        {formatSalary(job.salaryMin, job.salaryMax, job.salaryIsPublic)}
                      </span>
                    ) : (
                      <span className="flex-none text-[13px] text-neutral-700">Thoả thuận</span>
                    )}
                  </a>
                );
              })}
            </div>
          )}
          {field && field.total > latest.length && (
            <a href="/nganh" className="btn btn-ghost mt-3.5 gap-1.75 text-[13px]">
              Xem cả {formatCount(field.total)} tin
              <Glyph name="arrowRight" size={14} strokeWidth={1.9} />
            </a>
          )}
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-6.5 border-t-2 border-divider px-4 pt-6.5 pb-9 sm:px-6 md:border-t-0">
          {/* ── 3. Con số dựa vào đâu ─────────────────────────────────── */}
          <div>
            <h5 className="mb-3.5">Tin về từ sàn nào</h5>
            <div className="flex flex-col gap-2.5 text-[13px]">
              {sourceRows.map((row, index) => (
                <BarRow
                  key={row.value}
                  label={row.label}
                  count={formatCount(row.count)}
                  ratio={row.count / sourceCeil}
                  fill={index === 0 ? 'accent' : 'mid'}
                  labelWidth={108}
                  countWidth={32}
                  delay={index * 0.08}
                  className="[&_.bar-count]:font-extrabold"
                />
              ))}
              {silent.length > 0 && (
                <BarRow
                  label={sourceRows.length === 0 ? `${silent.length} sàn đang bật` : `${silent.length} sàn còn lại`}
                  count="0"
                  ratio={null}
                  labelWidth={108}
                  countWidth={32}
                  className="text-neutral-700"
                />
              )}
            </div>
            <p className="mt-2.5 text-xs text-neutral-700">
              {silent.length === 0
                ? `Cả ${activeSources.length} sàn đang bật đều trả tin cho ngành này.`
                : `Chỉ ${sourceRows.length}/${activeSources.length} sàn đang trả tin cho ngành này.`}{' '}
              <a href="/nguon" className="underline">
                Xem vận hành
              </a>
            </p>
          </div>

          {/* ── 4. Tin được tới đâu ───────────────────────────────────── */}
          {field && (
            <div className="bg-text p-5 text-neutral-100">
              <div className="mb-2.5 flex items-center gap-2.5">
                <Mascot pose="head" width={34} ink="light" />
                <h6 className="text-neutral-100">Mèo Bae dặn</h6>
              </div>
              <p className="text-[13px] leading-[1.55] text-neutral-300">
                Mình mới kiểm còn-sống {formatCount(field.freshlyChecked)}/{formatCount(field.total)} tin
                trong {FRESH_CHECK_HOURS}h qua. Tin nào quan trọng thì mở bản gốc để chắc — mình không
                giữ nút ứng tuyển nào cả.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
