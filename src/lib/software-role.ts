import { SOFTWARE_ROLES, SOFTWARE_ROLE_UNKNOWN, type SoftwareRole } from '@/constants/software';
import { toTechKey } from '@/crawler/normalize/text';
import type { FitJob } from '@/lib/cv-fit';
import { matchSkills, type CompiledSkills } from '@/lib/skill-match';

/**
 * Xếp một tin lập trình vào LOẠI VIỆC — hàm thuần, như `classifyPurchase`.
 *
 * Bằng chứng theo thứ tự tin cậy: kỹ năng ở TIÊU ĐỀ + nguồn khai; chỉ khi hai
 * chỗ đó im lặng mới dùng kỹ năng thấy trong mô tả — mô tả hay liệt kê "nice
 * to have", để nó quyết loại việc là để một dòng "biết Java là lợi thế" biến
 * một việc .NET thành việc Java.
 *
 * Nhóm kỹ năng dưới đây là định nghĩa của LOẠI VIỆC, không phải của CV, nên
 * nằm trong code cùng thứ tự luật chứ không nằm trong hồ sơ.
 */
const CV_BACKEND = ['dotnet', 'aspnet', 'csharp'];
const REACT = ['react'];
const OTHER_FRONTEND = ['angular', 'vue'];
const OTHER_BACKEND = ['java', 'spring', 'php', 'laravel', 'golang', 'python', 'django', 'ruby', 'nodejs', 'kotlin', 'cpp'];
const MOBILE = ['flutter', 'reactnative', 'ios', 'android'];

const FULLSTACK_WORD = /(?:^| )full ?stack(?= |$)/;
const FRONTEND_WORD = /(?:^| )(?:front ?end)(?= |$)/;
const BACKEND_WORD = /(?:^| )(?:back ?end)(?= |$)/;
const DEVOPS_WORD = /(?:^| )(?:devops|sre|platform engineer|cloud engineer|site reliability)(?= |$)/;

type RoleInput = Pick<FitJob, 'title' | 'skills'>;

export function classifySoftwareRole(catalog: CompiledSkills, job: RoleInput): SoftwareRole {
  const titleKey = toTechKey(job.title);
  const primary = new Set(matchSkills(catalog, job.title));
  for (const [slug, origin] of job.skills) if (origin === 'declared') primary.add(slug);
  const skills = primary.size > 0 ? primary : new Set(job.skills.keys());

  const has = (group: readonly string[]): boolean => group.some((s) => skills.has(s));
  const fullstack = FULLSTACK_WORD.test(titleKey);

  const slug = ((): string => {
    if (has(CV_BACKEND) && (has(REACT) || fullstack)) return 'dotnet-fullstack';
    if (has(CV_BACKEND)) return 'dotnet-backend';
    if (has(MOBILE) && !has(REACT)) return 'mobile';
    if (fullstack || ((has(REACT) || has(OTHER_FRONTEND)) && has(OTHER_BACKEND))) return 'fullstack-khac';
    if (has(REACT)) return 'react-frontend';
    if (has(OTHER_FRONTEND)) return 'frontend-khac';
    if (has(OTHER_BACKEND) || BACKEND_WORD.test(titleKey)) return 'backend-khac';
    if (FRONTEND_WORD.test(titleKey)) return 'frontend-khac';
    if (DEVOPS_WORD.test(titleKey) || has(['docker', 'kubernetes'])) return 'devops';
    return SOFTWARE_ROLE_UNKNOWN.slug;
  })();

  return SOFTWARE_ROLES.find((r) => r.slug === slug) ?? SOFTWARE_ROLE_UNKNOWN;
}

/** Mọi loại, kèm "chưa phân loại" ở cuối — cho ô lọc. */
export function allSoftwareRoles(): SoftwareRole[] {
  return [...SOFTWARE_ROLES, SOFTWARE_ROLE_UNKNOWN];
}
