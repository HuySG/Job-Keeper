import { FRESH_CHECK_HOURS, findFieldJobs, listFields } from '@/api/field.api';
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
 * Đây là trang khác hẳn "Kho tin" ở một điểm: kho tin lọc bằng những gì gõ
 * được thành SQL, còn trang này lọc bằng một TỪ ĐIỂN có luật ưu tiên. Nhờ vậy
 * gõ "thu mua" không chỉ ra đúng chữ "thu mua" mà ra cả "procurement",
 * "merchandiser", "mua sắm" — và KHÔNG ra "kế toán mua hàng".
 *
 * Hai con số ở đầu trang là hai câu hỏi phải trả lời được mọi lúc:
 *   - bao nhiêu tin đúng ngành  -> công cụ có tìm được gì không
 *   - bao nhiêu tin vừa kiểm    -> những tin đó có còn thật không
 * Thiếu con số thứ hai thì đây chỉ là một cái máy tìm kiếm nữa.
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
    findFieldJobs(slug, { page: readNumber(params, 'page'), includeWeak, strictHcm }),
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
              tin. Con số này chỉ nói từ điển lọc chặt tới đâu — hữu ích để
              thấy khi nó bỗng nới ra hoặc siết lại, không hơn. */}
          <Stat
            label="lọt qua từ điển"
            value={`${selectivity}%`}
            sub={`${result.total}/${result.scanned} tin đã chấm`}
            hint="Tỷ lệ tin trong phạm vi tỉnh/thành được từ điển nhận. Không phải độ chính xác — thứ đó phải soi tay mới biết."
          />
          <Stat
            label="từ điển"
            value={`${result.keywordCount} + ${result.excludeCount}`}
            sub="từ nhận + từ loại"
            hint="Sửa bằng SQL trên bảng SavedFilter, không cần deploy"
          />
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
          <Empty title="Chưa có tin nào đúng ngành">
            {result.scanned === 0 ? (
              <>
                Kho chưa có tin nào trong phạm vi này. Chạy{' '}
                <Cmd>npm run crawl -- --source vnw --full --limit 800</Cmd>.
              </>
            ) : (
              <>
                Đã chấm {result.scanned} tin nhưng không tin nào khớp từ điển. Soi bằng{' '}
                <Cmd>npm run match -- --show reject</Cmd> xem có loại oan không.
              </>
            )}
          </Empty>
        ) : (
          <div className="grid gap-3">
            {result.items.map(({ job, match }) => (
              <div key={job.id} className="space-y-1">
                <JobCard job={job} />
                <div className="flex flex-wrap items-center gap-2 pl-1 text-xs text-muted">
                  {match.verdict === 'weak' && (
                    <Badge tone="warn" hint="Từ khoá chỉ xuất hiện trong mô tả, không có ở tiêu đề">
                      cần soi tay
                    </Badge>
                  )}
                  <span>
                    khớp:{' '}
                    {(match.titleHits.length ? match.titleHits : match.descHits)
                      .slice(0, 4)
                      .join(', ')}
                  </span>
                  {job.lastCheckedAt === null && <span>· chưa kiểm còn-sống lần nào</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination pathname={PATH} params={params} page={result.page} pageCount={result.pageCount} />
      </div>
    </>
  );
}
