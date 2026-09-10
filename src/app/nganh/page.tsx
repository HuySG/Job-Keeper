import { FRESH_CHECK_HOURS, findFieldJobs, listFields } from '@/api/field.api';
import { FieldActiveFilters, FieldFilterPanel } from '@/components/job/field-filter-panel';
import { FieldJobCard } from '@/components/job/field-job-card';
import { FieldRelaxHints, FieldStats } from '@/components/job/field-stats';
import { Cmd, Empty } from '@/components/ui/empty';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Stat, StatRow } from '@/components/ui/stat';
import { questionFor } from '@/constants/nav';
import { PURCHASE_TYPES, PURCHASE_TYPE_UNKNOWN } from '@/constants/purchase';
import { SaturdayWork } from '@/enums';
import {
  EXPERIENCE_VALUES,
  FACET_NONE,
  SALARY_VALUES,
  onlyKnown,
} from '@/lib/field-bands';
import { readFlag, readNumber, readParam, readParams, type SearchParams } from '@/lib/query';
import { formatCount, millions } from '@/utils/format';

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
 * BỐ CỤC: hai cột, việc làm là nhân vật chính
 *
 * Bản trước xếp mọi thứ thành một cột dọc: 4 ô chỉ số → dòng phạm vi → bảng lọc
 * → cảnh báo → biểu đồ chia loại → rồi mới tới tin đầu tiên. Đo trên màn hình
 * 1280×800 thì phải cuộn qua khoảng 1.000 px mới thấy một việc làm — trên một
 * trang mà lý do tồn tại của nó là đọc việc làm.
 *
 * Nay bảng lọc sang cột trái và DÍNH khi cuộn, cột phải chỉ có danh sách tin.
 * Tin đầu tiên nằm ngay dưới dòng chỉ số. Đây cũng là hình dạng mà mọi trang
 * tuyển dụng đều dùng, nên không ai phải học lại cách đọc.
 *
 * Thống kê xuống DƯỚI danh sách, cố ý. Nó trả lời câu "ngành này nhìn chung
 * thế nào" — câu hỏi của người đang khảo sát, không phải của người đang tìm
 * việc để nộp. Đặt lên trên thì nó đẩy đúng thứ người ta tới đây để xem xuống
 * dưới màn hình.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default async function FieldPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const slug = readParam(params, 'f') ?? DEFAULT_FIELD;
  const includeWeak = readFlag(params, 'weak');
  const strictHcm = readFlag(params, 'hep');

  const [result, fields] = await Promise.all([
    findFieldJobs(slug, {
      page: readNumber(params, 'page'),
      includeWeak,
      strictHcm,
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
  ]);

  if (!result) {
    return (
      <>
        <PageHeader title="Ngành của tôi" description={questionFor(PATH)} />
        <Empty title={`Chưa có ngành "${slug}"`}>
          Ngành được định nghĩa trong <Cmd>src/constants/field</Cmd> rồi nạp vào bảng
          <Cmd>SavedFilter</Cmd>. Chạy <Cmd>npm run db:seed</Cmd> để nạp.
        </Empty>
      </>
    );
  }

  const selectivity =
    result.scanned === 0 ? 0 : Math.round((result.total / result.scanned) * 100);
  const freshPct =
    result.total === 0 ? 0 : Math.round((result.freshlyChecked / result.total) * 100);

  return (
    <>
      <PageHeader title={result.name} description={questionFor(PATH)} />

      <div className="space-y-4">
        {/* ── Chỉ số: bốn con số mở đầu, không đổi theo cột nào ───────────── */}
        <StatRow>
          <Stat
            label="tin đúng ngành"
            value={formatCount(result.total)}
            sub={`${result.strong} khớp chắc · ${result.weak} cần soi`}
          />
          <Stat
            label="lương trung vị"
            value={
              result.stats.salaryMedian === null ? '—' : `${millions(result.stats.salaryMedian)} tr`
            }
            sub={
              result.stats.salaryMedian === null
                ? 'chưa tin nào ghi số'
                : `trên ${result.stats.salaryCount}/${result.total} tin ghi số`
            }
            hint="Trung vị chứ không phải trung bình: vài tin giám đốc 150 triệu sẽ kéo lệch số trung bình."
          />
          <Stat
            label={`đã kiểm trong ${FRESH_CHECK_HOURS}h`}
            value={`${freshPct}%`}
            tone={freshPct >= 95 ? 'good' : freshPct >= 60 ? 'warn' : 'critical'}
            sub={`${result.freshlyChecked}/${result.total} tin`}
            hint="Tỷ lệ tin vừa được gọi HTTP/API vào tận nơi để xác nhận còn tuyển"
          />
          {/* CỐ Ý không gọi đây là "độ chính xác". Độ chính xác là tỷ lệ tin
              nhận vào mà ĐÚNG thật, và nó chỉ đo được bằng cách mở tay từng
              tin. Con số này chỉ nói từ điển lọc chặt tới đâu. */}
          <Stat
            label="lọt qua từ điển"
            value={`${selectivity}%`}
            sub={`${result.total}/${result.scanned} tin đã chấm`}
            hint="Tỷ lệ tin trong phạm vi tỉnh/thành được từ điển nhận. Không phải độ chính xác — thứ đó phải soi tay mới biết."
          />
        </StatRow>

        {/* Chữ xám, KHÔNG phải chip bấm được: ba mục đầu là định nghĩa của
            chính ngành (lưu trong SavedFilter), đổi bằng SQL chứ không bằng
            giao diện. Cho chúng hình dạng của một nút là mời người ta bấm vào
            một thứ không bấm được. */}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-muted">
          <span className="text-faint">Đang xét:</span>
          <span>chỉ tin còn sống</span>
          {result.provinceNames.map((province) => (
            <span key={province}>· {province}</span>
          ))}
          {result.maxAgeDays && <span>· đăng trong {result.maxAgeDays} ngày</span>}
          {!includeWeak && (
            <span title="Đang ẩn tin chỉ có từ khoá ở phần mô tả. Bật “Kể cả tin khớp yếu” ở bảng lọc để xem.">
              · chỉ tin khớp chắc
            </span>
          )}
          {strictHcm && result.droppedByNarrowHcm > 0 && (
            <span>· đã bỏ {result.droppedByNarrowHcm} tin ngoài HCM cũ</span>
          )}
        </p>

        {/* ── Hai cột ────────────────────────────────────────────────────── */}
        <div className="grid items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
          {/* `sticky` + `max-h` + `overflow-auto`: bảng lọc dài hơn màn hình
              nên phải tự cuộn được, nếu không thì nút "Áp bộ lọc" ở đáy bị đẩy
              ra khỏi tầm nhìn và không cách nào bấm tới. */}
          <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <FieldFilterPanel result={result} params={params} fields={fields} />
          </div>

          <div className="min-w-0 space-y-3">
            <FieldActiveFilters pathname={PATH} params={params} result={result} />

            <div className="flex items-baseline justify-between gap-3 px-1">
              <h2 className="text-sm font-semibold tracking-tight">
                {formatCount(result.total)} việc làm
              </h2>
              <p className="text-xs text-muted">Tin khớp chắc lên trước, rồi tới tin mới đăng</p>
            </div>

            <FieldRelaxHints result={result} params={params} pathname={PATH} />

            {result.items.length === 0 ? (
              <Empty title="Không tin nào khớp">
                {result.scanned === 0 ? (
                  <>
                    Kho chưa có tin nào trong phạm vi này. Chạy{' '}
                    <Cmd>npm run crawl -- --source vnw --full --limit 800</Cmd>.
                  </>
                ) : (
                  <>
                    Nới một chiều ở bảng lọc bên trái, hoặc bấm “Xoá hết”. Nếu nghi từ điển loại
                    oan thì soi bằng <Cmd>npm run match -- --show reject</Cmd>.
                  </>
                )}
              </Empty>
            ) : (
              <div className="grid gap-3">
                {result.items.map((row) => (
                  <FieldJobCard key={row.job.id} row={row} />
                ))}
              </div>
            )}

            <Pagination
              pathname={PATH}
              params={params}
              page={result.page}
              pageCount={result.pageCount}
            />
          </div>
        </div>

        {/* ── Thống kê ───────────────────────────────────────────────────── */}
        {result.total > 0 && (
          <section className="space-y-3 border-t border-border pt-5">
            <div className="px-1">
              <h2 className="text-sm font-semibold tracking-tight">Thống kê ngành</h2>
              <p className="mt-0.5 text-xs text-muted">
                Tính trên {formatCount(result.total)} tin đang xem — đổi bộ lọc thì mọi con số dưới
                đây đổi theo. Bấm một dòng bất kỳ để lọc luôn theo dòng đó.
              </p>
            </div>
            <FieldStats result={result} params={params} pathname={PATH} />
          </section>
        )}
      </div>
    </>
  );
}
