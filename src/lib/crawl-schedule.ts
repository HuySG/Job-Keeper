/**
 * Lịch cào tự động — để trang Nguồn nói được "lần quét kế tiếp sau bao lâu".
 *
 * ⚠️ PHẢI khớp với `schedule.cron` trong `.github/workflows/crawl.yml`. Không
 *    đọc được file đó lúc chạy (Vercel không có thư mục `.github`), nên đây là
 *    bản chép tay — sửa lịch ở đó thì sửa cả ở đây.
 *
 * Giờ tính theo UTC như cron của GitHub. Cố ý không đọc gì từ
 * `constants/crawl`: module đó đọc `process.env` lúc nạp, còn phần web thì
 * được hứa chỉ cần đúng các biến ghi trong `docs/deploy.md`.
 */
export const CRAWL_SCHEDULE_UTC: readonly { hour: number; minute: number }[] = [
  { hour: 1, minute: 0 },
  { hour: 7, minute: 0 },
  { hour: 13, minute: 0 },
  { hour: 18, minute: 30 },
  { hour: 19, minute: 0 },
];

/**
 * Chu kỳ danh nghĩa, tính bằng giờ. Bốn lượt nhẹ cách đều nhau sáu tiếng; lượt
 * nặng 18:30 chèn vào giữa nên không làm chu kỳ dài thêm.
 */
export const CRAWL_CYCLE_HOURS = 6;

/**
 * Lượt cào kế tiếp sau `now`.
 *
 * GitHub Actions có thể trễ vài phút tới cả chục phút lúc đông máy, nên con số
 * này là LỊCH chứ không phải lời hứa — giao diện nói "khoảng".
 */
export function nextCrawlAt(now: Date): Date {
  const candidates: Date[] = [];
  for (const dayOffset of [0, 1]) {
    for (const slot of CRAWL_SCHEDULE_UTC) {
      candidates.push(
        new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() + dayOffset,
            slot.hour,
            slot.minute,
          ),
        ),
      );
    }
  }
  // Luôn tìm thấy: ngày mai chắc chắn có một lượt sau `now`.
  return candidates.find((at) => at.getTime() > now.getTime()) ?? candidates[candidates.length - 1]!;
}

/** "7 giờ", "40 phút" — khoảng cách tới một mốc trong tương lai. */
export function durationUntil(target: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  // Dưới 3 tiếng thì nửa giờ còn đáng nói; xa hơn thì làm tròn cho gọn.
  if (hours < 3 && rest >= 15) return `${hours} giờ ${rest} phút`;
  return `${rest >= 30 ? hours + 1 : hours} giờ`;
}
