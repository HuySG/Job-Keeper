/**
 * Bốn màn hình của bảng điều khiển.
 *
 * Mỗi mục mang theo câu hỏi mà nó trả lời, chứ không chỉ một cái tên. Đây là
 * phép thử để giữ cho bảng điều khiển không phình ra: thêm một trang mà không
 * viết nổi câu hỏi nó trả lời, hoặc câu hỏi đó trùng với một trang đã có, thì
 * đó là một khối trong trang cũ chứ không phải một trang mới.
 */

export interface NavItem {
  href: string;
  label: string;
  /** Câu trang này trả lời. Hiện ở đầu trang, không phải khẩu hiệu. */
  question: string;
  icon: IconName;
}

export type IconName = 'gauge' | 'target' | 'list' | 'money' | 'plug';

export const NAV: readonly NavItem[] = [
  {
    href: '/',
    label: 'Tổng quan',
    question: 'Kho tin đang có gì, và có đáng tin không?',
    icon: 'gauge',
  },
  {
    href: '/nganh',
    label: 'Ngành của tôi',
    question: 'Tin nào đúng ngành tôi nhắm, và có còn tuyển không?',
    icon: 'target',
  },
  {
    href: '/viec',
    label: 'Kho tin',
    question: 'Tin nào khớp với thứ tôi đang tìm?',
    icon: 'list',
  },
  {
    href: '/luong',
    label: 'Lương',
    question: 'Mức nào là phổ biến, và bao nhiêu tin dám ghi số?',
    icon: 'money',
  },
  {
    href: '/nguon',
    label: 'Nguồn & vận hành',
    question: 'Crawler còn sống không, nguồn nào đang hỏng?',
    icon: 'plug',
  },
] as const;

/**
 * Câu hỏi của một trang, tra theo đường dẫn.
 *
 * Trước đây mỗi trang tự lấy `NAV[2]`, `NAV[3]`... theo chỉ số. Chèn thêm một
 * mục vào giữa là mọi trang phía sau lặng lẽ hiện câu hỏi của trang khác —
 * không lỗi, không cảnh báo, chỉ sai. Tra theo href thì thứ tự đổi thoải mái.
 */
export function questionFor(href: string): string {
  return NAV.find((item) => item.href === href)?.question ?? '';
}
