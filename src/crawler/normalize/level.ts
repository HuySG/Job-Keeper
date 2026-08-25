import { Level } from '@/enums';

import { removeDiacritics, normalizeWhitespace } from './text';

/**
 * Suy ra cấp bậc và số năm kinh nghiệm.
 *
 * `level` hầu như không bao giờ có sẵn trong JSON-LD, nên phải suy từ tiêu đề
 * và từ `experienceRequirements`. Sai ở đây làm hỏng toàn bộ thống kê lương
 * (lương Senior lẫn vào Junior thì trung vị vô nghĩa), nên module này có test
 * riêng và cố ý thà TRẢ VỀ null còn hơn đoán bừa.
 */

export interface NormalizedLevel {
  level: Level | null;
  yearsMin: number | null;
  yearsMax: number | null;
}

/**
 * Từ khoá theo cấp, xếp từ CAO xuống THẤP.
 *
 * Thứ tự quan trọng: "Senior Manager" phải ra MANAGER chứ không phải SENIOR,
 * nên cấp cao được xét trước và thắng.
 */
const LEVEL_KEYWORDS: readonly (readonly [Level, readonly string[]])[] = [
  [
    Level.MANAGER,
    [
      'manager', 'quan ly', 'truong phong', 'giam doc', 'director', 'head of',
      'chief', 'cto', 'ceo', 'cfo', 'truong bo phan', 'pho phong',
    ],
  ],
  [
    Level.LEAD,
    [
      'team lead', 'tech lead', 'teamlead', 'techlead', 'leader', 'truong nhom',
      'to truong', 'principal', 'architect', 'chu tri',
    ],
  ],
  [
    Level.SENIOR,
    ['senior', 'sr ', 'cao cap', 'chuyen gia', 'expert', 'chuyen vien cao cap'],
  ],
  [
    Level.JUNIOR,
    ['junior', 'jr ', 'moi ra truong', 'it kinh nghiem'],
  ],
  [
    Level.FRESHER,
    ['fresher', 'entry level', 'entry-level', 'khong yeu cau kinh nghiem', 'chua co kinh nghiem'],
  ],
  [
    Level.INTERN,
    ['intern', 'internship', 'thuc tap', 'ttv', 'tap su', 'trainee', 'hoc viec'],
  ],
];

/**
 * Suy cấp bậc từ số năm kinh nghiệm, khi tiêu đề không nói gì.
 *
 * Các mốc này là quy ước của thị trường Việt Nam, không phải chuẩn quốc tế —
 * đặt ở đây thành một chỗ để sửa được khi thấy lệch thực tế.
 */
function levelFromYears(years: number): Level {
  if (years === 0) return Level.FRESHER;
  if (years < 2) return Level.JUNIOR;
  if (years < 5) return Level.MID;
  return Level.SENIOR;
}

/**
 * Đọc số năm kinh nghiệm.
 *
 * Bắt được: "3 năm kinh nghiệm", "2-4 years", "ít nhất 5 năm", "trên 3 năm",
 * "không yêu cầu kinh nghiệm".
 */
export function parseYearsOfExperience(input: string): { min: number | null; max: number | null } {
  const text = removeDiacritics(normalizeWhitespace(input)).toLowerCase();

  if (/khong yeu cau kinh nghiem|chua co kinh nghiem|no experience/.test(text)) {
    return { min: 0, max: 0 };
  }

  // Khoảng: "2-4 năm", "2 to 4 years"
  const range = text.match(/(\d{1,2})\s*(?:-|–|den|to)\s*(\d{1,2})\s*(?:nam|year)/);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return min <= max ? { min, max } : { min: max, max: min };
    }
  }

  // Một mốc: "3 năm", "ít nhất 5 năm", "trên 2 năm", "5+ years"
  const single = text.match(/(\d{1,2})\s*\+?\s*(?:nam|year)/);
  if (single) {
    const value = Number(single[1]);
    if (Number.isFinite(value) && value <= 40) {
      const isMinimum = /it nhat|tren|tu|toi thieu|\+|minimum|at least/.test(text);
      return isMinimum ? { min: value, max: null } : { min: value, max: value };
    }
  }

  return { min: null, max: null };
}

/**
 * @param title tiêu đề tin
 * @param experienceText `experienceRequirements` của JSON-LD, hoặc mô tả
 */
/**
 * Chức danh có chữ "manager"/"lead" nhưng KHÔNG phải cấp quản lý.
 *
 * Phát hiện từ dữ liệu thật: tin TopCV "Project Manager (PM)" có
 * `monthsOfExperience: 36` — ba năm kinh nghiệm, rõ ràng không phải cấp trưởng
 * phòng. "Project/Product Manager" là TÊN NGHỀ, chữ "Manager" trong đó không
 * nói gì về cấp bậc. Gộp chúng vào MANAGER là thổi phồng nhóm quản lý và kéo
 * lệch trung vị lương của cả hai nhóm.
 */
const ROLE_TITLES_NOT_MANAGEMENT: readonly string[] = [
  'project manager',
  'product manager',
  'product owner',
  'account manager',
  'community manager',
  'brand manager',
  'quan ly du an',
  'quan ly san pham',
];

export function inferLevel(title: string, experienceText?: string | null): NormalizedLevel {
  const haystack = removeDiacritics(normalizeWhitespace(title)).toLowerCase();

  const years = parseYearsOfExperience(
    `${title} ${experienceText ?? ''}`,
  );

  const isRoleTitle = ROLE_TITLES_NOT_MANAGEMENT.some((role) => haystack.includes(role));

  for (const [level, keywords] of LEVEL_KEYWORDS) {
    // Chức danh dạng "Project Manager" thì bỏ qua nhánh MANAGER, nhưng vẫn xét
    // tiếp các cấp khác: "Senior Product Manager" phải ra SENIOR.
    if (isRoleTitle && level === Level.MANAGER) continue;
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return { level, yearsMin: years.min, yearsMax: years.max };
    }
  }

  // Tiêu đề không nói gì -> dùng số năm nếu có. Không có gì cả thì trả null,
  // KHÔNG mặc định MID: "không biết" và "trung cấp" là hai chuyện khác nhau,
  // và gộp chúng lại là bơm nhiễu vào đúng nhóm đông nhất.
  if (years.min !== null) {
    return { level: levelFromYears(years.min), yearsMin: years.min, yearsMax: years.max };
  }

  return { level: null, yearsMin: null, yearsMax: null };
}
