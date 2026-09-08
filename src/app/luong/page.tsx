import { getSourceHealth } from '@/api/ops.api';
import {
  getOverview,
  getSalaryByLevel,
  getSalaryByProvince,
  getSalaryHistogram,
  getSalaryOverall,
  MIN_BAND_SAMPLE,
} from '@/api/stats.api';
import { BarList } from '@/components/charts/bar-list';
import { ColumnChart } from '@/components/charts/column-chart';
import { Meter } from '@/components/charts/meter';
import { RangeBar, THIN_SAMPLE } from '@/components/charts/range-bar';
import { Card, CardBody, CardFoot, CardHead } from '@/components/ui/card';
import { Cmd, Empty } from '@/components/ui/empty';
import { PageHeader } from '@/components/ui/page-header';
import { HeroStat, Stat, StatRow } from '@/components/ui/stat';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { questionFor } from '@/constants/nav';
import { LEVEL_ORDER } from '@/enums';
import { formatCount, formatPercent, levelLabel, millions } from '@/utils/format';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Lương' };

/**
 * Trang lương — trả lời **"mức nào là phổ biến, và bao nhiêu tin dám ghi số"**.
 *
 * Câu thứ hai mới là thứ đáng giá. Không sàn nào công bố tỷ lệ tin ghi
 * "Thoả thuận", vì nó bất lợi cho khách hàng của họ là nhà tuyển dụng
 * (PLAN.md §1). Ta gom nhiều sàn nên đo được, và tự nó đã là một phát hiện.
 *
 * Mọi con số ở đây đều đi kèm cỡ mẫu. Một trung vị không có n bên cạnh là con
 * số không kiểm chứng được — và với vài chục tin thì nó lệch rất xa.
 */
export default async function SalaryPage() {
  const [overall, byLevel, byProvince, histogram, overview, sources] = await Promise.all([
    getSalaryOverall(),
    getSalaryByLevel(),
    getSalaryByProvince(10),
    getSalaryHistogram(),
    getOverview(),
    getSourceHealth(),
  ]);

  const question = questionFor('/luong');

  if (!overall) {
    return (
      <>
        <PageHeader title="Lương" description={question} />
        <Empty title="Chưa có tin nào ghi số lương">
          Kho hiện có {formatCount(overview.alive)} tin còn hiệu lực nhưng chưa tin nào công khai
          mức lương. Chạy thêm <Cmd>npm run crawl</Cmd> hoặc thu thập từ nguồn khác — mọi con số
          trên trang này đều tính từ tin có ghi số, không suy đoán từ tin Thoả thuận.
        </Empty>
      </>
    );
  }

  const levels = byLevel
    .map((band) => ({ ...band, label: levelLabel(band.key) }))
    .sort((a, b) => LEVEL_ORDER.indexOf(a.key as never) - LEVEL_ORDER.indexOf(b.key as never));

  const provinces = byProvince.map((band) => ({
    ...band,
    label: band.name,
    href: '/viec?province=' + band.key + '&salaryOnly=1',
  }));

  // Một thang cho CẢ hai biểu đồ khoảng. Mỗi biểu đồ tự co theo dữ liệu riêng
  // thì hai hình cạnh nhau không so được với nhau, mà đó đúng là việc người
  // đọc muốn làm khi đặt chúng cạnh nhau.
  const ceil = Math.max(
    20_000_000,
    ...levels.map((band) => band.p75),
    ...provinces.map((band) => band.p75),
  );

  const activeSources = sources.filter((source) => source.alive > 0);

  return (
    <>
      <PageHeader title="Lương" description={question} />

      <div className="space-y-4">
        <Card>
          <CardBody className="grid gap-6 lg:grid-cols-2 lg:gap-10">
            <HeroStat
              label="Trung vị lương, toàn kho"
              value={millions(overall.median)}
              unit="triệu / tháng"
              sub={
                <>
                  nửa số tin nằm trong {millions(overall.p25)}–{millions(overall.p75)} triệu · tính
                  trên {formatCount(overall.sample)} tin có ghi số
                </>
              }
            />

            <div className="self-center">
              <Meter
                value={overall.sample}
                max={overall.total}
                label="Tin dám ghi số thay vì Thoả thuận"
                caption={
                  'Còn lại ' +
                  formatCount(overall.total - overall.sample) +
                  ' tin không cho biết mức lương. Không sàn nào công bố tỷ lệ này.'
                }
              />
            </div>
          </CardBody>
        </Card>

        <StatRow>
          <Stat
            label="Nhóm dưới (p25)"
            value={millions(overall.p25) + ' tr'}
            sub="25% tin trả thấp hơn mức này"
          />
          <Stat
            label="Trung vị (p50)"
            value={millions(overall.median) + ' tr'}
            sub="một nửa trên, một nửa dưới"
          />
          <Stat
            label="Nhóm trên (p75)"
            value={millions(overall.p75) + ' tr'}
            sub="25% tin trả cao hơn mức này"
          />
          <Stat
            label="Cỡ mẫu"
            value={formatCount(overall.sample)}
            sub={'/ ' + formatCount(overall.total) + ' tin còn hiệu lực'}
          />
        </StatRow>

        <Card>
          <CardHead
            title="Phân bố mức lương"
            subtitle={
              'Mỗi cột là một bậc 5 triệu, tính trên ' +
              formatCount(overall.sample) +
              ' tin có ghi số. Bậc cuối gộp tất cả tin từ 60 triệu trở lên.'
            }
          />
          <CardBody>
            <ColumnChart
              height={160}
              data={histogram.map((bucket) => ({
                key: String(bucket.floor),
                label: millions(bucket.floor),
                value: bucket.count,
                title:
                  (bucket.floor >= 60_000_000
                    ? 'từ 60 triệu trở lên'
                    : millions(bucket.floor) +
                      '–' +
                      millions(bucket.floor + 5_000_000) +
                      ' triệu') +
                  ': ' +
                  formatCount(bucket.count) +
                  ' tin',
              }))}
            />
            <p className="mt-2 text-xs text-muted">Trục ngang: triệu đồng / tháng.</p>
          </CardBody>
          <CardFoot>
            Tin ghi khoảng (ví dụ 15–20 triệu) được tính bằng trung điểm; tin chỉ ghi một đầu thì
            lấy đầu đó. Tin Thoả thuận KHÔNG được quy thành 0 — một số 0 lọt vào là mọi trung vị
            đều sai, và sai theo hướng không ai phát hiện được.
          </CardFoot>
        </Card>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Card>
            <CardHead
              title="Theo cấp bậc"
              subtitle={
                'Xếp theo bậc thăng tiến, không theo số tin. Nhóm dưới ' +
                MIN_BAND_SAMPLE +
                ' tin ghi lương không được vẽ — một tin lẻ không phải một phân bố.'
              }
            />
            <CardBody>
              {levels.length === 0 ? (
                <Empty compact title="Chưa nhóm nào đủ tin ghi lương" />
              ) : (
                <RangeBar data={levels} floor={0} ceil={ceil} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHead
              title="Theo tỉnh/thành"
              subtitle={
                'Mười nơi nhiều tin nhất, trong số những nơi có ít nhất ' +
                MIN_BAND_SAMPLE +
                ' tin ghi lương. Cả hai biểu đồ dùng CHUNG một thang để so được với nhau.'
              }
            />
            <CardBody>
              {provinces.length === 0 ? (
                <Empty compact title="Chưa nơi nào đủ tin ghi lương" />
              ) : (
                <RangeBar data={provinces} floor={0} ceil={ceil} />
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHead
            title="Sàn nào dám ghi lương"
            subtitle="Tỷ lệ tin công khai mức lương, tính trên tin còn hiệu lực của từng sàn."
          />
          <CardBody>
            {activeSources.length === 0 ? (
              <Empty compact title="Chưa sàn nào có tin còn hiệu lực" />
            ) : (
              <BarList
                unit="tin có ghi lương"
                data={activeSources.map((source) => ({
                  key: source.code,
                  label: source.name,
                  value: source.withSalary,
                  note:
                    formatPercent(source.withSalary, source.alive) +
                    ' / ' +
                    formatCount(source.alive) +
                    ' tin',
                  href: '/viec?source=' + source.code + '&salaryOnly=1',
                }))}
              />
            )}
          </CardBody>
        </Card>

        {/* Bản song sinh đọc được của hai biểu đồ khoảng bên trên. Giá trị nào
            chỉ nói bằng chiều dài thanh thì ở đây phải đọc được thành chữ. */}
        <Card>
          <CardHead
            title="Bảng số liệu"
            subtitle="Cùng dữ liệu với hai biểu đồ khoảng bên trên, ở dạng đọc được bằng trình đọc màn hình và sao chép được."
          />
          <CardBody className="p-0">
            <Table caption="Phân vị lương theo cấp bậc và theo tỉnh/thành">
              <thead>
                <tr>
                  <Th>Nhóm</Th>
                  <Th numeric>p25</Th>
                  <Th numeric>Trung vị</Th>
                  <Th numeric>p75</Th>
                  <Th numeric>Tin ghi lương</Th>
                  <Th numeric>Tổng tin</Th>
                  <Th numeric>Tỷ lệ ghi</Th>
                </tr>
              </thead>
              <tbody>
                {[...levels, ...provinces].map((band) => (
                  <Tr key={band.key}>
                    <Td>
                      {band.label}
                      {band.sample < THIN_SAMPLE && (
                        <span className="ml-1.5 text-xs text-warn-ink">mẫu mỏng</span>
                      )}
                    </Td>
                    <Td numeric>{millions(band.p25)}</Td>
                    <Td numeric>{millions(band.median)}</Td>
                    <Td numeric>{millions(band.p75)}</Td>
                    <Td numeric>{formatCount(band.sample)}</Td>
                    <Td numeric>{formatCount(band.total)}</Td>
                    <Td numeric>{formatPercent(band.sample, band.total)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
          <CardFoot>Đơn vị: triệu đồng / tháng. Mẫu dưới {THIN_SAMPLE} tin được đánh dấu.</CardFoot>
        </Card>
      </div>
    </>
  );
}
