import { findFieldJobs } from '@/api/field.api';
import { BarRow } from '@/components/ui/bar-row';
import { Callout } from '@/components/ui/callout';
import { Cmd, Empty } from '@/components/ui/empty';
import { Mascot } from '@/components/ui/mascot';
import { Figure, Kicker } from '@/components/ui/stat';
import { cx } from '@/components/ui/tone';
import { DEFAULT_FIELD_SLUG } from '@/constants/field';
import { FACET_NONE } from '@/lib/field-bands';
import { buildUrl } from '@/lib/query';
import { formatCount, formatPercent, millions } from '@/utils/format';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Lương' };

/**
 * Lương — trả lời **"ngành tôi trả bao nhiêu, và bao nhiêu tin dám ghi số"**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Bản v2 thu trang này về NGÀNH CỦA BẠN, bỏ số toàn kho
 *
 * Bản trước tính trên cả kho: trung vị của mọi nghề, mọi tỉnh trộn lẫn. Con số
 * đó đúng mà vô dụng — người làm thu mua ở TP.HCM không thương lượng lương dựa
 * trên trung vị của cả lập trình viên Hà Nội. Nay mọi con số ở đây đi qua cùng
 * bộ chấm với trang Ngành, nên "104 tin ghi số" ở đây và "104/318" ở hero
 * trang Ngành là MỘT con số, không phải hai con số tình cờ bằng nhau.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Câu thứ hai của trang — bao nhiêu tin dám ghi số — vẫn là thứ đáng giá nhất.
 * Không sàn nào công bố tỷ lệ tin "Thoả thuận", vì nó bất lợi cho khách hàng
 * của họ là nhà tuyển dụng. Mình gom nhiều sàn nên đo được.
 *
 * Mọi con số đi kèm cỡ mẫu. Một trung vị không có n bên cạnh là con số không
 * kiểm chứng được — và với vài chục tin thì nó lệch rất xa.
 */
export default async function SalaryPage() {
  const field = await findFieldJobs(DEFAULT_FIELD_SLUG);

  if (!field) {
    return (
      <Empty title="Chưa có ngành nào để tính lương">
        Trang này tính lương trên đúng ngành của bạn. Chạy <Cmd>npm run db:seed</Cmd> để nạp ngành
        mẫu, hoặc định nghĩa ngành ở trang Cài đặt.
      </Empty>
    );
  }

  const { stats, total } = field;
  const negotiable = total - stats.salaryCount;
  const scope = [field.name, ...field.provinceNames];
  if (field.maxAgeDays) scope.push(`${field.maxAgeDays} ngày`);

  const bands = field.facets.salary.filter((facet) => facet.value !== FACET_NONE);
  const top = bands.reduce((best, band) => (band.count > best.count ? band : best), bands[0]!);
  const ceil = Math.max(1, ...bands.map((band) => band.count));
  const topShare = stats.salaryCount === 0 ? 0 : top.count / stats.salaryCount;

  // Chỉ số "mẫu nhỏ" của lời dặn cuối trang đếm trên mức CÓ tin ghi số — mức
  // rỗng không có trung vị nào để bị lệch.
  const levels = stats.salaryByExperience;
  const samples = levels.map((level) => level.sample).filter((n) => n > 0);

  return (
    <>
      <section className="brand-field px-4 py-9 text-text sm:px-6">
        <div className="flex flex-wrap items-end gap-7">
          <div className="min-w-0 flex-[1_1_380px]">
            <Kicker>{scope.join(' · ')}</Kicker>
            <h1 className="mb-2.5 text-[34px] leading-[1.03] text-pretty sm:text-[46px]">
              Lương thật, chỉ tính trên tin dám ghi số
            </h1>
            <p className="max-w-135 text-base leading-normal text-pretty text-neutral-800">
              {formatCount(stats.salaryCount)} trong {formatCount(total)} tin có ghi lương.{' '}
              {formatCount(negotiable)} tin còn lại ghi “thoả thuận” — mình không đoán hộ.
            </p>
          </div>
          <div className="flex flex-wrap gap-y-4">
            <Figure
              divided
              label="Trung vị"
              value={stats.salaryMedian === null ? '—' : `${millions(stats.salaryMedian)} tr`}
              hint="Trung vị chứ không phải trung bình: vài tin giám đốc 150 triệu sẽ kéo lệch số trung bình."
            />
            <Figure divided label="Có ghi số" value={formatCount(stats.salaryCount)} />
            <Figure
              divided
              label="Thoả thuận"
              value={formatCount(negotiable)}
              hint={`${formatPercent(negotiable, total)} số tin trong ngành không cho biết mức lương`}
            />
          </div>
        </div>
      </section>

      {total === 0 ? (
        <Empty title="Ngành chưa có tin nào">
          Khi từ điển ngành nhận được tin, phân bố lương sẽ hiện ở đây.
        </Empty>
      ) : (
        <section className="flex flex-wrap items-start">
          <div className="min-w-0 flex-[1_1_420px] border-divider px-4 pt-7 pb-9 sm:px-6 md:border-r-2">
            <h5 className="mb-4.5">Phân bố lương · {formatCount(stats.salaryCount)} tin</h5>
            {/* Đọc được thì bấm được: dòng nói "15–25 tr nhiều tin nhất" cũng
                chính là chỗ lọc lấy đúng nhóm đó ở trang Ngành. */}
            <div className="flex flex-col gap-3.5 text-sm">
              {bands.map((band, index) => {
                const isTop = band === top && band.count > 0;
                return (
                  <a
                    key={band.value}
                    href={buildUrl('/nganh', {}, { luong: [band.value] })}
                    title={`Lọc danh sách ngành theo mức ${band.label}`}
                    className="fopt -mx-2 px-2 py-0.5 text-text hover:text-text"
                  >
                    <BarRow
                      label={band.short ?? band.label}
                      count={formatCount(band.count)}
                      ratio={band.count / ceil}
                      fill={isTop ? 'accent' : 'soft'}
                      strong={isTop}
                      height={26}
                      labelWidth={96}
                      countWidth={30}
                      delay={index * 0.07}
                      className="gap-3.5 [&_.bar-count]:font-extrabold"
                    />
                  </a>
                );
              })}
            </div>
            <p className="mt-4.5 text-[13px] text-pretty text-neutral-700">
              {stats.salaryCount === 0
                ? 'Chưa tin nào trong ngành ghi số lương.'
                : topShare >= 0.5
                  ? `Hơn nửa số tin có ghi lương nằm trong khoảng ${top.label.toLowerCase()} (${formatPercent(top.count, stats.salaryCount)}).`
                  : `Nhiều tin nhất nằm trong khoảng ${top.label.toLowerCase()} — ${formatPercent(top.count, stats.salaryCount)} số tin có ghi lương.`}{' '}
              Bấm một dòng để lọc danh sách theo khoảng đó.
            </p>
          </div>

          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-7 border-t-2 border-divider px-4 pt-7 pb-9 sm:px-6 md:border-t-0">
            <div>
              <h5 className="mb-4">Trung vị theo kinh nghiệm</h5>
              <div className="flex flex-col border-b border-divider">
                {levels.map((level) => {
                  const above =
                    level.median !== null &&
                    stats.salaryMedian !== null &&
                    level.median > stats.salaryMedian;
                  return (
                    <div
                      key={level.value}
                      className="flex items-baseline gap-3 border-t border-divider py-3"
                      title={`${level.sample} trong ${level.count} tin của mức này có ghi số lương`}
                    >
                      <span className="flex-1 text-sm">{level.label}</span>
                      <span className="tnum text-xs text-neutral-600">
                        {formatCount(level.sample)}/{formatCount(level.count)} tin
                      </span>
                      <span
                        className={cx(
                          'w-18 text-right font-heading text-[17px] font-extrabold',
                          above && 'text-accent-700',
                          level.median === null && 'text-neutral-500',
                        )}
                      >
                        {level.median === null ? '—' : `${millions(level.median)} tr`}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2.5 text-xs text-neutral-700">
                Cột giữa: số tin ghi lương / tổng số tin của mức. Tin không ghi số năm kinh nghiệm không
                nằm trong bảng này.
              </p>
            </div>

            <Callout
              tone="ink"
              align="start"
              className="p-4.5"
              icon={<Mascot pose="head" width={40} motion="none" />}
            >
              {samples.length === 0
                ? 'Chưa mức kinh nghiệm nào có tin ghi số lương, nên chưa có trung vị nào để tin.'
                : `Số trung vị tính trên mẫu nhỏ (${Math.min(...samples)}–${Math.max(...samples)} tin mỗi mức), nên coi là tham khảo chứ đừng mang đi đàm phán một mình.`}
            </Callout>
          </div>
        </section>
      )}
    </>
  );
}
