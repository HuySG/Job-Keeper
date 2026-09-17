import type { FieldVerdict } from '@/api/field.api';
import type { JobListItem } from '@/api/job.api';
import type { SaveContext } from '@/api/saved.api';
import { Glyph } from '@/components/ui/glyph';
import { cx } from '@/components/ui/tone';
import type { WorkspaceId } from '@/constants/workspace';
import { salaryValue } from '@/lib/field-bands';
import { wsHref } from '@/lib/workspace-path';
import { daysLeft, formatSalary, jobStatusMeta } from '@/utils/format';

import { experienceYears } from './field-job-card';
import { SaveJobButton } from './save-button';

/**
 * Bảng Kho tin — một tin một dòng, cột lương thẳng hàng để QUÉT.
 *
 * Kho tin là chỗ đọc hàng nghìn tin chưa lọc theo ngành, nên hình dạng đúng là
 * bảng: mắt chạy dọc cột lương và cột "còn lại" mà không phải đọc lại tiêu đề.
 *
 * Ô vuông đầu dòng nối Kho tin với trang Ngành: ô đặc = tin này ĐANG hiện ở
 * danh sách "Ngành của tôi"; ô rỗng = không. Cùng bộ chấm `fieldJudge` với
 * trang Ngành, nên hai trang không bao giờ cãi nhau về cùng một tin.
 */

/** Tin còn dưới ngần này ngày thì cột "còn lại" chuyển xám để người đọc để mắt. */
export const SHORT_RUNWAY_DAYS = 14;

/** Thanh "còn lại" đầy khi còn ngần này ngày — đúng trần tuổi tin của ngành mẫu. */
const RUNWAY_FULL_DAYS = 90;

export function JobTable({
  ws,
  items,
  judge,
  save,
}: {
  ws: WorkspaceId;
  items: JobListItem[];
  judge: ((job: JobListItem) => FieldVerdict) | null;
  save: SaveContext;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="table min-w-210">
        <caption className="sr-only">Danh sách tin trong kho</caption>
        <thead>
          <tr>
            <th className="w-[40%] pl-4 sm:pl-6">Chức danh &amp; công ty</th>
            <th>Khu vực</th>
            <th className="text-right">Lương</th>
            <th>Sàn nguồn</th>
            <th>Còn lại</th>
            <th className="pr-4 text-right sm:pr-6">Tin gốc</th>
          </tr>
        </thead>
        <tbody className="rise-list">
          {items.map((job) => (
            <Row key={job.id} ws={ws} job={job} verdict={judge?.(job) ?? null} save={save} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({
  ws,
  job,
  verdict,
  save,
}: {
  ws: WorkspaceId;
  job: JobListItem;
  verdict: FieldVerdict | null;
  save: SaveContext;
}) {
  const remaining = daysLeft(job.expiresAt);
  const dead = job.status === 'EXPIRED' || job.status === 'CLOSED';
  const status = jobStatusMeta(job.status);
  const hasSalary = salaryValue(job) !== null;
  const place =
    job.district ?? (job.locations.map((entry) => entry.location.name).join(' · ') || 'không ghi');
  const experience = experienceYears(job.yearsExpMin, job.yearsExpMax) ?? 'tin không ghi KN';

  return (
    <tr className={cx('jrow', dead && 'opacity-60')}>
      <td className="pl-4 sm:pl-6">
        <div className="mb-1 flex items-center gap-2">
          <span
            className={cx(
              'size-1.75 flex-none',
              verdict?.listed ? 'bg-accent' : 'border-[1.5px] border-neutral-400',
            )}
            title={
              verdict?.listed
                ? 'Đúng ngành của bạn — đang hiện ở trang Ngành'
                : verdict?.inScope && verdict.match.verdict === 'weak'
                  ? 'Khớp yếu với ngành — trang Ngành đang ẩn loại này'
                  : 'Ngoài ngành của bạn'
            }
          />
          <a
            href={wsHref(ws, `/viec/${job.id}`)}
            className="font-heading text-[15px] leading-[1.25] font-extrabold text-text hover:text-accent-700"
          >
            {job.title}
          </a>
        </div>
        <div className="pl-3.75 text-[13px] text-neutral-700">
          {job.company.name} · {experience}
          {job.status !== 'OPEN' && (
            <span className="tag tag-warn ml-2 px-1.5 py-0 text-[11px]" title={status.hint}>
              {status.label}
            </span>
          )}
        </div>
      </td>
      <td className="text-[13px]">{place}</td>
      <td className="text-right">
        {hasSalary ? (
          <span className="tnum font-heading text-[15px] font-extrabold whitespace-nowrap text-accent-700">
            {formatSalary(job.salaryMin, job.salaryMax, job.salaryIsPublic)}
          </span>
        ) : (
          <span className="text-[13px] text-neutral-700">Thoả thuận</span>
        )}
      </td>
      <td>
        <span className="tag tag-neutral text-[11px] whitespace-nowrap">{job.source.name}</span>
      </td>
      <td>
        {remaining === null || remaining < 0 ? (
          <span className="text-[13px] text-neutral-600" title="Sàn nguồn không khai hạn nộp">
            {remaining === null ? '—' : 'quá hạn'}
          </span>
        ) : (
          <div className="flex items-center gap-2" title="Theo ngày hết hạn sàn nguồn ghi">
            <span className="block h-1.5 max-w-14 flex-1 bg-neutral-200">
              <span
                className={cx('bar-fill h-1.5', remaining < SHORT_RUNWAY_DAYS ? 'bg-neutral-500' : 'bg-accent-400')}
                style={{ width: `${Math.max(4, Math.min(100, (remaining / RUNWAY_FULL_DAYS) * 100))}%` }}
              />
            </span>
            <span
              className={cx('tnum text-[13px]', remaining < SHORT_RUNWAY_DAYS && 'text-neutral-700')}
            >
              {remaining}n
            </span>
          </div>
        )}
      </td>
      <td className="pr-4 text-right whitespace-nowrap sm:pr-6">
        <div className="inline-flex items-center gap-1">
          <SaveJobButton jobId={job.id} context={save} variant="icon" />
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label={`Mở tin gốc trên ${job.source.name}`}
            title={`Mở tin gốc trên ${job.source.name}`}
            className="btn btn-ghost btn-icon size-8"
          >
            <Glyph name="external" size={15} />
          </a>
        </div>
      </td>
    </tr>
  );
}
