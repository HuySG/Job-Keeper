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
    trigger: readTrigger(full),
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

/**
 * Ai đã khởi động lượt này — ghi vào `CrawlRun.trigger`.
 *
 * `CrawlTrigger.CRON` từng được khai trong enum nhưng KHÔNG chỗ nào đặt, nên
 * mọi lượt chạy theo lịch đều bị ghi thành `backfill` (vì workflow có `--full`).
 * Hậu quả không nhỏ: nhìn vào bảng `CrawlRun` không cách nào phân biệt "lịch
 * đã chạy" với "người gõ tay", tức là mất đúng cái bằng chứng cần đến khi đi
 * tìm câu trả lời cho "vì sao lịch không chạy". Đã phải soi log GitHub API mới
 * biết — chính là chỗ đáng lẽ CSDL trả lời trong một câu truy vấn.
 *
 * GitHub Actions khai sẵn sự kiện kích hoạt trong `GITHUB_EVENT_NAME`. Chỉ
 * `schedule` mới là CRON; `workflow_dispatch` là người tự bấm nút nên vẫn tính
 * là chạy tay, dù cũng chạy trên runner.
 *
 * CRON thắng `--full`: lượt theo lịch nào cũng quét đầy đủ, nên nếu để
 * `backfill` thắng thì nhãn CRON sẽ không bao giờ xuất hiện — đúng lại lỗi cũ.
 */
function readTrigger(full: boolean): CrawlTrigger {
  if (process.env.GITHUB_EVENT_NAME === 'schedule') return CrawlTrigger.CRON;
  return full ? CrawlTrigger.BACKFILL : CrawlTrigger.MANUAL;
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
