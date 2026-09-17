import { describe, expect, it } from 'vitest';

import { SKILL_SEEDS } from '@/constants/skill';
import { toTechKey } from '@/crawler/normalize/text';
import { compileSkills, extractSkills, matchSkills } from '@/lib/skill-match';

import itviec from './fixtures/itviec-job.json';

const catalog = compileSkills(SKILL_SEEDS.swe);
const found = (text: string): string[] => [...matchSkills(catalog, text)].sort();

describe('danh mục kỹ năng', () => {
  it('không bí danh nào thuộc về HAI kỹ năng khác nhau', () => {
    // Trùng trong CÙNG một kỹ năng thì vô hại ("c#" và "csharp" cùng ra
    // "csharp") — viết cả hai để đọc là biết khớp được những gì.
    const owner = new Map<string, string>();
    for (const s of SKILL_SEEDS.swe) {
      for (const alias of s.aliases) {
        const key = toTechKey(alias);
        const prev = owner.get(key);
        expect(prev === undefined || prev === s.slug, `"${alias}" của ${s.slug} trùng với ${prev}`).toBe(true);
        owner.set(key, s.slug);
      }
    }
  });

  it('bí danh viết ra là duy nhất (SkillAlias.raw @unique)', () => {
    const raws = SKILL_SEEDS.swe.flatMap((s) => s.aliases);
    expect(new Set(raws).size).toBe(raws.length);
  });

  it('workspace bae không có kỹ năng nào', () => {
    expect(SKILL_SEEDS.bae).toHaveLength(0);
    expect(compileSkills(SKILL_SEEDS.bae).size).toBe(0);
  });
});

describe('matchSkills trên tiêu đề THẬT (CSDL swe, 17/09/2026)', () => {
  it('Sr .NET Backend Developer ASP.NET, C#, SQL, ReactJS', () => {
    expect(found('Sr .NET Backend Developer ASP.NET, C#, SQL, ReactJS')).toEqual(
      ['aspnet', 'csharp', 'dotnet', 'react', 'sql'],
    );
  });

  it('React Native KHÔNG phải React', () => {
    expect(found('Senior Full-stack Mobile Developer Flutter, React Native')).toEqual([
      'flutter',
      'reactnative',
    ]);
  });

  it('JavaScript KHÔNG phải Java', () => {
    expect(found('Frontend Developer JavaScript')).toEqual(['javascript']);
    expect(found('Java Professional Developer')).toEqual(['java']);
  });

  it('chuỗi SQL cụ thể', () => {
    expect(found('MIDDLE BACKEND DEVELOPER (.NET Core / SQL)')).toEqual(['dotnet', 'sql']);
    expect(found('Database Developer SQL Server, Oracle, PL/SQL')).toEqual(['oracle', 'sql', 'sqlserver']);
  });

  it('không bắt nhầm', () => {
    expect(found('Network Engineer - Internet Services')).toEqual([]);
    expect(found('Chuyên viên pháp chế sáp nhập doanh nghiệp')).toEqual([]);
    expect(found('Reactive programming with RxJS')).toEqual([]);
  });

  it('tiếng Nhật: chỉ khi thật sự đòi, không phải khi nhắc tới khách Nhật', () => {
    expect(found('Làm việc với khách hàng Japanese, công ty Nhật')).toEqual([]);
    expect(found('Yêu cầu JLPT N2 trở lên')).toEqual(['req-japanese']);
    expect(found('Có tiếng Nhật là lợi thế')).toEqual(['req-japanese']);
  });
});

describe('extractSkills — hai tầng như classifyPurchase', () => {
  it('kỹ năng nguồn khai (fixture ITviec thật) là "declared"', () => {
    const skills = extractSkills(catalog, {
      title: 'Backend Engineer',
      description: null,
      declared: itviec.skills.split(','),
    });
    expect(Object.fromEntries(skills)).toEqual({
      python: 'declared',
      django: 'declared',
      docker: 'declared',
      golang: 'declared',
      cpp: 'declared',
    });
  });

  it('chỉ thấy trong tiêu đề/mô tả là "text"; nguồn khai thắng khi có cả hai', () => {
    const skills = extractSkills(catalog, {
      title: 'Fullstack Developer .NET, ReactJS',
      description: 'Làm việc với SQL Server, Docker và Azure DevOps.',
      declared: ['ReactJS'],
    });
    expect(skills.get('react')).toBe('declared');
    expect(skills.get('dotnet')).toBe('text');
    expect(skills.get('sqlserver')).toBe('text');
    expect(skills.get('azure')).toBe('text');
  });

  it('danh mục rỗng thì không làm gì', () => {
    const empty = compileSkills([]);
    expect(extractSkills(empty, { title: 'C# Developer', description: null, declared: [] }).size).toBe(0);
  });
});
