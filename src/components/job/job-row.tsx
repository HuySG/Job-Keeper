import type { JobListItem } from '@/api/job.api';
import { cx } from '@/components/ui/tone';
import { formatSalary, timeAgo } from '@/utils/format';

/**
 * Một dòng tin gọn — dùng trong bảng điều khiển, nơi tin chỉ là **bằng chứng**
 * cho các con số bên trên chứ không phải nội dung chính.
 *
 * Cố ý là một component RIÊNG chứ không phải `<JobCard compact>`: một thẻ có
 * cờ "gọn" rồi sẽ mọc thêm cờ, và mỗi cờ nhân đôi số trường hợp phải thử. Hai
 * component nhỏ, mỗi cái làm một việc, rẻ hơn một component có hai chế độ.
 */
export function JobRow({ job }: { job: JobListItem }) {
  const place = job.locations[0]?.location.name;

  return (
    <li>
      <a
        href={'/viec/' + job.id}
        className="flex items-baseline gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-inset"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{job.title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {job.company.name}
            {place && (
              <>
                <span className="mx-1.5 opacity-40">·</span>
                {place}
              </>
            )}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span
            className={cx(
              'tnum block text-sm',
              job.salaryIsPublic ? 'font-medium text-accent-ink' : 'text-muted',
            )}
          >
            {formatSalary(job.salaryMin, job.salaryMax, job.salaryIsPublic)}
          </span>
          <span className="mt-0.5 block text-xs text-faint">{timeAgo(job.postedAt)}</span>
        </span>
      </a>
    </li>
  );
}
