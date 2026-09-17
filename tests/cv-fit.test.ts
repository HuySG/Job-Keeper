import { describe, expect, it } from 'vitest';

import { SOFTWARE_CV_PROFILE as profile } from '@/constants/profile';
import { SKILL_SEEDS } from '@/constants/skill';
import { CvProfileSchema, parseCvProfile } from '@/lib/cv-profile';
import { explainFit, scoreFit, type FitJob } from '@/lib/cv-fit';
import { compileSkills, type SkillOrigin } from '@/lib/skill-match';
import { classifySoftwareRole } from '@/lib/software-role';

const catalog = compileSkills(SKILL_SEEDS.swe);

/** Dựng một tin: `declared` là kỹ năng nguồn khai, `text` là chỉ thấy trong mô tả. */
function job(
  title: string,
  opts: Partial<Omit<FitJob, 'title' | 'skills'>> & { declared?: string[]; text?: string[] } = {},
): FitJob {
  const skills = new Map<string, SkillOrigin>();
  for (const s of opts.text ?? []) skills.set(s, 'text');
  for (const s of opts.declared ?? []) skills.set(s, 'declared');
  return {
    title,
    level: opts.level ?? null,
    yearsExpMin: opts.yearsExpMin ?? null,
    workMode: opts.workMode ?? null,
    district: opts.district ?? null,
    skills,
  };
}

const fit = (j: FitJob) => scoreFit(profile, catalog, j);

describe('hồ sơ CV', () => {
  it('hồ sơ seed hợp lệ theo schema', () => {
    expect(CvProfileSchema.safeParse(profile).success).toBe(true);
  });

  it('mọi slug trong hồ sơ đều có trong danh mục kỹ năng', () => {
    const known = new Set(SKILL_SEEDS.swe.map((s) => s.slug));
    const used = [
      ...profile.core.flatMap((g) => g.skills),
      ...profile.bonus.skills,
      ...profile.conditions.domain.skills,
      ...profile.otherStacks.skills,
      ...profile.otherStacks.exclusive,
      ...profile.frontendMismatch.skills,
      ...profile.frontendMismatch.unless,
      ...profile.gaps,
      ...profile.language.requiredSkills,
      profile.language.englishSkill,
    ];
    expect(used.filter((slug) => !known.has(slug))).toEqual([]);
  });

  it('JSON hỏng thì nói đúng khoá hỏng; null là hợp lệ', () => {
    expect(parseCvProfile(null)).toEqual({ ok: true, profile: null });
    const broken = parseCvProfile({ ...profile, bands: { great: 'cao' } });
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.error).toContain('bands');
  });
});

// Tiêu đề, cấp bậc, số năm dưới đây là của tin THẬT trong CSDL swe (17/09/2026);
// danh sách kỹ năng là dạng nguồn khai điển hình của ITviec/VNW.
describe('scoreFit — mức hợp trên tin thật', () => {
  it('Fullstack .NET + React, Junior 1 năm → Rất hợp', () => {
    const r = fit(
      job('Fullstack Developer .NET, ReactJS', {
        level: 'JUNIOR',
        yearsExpMin: 1,
        declared: ['dotnet', 'react', 'sqlserver'],
      }),
    );
    expect(r.band).toBe('great');
    expect(r.score).toBe(35 + 10 + 10 + 20);
    expect(r.flags).toEqual([]);
  });

  it('Backend .NET thuần, Junior, có EF Core + Docker → Rất hợp', () => {
    const r = fit(
      job('Back End Developer C#, .NET, SQL', {
        level: 'JUNIOR',
        yearsExpMin: 1,
        declared: ['csharp', 'dotnet', 'sql'],
        text: ['efcore', 'docker'],
      }),
    );
    expect(r.score).toBe(35 + 10 + 20 + 6);
    expect(r.band).toBe('great');
  });

  it('.NET chỉ thấy trong MÔ TẢ → nửa điểm', () => {
    const r = fit(job('Software Engineer', { yearsExpMin: 2, text: ['dotnet'] }));
    expect(r.score).toBe(Math.round(35 / 2) + 20);
  });

  it('Senior .NET, đòi 3 năm, tiêu đề ghi English → Với tới', () => {
    const r = fit(
      job('Senior .NET Engineer Fintech domain, English', { level: 'SENIOR', yearsExpMin: 3 }),
    );
    // .NET ở tiêu đề 35 · cấp Senior bị chặn trần 12 · tiếng Anh −5
    expect(r.score).toBe(35 + 12 - 5);
    expect(r.band).toBe('stretch');
    expect(r.reasons.join(' ')).toContain('tiếng Anh');
  });

  it('"Lead Fullstack Developer .NET Angular" → Lệch, cờ quá tầm', () => {
    const r = fit(job('Lead Fullstack Developer .NET Angular', { level: 'MID', yearsExpMin: 4 }));
    expect(r.band).toBe('off');
    expect(r.flags).toContain('too-senior');
  });

  it('đòi 5 năm (CV 2 năm) → cờ quá tầm', () => {
    const r = fit(job('.NET Developer', { yearsExpMin: 5, declared: ['dotnet'] }));
    expect(r.flags).toContain('too-senior');
    expect(r.band).toBe('off');
  });

  it('"Senior Software Engineer Java, C, Japanese" → Lệch, hai cờ', () => {
    const r = fit(job('Senior Software Engineer Java, C, Japanese', { level: 'SENIOR', yearsExpMin: 3 }));
    expect(r.band).toBe('off');
    expect(r.flags).toEqual(expect.arrayContaining(['other-stack', 'lang-required']));
  });

  it('"NET Development Engineer (Chinese Speaking)" → cờ ngoại ngữ', () => {
    expect(fit(job('NET Development Engineer (Chinese Speaking)')).flags).toContain('lang-required');
  });

  it('Java + React ở tiêu đề: không phải cờ cứng, nhưng bị trừ và rơi xuống thấp', () => {
    const r = fit(job('Full-Stack Developer (Java, Reactjs)', { level: 'MID', yearsExpMin: 3 }));
    expect(r.flags).toEqual([]);
    expect(r.score).toBe(10 + 14 - 10);
    expect(r.band).toBe('off');
  });

  it('React thuần → Với tới, và kể ra kỹ năng CV chưa có', () => {
    const r = fit(job('Middle Frontend Developer React / Next.js', { level: 'JUNIOR', yearsExpMin: 1 }));
    expect(r.band).toBe('stretch');
    expect(r.missing).toEqual(['nextjs']);
  });

  it('Angular thay cho React → trừ điểm', () => {
    const r = fit(job('Fullstack Engineer (.NET, Angular)', { yearsExpMin: 2 }));
    expect(r.score).toBe(35 + 20 - 8);
  });

  it('Thực tập .NET → điểm cấp bậc thấp, nêu lý do', () => {
    const r = fit(job('Intern .NET Developer English', { level: 'INTERN' }));
    expect(r.score).toBe(35 + 5 - 5);
    expect(r.reasons.join(' ')).toContain('thực tập');
  });

  it('remote + gần nhà + miền ERP → cộng điểm điều kiện', () => {
    const base = fit(job('.NET Developer', { yearsExpMin: 2 }));
    const plus = fit(
      job('.NET Developer', { yearsExpMin: 2, workMode: 'REMOTE', district: 'Thủ Đức', text: ['erp'] }),
    );
    expect(plus.score - base.score).toBe(15);
  });

  it('mô tả nhắc tiếng Nhật → trừ điểm, KHÔNG phải cờ cứng', () => {
    const r = fit(job('.NET Developer', { yearsExpMin: 2, text: ['req-japanese'] }));
    expect(r.flags).toEqual([]);
    expect(r.score).toBe(35 + 20 - 10);
  });

  // Ba ca dưới đây lộ ra khi soi mức "Hợp" trên CSDL swe (17/09/2026).
  it('"Remote Unity Developer WebGL / C# / JavaScript" → Lệch: Unity là nghề khác dù có C#', () => {
    const r = fit(job('Remote Unity Developer WebGL / C# / JavaScript', { level: 'JUNIOR', yearsExpMin: 1 }));
    expect(r.band).toBe('off');
    expect(r.flags).toContain('other-stack');
    expect(r.reasons.join(' ')).toContain('nghề khác: Unity');
  });

  it('"Intern .NET Developer" không bao giờ cao hơn Với tới, dù điểm đủ Hợp', () => {
    const r = fit(
      job('Intern .NET Developer', {
        level: 'INTERN',
        workMode: 'HYBRID',
        district: 'Phú Nhuận',
        declared: ['dotnet', 'sql'],
      }),
    );
    expect(r.score).toBeGreaterThanOrEqual(profile.bands.good);
    expect(r.band).toBe('stretch');
  });

  it('không bóc được kỹ năng nào → "không đủ dữ liệu", không quy thành Lệch', () => {
    expect(fit(job('Software Engineer', { yearsExpMin: 2 })).band).toBe('unknown');
  });

  it('điểm luôn nằm trong 0–100', () => {
    const r = fit(job('Java Developer React', { level: 'INTERN', text: ['req-japanese', 'angular'] }));
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe('explainFit — lời giải, không phần trăm', () => {
  it('nêu khớp gì, thiếu gì, vì sao', () => {
    const r = fit(
      job('Senior Back-End Developer .NET', {
        level: 'SENIOR',
        yearsExpMin: 3,
        declared: ['dotnet', 'sqlserver', 'azure'],
      }),
    );
    const text = explainFit(r, catalog);
    expect(text).toContain('khớp .NET, SQL Server');
    expect(text).toContain('thiếu Azure');
    expect(text).toContain('đòi 3 năm');
    expect(text).not.toMatch(/%/);
  });
});

describe('classifySoftwareRole', () => {
  const role = (title: string, declared: string[] = []) =>
    classifySoftwareRole(catalog, job(title, { declared })).slug;

  it.each([
    ['Fullstack Developer .NET, ReactJS', 'dotnet-fullstack'],
    ['Lead Fullstack Developer .NET Angular', 'dotnet-fullstack'],
    ['Senior .NET Back-end Developer C#, ASP.NET', 'dotnet-backend'],
    ['LẬP TRÌNH VIÊN C#', 'dotnet-backend'],
    ['Full-Stack Developer (Java, Reactjs)', 'fullstack-khac'],
    ['Senior Front-End Developer React', 'react-frontend'],
    ['Principal Frontend Engineer ReactJS/ VueJS', 'react-frontend'],
    ['Frontend Developer VueJS', 'frontend-khac'],
    ['Senior Backend Developer Java/Springboot', 'backend-khac'],
    ['Senior Full-stack Mobile Developer Flutter, React Native', 'mobile'],
    ['DevOps Engineer Microsoft Azure', 'devops'],
    ['Kỹ sư phần mềm', 'chua-ro'],
  ])('%s → %s', (title, expected) => {
    expect(role(title)).toBe(expected);
  });

  it('tiêu đề im lặng thì dùng kỹ năng nguồn khai', () => {
    expect(role('Software Engineer', ['csharp', 'react'])).toBe('dotnet-fullstack');
  });
});
