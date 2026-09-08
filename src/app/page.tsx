import { getRecentJobs } from '@/api/job.api';
import { getParseHealth, getRecentRuns, getReparseCoverage } from '@/api/ops.api';
import {
  getDailyIntake,
  getLevelSpread,
  getOverview,
  getSalaryByLevel,
  getTopProvinces,
} from '@/api/stats.api';
import { BarList } from '@/components/charts/bar-list';
import { ColumnChart } from '@/components/charts/column-chart';
import { CompositionBar } from '@/components/charts/composition-bar';
import { RangeBar, THIN_SAMPLE } from '@/components/charts/range-bar';
import { JobRow } from '@/components/job/job-row';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardFoot, CardHead } from '@/components/ui/card';
import { Cmd, Empty } from '@/components/ui/empty';
import { PageHeader } from '@/components/ui/page-header';
import { HeroStat, Stat, StatRow } from '@/components/ui/stat';
import { questionFor } from '@/constants/nav';
import { LEVEL_ORDER } from '@/enums';
import {
  formatCount,
  formatDateTime,
  formatPercent,
  freshnessMeta,
  jobStatusMeta,
  levelLabel,
  millions,
  runStatusMeta,
  timeAgo,
} from '@/utils/format';

/** Luôn đọc CSDL mới, đừng phục vụ bản dựng sẵn từ lúc build. */
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Tổng quan' };

/**
 * Trang tổng quan — trả lời **"kho tin đang có gì, và có đáng tin không"**.
 *
 * Thứ tự các khối là thứ tự câu hỏi, không phải thứ tự "cái nào đẹp thì lên
 * trước":
 *
 *   1. Kho có bao nhiêu tin còn sống, và bao nhiêu đã chết  -> tin được không
 *   2. Dòng tin mới có đều không                            -> crawler còn sống không
 *   3. Lương, nơi tuyển                                     -> thị trường nói gì
 *   4. Tin mới nhất, sức khoẻ máy móc                       -> bằng chứng
 *
 * Khối 1 phải đứng trước mọi biểu đồ. Một biểu đồ lương rất đẹp dựng trên một
 * kho tin đã chết ba tuần là thứ tệ hơn không có biểu đồ nào, vì nó trông
 * đáng tin.
 */
export default async function OverviewPage() {
  const [overview, intake, salaryByLevel, provinces, levels, recent, runs, parse, reparse] =
    await Promise.all([
      getOverview(),
      getDailyIntake(30),
      getSalaryByLevel(),
      getTopProvinces(6),
      getLevelSpread(),
      getRecentJobs(7),
      getRecentRuns(1),
      getParseHealth(),
      getReparseCoverage(),
    ]);

  const question = questionFor('/');
  const freshness = freshnessMeta(overview.lastCrawledAt);
  const dead = (overview.byStatus['EXPIRED'] ?? 0) + (overview.byStatus['CLOSED'] ?? 0);
  const total = overview.alive + dead;

  // So với 7 ngày liền trước. Một con số "77 tin tuần này" không nói được gì
  // cho tới khi biết tuần trước là 25.
  const delta = overview.postedLast7 - overview.postedPrev7;

  const bands = salaryByLevel
    .map((band) => ({ ...band, label: levelLabel(band.key) }))
    .sort((a, b) => LEVEL_ORDER.indexOf(a.key as never) - LEVEL_ORDER.indexOf(b.key as never));

  const salaryFloor = 0;
  const salaryCeil = Math.max(20_000_000, ...bands.map((band) => band.p75));
  const lastRun = runs[0];

  return (
    <>
      <PageHeader title="Tổng quan" description={question} />

      {total === 0 ? (
        <Empty title="Kho chưa có tin nào">
          Chạy <Cmd>npm run crawl -- --source vnw --full</Cmd> để lấy tin về. Mọi con số trên bảng
          điều khiển đều tính từ CSDL, nên trước khi crawler chạy lần đầu thì ở đây không có gì
          để nói.
        </Empty>
      ) : (
        <div className="space-y-4">
          {/* ── 1. Kho có gì, và có đáng tin không ─────────────────────────── */}
          <Card>
            <CardBody className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-10">
              <HeroStat
                label="Tin còn hiệu lực"
                value={formatCount(overview.alive)}
                unit={'/ ' + formatCount(total) + ' tin đã thu'}
                sub={
                  <>
                    từ {overview.activeSources} sàn · {formatCount(overview.companies)} công ty
                  </>
                }
                aside={
                  <div className="space-y-1.5">
                    <Badge tone={freshness.tone} hint={freshness.hint}>
                      {freshness.label}
                    </Badge>
                    <p className="text-xs text-muted">thu thập {timeAgo(overview.lastCrawledAt)}</p>
                  </div>
                }
              />

              <div>
                <p className="mb-2.5 text-xs text-muted">
                  Cơ cấu theo trạng thái — tin chết được GIỮ LẠI để đối chiếu, chỉ không đếm vào
                  con số bên trái.
                </p>
                <CompositionBar
                  segments={['OPEN', 'STALE', 'EXPIRED', 'CLOSED'].map((status) => {
                    const meta = jobStatusMeta(status);
                    return {
                      key: status,
                      label: meta.label,
                      value: overview.byStatus[status] ?? 0,
                      tone: meta.tone,
                      hint: meta.hint,
                    };
                  })}
                />
              </div>
            </CardBody>
          </Card>

          <StatRow>
            <Stat
              label="Tin đăng trong 7 ngày"
              value={formatCount(overview.postedLast7)}
              sub={
                overview.postedPrev7 === 0 ? (
                  'chưa có kỳ trước để so'
                ) : (
                  <>
                    {delta >= 0 ? '+' : '−'}
                    {formatCount(Math.abs(delta))} so với 7 ngày trước đó
                  </>
                )
              }
            />
            <Stat
              label="Đăng hôm nay"
              value={formatCount(overview.postedToday)}
              sub="tính theo giờ Việt Nam"
            />
            <Stat
              label="Tin dám ghi lương"
              value={formatPercent(overview.withSalary, overview.alive)}
              sub={formatCount(overview.withSalary) + ' tin có số cụ thể'}
              href="/luong"
              hint="Tỷ lệ tin ghi số thay vì Thoả thuận — không sàn nào công bố con số này"
            />
            <Stat
              label="Giữ được bản thô"
              value={formatPercent(reparse.withBlob, reparse.total)}
              sub="tính lại được mà không cào lại nguồn"
              href="/nguon"
              hint="Tỷ lệ tin còn blob gốc để npm run reparse tính lại toàn bộ lịch sử"
            />
          </StatRow>

          {/* ── 2. Dòng tin mới có đều không ───────────────────────────────── */}
          <Card>
            <CardHead
              title="Nhịp tin đăng · 30 ngày qua"
              subtitle="Theo ngày ĐĂNG trên sàn nguồn, không phải ngày ta thu về. Cột 0 nghĩa là hôm đó không sàn nào đăng tin mới lọt vào kho."
            />
            <CardBody>
              <ColumnChart
                data={intake.map((row, index) => ({
                  key: row.day,
                  label: row.day.slice(8) + '/' + row.day.slice(5, 7),
                  value: row.count,
                  title: row.day + ': ' + formatCount(row.count) + ' tin',
                  highlight: index === intake.length - 1,
                }))}
                labelEvery={5}
                height={150}
              />
            </CardBody>
          </Card>

          {/* ── 3. Thị trường nói gì ───────────────────────────────────────── */}
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card>
              <CardHead
                title="Lương theo cấp bậc"
                subtitle={
                  'Tính trên ' +
                  formatCount(overview.withSalary) +
                  ' tin có ghi số / ' +
                  formatCount(overview.alive) +
                  ' tin còn hiệu lực'
                }
                action={
                  <a href="/luong" className="text-accent-ink hover:underline">
                    Xem đầy đủ →
                  </a>
                }
              />
              <CardBody>
                {bands.length === 0 ? (
                  <Empty compact title="Chưa đủ tin ghi lương để tính phân vị" />
                ) : (
                  <RangeBar data={bands} floor={salaryFloor} ceil={salaryCeil} />
                )}
              </CardBody>
              {bands.some((band) => band.sample < THIN_SAMPLE) && (
                <CardFoot>
                  Nhóm có n dưới {THIN_SAMPLE} được vẽ nhạt hơn: mẫu đó quá mỏng để đọc thành kết
                  luận, nhưng giấu đi thì lại thành "nhóm này không có dữ liệu".
                </CardFoot>
              )}
            </Card>

            <div className="grid gap-4">
              <Card>
                <CardHead
                  title="Nơi tuyển nhiều nhất"
                  subtitle="Chỉ đếm tin còn hiệu lực. Một tin ghi nhiều nơi thì được tính ở từng nơi."
                />
                <CardBody>
                  <BarList
                    data={provinces.map((province) => ({
                      key: province.key,
                      label: province.name,
                      value: province.count,
                      note: formatPercent(province.withSalary, province.count) + ' ghi lương',
                      href: '/viec?province=' + province.key,
                    }))}
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHead
                  title="Cấp bậc"
                  subtitle="Đứng cạnh biểu đồ lương để đối chiếu: nhóm đông chưa chắc là nhóm chịu ghi lương."
                />
                <CardBody>
                  <BarList
                    data={levels.map((level) => ({
                      key: level.key,
                      label: levelLabel(level.key === 'UNKNOWN' ? null : level.key),
                      value: level.count,
                      note: formatPercent(level.withSalary, level.count) + ' ghi lương',
                      href:
                        level.key === 'UNKNOWN' ? undefined : '/viec?level=' + level.key,
                    }))}
                  />
                </CardBody>
              </Card>
            </div>
          </div>

          {/* ── 4. Bằng chứng ──────────────────────────────────────────────── */}
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card>
              <CardHead
                title="Tin mới nhất"
                action={
                  <a href="/viec" className="text-accent-ink hover:underline">
                    Mở kho tin →
                  </a>
                }
              />
              <CardBody className="p-2">
                {recent.length === 0 ? (
                  <Empty compact title="Chưa có tin nào còn hiệu lực" />
                ) : (
                  <ul className="divide-y divide-border">
                    {recent.map((job) => (
                      <JobRow key={job.id} job={job} />
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHead
                title="Sức khoẻ thu thập"
                subtitle="Kho tin chỉ đáng tin bằng đúng lần chạy gần nhất của crawler."
                action={
                  <a href="/nguon" className="text-accent-ink hover:underline">
                    Chi tiết →
                  </a>
                }
              />
              <CardBody className="space-y-3 text-sm">
                {lastRun ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted">Lần chạy gần nhất</span>
                      <span className="flex items-center gap-2">
                        <span className="tnum text-xs text-muted">
                          {formatDateTime(lastRun.startedAt)}
                        </span>
                        <Badge
                          tone={runStatusMeta(lastRun.status).tone}
                          hint={runStatusMeta(lastRun.status).hint}
                        >
                          {runStatusMeta(lastRun.status).label}
                        </Badge>
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border pt-3 text-sm sm:grid-cols-4">
                      <RunStat label="Tin mới" value={lastRun.postingsNew} />
                      <RunStat label="Tin sửa" value={lastRun.postingsUpdated} />
                      <RunStat label="Lỗi bóc tách" value={lastRun.postingsFailed} warn />
                      <RunStat label="Trang đã tải" value={lastRun.pagesFetched} />
                    </dl>
                  </>
                ) : (
                  <Empty compact title="Chưa có lần chạy nào được ghi nhật ký" />
                )}

                <div className="border-t border-border pt-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-muted">Bóc tách thiếu trường</span>
                    <span className="tnum">
                      {formatCount(parse.partial + parse.failed)} tin
                      <span className="ml-1.5 text-muted">
                        ({formatPercent(parse.partial + parse.failed, parse.ok + parse.partial + parse.failed)})
                      </span>
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Tỷ lệ này trôi lên là dấu hiệu một sàn vừa đổi bố cục — cần biết TRƯỚC khi các
                    biểu đồ lương bắt đầu nói sai.
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>

          <p className="text-xs text-muted">
            Mọi con số trên trang này tính trên tin còn hiệu lực tại thời điểm mở trang. Lương lấy
            trung điểm khoảng khi tin ghi cả hai đầu; tin "Thoả thuận" không vào mẫu. Trục lương
            hiện chạy tới {millions(salaryCeil)} triệu.
          </p>
        </div>
      )}
    </>
  );
}

function RunStat({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={
          warn && value > 0 ? 'tnum mt-0.5 font-medium text-warn-ink' : 'tnum mt-0.5 font-medium'
        }
      >
        {formatCount(value)}
      </dd>
    </div>
  );
}
