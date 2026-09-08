import { db } from '@/api/db';
import { CrawlTrigger, ParseStatus, RunStatus } from '@/enums';
import { validateJobPosting } from '@/crawler/jsonld';
import { normalizeJobPosting } from '@/crawler/normalize';
import { vnwRecordToJsonLd } from '@/crawler/sources/vietnamworks';
import { createBlobStore } from '@/crawler/storage/blob';

import { loadEnv, parseArgs } from './_env';

/**
 * Tính lại toàn bộ dữ liệu từ blob thô đã lưu — **KHÔNG gọi mạng một lần nào**.
 *
 *   npm run reparse                        tính lại tất cả
 *   npm run reparse -- --source topcv      chỉ một nguồn
 *   npm run reparse -- --failed            chỉ những tin đang PARTIAL/FAILED
 *   npm run reparse -- --dry               chỉ in ra cái gì sẽ đổi
 *
 * Đây là lệnh quan trọng nhất khi bảo trì. Với sáu nguồn, mỗi lần sửa cách
 * chuẩn hoá lương hay cách suy cấp bậc là ảnh hưởng cả sáu; không có lệnh này
 * thì mỗi lần sửa là một đợt cào lại hàng nghìn trang — vừa chậm, vừa là gánh
 * nặng đặt lên nguồn mà họ không đáng phải chịu vì lỗi của ta.
 *
 * Nó chạy được là nhờ `rawKey`: mỗi tin có bản JSON-LD gốc nằm trên blob store.
 */
async function main(): Promise<void> {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  const sourceCode = args.string('source');
  const onlyFailed = args.boolean('failed');
  const dryRun = args.boolean('dry');

  const blobs = createBlobStore();
  console.log(`Kho blob: ${blobs.driver}${dryRun ? ' · CHẠY KHÔ' : ''}\n`);

  const postings = await db.jobPosting.findMany({
    where: {
      rawKey: { not: null },
      ...(sourceCode ? { source: { code: sourceCode } } : {}),
      ...(onlyFailed ? { parseStatus: { in: [ParseStatus.PARTIAL, ParseStatus.FAILED] } } : {}),
    },
    select: { id: true, externalId: true, url: true, rawKey: true, source: { select: { code: true } } },
    orderBy: { id: 'asc' },
  });

  console.log(`${postings.length} tin có blob để tính lại.\n`);
  if (postings.length === 0) return;

  const run = dryRun
    ? null
    : await db.crawlRun.create({ data: { trigger: CrawlTrigger.REPARSE } });

  const stats = { updated: 0, unchanged: 0, missing: 0, failed: 0 };

  for (const posting of postings) {
    const blob = (await blobs.get(posting.rawKey!)) as
      | { jsonLd?: unknown; api?: unknown; fallback?: Record<string, unknown> }
      | null;

    if (!blob) {
      stats.missing += 1;
      continue;
    }

    // Nguồn API lưu BẢN GHI GỐC chứ không phải JSON-LD, nên phải dựng lại hình
    // dạng schema.org trước — đúng bằng hàm mà adapter dùng lúc cào, để hai
    // đường không bao giờ lệch nhau.
    //
    // Trước đây chỗ này bỏ qua thẳng mọi blob API. Hệ quả im lặng: 1.737/2.169
    // tin trong kho (toàn bộ VietnamWorks) không bao giờ được tính lại, nên mỗi
    // lần thêm một trường mới lại phải đi cào lại nguồn — đúng cái mà `rawKey`
    // sinh ra để khỏi phải làm.
    const source = blob.jsonLd ?? (blob.api ? vnwRecordToJsonLd(blob.api) : null);
    if (!source) {
      stats.missing += 1;
      continue;
    }

    try {
      const { posting: ld } = validateJobPosting(source);
      if (!ld) {
        stats.failed += 1;
        continue;
      }

      const job = normalizeJobPosting(ld, {
        pageUrl: posting.url,
        externalIdFromUrl: () => posting.externalId,
        fallback: blob.fallback as never,
      });

      if (dryRun) {
        console.log(
          `  ${posting.source.code}/${posting.externalId}  ` +
            `${job.salary.isPublic ? `${job.salary.min}–${job.salary.max}` : 'thoả thuận'}  ` +
            `${job.level ?? '—'}  ${job.parseStatus}`,
        );
        stats.updated += 1;
        continue;
      }

      await db.jobPosting.update({
        where: { id: posting.id },
        data: {
          title: job.title,
          titleNorm: job.titleNorm,
          descriptionText: job.descriptionText,
          contentHash: job.contentHash,
          salaryMin: job.salary.min,
          salaryMax: job.salary.max,
          salaryCurrency: job.salary.currency,
          salaryPeriod: job.salary.period,
          salaryIsPublic: job.salary.isPublic,
          salaryRaw: job.salary.raw,
          fxRate: job.salary.fxRate,
          fxRateDate: job.salary.fxRateDate,
          employmentType: job.employmentType,
          workMode: job.workMode,
          level: job.level,
          yearsExpMin: job.yearsExpMin,
          yearsExpMax: job.yearsExpMax,
          industry: job.industry,
          district: job.district,
          saturdayWork: job.saturdayWork,
          scheduleRaw: job.scheduleRaw,
          postedAt: job.postedAt,
          expiresAt: job.expiresAt,
          parseStatus: job.salary.outOfRange ? ParseStatus.PARTIAL : job.parseStatus,
          parseError: job.parseError,
          // KHÔNG đụng vào status / lastSeenAt / missCount: tính lại parser
          // không nói gì về việc tin còn sống hay đã chết.
        },
      });
      stats.updated += 1;
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
        postingsUpdated: stats.updated,
        postingsFailed: stats.failed,
      },
    });
  }

  console.log(
    `\n${stats.updated} tính lại · ${stats.missing} thiếu blob · ${stats.failed} lỗi` +
      (stats.missing > 0 ? `\n(blob không đọc được hoặc không nhận dạng được hình dạng)` : ''),
  );
}

main()
  .catch((err) => {
    console.error('Reparse hỏng:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect().catch(() => undefined);
  });
