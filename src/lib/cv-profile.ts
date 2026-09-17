import { z } from 'zod';

/**
 * Hình dạng của `SavedFilter.profile` — hồ sơ ứng viên + trọng số chấm "độ hợp
 * CV" (docs/plan-swe.md §3, §5).
 *
 * Lưu JSON chứ không phải bảng, nên hình dạng phải được KIỂM ở đây: một câu
 * `UPDATE` gõ sai tên khoá mà không ai kiểm thì bộ chấm lặng lẽ cho mọi tin 0
 * điểm. `parseCvProfile` trả lỗi nêu đúng đường dẫn khoá hỏng.
 *
 * Mọi con số là ĐIỂM trên thang 100, trừ `yearsExp` (năm) và `penalty`/`bands`.
 */

const slugs = z.array(z.string().min(1));

export const CvProfileSchema = z.object({
  version: z.literal(1),
  /** Cách chuẩn hoá chữ cho từ điển ngành — xem `MatchKeyMode`. */
  matchKey: z.enum(['plain', 'tech']),

  /** Số năm kinh nghiệm của ứng viên, và tháng tính mốc đó (để biết khi nào phải sửa). */
  yearsExp: z.number().min(0),
  yearsExpAsOf: z.string(),

  /** Kỹ năng lõi: có ở tiêu đề hoặc nguồn khai → đủ điểm; chỉ ở mô tả → nửa. */
  core: z
    .array(z.object({ label: z.string(), skills: slugs.min(1), weight: z.number().min(0) }))
    .min(1),
  /** Kỹ năng cộng thêm: mỗi cái `each` điểm, trần `cap`. */
  bonus: z.object({ skills: slugs, each: z.number(), cap: z.number() }),

  level: z.object({
    /** `yearsExpMin` <= số năm của ứng viên. */
    within: z.number(),
    /** Đòi hơn 1 năm. */
    plusOne: z.number(),
    /** Đòi hơn 2 năm. */
    plusTwo: z.number(),
    /** Tin không ghi số năm — không phải 0: không nói ≠ không hợp. */
    unknown: z.number(),
    /** INTERN / FRESHER — thấp hơn tầm, lương thường thấp. */
    underLevel: z.number(),
    /** Cấp SENIOR nhưng chỉ đòi ít năm — trần điểm. */
    seniorCap: z.number(),
    /** Đòi hơn từng này năm trở lên → cờ cứng "quá tầm". */
    tooSeniorGap: z.number().int().min(1),
    /** Chữ ở tiêu đề báo vị trí quản lý / dẫn dắt → cờ cứng "quá tầm". */
    seniorTitleWords: z.array(z.string()),
    /** INTERN / FRESHER không bao giờ cao hơn mức này, dù điểm cao. */
    underLevelMaxBand: z.enum(['great', 'good', 'stretch']),
  }),

  conditions: z.object({
    remoteOrHybrid: z.number(),
    homeDistrict: z.number(),
    /** Giá trị `JobPosting.district`, so khớp bỏ dấu. */
    homeDistricts: z.array(z.string()),
    domain: z.object({ skills: slugs, points: z.number() }),
  }),

  /**
   * Stack không có trong CV. Ở tiêu đề mà không kèm stack của CV → cờ cứng;
   * kèm stack của CV → trừ `mixedPenalty`. Riêng `exclusive` (Unity, SAP...) là
   * nghề khác hẳn dù dùng C# — ở tiêu đề là cờ cứng, bất kể có gì khác.
   */
  otherStacks: z.object({ skills: slugs, exclusive: slugs, mixedPenalty: z.number() }),
  /** Framework frontend khác (`skills`) mà tin không nhắc framework của CV (`unless`). */
  frontendMismatch: z.object({ skills: slugs, unless: slugs, penalty: z.number() }),
  /** Thị trường hay đòi mà CV chưa có — không trừ điểm, chỉ để liệt kê. */
  gaps: slugs,

  language: z.object({
    /** Chữ ở tiêu đề báo phải biết ngoại ngữ ứng viên KHÔNG có → cờ cứng. */
    hardTitleWords: z.array(z.string()),
    /** Kỹ năng REQ của ngoại ngữ ứng viên không có. */
    requiredSkills: slugs,
    /** Chỉ thấy trong mô tả → trừ điểm thay vì cờ cứng (có thể chỉ là "lợi thế"). */
    softPenalty: z.number(),
    englishSkill: z.string(),
    englishTitleWords: z.array(z.string()),
    englishPenalty: z.number(),
  }),

  bands: z.object({ great: z.number(), good: z.number(), stretch: z.number() }),
});

export type CvProfile = z.infer<typeof CvProfileSchema>;

export type ProfileParse =
  | { ok: true; profile: CvProfile | null }
  | { ok: false; error: string };

/** Đọc `SavedFilter.profile`. `null` hợp lệ — ngành không chấm độ hợp (thu mua). */
export function parseCvProfile(value: unknown): ProfileParse {
  if (value === null || value === undefined) return { ok: true, profile: null };
  const parsed = CvProfileSchema.safeParse(value);
  if (parsed.success) return { ok: true, profile: parsed.data };
  const first = parsed.error.issues[0];
  const path = first?.path.join('.') || '(gốc)';
  return { ok: false, error: `SavedFilter.profile hỏng ở "${path}": ${first?.message ?? 'không rõ'}` };
}

/**
 * Cách chuẩn hoá chữ mà từ điển của ngành khai — đọc RIÊNG khoá này.
 *
 * Tách khỏi `parseCvProfile` có chủ đích: từ điển phải so khớp đúng kể cả khi
 * phần chấm điểm của hồ sơ đang hỏng (khi đó `parseCvProfile` báo lỗi riêng).
 * Không khai, hoặc không có hồ sơ → `plain`, đúng như ngành thu mua.
 */
export function matchKeyOf(profile: unknown): 'plain' | 'tech' {
  return typeof profile === 'object' &&
    profile !== null &&
    (profile as { matchKey?: unknown }).matchKey === 'tech'
    ? 'tech'
    : 'plain';
}
