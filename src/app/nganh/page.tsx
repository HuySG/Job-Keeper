import { FRESH_CHECK_HOURS, findFieldJobs, listFields } from '@/api/field.api';
import { FacetFilter } from '@/components/job/facet-filters';
import { JobCard } from '@/components/job/job-card';
import { Badge, Chip } from '@/components/ui/badge';
import { Cmd, Empty } from '@/components/ui/empty';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { SegmentedLinks } from '@/components/ui/segmented';
import { Stat } from '@/components/ui/stat';
import { questionFor } from '@/constants/nav';
import { readFlag, readNumber, readParam, type SearchParams } from '@/lib/query';
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
 * Thanh lọc ở đây kiêm luôn vai trò BẢNG LIỆT KÊ: mỗi chip mang số tin, nên
 * câu "ngành mua hàng có những loại nào, mỗi loại bao nhiêu" được trả lời ngay
 * tại chỗ chọn, không cần thêm một khối thống kê riêng nói cùng một điều.
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
  const cover = (n: number): string => `${n}/${result.total} tin có`;

  return (
    <>
      <PageHeader
        title={result.name}
        description={questionFor(PATH)}
        actions={
          fields.length > 1 ? (
            <SegmentedLinks
              pathname={PATH}
              params={params}
              name="f"
              current={result.slug}
              options={fields.map((f) => ({ value: f.slug, label: f.name }))}
            />
          ) : null
        }
      />

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="tin đúng ngành"
            value={formatCount(result.total)}
            sub={`${result.strong} chắc · ${result.weak} cần soi`}
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
            value={`${result.total ? Math.round((result.coverage.salary / result.total) * 100) : 0}%`}
            sub={`${result.coverage.salary}/${result.total} tin`}
            hint="Phần còn lại ghi 'Thoả thuận'. Bộ lọc lương vẫn GIỮ chúng, vì loại đi là bỏ mất phần lớn thị trường."
          />
        </div>

        {/* ── Thanh lọc, kiêm bảng liệt kê ─────────────────────────────────── */}
        <div className="space-y-2.5 rounded-card border border-border bg-surface px-4 py-3.5">
          <FacetFilter
            pathname={PATH}
            params={params}
            name="loai"
            label="Loại mua hàng"
            facets={result.facets.purchaseTypes}
            current={readParam(params, 'loai')}
            max={9}
          />
          <FacetFilter
            pathname={PATH}
            params={params}
            name="kn"
            label="Kinh nghiệm"
            facets={result.facets.experience}
            current={readParam(params, 'kn')}
            allLabel="Mọi mức"
            coverage={cover(result.coverage.experience)}
          />
          <FacetFilter
            pathname={PATH}
            params={params}
            name="quan"
            label="Quận / khu"
            facets={result.facets.districts}
            current={readParam(params, 'quan')}
            allLabel="Mọi nơi"
            coverage={cover(result.coverage.district)}
            max={10}
          />
          <FacetFilter
            pathname={PATH}
            params={params}
            name="t7"
            label="Thứ 7"
            facets={result.facets.saturday}
            current={readParam(params, 't7')}
            allLabel="Không xét"
            coverage={cover(result.coverage.saturday)}
          />
          <FacetFilter
            pathname={PATH}
            params={params}
            name="luong"
            label="Lương từ"
            facets={SALARY_STEPS}
            current={readParam(params, 'luong')}
            allLabel="Mọi mức"
          />

          {/* Cảnh báo thật thà: một bộ lọc gần như không có dữ liệu thì phải nói
              ra, chứ không để người dùng bấm vào rồi tự đoán vì sao rỗng. */}
          {result.total > 0 && result.coverage.saturday / result.total < 0.1 && (
            <p className="pt-1 text-xs text-muted">
              ⚠ Chỉ <strong>{result.coverage.saturday}</strong> tin nói rõ lịch thứ 7 — phần lớn tin
              trên VietnamWorks không ghi. Lọc theo cột này sẽ bỏ sót gần hết. Nguồn vieclam24h ghi
              nhiều hơn (khoảng 22%), nên con số này sẽ khá lên khi kho có thêm tin từ đó.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Chip>chỉ tin còn sống</Chip>
            {result.provinces.map((province) => (
              <Chip key={province}>{province}</Chip>
            ))}
            {result.maxAgeDays && <Chip>đăng trong {result.maxAgeDays} ngày</Chip>}
            {strictHcm && result.droppedByNarrowHcm > 0 && (
              <Chip>bỏ {result.droppedByNarrowHcm} tin ngoài HCM cũ</Chip>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SegmentedLinks
              pathname={PATH}
              params={params}
              name="weak"
              label="Độ chắc:"
              current={includeWeak ? '1' : '0'}
              options={[
                { value: '0', label: 'Chỉ chắc chắn' },
                { value: '1', label: 'Kể cả tin yếu' },
              ]}
            />
            {/* Sáp nhập 2025 gộp Bình Dương và Bà Rịa – Vũng Tàu vào TP.HCM.
                Đúng về hành chính, nhưng Thủ Đức và Bến Cát là hai thế giới đi
                lại khác nhau — nên để người dùng tự chọn, đừng quyết hộ. */}
            <SegmentedLinks
              pathname={PATH}
              params={params}
              name="hep"
              label="Phạm vi:"
              current={strictHcm ? '1' : '0'}
              options={[
                { value: '0', label: 'HCM mở rộng' },
                { value: '1', label: 'HCM cũ' },
              ]}
            />
          </div>
        </div>

        {result.items.length === 0 ? (
          <Empty title="Không tin nào khớp">
            {result.scanned === 0 ? (
              <>
                Kho chưa có tin nào trong phạm vi này. Chạy{' '}
                <Cmd>npm run crawl -- --source vnw --full --limit 800</Cmd>.
              </>
            ) : (
              <>
                Thử gỡ bớt một chip ở thanh lọc phía trên. Nếu nghi từ điển loại oan thì soi bằng{' '}
                <Cmd>npm run match -- --show reject</Cmd>.
              </>
            )}
          </Empty>
        ) : (
          <div className="grid gap-3">
            {result.items.map(({ job, match, purchase }) => (
              <div key={job.id} className="space-y-1">
                <JobCard job={job} />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-1 text-xs text-muted">
                  <Badge
                    tone="accent"
                    dot={false}
                    hint={
                      purchase.basis === 'industry'
                        ? `Theo ngành nguồn khai: ${purchase.evidence}`
                        : purchase.basis === 'keyword'
                          ? 'Đoán từ tiêu đề/mô tả — kém chắc hơn'
                          : purchase.hint
                    }
                  >
                    {purchase.label}
                    {purchase.basis === 'keyword' && ' ?'}
                  </Badge>
                  {job.district && <Chip>{job.district}</Chip>}
                  {job.yearsExpMin !== null && <Chip>{job.yearsExpMin}+ năm KN</Chip>}
                  {job.saturdayWork && (
                    <Chip>{SATURDAY_TEXT[job.saturdayWork] ?? job.saturdayWork}</Chip>
                  )}
                  {match.verdict === 'weak' && (
                    <Badge tone="warn" hint="Từ khoá chỉ có trong mô tả, không có ở tiêu đề">
                      cần soi tay
                    </Badge>
                  )}
                  <span>
                    khớp:{' '}
                    {(match.titleHits.length ? match.titleHits : match.descHits)
                      .slice(0, 3)
                      .join(', ')}
                  </span>
                  {job.lastCheckedAt === null && <span>· chưa kiểm còn-sống lần nào</span>}
                </div>
                {job.scheduleRaw && (
                  <p className="pl-1 text-xs text-faint italic">“{job.scheduleRaw}”</p>
                )}
              </div>
            ))}
          </div>
        )}

        <Pagination pathname={PATH} params={params} page={result.page} pageCount={result.pageCount} />
      </div>
    </>
  );
}

/** Mốc lương, tính bằng VND/tháng. Không đếm được trước nên không mang số tin. */
const SALARY_STEPS = [
  { value: '15000000', label: 'từ 15tr', count: 0 },
  { value: '25000000', label: 'từ 25tr', count: 0 },
  { value: '40000000', label: 'từ 40tr', count: 0 },
];

const SATURDAY_TEXT: Record<string, string> = {
  NONE: 'Nghỉ thứ 7',
  HALF_DAY: 'Sáng thứ 7',
  ALTERNATE: 'Thứ 7 luân phiên',
  FULL: 'Làm cả thứ 7',
};
