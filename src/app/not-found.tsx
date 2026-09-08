import { Empty } from '@/components/ui/empty';
import { PageHeader } from '@/components/ui/page-header';

export const metadata = { title: 'Không tìm thấy' };

export default function NotFound() {
  return (
    <>
      <PageHeader
        title="Không tìm thấy"
        description="Đường dẫn này không có trong bảng điều khiển."
      />
      <Empty title="Trang hoặc tin không tồn tại">
        Tin có thể đã bị xoá khỏi kho, hoặc số hiệu trong đường dẫn không đúng.{' '}
        <a href="/viec" className="text-accent-ink underline underline-offset-2">
          Về kho tin
        </a>
        .
      </Empty>
    </>
  );
}
