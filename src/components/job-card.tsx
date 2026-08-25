import {
  daysLeft,
  employmentLabel,
  formatSalary,
  levelLabel,
  sourceLabel,
  timeAgo,
} from '@/utils/format';

interface JobCardProps {
  job: {
    id: number;
    title: string;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryIsPublic: boolean;
    level: string | null;
    employmentType: string | null;
    workMode: string | null;
    postedAt: Date;
    expiresAt: Date | null;
    status: string;
    company: { name: string; logoUrl: string | null };
    source: { code: string; name: string };
    locations: { location: { name: string; slug: string } }[];
  };
}

/**
 * Thẻ tin.
 *
 * Thứ tự thông tin theo đúng thứ tự người đi tìm việc quét mắt:
 *   chức danh -> lương -> công ty -> nơi làm -> còn hạn không -> nguồn
 *
 * Lương được đưa lên hàng đầu, tô màu, cỡ chữ lớn — vì đó là thứ quyết định
 * người ta có đọc tiếp hay không. Bản trước để lương thành chữ nhỏ nép bên phải
 * cùng cỡ với mọi thứ khác, nên quét mắt qua không thấy gì nổi bật.
 */
export function JobCard({ job }: JobCardProps) {
  const remaining = daysLeft(job.expiresAt);
  const places = job.locations.map((l) => l.location.name).join(' · ');
  const employment = employmentLabel(job.employmentType);
  const isUnconfirmed = job.status === 'STALE';
  const isDead = job.status === 'EXPIRED' || job.status === 'CLOSED';

  return (
    <a
      href={`/viec/${job.id}`}
      className={`block rounded-xl border border-border bg-surface p-4 transition-all hover:border-accent hover:shadow-sm ${
        isDead ? 'opacity-55' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="min-w-0 flex-1 font-medium leading-snug">{job.title}</h2>

        <span
          className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-semibold ${
            job.salaryIsPublic
              ? 'bg-accent/12 text-accent'
              : 'text-muted'
          }`}
        >
          {formatSalary(job.salaryMin, job.salaryMax, job.salaryIsPublic)}
        </span>
      </div>

      <p className="mt-1 truncate text-sm text-muted">{job.company.name}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        {places && <Tag>📍 {places}</Tag>}
        {job.level && <Tag>{levelLabel(job.level)}</Tag>}
        {employment && <Tag>{employment}</Tag>}
        {job.workMode === 'REMOTE' && <Tag className="text-emerald-600">Làm từ xa</Tag>}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
        <span>Đăng {timeAgo(job.postedAt)}</span>
        <Dot />
        <span>{sourceLabel(job.source.code)}</span>

        {remaining !== null && remaining >= 0 && (
          <>
            <Dot />
            <span className={remaining <= 3 ? 'font-medium text-amber-600' : ''}>
              {remaining === 0 ? 'hết hạn hôm nay' : `còn ${remaining} ngày`}
            </span>
          </>
        )}

        {/* Nói thật thay vì giấu: nguồn không báo cho ta khi họ gỡ tin, nên
            "chưa xác nhận lại" là điều trung thực nhất có thể nói. */}
        {isUnconfirmed && (
          <>
            <Dot />
            <span
              className="text-amber-600"
              title="Tin đã vắng khỏi danh mục của nguồn ở lần quét gần nhất — có thể đã được gỡ"
            >
              chưa xác nhận lại
            </span>
          </>
        )}

        {isDead && (
          <>
            <Dot />
            <span className="font-medium">
              {job.status === 'EXPIRED' ? 'đã hết hạn' : 'đã gỡ'}
            </span>
          </>
        )}
      </div>
    </a>
  );
}

function Tag({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`rounded-md bg-bg px-2 py-1 text-muted ${className}`}
    >
      {children}
    </span>
  );
}

function Dot() {
  return <span aria-hidden className="opacity-40">·</span>;
}
