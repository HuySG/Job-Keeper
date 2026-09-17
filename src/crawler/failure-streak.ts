/**
 * Đếm lỗi GHI liên tiếp của một nguồn trong một lượt cào.
 *
 * Một tin ghi hỏng là lỗi của TIN đó — đúng như `CrawlItem` kind `error` đã
 * định nghĩa — nên không được làm dừng cả nguồn. Ca thật 17/09/2026: một tin
 * ITviec đọc lương sai tràn cột Int, và lỗi ấy làm dừng lượt cào ITviec sau
 * 74/260 URL, bỏ luôn 186 tin còn lại.
 *
 * Nhưng nhiều tin LIÊN TIẾP cùng hỏng thì gần như chắc chắn là CSDL có vấn đề
 * (mất kết nối, hết dung lượng). Lúc đó cào tiếp là gõ cửa sàn thật để rồi vứt
 * kết quả — phải dừng.
 */
export class FailureStreak {
  private count = 0;

  constructor(readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error(`Trần lỗi liên tiếp phải là số nguyên >= 1, nhận ${limit}`);
    }
  }

  /** Ghi một lần hỏng. `true` = đã chạm trần, phải dừng nguồn. */
  fail(): boolean {
    this.count += 1;
    return this.count >= this.limit;
  }

  /** Một lần ghi được — đếm lại từ đầu. */
  ok(): void {
    this.count = 0;
  }
}

/**
 * Một dòng đọc được từ lỗi bất kỳ.
 *
 * Lỗi của Prisma dài hàng chục dòng và in NGUYÊN khối dữ liệu định ghi; lý do
 * thật nằm ở dòng cuối ("Unable to fit value … for field `salaryMin`"). In cả
 * khối cho mỗi tin hỏng là chôn mất log của cả lượt chạy.
 */
export function shortError(err: unknown, maxLength = 200): string {
  const message = err instanceof Error ? err.message : String(err);
  const lines = message
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const last = lines.at(-1) ?? message;
  return last.length > maxLength ? `${last.slice(0, maxLength - 1)}…` : last;
}
