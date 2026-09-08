import type { SourceKind } from '@/enums';

import type { PoliteFetcher } from '../fetcher';
import type { NormalizedJob } from '../normalize';
import type { BlobStore } from '../storage/blob';

/**
 * Hợp đồng giữa pipeline và từng nguồn.
 *
 * Mục tiêu thiết kế: **thêm một nguồn phải là thêm DỮ LIỆU, không phải thêm
 * code.** Năm trong sáu nguồn đã khảo sát đều chạy được bằng đúng một adapter
 * (`generic-jsonld`) chỉ với cấu hình khác nhau, vì cả sáu đều nhúng JSON-LD
 * `JobPosting` — Google bắt buộc thế. Adapter riêng chỉ viết khi nguồn thật sự
 * khác về bản chất, như VietnamWorks có API JSON.
 */

/** Bản ghi Source đọc từ DB, chỉ những trường adapter cần. */
export interface SourceConfig {
  id: number;
  code: string;
  name: string;
  homeUrl: string;
  kind: SourceKind;
  entryUrl: string | null;
  jobUrlPattern: string | null;
  config: Record<string, unknown> | null;
  priority: number;
}

export interface SourceRunContext {
  source: SourceConfig;
  fetcher: PoliteFetcher;
  blobs: BlobStore;
  /**
   * Chỉ lấy tin đổi từ mốc này trở đi (thường là lần chạy thành công gần nhất).
   * null = quét đầy đủ, dùng cho backfill.
   */
  modifiedSince: Date | null;
  limits: {
    maxDetailPages: number;
    maxSitemaps: number;
  };
  log: (message: string) => void;
}

/**
 * Một sự kiện adapter phát ra. Dùng generator thay vì trả mảng để pipeline
 * kiểm soát được nhịp: dừng giữa chừng khi chạm trần mà không phải chờ adapter
 * chạy hết, và không phải giữ 10.000 bản ghi trong bộ nhớ cùng lúc.
 */
export type CrawlItem =
  /**
   * "Tôi thấy tin này còn nằm trong danh mục của nguồn."
   * Đây là tín hiệu TẦNG 2 của máy kiểm còn-sống, và nó gần như miễn phí —
   * đằng nào cũng phải đọc sitemap. Tin nào không xuất hiện trong lượt quét
   * đầy đủ thì missCount tăng lên.
   */
  | { kind: 'seen'; externalId: string; url: string }
  /** Đã lấy và nắn xong một tin. */
  | { kind: 'job'; job: NormalizedJob; rawKey: string | null }
  /** Bỏ qua có lý do — ghi lại để biết vì sao con số không khớp. */
  | { kind: 'skipped'; url: string; reason: string }
  /** Lỗi ở một tin, không phải lỗi cả nguồn. */
  | { kind: 'error'; url: string; message: string };

export interface SourceAdapter {
  readonly kind: SourceKind;
  run(ctx: SourceRunContext): AsyncGenerator<CrawlItem, void, undefined>;
}

/** Cấu hình riêng của adapter generic-jsonld, đọc từ cột Source.config. */
export interface GenericJsonLdConfig {
  /**
   * Biểu thức rút externalId từ URL, nhóm bắt số 1 là id.
   * TopCV:  "/viec-lam/<slug>/2262537.html"      -> "(\\d+)\\.html$"
   * TopDev: "/detail-jobs/<slug>-mbbank-2124771" -> "-(\\d+)$"
   * ITviec: "/it-jobs/<slug>-4101"               -> "-(\\d+)$"
   */
  externalIdPattern?: string;
  /**
   * Chỉ đi vào các sitemap con khớp mẫu này. Bỏ trống là đi hết.
   * Bắt buộc với nguồn có sitemap index nhiều file mà file tin nằm cuối —
   * xem ghi chú ở `SitemapWalkOptions.sitemapUrlPattern`.
   */
  sitemapUrlPattern?: string;
  /** Selector CSS vá lương khi JSON-LD không có `baseSalary`. */
  salarySelector?: string;
  /** Selector CSS vá danh sách kỹ năng. */
  skillsSelector?: string;
  /** Bỏ qua URL khớp các mẫu này (trang chuyên mục lẫn vào sitemap job). */
  excludePatterns?: string[];

  /**
   * NHẮM MỤC TIÊU: chỉ lấy URL khớp thêm mẫu này, **cộng dồn (AND)** với
   * `jobUrlPattern`. Khác `excludePatterns` ở chỗ nó lọc TRƯỚC khi tiêu ngân
   * sách `maxUrls`, nên dùng để cắt một lát mỏng của sàn mà không tải phần còn lại.
   *
   * Đo thật trên vieclam24h 08/09/2026: URL tin của họ tự khai ngành và tỉnh
   * (`...-c14p122id200731476.html` → c14 = thu mua/kho vận, p122 = TP.HCM).
   * Lọc ở đây: 4.180 URL → 69. Tiết kiệm ~98% request, 0 rò rỉ ngoài HCM.
   *
   * ⚠️ Bật cờ này là nguồn KHÔNG còn được quét đầy đủ nữa, nên pipeline sẽ thu
   *    hẹp bước đóng tin vắng mặt theo đúng mẫu này — xem `reapMissing`.
   */
  urlIncludePattern?: string;

  /**
   * Bỏ qua `lastmod` của sitemap khi tính crawl tăng dần.
   *
   * Cần cho nguồn ghi `lastmod` = giờ SINH FILE chứ không phải giờ tin đổi.
   * Đo thật trên `vieclam24h/tintuyendung-0.xml` 08/09/2026: cả 4.180 URL đều
   * mang đúng một giá trị `2026-07-28T00:13:4x`, và file tên "daily" đó đã
   * không sinh lại suốt 6 tuần. Không có cờ này thì từ lần chạy thứ hai trở đi
   * mọi URL đều bị coi là "cũ hơn mốc" và nguồn im lặng trả về 0 tin.
   */
  ignoreLastmod?: boolean;
}
