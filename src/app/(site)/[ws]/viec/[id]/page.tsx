import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';

import { fieldJudge, findFieldJobs, getFieldDefinition } from '@/api/field.api';
import { getJob } from '@/api/job.api';
import { getSaveContext } from '@/api/saved.api';
import { experienceYears } from '@/components/job/field-job-card';
import { SaveJobButton } from '@/components/job/save-button';
import { Callout } from '@/components/ui/callout';
import { Glyph, type GlyphName } from '@/components/ui/glyph';
import { Mascot } from '@/components/ui/mascot';
import { isFreshlyChecked } from '@/components/ui/status';
import { Figure } from '@/components/ui/stat';
import { cx } from '@/components/ui/tone';
import { FRESH_CHECK_HOURS } from '@/constants/field';
import { WORKSPACES, isWorkspaceId } from '@/constants/workspace';
import { salaryValue } from '@/lib/field-bands';
import { readParam, type SearchParams } from '@/lib/query';
import { classifyPurchase } from '@/lib/purchase-type';
import { wsHref } from '@/lib/workspace-path';
import { workspaceParam } from '@/lib/workspace-route';
import {
  daysLeft,
  employmentLabel,
  formatCount,
  formatDate,
  formatSalary,
  jobStatusMeta,
  levelLabel,
  timeAgo,
  workModeLabel,
} from '@/utils/format';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ ws: string; id: string }>;
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({ params }: PageProps) {
  const { ws, id } = await params;
  if (!isWorkspaceId(ws)) return { title: 'Không tìm thấy tin' };
  const job = await getJob(ws, Number(id)).catch(() => null);
  return { title: job ? job.title : 'Không tìm thấy tin' };
}

/** Mô tả chỉ trích tới ngần này ký tự — văn bản mô tả có bản quyền (PLAN.md §7). */
const EXCERPT_CHARS = 600;

/**
 * Chi tiết một tin.
 *
 * Trang này KHÔNG cố thay thế bản gốc. Nó làm ba việc mà bản gốc không làm:
 *
 *   1. Nói **vì sao tin này thuộc ngành của bạn** — từ khoá nào khớp, ở đâu.
 *   2. Nói **thật về độ tươi** — lần cuối còn thấy tin, lần cuối gọi vào tận nơi.
 *   3. Đưa **tin tương tự** trong cùng ngành, để không phải quay lại danh sách.
 *
 * Phần mô tả chỉ trích một đoạn ngắn rồi dẫn về bản gốc: số liệu là dữ kiện
 * nên dùng thoải mái, còn văn bản mô tả thì có bản quyền.
 */
export default async function JobDetailPage({ params, searchParams }: PageProps) {
  const [ws, { id }, query] = await Promise.all([workspaceParam(params), params, searchParams]);
  const job = await getJob(ws, Number(id));
  if (!job) notFound();

  const fieldSlug = WORKSPACES[ws].defaultField;
  const [definition, field, save] = await Promise.all([
    getFieldDefinition(ws, fieldSlug),
    findFieldJobs(ws, fieldSlug),
    getSaveContext(ws),
  ]);

  const verdict = definition ? fieldJudge(definition)(job) : null;
  const match = verdict?.match;
  const inField = verdict?.inScope === true && match !== undefined && match.verdict !== 'reject';
  const fromField = readParam(query, 'tu') === 'nganh';

  const status = jobStatusMeta(job.status);
  const dead = job.status === 'EXPIRED' || job.status === 'CLOSED';
  const remaining = daysLeft(job.expiresAt);
  const fresh = isFreshlyChecked(job.lastCheckedAt);
  const hasSalary = salaryValue(job) !== null;
  const province = job.locations.map((entry) => entry.location.name).join(' · ');
  const years = experienceYears(job.yearsExpMin, job.yearsExpMax);

  // Tin tương tự: trong ngành, không phải chính tin này, ưu tiên cùng LOẠI mua
  // hàng — "Mua hàng vật tư công trình" cạnh "Mua hàng dệt may" là hai thị
  // trường khác nhau dù cùng chữ "mua hàng".
  const purchase = classifyPurchase(job);
  const similar = (field?.items ?? [])
    .filter((row) => row.job.id !== job.id)
    .sort(
      (a, b) =>
        Number(b.purchase.slug === purchase.slug) - Number(a.purchase.slug === purchase.slug),
    )
    .slice(0, 3);

  const excerpt = job.descriptionText
    ? job.descriptionText.slice(0, EXCERPT_CHARS).trim() +
      (job.descriptionText.length > EXCERPT_CHARS ? '…' : '')
    : null;

  return (
    <>
      <div className="border-b-2 border-divider px-4 py-3.5 sm:px-6">
        <a href={wsHref(ws, fromField ? '/nganh' : '/viec')} className="btn btn-ghost gap-1.75 text-[13px]">
          <Glyph name="chevronLeft" size={14} />
          {fromField && field ? `Về danh sách ${formatCount(field.total)} tin` : 'Về kho tin'}
        </a>
      </div>

      <section className="brand-field flex flex-wrap items-end gap-6 px-4 py-7.5 sm:px-6">
        <div className="min-w-0 flex-[1_1_420px]">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {inField && match ? (
              <>
                <span className={cx('tag font-extrabold', match.verdict === 'strong' ? 'tag-solid' : 'tag-warn')}>
                  <Glyph name={match.verdict === 'strong' ? 'check' : 'alert'} size={12} strokeWidth={2.2} />
                  {match.verdict === 'strong' ? 'Khớp chắc' : 'Khớp yếu · cần soi tay'}
                </span>
                <span className="text-xs text-accent-800">
                  khớp ở {match.verdict === 'strong' ? 'tiêu đề' : 'mô tả'}:{' '}
                  {(match.titleHits.length ? match.titleHits : match.descHits).map((hit, index) => (
                    <span key={hit}>
                      {index > 0 && ', '}
                      <strong className="font-extrabold">{hit}</strong>
                    </span>
                  ))}
                </span>
              </>
            ) : (
              <span className="tag tag-neutral" title={outsideReason(verdict)}>
                Ngoài ngành của bạn
              </span>
            )}
          </div>
          <h1 className="mb-2.5 text-[28px] leading-[1.08] text-pretty sm:text-[38px]">{job.title}</h1>
          <p className="flex items-center gap-2 text-base text-neutral-800">
            <Glyph name="building" size={16} stroke="var(--color-accent-800)" />
            {job.company.name}
          </p>
        </div>
        <div className="flex-none">
          <Figure
            label={hasSalary ? 'Lương ghi rõ' : 'Lương'}
            value={formatSalary(job.salaryMin, job.salaryMax, job.salaryIsPublic)}
            size={42}
          />
        </div>
      </section>

      {job.status !== 'OPEN' && (
        <Callout
          tone="warn"
          className="px-4 sm:px-6"
          icon={<Glyph name="alert" size={18} strokeWidth={1.9} />}
        >
          <strong className="font-extrabold">{status.label}.</strong> {status.hint}
          {job.statusReason && ` (${job.statusReason})`}. {dead ? 'Tin được giữ lại để đối chiếu.' : ''}
        </Callout>
      )}

      <div className="flex flex-wrap items-start">
        <div className="flex min-w-0 flex-[999_1_460px] flex-col gap-6.5 border-divider px-4 pt-6.5 pb-10 sm:px-6 lg:border-r-2">
          <div className="flex flex-wrap border-2 border-divider [&>*:not(:last-child)]:border-r [&>*:not(:last-child)]:border-divider">
            <Cell icon="pin" label="Khu vực">
              {[job.district, province].filter(Boolean).join(', ') || 'Không ghi'}
            </Cell>
            <Cell icon="briefcase" label="Kinh nghiệm">
              {[job.level ? levelLabel(job.level) : null, years?.replace(' KN', '')]
                .filter(Boolean)
                .join(' · ') || 'Tin không ghi'}
            </Cell>
            <Cell icon="clock" label="Còn lại">
              {remaining === null ? 'Sàn không khai' : remaining < 0 ? 'Đã quá hạn' : `${remaining} ngày`}
            </Cell>
            <Cell icon="sparkle" label="Sàn nguồn">
              {job.source.name}
            </Cell>
          </div>

          {excerpt && (
            <div>
              <h5 className="mb-3">Mô tả — trích từ tin gốc</h5>
              <p className="text-[15px] leading-[1.65] text-pretty whitespace-pre-line text-neutral-800">
                {excerpt}
              </p>
              <Callout
                tone="brand"
                className="mt-4 border-l-0 py-3 text-xs"
                icon={<Glyph name="alert" size={16} stroke="var(--color-accent-700)" />}
              >
                Mình chỉ trích một phần mô tả. Nội dung đầy đủ, phúc lợi và cách ứng tuyển nằm ở tin gốc.
              </Callout>
            </div>
          )}

          {inField && match && (
            <div>
              <h5 className="mb-3">Từ khoá khớp với ngành của bạn</h5>
              <div className="popwrap flex flex-wrap gap-2">
                {match.titleHits.map((hit) => (
                  <span key={`t-${hit}`} className="tag tag-solid px-3 py-1.75" title="Khớp ở tiêu đề">
                    {hit}
                  </span>
                ))}
                {match.descHits
                  .filter((hit) => !match.titleHits.includes(hit))
                  .map((hit) => (
                    <span key={`d-${hit}`} className="tag tag-neutral px-3 py-1.75" title="Chỉ khớp ở mô tả">
                      {hit}
                    </span>
                  ))}
                {match.grayHits.map((hit) => (
                  <span key={`g-${hit}`} className="tag tag-neutral px-3 py-1.75 italic" title="Từ xám — chỉ cộng điểm">
                    {hit}
                  </span>
                ))}
                <a href={wsHref(ws, '/cai-dat')} className="tag tag-outline px-3 py-1.75">
                  + thêm vào từ điển
                </a>
              </div>
            </div>
          )}

          <div>
            <h5 className="mb-3">Vòng đời tin</h5>
            <dl className="flex flex-col border-b border-divider text-sm">
              <Line label="Đăng trên sàn">
                {timeAgo(job.postedAt)} <span className="text-neutral-600">· {formatDate(job.postedAt)}</span>
              </Line>
              <Line label="Hạn nộp sàn ghi">{job.expiresAt ? formatDate(job.expiresAt) : 'Không khai'}</Line>
              {/* Nói thật độ tươi: nguồn không báo cho ta khi họ gỡ tin, nên đây
                  là điều trung thực nhất có thể nói. */}
              <Line label="Còn thấy trong danh mục nguồn">{timeAgo(job.lastSeenAt)}</Line>
              <Line label="Lần cuối gọi vào tận trang">
                {job.lastCheckedAt ? timeAgo(job.lastCheckedAt) : 'chưa gọi lần nào'}
              </Line>
              {(employmentLabel(job.employmentType) || workModeLabel(job.workMode)) && (
                <Line label="Hình thức">
                  {[employmentLabel(job.employmentType), workModeLabel(job.workMode)].filter(Boolean).join(' · ')}
                </Line>
              )}
            </dl>
            {job.salaryIsPublic && job.salaryCurrency !== 'VND' && (
              <p className="mt-2.5 text-xs text-neutral-700">
                Lương gốc ghi bằng {job.salaryCurrency}, quy đổi theo tỷ giá{' '}
                {job.fxRate?.toLocaleString('vi-VN')}
                {job.fxRateDate && ` ngày ${formatDate(job.fxRateDate)}`}. Tỷ giá lưu kèm tin, nên đổi tỷ
                giá sau này không làm sai số đã thu.
              </p>
            )}
          </div>
        </div>

        <aside className="flex w-full flex-col gap-5.5 border-t-2 border-divider px-4 pt-6.5 pb-10 sm:px-6 lg:w-auto lg:max-w-90 lg:flex-[1_1_280px] lg:border-t-0">
          <div className="flex flex-col gap-2.5">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="btn btn-primary btn-block h-12 gap-2"
            >
              Mở tin gốc trên {job.source.name}
              <Glyph name="external" size={16} />
            </a>
            <SaveJobButton jobId={job.id} context={save} variant="block" />
          </div>

          <Callout
            tone={fresh ? 'live' : 'quiet'}
            align="start"
            className="p-4"
            icon={<Mascot pose={fresh ? 'head' : 'scan'} width={46} motion="none" />}
          >
            <p className="mb-1.25 font-heading text-sm font-extrabold">
              {fresh ? `Mình vừa kiểm ${timeAgo(job.lastCheckedAt)}` : 'Tin này mình chưa kiểm lại'}
            </p>
            <p className="text-neutral-800">
              {fresh
                ? `Lúc đó tin vẫn còn tuyển. Ngày hết hạn là do ${job.source.name} ghi — mở tin gốc là chắc nhất.`
                : `${remaining !== null && remaining >= 0 ? `Ngày hết hạn ${remaining} ngày là do ${job.source.name} ghi. ` : ''}Mình chưa mở lại tin trong ${FRESH_CHECK_HOURS}h qua nên không chắc còn tuyển.`}
            </p>
          </Callout>

          {similar.length > 0 && (
            <div>
              <h6 className="mb-3">Tin tương tự trong ngành</h6>
              <div className="flex flex-col border-b border-divider">
                {similar.map(({ job: other }) => (
                  <a
                    key={other.id}
                    href={wsHref(ws, `/viec/${other.id}${fromField ? '?tu=nganh' : ''}`)}
                    className="jrow border-t border-divider px-2 py-3 text-text hover:text-text"
                  >
                    <span className="mb-0.75 block text-sm font-extrabold">{other.title}</span>
                    <span className="block text-xs text-neutral-700">
                      {other.district ?? 'Không ghi quận'} ·{' '}
                      {formatSalary(other.salaryMin, other.salaryMax, other.salaryIsPublic)} ·{' '}
                      {other.source.name}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function outsideReason(verdict: ReturnType<ReturnType<typeof fieldJudge>> | null): string {
  if (!verdict) return 'Chưa định nghĩa ngành nào';
  if (!verdict.inScope) return 'Nằm ngoài tỉnh/thành hoặc tuổi tin của ngành';
  return verdict.match.rejectedBy ? `Từ điển loại: ${verdict.match.rejectedBy}` : 'Không khớp từ nào';
}

function Cell({ icon, label, children }: { icon: GlyphName; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 flex-[1_1_160px] px-4 py-3.5">
      <p className="mb-1.5 flex items-center gap-1.75 text-xs text-neutral-700">
        <Glyph name={icon} size={13} stroke="var(--color-accent)" />
        {label}
      </p>
      <p className="font-heading text-[15px] font-extrabold">{children}</p>
    </div>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-3 border-t border-divider py-2.5">
      <dt className="flex-1 text-neutral-700">{label}</dt>
      <dd className="m-0 text-right">{children}</dd>
    </div>
  );
}
