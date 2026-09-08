import type { Facet } from '@/api/field.api';
import { TONE, cx } from '@/components/ui/tone';
import { buildUrl, type SearchParams } from '@/lib/query';

/**
 * Một dãy chip lọc, mỗi chip kèm SỐ TIN.
 *
 * Con số trong ngoặc là phần quan trọng nhất, không phải trang trí: nó cho biết
 * bấm vào sẽ còn lại bao nhiêu, nên người dùng không bao giờ bấm vào một bộ lọc
 * để rồi nhận danh sách rỗng. Nó cũng chính là bảng LIỆT KÊ mà trang này cần —
 * "ngành mua hàng có những loại nào, mỗi loại bao nhiêu tin" được trả lời ngay
 * trên thanh lọc, không cần một khối thống kê riêng.
 *
 * Dựng bằng LIÊN KẾT chứ không phải dropdown, giống `SegmentedLinks`: thấy
 * ngay các lựa chọn mà không phải mở ra, dán được URL, và chạy cả khi
 * JavaScript chưa tải xong.
 */
export function FacetFilter({
  pathname,
  params,
  name,
  label,
  facets,
  current,
  allLabel = 'Tất cả',
  /** Câu nói thật về độ phủ, hiện mờ bên cạnh nhãn. */
  coverage,
  max = 12,
}: {
  pathname: string;
  params: SearchParams;
  name: string;
  label: string;
  facets: Facet[];
  current?: string;
  allLabel?: string;
  coverage?: string;
  max?: number;
}) {
  if (facets.length === 0) return null;

  const shown = facets.slice(0, max);
  // Giá trị đang chọn phải LUÔN hiện, kể cả khi nó rơi ra ngoài `max` — nếu
  // không thì người dùng thấy một bộ lọc đang bật mà không có cách nào tắt.
  if (current && !shown.some((f) => f.value === current)) {
    const active = facets.find((f) => f.value === current);
    if (active) shown.push(active);
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1.5">
      <span className="text-xs text-muted">
        {label}
        {coverage && <span className="ml-1 opacity-70">({coverage})</span>}
      </span>

      <Chip href={buildUrl(pathname, params, { [name]: undefined })} active={!current}>
        {allLabel}
      </Chip>

      {shown.map((facet) => (
        <Chip
          key={facet.value}
          href={buildUrl(pathname, params, {
            // Bấm lại chip đang bật thì TẮT nó. Không có lối tắt này thì người
            // dùng phải đi tìm nút "Tất cả" mỗi lần đổi ý.
            [name]: facet.value === current ? undefined : facet.value,
          })}
          active={facet.value === current}
          title={facet.hint}
        >
          {facet.label}
          {/* `count === 0` nghĩa là chiều này KHÔNG đếm trước được (mốc lương),
              chứ không phải "có 0 tin" — `countBy` không bao giờ sinh ra 0.
              Hiện số 0 ở đó là nói dối người đọc. */}
          {facet.count > 0 && <span className="tnum ml-1 opacity-60">{facet.count}</span>}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  href,
  active,
  title,
  children,
}: {
  href: string;
  active: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      title={title}
      aria-current={active ? 'true' : undefined}
      // Chip đang bật dùng cặp nền-nhạt/chữ-đậm của hệ màu, KHÔNG dùng nền đặc
      // với chữ trắng: `accent-ink` ở chế độ tối là xanh NHẠT, chữ trắng đè lên
      // sẽ gần như không đọc được. Cặp `accent-soft`/`accent-ink` được định
      // nghĩa lại cho cả hai chế độ nên luôn tương phản đủ.
      className={cx(
        'rounded-md px-2 py-0.5 text-xs whitespace-nowrap transition-colors',
        active
          ? cx(TONE.accent.soft, 'font-medium ring-1 ring-inset ring-accent/40')
          : 'bg-inset text-muted hover:text-text',
      )}
    >
      {children}
    </a>
  );
}
