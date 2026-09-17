import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CRAWL_SCHEDULE_UTC, durationUntil, nextCrawlAt } from '@/lib/crawl-schedule';

describe('nextCrawlAt', () => {
  it('lấy lượt kế tiếp trong cùng ngày', () => {
    expect(nextCrawlAt(new Date('2026-09-16T08:00:00Z')).toISOString()).toBe('2026-09-16T13:00:00.000Z');
  });

  it('không chọn lại lượt đang đúng giờ', () => {
    expect(nextCrawlAt(new Date('2026-09-16T18:30:00Z')).toISOString()).toBe('2026-09-16T19:00:00.000Z');
  });

  it('qua lượt cuối ngày thì sang lượt đầu ngày hôm sau', () => {
    expect(nextCrawlAt(new Date('2026-09-30T19:05:00Z')).toISOString()).toBe('2026-10-01T01:00:00.000Z');
  });
});

describe('durationUntil', () => {
  const now = new Date('2026-09-16T00:00:00Z');
  const later = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

  it('dưới một giờ thì nói phút', () => {
    expect(durationUntil(later(40), now)).toBe('40 phút');
  });

  it('gần thì giữ phút lẻ, xa thì làm tròn', () => {
    expect(durationUntil(later(90), now)).toBe('1 giờ 30 phút');
    expect(durationUntil(later(7 * 60 + 40), now)).toBe('8 giờ');
  });
});

describe('lịch chép tay khớp workflow', () => {
  // Hai nơi giữ cùng một lịch là hai nơi sẽ lệch nhau. Bài kiểm này là thứ
  // duy nhất báo khi có người sửa cron mà quên sửa trang Nguồn.
  it('mọi giờ trong CRAWL_SCHEDULE_UTC đều có trong crawl.yml và ngược lại', () => {
    const yml = readFileSync('.github/workflows/crawl.yml', 'utf8');
    const fromYml = [...yml.matchAll(/cron:\s*'(\d+)\s+([\d,]+)\s+\*\s+\*\s+\*'/g)].flatMap((m) =>
      (m[2] ?? '').split(',').map((hour) => `${Number(hour)}:${Number(m[1])}`),
    );
    const fromCode = CRAWL_SCHEDULE_UTC.map((slot) => `${slot.hour}:${slot.minute}`);
    expect([...fromCode].sort()).toEqual([...fromYml].sort());
  });
});
