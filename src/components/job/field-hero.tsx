import type { FieldPage } from '@/api/field.api';
import { Glyph } from '@/components/ui/glyph';
import { formatCount, millions } from '@/utils/format';

/**
 * Dải hero đỏ — **poster mở đầu** của trang Ngành.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Ba con số, không phải bốn
 *
 * Bản trước xếp bốn ô chỉ số ngang nhau: tin đúng ngành, lương trung vị, đã
 * kiểm trong 48h, lọt qua từ điển. Bốn thứ cùng cỡ chữ, cùng sức nặng — tức là
 * không thứ nào là câu trả lời.
 *
 * Ở đây chỉ ba, và ba con số này trả lời đúng một câu: **"ngành này đang có gì
 * cho tôi, và lương thật là bao nhiêu"**. Hai con số kia không mất đi, chúng
 * chuyển xuống đúng chỗ của mình:
 *
 *   · "đã kiểm trong 48h" -> dòng đầu danh sách tin (nó nói về DANH SÁCH)
 *   · "lọt qua từ điển"   -> bảng "Nói thật về dữ liệu" ở cuối trang
 *                            (nó nói về CÁCH LỌC, là chuyện của người khảo sát)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Chữ trên nền đỏ là `#fff` đặc, KHÔNG phải trắng-mờ. `#fff` trên `#ec3013` đạt
 * 4.6:1 — vừa qua sàn. Hạ xuống `rgba(255,255,255,.85)` là tụt còn 3.6:1 và
 * dòng mô tả 17px không còn đọc được ngoài nắng.
 */
export function FieldHero({
  result,
  alive,
  activeSources,
}: {
  result: FieldPage;
  /** Tổng tin còn hiệu lực của cả kho — mẫu số để hiểu 318 là nhiều hay ít. */
  alive: number;
  activeSources: number;
}) {
  // Dòng kicker là ĐỊNH NGHĨA của ngành đang xem, ghép từ chính dữ liệu của nó:
  // tên ngành · các tỉnh/thành trong phạm vi · trần tuổi tin.
  const scope = [result.name, ...result.provinceNames];
  if (result.maxAgeDays) scope.push(`${result.maxAgeDays} ngày`);

  return (
    <section className="flex flex-wrap items-end gap-8 bg-accent px-4 py-8 text-white sm:px-7 sm:pt-[34px] sm:pb-[30px]">
      <div className="min-w-0">
        <p className="mb-3 flex flex-wrap items-center gap-2 text-xs tracking-[0.12em] text-accent-200 uppercase">
          <Glyph name="funnel" size={14} strokeWidth={1.9} />
          {scope.join(' · ')}
        </p>

        <h1 className="text-[38px] leading-none text-white sm:text-[54px]">Ngành của tôi</h1>

        <p className="mt-3 max-w-[520px] text-[15px] text-white sm:text-[17px]">
          {formatCount(result.total)} tin đúng ngành trong {formatCount(alive)} tin còn hiệu lực từ{' '}
          {activeSources} sàn. Bae-Job chỉ gom và lọc — bạn ứng tuyển trên sàn gốc.
        </p>
      </div>

      {/* Ba ô ngăn nhau bằng vạch trắng mờ, KHÔNG có khoảng cách giữa: đây là
          một cụm số liệu chứ không phải ba thẻ rời. Ô đầu bỏ vạch trái để cụm
          không có một nét thừa treo lơ lửng ở mép. */}
      <dl className="flex flex-wrap gap-y-4 sm:ml-auto">
        <HeroFigure label="Tin đúng ngành" value={formatCount(result.total)} first />
        <HeroFigure
          label="Trung vị"
          value={
            result.stats.salaryMedian === null ? '—' : `${millions(result.stats.salaryMedian)} tr`
          }
          hint={
            result.stats.salaryMedian === null
              ? 'Chưa tin nào trong tập đang xem ghi số lương'
              : 'Trung vị chứ không phải trung bình: vài tin giám đốc 150 triệu sẽ kéo lệch số trung bình.'
          }
        />
        <HeroFigure
          label="Có ghi lương"
          value={formatCount(result.stats.salaryCount)}
          hint={`${result.stats.salaryCount}/${result.total} tin đang xem có ghi số lương thật`}
        />
      </dl>
    </section>
  );
}

function HeroFigure({
  label,
  value,
  hint,
  first = false,
}: {
  label: string;
  value: string;
  hint?: string;
  first?: boolean;
}) {
  return (
    <div
      title={hint}
      className={
        first
          ? 'pr-5 sm:pr-[22px]'
          : 'border-l-2 border-white/40 px-5 last:pr-0 sm:px-[22px] sm:last:pr-0'
      }
    >
      <dt className="mb-1.5 text-[11px] tracking-[0.1em] text-accent-200 uppercase">{label}</dt>
      <dd className="text-[32px] leading-none font-extrabold text-white sm:text-[40px]">{value}</dd>
    </div>
  );
}
