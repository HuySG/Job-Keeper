import type { ReactNode } from 'react';

import type { FieldMatchedJob } from '@/api/field.api';
import type { SaveContext } from '@/api/saved.api';
import { Glyph, type GlyphName } from '@/components/ui/glyph';
import { CheckedLabel } from '@/components/ui/status';
import { cx } from '@/components/ui/tone';
import type { WorkspaceId } from '@/constants/workspace';
import { salaryValue } from '@/lib/field-bands';
import { wsHref } from '@/lib/workspace-path';
import { daysLeft, employmentLabel, formatSalary, levelLabel, millions, timeAgo } from '@/utils/format';

import { SaveJobButton } from './save-button';

/**
 * Một tin của trang Ngành = một THẺ nổi, hai cột: nội dung · lương & hành động.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Bản v2 quay lại thẻ (bản 1b dùng dòng)
 *
 * Bản 1b dựng dòng để quét ba trăm tin cho nhanh. Bản v2 chọn thẻ, và có lý do
 * đứng được: trang Ngành nay chỉ còn tin ĐÃ LỌC CHẮC, hai mươi tin một lượt —
 * việc là đọc từng tin, không phải quét. Việc quét dài đã có bảng ở Kho tin.
 *
 * Cột lương vẫn cố định 216px nên mọi con số lương vẫn thẳng một đường dọc.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Vạch trái 6px mang nghĩa, không phải trang trí:
 *   · accent — khớp chắc: từ khoá nằm ở TIÊU ĐỀ
 *   · warn   — khớp yếu: từ khoá chỉ có trong mô tả, nên soi tay trước khi nộp
 *
 * Bản thiết kế chỉ vẽ vạch xanh vì mọi tin mẫu đều khớp chắc. Dữ liệu thật có
 * cả hai hạng, và "khớp yếu" là thứ người dùng phải thấy trước khi bỏ công mở
 * tin. Màu là kênh phụ — nhãn "Cần soi tay" mới là kênh chính.
 */
export function FieldJobCard({
  ws,
  row,
  fieldMedian,
  save,
  anchor,
  delay = 0,
}: {
  ws: WorkspaceId;
  row: FieldMatchedJob;
  /** Trung vị lương của tập đang xem — để tin "Thoả thuận" có một mốc so. */
  fieldMedian: number | null;
  save: SaveContext;
  /** `id` cho liên kết "Xem thêm" nhảy thẳng tới tin mới hiện ra. */
  anchor?: string;
  delay?: number;
}) {
  const { job, match, purchase } = row;
  const weak = match.verdict === 'weak';

  // Từ khoá ở TIÊU ĐỀ là bằng chứng mạnh; chỉ khi không có mới nêu từ trong mô
  // tả. Trộn hai loại vào một danh sách là xoá mất đúng cái khác biệt làm nên
  // "khớp chắc" và "khớp yếu".
  const hits = match.titleHits.length ? match.titleHits : match.descHits;
  const remaining = daysLeft(job.expiresAt);
  const hasSalary = salaryValue(job) !== null;

  const province = job.locations.map((entry) => entry.location.name).join(' · ');
  const years = experienceYears(job.yearsExpMin, job.yearsExpMax);
  const experience = [job.level ? levelLabel(job.level) : null, years].filter(Boolean).join(' · ');
  const employment = employmentLabel(job.employmentType);

  return (
    <article
      id={anchor}
      className={cx(
        'jcard rise @container scroll-mt-24 border-l-[6px] bg-neutral-100 shadow-sm',
        weak ? 'border-warn' : 'border-accent',
      )}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      <div className="flex flex-col @min-[600px]:flex-row">
        {/* ── Tin này là gì ──────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 px-5.5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            {weak ? (
              <span
                className="tag tag-warn font-extrabold"
                title="Từ khoá chỉ có trong mô tả, không có ở tiêu đề — nên soi tay trước khi nộp"
              >
                <Glyph name="alert" size={12} strokeWidth={2.2} />
                Cần soi tay
              </span>
            ) : (
              <span className="tag tag-accent font-extrabold">
                <Glyph name="check" size={12} strokeWidth={2.2} />
                Khớp chắc
              </span>
            )}
            {hits.length > 0 && (
              <span className="min-w-0 text-xs text-neutral-700">
                khớp ở {weak ? 'mô tả' : 'tiêu đề'}:{' '}
                {hits.slice(0, 3).map((hit, index) => (
                  <span key={hit}>
                    {index > 0 && ', '}
                    <strong className="font-extrabold text-text">{hit}</strong>
                  </span>
                ))}
                {hits.length > 3 && ` +${hits.length - 3}`}
              </span>
            )}
          </div>

          <h4 className="text-[20px] leading-[1.18] text-pretty sm:text-[22px]">
            <a href={wsHref(ws, `/viec/${job.id}?tu=nganh`)} className="text-text hover:text-accent-700">
              {job.title}
            </a>
          </h4>

          <p className="flex items-center gap-2 text-[15px] text-neutral-800">
            <Glyph name="building" size={15} stroke="var(--color-neutral-600)" />
            <span className="min-w-0 truncate">{job.company.name}</span>
          </p>

          {/* Dải bằng chứng. Icon ACCENT = tin CÓ khai thông tin này; icon XÁM
              = tin KHÔNG khai, và chữ bên cạnh nói thẳng điều đó. Đây là cách
              bản thiết kế dẫn mắt tới chỗ dữ liệu thiếu mà không cần thêm nhãn. */}
          <div className="flex flex-wrap gap-x-4.5 gap-y-2 text-sm text-neutral-800">
            <Fact icon="pin" known={Boolean(job.district)}>
              {job.district ? [job.district, province].filter(Boolean).join(', ') : `${province || 'Không rõ nơi'} · tin không ghi quận`}
            </Fact>
            <Fact icon="briefcase" known={Boolean(experience)}>
              {experience || 'tin không ghi kinh nghiệm'}
            </Fact>
            {employment && (
              <Fact icon="clock" known>
                {employment}
              </Fact>
            )}
            {purchase.basis !== 'none' && (
              <Fact
                icon="trend"
                known
                title={purchase.basis === 'keyword' ? 'Đoán từ chữ trong tin — sàn không khai ngành' : purchase.hint}
              >
                {purchase.label}
                {purchase.basis === 'keyword' && ' ?'}
              </Fact>
            )}
            {job.saturdayWork && (
              // `scheduleRaw` là câu nguyên văn nhà tuyển dụng viết — để trong
              // `title` để kiểm chứng kết luận của parser khi cần.
              <Fact icon="calendar" known title={job.scheduleRaw ?? undefined}>
                {SATURDAY_TEXT[job.saturdayWork] ?? job.saturdayWork}
              </Fact>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-divider pt-3 text-xs text-neutral-700">
            <span className="font-extrabold text-text">{job.source.name}</span>
            <span>Đăng {timeAgo(job.postedAt)}</span>
            {remaining !== null && remaining >= 0 && (
              <span className={cx('font-extrabold', remaining <= 3 ? 'text-warn-ink' : 'text-accent-700')}>
                {remaining === 0 ? 'Hết hạn hôm nay' : `Còn ${remaining} ngày`}
              </span>
            )}
            <CheckedLabel lastCheckedAt={job.lastCheckedAt} />
          </div>
        </div>

        {/* ── Lương & đi đâu tiếp ────────────────────────────────────────── */}
        <div className="flex flex-col justify-between gap-4 border-t border-divider px-5.5 py-5 @min-[600px]:w-54 @min-[600px]:flex-none @min-[600px]:border-t-0 @min-[600px]:border-l">
          {/* "Thoả thuận" cố ý NHỎ HƠN và XÁM: nó không phải một con số, nó là
              chỗ THIẾU một con số. Cho nó cùng cỡ chữ xanh như "13–17 tr" là
              dựng một mức lương giả trong đầu người đọc. */}
          <div>
            <p className="mb-1.25 text-[11px] tracking-widest text-neutral-600 uppercase">
              {hasSalary ? 'Lương ghi rõ' : 'Lương'}
            </p>
            {hasSalary ? (
              <p className="font-heading text-[29px] leading-none font-extrabold text-accent-700">
                {formatSalary(job.salaryMin, job.salaryMax, job.salaryIsPublic)}
              </p>
            ) : (
              <>
                <p className="font-heading text-[22px] leading-[1.1] font-extrabold text-neutral-700">
                  Thoả thuận
                </p>
                {fieldMedian !== null && (
                  <p className="mt-1.25 text-xs text-neutral-600">
                    ngành này trung vị {millions(fieldMedian)} tr
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col items-start gap-1">
            {/* Ra ngoài sàn nguồn là hành động CHÍNH — Bae-Job không nhận hồ sơ. */}
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="btn btn-primary btn-block h-10.5 gap-2"
            >
              Xem tin gốc
              <Glyph name="external" size={14} strokeWidth={1.9} />
            </a>
            <SaveJobButton jobId={job.id} context={save} variant="ghost" />
          </div>
        </div>
      </div>
    </article>
  );
}

/** "2+ năm KN", "1–2 năm KN" — `null` khi tin không nói. */
export function experienceYears(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null && max !== min) return `${min}–${max} năm KN`;
  if (min !== null) return `${min}+ năm KN`;
  return `tới ${max} năm KN`;
}

/**
 * Một mẩu thông tin kèm icon, có phân biệt CÓ và KHÔNG CÓ dữ liệu.
 * `known={false}` đổi icon sang xám; chữ vẫn phải tự nói ("tin không ghi quận").
 */
function Fact({
  icon,
  known,
  title,
  children,
}: {
  icon: GlyphName;
  known: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span title={title} className={cx('inline-flex items-center gap-1.75', !known && 'text-neutral-700')}>
      <Glyph name={icon} size={15} stroke={known ? 'var(--color-accent)' : 'var(--color-neutral-600)'} />
      {children}
    </span>
  );
}

export const SATURDAY_TEXT: Record<string, string> = {
  NONE: 'Nghỉ thứ 7',
  HALF_DAY: 'Sáng thứ 7',
  ALTERNATE: 'Thứ 7 luân phiên',
  FULL: 'Làm cả thứ 7',
};
