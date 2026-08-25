import { notFound } from 'next/navigation';

import { getJob } from '@/api/job.api';
import {
  daysLeft,
  employmentLabel,
  formatSalary,
  levelLabel,
  timeAgo,
} from '@/utils/format';

export const dynamic = 'force-dynamic';

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(Number(id));
  if (!job) notFound();

  const remaining = daysLeft(job.expiresAt);
  const isDead = job.status === 'EXPIRED' || job.status === 'CLOSED';

  return (
    <article className="mx-auto max-w-3xl">
      <a href="/" className="text-sm text-muted underline">
        ← Về danh sách
      </a>

      {isDead && (
        <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          Tin này đã <strong>{job.status === 'EXPIRED' ? 'hết hạn' : 'bị gỡ'}</strong>
          {job.statusReason && ` (${job.statusReason})`}. Giữ lại để đối chiếu.
        </p>
      )}

      <header className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
        <p className="mt-1 text-muted">{job.company.name}</p>
        <p className="mt-3 text-xl font-medium text-accent">
          {formatSalary(job.salaryMin, job.salaryMax, job.salaryIsPublic)}
        </p>
      </header>

      <dl className="mt-6 grid gap-x-8 gap-y-3 rounded-xl border border-border bg-surface p-4 text-sm sm:grid-cols-2">
        <Row label="Nơi làm việc">
          {job.locations.map((l) => l.location.name).join(' · ') || '—'}
        </Row>
        <Row label="Cấp bậc">{levelLabel(job.level)}</Row>
        <Row label="Hình thức">{employmentLabel(job.employmentType) ?? '—'}</Row>
        <Row label="Cách làm">
          {job.workMode === 'REMOTE'
            ? 'Từ xa'
            : job.workMode === 'HYBRID'
              ? 'Kết hợp'
              : 'Tại văn phòng'}
        </Row>
        <Row label="Kinh nghiệm">
          {job.yearsExpMin !== null
            ? `${job.yearsExpMin}${job.yearsExpMax ? `–${job.yearsExpMax}` : '+'} năm`
            : '—'}
        </Row>
        <Row label="Đăng">{timeAgo(job.postedAt)}</Row>
        <Row label="Hạn nộp">
          {job.expiresAt
            ? `${job.expiresAt.toLocaleDateString('vi-VN')}${
                remaining !== null && remaining >= 0 ? ` (còn ${remaining} ngày)` : ''
              }`
            : 'Nguồn không khai'}
        </Row>
        {/* Nói thật độ tươi. Nguồn không báo cho ta khi họ gỡ tin, nên đây là
            điều trung thực nhất có thể nói. */}
        <Row label="Kiểm lần cuối">
          {timeAgo(job.lastCheckedAt ?? job.lastSeenAt)}
        </Row>
      </dl>

      {job.salaryIsPublic && job.salaryCurrency !== 'VND' && (
        <p className="mt-3 text-xs text-muted">
          Lương gốc ghi bằng {job.salaryCurrency}, quy đổi theo tỷ giá {job.fxRate?.toLocaleString('vi-VN')}
          {job.fxRateDate && ` ngày ${job.fxRateDate.toLocaleDateString('vi-VN')}`}.
        </p>
      )}

      {/* Chỉ trích một đoạn ngắn + link về bản gốc. Số liệu là dữ kiện nên dùng
          thoải mái, còn văn bản mô tả thì có bản quyền — PLAN.md §7. */}
      {job.descriptionText && (
        <section className="mt-6">
          <h2 className="mb-2 font-medium">Trích mô tả</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
            {job.descriptionText.slice(0, 600)}
            {job.descriptionText.length > 600 && '…'}
          </p>
        </section>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white"
        >
          Xem tin gốc trên {job.source.name} →
        </a>
        <span className="text-xs text-muted">
          Ứng tuyển tại nguồn. Bae-Job chỉ gom và lọc tin.
        </span>
      </div>
    </article>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
