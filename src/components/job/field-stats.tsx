import type { Facet, FieldPage } from '@/api/field.api';
import { BarList } from '@/components/charts/bar-list';
import { Card, CardBody, CardHead } from '@/components/ui/card';
import { buildUrl, urlToggleValue, readParams, type SearchParams } from '@/lib/query';
import { formatCount, millions } from '@/utils/format';

/**
 * Thống kê của ngành — bốn câu hỏi mà một dòng chỉ số không trả lời nổi.
 *
 *   · Lương ngành này thật ra là bao nhiêu?      -> trung vị + phân bố
 *   · Ngành này đòi bao nhiêu năm kinh nghiệm?   -> phân bố khoảng
 *   · Ai đang tuyển nhiều nhất?                  -> top công ty
 *   · Số liệu này dựa trên nguồn nào?            -> chia theo sàn
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HAI QUY TẮC TỰ ĐẶT CHO CẢ KHỐI NÀY
 *
 * 1. **Luôn ghi mẫu số.** Mọi con số ở đây tính trên tập ĐANG XEM (sau bộ lọc),
 *    không phải trên cả ngành. Trung vị lương của 12 tin ở Quận 7 và trung vị
 *    của 318 tin cả ngành là hai đại lượng khác nhau, mà nhìn thì giống hệt.
 *    Không ghi mẫu số thì người đọc không có cách nào tự phát hiện mình đang
 *    đọc cái nào.
 *
 * 2. **Đọc được thì bấm được.** Mỗi dòng phân bố là một liên kết bật/tắt đúng
 *    ô lọc tương ứng. Chỗ nhìn ra "3–5 năm đang nhiều tin nhất" cũng chính là
 *    chỗ lọc lấy nhóm đó — không bắt người ta nhìn ở đây rồi đi tìm ô tích ở
 *    bảng bên trái.
 * ─────────────────────────────────────────────────────────────────────────────
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
  const { stats } = result;

  // Không còn tin nào thì mọi biểu đồ đều là bốn thanh rỗng — im lặng còn hơn
  // vẽ ra một khối trống để người đọc phải tự hiểu là "không có dữ liệu".
  if (result.total === 0) return null;

  const basis = `trên ${formatCount(result.total)} tin đang xem`;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHead
          title="Lương"
          subtitle={
            stats.salaryMedian === null
              ? `Chưa tin nào trong ${formatCount(result.total)} tin đang xem ghi số`
              : `Trung vị ${millions(stats.salaryMedian)} triệu · tính trên ${stats.salaryCount}/${result.total} tin có ghi số`
          }
        />
        <CardBody>
          <Bars facets={result.facets.salary} name="luong" params={params} pathname={pathname} />
        </CardBody>
      </Card>

      <Card>
        <CardHead
          title="Kinh nghiệm ngành đòi hỏi"
          subtitle={`Theo số năm tối thiểu tin yêu cầu · ${basis}`}
        />
        <CardBody>
          <Bars facets={result.facets.experience} name="kn" params={params} pathname={pathname} />
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Công ty tuyển nhiều nhất" subtitle={basis} />
        <CardBody>
          {stats.topCompanies.length === 0 ? (
            <p className="text-sm text-muted">Chưa có dữ liệu</p>
          ) : (
            <BarList
              data={stats.topCompanies.map((company) => ({
                key: company.value,
                label: company.label,
                value: company.count,
              }))}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHead
          title="Tin đến từ sàn nào"
          subtitle={`${basis} — để biết con số trên đang dựa vào ai`}
        />
        <CardBody>
          <BarList
            data={stats.sources.map((source) => ({
              key: source.value,
              label: source.label,
              value: source.count,
            }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * Phân bố kèm liên kết lọc.
 *
 * Bấm dòng đang sáng thì GỠ lọc chứ không phải áp lại — `urlToggleValue` lo
 * việc đó. Nếu không thì dòng đang chọn là một liên kết không làm gì cả, và
 * người dùng bấm hai lần rồi tưởng trang hỏng.
 */
function Bars({
  facets,
  name,
  params,
  pathname,
}: {
  facets: Facet[];
  name: string;
  params: SearchParams;
  pathname: string;
}) {
  const selected = new Set(readParams(params, name));

  // Ô 0 tin bỏ khỏi BIỂU ĐỒ (thanh dài 0 không nói gì), nhưng vẫn giữ nếu đang
  // được chọn — nó chính là lý do kết quả đang ít, phải nhìn thấy.
  const rows = facets.filter((facet) => facet.count > 0 || selected.has(facet.value));
  if (rows.length === 0) return <p className="text-sm text-muted">Chưa có dữ liệu</p>;

  return (
    <BarList
      data={rows.map((facet) => ({
        key: facet.value,
        label: facet.label,
        value: facet.count,
        href: urlToggleValue(pathname, params, name, facet.value),
        highlight: selected.has(facet.value),
      }))}
    />
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
   * nào cũng vẫn 0, nên danh sách gợi ý rỗng và người dùng không nhận được một
   * lời nào. Đúng cái bẫy mà khối này sinh ra để tránh, nên phải luôn còn một
   * đường thoát: xoá sạch bộ lọc, kèm số tin sẽ nhận lại.
   */
  const noSingleFix = result.relax.length === 0;

  return (
    <div className="rounded-card border border-warn/40 bg-warn-soft p-3">
      <p className="text-sm font-medium text-warn-ink">Bộ lọc đang quá chặt</p>
      <p className="mt-0.5 text-xs text-warn-ink/80">
        {noSingleFix
          ? 'Có ít nhất hai chiều cùng lúc loại hết tin, nên bỏ riêng chiều nào cũng vẫn rỗng.'
          : 'Bỏ bớt một chiều là có lại kết quả — bấm thẳng vào đây:'}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {result.relax.map((hint) => (
          <a
            key={hint.value}
            href={buildUrl(pathname, params, { [KEY[hint.value] ?? hint.value]: undefined })}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs hover:border-border-strong"
          >
            Bỏ lọc <strong className="font-medium">{hint.label}</strong>
            <span className="tnum text-muted">→ {hint.count} tin</span>
          </a>
        ))}

        {/* Luôn có mặt, kể cả khi đã có gợi ý bỏ từng chiều: đôi khi thứ người
            dùng muốn là làm lại từ đầu chứ không phải gỡ từng cái. */}
        <a
          href={`${pathname}?f=${result.slug}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs hover:border-border-strong"
        >
          Xoá hết bộ lọc
          <span className="tnum text-muted">→ {formatCount(result.inFieldTotal)} tin</span>
        </a>
      </div>
    </div>
  );
}
