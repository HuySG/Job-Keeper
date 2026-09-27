import { describe, expect, it } from 'vitest';

import {
  countSkillFacets,
  matchesAny,
  medianSalaryBySkill,
  type StackRow,
} from '@/lib/stack-facets';

/** Một tin, viết gọn: `job(['java','go'], 30_000_000)`. */
function job(slugs: string[], salary: number | null = null): StackRow {
  return {
    skills: slugs.map((slug) => ({ slug, name: NAMES[slug] ?? slug })),
    salary,
  };
}

const NAMES: Record<string, string> = {
  java: 'Java',
  go: 'Go',
  ts: 'TypeScript',
  php: 'PHP',
  python: 'Python',
};

describe('countSkillFacets', () => {
  it('đếm mỗi tin một lần cho mỗi stack nó gọi tên', () => {
    const facets = countSkillFacets([job(['java', 'go']), job(['java']), job(['ts'])]);

    expect(facets).toEqual([
      { value: 'java', label: 'Java', count: 2 },
      { value: 'go', label: 'Go', count: 1 },
      { value: 'ts', label: 'TypeScript', count: 1 },
    ]);
  });

  it('CÙNG một stack ghi hai lần trong MỘT tin chỉ đếm một lần', () => {
    // `extractSkills` ghi cả `declared` (sàn tự khai) lẫn `text` (quét mô tả),
    // nên cùng một slug xuất hiện hai lần là chuyện thường. Đếm cả hai thì một
    // tin làm con số của Java nhảy lên 2 — và không ai phát hiện được.
    const facets = countSkillFacets([job(['java', 'java', 'java'])]);

    expect(facets).toEqual([{ value: 'java', label: 'Java', count: 1 }]);
  });

  it('các con số cộng lại LỚN HƠN số tin — đây là hành vi đúng, không phải lỗi', () => {
    const rows = [job(['java', 'go', 'ts']), job(['java', 'go'])];
    const facets = countSkillFacets(rows);
    const sum = facets.reduce((total, facet) => total + facet.count, 0);

    expect(rows).toHaveLength(2);
    expect(sum).toBe(5);
  });

  it('nhiều tin nhất lên đầu; đồng hạng thì xếp theo tên để thứ tự không tự xáo', () => {
    const facets = countSkillFacets([job(['ts']), job(['java']), job(['go']), job(['go'])]);

    expect(facets.map((facet) => facet.value)).toEqual(['go', 'java', 'ts']);
  });

  it('tin không bóc được stack nào thì không góp ô nào', () => {
    expect(countSkillFacets([job([]), job([])])).toEqual([]);
    expect(countSkillFacets([])).toEqual([]);
  });
});

describe('medianSalaryBySkill', () => {
  const opts = { minSample: 3, limit: 10 };

  it('lấy TRUNG VỊ, không lấy trung bình', () => {
    // Trung bình của 20/30/40/200 là 72,5 — một mức không ai gặp. Trung vị là 35.
    const rows = [
      job(['go'], 20_000_000),
      job(['go'], 30_000_000),
      job(['go'], 40_000_000),
      job(['go'], 200_000_000),
    ];

    expect(medianSalaryBySkill(rows, opts)[0]?.median).toBe(35_000_000);
  });

  it('bỏ stack chưa đủ mẫu tin GHI SỐ', () => {
    const rows = [
      job(['java'], 30_000_000),
      job(['java'], 32_000_000),
      job(['java'], 34_000_000),
      // Go có 3 tin, nhưng chỉ 2 tin ghi số — chưa đủ `minSample`.
      job(['go'], 50_000_000),
      job(['go'], 52_000_000),
      job(['go'], null),
    ];

    expect(medianSalaryBySkill(rows, opts).map((row) => row.slug)).toEqual(['java']);
  });

  it('`count` là số tin, `sample` là số tin ghi số — hai con số khác nhau', () => {
    const rows = [
      job(['php'], 20_000_000),
      job(['php'], 22_000_000),
      job(['php'], 24_000_000),
      job(['php'], null),
      job(['php'], null),
    ];

    expect(medianSalaryBySkill(rows, opts)[0]).toMatchObject({ count: 5, sample: 3 });
  });

  it('một tin góp lương vào MỌI stack nó gọi tên', () => {
    const rows = [
      job(['java', 'ts'], 40_000_000),
      job(['java', 'ts'], 40_000_000),
      job(['java', 'ts'], 40_000_000),
    ];
    const out = medianSalaryBySkill(rows, opts);

    expect(out).toHaveLength(2);
    expect(out.every((row) => row.median === 40_000_000 && row.sample === 3)).toBe(true);
  });

  it('xếp lương cao xuống thấp và cắt theo `limit`', () => {
    const rows = [
      ...Array.from({ length: 3 }, () => job(['go'], 46_000_000)),
      ...Array.from({ length: 3 }, () => job(['ts'], 36_000_000)),
      ...Array.from({ length: 3 }, () => job(['php'], 21_000_000)),
    ];

    expect(medianSalaryBySkill(rows, opts).map((row) => row.slug)).toEqual(['go', 'ts', 'php']);
    expect(medianSalaryBySkill(rows, { minSample: 3, limit: 2 }).map((row) => row.slug)).toEqual([
      'go',
      'ts',
    ]);
  });

  it('trung vị của số chẵn mẫu là trung bình hai giá trị giữa, làm tròn', () => {
    const rows = [
      job(['java'], 10_000_000),
      job(['java'], 20_000_000),
      job(['java'], 25_000_000),
      job(['java'], 40_000_000),
    ];

    expect(medianSalaryBySkill(rows, opts)[0]?.median).toBe(22_500_000);
  });

  it('không tin nào ghi số thì không vẽ gì', () => {
    const rows = [job(['java']), job(['java']), job(['java'])];

    expect(medianSalaryBySkill(rows, opts)).toEqual([]);
  });
});

describe('matchesAny', () => {
  it('chưa tích ô nào thì mọi tin lọt', () => {
    expect(matchesAny(['java'], undefined)).toBe(true);
    expect(matchesAny(['java'], [])).toBe(true);
    expect(matchesAny([], [])).toBe(true);
  });

  it('tích một ô: lọt khi tin có đúng stack đó', () => {
    expect(matchesAny(['java', 'go'], ['java'])).toBe(true);
    expect(matchesAny(['php'], ['java'])).toBe(false);
  });

  it('tích nhiều ô là HOẶC, không phải VÀ', () => {
    // Chọn Java và Go phải ra tin gọi Java HOẶC Go, không phải tin đòi CẢ HAI:
    // biết thêm một thứ thì phải ra THÊM tin chứ không phải ít đi.
    expect(matchesAny(['java'], ['java', 'go'])).toBe(true);
    expect(matchesAny(['go'], ['java', 'go'])).toBe(true);
    expect(matchesAny(['ts'], ['java', 'go'])).toBe(false);
  });

  it('tin không có stack nào thì bị loại khi đang lọc stack', () => {
    expect(matchesAny([], ['java'])).toBe(false);
  });
});
