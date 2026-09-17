import { findFieldJobs } from '@/api/field.api';
import {
  getSaveContext,
  getSavedState,
  listSavedJobs,
  type SaveContext,
  type SavedEntry,
} from '@/api/saved.api';
import { experienceYears } from '@/components/job/field-job-card';
import { SaveJobButton } from '@/components/job/save-button';
import { EditLock } from '@/components/settings/edit-lock';
import { Cmd, Empty } from '@/components/ui/empty';
import { Glyph } from '@/components/ui/glyph';
import { Mascot } from '@/components/ui/mascot';
import { CheckedLabel, IdleDot, LiveDot } from '@/components/ui/status';
import { cx } from '@/components/ui/tone';
import { DEFAULT_FIELD_SLUG } from '@/constants/field';
import { SAVED_JOB_LIMIT } from '@/constants/saved';
import { salaryValue } from '@/lib/field-bands';
import { readParam, type SearchParams } from '@/lib/query';
import { daysLeft, formatCount, formatSalary, jobStatusMeta, timeAgo } from '@/utils/format';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Tin đã lưu' };

const ALIVE = new Set(['OPEN', 'STALE']);

/**
 * Tin đã lưu — những tin người dùng đánh dấu để theo dõi.
 *
 * Lời hứa của trang: tin đã lưu được máy kiểm gọi lại MỖI NGÀY, trước mọi tin
 * khác (xem `scripts/recheck.ts`). Nên ô trạng thái ở đầu trang nói đúng điều
 * đó — bao nhiêu tin còn mở, lần kiểm cũ nhất là khi nào.
 *
 * Tin sàn đã đóng KHÔNG tự biến mất khỏi đây. Bản thiết kế nói "ở lại tới khi
 * sàn nguồn đóng tin"; biến mất lặng lẽ thì người dùng tưởng mình lỡ tay xoá.
 * Chúng chuyển xuống cuối, mờ đi, ghi rõ lý do, và chờ người dùng tự bỏ.
 */
export default async function SavedPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const [entries, state, save, field] = await Promise.all([
    listSavedJobs(),
    getSavedState(),
    getSaveContext(),
    findFieldJobs(DEFAULT_FIELD_SLUG),
  ]);

  const open = entries.filter((entry) => ALIVE.has(entry.job.status));
  const closed = entries.filter((entry) => !ALIVE.has(entry.job.status));
  const neverChecked = open.some((entry) => entry.job.lastCheckedAt === null);
  const oldestCheck = open
    .map((entry) => entry.job.lastCheckedAt)
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const free = Math.max(0, SAVED_JOB_LIMIT - entries.length);

  return (
    <>
      <section className="flex flex-wrap items-end gap-6 border-b-2 border-divider px-4 pt-7.5 pb-6 sm:px-6">
        <div className="min-w-0 flex-[1_1_380px]">
          <h1 className="mb-2.5 text-[32px] leading-[1.05] sm:text-[38px]">Tin đã lưu</h1>
          <p className="max-w-145 text-[15px] leading-normal text-pretty text-neutral-800">
            Tin bạn đánh dấu ở lại đây tới khi sàn nguồn đóng tin. Mèo Bae kiểm lại mấy tin này mỗi ngày —
            ưu tiên hơn tin thường.
          </p>
        </div>
        {entries.length > 0 && (
          <div className="flex items-center gap-2.5 bg-brand px-4 py-3">
            {closed.length === 0 ? <LiveDot size={9} /> : <IdleDot size={9} />}
            <span className="text-[13px] text-accent-900">
              <strong className="font-extrabold">
                {open.length}/{entries.length}
              </strong>{' '}
              tin đã lưu còn mở ·{' '}
              {neverChecked
                ? 'có tin chưa kiểm lần nào'
                : oldestCheck
                  ? `kiểm ${timeAgo(oldestCheck)}`
                  : 'chưa kiểm lần nào'}
            </span>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3.5 px-4 pt-5.5 pb-10 sm:px-6">
        {!state.ready ? (
          <Empty title="Bảng tin đã lưu chưa có trong CSDL">
            Mã mới đã lên nhưng CSDL chưa được cập nhật. Chạy <Cmd>npm run db:push</Cmd> một lần — lệnh
            này chỉ THÊM bảng <Cmd>SavedJob</Cmd>, không đụng dữ liệu cũ.
          </Empty>
        ) : (
          <>
            <EditLock back="/da-luu" wrong={readParam(params, 'khoa') === 'sai'} />

            {[...open, ...closed].map((entry, index) => (
              <SavedCard key={entry.job.id} entry={entry} save={save} delay={Math.min(index, 7) * 0.06} />
            ))}

            <div className="mt-2 flex flex-wrap items-center gap-5.5 border-2 border-dashed border-accent-300 bg-brand-soft px-6 py-8">
              <Mascot pose="sleep" width={150} />
              <div className="max-w-118 flex-[1_1_300px]">
                <h5 className="mb-2">
                  {entries.length === 0
                    ? 'Chưa lưu tin nào — mèo đang rảnh'
                    : free === 0
                      ? `Đã đủ ${SAVED_JOB_LIMIT} tin — bỏ bớt để lưu tin mới`
                      : `Còn ${free} chỗ trống — mèo vẫn rảnh`}
                </h5>
                <p className="mb-3.5 text-sm leading-[1.55] text-pretty text-neutral-800">
                  Lưu tối đa {SAVED_JOB_LIMIT} tin. Tin đã lưu được kiểm còn-sống mỗi ngày, nên đừng tiếc mà
                  bỏ qua tin hay. Bấm nút lưu ở thẻ tin, ở bảng Kho tin hoặc ở trang chi tiết.
                </p>
                <a href="/nganh" className="btn btn-secondary gap-2">
                  Quay lại {field ? `${formatCount(field.total)} tin trong ngành` : 'danh sách ngành'}
                  <Glyph name="arrowRight" size={15} />
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function SavedCard({ entry, save, delay }: { entry: SavedEntry; save: SaveContext; delay: number }) {
  const { job } = entry;
  const alive = ALIVE.has(job.status);
  const status = jobStatusMeta(job.status);
  const remaining = daysLeft(job.expiresAt);
  const hasSalary = salaryValue(job) !== null;
  const facts = [
    job.company.name,
    job.district ?? job.locations.map((l) => l.location.name).join(' · '),
    experienceYears(job.yearsExpMin, job.yearsExpMax),
  ].filter(Boolean);

  return (
    <article
      className={cx(
        'jcard rise @container border-l-[6px] bg-neutral-100 shadow-sm',
        alive ? 'border-live' : 'border-neutral-500 opacity-75',
      )}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      <div className="flex flex-col @min-[600px]:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 px-5.5 py-5">
          {alive ? (
            <CheckedLabel lastCheckedAt={job.lastCheckedAt} className="self-start text-xs" />
          ) : (
            <span className="inline-flex items-center gap-1.5 self-start text-xs font-extrabold text-neutral-700" title={status.hint}>
              <IdleDot size={8} />
              Sàn đã đóng tin · {status.label.toLowerCase()}
            </span>
          )}
          <h4 className="text-[21px] leading-[1.18] text-pretty">
            <a href={`/viec/${job.id}`} className="text-text hover:text-accent-700">
              {job.title}
            </a>
          </h4>
          <p className="text-sm text-neutral-800">{facts.join(' · ')}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-divider pt-2.5 text-xs text-neutral-700">
            <span className="font-extrabold text-text">{job.source.name}</span>
            <span>Lưu {timeAgo(entry.savedAt)}</span>
            {alive && remaining !== null && remaining >= 0 && (
              <span className={cx('font-extrabold', remaining <= 3 ? 'text-warn-ink' : 'text-accent-700')}>
                {remaining === 0 ? 'Hết hạn hôm nay' : `Còn ${remaining} ngày`}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col justify-between gap-3.5 border-t border-divider px-5.5 py-5 @min-[600px]:w-54 @min-[600px]:flex-none @min-[600px]:border-t-0 @min-[600px]:border-l">
          {hasSalary ? (
            <p className="font-heading text-[27px] leading-none font-extrabold text-accent-700">
              {formatSalary(job.salaryMin, job.salaryMax, job.salaryIsPublic)}
            </p>
          ) : (
            <p className="font-heading text-xl leading-none font-extrabold text-neutral-700">Thoả thuận</p>
          )}
          <div className="flex flex-col items-start gap-1">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="btn btn-primary btn-block h-10.5 gap-2"
            >
              Xem tin gốc
              <Glyph name="external" size={14} />
            </a>
            <SaveJobButton jobId={job.id} context={save} variant="remove" />
          </div>
        </div>
      </div>
    </article>
  );
}
