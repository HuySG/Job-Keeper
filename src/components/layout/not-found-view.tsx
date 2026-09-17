import { Empty } from '@/components/ui/empty';

/** Nội dung trang 404 — dùng chung cho 404 trong khung và 404 ngoài khung. */
export function NotFoundView() {
  return (
    <Empty
      title="Không tìm thấy trang hay tin này"
      actions={
        <>
          <a href="/nganh" className="btn btn-primary h-11 px-5">
            Về ngành của tôi
          </a>
          <a href="/viec" className="btn btn-secondary h-11 px-5">
            Mở kho tin
          </a>
        </>
      }
    >
      Tin có thể đã bị xoá khỏi kho, hoặc số hiệu trong đường dẫn không đúng. Tin chỉ hết hạn thì vẫn
      còn — bật “Kể cả tin đã gỡ” ở Kho tin để tìm lại.
    </Empty>
  );
}
