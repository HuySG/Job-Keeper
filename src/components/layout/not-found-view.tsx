import { Empty } from '@/components/ui/empty';

/**
 * Nội dung trang 404 — dùng chung cho 404 trong khung và 404 ngoài khung.
 *
 * CỐ Ý là component ĐỒNG BỘ, không đọc cookie hay header để biết workspace.
 * Đo 17/09/2026 trên Next 15.5: component 404 mà phải `await` thì giao diện
 * 404 chỉ nằm trong payload JavaScript — trình duyệt tắt JS nhận trang trắng,
 * trái lời hứa "chạy được khi chưa có JS". Nút dẫn về `/`, và middleware đưa
 * `/` về đúng workspace vừa xem, nên không cần biết workspace ở đây.
 */
export function NotFoundView() {
  return (
    <Empty
      title="Không tìm thấy trang hay tin này"
      actions={
        <a href="/" className="btn btn-primary h-11 px-5">
          Về trang đầu
        </a>
      }
    >
      Tin có thể đã bị xoá khỏi kho, hoặc số hiệu trong đường dẫn không đúng — số hiệu tin chỉ có
      nghĩa trong ngành của nó. Tin chỉ hết hạn thì vẫn còn: bật “Kể cả tin đã gỡ” ở Kho tin để tìm lại.
    </Empty>
  );
}
