import { FRESH_CHECK_HOURS, findFieldJobs, listFields } from '@/api/field.api';
import { getOverview } from '@/api/stats.api';
import { FieldFilterPanel } from '@/components/job/field-filter-panel';
import { FieldHero } from '@/components/job/field-hero';
import { FieldJobRow } from '@/components/job/field-job-row';
import { FieldScopeBar } from '@/components/job/field-scope-bar';
import { FieldRelaxHints, FieldStats } from '@/components/job/field-stats';
import { Cmd, Empty } from '@/components/ui/empty';
import { Glyph } from '@/components/ui/glyph';
import { Pagination } from '@/components/ui/pagination';
import { PURCHASE_TYPES, PURCHASE_TYPE_UNKNOWN } from '@/constants/purchase';
import { SaturdayWork } from '@/enums';
import { EXPERIENCE_VALUES, FACET_NONE, SALARY_VALUES, onlyKnown } from '@/lib/field-bands';
import { readFlag, readNumber, readParam, readParams, type SearchParams } from '@/lib/query';
import { formatCount } from '@/utils/format';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Ngành của tôi' };

const PATH = '/nganh';
const DEFAULT_FIELD = 'thu-mua-hcm';

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
 * BỐ CỤC — dựng theo phương án 1b của bản thiết kế Modernist
 *
 *     ┌──────────────────────────────────────────────────┐
 *     │ hero ĐỎ: tên trang · 3 con số                    │  ← poster, tràn viền
 *     ├──────────────────────────────────────────────────┤
 *     │ Đang xét: [chip] [chip] [chip]      Xoá hết      │  ← nền xám, 1 dòng
 *     ├────────────┬─────────────────────────────────────┤
 *     │ bảng lọc   │ 318 việc làm      Đã kiểm 48h: 1/318│
 *     │ (dính khi  ├─────────────────────────────────────┤
 *     │  cuộn)     │ ■ tin ─────────── 13–17 tr  [Xem]   │  ← DÒNG, không phải thẻ
 *     │            │ ■ tin ─────────── Thoả thuận [Xem]  │
 *     │            ├─────────────────────────────────────┤
 *     │            │ phân bố lương  │ ▓ Nói thật về DL   │  ← thống kê ở CUỐI
 *     └────────────┴─────────────────────────────────────┘
 *
 * Ba quyết định của bố cục này, theo đúng thứ tự quan trọng:
 *
 * 1. **Tin đầu tiên nằm ngay dưới nếp gấp.** Hero + dải "Đang xét" + dòng tiêu
 *    đề danh sách cộng lại khoảng 330px trên màn 1280×800 — tin đầu tiên hiện
 *    ra mà không phải cuộn. Đây là phép thử duy nhất đáng quan tâm của một
 *    trang mà lý do tồn tại là đọc việc làm.
 *
 * 2. **Bảng lọc DÍNH khi cuộn.** Cuộn tới tin thứ bốn mươi rồi muốn hẹp bớt
 *    thì không phải cuộn ngược lên đầu trang.
 *
 * 3. **Thống kê xuống DƯỚI danh sách**, cố ý. Nó trả lời câu "ngành này nhìn
 *    chung thế nào" — câu hỏi của người đang khảo sát, không phải của người
 *    đang tìm việc để nộp.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default async function FieldPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const slug = readParam(params, 'f') ?? DEFAULT_FIELD;

  const [result, fields, overview] = await Promise.all([
    findFieldJobs(slug, {
      page: readNumber(params, 'page'),
      includeWeak: readFlag(params, 'weak'),
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
    // Đã bọc `cache()` của React nên `TopShell` gọi lại cũng không tốn thêm
    // truy vấn nào — xem chú thích ở `getOverview`.
    getOverview(),
  ]);

  if (!result) {
    return (
      <div className="px-4 py-10 sm:px-7">
        <Empty title={`Chưa có ngành "${slug}"`}>
          Ngành được định nghĩa trong <Cmd>src/constants/field</Cmd> rồi nạp vào bảng{' '}
          <Cmd>SavedFilter</Cmd>. Chạy <Cmd>npm run db:seed</Cmd> để nạp.
        </Empty>
      </div>
    );
  }

  const freshPct =
    result.total === 0 ? 0 : Math.round((result.freshlyChecked / result.total) * 100);

  return (
    <>
      <FieldHero result={result} alive={overview.alive} activeSources={overview.activeSources} />

      <FieldScopeBar pathname={PATH} params={params} result={result} />

      <div className="lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
        {/* `sticky` + `max-h` + `overflow-auto`: bảng lọc dài hơn màn hình nên
            phải tự cuộn được, nếu không thì nút "Áp bộ lọc" ở đáy bị đẩy ra
            khỏi tầm nhìn và không cách nào bấm tới. */}
        <aside className="border-b-2 border-divider px-4 pt-5 pb-8 lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto lg:border-r-2 lg:border-b-0 lg:px-5 lg:pb-10">
          <FieldFilterPanel result={result} params={params} fields={fields} />
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-divider px-4 pt-5 pb-3.5 sm:px-7">
            <h2 className="text-[22px] sm:text-[25px]">{formatCount(result.total)} việc làm</h2>
            <p className="text-[13px] text-neutral-700">khớp chắc trước, rồi mới đăng</p>

            {/* Con số này nói về ĐỘ TƯƠI của chính danh sách ngay bên dưới, nên
                nó đứng ở đầu danh sách chứ không nằm trong dải chỉ số ở hero. */}
            <p
              className="inline-flex items-center gap-1.5 text-[13px] text-neutral-800 sm:ml-auto"
              title={`Tỷ lệ tin vừa được gọi HTTP/API vào tận nơi để xác nhận còn tuyển (${freshPct}%)`}
            >
              <Glyph name="shield" size={14} stroke="var(--color-accent)" />
              Đã kiểm {FRESH_CHECK_HOURS}h: {result.freshlyChecked}/{result.total} tin
            </p>
          </div>

          {result.items.length === 0 ? (
            <div className="flex flex-col gap-4 px-4 py-6 sm:px-7">
              <FieldRelaxHints result={result} params={params} pathname={PATH} />
              <Empty title="Không tin nào khớp">
                {result.scanned === 0 ? (
                  <>
                    Kho chưa có tin nào trong phạm vi này. Chạy{' '}
                    <Cmd>npm run crawl -- --source vnw --full --limit 800</Cmd>.
                  </>
                ) : readParam(params, 'q')?.trim() ? (
                  // Ô tìm kiếm không để lại dấu vết nào trong bảng lọc, nên khi
                  // nó là thủ phạm thì phải gọi tên nó ra. Bảo người ta đi nới
                  // bộ lọc trong khi thứ giết hết kết quả là chữ họ vừa gõ là
                  // chỉ sai đường.
                  <>
                    Không tin nào có “{readParam(params, 'q')?.trim()}” ở tiêu đề hay tên công ty.
                    Thử chữ ngắn hơn, hoặc gỡ chip tìm kiếm ở dải “Đang xét” phía trên.
                  </>
                ) : (
                  <>
                    Nới một chiều ở bảng lọc bên trái, hoặc bấm “Xoá hết bộ lọc”. Nếu nghi từ điển
                    loại oan thì soi bằng <Cmd>npm run match -- --show reject</Cmd>.
                  </>
                )}
              </Empty>
            </div>
          ) : (
            <>
              {result.items.map((row) => (
                <FieldJobRow key={row.job.id} row={row} />
              ))}

              <div className="px-4 py-6 sm:px-7">
                <Pagination
                  pathname={PATH}
                  params={params}
                  page={result.page}
                  pageCount={result.pageCount}
                />
              </div>
            </>
          )}

          <FieldStats result={result} params={params} pathname={PATH} />
        </div>
      </div>
    </>
  );
}
