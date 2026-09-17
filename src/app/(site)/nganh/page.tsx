import { Fragment } from 'react';

import { findFieldJobs, listFields } from '@/api/field.api';
import { PAGE_SIZE } from '@/api/job.api';
import { getSaveContext } from '@/api/saved.api';
import { FieldActiveFilters } from '@/components/job/field-active-filters';
import { FieldEmpty } from '@/components/job/field-empty';
import { FieldFilterPanel } from '@/components/job/field-filter-panel';
import { FieldJobCard } from '@/components/job/field-job-card';
import { Callout } from '@/components/ui/callout';
import { Cmd, Empty } from '@/components/ui/empty';
import { Glyph } from '@/components/ui/glyph';
import { Mascot } from '@/components/ui/mascot';
import { Kicker, StatCell, StatStrip } from '@/components/ui/stat';
import { DEFAULT_FIELD_SLUG, FRESH_CHECK_HOURS } from '@/constants/field';
import { PURCHASE_TYPES, PURCHASE_TYPE_UNKNOWN } from '@/constants/purchase';
import { SaturdayWork } from '@/enums';
import { EXPERIENCE_VALUES, FACET_NONE, SALARY_VALUES, onlyKnown } from '@/lib/field-bands';
import { buildUrl, readFlag, readNumber, readParam, readParams, type SearchParams } from '@/lib/query';
import { formatCount, formatPercent, millions } from '@/utils/format';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Ngành của tôi' };

const PATH = '/nganh';

/** Từ vựng hợp lệ của các chiều lọc CỐ ĐỊNH — dùng để bỏ giá trị lạ trong URL. */
const PURCHASE_SLUGS: readonly string[] = [...PURCHASE_TYPES, PURCHASE_TYPE_UNKNOWN].map(
  (type) => type.slug,
);
const SATURDAY_VALUES: readonly string[] = [...Object.values(SaturdayWork), FACET_NONE];

/**
 * Ngành của tôi — trả lời **"tin nào đúng nghề tôi nhắm, và có còn tuyển không"**.
 *
 * Khác "Kho tin" ở một điểm: kho tin lọc bằng những gì gõ được thành SQL, còn
 * trang này lọc bằng một TỪ ĐIỂN có luật ưu tiên. Gõ "thu mua" ra cả
 * "procurement", "merchandiser", "mua sắm" — và KHÔNG ra "kế toán mua hàng".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BỐ CỤC — bản v2
 *
 *     ┌──────────────────────────────────────────────────┐
 *     │ hero PASTEL: "318 tin đúng ngành" · mèo ngồi     │
 *     │ ─ 4 ô chỉ số ─────────────────────────────────── │
 *     ├────────────┬─────────────────────────────────────┤
 *     │ bảng lọc   │ 318 việc làm   Chỉ tin còn sống ·90n│
 *     │            │ [thẻ tin]                           │
 *     │            │ [thẻ tin]                           │
 *     │            │ [thẻ tin]                           │
 *     │            │ ▌Mèo Bae nói thật về độ tươi        │  ← chen sau tin thứ ba
 *     │            │ [thẻ tin] …      [Xem thêm 20 tin]  │
 *     └────────────┴─────────────────────────────────────┘
 *
 * Bốn ô chỉ số quay lại (bản 1b rút còn ba). Ô "đã kiểm còn-sống" và "lọt qua
 * từ điển" đứng ngay dưới tiêu đề là cố ý: bản v2 đặt độ tươi của dữ liệu
 * NGANG HÀNG với số tin, không giấu xuống cuối trang.
 *
 * Thống kê phân bố (lương, kinh nghiệm) chuyển hẳn sang trang Lương — trang
 * này chỉ còn một việc: đọc tin.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default async function FieldPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const slug = readParam(params, 'f') ?? DEFAULT_FIELD_SLUG;
  const includeWeak = readFlag(params, 'weak');

  const [result, fields, save] = await Promise.all([
    findFieldJobs(slug, {
      page: readNumber(params, 'page'),
      cumulative: true,
      includeWeak,
      strictHcm: readFlag(params, 'hep'),
      q: readParam(params, 'q'),
      // Lọc bỏ giá trị lạ trước khi truyền xuống — xem `onlyKnown`. URL sống
      // lâu hơn mã nguồn, và một liên kết lưu từ bản trước (`?kn=3`) mà cứ đem
      // đi lọc thì loại sạch mọi tin rồi trả về trang rỗng không lời giải thích.
      purchaseTypes: onlyKnown(readParams(params, 'loai'), PURCHASE_SLUGS),
      districts: readParams(params, 'quan'),
      saturdays: onlyKnown(readParams(params, 't7'), SATURDAY_VALUES),
      experience: onlyKnown(readParams(params, 'kn'), EXPERIENCE_VALUES),
      salary: onlyKnown(readParams(params, 'luong'), SALARY_VALUES),
    }),
    listFields(),
    getSaveContext(),
  ]);

  if (!result) {
    return (
      <Empty title={`Chưa có ngành “${slug}”`}>
        Ngành được định nghĩa trong <Cmd>src/constants/field</Cmd> rồi nạp vào bảng{' '}
        <Cmd>SavedFilter</Cmd>. Chạy <Cmd>npm run db:seed</Cmd> để nạp.
      </Empty>
    );
  }

  const scope = [result.name, ...result.provinceNames];
  if (result.maxAgeDays) scope.push(`${result.maxAgeDays} ngày`);

  // CỐ Ý không gọi đây là "độ chính xác". Độ chính xác là tỷ lệ tin nhận vào
  // mà ĐÚNG thật, chỉ đo được bằng cách mở tay từng tin. Con số này chỉ nói từ
  // điển lọc chặt tới đâu. Mẫu số trừ phần "Chỉ TP.HCM cũ" chặn từ trước — từ
  // điển chưa hề nhìn tới chúng — và tử số đếm TRƯỚC mọi ô lọc, nên tích thêm
  // một quận thì tỷ lệ này đứng yên.
  const judged = result.scanned - result.droppedByNarrowHcm;
  const shown = result.items.length;
  const more = Math.min(PAGE_SIZE, result.total - shown);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="brand-field px-4 pt-8.5 text-text sm:px-6">
        <div className="flex flex-wrap items-end gap-7">
          <div className="min-w-0 flex-[1_1_420px]">
            <Kicker icon="funnel">{scope.join(' · ')}</Kicker>
            <h1 className="mb-3 text-[34px] leading-[1.04] text-pretty sm:text-[44px]">
              {formatCount(result.total)} tin đúng ngành của bạn
            </h1>
            <p className="mb-6 max-w-140 text-base leading-normal text-pretty text-neutral-800">
              Bae-Job chỉ gom và lọc tin. Mọi tin đều dẫn về bản gốc trên sàn nguồn — bạn ứng tuyển ở
              đó.
            </p>
          </div>
          <div className="hidden flex-none pb-2 md:block">
            <Mascot pose="sit" width={250} />
          </div>
        </div>

        <StatStrip tone="brand">
          <StatCell
            tone="brand"
            icon="briefcase"
            label="Tin đúng ngành"
            value={formatCount(result.total)}
            emphasis
            sub={
              includeWeak
                ? `${formatCount(result.strong)} khớp chắc · ${formatCount(result.weak)} cần soi`
                : `${formatCount(result.strong)} khớp chắc · ${formatCount(result.weakHidden)} khớp yếu đang ẩn`
            }
          />
          <StatCell
            tone="brand"
            icon="money"
            label="Lương trung vị"
            value={result.stats.salaryMedian === null ? '—' : `${millions(result.stats.salaryMedian)} tr`}
            sub={`trên ${formatCount(result.stats.salaryCount)}/${formatCount(result.total)} tin ghi số`}
            hint="Trung vị chứ không phải trung bình: vài tin giám đốc 150 triệu sẽ kéo lệch số trung bình."
          />
          <StatCell
            tone="brand"
            icon="shield"
            label={`Đã kiểm còn-sống ${FRESH_CHECK_HOURS}h`}
            value={formatCount(result.freshlyChecked)}
            unit={` / ${formatCount(result.total)}`}
            sub="phần còn lại tin theo sàn nguồn"
            hint="Tin vừa được gọi HTTP/API vào tận nơi để xác nhận còn tuyển"
          />
          <StatCell
            tone="brand"
            icon="trend"
            label="Lọt qua từ điển"
            value={formatPercent(result.dictionaryAccepted, judged)}
            sub={`${formatCount(result.dictionaryAccepted)}/${formatCount(judged)} tin đã chấm`}
            hint="Độ CHẶT của từ điển ngành, không phải độ chính xác"
          />
        </StatStrip>
      </section>

      {/* ── Bảng lọc + danh sách ─────────────────────────────────────────── */}
      <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
        {/* `sticky` + `max-h` + `overflow-auto`: bảng lọc dài hơn màn hình nên
            phải tự cuộn được, nếu không nút "Áp bộ lọc" ở đáy bị đẩy ra khỏi
            tầm nhìn. `top-16` chừa chỗ cho thanh điều hướng cũng dính đầu trang. */}
        <aside className="border-b-2 border-divider px-4 pt-5.5 pb-8 sm:px-5 lg:sticky lg:top-16 lg:max-h-[calc(100vh-4rem)] lg:self-start lg:overflow-y-auto lg:border-r-2 lg:border-b-0 lg:pb-10">
          <FieldFilterPanel result={result} params={params} fields={fields} />
        </aside>

        <div className="flex min-w-0 flex-col gap-4 px-4 pt-5.5 pb-11 sm:px-6">
          <div className="flex flex-wrap items-end gap-4 border-b-2 border-divider pb-3.5">
            <div>
              <h3 className="mb-1">{formatCount(result.total)} việc làm</h3>
              <p className="text-[13px] text-neutral-700">
                Tin khớp chắc lên trước, rồi tới tin mới đăng
              </p>
            </div>
            <p className="inline-flex items-center gap-1.75 text-[13px] text-neutral-800 sm:ml-auto">
              <Glyph name="shield" size={14} stroke="var(--color-live)" />
              Chỉ tin còn sống{result.maxAgeDays ? ` · đăng trong ${result.maxAgeDays} ngày` : ''}
            </p>
          </div>

          <FieldActiveFilters pathname={PATH} params={params} field={result.slug} />

          {result.items.length === 0 ? (
            <FieldEmpty result={result} params={params} pathname={PATH} />
          ) : (
            <>
              {result.items.map((row, index) => (
                <Fragment key={row.job.id}>
                  <FieldJobCard
                    row={row}
                    fieldMedian={result.stats.salaryMedian}
                    save={save}
                    anchor={`tin-${index + 1}`}
                    // So le tính trong TỪNG lượt 20 tin: bấm "Xem thêm" thì lượt
                    // mới trôi lên từ đầu nhịp, không phải đợi 20 × 60ms.
                    delay={Math.min(index % PAGE_SIZE, 7) * 0.06}
                  />
                  {index === Math.min(2, result.items.length - 1) && (
                    <HonestyNote fresh={result.freshlyChecked} total={result.total} />
                  )}
                </Fragment>
              ))}

              <div className="flex flex-col items-center gap-2 pt-1">
                {more > 0 && (
                  <a
                    href={`${buildUrl(PATH, params, { page: result.page + 1 })}#tin-${shown + 1}`}
                    className="btn btn-secondary h-11 gap-2 px-5.5"
                  >
                    Xem thêm {more} tin
                    <Glyph name="chevronDown" size={16} strokeWidth={1.9} />
                  </a>
                )}
                <p className="text-xs text-neutral-700">
                  Đang xem {formatCount(shown)} / {formatCount(result.total)} tin
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Lời nhắn chen giữa danh sách, sau tin thứ ba.
 *
 * Đứng ở đây chứ không ở cuối trang: người đọc tới tin thứ ba là đã bắt đầu
 * tin vào danh sách, đúng lúc phải được nhắc rằng phần lớn tin chưa ai gọi lại.
 */
function HonestyNote({ fresh, total }: { fresh: number; total: number }) {
  return (
    <Callout
      tone="live"
      className="gap-4 px-5 py-4"
      icon={<Mascot pose="head" width={40} motion="none" />}
      action={
        <a href="/nguon" className="btn btn-secondary border-live-700 whitespace-nowrap text-live-700 hover:text-live-700">
          Xem Nguồn &amp; vận hành
        </a>
      }
    >
      Mèo Bae nói thật về độ tươi dữ liệu: chỉ{' '}
      <strong className="font-extrabold">
        {formatCount(fresh)}/{formatCount(total)}
      </strong>{' '}
      tin được kiểm còn-sống trong {FRESH_CHECK_HOURS}h (làm tròn {formatPercent(fresh, total)}). Số ngày
      còn lại lấy theo sàn nguồn — mở tin gốc là chắc nhất.
    </Callout>
  );
}
