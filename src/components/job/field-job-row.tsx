import type { FieldMatchedJob } from '@/api/field.api';
import { Glyph } from '@/components/ui/glyph';
import { cx } from '@/components/ui/tone';
import { daysLeft, formatSalary, levelLabel, timeAgo } from '@/utils/format';

/**
 * Một tin = một DÒNG, ba cột: nội dung · lương & vòng đời · hành động.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Vì sao dòng chứ không phải thẻ (phương án 1b)
 *
 * Thẻ có viền cho mỗi tin một cái hộp riêng — đẹp khi đọc từng tin một, nhưng
 * việc thật của trang này là QUÉT: chạy mắt dọc ba trăm tin để lọc ra mươi tin
 * đáng mở. Muốn quét được thì các con số phải THẲNG HÀNG DỌC, và viền của thẻ
 * chính là thứ phá vỡ hàng — mỗi thẻ đẩy nội dung vào trong một khoảng đệm
 * riêng, nên cột lương của tin này lệch cột lương của tin kia vài pixel.
 *
 * Lưới `1fr 196px 150px` khoá hai cột phải lại. Mọi con số lương nằm đúng một
 * đường dọc, nên so "13–17 tr" với "Thoả thuận" ở tin dưới là việc của mắt,
 * không phải việc của trí nhớ.
 * ─────────────────────────────────────────────────────────────────────────────
 * Ô VUÔNG ĐỎ đầu tiêu đề mang nghĩa, không phải trang trí
 *
 *   ■ đỏ   — khớp chắc: từ khoá nằm ở TIÊU ĐỀ
 *   ■ vàng — khớp yếu: từ khoá chỉ có trong mô tả, nên soi tay trước khi nộp
 *
 * Bản thiết kế chỉ vẽ ô đỏ vì mọi tin trong bản mẫu đều khớp chắc. Nhưng dữ
 * liệu thật có cả hai hạng, và "khớp yếu" là thông tin người dùng phải thấy
 * trước khi bỏ công mở tin. Màu là kênh phụ — chữ "cần soi tay" ở dải bằng
 * chứng mới là kênh chính.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function FieldJobRow({ row }: { row: FieldMatchedJob }) {
  const { job, match, purchase } = row;

  const remaining = daysLeft(job.expiresAt);
  const weak = match.verdict === 'weak';

  // Từ khoá ở TIÊU ĐỀ là bằng chứng mạnh; chỉ khi không có mới nêu từ trong mô
  // tả. Trộn hai loại vào một danh sách là xoá mất đúng cái khác biệt làm nên
  // "khớp chắc" và "khớp yếu".
  const hits = match.titleHits.length ? match.titleHits : match.descHits;

  const district = job.district ?? job.locations.map((l) => l.location.name).join(' · ');

  // Số năm kinh nghiệm nói rõ hơn cấp bậc, nên ưu tiên. Không có thì mới lùi về
  // cấp bậc, và không có nốt thì NÓI THẲNG là tin không ghi — chứ không im lặng
  // bỏ trống, vì im lặng đọc thành "không đòi kinh nghiệm".
  const experience =
    job.yearsExpMin !== null
      ? `${job.yearsExpMin}+ năm KN`
      : job.level
        ? levelLabel(job.level)
        : 'tin không ghi KN';

  return (
    <article className="grid items-start gap-x-5 gap-y-4 border-b border-divider px-4 py-6 transition-colors hover:bg-accent-100 sm:px-7 lg:grid-cols-[1fr_196px_150px]">
      {/* ── Cột 1: tin này là gì ──────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-col gap-2.5">
        <h3 className="text-[19px] leading-[1.2] sm:text-[21px]">
          <span
            aria-hidden
            className={cx('mr-1.5', weak ? 'text-warn' : 'text-accent')}
            title={weak ? 'Khớp yếu — nên soi tay' : 'Khớp chắc'}
          >
            ■
          </span>
          <a href={`/viec/${job.id}`} className="text-text hover:text-accent-700 hover:underline">
            {job.title}
          </a>
        </h3>

        <p className="flex items-center gap-2 text-sm text-neutral-800">
          <Glyph name="building" size={14} stroke="var(--color-neutral-600)" />
          <span className="min-w-0 truncate">{job.company.name}</span>
        </p>

        {/* Dải bằng chứng. Icon ĐỎ = tin CÓ khai thông tin này; icon XÁM = tin
            KHÔNG khai, và chữ bên cạnh nói thẳng điều đó. Đây là cách bản thiết
            kế dẫn mắt tới chỗ dữ liệu bị thiếu mà không cần thêm một nhãn nào. */}
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[13px] text-neutral-800">
          <Fact icon="pin" known={Boolean(district)}>
            {district || 'tin không ghi quận'}
          </Fact>

          <Fact icon="briefcase" known={job.yearsExpMin !== null || Boolean(job.level)}>
            {experience}
          </Fact>

          <Fact icon="trend" known={purchase.basis !== 'none'}>
            {purchase.label}
            {purchase.basis === 'keyword' && ' ?'}
          </Fact>

          {job.saturdayWork && (
            // `scheduleRaw` là câu nguyên văn nhà tuyển dụng viết. Để trong
            // `title` chứ không in ra: nó dài, và nó là thứ để KIỂM CHỨNG kết
            // luận của parser chứ không phải thứ đọc mỗi lần quét danh sách.
            <Fact icon="calendar" known title={job.scheduleRaw ?? undefined}>
              {SATURDAY_TEXT[job.saturdayWork] ?? job.saturdayWork}
            </Fact>
          )}

          {weak && (
            <span
              className="inline-flex items-center gap-1.5 bg-warn-soft px-2 py-0.5 text-[12px] font-extrabold text-warn-ink"
              title="Từ khoá chỉ có trong mô tả, không có ở tiêu đề — nên soi tay trước khi nộp"
            >
              <Glyph name="alert" size={13} />
              cần soi tay
            </span>
          )}

          {hits.length > 0 && (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-accent-700">
              <Glyph name="check" size={14} strokeWidth={2} />
              <span className="min-w-0 truncate">
                khớp:{' '}
                {hits.slice(0, 3).map((hit, i) => (
                  <span key={hit}>
                    {i > 0 && ', '}
                    <strong className="font-extrabold">{hit}</strong>
                  </span>
                ))}
                {hits.length > 3 && ` +${hits.length - 3}`}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* ── Cột 2: lương + vòng đời ───────────────────────────────────────── */}
      <div className="min-w-0">
        {/* "Thoả thuận" cố ý NHỎ HƠN và XÁM: nó không phải một con số, nó là
            chỗ THIẾU một con số. Cho nó cùng cỡ chữ đỏ như "13–17 tr" là dựng
            một mức lương giả trong đầu người đọc. */}
        <p
          className={cx(
            'leading-none font-extrabold',
            job.salaryIsPublic ? 'text-[26px] text-accent-700' : 'text-[20px] text-neutral-700',
          )}
        >
          {formatSalary(job.salaryMin, job.salaryMax, job.salaryIsPublic)}
        </p>

        <div className="mt-2 flex flex-col gap-1 text-xs text-neutral-700">
          <span className="font-extrabold text-text">
            {job.source.name} · {timeAgo(job.postedAt)}
          </span>

          {remaining !== null && remaining >= 0 && (
            <span className={remaining <= 3 ? 'font-extrabold text-warn-ink' : undefined}>
              {remaining === 0 ? 'Hết hạn hôm nay' : `Còn ${remaining} ngày`}
            </span>
          )}

          {/* Nói thật thay vì giấu: nguồn không báo cho ta khi họ gỡ tin, nên
              một tin chưa bao giờ được gọi vào tận nơi thì phải ghi ra. */}
          {job.lastCheckedAt === null ? (
            <span
              className="inline-flex items-center gap-1.5"
              title="Chưa lần nào gọi HTTP/API vào tận trang tin để xác nhận còn tuyển"
            >
              <Glyph name="alert" size={12} stroke="var(--color-neutral-600)" />
              chưa kiểm còn-sống
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 text-good-ink"
              title={`Đã gọi vào tận trang tin lúc ${timeAgo(job.lastCheckedAt)}`}
            >
              <Glyph name="shield" size={12} />
              kiểm {timeAgo(job.lastCheckedAt)}
            </span>
          )}
        </div>
      </div>

      {/* ── Cột 3: đi đâu tiếp ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        {/* Ra ngoài sàn nguồn là hành động CHÍNH của cả trang — Bae-Job không
            nhận hồ sơ. `rel="noopener"` bắt buộc với `target="_blank"`. */}
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-start gap-2 bg-accent px-3 py-2 text-sm font-extrabold text-canvas transition-colors hover:bg-accent-600 active:bg-accent-700"
        >
          Xem tin gốc
          <Glyph name="external" size={14} strokeWidth={1.9} />
        </a>
        <span className="inline-flex items-center gap-1.5 text-xs text-neutral-700">
          <Glyph name="external" size={13} />
          mở bản gốc trên {job.source.name}
        </span>
      </div>
    </article>
  );
}

/**
 * Một mẩu thông tin kèm icon, có phân biệt CÓ và KHÔNG CÓ dữ liệu.
 *
 * `known={false}` đổi icon sang xám. Chữ vẫn phải tự nói ("tin không ghi
 * quận") — màu icon chỉ là kênh phụ, không bao giờ là kênh duy nhất.
 */
function Fact({
  icon,
  known,
  title,
  children,
}: {
  icon: 'pin' | 'briefcase' | 'trend' | 'calendar';
  known: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cx('inline-flex items-center gap-1.5', !known && 'text-neutral-700')}
    >
      <Glyph
        name={icon}
        size={14}
        stroke={known ? 'var(--color-accent)' : 'var(--color-neutral-600)'}
      />
      {children}
    </span>
  );
}

const SATURDAY_TEXT: Record<string, string> = {
  NONE: 'Nghỉ thứ 7',
  HALF_DAY: 'Sáng thứ 7',
  ALTERNATE: 'Thứ 7 luân phiên',
  FULL: 'Làm cả thứ 7',
};
