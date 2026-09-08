import { buildUrl, type SearchParams } from '@/lib/query';

import { cx } from './tone';

/**
 * Dãy lựa chọn dựng bằng LIÊN KẾT, không phải dropdown.
 *
 * Dropdown bắt trả giá hai thao tác cho một ý định: mở ra, chọn, rồi còn phải
 * bấm "Áp dụng" mới ăn. Với ba tới bốn lựa chọn thì một dãy liên kết vừa ít
 * thao tác hơn, vừa cho thấy sẵn có những lựa chọn nào mà không phải mở ra
 * xem, vừa chạy được khi JavaScript chưa tải xong.
 *
 * Dùng chung cho "sắp xếp" ở kho tin và "xem theo chiều nào" ở trang lương —
 * đó là cùng một hình dạng tương tác nên phải là cùng một component.
 */
export function SegmentedLinks<T extends string>({
  pathname,
  params,
  name,
  current,
  options,
  label,
}: {
  pathname: string;
  params: SearchParams;
  /** Tên tham số trên URL mà dãy này điều khiển. */
  name: string;
  current: T;
  options: readonly { value: T; label: string }[];
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {label && <span className="mr-1 text-sm text-muted">{label}</span>}
      <div className="flex flex-wrap gap-0.5 rounded-lg bg-inset p-0.5">
        {options.map((option) => {
          const active = current === option.value;
          return (
            <a
              key={option.value}
              href={buildUrl(pathname, params, { [name]: option.value })}
              aria-current={active ? 'true' : undefined}
              className={cx(
                'rounded-md px-2.5 py-1 text-sm transition-colors',
                active
                  ? 'bg-surface font-medium text-text shadow-[0_1px_2px_rgb(0_0_0/0.06)]'
                  : 'text-muted hover:text-text',
              )}
            >
              {option.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
