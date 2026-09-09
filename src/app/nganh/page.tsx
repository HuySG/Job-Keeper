import { FRESH_CHECK_HOURS, findFieldJobs, listFields } from '@/api/field.api';
import { BarList } from '@/components/charts/bar-list';
import { FieldActiveFilters, FieldFilterBar } from '@/components/job/field-filter-bar';
import { FieldJobCard } from '@/components/job/field-job-card';
import { Card, CardBody, CardHead } from '@/components/ui/card';
import { Cmd, Empty } from '@/components/ui/empty';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Stat, StatRow } from '@/components/ui/stat';
import { questionFor } from '@/constants/nav';
import { buildUrl, readFlag, readNumber, readParam, type SearchParams } from '@/lib/query';
import { formatCount } from '@/utils/format';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Ngành của tôi' };

const PATH = '/nganh';
const DEFAULT_FIELD = 'thu-mua-hcm';

/**
 * Ngành của tôi — trả lời **"tin nào đúng nghề tôi nhắm, và có còn tuyển không"**.
 *
 * Khác "Kho tin" ở một điểm: kho tin lọc bằng những gì gõ được thành SQL, còn
 * trang này lọc bằng một TỪ ĐIỂN có luật ưu tiên. Gõ "thu mua" ra cả
 * "procurement", "merchandiser", "mua sắm" — và KHÔNG ra "kế toán mua hàng".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BỐ CỤC — trang này đọc từ trên xuống là một chuỗi câu hỏi thu hẹp dần
 *
 *   1. Chỉ số      "kho có bao nhiêu tin đúng ngành, có tin được không?"
 *   2. Phạm vi     "con số đó đang tính trên tập nào?"      <- cố định, không gỡ được
 *   3. Thanh lọc   "tôi thu hẹp thêm được theo chiều nào?"
 *   4. Đang lọc    "tôi ĐANG thu hẹp bằng những gì?"        <- gỡ được từng cái
 *   5. Chia loại   "ngành này gồm những nghề con nào?"
 *   6. Danh sách   "cụ thể là những tin nào?"
 *
 * Tầng 2 và tầng 4 trước đây bị trộn chung một dải chip, và đó là chỗ khó hiểu
 * nhất của bản cũ: "chỉ tin còn sống" (luật cứng của trang) nằm cạnh "chỉ tin
 * khớp chắc" (lựa chọn của người dùng, gỡ được) mà trông y hệt nhau. Người
 * dùng thử bấm vào cái đầu tiên và không có gì xảy ra. Nay hai tầng tách hẳn:
 * phạm vi là chữ xám không bấm được, bộ lọc là chip xanh có dấu ×.
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
  const maxYears = readNumber(params, 'kn');
  const salaryMin = readNumber(params, 'luong');

  const [result, fields] = await Promise.all([
    findFieldJobs(slug, {
      page: readNumber(params, 'page'),
      includeWeak,
      strictHcm,
      ...(readParam(params, 'loai') ? { purchaseType: readParam(params, 'loai') } : {}),
      ...(readParam(params, 'quan') ? { district: readParam(params, 'quan') } : {}),
      ...(readParam(params, 't7') ? { saturday: readParam(params, 't7') } : {}),
      ...(maxYears !== undefined ? { maxYears } : {}),
      ...(salaryMin !== undefined ? { salaryMin } : {}),
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
  const salaryPct = result.inFieldTotal
    ? Math.round((result.coverage.salary / result.inFieldTotal) * 100)
    : 0;

  const activeType = readParam(params, 'loai');
  const saturdayThin =
    result.inFieldTotal > 0 && result.coverage.saturday / result.inFieldTotal < 0.1;

  return (
    <>
      {/* Ô chọn ngành nằm trong thanh lọc bên dưới, không đặt thêm ở đây: hai
          chỗ cùng đổi một tham số thì người dùng phải đoán xem chỗ nào thắng. */}
      <PageHeader title={result.name} description={questionFor(PATH)} />

      <div className="space-y-4">
        {/* ── 1. Chỉ số ──────────────────────────────────────────────────── */}
        <StatRow>
          <Stat
            label="tin đúng ngành"
            value={formatCount(result.total)}
            sub={`${result.strong} khớp chắc · ${result.weak} cần soi`}
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
          <Stat
            label="có ghi lương"
            value={`${salaryPct}%`}
            sub={`${result.coverage.salary}/${result.inFieldTotal} tin`}
            hint="Phần còn lại ghi 'Thoả thuận'. Bộ lọc lương vẫn GIỮ chúng, vì loại đi là bỏ mất phần lớn thị trường."
          />
        </StatRow>

        {/* ── 2. Phạm vi ─────────────────────────────────────────────────── */}
        {/* Chữ xám, KHÔNG phải chip bấm được: ba mục đầu là định nghĩa của
            chính ngành (lưu trong SavedFilter), đổi bằng SQL chứ không bằng
            giao diện. Cho chúng hình dạng của một nút là mời người ta bấm vào
            một thứ không bấm được.

            "chỉ tin khớp chắc" nằm ở đây dù CÓ công tắc bật lại, vì nếu im
            lặng thì người dùng không biết mình đang không nhìn thấy gì. */}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-muted">
          <span className="text-faint">Đang xét:</span>
          <span>chỉ tin còn sống</span>
          {/* Tên tỉnh, KHÔNG phải slug: "TP. Hồ Chí Minh" chứ không "ho-chi-minh". */}
          {result.provinceNames.map((province) => (
            <span key={province}>· {province}</span>
          ))}
          {result.maxAgeDays && <span>· đăng trong {result.maxAgeDays} ngày</span>}
          {!includeWeak && (
            <span title="Đang ẩn tin chỉ có từ khoá ở phần mô tả. Bật “Kể cả tin khớp yếu” ở thanh lọc để xem.">
              · chỉ tin khớp chắc
            </span>
          )}
          {strictHcm && result.droppedByNarrowHcm > 0 && (
            <span>· đã bỏ {result.droppedByNarrowHcm} tin ngoài HCM cũ</span>
          )}
        </p>

        {/* ── 3. Thanh lọc ───────────────────────────────────────────────── */}
        <FieldFilterBar result={result} params={params} fields={fields} />

        {/* Cảnh báo thật thà, đặt NGAY DƯỚI thanh lọc chứ không phải cuối
            trang: nó nói về một ô lọc, nên phải đọc được trước khi chọn ô đó. */}
        {saturdayThin && (
          <p className="rounded-card border border-warn/40 bg-warn-soft px-3 py-2 text-xs text-warn-ink">
            <strong>Lịch thứ 7 gần như chưa có dữ liệu.</strong> Chỉ {result.coverage.saturday}/
            {result.inFieldTotal} tin nói rõ — phần lớn tin trên VietnamWorks không ghi. Lọc theo
            cột này sẽ bỏ sót gần hết. CareerViet và vieclam24h có khai giờ làm việc, nên con số
            này sẽ khá lên khi kho có thêm tin từ hai nguồn đó.
          </p>
        )}

        {/* ── 4. Đang lọc gì ─────────────────────────────────────────────── */}
        <FieldActiveFilters pathname={PATH} params={params} result={result} />

        {/* ── 5. Ngành này gồm những nghề con nào ────────────────────────── */}
        {/* Bản trước để phần này thành MỘT DÒNG CHỮ NHỎ kiểu "Sản xuất 68 ·
            Dịch vụ 41 · ...". Số có đấy nhưng không so được: đọc xong vẫn phải
            tự trừ trong đầu xem loại nào áp đảo. Thanh ngang trả lời đúng câu
            "cái nào nhiều hơn cái nào" trong một cái liếc, và mỗi dòng là một
            LIÊN KẾT áp thẳng bộ lọc — chỗ đọc số cũng chính là chỗ bấm. */}
        {result.facets.purchaseTypes.length > 1 && (
          <Card>
            <CardHead
              title="Ngành này gồm những loại nào"
              subtitle={`Đếm trên ${result.inFieldTotal} tin thuộc ngành, trước khi áp bộ lọc loại. Bấm một dòng để lọc.`}
            />
            <CardBody>
              <BarList
                data={result.facets.purchaseTypes.map((type) => ({
                  key: type.value,
                  label: type.label,
                  value: type.count,
                  // Bấm lại đúng loại đang lọc thì GỠ lọc — nếu không, dòng
                  // đang sáng trở thành một liên kết không làm gì cả.
                  href: buildUrl(PATH, params, {
                    loai: activeType === type.value ? undefined : type.value,
                  }),
                  highlight: activeType === type.value,
                }))}
              />
            </CardBody>
          </Card>
        )}

        {/* ── 6. Danh sách tin ───────────────────────────────────────────── */}
        {result.items.length === 0 ? (
          <Empty title="Không tin nào khớp">
            {result.scanned === 0 ? (
              <>
                Kho chưa có tin nào trong phạm vi này. Chạy{' '}
                <Cmd>npm run crawl -- --source vnw --full --limit 800</Cmd>.
              </>
            ) : (
              <>
                Thử nới một ô ở thanh lọc phía trên, hoặc bấm “Xoá lọc”. Nếu nghi từ điển loại oan
                thì soi bằng <Cmd>npm run match -- --show reject</Cmd>.
              </>
            )}
          </Empty>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h2 className="text-sm font-semibold tracking-tight">
                {formatCount(result.total)} tin
              </h2>
              <p className="text-xs text-muted">
                Xếp tin khớp chắc lên trước, rồi tới tin mới đăng
              </p>
            </div>

            <div className="grid gap-3">
              {result.items.map((row) => (
                <FieldJobCard key={row.job.id} row={row} />
              ))}
            </div>
          </>
        )}

        <Pagination
          pathname={PATH}
          params={params}
          page={result.page}
          pageCount={result.pageCount}
        />
      </div>
    </>
  );
}
