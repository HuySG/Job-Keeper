import type { ReactNode } from 'react';

import { findFieldJobs } from '@/api/field.api';
import {
  getParseHealth,
  getRecentRuns,
  getReparseCoverage,
  getSourceHealth,
  type RunWithSources,
} from '@/api/ops.api';
import { getOverview } from '@/api/stats.api';
import { Callout } from '@/components/ui/callout';
import { Cmd } from '@/components/ui/empty';
import { Glyph } from '@/components/ui/glyph';
import { Mascot } from '@/components/ui/mascot';
import { IdleDot, LiveDot } from '@/components/ui/status';
import { cx } from '@/components/ui/tone';
import { DEFAULT_FIELD_SLUG, FRESH_CHECK_HOURS } from '@/constants/field';
import { CrawlTrigger, RunStatus } from '@/enums';
import { CRAWL_CYCLE_HOURS, durationUntil, nextCrawlAt } from '@/lib/crawl-schedule';
import {
  formatCount,
  formatDateTime,
  formatDuration,
  formatPercent,
  freshnessMeta,
  runStatusMeta,
  timeAgo,
} from '@/utils/format';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Nguồn & vận hành' };

/**
 * Nguồn & vận hành — trả lời **"crawler còn sống không, nguồn nào đang hỏng"**.
 *
 * Bản v2 gọi trang này là chỗ "công khai luôn chỗ yếu". Ba khối, xếp theo mức
 * độ khó phát hiện nếu không nhìn:
 *
 *   1. Sàn nào đang trả tin cho ngành, sàn nào im lặng   — im lặng thì dễ quên nhất
 *   2. Đường đi của một tin, tới bước kiểm còn-sống       — chỗ yếu nhất hiện tại
 *   3. Nhật ký quét                                        — crawler chết lúc nào
 *
 * Hai chỉ số máy móc của bản trước — bóc tách thiếu trường, còn giữ bản thô —
 * vẫn ở đây, gọn lại dưới khối 2. Chúng là thứ cần biết TRƯỚC khi biểu đồ
 * lương bắt đầu nói sai, nên không được biến mất chỉ vì bản vẽ không có chỗ.
 */
export default async function OpsPage() {
  const [sources, runs, parse, reparse, overview, field] = await Promise.all([
    getSourceHealth(),
    getRecentRuns(8),
    getParseHealth(),
    getReparseCoverage(),
    getOverview(),
    findFieldJobs(DEFAULT_FIELD_SLUG),
  ]);

  const now = new Date();
  const freshness = freshnessMeta(overview.lastCrawledAt);
  const stale = freshness.tone === 'critical';

  // Đếm tin NGÀNH theo sàn. Sàn không có trong thống kê nghĩa là 0 tin ngành.
  const fieldCount = new Map((field?.stats.sources ?? []).map((row) => [row.label, row.count]));
  const active = sources.filter((source) => source.isActive);
  const producing = active
    .filter((source) => (fieldCount.get(source.name) ?? 0) > 0)
    .sort((a, b) => (fieldCount.get(b.name) ?? 0) - (fieldCount.get(a.name) ?? 0));
  const silentActive = active.filter((source) => !producing.includes(source));
  const inactive = sources.filter((source) => !source.isActive);
  const ceil = Math.max(1, ...producing.map((source) => fieldCount.get(source.name) ?? 0));

  const total = field?.total ?? 0;
  const fresh = field?.freshlyChecked ?? 0;
  const parsed = parse.ok + parse.partial + parse.failed;
  const next = nextCrawlAt(now);

  return (
    <>
      <section className="flex flex-wrap items-end gap-6 border-b-2 border-divider px-4 pt-7.5 pb-6.5 sm:px-6">
        <div className="min-w-0 flex-[1_1_400px]">
          <h1 className="mb-2.5 text-[32px] leading-[1.05] sm:text-[38px]">Nguồn &amp; vận hành</h1>
          <p className="max-w-155 text-[15px] leading-normal text-pretty text-neutral-800">
            Mình công khai luôn chỗ yếu: sàn nào đang chạy, lần quét gần nhất, và bao nhiêu tin thật sự
            được kiểm còn-sống.
          </p>
        </div>
        <div
          title={freshness.hint}
          className={cx(
            'flex items-center gap-3 border-l-[6px] bg-neutral-200 px-4.5 py-3.5',
            stale ? 'border-critical' : 'border-accent',
          )}
        >
          {stale ? <IdleDot size={10} /> : <LiveDot size={10} />}
          <div>
            <p className={cx('font-heading text-[15px] font-extrabold', stale && 'text-critical-ink')}>
              Lần quét gần nhất: {timeAgo(overview.lastCrawledAt)}
            </p>
            <p className="text-xs text-neutral-700">
              chu kỳ mỗi {CRAWL_CYCLE_HOURS} giờ
              {field && ` · ${formatCount(field.scanned)} tin được chấm điểm`}
            </p>
          </div>
        </div>
      </section>

      {/* ── 1. Từng sàn ──────────────────────────────────────────────────── */}
      <section className="flex flex-wrap">
        {producing.map((source, index) => {
          const count = fieldCount.get(source.name) ?? 0;
          return (
            <div
              key={source.code}
              className="srcrow flex-[1_1_300px] border-r border-b-2 border-divider px-4 py-5.5 sm:px-6"
            >
              <div className="mb-3 flex items-center gap-2">
                <LiveDot size={8} />
                <a href={`/viec?source=${source.code}`} className="font-heading text-base font-extrabold text-text">
                  {source.name}
                </a>
                <span className="tag tag-accent ml-auto text-[11px]">đang chạy</span>
              </div>
              <p className="mb-2 font-heading text-[32px] leading-none font-extrabold">
                {formatCount(count)} <span className="text-sm text-neutral-600">tin ngành</span>
              </p>
              <span className="block h-2.5 bg-neutral-200">
                <span
                  className={cx('bar-fill h-2.5', index === 0 ? 'bg-accent' : 'bg-accent-400')}
                  style={{ width: `${(count / ceil) * 100}%`, animationDelay: `${index * 0.07}s` }}
                />
              </span>
              <p className="mt-2.5 text-xs text-neutral-700">
                Thấy tin {timeAgo(source.lastSeenAt)} · {formatCount(source.alive)} tin sống ·{' '}
                <span className={source.failed > 0 ? 'font-extrabold text-warn-ink' : undefined}>
                  {formatCount(source.failed)} lỗi bóc
                </span>
              </p>
            </div>
          );
        })}

        {silentActive.length + inactive.length > 0 && (
          <div className="flex-[1_1_300px] border-b-2 border-divider bg-neutral-200 px-4 py-5.5 sm:px-6">
            <div className="mb-3 flex items-center gap-2">
              <IdleDot size={8} />
              <span className="font-heading text-base font-extrabold text-neutral-700">
                {producing.length === 0 ? `${silentActive.length + inactive.length} sàn` : `${silentActive.length + inactive.length} sàn còn lại`}
              </span>
              <span className="tag tag-neutral ml-auto text-[11px]">chưa trả tin</span>
            </div>
            <p className="mb-2 font-heading text-[32px] leading-none font-extrabold text-neutral-600">
              0 <span className="text-sm">tin ngành</span>
            </p>
            <span className="block h-2.5 bg-neutral-300" />
            <div className="mt-2.5 flex flex-col gap-1 text-xs text-neutral-700">
              {silentActive.length > 0 && (
                <p>
                  {silentActive.map((source) => source.name).join(' · ')} — đang bật, chưa có tin ngành
                </p>
              )}
              {inactive.length > 0 && (
                <p>
                  {inactive.map((source, index) => (
                    <span key={source.code} title={source.note ?? 'Nguồn đang tắt trong bảng Source'}>
                      {index > 0 && ' · '}
                      {source.name}
                    </span>
                  ))}{' '}
                  — đang chờ bật
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-wrap items-stretch">
        {/* ── 2. Đường đi của một tin ────────────────────────────────────── */}
        <div className="min-w-0 flex-[1_1_380px] border-divider px-4 pt-6.5 pb-9 sm:px-6 md:border-r-2">
          <h5 className="mb-4.5">Đường đi của một tin</h5>
          <div className="flex flex-col border-b border-divider">
            <Step value={formatCount(overview.alive)}>
              tin còn hiệu lực gom về từ {overview.activeSources} sàn
            </Step>
            {field && (
              <>
                <Step value={formatCount(field.scanned)}>
                  tin trong phạm vi {field.provinceNames.join(', ') || 'của ngành'} được chấm điểm bằng từ điển
                  ngành
                </Step>
                <Step value={formatCount(total)}>
                  tin lọt qua ngưỡng khớp chắc ({formatPercent(total, field.scanned)})
                  {field.weakHidden > 0 && (
                    <span className="text-neutral-700"> · thêm {formatCount(field.weakHidden)} tin khớp yếu đang ẩn</span>
                  )}
                </Step>
                <Step value={formatCount(fresh)} muted>
                  tin được mở lại để kiểm còn-sống trong {FRESH_CHECK_HOURS}h
                </Step>
              </>
            )}
          </div>

          {field && total > 0 && (
            fresh * 2 < total ? (
              <Callout
                tone="accent"
                className="mt-5"
                icon={<Glyph name="alert" size={18} strokeWidth={1.9} stroke="var(--color-accent-700)" />}
              >
                Đây là chỗ yếu nhất hiện tại: {formatCount(total - fresh)}/{formatCount(total)} tin chưa được
                kiểm lại, chỉ tin theo ngày hết hạn sàn ghi. Chạy{' '}
                <Cmd>npm run recheck -- --filter {field.slug}</Cmd> để mèo đi gõ cửa từng tin.
              </Callout>
            ) : (
              <Callout tone="live" className="mt-5" icon={<LiveDot size={9} />}>
                Hơn nửa số tin ngành đã được gọi lại trong {FRESH_CHECK_HOURS}h qua — {formatCount(fresh)}/
                {formatCount(total)} tin.
              </Callout>
            )
          )}

          <h6 className="mt-7 mb-2.5">Sức khoẻ máy</h6>
          <dl className="flex flex-col border-b border-divider text-[13px]">
            <Health
              label="Bóc tách thiếu trường"
              value={formatPercent(parse.partial + parse.failed, parsed)}
              warn={parse.failed > 0}
              note={`${formatCount(parse.partial)} thiếu · ${formatCount(parse.failed)} hỏng — trôi lên là dấu hiệu một sàn vừa đổi bố cục`}
            />
            <Health
              label="Còn giữ bản thô"
              value={formatPercent(reparse.withBlob, reparse.total)}
              warn={reparse.withBlob < reparse.total}
              note={`${formatCount(reparse.total - reparse.withBlob)} tin đã mất bản thô — với chúng, lỗi parser phát hiện về sau không sửa lại được bằng npm run reparse`}
            />
          </dl>
        </div>

        {/* ── 3. Nhật ký quét ────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5.5 border-t-2 border-divider px-4 pt-6.5 pb-9 sm:px-6 md:border-t-0">
          <div>
            <h5 className="mb-4">Nhật ký quét</h5>
            {runs.length === 0 ? (
              <p className="text-sm text-neutral-700">
                Chưa có lần chạy nào được ghi nhật ký. Chạy <Cmd>npm run crawl</Cmd> để bắt đầu.
              </p>
            ) : (
              <div className="flex flex-col border-b border-divider">
                {runs.map((run) => (
                  <RunRow key={run.id} run={run} />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-start gap-4 bg-text p-5.5 text-neutral-100">
            <Mascot pose="sleep" width={76} ink="light" zzz={!stale} />
            <div>
              <h6 className="mb-2 text-neutral-100">
                {stale ? 'Mèo Bae ngủ quên rồi' : 'Mèo Bae đang ngủ trưa'}
              </h6>
              <p className="text-[13px] leading-[1.55] text-neutral-300">
                {stale
                  ? `Lần quét gần nhất đã ${timeAgo(overview.lastCrawledAt)} — quá chu kỳ ${CRAWL_CYCLE_HOURS} giờ. Mở tab Actions trên GitHub xem lượt cào có bị tắt hay hỏng không.`
                  : `Lần quét kế tiếp sau khoảng ${durationUntil(next, now)} nữa. Trong lúc đó danh sách vẫn giữ nguyên — không có tin nào tự biến mất.`}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Step({ value, muted = false, children }: { value: string; muted?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3.5 border-t border-divider py-3.5">
      <span
        className={cx(
          'tnum w-18 flex-none font-heading text-[22px] font-extrabold',
          muted ? 'text-neutral-600' : 'text-accent',
        )}
      >
        {value}
      </span>
      <span className={cx('flex-1 text-sm', muted && 'text-neutral-700')}>{children}</span>
    </div>
  );
}

function Health({ label, value, note, warn }: { label: string; value: string; note: string; warn: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 border-t border-divider py-2.5" title={note}>
      <dt className="flex-1">{label}</dt>
      <dd className={cx('m-0 tnum font-heading font-extrabold', warn && 'text-warn-ink')}>{value}</dd>
    </div>
  );
}

/**
 * Một dòng nhật ký, mở ra được để xem từng nguồn — một nguồn hỏng không được
 * làm mờ bức tranh của các nguồn còn lại.
 */
function RunRow({ run }: { run: RunWithSources }) {
  const status = runStatusMeta(run.status);
  const failed = run.status === RunStatus.FAILED || run.status === RunStatus.ABORTED;
  const errors = run.sources.filter((entry) => entry.errorLog);

  return (
    <details className="group border-t border-divider">
      <summary
        className={cx(
          'flex cursor-pointer list-none gap-3 py-3 text-[13px] [&::-webkit-details-marker]:hidden',
          failed && 'text-neutral-700',
        )}
      >
        <span className="w-20 flex-none text-neutral-700" title={formatDateTime(run.startedAt)}>
          {timeAgo(run.startedAt).replace(' trước', '')}
        </span>
        <span className="flex-1">
          {failed && <strong className="font-extrabold text-critical-ink">{status.label} · </strong>}
          {describeRun(run)}
          {errors.length > 0 && !failed && (
            <span className="text-warn-ink">
              {' '}
              · {errors.map((entry) => entry.source.name).join(', ')} lỗi
            </span>
          )}
        </span>
        <Glyph name="chevronDown" size={14} className="mt-0.5 text-neutral-600 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mb-3 bg-neutral-100 px-3 py-2.5 text-xs">
        <p className="mb-1.5 text-neutral-700">
          {formatDateTime(run.startedAt)} · {run.trigger} · {formatDuration(run.startedAt, run.finishedAt)} ·{' '}
          <span title={status.hint}>{status.label}</span>
        </p>
        {run.errorLog && (
          <p className="mb-1.5 bg-critical-soft px-2 py-1.5 font-mono whitespace-pre-line text-critical-ink">
            {run.errorLog}
          </p>
        )}
        {run.sources.length === 0 ? (
          <p className="text-neutral-700">Lần chạy này không ghi chi tiết nguồn.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {run.sources.map((entry) => (
              <li key={entry.id}>
                <strong className="font-extrabold">{entry.source.name}</strong>{' '}
                <span className="tnum text-neutral-700">
                  {runStatusMeta(entry.status).label} · {formatCount(entry.urlsDiscovered)} URL ·{' '}
                  {formatCount(entry.pagesFetched)} trang · +{formatCount(entry.postingsNew)} mới ·{' '}
                  {formatCount(entry.postingsUpdated)} sửa
                </span>
                {entry.errorLog && <span className="block font-mono text-critical-ink">{entry.errorLog}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

/** Một câu tiếng người cho mỗi lần chạy, theo đúng việc lần đó làm. */
function describeRun(run: RunWithSources): string {
  if (run.status === RunStatus.RUNNING) return `Đang chạy${run.sources.length ? ` ${run.sources.length} sàn` : ''}…`;

  switch (run.trigger) {
    case CrawlTrigger.RECHECK:
      return `Kiểm còn-sống ${formatCount(run.pagesFetched)} tin · ${formatCount(run.postingsUpdated)} còn mở · ${formatCount(run.postingsClosed)} đã đóng`;
    case CrawlTrigger.REPARSE:
      return `Tính lại từ bản thô · ${formatCount(run.postingsUpdated)} tin đổi`;
    default: {
      const scope = run.sources.length ? `Quét ${run.sources.length} sàn` : 'Quét';
      const done = run.status === RunStatus.SUCCESS ? ' xong' : '';
      const closed = run.postingsClosed > 0 ? ` · −${formatCount(run.postingsClosed)} tin đóng` : '';
      return `${scope}${done} · +${formatCount(run.postingsNew)} tin mới · ${formatCount(run.postingsUpdated)} sửa${closed}`;
    }
  }
}
