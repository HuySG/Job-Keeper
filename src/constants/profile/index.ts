import type { CvProfile } from '@/lib/cv-profile';

/**
 * Hồ sơ ứng viên của workspace swe — nạp vào `SavedFilter.profile` của ngành
 * `phan-mem-hcm`. Sau khi nạp, chỉnh bằng SQL; đổi ở đây thì chạy
 * `npm run db:seed -- --ws swe --force-fields`.
 *
 * CHỈ những gì dùng để chấm tin. Không số điện thoại, email, năm sinh — repo
 * có thể public (docs/plan-swe.md §3).
 *
 * Nguồn: CV 09/2026 — 3 vị trí liên tiếp từ 08/2024 (fullstack .NET/React →
 * backend .NET → fullstack .NET/React), ERP, TP.HCM (Thủ Đức).
 *
 * ── Vì sao .NET 35 · React 10 · SQL 10, không phải 25/15/10 như plan §5.3 ──
 * CV nặng backend .NET: hai trong ba vị trí lấy .NET làm việc chính, React là
 * nửa còn lại của vị trí fullstack. Với 25/15/10, một tin "Back End Developer
 * C#, .NET, SQL" cấp Junior chỉ được 25 + 10 + 20 = 55 ("Hợp") — trong khi đó
 * là loại tin đúng nhất với CV này. Với 35/10/10 nó được 65 và lên "Rất hợp"
 * khi có thêm một hai kỹ năng cộng thêm; tin fullstack .NET + React được 75.
 * Tin React thuần (10 + 20) rơi vào "Với tới" — đúng mức: làm được, nhưng
 * không phải thế mạnh.
 */
export const SOFTWARE_CV_PROFILE: CvProfile = {
  version: 1,
  matchKey: 'tech',

  yearsExp: 2,
  yearsExpAsOf: '2026-09',

  core: [
    { label: '.NET/C#', skills: ['dotnet', 'aspnet', 'csharp'], weight: 35 },
    { label: 'React', skills: ['react'], weight: 10 },
    { label: 'SQL', skills: ['sqlserver', 'postgresql', 'oracle', 'sql'], weight: 10 },
  ],

  bonus: {
    skills: [
      'typescript',
      'efcore',
      'dapper',
      'mediatr',
      'clean-architecture',
      'microservices',
      'restful',
      'jwt',
      'docker',
      'jenkins',
      'cicd',
      'iis',
      'reactquery',
      'devextreme',
      'antd',
      'tailwind',
      'jira',
    ],
    each: 3,
    cap: 15,
  },

  level: {
    within: 20,
    plusOne: 14,
    plusTwo: 6,
    unknown: 10,
    underLevel: 5,
    seniorCap: 12,
    tooSeniorGap: 3,
    seniorTitleWords: [
      'lead',
      'leader',
      'manager',
      'principal',
      'architect',
      'head of',
      'director',
      'cto',
      'chief',
      'trưởng nhóm',
      'trưởng phòng',
    ],
    // CV 2 năm: việc thực tập / mới ra trường làm được nhưng là bước lùi.
    underLevelMaxBand: 'stretch',
  },

  conditions: {
    remoteOrHybrid: 5,
    homeDistrict: 5,
    // Thủ Đức và các quận đi lại dễ từ đó. Viết đúng như `extractDistrict`
    // trả về — nó đã quy Quận 2, Quận 9 về "Thủ Đức".
    homeDistricts: ['Thủ Đức', 'Bình Thạnh', 'Phú Nhuận', 'Dĩ An'],
    // Ba vị trí trong CV đều là ERP.
    domain: { skills: ['erp'], points: 5 },
  },

  otherStacks: {
    skills: [
      'java',
      'spring',
      'php',
      'laravel',
      'golang',
      'python',
      'django',
      'ruby',
      'nodejs',
      'kotlin',
      'cpp',
      'ios',
      'android',
      'flutter',
      'reactnative',
      'unity',
      'sap',
      'salesforce',
      'cobol',
    ],
    // Đo 17/09: "Remote Unity Developer WebGL / C#" lên mức Hợp nhờ chữ C#.
    exclusive: ['unity', 'sap', 'salesforce', 'cobol'],
    mixedPenalty: -10,
  },

  frontendMismatch: { skills: ['angular', 'vue'], unless: ['react'], penalty: -8 },

  gaps: [
    'azure',
    'aws',
    'gcp',
    'kubernetes',
    'redis',
    'rabbitmq',
    'kafka',
    'grpc',
    'signalr',
    'blazor',
    'nextjs',
    'mongodb',
    'mysql',
    'redux',
  ],

  language: {
    hardTitleWords: [
      'japanese',
      'tiếng nhật',
      'jlpt',
      'brse',
      'chinese',
      'tiếng trung',
      'korean',
      'tiếng hàn',
      'comtor',
    ],
    requiredSkills: ['req-japanese', 'req-chinese', 'req-korean'],
    softPenalty: -10,
    // IELTS 5.5 / TOEIC 520: đọc tài liệu tốt, giao tiếp lưu loát chưa chắc.
    englishSkill: 'req-english-fluent',
    englishTitleWords: ['english', 'tiếng anh'],
    englishPenalty: -5,
  },

  bands: { great: 70, good: 50, stretch: 30 },
};
