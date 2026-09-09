import type { FieldMatchedJob } from '@/api/field.api';
import { Badge, Chip } from '@/components/ui/badge';
import { cx } from '@/components/ui/tone';
import {
  daysLeft,
  employmentLabel,
  formatSalary,
  levelLabel,
  timeAgo,
  workModeLabel,
} from '@/utils/format';

/**
 * Thẻ tin của trang "Ngành của tôi".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Vì sao KHÔNG dùng lại `JobCard` như bản trước
 *
 * Bản trước dựng `<JobCard>` rồi treo thêm một dải chữ nhỏ NGOÀI thẻ:
 *
 *     ┌───────────────────────────────┐
 *     │  Nhân viên thu mua      15tr  │   <- viền của JobCard
 *     │  Công ty ABC                  │
 *     └───────────────────────────────┘
 *        Sản xuất · Quận 7 · 2+ năm · khớp: thu mua, mua hàng   <- rơi ra ngoài
 *        “Thứ 2 - Thứ 6, sáng thứ 7”
 *
 * Một tin vì thế bị cắt làm hai khối thị giác, và phần nằm ngoài viền lại
 * chính là phần TRẢ LỜI CÂU HỎI CỦA TRANG NÀY: vì sao tin này được xếp vào
 * ngành, và có đáng tin không. Mắt quét dọc danh sách thì thấy các thẻ đều
 * nhau, còn bằng chứng khớp thì trôi giữa hai thẻ, không rõ thuộc về thẻ trên
 * hay thẻ dưới.
 *
 * Nay tất cả nằm TRONG một viền, chia ba tầng rõ ràng:
 *
 *     1. thân   — chức danh, lương, công ty, nơi làm  (giống mọi trang khác)
 *     2. dải bằng chứng — vì sao tin này thuộc ngành  (nền lõm, chỉ có ở đây)
 *     3. chân   — đăng bao giờ, nguồn nào, còn mấy ngày
 *
 * Dải bằng chứng dùng NỀN LÕM (`bg-inset`) chứ không dùng thêm một đường viền:
 * nó phải tách khỏi phần trên mà không được trông như một thẻ thứ hai.
 *
 * Cố ý KHÔNG sửa `JobCard` dùng chung: trang Kho tin không có khái niệm "khớp
 * từ điển", nhét dải này vào đó là bắt một trang gánh dữ liệu nó không có.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function FieldJobCard({ row }: { row: FieldMatchedJob }) {
  const { job, match, purchase } = row;

  const remaining = daysLeft(job.expiresAt);
  const places = job.locations.map((l) => l.location.name).join(' · ');
  const employment = employmentLabel(job.employmentType);
  const remote = job.workMode === 'REMOTE' || job.workMode === 'HYBRID';
  const weak = match.verdict === 'weak';

  // Từ khoá ở TIÊU ĐỀ là bằng chứng mạnh; chỉ khi không có mới nêu từ trong mô
  // tả. Trộn hai loại vào một danh sách là xoá mất đúng cái khác biệt làm nên
  // "khớp chắc" và "khớp yếu".
  const hits = match.titleHits.length ? match.titleHits : match.descHits;
  const hitsFrom = match.titleHits.length ? 'tiêu đề' : 'mô tả';

  return (
    <article
      className={cx(
        'overflow-hidden rounded-card border bg-surface transition-colors',
        // Tin khớp yếu được viền cảnh báo nhạt: nhìn danh sách là thấy ngay
        // cái nào cần soi tay, không phải đọc nhãn từng thẻ.
        weak ? 'border-warn/40 hover:border-warn' : 'border-border hover:border-border-strong',
      )}
    >
      {/* ── Tầng 1: thân tin ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <h3 className="leading-snug font-medium">
            <a href={`/viec/${job.id}`} className="hover:text-accent-ink hover:underline">
              {job.title}
            </a>
          </h3>
          <p className="mt-1 truncate text-sm text-muted">{job.company.name}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {places && <Chip>{places}</Chip>}
            {job.district && <Chip>{job.district}</Chip>}
            {job.level && <Chip>{levelLabel(job.level)}</Chip>}
            {employment && <Chip>{employment}</Chip>}
            {remote && <Chip>{workModeLabel(job.workMode)}</Chip>}
            {job.yearsExpMin !== null && <Chip>{job.yearsExpMin}+ năm KN</Chip>}
            {job.saturdayWork && <Chip>{SATURDAY_TEXT[job.saturdayWork] ?? job.saturdayWork}</Chip>}
          </div>
        </div>

        {/* "Thoả thuận" cố ý KHÔNG tô màu: tô lên là cho nó cùng trọng lượng
            thị giác với một con số thật, trong khi nó chính là chỗ THIẾU
            thông tin. */}
        <span
          className={cx(
            'tnum shrink-0 rounded-lg px-2.5 py-1 text-sm font-semibold',
            job.salaryIsPublic ? 'bg-accent-soft text-accent-ink' : 'text-muted',
          )}
        >
          {formatSalary(job.salaryMin, job.salaryMax, job.salaryIsPublic)}
        </span>
      </div>

      {/* ── Tầng 2: vì sao tin này thuộc ngành ───────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 bg-inset px-4 py-2 text-xs">
        <Badge
          tone="accent"
          dot={false}
          hint={
            purchase.basis === 'industry'
              ? `Theo ngành nguồn tự khai: ${purchase.evidence}`
              : purchase.basis === 'keyword'
                ? 'Đoán từ tiêu đề/mô tả — kém chắc hơn ngành do nguồn khai'
                : purchase.hint
          }
        >
          {purchase.label}
          {purchase.basis === 'keyword' && ' ?'}
        </Badge>

        {weak && (
          <Badge tone="warn" hint="Từ khoá chỉ có trong mô tả, không có ở tiêu đề — nên soi tay trước khi nộp">
            cần soi tay
          </Badge>
        )}

        {hits.length > 0 && (
          <span className="min-w-0 text-muted">
            <span className="text-faint">khớp ở {hitsFrom}:</span>{' '}
            {hits.slice(0, 3).map((hit, i) => (
              <span key={hit}>
                {i > 0 && ', '}
                <strong className="font-medium text-text">{hit}</strong>
              </span>
            ))}
            {hits.length > 3 && <span className="text-faint"> +{hits.length - 3}</span>}
          </span>
        )}
      </div>

      {/* Câu nguyên văn về lịch làm việc. Để trong thẻ, dưới dải bằng chứng,
          vì nó cũng là bằng chứng — chỉ khác là trích thẳng lời nhà tuyển dụng
          thay vì kết luận của máy. */}
      {job.scheduleRaw && (
        <p className="border-t border-border px-4 py-2 text-xs text-faint italic">
          “{job.scheduleRaw}”
        </p>
      )}

      {/* ── Tầng 3: chân thẻ ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border px-4 py-2.5 text-xs text-muted">
        <span>Đăng {timeAgo(job.postedAt)}</span>
        <Dot />
        <span>{job.source.name}</span>

        {remaining !== null && remaining >= 0 && (
          <>
            <Dot />
            <span className={remaining <= 3 ? 'font-medium text-warn-ink' : undefined}>
              {remaining === 0 ? 'hết hạn hôm nay' : `còn ${remaining} ngày`}
            </span>
          </>
        )}

        {/* Nói thật thay vì giấu: nguồn không báo cho ta khi họ gỡ tin, nên
            một tin chưa bao giờ được gọi vào tận nơi thì phải ghi ra. */}
        {job.lastCheckedAt === null && (
          <>
            <Dot />
            <span title="Chưa lần nào gọi HTTP/API vào tận trang tin để xác nhận còn tuyển">
              chưa kiểm còn-sống
            </span>
          </>
        )}
      </div>
    </article>
  );
}

function Dot() {
  return (
    <span aria-hidden className="opacity-40">
      ·
    </span>
  );
}

const SATURDAY_TEXT: Record<string, string> = {
  NONE: 'Nghỉ thứ 7',
  HALF_DAY: 'Sáng thứ 7',
  ALTERNATE: 'Thứ 7 luân phiên',
  FULL: 'Làm cả thứ 7',
};
