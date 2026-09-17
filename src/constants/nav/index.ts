/**
 * Năm màn hình chính, xếp theo thanh điều hướng ngang.
 *
 * Mỗi mục mang theo câu hỏi mà nó trả lời, chứ không chỉ một cái tên. Đây là
 * phép thử để giữ cho bảng điều khiển không phình ra: thêm một trang mà không
 * viết nổi câu hỏi nó trả lời, hoặc câu hỏi đó trùng với một trang đã có, thì
 * đó là một khối trong trang cũ chứ không phải một trang mới.
 *
 * Ba trang phụ — Tin đã lưu, Cài đặt, Bộ thành phần — KHÔNG nằm ở đây: chúng
 * là nút bên phải thanh điều hướng (`NAV_ACTIONS`), vì chúng phục vụ công cụ
 * chứ không trả lời một câu hỏi về thị trường việc làm.
 */

export interface NavItem {
  href: string;
  label: string;
  /** Câu trang này trả lời — hiện ở `title` của liên kết. */
  question: string;
}

export const NAV: readonly NavItem[] = [
  {
    href: '/',
    label: 'Tổng quan',
    question: 'Kho tin đang có gì, và có đáng tin không?',
  },
  {
    href: '/nganh',
    label: 'Ngành của tôi',
    question: 'Tin nào đúng ngành tôi nhắm, và có còn tuyển không?',
  },
  {
    href: '/viec',
    label: 'Kho tin',
    question: 'Tin nào khớp với thứ tôi đang tìm?',
  },
  {
    href: '/luong',
    label: 'Lương',
    question: 'Ngành tôi trả bao nhiêu, và bao nhiêu tin dám ghi số?',
  },
  {
    href: '/nguon',
    label: 'Nguồn & vận hành',
    question: 'Crawler còn sống không, nguồn nào đang hỏng?',
  },
] as const;

/** Nút phụ bên phải thanh điều hướng. */
export const NAV_ACTIONS = {
  components: { href: '/thanh-phan', label: 'Chuyển động và thành phần' },
  saved: { href: '/da-luu', label: 'Tin đã lưu' },
  settings: { href: '/cai-dat', label: 'Cài đặt ngành và từ khoá' },
} as const;

/** Trang đang mở có thuộc mục này không. `/` chỉ khớp đúng chính nó. */
export function isActivePath(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
