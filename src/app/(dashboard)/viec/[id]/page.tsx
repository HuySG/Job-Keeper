import { notFound } from 'next/navigation';

import { getJob } from '@/api/job.api';
import { Badge, Chip } from '@/components/ui/badge';
import { Card, CardBody, CardHead } from '@/components/ui/card';
import { cx } from '@/components/ui/tone';
import {
  daysLeft,
  employmentLabel,
  formatDate,
  formatSalary,
  jobStatusMeta,
  levelLabel,
  timeAgo,
  workModeLabel,
} from '@/utils/format';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const job = await getJob(Number(id));
  return { title: job ? job.title : 'Không tìm thấy tin' };
}

/**
 * Chi tiết một tin.
 *
 * Trang này KHÔNG cố thay thế bản gốc. Nó chỉ làm hai việc mà bản gốc không
 * làm: bày các trường đã chuẩn hoá ra thành bảng đối chiếu được, và **nói thật
 * về độ tươi** — lần cuối còn thấy tin, lần cuối thực sự gọi vào trang đó.
 *
 * Phần mô tả chỉ trích một đoạn ngắn rồi dẫn về bản gốc: số liệu là dữ kiện
 * nên dùng thoải mái, còn văn bản mô tả thì có bản quyền (PLAN.md §7).
 */
export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const job = await getJob(Number(id));
  if (!job) notFound();

  const remaining = daysLeft(job.expiresAt);
  const status = jobStatusMeta(job.status);
  const dead = job.status === 'EXPIRED' || job.status === 'CLOSED';

  return (
    <article className="mx-auto max-w-3xl">
      <a href="/viec" className="text-sm text-muted hover:text-text">
        ← Về kho tin
      </a>

      {job.status !== 'OPEN' && (
        <p
          className={cx(
            'mt-4 rounded-card border px-4 py-3 text-sm',
            dead ? 'border-serious bg-serious-soft' : 'border-warn bg-warn-soft',
          )}
        >
          <strong>{status.label}.</strong> {status.hint}
          {job.statusReason && ' (' + job.statusReason + ')'}. Tin được giữ lại để đối chiếu.
        </p>
      )}

      <header className="mt-5">
        <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
        <p className="mt-1 text-muted">{job.company.name}</p>
        <p
          className={cx(
            'tnum mt-3 text-2xl font-semibold',
            job.salaryIsPublic ? 'text-accent-ink' : 'text-muted',
          )}
        >
          {formatSalary(job.salaryMin, job.salaryMax, job.salaryIsPublic)}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.locations.map((entry) => (
            <Chip key={entry.locationId}>{entry.location.name}</Chip>
          ))}
          {job.level && <Chip>{levelLabel(job.level)}</Chip>}
          {employmentLabel(job.employmentType) && (
            <Chip>{employmentLabel(job.employmentType)}</Chip>
          )}
          {workModeLabel(job.workMode) && <Chip>{workModeLabel(job.workMode)}</Chip>}
        </div>
      </header>

      <Card className="mt-6">
        <CardHead
          title="Các trường đã chuẩn hoá"
          subtitle="Đọc từ khối dữ liệu có cấu trúc của sàn nguồn rồi quy về một chuẩn chung."
        />
        <CardBody>
          <dl className="grid gap-x-8 gap-y-3.5 text-sm sm:grid-cols-2">
            <Row label="Kinh nghiệm">
              {job.yearsExpMin !== null
                ? job.yearsExpMin + (job.yearsExpMax ? '–' + job.yearsExpMax : '+') + ' năm'
                : '—'}
            </Row>
            <Row label="Đăng">
              {timeAgo(job.postedAt)}
              <span className="ml-1.5 text-xs text-faint">({formatDate(job.postedAt)})</span>
            </Row>
            <Row label="Hạn nộp">
              {job.expiresAt ? (
                <>
                  {formatDate(job.expiresAt)}
                  {remaining !== null && remaining >= 0 && (
                    <span
                      className={cx(
                        'ml-1.5 text-xs',
                        remaining <= 3 ? 'font-medium text-warn-ink' : 'text-faint',
                      )}
                    >
                      (còn {remaining} ngày)
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted">Nguồn không khai</span>
              )}
            </Row>
            <Row label="Trạng thái">
              <Badge tone={status.tone} hint={status.hint}>
                {status.label}
              </Badge>
            </Row>
            {/* Nói thật độ tươi. Nguồn không báo cho ta khi họ gỡ tin, nên đây
                là điều trung thực nhất có thể nói. */}
            <Row label="Còn thấy trong danh mục nguồn">{timeAgo(job.lastSeenAt)}</Row>
            <Row label="Lần cuối gọi thẳng vào trang">
              {job.lastCheckedAt ? (
                timeAgo(job.lastCheckedAt)
              ) : (
                <span className="text-muted">chưa gọi lại lần nào</span>
              )}
            </Row>
          </dl>

          {job.salaryIsPublic && job.salaryCurrency !== 'VND' && (
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
              Lương gốc ghi bằng {job.salaryCurrency}, quy đổi theo tỷ giá{' '}
              {job.fxRate?.toLocaleString('vi-VN')}
              {job.fxRateDate && ' ngày ' + formatDate(job.fxRateDate)}. Tỷ giá được lưu kèm tin,
              nên đổi tỷ giá sau này không làm sai lệch dữ liệu đã thu.
            </p>
          )}
        </CardBody>
      </Card>

      {job.descriptionText && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold">Trích mô tả</h2>
          <p className="text-sm leading-relaxed whitespace-pre-line text-muted">
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
          className="rounded-lg bg-accent px-5 py-2.5 font-medium text-white hover:opacity-90"
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
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
