import type { JobListItem } from '@/api/job.api';
import { Badge, Chip } from '@/components/ui/badge';
import { cx } from '@/components/ui/tone';
import {
  daysLeft,
  employmentLabel,
  formatSalary,
  jobStatusMeta,
  levelLabel,
  timeAgo,
  workModeLabel,
} from '@/utils/format';

/**
 * Thẻ tin.
 *
 * Thứ tự thông tin theo đúng thứ tự người đi tìm việc quét mắt:
 *
 *   chức danh -> lương -> công ty -> nơi làm -> còn hạn không -> nguồn
 *
 * Lương được đưa lên hàng đầu, tô màu, cỡ chữ lớn — vì đó là thứ quyết định
 * người ta có đọc tiếp hay không. Bản trước để lương thành chữ nhỏ nép bên
 * phải cùng cỡ với mọi thứ khác, nên quét mắt qua không thấy gì nổi bật.
 *
 * "Thoả thuận" cố ý KHÔNG tô màu: tô lên là cho nó cùng trọng lượng thị giác
 * với một con số thật, trong khi nó chính là chỗ thiếu thông tin.
 */
export function JobCard({ job }: { job: JobListItem }) {
  const remaining = daysLeft(job.expiresAt);
  const places = job.locations.map((l) => l.location.name).join(' · ');
  const employment = employmentLabel(job.employmentType);
  const remote = job.workMode === 'REMOTE' || job.workMode === 'HYBRID';
  const status = jobStatusMeta(job.status);
  const dead = job.status === 'EXPIRED' || job.status === 'CLOSED';

  return (
    <article
      className={cx(
        'rounded-card border border-border bg-surface transition-colors hover:border-border-strong',
        dead && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="leading-snug font-medium">
            <a href={'/viec/' + job.id} className="hover:text-accent-ink hover:underline">
              {job.title}
            </a>
          </h3>
          <p className="mt-1 truncate text-sm text-muted">{job.company.name}</p>
        </div>

        <span
          className={cx(
            'tnum shrink-0 rounded-lg px-2.5 py-1 text-sm font-semibold',
            job.salaryIsPublic ? 'bg-accent-soft text-accent-ink' : 'text-muted',
          )}
        >
          {formatSalary(job.salaryMin, job.salaryMax, job.salaryIsPublic)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4">
        {places && <Chip>{places}</Chip>}
        {job.level && <Chip>{levelLabel(job.level)}</Chip>}
        {employment && <Chip>{employment}</Chip>}
        {remote && <Chip>{workModeLabel(job.workMode)}</Chip>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border px-4 py-2.5 text-xs text-muted">
        <span>Đăng {timeAgo(job.postedAt)}</span>
        <Dot />
        <span>{job.source.name}</span>

        {remaining !== null && remaining >= 0 && (
          <>
            <Dot />
            <span className={remaining <= 3 ? 'font-medium text-warn-ink' : undefined}>
              {remaining === 0 ? 'hết hạn hôm nay' : 'còn ' + remaining + ' ngày'}
            </span>
          </>
        )}

        {/* Nói thật thay vì giấu: nguồn không báo cho ta khi họ gỡ tin, nên chỉ
            trạng thái OPEN mới là "bình thường" và không cần nhãn. */}
        {job.status !== 'OPEN' && (
          <Badge tone={status.tone} hint={status.hint} className="ml-auto">
            {status.label}
          </Badge>
        )}
      </div>
    </article>
  );
}

function Dot() {
  return <span aria-hidden className="opacity-40">·</span>;
}
