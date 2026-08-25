import { CrawlTrigger } from '@/enums';
import { runCrawl } from '@/crawler/pipeline';

import { loadEnv, parseArgs } from './_env';

/**
 * Chạy crawler.
 *
 *   npm run crawl                          quét tăng dần mọi nguồn đang bật
 *   npm run crawl -- --source vnw          chỉ VietnamWorks
 *   npm run crawl -- --source topcv,itviec nhiều nguồn
 *   npm run crawl -- --full                quét đầy đủ (và mới dám đóng tin cũ)
 *   npm run crawl -- --dry --source topcv  KHÔNG ghi DB, chỉ in ra để soi parser
 *   npm run crawl -- --limit 20            trần số trang chi tiết mỗi nguồn
 *
 * `--dry` là chế độ dùng nhiều nhất khi thêm nguồn mới: nó chạy thật vào nguồn
 * thật nhưng không đụng vào DB, nên soi được parser đọc ra cái gì trước khi
 * cho phép nó ghi.
 */
async function main(): Promise<void> {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  const sourceCodes = args.string('source')?.split(',').map((s) => s.trim()).filter(Boolean);
  const full = args.boolean('full');
  const dryRun = args.boolean('dry');
  const limit = args.number('limit');

  if (dryRun) {
    console.log('CHẠY KHÔ: không ghi DB, không lưu blob.\n');
  }

  const summary = await runCrawl({
    trigger: full ? CrawlTrigger.BACKFILL : CrawlTrigger.MANUAL,
    sourceCodes,
    full,
    dryRun,
    ...(limit !== null ? { maxDetailPages: limit } : {}),
  });

  console.log('\n┌─ Tổng kết ────────────────────────────');
  for (const row of summary.bySource) {
    const flag = row.status === 'SUCCESS' ? '✓' : row.status === 'ABORTED' ? '⏸' : '✗';
    console.log(
      `│ ${flag} ${row.code.padEnd(12)} ${String(row.created).padStart(4)} mới · ` +
        `${String(row.updated).padStart(4)} sửa · ${String(row.failed).padStart(3)} lỗi` +
        (row.error ? `  (${row.error.slice(0, 60)})` : ''),
    );
  }
  console.log('└───────────────────────────────────────');

  // Thoát khác 0 khi hỏng hết, để GitHub Actions báo đỏ thay vì im lặng thành công.
  if (summary.status === 'FAILED') process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('Crawl hỏng:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { db } = await import('@/api/db');
    await db.$disconnect().catch(() => undefined);
  });
