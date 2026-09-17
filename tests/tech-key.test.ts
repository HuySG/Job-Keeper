import { describe, expect, it } from 'vitest';

import { toMatchKey, toTechKey } from '@/crawler/normalize/text';

/**
 * `toMatchKey` xoá mọi ký tự không phải chữ/số — nên ".NET" thành "net" (khớp
 * cả "network") và "C#" thành "c". `toTechKey` giữ nghĩa của tên công nghệ.
 * Tiêu đề dưới đây là tiêu đề THẬT trong CSDL swe, cào 17/09/2026.
 */
describe('toTechKey', () => {
  it.each([
    ['Sr .NET Backend Developer ASP.NET, C#, SQL, ReactJS', 'sr dotnet backend developer aspnet dotnet csharp sql reactjs react'],
    ['Lead Systems Support Engineer C#/.Net or Java', 'lead systems support engineer csharp dotnet or java'],
    ['MIDDLE BACKEND DEVELOPER (.NET Core / SQL)', 'middle backend developer dotnet core sql'],
    ['Fullstack Enginer .NET , C# C++', 'fullstack enginer dotnet csharp cpp'],
    ['Middle/Senior Developer NodeJS, ReactJS, AI', 'middle senior developer nodejs reactjs react ai'],
    ['Middle Frontend Developer React / Next.js', 'middle frontend developer react nextjs'],
    ['Senior Full-stack Mobile Developer Flutter, React Native', 'senior full stack mobile developer flutter reactnative'],
    ['LẬP TRÌNH VIÊN C#', 'lap trinh vien csharp'],
    ['Mid/Sr 3D Web Developer Three.JS, ReactJS, Game', 'mid sr 3d web developer threejs reactjs react game'],
  ])('%s', (input, expected) => {
    expect(toTechKey(input)).toBe(expected);
  });

  it('".net" trong tên miền KHÔNG phải .NET', () => {
    expect(toTechKey('Xem thêm tại example.net hoặc abc.net/jobs')).not.toContain('dotnet');
  });

  it('VB.NET, ADO.NET vẫn là .NET', () => {
    expect(toTechKey('VB.NET và ADO.NET')).toBe('vbnet dotnet va adonet dotnet');
  });

  it('CI/CD là một từ', () => {
    expect(toTechKey('Jenkins CI/CD pipeline')).toBe('jenkins cicd pipeline');
  });

  it('chuỗi không có tên công nghệ thì giống hệt toMatchKey', () => {
    const plain = 'Nhân Viên Thu Mua (Yêu Cầu Tiếng Trung) - Quận 7';
    expect(toTechKey(plain)).toBe(toMatchKey(plain));
  });

  it('"network", "internet" không bao giờ thành dotnet', () => {
    expect(toTechKey('Network Engineer - Internet Services')).toBe('network engineer internet services');
  });
});
