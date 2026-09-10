import type { ReactNode } from 'react';

import { FRESH_CHECK_HOURS, type Facet, type FieldPage } from '@/api/field.api';
import { Glyph, type GlyphName } from '@/components/ui/glyph';
import { cx } from '@/components/ui/tone';
import { percent } from '@/lib/chart';
import { buildUrl, readParams, urlToggleValue, type SearchParams } from '@/lib/query';
import { formatCount, millions } from '@/utils/format';

/**
 * Thống kê ngành — khối cuối trang, cố ý nằm DƯỚI danh sách tin.
 *
 * Nó trả lời câu "ngành này nhìn chung thế nào" — câu hỏi của người đang KHẢO
 * SÁT, không phải của người đang tìm việc để nộp. Đặt lên trên thì nó đẩy đúng
 * thứ người ta tới đây để xem xuống dưới màn hình.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HAI QUY TẮC TỰ ĐẶT CHO CẢ KHỐI NÀY
 *
 * 1. **Luôn ghi mẫu số.** Mọi con số ở đây tính trên tập ĐANG XEM (sau bộ lọc),
 *    không phải trên cả ngành. Trung vị lương của 12 tin ở Quận 7 và trung vị
 *    của 318 tin cả ngành là hai đại lượng khác nhau, mà nhìn thì giống hệt.
 *
 * 2. **Đọc được thì bấm được.** Mỗi dòng phân bố là một liên kết bật/tắt đúng
 *    ô lọc tương ứng. Chỗ nhìn ra "15–25 tr đang nhiều tin nhất" cũng chính là
 *    chỗ lọc lấy nhóm đó.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Bản thiết kế (1b) chỉ vẽ hàng đầu tiên: phân bố lương + bảng "Nói thật về dữ
 * liệu". Ba phân bố còn lại — kinh nghiệm, công ty, sàn nguồn — đang chạy thật
 * và vẫn giữ, xếp thành một hàng thứ hai dùng đúng ngôn ngữ thị giác đó.
 */
export function FieldStats({
  result,
  params,
  pathname,
}: {
  result: FieldPage;
  params: SearchParams;
  pathname: string;
}) {
  // Không còn tin nào thì mọi biểu đồ đều là bốn thanh rỗng — im lặng còn hơn
  // vẽ ra một khối trống để người đọc phải tự hiểu là "không có dữ liệu".
  if (result.total === 0) return null;

  const { stats } = result;
  const basis = `trên ${formatCount(result.total)} tin đang xem`;

  return (
    <section className="border-t-2 border-divider px-4 py-6 sm:px-7">
      <div className="flex flex-wrap items-start gap-7">
        {/* ── Lương: phân bố + trung vị ─────────────────────────────────── */}
        <div className="min-w-75 flex-1">
          <Head icon="bars" title={`Lương trong ${formatCount(result.total)} tin đang xem`} />
          <Bars facets={result.facets.salary} name="luong" params={params} pathname={pathname} />
          <p className="mt-2.5 text-xs text-neutral-700">
            {stats.salaryMedian === null
              ? `Chưa tin nào trong ${formatCount(result.total)} tin đang xem ghi số lương.`
              : `Trung vị ${millions(stats.salaryMedian)} tr · tính trên ${stats.salaryCount}/${result.total} tin có ghi số.`}{' '}
            Bấm một dòng để lọc theo dòng đó.
          </p>
        </div>

        {/* ── Bảng nói thật ─────────────────────────────────────────────── */}
        <HonestyPanel result={result} />
      </div>

      <div className="mt-7 grid gap-7 border-t border-divider pt-6 md:grid-cols-3">
        <div>
          <Head icon="briefcase" title="Kinh nghiệm ngành đòi hỏi" />
          <Bars facets={result.facets.experience} name="kn" params={params} pathname={pathname} />
          <p className="mt-2.5 text-xs text-neutral-700">Theo số năm tối thiểu tin yêu cầu · {basis}</p>
        </div>

        <div>
          <Head icon="building" title="Công ty tuyển nhiều nhất" />
          <Bars facets={stats.topCompanies} />
          <p className="mt-2.5 text-xs text-neutral-700">{basis}</p>
        </div>

        <div>
          <Head icon="globe" title="Tin đến từ sàn nào" />
          <Bars facets={stats.sources} />
          <p className="mt-2.5 text-xs text-neutral-700">
            {basis} — để biết con số trên đang dựa vào ai
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * Bảng đen "Nói thật về dữ liệu".
 *
 * Nền đen giữa một trang nền kem là cố ý: đây là chỗ DUY NHẤT trên trang nói về
 * giới hạn của chính công cụ, và nó phải không trốn được. Bản thiết kế đặt nó
 * ngay cạnh biểu đồ lương — cạnh con số đẹp nhất trang là chỗ đúng để nói con
 * số đó dựa trên cái gì.
 */
function HonestyPanel({ result }: { result: FieldPage }) {
  const freshPct = result.total === 0 ? 0 : Math.round((result.freshlyChecked / result.total) * 100);

  // CỐ Ý không gọi đây là "độ chính xác". Độ chính xác là tỷ lệ tin nhận vào mà
  // ĐÚNG thật, và nó chỉ đo được bằng cách mở tay từng tin. Con số này chỉ nói
  // từ điển lọc chặt tới đâu.
  //
  // Mẫu số là số tin THẬT SỰ được đưa qua từ điển, nên phải trừ phần bị "Chỉ
  // TP.HCM cũ" chặn từ trước — những tin đó từ điển chưa hề nhìn tới. Tử số là
  // `dictionaryAccepted`, đếm trước mọi ô lọc: nhờ vậy tích thêm một quận thì
  // tỷ lệ này ĐỨNG YÊN. Bản trước lấy `total/scanned` nên nó tụt mỗi lần lọc,
  // làm như từ điển vừa chặt hơn — trong khi từ điển không đổi gì cả.
  const judged = result.scanned - result.droppedByNarrowHcm;
  const selectivity = judged === 0 ? 0 : Math.round((result.dictionaryAccepted / judged) * 100);

  const sources = result.stats.sources
    .slice(0, 3)
    .map((source) => `${source.label} ${source.count}`)
    .join(' · ');

  return (
    <div className="w-full bg-text p-5 text-neutral-100 lg:w-[320px]">
      <div className="mb-2.5 flex items-center gap-2">
        <Glyph name="shield" size={16} stroke="var(--color-accent-400)" />
        <h3 className="text-base text-neutral-100">Nói thật về dữ liệu</h3>
      </div>

      <p className="mb-3.5 text-[13px] text-neutral-300">
        Mới kiểm còn-sống <strong className="font-extrabold text-neutral-100">
          {result.freshlyChecked}/{result.total}
        </strong>{' '}
        tin trong {FRESH_CHECK_HOURS}h ({freshPct}%).
        {sources && <> Nguồn tin: {sources}.</>} Từ điển ngành nhận{' '}
        {formatCount(result.dictionaryAccepted)}/{formatCount(judged)} tin đã chấm ({selectivity}%)
        — đây là độ CHẶT của từ điển, không phải độ chính xác. Số ngày còn lại lấy theo sàn — mở
        tin gốc là chắc nhất.
      </p>

      <a
        href="/nguon"
        className="flex w-full items-center gap-2 border border-neutral-600 px-3 py-2 text-sm font-extrabold text-neutral-100 transition-colors hover:bg-neutral-800"
      >
        <Glyph name="external" size={15} />
        Xem Nguồn &amp; vận hành
      </a>
    </div>
  );
}

function Head({ icon, title }: { icon: GlyphName; title: ReactNode }) {
  return (
    <div className="mb-3.5 flex items-center gap-2">
      <Glyph name={icon} size={16} stroke="var(--color-accent)" />
      <h3 className="text-base">{title}</h3>
    </div>
  );
}

/**
 * Phân bố dạng thanh ngang — nhãn · rãnh · số, ba cột thẳng hàng.
 *
 * Thanh mặc định tô `accent-300` (hồng nhạt), thanh ĐANG LỌC tô `accent` (đỏ
 * đặc). Chênh lệch đó là kênh duy nhất mà màu ở đây phải gánh, nên không tô
 * đậm dần theo giá trị — chiều dài thanh đã nói độ lớn rồi, tô thêm là mã hoá
 * hai lần một thông tin và đốt mất kênh màu.
 *
 * Không truyền `name`/`params` thì các dòng chỉ để ĐỌC (công ty, sàn nguồn):
 * hai chiều đó không phải là bộ lọc của trang này.
 */
function Bars({
  facets,
  name,
  params,
  pathname,
}: {
  facets: Facet[];
  name?: string;
  params?: SearchParams;
  pathname?: string;
}) {
  const selected = new Set(name && params ? readParams(params, name) : []);

  // Ô 0 tin bỏ khỏi BIỂU ĐỒ (thanh dài 0 không nói gì), nhưng vẫn giữ nếu đang
  // được chọn — nó chính là lý do kết quả đang ít, phải nhìn thấy.
  const rows = facets.filter((facet) => facet.count > 0 || selected.has(facet.value));
  if (rows.length === 0) return <p className="text-sm text-neutral-700">Chưa có dữ liệu</p>;

  const ceiling = Math.max(1, ...rows.map((row) => row.count));

  return (
    <div className="flex flex-col gap-2">
      {rows.map((facet) => {
        const on = selected.has(facet.value);
        const body = (
          <>
            <span className={cx('min-w-0 truncate', on && 'font-extrabold')} title={facet.label}>
              {facet.label}
            </span>
            <span className="h-3.5 bg-neutral-200">
              <span
                className={cx('block h-3.5', on ? 'bg-accent' : 'bg-accent-300')}
                style={{ width: percent(facet.count, ceiling) }}
              />
            </span>
            <span className={cx('tnum text-right', on && 'font-extrabold text-accent-700')}>
              {facet.count}
            </span>
          </>
        );

        const shape = 'grid grid-cols-[minmax(0,5.75rem)_1fr_1.75rem] items-center gap-3 text-[13px]';

        return name && params && pathname ? (
          <a
            key={facet.value}
            href={urlToggleValue(pathname, params, name, facet.value)}
            title={on ? `Bỏ lọc "${facet.label}"` : `Lọc theo "${facet.label}"`}
            className={cx(shape, 'transition-opacity hover:opacity-75')}
          >
            {body}
          </a>
        ) : (
          <div key={facet.value} className={shape}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Gợi ý nới lọc khi kết quả rỗng.
 *
 * Một danh sách trống tự nó không nói lỗi nằm ở đâu. Người dùng tích năm ô ở
 * bốn chiều rồi phải tự đoán chiều nào giết hết kết quả — thường là gỡ bừa
 * từng cái. Ở đây tầng dữ liệu đã thử bỏ từng chiều một và đếm lại, nên chỉ
 * việc bày ra: bỏ chiều này thì được lại bấy nhiêu tin, bấm một cái là xong.
 */
export function FieldRelaxHints({
  result,
  params,
  pathname,
}: {
  result: FieldPage;
  params: SearchParams;
  pathname: string;
}) {
  // Chỉ nói khi kết quả rỗng VÀ ngành thật sự có tin. Kho rỗng là chuyện khác
  // hẳn — "nới bộ lọc" lúc đó là lời khuyên sai, và `Empty` đã nói đúng việc
  // cần làm (chạy crawler).
  if (result.total > 0 || result.inFieldTotal === 0) return null;

  const KEY: Record<string, string> = {
    purchaseTypes: 'loai',
    districts: 'quan',
    saturdays: 't7',
    experience: 'kn',
    salary: 'luong',
  };

  /**
   * Khi KHÔNG chiều nào một mình cứu được kết quả.
   *
   * Xảy ra thật khi hai chiều cùng lúc giết hết tin — ví dụ chọn một quận
   * không có tin nào CỘNG một khoảng lương không có tin nào: bỏ riêng chiều
   * nào cũng vẫn 0. Nên phải luôn còn một đường thoát: xoá sạch bộ lọc.
   */
  const noSingleFix = result.relax.length === 0;

  return (
    <div className="border-l-[6px] border-warn bg-warn-soft px-5 py-4">
      <p className="flex items-center gap-2 text-sm font-extrabold text-warn-ink">
        <Glyph name="alert" size={16} />
        Bộ lọc đang quá chặt
      </p>
      <p className="mt-1 text-xs text-warn-ink/80">
        {noSingleFix
          ? 'Có ít nhất hai chiều cùng lúc loại hết tin, nên bỏ riêng chiều nào cũng vẫn rỗng.'
          : 'Bỏ bớt một chiều là có lại kết quả — bấm thẳng vào đây:'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {result.relax.map((hint) => (
          <a
            key={hint.value}
            href={buildUrl(pathname, params, { [KEY[hint.value] ?? hint.value]: undefined })}
            className="inline-flex items-center gap-1.5 bg-neutral-100 px-2.5 py-1.5 text-xs transition-colors hover:bg-white"
          >
            Bỏ lọc <strong className="font-extrabold">{hint.label}</strong>
            <span className="tnum text-neutral-700">→ {hint.count} tin</span>
          </a>
        ))}

        {/* Luôn có mặt, kể cả khi đã có gợi ý bỏ từng chiều: đôi khi thứ người
            dùng muốn là làm lại từ đầu chứ không phải gỡ từng cái. */}
        <a
          href={`${pathname}?f=${result.slug}`}
          className="inline-flex items-center gap-1.5 bg-neutral-100 px-2.5 py-1.5 text-xs transition-colors hover:bg-white"
        >
          Xoá hết bộ lọc
          <span className="tnum text-neutral-700">→ {formatCount(result.inFieldTotal)} tin</span>
        </a>
      </div>
    </div>
  );
}
