import { Fragment } from 'react';

import { MIN_STACK_SAMPLE, findFieldJobs, listFields, type FieldPage } from '@/api/field.api';
import { PAGE_SIZE } from '@/api/job.api';
import { getSaveContext } from '@/api/saved.api';
import { FieldActiveFilters } from '@/components/job/field-active-filters';
import { FieldEmpty } from '@/components/job/field-empty';
import { FieldFilterPanel } from '@/components/job/field-filter-panel';
import { FieldJobCard } from '@/components/job/field-job-card';
import { BootScreen } from '@/components/layout/boot-screen';
import { Bae } from '@/components/ui/bae';
import { BarRow } from '@/components/ui/bar-row';
import { Callout } from '@/components/ui/callout';
import { Cmd, Empty } from '@/components/ui/empty';
import { Glyph } from '@/components/ui/glyph';
import { Mascot } from '@/components/ui/mascot';
import { Kicker, StatCell, StatStrip } from '@/components/ui/stat';
import { FRESH_CHECK_HOURS } from '@/constants/field';
import { PURCHASE_TYPES, PURCHASE_TYPE_UNKNOWN } from '@/constants/purchase';
import { WORKSPACES, isWorkspaceId, type WorkspaceId } from '@/constants/workspace';
import { Level, SaturdayWork, WorkMode } from '@/enums';
import { EXPERIENCE_VALUES, FACET_NONE, SALARY_VALUES, onlyKnown } from '@/lib/field-bands';
import { buildUrl, readFlag, readNumber, readParam, readParams, type SearchParams } from '@/lib/query';
import { wsHref } from '@/lib/workspace-path';
import { workspaceParam } from '@/lib/workspace-route';
import { formatCount, formatPercent, millions } from '@/utils/format';

export const dynamic = 'force-dynamic';

/** Tên trang theo workspace — "Ngành của Bae" hay "Ngành của tôi". */
export async function generateMetadata({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  return { title: isWorkspaceId(ws) ? WORKSPACES[ws].label : 'Ngành' };
}

/** Từ vựng hợp lệ của các chiều lọc CỐ ĐỊNH — dùng để bỏ giá trị lạ trong URL. */
const PURCHASE_SLUGS: readonly string[] = [...PURCHASE_TYPES, PURCHASE_TYPE_UNKNOWN].map(
  (type) => type.slug,
);
const SATURDAY_VALUES: readonly string[] = [...Object.values(SaturdayWork), FACET_NONE];
const WORK_MODE_VALUES: readonly string[] = [...Object.values(WorkMode), FACET_NONE];
const LEVEL_VALUES: readonly string[] = [...Object.values(Level), FACET_NONE];

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
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ ws: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const ws = await workspaceParam(routeParams);
  const PATH = wsHref(ws, '/nganh');
  const params = await searchParams;
  const slug = readParam(params, 'f') ?? WORKSPACES[ws].defaultField;
  const includeWeak = readFlag(params, 'weak');

  const [result, fields, save] = await Promise.all([
    findFieldJobs(ws, slug, {
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
      // Stack là dữ liệu trong CSDL, không phải hằng số trong mã — nên không
      // đối chiếu được với một danh sách cố định ở đây. Slug lạ vẫn an toàn:
      // nó chỉ đơn giản không khớp tin nào, và chip "đang lọc" đã tự bỏ qua
      // slug không có trong `SKILL_SEEDS`.
      skills: readParams(params, 'stack'),
      levels: onlyKnown(readParams(params, 'cap'), LEVEL_VALUES),
      workModes: onlyKnown(readParams(params, 'ht'), WORK_MODE_VALUES),
    }),
    listFields(ws),
    getSaveContext(ws),
  ]);

  if (!result) {
    return (
      <Empty title={`Chưa có ngành “${slug}”`}>
        Ngành được định nghĩa trong <Cmd>src/constants/field</Cmd> rồi nạp vào bảng{' '}
        <Cmd>SavedFilter</Cmd>. Chạy <Cmd>npm run db:seed -- --ws {ws}</Cmd> để nạp.
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

  // Nghề phần mềm chia tin theo CÔNG NGHỆ, nghề thu mua theo NGÀNH CỦA CÔNG TY
  // — xem `WorkspaceConfig.taxonomy`. Cờ này quyết ba thứ trên trang: linh vật
  // ở hero, hai ô chỉ số thêm, và hai biểu đồ ở chân trang.
  const byStack = WORKSPACES[ws].taxonomy === 'stack';
  const remote = result.facets.workModes.find((facet) => facet.value === WorkMode.REMOTE);
  const [topStack, nextStack] = result.facets.skills;

  // Bốn bước của màn chào đúng là bốn bước trang này vừa chạy, với con số thật
  // của lượt xem này — không phải bốn câu trang trí. Đó cũng là lý do màn chào
  // gắn ở ĐÂY chứ không ở layout: mọi con số nó đọc đã có sẵn, không phải hỏi
  // thêm CSDL một lần nào.
  const bootSteps = [
    `Gọi ${formatCount(result.stats.sources.length)} sàn tuyển dụng`,
    `Gom ${formatCount(result.scanned)} tin còn hiệu lực`,
    `Chấm điểm ${formatCount(judged)} tin theo từ điển ngành`,
    `Xếp ${formatCount(result.total)} tin đúng ngành của bạn`,
  ];

  return (
    <>
      <BootScreen steps={bootSteps} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="brand-field px-(--pad) pt-8.5 text-text">
        <div className="flex flex-wrap items-end gap-7">
          <div className="min-w-0 flex-[1_1_420px]">
            <Kicker icon={byStack ? 'code' : 'funnel'}>{scope.join(' · ')}</Kicker>
            <h1 className="mb-3 text-(length:--h-hero) leading-[1.04] text-pretty">
              {formatCount(result.total)} tin đúng ngành của bạn
            </h1>
            <p className="mb-6 max-w-(--prose) text-base leading-normal text-pretty text-neutral-800">
              {byStack ? (
                <>
                  Ngành này lọc theo <strong className="font-extrabold">stack</strong> chứ không chỉ theo
                  chức danh — vì tin lập trình hay ghi tiêu đề chung chung mà yêu cầu công nghệ lại khác
                  hẳn nhau.
                </>
              ) : (
                <>
                  Bae-Job chỉ gom và lọc tin. Mọi tin đều dẫn về bản gốc trên sàn nguồn — bạn ứng tuyển ở
                  đó.
                </>
              )}
            </p>
          </div>
          {/* Bae đứng ở hero nghề phần mềm, mèo ở nghề thu mua. Cùng một chỗ,
              cùng một cỡ — đổi linh vật là đủ để nhìn một cái là biết đang ở
              workspace nào, cộng thêm bảng màu. */}
          <div className="hidden flex-none pb-2 md:block">
            {byStack ? <Bae action="fan" width={190} /> : <Mascot pose="sit" width={250} />}
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

          {/* Hai ô của riêng nghề phần mềm. CỘNG THÊM chứ không thay hai ô trên:
              bản thiết kế bỏ "đã kiểm còn-sống" và "lọt qua từ điển" ở màn SWE,
              nhưng hai ô đó là chỗ công cụ nói thật về dữ liệu của chính nó — và
              đặt chúng ngang hàng với số tin là một quyết định đã chốt của bản
              v2 (xem sơ đồ bố cục ở đầu file). Dải chỉ số tự cuộn dòng, nên sáu
              ô xếp thành hai hàng ba trên màn hẹp. */}
          {byStack && (
            <>
              <StatCell
                tone="brand"
                icon="globe"
                label="Tin nhận remote"
                value={formatCount(remote?.count ?? 0)}
                sub={`${formatPercent(remote?.count ?? 0, result.inFieldTotal)} số tin trong ngành`}
                hint="Đếm trên cả ngành, trước bộ lọc — nên nó không nhúc nhích khi bạn lọc"
              />
              <StatCell
                tone="brand"
                icon="code"
                label="Stack được gọi nhiều nhất"
                value={topStack?.label ?? '—'}
                sub={
                  topStack
                    ? `${formatCount(topStack.count)} tin${
                        nextStack ? ` · rồi tới ${nextStack.label} ${formatCount(nextStack.count)}` : ''
                      }`
                    : 'chưa bóc được stack nào'
                }
              />
            </>
          )}
        </StatStrip>
      </section>

      {/* ── Bảng lọc + danh sách ─────────────────────────────────────────── */}
      <div className="lg:grid lg:grid-cols-[var(--rail)_minmax(0,1fr)]">
        {/* `sticky` + `max-h` + `overflow-auto`: bảng lọc dài hơn màn hình nên
            phải tự cuộn được, nếu không nút "Áp bộ lọc" ở đáy bị đẩy ra khỏi
            tầm nhìn. `top-16` chừa chỗ cho thanh điều hướng cũng dính đầu trang. */}
        <aside className="border-b-2 border-divider px-4 pt-5.5 pb-8 sm:px-5 lg:sticky lg:top-16 lg:max-h-[calc(100vh-4rem)] lg:self-start lg:overflow-y-auto lg:border-r-2 lg:border-b-0 lg:pb-10">
          <FieldFilterPanel result={result} params={params} fields={fields} />
        </aside>

        {/* Danh sách tin chia CỘT ở màn rất rộng.
            Khung trang nay chiếm trọn cửa sổ, nên ở 2560px một thẻ tin kéo dài
            gần 2000px trong khi chữ trong nó chỉ chiếm 700px bên trái — đó là
            KÉO DÃN màn hình, không phải DÙNG màn hình. Với một danh sách, cách
            dùng bề rộng đúng là xếp thêm cột.

            Ngưỡng tính NGƯỢC từ bề rộng mỗi thẻ. Thẻ tin tự bật sang bố cục
            ngang (chữ · lương) ở mốc 600px của chính nó, nên dưới 600px một
            cột là thẻ gãy làm đôi theo chiều dọc — xấu hơn hẳn một cột rộng.
            Trừ đi cột lọc (tối đa 392px) và hai lề (tối đa 56px mỗi bên):

              2 cột cần  2×600 + 16 + 392 + 112 ≈ 1720px  → đặt 1700px
              3 cột cần  3×600 + 32 + 392 + 112 ≈ 2336px  → đặt 2600px cho thoáng

            1700px chứ không phải 1800px là có lý do cụ thể: Windows để tỷ lệ
            150% thì một màn 2560px báo về cho trình duyệt đúng 1706px, và mọi
            `@media` chạy trên con số đó. Đặt 1800px là bỏ sót đúng cấu hình
            phổ biến nhất của màn 27". Laptop 1440px vẫn một cột như cũ.

            Mọi thứ KHÔNG phải thẻ tin — dòng tiêu đề, dải chip, lời nhắn, nút
            "Xem thêm" — đều `col-span-full`: chúng nói về cả danh sách, chia đôi
            chúng ra là biến một câu thành hai mẩu rời. */}
        <div className="grid min-w-0 grid-cols-1 gap-4 px-(--pad) pt-5.5 pb-11 min-[1700px]:grid-cols-2 min-[2600px]:grid-cols-3">
          <div className="col-span-full flex flex-wrap items-end gap-4 border-b-2 border-divider pb-3.5">
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

          <FieldActiveFilters
            pathname={PATH}
            params={params}
            field={result.slug}
            className="col-span-full"
          />

          {result.items.length === 0 ? (
            <div className="col-span-full">
              <FieldEmpty result={result} params={params} pathname={PATH} />
            </div>
          ) : (
            <>
              {result.items.map((row, index) => (
                <Fragment key={row.job.id}>
                  <FieldJobCard
                    ws={ws}
                    row={row}
                    fieldMedian={result.stats.salaryMedian}
                    save={save}
                    anchor={`tin-${index + 1}`}
                    // So le tính trong TỪNG lượt 20 tin: bấm "Xem thêm" thì lượt
                    // mới trôi lên từ đầu nhịp, không phải đợi 20 × 60ms.
                    delay={Math.min(index % PAGE_SIZE, 7) * 0.06}
                  />
                  {index === Math.min(2, result.items.length - 1) && (
                    <HonestyNote ws={ws} fresh={result.freshlyChecked} total={result.total} />
                  )}
                </Fragment>
              ))}

              {/* Tin khớp yếu — Bae ĐỌC, không quạt. Hành động `read` của linh
                  vật được khai đúng cho chỗ này (xem bảng ở `ui/bae.tsx`).

                  Bảng lọc đã có công tắc "Kể cả tin khớp yếu" kèm con số, nhưng
                  nó nằm cuối một cột dài và ngoài tầm mắt khi đang đọc tin thứ
                  mười. Khối này nói cùng một việc ở chỗ người ta thật sự đang
                  nhìn. Chỉ bật ở nghề phần mềm, đúng như bản thiết kế: tin lập
                  trình hay ghi tiêu đề chung chung nên tỉ lệ khớp yếu cao hơn
                  hẳn, và ở đó nó đáng một khối riêng. */}
              {byStack && result.weakHidden > 0 && !includeWeak && (
                <Callout
                  tone="brand"
                  className="col-span-full gap-4 px-5 py-4"
                  icon={<Bae action="read" width={72} className="hidden sm:block" />}
                  action={
                    <a
                      href={buildUrl(PATH, params, { weak: '1', page: undefined })}
                      className="btn btn-secondary border-accent-700 whitespace-nowrap text-accent-800 hover:text-accent-800"
                    >
                      Xem {formatCount(result.weakHidden)} tin cần soi
                    </a>
                  }
                >
                  Còn{' '}
                  <strong className="font-extrabold">
                    {formatCount(result.weakHidden)} tin cần soi lại
                  </strong>
                  : tiêu đề ghi chung chung (“Developer”, “Kỹ sư”) mà từ khoá ngành chỉ xuất hiện trong
                  mô tả. Bae-Job không tự xếp chúng vào danh sách chính — bạn xem rồi quyết.
                </Callout>
              )}

              <div className="col-span-full flex flex-col items-center gap-2 pt-1">
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

      {byStack && <StackFooter result={result} />}
    </>
  );
}

/**
 * Chân trang của nghề phần mềm: lương theo stack · tin về từ sàn nào.
 *
 * Chỉ có ở nghề phần mềm vì nó trả lời một câu chỉ nghề này hỏi — "học thêm cái
 * gì thì được trả thêm bao nhiêu". Nghề thu mua không có chiều nào tương đương,
 * và phần phân bố lương chung đã nằm ở trang Lương.
 *
 * Cả hai biểu đồ đọc trên tập ĐANG XEM, nên lọc "Remote" là hai biểu đồ đếm lại
 * trong phạm vi remote. Mẫu số vì thế phải ghi ra, không được để người đọc đoán.
 */
function StackFooter({ result }: { result: FieldPage }) {
  const bySkill = result.stats.salaryBySkill;
  const sources = result.stats.sources;

  // Không có tin nào ghi lương lẫn không có tin nào về thì chân trang chỉ còn
  // hai tiêu đề rỗng — thà không vẽ gì.
  if (bySkill.length === 0 && sources.length === 0) return null;

  // Thanh dài nhất = 100%, các thanh khác so với nó. So với 0 thì bốn stack
  // lương 30–46 triệu ra bốn thanh gần như dài bằng nhau và biểu đồ vô dụng.
  const salaryCeil = Math.max(1, ...bySkill.map((row) => row.median));
  const sourceCeil = Math.max(1, ...sources.map((row) => row.count));
  const sampleLow = Math.min(...bySkill.map((row) => row.sample));
  const sampleHigh = Math.max(...bySkill.map((row) => row.sample));

  return (
    <section className="flex flex-wrap border-t-2 border-divider">
      {bySkill.length > 0 && (
        <div className="min-w-0 flex-[1_1_380px] px-(--pad) pt-6.5 pb-9 lg:border-r-2 lg:border-divider">
          <h5 className="mb-4.5">
            Lương trung vị theo stack ·{' '}
            {formatCount(result.stats.salaryCount)}/{formatCount(result.total)} tin có ghi số
          </h5>
          <div className="flex flex-col gap-3">
            {bySkill.map((row, index) => (
              <BarRow
                key={row.slug}
                label={<span className="font-heading font-extrabold">{row.name}</span>}
                count={`${millions(row.median)} tr`}
                ratio={row.median / salaryCeil}
                fill={index === 0 ? 'accent' : index < 3 ? 'mid' : 'soft'}
                strong={index === 0}
                height={22}
                countWidth={62}
                delay={Math.min(index, 7) * 0.07}
                className="text-sm"
              />
            ))}
          </div>
          <p className="mt-4 max-w-(--prose) text-[13px] text-pretty text-neutral-700">
            Mỗi stack lấy mẫu từ {formatCount(sampleLow)} tới {formatCount(sampleHigh)} tin có ghi số, nên
            khoảng cách nhỏ (dưới 3 triệu) đừng coi là thật. Stack có dưới {MIN_STACK_SAMPLE} tin GHI SỐ
            thì không vẽ — trung vị của bốn tin là lương của bốn tin, không phải lương của một công nghệ.
          </p>
        </div>
      )}

      {sources.length > 0 && (
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-6 px-(--pad) pt-6.5 pb-9">
          <div>
            <h5 className="mb-4">Tin về từ sàn nào</h5>
            <div className="flex flex-col gap-2.5">
              {sources.map((row, index) => (
                <BarRow
                  key={row.value}
                  label={row.label}
                  count={formatCount(row.count)}
                  ratio={row.count / sourceCeil}
                  fill={index === 0 ? 'accent' : index < 3 ? 'mid' : 'soft'}
                  strong={index === 0}
                  labelWidth={104}
                  countWidth={32}
                  delay={Math.min(index, 7) * 0.08}
                  className="text-[13px]"
                />
              ))}
            </div>
          </div>

          {/* Mèo trên nền mực — chỗ duy nhất trang này dùng nền tối, nên nó
              đóng vai dấu chấm hết cho cả trang. */}
          <div className="flex items-start gap-4 bg-text p-5 text-neutral-100">
            <Mascot pose="head" width={64} ink="light" motion="none" />
            <div>
              <h6 className="mb-2 text-neutral-100">Ngành phần mềm khó lọc hơn</h6>
              <p className="text-[13px] leading-[1.55] text-neutral-300">
                Tin lập trình thường gọi tên công nghệ trong mô tả chứ không ở tiêu đề, nên phải đọc cả
                mô tả mới bóc được stack. Vì vậy tỉ lệ “cần soi” ở đây cao hơn nghề thu mua — và nhãn
                viền là stack chỉ đọc thấy trong mô tả, không phải sàn tự khai.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Lời nhắn chen giữa danh sách, sau tin thứ ba.
 *
 * Đứng ở đây chứ không ở cuối trang: người đọc tới tin thứ ba là đã bắt đầu
 * tin vào danh sách, đúng lúc phải được nhắc rằng phần lớn tin chưa ai gọi lại.
 */
function HonestyNote({ ws, fresh, total }: { ws: WorkspaceId; fresh: number; total: number }) {
  return (
    <Callout
      tone="live"
      className="col-span-full gap-4 px-5 py-4"
      icon={<Mascot pose="head" width={40} motion="none" />}
      action={
        <a
          href={wsHref(ws, '/nguon')}
          className="btn btn-secondary border-live-700 whitespace-nowrap text-live-700 hover:text-live-700"
        >
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
