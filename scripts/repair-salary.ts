import { db } from '@/api/db';
import { replaceSalaryProblem, salaryFromRaw } from '@/crawler/normalize/salary';
import { CrawlTrigger, ParseStatus, RunStatus } from '@/enums';

import { loadEnv, parseArgs } from './_env';

/**
 * Tính lại LƯƠNG cho tin KHÔNG có blob, từ `salaryRaw` đã lưu. 0 request mạng.
 *
 *   npm run repair:salary                  chạy khô: in ra tin nào sẽ đổi
 *   npm run repair:salary -- --apply       ghi thật, kèm JobAudit cho từng tin
 *   npm run repair:salary -- --ws swe
 *
 * Mặc định CHẠY KHÔ — ngược với `reparse`/`crawl` (`--dry` mới là khô). Cố ý:
 * đây là lệnh sửa dữ liệu hàng loạt, chạy nhầm thì phải là vô hại.
 *
 * Vì sao cần: `npm run reparse` tính lại từ blob thô, nhưng tin cào trên CI khi
 * chưa khai R2 không có blob. Đo 17/09/2026 trong CSDL bae: 172 tin USD cào
 * trên CI mang `fxRate = 0` (Variable `USD_VND_RATE` chưa khai → chuỗi rỗng →
 * tỷ giá 0), lương 0 đồng, 151 tin còn sống nằm trong trung vị. Với chúng,
 * `salaryRaw` là bằng chứng duy nhất còn lại — xem `salaryFromRaw`.
 *
 * Tin CÓ blob thì dùng `npm run reparse`: blob còn cả chuỗi lương dự phòng của
 * adapter, thứ `salaryRaw` không giữ.
 *
 * Mỗi tin đổi được ghi một dòng `JobAudit` (field "salary", reason
 * "manual_fix") — không có dòng đó thì số cũ biến mất mà không ai đối chiếu
 * được. KHÔNG đụng `contentHash`: lượt cào sau tính ra đúng số này, thấy lương
 * không đổi, nên không sinh nhầm một dòng "source_edited".
 */
async function main(): Promise<void> {
  const ws = loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const apply = args.boolean('apply');

  console.log(apply ? 'GHI THẬT — kèm JobAudit.\n' : 'CHẠY KHÔ — thêm --apply để ghi.\n');

  const postings = await db.jobPosting.findMany({
    where: { rawKey: null, salaryRaw: { not: null } },
    select: {
      id: true,
      externalId: true,
      status: true,
      salaryRaw: true,
      salaryMin: true,
      salaryMax: true,
      salaryCurrency: true,
      salaryPeriod: true,
      salaryIsPublic: true,
      fxRate: true,
      parseStatus: true,
      parseError: true,
      source: { select: { code: true } },
    },
    orderBy: { id: 'asc' },
  });

  const stats = { scanned: postings.length, changed: 0, unreadable: 0, nowPublic: 0, nowHidden: 0, failed: 0 };
  const run = apply ? await db.crawlRun.create({ data: { trigger: CrawlTrigger.REPARSE } }) : null;

  for (const posting of postings) {
    const salary = salaryFromRaw(posting.salaryRaw);
    if (!salary) {
      stats.unreadable += 1;
      continue;
    }

    const parseError = replaceSalaryProblem(posting.parseError, salary);
    const next = {
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      salaryPeriod: salary.period,
      salaryIsPublic: salary.isPublic,
      fxRate: salary.fxRate,
      parseError,
      // normalize chỉ sinh OK hoặc PARTIAL; FAILED thì để nguyên.
      parseStatus:
        posting.parseStatus === ParseStatus.FAILED
          ? posting.parseStatus
          : parseError
            ? ParseStatus.PARTIAL
            : ParseStatus.OK,
    };

    const same =
      posting.salaryMin === next.salaryMin &&
      posting.salaryMax === next.salaryMax &&
      posting.salaryCurrency === next.salaryCurrency &&
      posting.salaryPeriod === next.salaryPeriod &&
      posting.salaryIsPublic === next.salaryIsPublic &&
      posting.fxRate === next.fxRate &&
      posting.parseError === next.parseError &&
      posting.parseStatus === next.parseStatus;
    if (same) continue;

    stats.changed += 1;
    if (!posting.salaryIsPublic && salary.isPublic) stats.nowPublic += 1;
    if (posting.salaryIsPublic && !salary.isPublic) stats.nowHidden += 1;

    const before = describe(posting);
    const after = describe(next);
    if (stats.changed <= 15 || !apply) {
      console.log(`  ${posting.source.code}/${posting.externalId} [${posting.status}]  ${before}  →  ${after}`);
    }

    if (!apply) continue;
    try {
      await db.$transaction([
        db.jobPosting.update({
          where: { id: posting.id },
          data: { ...next, fxRateDate: salary.fxRateDate },
        }),
        db.jobAudit.create({
          data: {
            postingId: posting.id,
            field: 'salary',
            oldValue: before,
            newValue: after,
            reason: 'manual_fix',
          },
        }),
      ]);
    } catch (err) {
      stats.failed += 1;
      console.error(`  ✗ ${posting.source.code}/${posting.externalId}: ${(err as Error).message}`);
    }
  }

  if (run) {
    await db.crawlRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: stats.failed > 0 ? RunStatus.PARTIAL : RunStatus.SUCCESS,
        postingsUpdated: stats.changed - stats.failed,
        postingsFailed: stats.failed,
      },
    });
  }

  console.log(
    `\nWORKSPACE ${ws} · ${stats.scanned} tin không có blob · ${stats.changed} ${apply ? 'đã sửa' : 'sẽ sửa'}` +
      ` (${stats.nowPublic} thành công khai, ${stats.nowHidden} thành ẩn) · ` +
      `${stats.unreadable} không đọc lại được (salaryRaw bị cắt) · ${stats.failed} lỗi`,
  );
}

function describe(s: {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryIsPublic: boolean;
  fxRate: number | null;
}): string {
  if (!s.salaryIsPublic) return `ẩn (${s.salaryCurrency})`;
  const fx = s.fxRate !== null ? ` @${s.fxRate}` : '';
  return `${s.salaryMin}-${s.salaryMax} ${s.salaryCurrency}${fx}`;
}

main()
  .catch((err) => {
    console.error('Sửa lương hỏng:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect().catch(() => undefined);
  });
