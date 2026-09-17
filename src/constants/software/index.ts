/**
 * LOẠI VIỆC của nghề lập trình — thay cho "loại mua hàng" ở workspace swe
 * (docs/plan-swe.md §5.5).
 *
 * Xét THEO THỨ TỰ trong `lib/software-role.ts`: hẹp trước rộng sau, và loại
 * gần CV nhất đứng đầu. Bảng này chỉ là nhãn + lời giải; luật nằm ở lib.
 */

export interface SoftwareRole {
  slug: string;
  label: string;
  /** Hiện khi rê chuột — loại này là việc gì. */
  hint: string;
}

export const SOFTWARE_ROLES: readonly SoftwareRole[] = [
  {
    slug: 'dotnet-fullstack',
    label: 'Fullstack .NET',
    hint: '.NET/C# kèm React hoặc ghi rõ fullstack — đúng hình của CV',
  },
  {
    slug: 'dotnet-backend',
    label: 'Backend .NET',
    hint: '.NET/C#, không nhắc framework frontend',
  },
  {
    slug: 'mobile',
    label: 'Mobile',
    hint: 'Flutter, React Native, iOS, Android',
  },
  {
    slug: 'fullstack-khac',
    label: 'Fullstack stack khác',
    hint: 'Fullstack với Node, Java, PHP, Python…',
  },
  {
    slug: 'react-frontend',
    label: 'Frontend React',
    hint: 'React, không có backend nào',
  },
  {
    slug: 'frontend-khac',
    label: 'Frontend khác',
    hint: 'Angular, Vue — không có React',
  },
  {
    slug: 'backend-khac',
    label: 'Backend stack khác',
    hint: 'Java, Go, Python, PHP, Node…',
  },
  {
    slug: 'devops',
    label: 'DevOps / hạ tầng',
    hint: 'DevOps, SRE, cloud, platform',
  },
];

/** Không phải một loại thật — là chỗ chứa. */
export const SOFTWARE_ROLE_UNKNOWN: SoftwareRole = {
  slug: 'chua-ro',
  label: 'Chưa phân loại',
  hint: 'Tiêu đề và kỹ năng không đủ để xếp loại',
};
