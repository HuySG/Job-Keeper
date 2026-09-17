import { describe, expect, it } from 'vitest';

import { FailureStreak } from '@/crawler/failure-streak';

/**
 * Một tin ghi hỏng không được làm dừng cả nguồn — nhưng nhiều tin liên tiếp
 * cùng hỏng thì gần như chắc chắn là CSDL có vấn đề, và cố ghi tiếp chỉ đốt
 * request vào sàn để rồi vứt.
 *
 * Ca thật 17/09/2026: một tin ITviec lương đọc sai tràn cột Int, và lỗi đó
 * làm dừng cả lượt cào ITviec sau 74/260 URL.
 */
describe('FailureStreak', () => {
  it('lỗi lẻ tẻ không bao giờ chạm trần', () => {
    const streak = new FailureStreak(3);
    for (let i = 0; i < 10; i += 1) {
      expect(streak.fail()).toBe(false);
      streak.ok();
    }
  });

  it('đủ N lỗi LIÊN TIẾP thì báo dừng', () => {
    const streak = new FailureStreak(3);
    expect(streak.fail()).toBe(false);
    expect(streak.fail()).toBe(false);
    expect(streak.fail()).toBe(true);
  });

  it('một lần ghi được là đếm lại từ đầu', () => {
    const streak = new FailureStreak(3);
    streak.fail();
    streak.fail();
    streak.ok();
    expect(streak.fail()).toBe(false);
    expect(streak.fail()).toBe(false);
    expect(streak.fail()).toBe(true);
  });

  it('không nhận trần nhỏ hơn 1', () => {
    expect(() => new FailureStreak(0)).toThrow();
  });
});

describe('shortError — lỗi Prisma dài hàng trăm dòng', () => {
  it('lấy dòng cuối có chữ, cắt ngắn', async () => {
    const { shortError } = await import('@/crawler/failure-streak');
    const prisma = new Error(
      '\nInvalid `db.jobPosting.create()` invocation in\nD:\\x.ts:487:5\n\n  data: {…}\n\n' +
        'Unable to fit value 76200001270000000000 into a 64-bit signed integer for field `salaryMin`\n',
    );
    expect(shortError(prisma)).toBe(
      'Unable to fit value 76200001270000000000 into a 64-bit signed integer for field `salaryMin`',
    );
    expect(shortError(new Error('x'.repeat(500))).length).toBeLessThanOrEqual(200);
    expect(shortError('không phải Error')).toBe('không phải Error');
  });
});
