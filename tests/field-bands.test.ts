import { describe, expect, it } from 'vitest';

import {
  EXPERIENCE_BANDS,
  EXPERIENCE_VALUES,
  FACET_NONE,
  SALARY_BANDS,
  SALARY_VALUES,
  experienceBandOf,
  onlyKnown,
  salaryBandOf,
  salaryValue,
} from '@/lib/field-bands';

const paid = (min: number | null, max: number | null) => ({
  salaryIsPublic: true,
  salaryMin: min,
  salaryMax: max,
});

describe('khoảng kinh nghiệm', () => {
  it('xếp đúng ô cho từng số năm', () => {
    expect(experienceBandOf(0)).toBe('0');
    expect(experienceBandOf(1)).toBe('1-2');
    expect(experienceBandOf(2)).toBe('1-2');
    expect(experienceBandOf(3)).toBe('3-5');
    expect(experienceBandOf(5)).toBe('3-5');
    expect(experienceBandOf(6)).toBe('5+');
    expect(experienceBandOf(20)).toBe('5+');
  });

  // Tin không ghi số năm KHÔNG được lặng lẽ trôi vào ô "không đòi kinh
  // nghiệm" — hai chuyện khác hẳn nhau, và gộp lại là nói dối người đọc.
  it('tin không ghi rơi vào ô riêng, KHÔNG phải ô "không đòi kinh nghiệm"', () => {
    expect(experienceBandOf(null)).toBe(FACET_NONE);
    expect(experienceBandOf(null)).not.toBe('0');
  });

  it('các ô PHỦ KÍN mọi số nguyên 0..40, không kẽ hở và không chồng nhau', () => {
    for (let years = 0; years <= 40; years += 1) {
      const hits = EXPERIENCE_BANDS.filter((band) => band.test(years));
      expect(hits, `năm = ${years}`).toHaveLength(1);
    }
  });
});

describe('khoảng lương', () => {
  it('lấy mức CAO NHẤT tin đưa ra', () => {
    expect(salaryValue(paid(10_000_000, 20_000_000))).toBe(20_000_000);
    expect(salaryValue(paid(null, 20_000_000))).toBe(20_000_000);
    expect(salaryValue(paid(18_000_000, null))).toBe(18_000_000);
  });

  it('tin thoả thuận trả null, KHÔNG phải 0', () => {
    expect(salaryValue({ salaryIsPublic: false, salaryMin: null, salaryMax: null })).toBeNull();
    // Bẫy đã chặn: nếu trả 0 thì tin thoả thuận rơi vào ô "Dưới 15 triệu" và
    // mọi thống kê lương đều bị kéo xuống bởi những tin không hề ghi lương.
    expect(salaryBandOf({ salaryIsPublic: false, salaryMin: null, salaryMax: null })).toBe(
      FACET_NONE,
    );
  });

  it('khai công khai nhưng rỗng số vẫn về ô "Thoả thuận"', () => {
    expect(salaryBandOf(paid(null, null))).toBe(FACET_NONE);
    expect(salaryBandOf(paid(0, 0))).toBe(FACET_NONE);
  });

  it('xếp đúng ô theo mốc', () => {
    expect(salaryBandOf(paid(null, 9_000_000))).toBe('0-15');
    expect(salaryBandOf(paid(null, 15_000_000))).toBe('15-25');
    expect(salaryBandOf(paid(null, 24_999_999))).toBe('15-25');
    expect(salaryBandOf(paid(null, 25_000_000))).toBe('25-40');
    expect(salaryBandOf(paid(null, 40_000_000))).toBe('40+');
  });

  it('các ô lương không chồng nhau', () => {
    for (const value of [1e6, 14.9e6, 15e6, 24e6, 25e6, 39e6, 40e6, 200e6]) {
      const hits = SALARY_BANDS.filter((band) => band.test(value));
      expect(hits, `lương = ${value}`).toHaveLength(1);
    }
  });
});

describe('bỏ giá trị lạ trong URL', () => {
  // Bản trước cắt kinh nghiệm theo ngưỡng cộng dồn: `?kn=3` nghĩa là "tối đa
  // 3 năm". Bản này dùng khoảng rời `3-5`. Liên kết cũ đã lưu vẫn mang `kn=3`,
  // và nếu đem đi lọc thẳng thì nó loại sạch mọi tin.
  it('giá trị của bản CŨ bị bỏ qua thay vì lọc ra rỗng', () => {
    expect(onlyKnown(['3'], EXPERIENCE_VALUES)).toEqual([]);
    expect(onlyKnown(['1'], EXPERIENCE_VALUES)).toEqual([]);
  });

  it('giữ nguyên giá trị hợp lệ, kể cả ô "không ghi"', () => {
    expect(onlyKnown(['1-2', '3-5', FACET_NONE], EXPERIENCE_VALUES)).toEqual([
      '1-2',
      '3-5',
      FACET_NONE,
    ]);
  });

  it('trộn hợp lệ và rác thì chỉ giữ phần hợp lệ', () => {
    expect(onlyKnown(['25-40', '999', 'drop table'], SALARY_VALUES)).toEqual(['25-40']);
  });
});
