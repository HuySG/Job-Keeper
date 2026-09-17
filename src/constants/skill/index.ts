import type { WorkspaceId } from '@/constants/workspace';

/**
 * Danh mục KỸ NĂNG — nạp vào bảng `Skill` + `SkillAlias` của từng workspace.
 *
 * Dữ liệu seed như `sourceSeedsFor`: sau khi nạp, bí danh sửa được bằng SQL.
 * Workspace bae không có kỹ năng nào — nghề thu mua chia loại theo NGÀNH của
 * công ty (constants/purchase), không theo kỹ năng — nên bảng `Skill` của CSDL
 * bae rỗng và crawler không ghi `JobSkill` nào ở đó.
 *
 * Bí danh viết như người ta viết ngoài đời (".net", "c#", "sql server"); lúc
 * biên dịch chúng đi qua `toTechKey`, và khớp CẢ HAI ĐẦU từ — khác từ điển
 * ngành chỉ chặn đầu từ — vì "java" không được khớp "javascript", "react"
 * không được khớp "reactive". Xem docs/plan-swe.md §4.3, §9.4.
 *
 * Tránh bí danh là một từ tiếng Việt khi đã bỏ dấu: "sáp nhập" thành
 * "sap nhap", nên "sap" trần sẽ bắt nhầm — dùng "sap abap", "sap fico"...
 */

export type SkillCategory = 'LANG' | 'FRAMEWORK' | 'DB' | 'CLOUD' | 'TOOL' | 'DOMAIN' | 'REQ';

export interface SkillSeed {
  slug: string;
  name: string;
  category: SkillCategory;
  aliases: readonly string[];
}

const skill = (
  slug: string,
  name: string,
  category: SkillCategory,
  aliases: readonly string[],
): SkillSeed => ({ slug, name, category, aliases });

const SOFTWARE_SKILLS: readonly SkillSeed[] = [
  // ── Ngôn ngữ ──────────────────────────────────────────────────────────────
  skill('csharp', 'C#', 'LANG', ['c#', 'csharp', 'c sharp']),
  skill('typescript', 'TypeScript', 'LANG', ['typescript']),
  skill('javascript', 'JavaScript', 'LANG', ['javascript', 'es6']),
  skill('java', 'Java', 'LANG', ['java']),
  skill('python', 'Python', 'LANG', ['python']),
  skill('php', 'PHP', 'LANG', ['php']),
  skill('golang', 'Go', 'LANG', ['golang', 'go lang']),
  skill('ruby', 'Ruby', 'LANG', ['ruby', 'ruby on rails', 'rails']),
  skill('kotlin', 'Kotlin', 'LANG', ['kotlin']),
  skill('cpp', 'C++', 'LANG', ['c++', 'cpp']),
  skill('cobol', 'COBOL', 'LANG', ['cobol']),

  // ── Framework ─────────────────────────────────────────────────────────────
  // "net core", "net framework" viết không dấu chấm vì VNW đã bỏ dấu chấm
  // trong tiêu đề ("NET Development Engineer" — đo 17/09/2026).
  skill('dotnet', '.NET', 'FRAMEWORK', ['.net', 'dotnet', 'net core', 'net framework']),
  skill('aspnet', 'ASP.NET', 'FRAMEWORK', ['asp.net', 'aspnet', 'asp net']),
  skill('efcore', 'Entity Framework', 'FRAMEWORK', ['entity framework', 'ef core', 'efcore']),
  skill('dapper', 'Dapper', 'FRAMEWORK', ['dapper']),
  skill('mediatr', 'MediatR', 'FRAMEWORK', ['mediatr']),
  skill('blazor', 'Blazor', 'FRAMEWORK', ['blazor']),
  skill('signalr', 'SignalR', 'FRAMEWORK', ['signalr']),
  skill('react', 'React', 'FRAMEWORK', ['react', 'reactjs']),
  skill('reactnative', 'React Native', 'FRAMEWORK', ['react native', 'reactnative']),
  skill('angular', 'Angular', 'FRAMEWORK', ['angular', 'angularjs']),
  skill('vue', 'Vue', 'FRAMEWORK', ['vue', 'vuejs', 'nuxt', 'nuxtjs']),
  skill('nextjs', 'Next.js', 'FRAMEWORK', ['next.js', 'nextjs']),
  skill('nodejs', 'Node.js', 'FRAMEWORK', ['node.js', 'nodejs', 'nest.js', 'nestjs', 'expressjs']),
  // Không có "spring" trần — chữ tiếng Anh thường.
  skill('spring', 'Spring', 'FRAMEWORK', ['spring boot', 'springboot', 'spring framework', 'spring mvc']),
  skill('laravel', 'Laravel', 'FRAMEWORK', ['laravel']),
  skill('django', 'Django / FastAPI', 'FRAMEWORK', ['django', 'fastapi', 'flask']),
  skill('flutter', 'Flutter', 'FRAMEWORK', ['flutter']),
  skill('ios', 'iOS', 'FRAMEWORK', ['ios', 'swiftui']),
  skill('android', 'Android', 'FRAMEWORK', ['android']),
  skill('unity', 'Unity', 'FRAMEWORK', ['unity', 'unity3d']),
  skill('redux', 'Redux', 'FRAMEWORK', ['redux']),
  skill('reactquery', 'React Query', 'FRAMEWORK', ['react query', 'react-query', 'tanstack query']),
  skill('devextreme', 'DevExtreme', 'FRAMEWORK', ['devextreme', 'devexpress']),
  skill('antd', 'Ant Design', 'FRAMEWORK', ['ant design', 'antd']),
  skill('tailwind', 'Tailwind CSS', 'FRAMEWORK', ['tailwind', 'tailwindcss']),

  // ── CSDL ──────────────────────────────────────────────────────────────────
  skill('sqlserver', 'SQL Server', 'DB', ['sql server', 'mssql', 'ms sql', 't-sql', 'tsql']),
  skill('postgresql', 'PostgreSQL', 'DB', ['postgresql', 'postgres']),
  skill('oracle', 'Oracle', 'DB', ['oracle', 'pl/sql', 'plsql']),
  skill('mysql', 'MySQL', 'DB', ['mysql']),
  skill('mongodb', 'MongoDB', 'DB', ['mongodb', 'mongo']),
  skill('redis', 'Redis', 'DB', ['redis']),
  // SQL chung chung — vẫn là bằng chứng cho nhóm "lõi CSDL" của CV.
  skill('sql', 'SQL', 'DB', ['sql']),

  // ── Cloud ─────────────────────────────────────────────────────────────────
  skill('azure', 'Azure', 'CLOUD', ['azure']),
  skill('aws', 'AWS', 'CLOUD', ['aws', 'amazon web services']),
  skill('gcp', 'Google Cloud', 'CLOUD', ['gcp', 'google cloud']),

  // ── Công cụ ───────────────────────────────────────────────────────────────
  skill('docker', 'Docker', 'TOOL', ['docker', 'docker compose']),
  skill('kubernetes', 'Kubernetes', 'TOOL', ['kubernetes', 'k8s']),
  skill('jenkins', 'Jenkins', 'TOOL', ['jenkins']),
  skill('cicd', 'CI/CD', 'TOOL', ['ci/cd', 'cicd']),
  skill('iis', 'IIS', 'TOOL', ['iis']),
  skill('rabbitmq', 'RabbitMQ', 'TOOL', ['rabbitmq']),
  skill('kafka', 'Kafka', 'TOOL', ['kafka']),
  skill('grpc', 'gRPC', 'TOOL', ['grpc']),
  skill('jira', 'Jira', 'TOOL', ['jira']),

  // ── Miền nghiệp vụ / kiến trúc ───────────────────────────────────────────
  skill('erp', 'ERP', 'DOMAIN', ['erp']),
  skill('clean-architecture', 'Clean Architecture', 'DOMAIN', ['clean architecture']),
  skill('microservices', 'Microservices', 'DOMAIN', ['microservice', 'microservices']),
  skill('restful', 'REST API', 'DOMAIN', ['restful', 'rest api', 'restful api']),
  skill('jwt', 'JWT', 'DOMAIN', ['jwt']),
  skill('sap', 'SAP', 'DOMAIN', ['abap', 'sap abap', 'sap fico', 'sap hana', 'sap erp', 'sap mm', 'sap sd']),
  skill('salesforce', 'Salesforce', 'DOMAIN', ['salesforce']),

  // ── Yêu cầu ngoài kỹ thuật ───────────────────────────────────────────────
  //
  // Lưu thành "kỹ năng" loại REQ để khỏi thêm cột (plan-swe §8.6). Cố ý KHÔNG có
  // "japanese" trần: mô tả IT hay nhắc "khách hàng Nhật" mà không đòi tiếng
  // Nhật. Chữ "Japanese" ở TIÊU ĐỀ thì bộ chấm độ hợp xét riêng.
  skill('req-japanese', 'Tiếng Nhật', 'REQ', [
    'jlpt',
    'tiếng nhật',
    'nihongo',
    'brse',
    'bridge se',
    'bridge system engineer',
    'japanese n1',
    'japanese n2',
    'japanese n3',
    'japanese language',
    'japanese speaking',
    'speak japanese',
  ]),
  skill('req-chinese', 'Tiếng Trung', 'REQ', ['tiếng trung', 'chinese speaking', 'mandarin', 'hsk']),
  skill('req-korean', 'Tiếng Hàn', 'REQ', ['tiếng hàn', 'korean speaking', 'topik']),
  skill('req-english-fluent', 'Tiếng Anh lưu loát', 'REQ', [
    'fluent english',
    'fluent in english',
    'english fluently',
    'fluency in english',
    'excellent english',
    'good english',
    'strong english',
    'business english',
    'tiếng anh lưu loát',
    'tiếng anh thành thạo',
    'giao tiếp tiếng anh tốt',
  ]),
];

export const SKILL_SEEDS: Readonly<Record<WorkspaceId, readonly SkillSeed[]>> = {
  bae: [],
  swe: SOFTWARE_SKILLS,
};
