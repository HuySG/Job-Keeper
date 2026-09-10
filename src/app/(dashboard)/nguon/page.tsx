import { getParseHealth, getRecentRuns, getReparseCoverage, getSourceHealth } from '@/api/ops.api';
import { getOverview } from '@/api/stats.api';
import { Meter } from '@/components/charts/meter';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardFoot, CardHead } from '@/components/ui/card';
import { Cmd, Empty } from '@/components/ui/empty';
import { PageHeader } from '@/components/ui/page-header';
import { Stat, StatRow } from '@/components/ui/stat';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { cx } from '@/components/ui/tone';
import { questionFor } from '@/constants/nav';
import {
  formatCount,
  formatDateTime,
  formatDuration,
  formatPercent,
  freshnessMeta,
  runStatusMeta,
  timeAgo,
} from '@/utils/format';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Nguồn & vận hành' };

/**
 * Trang vận hành — trả lời **"crawler còn sống không, nguồn nào đang hỏng"**.
 *
 * Một trang việc làm bình thường không có màn hình này. Một công cụ cá nhân
 * thì bắt buộc: không ai khác theo dõi hộ, nên nếu crawler chết âm thầm thì
 * mọi con số ở ba trang kia vẫn hiện ra bình thường và vẫn sai.
 *
 * Ba thứ cần nhìn thấy, xếp theo mức độ khó phát hiện nếu không nhìn:
 *
 *   1. Nguồn nào TẮT và vì sao      — dễ quên nhất, vì nó im lặng
 *   2. Bóc tách hỏng ở đâu          — sàn đổi bố cục thì lương lặng lẽ biến mất
 *   3. Còn tính lại được không      — mất blob thô là mất khả năng sửa quá khứ
 */
export default async function OpsPage() {
  const [sources, runs, parse, reparse, overview] = await Promise.all([
    getSourceHealth(),
    getRecentRuns(8),
    getParseHealth(),
    getReparseCoverage(),
    getOverview(),
  ]);

  const question = questionFor('/nguon');
  const parsed = parse.ok + parse.partial + parse.failed;
  const freshness = freshnessMeta(overview.lastCrawledAt);

  return (
    <>
      <PageHeader
        title="Nguồn & vận hành"
        description={question}
        actions={
          <Badge tone={freshness.tone} hint={freshness.hint}>
            Thu thập {timeAgo(overview.lastCrawledAt)}
          </Badge>
        }
      />

      <div className="space-y-4">
        <StatRow>
          <Stat
            label="Sàn đang bật"
            value={
              <>
                {overview.activeSources}
                <span className="text-lg text-muted">/{sources.length}</span>
              </>
            }
            sub="nguồn là DỮ LIỆU, bật tắt bằng SQL"
          />
          <Stat
            label="Tin đã thu"
            value={formatCount(reparse.total)}
            sub={formatCount(overview.alive) + ' còn hiệu lực'}
          />
          <Stat
            label="Bóc tách thiếu trường"
            value={formatPercent(parse.partial + parse.failed, parsed)}
            tone={parse.failed > 0 ? 'warn' : undefined}
            sub={formatCount(parse.partial) + ' thiếu · ' + formatCount(parse.failed) + ' hỏng'}
          />
          <Stat
            label="Giữ được bản thô"
            value={formatPercent(reparse.withBlob, reparse.total)}
            tone={reparse.withBlob < reparse.total ? 'warn' : undefined}
            sub="tính lại được mà không cào lại nguồn"
          />
        </StatRow>

        {/* ── Từng nguồn ────────────────────────────────────────────────────── */}
        <Card>
          <CardHead
            title="Từng nguồn"
            subtitle="Đi từ bảng Source rồi mới đếm sang tin đăng — nhờ vậy nguồn CHƯA CÓ TIN NÀO vẫn hiện ra, mà đó thường là nguồn đáng lo nhất."
          />
          <CardBody className="p-0">
            <Table caption="Tình trạng từng nguồn thu thập">
              <thead>
                <tr>
                  <Th>Nguồn</Th>
                  <Th>Cách lấy</Th>
                  <Th numeric>Còn hiệu lực</Th>
                  <Th numeric>Đã thu</Th>
                  <Th numeric>Ghi lương</Th>
                  <Th numeric>Bóc hỏng</Th>
                  <Th>Còn thấy tin</Th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <Tr key={source.code}>
                    <Td>
                      <span className="flex items-center gap-2">
                        <a
                          href={'/viec?source=' + source.code}
                          className={cx(
                            'font-medium hover:text-accent-ink hover:underline',
                            !source.isActive && 'text-muted',
                          )}
                        >
                          {source.name}
                        </a>
                        {!source.isActive && (
                          <Badge
                            tone="neutral"
                            hint={source.note ?? 'Nguồn đang tắt trong bảng Source'}
                          >
                            tắt
                          </Badge>
                        )}
                      </span>
                      <span className="mt-0.5 block font-mono text-xs text-faint">
                        {source.code}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-xs text-muted">{source.kind}</span>
                    </Td>
                    <Td numeric>{formatCount(source.alive)}</Td>
                    <Td numeric>
                      <span className="text-muted">{formatCount(source.total)}</span>
                    </Td>
                    <Td numeric>{formatPercent(source.withSalary, source.alive)}</Td>
                    <Td numeric>
                      <span className={source.failed > 0 ? 'font-medium text-warn-ink' : undefined}>
                        {formatCount(source.failed)}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-xs text-muted">{timeAgo(source.lastSeenAt)}</span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
          <CardFoot>
            Nguồn tắt vẫn giữ nguyên tin đã thu. Bật lại bằng SQL trên bảng <Cmd>Source</Cmd>, không
            phải sửa code — thêm một sàn lý tưởng là INSERT một dòng.
          </CardFoot>
        </Card>

        {/* ── Khả năng tính lại ─────────────────────────────────────────────── */}
        <Card>
          <CardHead
            title="Khả năng tính lại lịch sử"
            subtitle="Tỷ lệ tin còn giữ blob thô để sửa parser rồi tính lại toàn bộ, mà không phải cào lại nguồn."
          />
          <CardBody>
            <Meter
              value={reparse.withBlob}
              max={reparse.total}
              label="Tin còn bản thô để reparse"
              caption={
                formatCount(reparse.total - reparse.withBlob) +
                ' tin đã mất bản thô. Với những tin đó, một lỗi parser phát hiện về sau là không sửa lại được nữa.'
              }
            />
            <p className="mt-3 text-xs text-muted">
              Tính lại bằng <Cmd>npm run reparse</Cmd>. Đây là siêu năng lực quan trọng nhất khi có
              nhiều nguồn — và nó mất đi trong im lặng nếu không ai nhìn con số này.
            </p>
          </CardBody>
        </Card>

        {/* ── Nhật ký chạy ──────────────────────────────────────────────────── */}
        <Card>
          <CardHead
            title="Nhật ký thu thập"
            subtitle="Tám lần chạy gần nhất. Mở từng dòng để xem kết quả tách theo từng nguồn — một nguồn hỏng không được làm mờ bức tranh của các nguồn còn lại."
          />
          <CardBody className={runs.length === 0 ? undefined : 'space-y-2 p-3'}>
            {runs.length === 0 ? (
              <Empty compact title="Chưa có lần chạy nào được ghi nhật ký">
                Chạy <Cmd>npm run crawl</Cmd> để bắt đầu ghi.
              </Empty>
            ) : (
              runs.map((run) => {
                const status = runStatusMeta(run.status);
                return (
                  <details key={run.id} className="rounded-lg border border-border">
                    <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-sm">
                      <Badge tone={status.tone} hint={status.hint}>
                        {status.label}
                      </Badge>
                      <span className="tnum text-muted">{formatDateTime(run.startedAt)}</span>
                      <span className="text-xs text-muted">
                        {run.trigger} · {formatDuration(run.startedAt, run.finishedAt)}
                      </span>
                      <span className="tnum ml-auto text-xs text-muted">
                        <strong className="font-medium text-text">
                          {formatCount(run.postingsNew)}
                        </strong>{' '}
                        mới
                        <span className="mx-1.5 opacity-40">·</span>
                        {formatCount(run.postingsUpdated)} sửa
                        {run.postingsFailed > 0 && (
                          <>
                            <span className="mx-1.5 opacity-40">·</span>
                            <span className="text-warn-ink">
                              {formatCount(run.postingsFailed)} lỗi
                            </span>
                          </>
                        )}
                      </span>
                    </summary>

                    <div className="border-t border-border px-3 py-2.5">
                      {run.errorLog && (
                        <p className="mb-2 rounded-md bg-critical-soft px-2.5 py-2 font-mono text-xs text-critical-ink">
                          {run.errorLog}
                        </p>
                      )}

                      {run.sources.length === 0 ? (
                        <p className="text-xs text-muted">Lần chạy này không ghi chi tiết nguồn.</p>
                      ) : (
                        <ul className="space-y-1 text-xs">
                          {run.sources.map((entry) => {
                            const meta = runStatusMeta(entry.status);
                            return (
                              <li key={entry.id} className="flex flex-wrap items-center gap-x-3">
                                <Badge tone={meta.tone} hint={meta.hint}>
                                  {meta.label}
                                </Badge>
                                <span className="font-medium">{entry.source.name}</span>
                                <span className="tnum text-muted">
                                  {formatCount(entry.urlsDiscovered)} URL tìm thấy ·{' '}
                                  {formatCount(entry.pagesFetched)} trang tải ·{' '}
                                  {formatCount(entry.postingsNew)} mới ·{' '}
                                  {formatCount(entry.postingsUpdated)} sửa
                                </span>
                                {entry.errorLog && (
                                  <span className="w-full font-mono text-critical-ink">
                                    {entry.errorLog}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </details>
                );
              })
            )}
          </CardBody>
          <CardFoot>
            Không có nhật ký thì không biết crawler chết lúc nào — và mọi con số ở ba trang kia vẫn
            sẽ hiện ra bình thường trong khi đã sai.
          </CardFoot>
        </Card>
      </div>
    </>
  );
}
