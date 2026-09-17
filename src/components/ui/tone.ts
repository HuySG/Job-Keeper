/**
 * Gộp danh sách lớp, bỏ qua `false`/`undefined`. Đủ dùng, không cần `clsx`.
 *
 * Bảng dịch "vai trò màu → lớp Tailwind" (`TONE`) từng nằm ở đây cho các
 * badge của bản cũ. Bản v2 không còn badge nhiều sắc: trạng thái được nói bằng
 * chấm còn-sống, nhãn `tag-*` và hộp `Callout`, mỗi thứ tự khai màu của nó.
 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
