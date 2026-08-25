import { SourceKind } from '@/enums';

import { genericJsonLdAdapter } from './generic-jsonld';
import { vietnamworksAdapter } from './vietnamworks';
import type { SourceAdapter, SourceConfig } from './types';

/**
 * Sổ đăng ký adapter.
 *
 * Cố ý CHỈ có hai adapter cho sáu nguồn. Đó là cả điểm mấu chốt: năm nguồn
 * chạy chung `generic-jsonld` và chỉ khác nhau ở cấu hình lưu trong DB, còn
 * adapter riêng chỉ viết khi nguồn khác về bản chất (VietnamWorks có API).
 *
 * Nếu số adapter bắt đầu tăng cùng nhịp với số nguồn thì kiến trúc đã sai ở
 * đâu đó — hãy xem lại vì sao nguồn mới không dùng được JSON-LD, thay vì viết
 * thêm file thứ bảy.
 */
const ADAPTERS: Record<SourceKind, SourceAdapter> = {
  [SourceKind.API]: vietnamworksAdapter,
  [SourceKind.SITEMAP_JSONLD]: genericJsonLdAdapter,
  // Nguồn không có sitemap dùng được vẫn đi qua đúng adapter JSON-LD, chỉ khác
  // ở chỗ entryUrl trỏ vào trang danh sách. Chưa dùng tới ở giai đoạn này.
  [SourceKind.LIST_JSONLD]: genericJsonLdAdapter,
};

/**
 * Nguồn kiểu API mỗi cái một adapter riêng, vì API thì không sàn nào giống sàn
 * nào. Tra theo `code` trước, không có thì mới rơi về adapter theo `kind`.
 */
const BY_CODE: Record<string, SourceAdapter> = {
  vnw: vietnamworksAdapter,
};

export function getAdapter(source: SourceConfig): SourceAdapter {
  const byCode = BY_CODE[source.code];
  if (byCode) return byCode;

  const byKind = ADAPTERS[source.kind];
  if (byKind) return byKind;

  throw new Error(
    `Không có adapter cho nguồn "${source.code}" (kind="${source.kind}"). ` +
      `Kind hợp lệ: ${Object.keys(ADAPTERS).join(', ')}`,
  );
}

export { genericJsonLdAdapter, vietnamworksAdapter };
export type { SourceAdapter, SourceConfig, SourceRunContext, CrawlItem } from './types';
