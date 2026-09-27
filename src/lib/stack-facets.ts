/**
 * Đếm và chấm lương theo STACK — logic thuần, không đụng CSDL.
 *
 * Nằm ở `lib/` chứ không ở `api/field.api.ts` vì `field.api.ts` khai
 * `server-only`, và thứ có `server-only` thì test không import được. Cùng lý do
 * `lib/field-bands.ts` tồn tại: luật nào đáng có test thì phải ra khỏi tầng đọc
 * CSDL.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STACK LÀ CHIỀU NHIỀU GIÁ TRỊ, và đó là nguồn của mọi cái bẫy trong file này.
 *
 * Mọi chiều lọc khác của trang Ngành cho mỗi tin đúng MỘT giá trị: một tin ở
 * một quận, một khoảng lương, một cấp bậc. Stack thì không — một tin gọi tên
 * Java, Spring Boot và MySQL cùng lúc. Ba hệ quả, cả ba đều từng là lỗi thật ở
 * các giao diện lọc khác:
 *
 *   1. Các con số CỘNG LẠI LỚN HƠN tổng số tin. Không được dựng thanh tỉ lệ
 *      trên tổng số tin, và không được ghi "101 + 59 + … = tổng".
 *   2. Cùng một kỹ năng có thể xuất hiện HAI LẦN trong một tin, vì
 *      `extractSkills` ghi cả `declared` (sàn tự khai) lẫn `text` (quét mô tả).
 *      Đếm cả hai thì một tin làm con số của Java nhảy lên 2.
 *   3. Lọc "Java" rồi xem lương theo stack thì mọi stack ĐI KÈM Java cũng hiện
 *      ra. Đúng ý muốn hỏi, nhưng các cột không rời nhau.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Đúng những gì việc đếm cần biết về một tin. Cố ý không phải kiểu của Prisma. */
export interface StackRow {
  /** Có thể TRÙNG slug — xem bẫy số 2 ở đầu file. */
  skills: readonly { slug: string; name: string }[];
  /** VND/tháng, `null` khi tin ghi "thoả thuận". */
  salary: number | null;
}

export interface StackFacet {
  value: string;
  label: string;
  count: number;
}

/**
 * Số tin gọi tên từng stack, nhiều nhất lên đầu.
 *
 * Trùng slug trong CÙNG MỘT tin chỉ đếm một lần. Đồng hạng thì xếp theo tên
 * (quy tắc tiếng Việt) để thứ tự không đổi giữa hai lần tải trang — một danh
 * sách tự xáo chỗ là cách chắc chắn làm người dùng tưởng mình bấm nhầm.
 */
export function countSkillFacets(rows: readonly StackRow[]): StackFacet[] {
  const map = new Map<string, StackFacet>();

  for (const row of rows) {
    const seen = new Set<string>();
    for (const skill of row.skills) {
      if (seen.has(skill.slug)) continue;
      seen.add(skill.slug);
      const existing = map.get(skill.slug);
      if (existing) existing.count += 1;
      else map.set(skill.slug, { value: skill.slug, label: skill.name, count: 1 });
    }
  }

  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'vi'),
  );
}

export interface SkillSalary {
  slug: string;
  name: string;
  /** Số tin gọi stack này. */
  count: number;
  /** Số tin trong đó CÓ ghi con số lương — mẫu của trung vị. */
  sample: number;
  median: number;
}

/**
 * Trung vị lương theo từng stack, cao xuống thấp.
 *
 * Chỉ giữ stack đạt `minSample` tin CÓ GHI SỐ. `count` và `sample` là hai con
 * số khác nhau và giao diện phải nói cả hai: một stack 60 tin mà chỉ 5 tin ghi
 * lương thì cột của nó mỏng hơn vẻ ngoài rất nhiều.
 *
 * Trung vị chứ không phải trung bình — vài tin lead 90 triệu kéo lệch trung bình
 * lên trên mức phần lớn người đọc thật sự gặp.
 */
export function medianSalaryBySkill(
  rows: readonly StackRow[],
  { minSample, limit }: { minSample: number; limit: number },
): SkillSalary[] {
  const buckets = new Map<string, { name: string; count: number; values: number[] }>();

  for (const row of rows) {
    const seen = new Set<string>();
    for (const skill of row.skills) {
      if (seen.has(skill.slug)) continue;
      seen.add(skill.slug);
      const bucket = buckets.get(skill.slug) ?? { name: skill.name, count: 0, values: [] };
      bucket.count += 1;
      if (row.salary !== null) bucket.values.push(row.salary);
      buckets.set(skill.slug, bucket);
    }
  }

  return [...buckets.entries()]
    .filter(([, bucket]) => bucket.values.length >= minSample)
    .map(([slug, bucket]) => ({
      slug,
      name: bucket.name,
      count: bucket.count,
      sample: bucket.values.length,
      median: medianOf(bucket.values),
    }))
    .sort((a, b) => b.median - a.median || a.name.localeCompare(b.name, 'vi'))
    .slice(0, limit);
}

/** Chỉ gọi khi mảng KHÔNG rỗng — `medianSalaryBySkill` đã chặn trước. */
function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) return sorted[mid] ?? 0;
  return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
}

/**
 * Tin có lọt qua một chiều NHIỀU GIÁ TRỊ không: lọt khi có ÍT NHẤT MỘT giá trị
 * được tích. Chưa tích ô nào thì mọi tin lọt.
 *
 * Tách thành hàm riêng vì viết thẳng bằng `||` là sai một cách âm thầm:
 * `on('skills','java') || on('skills','go')` trả `true` cho MỌI tin ngay khi
 * chiều đó chưa tích ô nào, tức bộ lọc mất tác dụng mà không lỗi nào báo.
 *
 * "Java HOẶC Go" chứ không phải "Java VÀ Go" là cố ý: người đi tìm việc lọc theo
 * thứ mình BIẾT, và biết thêm một thứ thì phải ra THÊM tin chứ không phải ít đi.
 */
export function matchesAny(
  values: readonly string[],
  chosen: readonly string[] | undefined,
): boolean {
  if (!chosen || chosen.length === 0) return true;
  return values.some((value) => chosen.includes(value));
}
