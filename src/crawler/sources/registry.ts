import { SourceKind } from '@/enums';

import type { PoliteFetcher } from '../fetcher';
import { genericJsonLdAdapter } from './generic-jsonld';
import { vietnamworksAdapter } from './vietnamworks';
import type { GenericJsonLdConfig, SourceAdapter, SourceConfig } from './types';

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
const ADAPTERS: Record<Exclude<SourceKind, typeof SourceKind.MANUAL>, SourceAdapter> = {
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
  // Nguồn nhập tay KHÔNG có adapter, và đó là điều cố ý chứ không phải thiếu
  // sót: robots.txt của Facebook và LinkedIn cấm crawler của ta. Viết một
  // adapter ở đây là đi ngược lại đúng lý do hai nguồn ấy tồn tại dưới dạng
  // nhập tay. `loadSources` đã lọc chúng ra từ trước, nên tới được đây nghĩa là
  // ai đó gọi thẳng — nói rõ đường đúng thay vì báo "không có adapter".
  if (source.kind === SourceKind.MANUAL) {
    throw new Error(
      `Nguồn "${source.code}" là nguồn nhập tay, không cào được và cố ý thế ` +
        `(robots.txt của họ cấm). Dùng: npm run ingest -- --source ${source.code} ` +
        `--url <link> --file <bai.txt>`,
    );
  }

  const byCode = BY_CODE[source.code];
  if (byCode) return byCode;

  const byKind = ADAPTERS[source.kind];
  if (byKind) return byKind;

  throw new Error(
    `Không có adapter cho nguồn "${source.code}" (kind="${source.kind}"). ` +
      `Kind hợp lệ: ${Object.keys(ADAPTERS).join(', ')}`,
  );
}

/**
 * Khai báo với fetcher những host cần đi bằng `curl`.
 *
 * PHẢI gọi một lần cho mỗi `PoliteFetcher` mới, TRƯỚC request đầu tiên — kể cả
 * request đọc `robots.txt`, vì chính nó cũng bị tầng biên chặn.
 *
 * Vì sao là một hàm riêng chứ không nằm trong adapter: `recheck` không chạy
 * adapter nào cả, nó gọi thẳng vào trang chi tiết. Đặt trong adapter thì máy
 * kiểm còn-sống sẽ ăn 403 ở đúng những nguồn mà crawler đọc được — rồi lặng lẽ
 * kết luận là tin đã chết.
 */
export function applyFetchQuirks(
  // Cố ý KHÔNG nhận `SourceConfig` đầy đủ: `recheck` chỉ đọc vài cột của bảng
  // Source, và bắt nó dựng một SourceConfig giả chỉ để gọi hàm này thì chỗ gọi
  // sẽ đầy trường bịa. Hàm cần đúng hai thứ, nên nó xin đúng hai thứ.
  fetcher: PoliteFetcher,
  sources: readonly { homeUrl: string; config: unknown }[],
): void {
  for (const source of sources) {
    const config = (source.config ?? {}) as GenericJsonLdConfig;
    if (!config.useCurl) continue;
    try {
      fetcher.useCurlFor(new URL(source.homeUrl).host);
    } catch {
      // homeUrl hỏng thì bỏ qua — adapter sẽ báo lỗi rõ hơn nhiều so với chỗ này.
    }
  }
}

export { genericJsonLdAdapter, vietnamworksAdapter };
export type { SourceAdapter, SourceConfig, SourceRunContext, CrawlItem } from './types';
