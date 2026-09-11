import {
  MAX_SITEMAP_DEPTH,
  MAX_SITEMAP_PAGES_PER_SOURCE,
} from '@/constants/crawl';

import { canonicalizeUrl } from '../normalize/text';
import type { PoliteFetcher } from '../fetcher';

/**
 * Khám phá URL bằng sitemap.
 *
 * Đây là quyết định kiến trúc quan trọng nhất của dự án (TECHSTACK.md §1).
 * Đo thật: `topdev.vn/sitemap-jobs.xml` là một index lồng hai tầng, 463 sitemap
 * con × 20 URL ≈ 9.260 URL job — lấy hết bằng ~465 request, miễn phí.
 *
 * So với search API: 1 truy vấn = 10 kết quả, trùng lặp nặng, và Google Custom
 * Search JSON API thì đã đóng với khách mới và khai tử 01/01/2027.
 *
 * Sitemap còn cho thêm `lastmod` — thứ mà search API không có — nên crawl tăng
 * dần được: chỉ tải lại những trang đã đổi kể từ lần chạy trước.
 */

export interface SitemapEntry {
  url: string;
  lastModified: Date | null;
}

export interface SitemapWalkOptions {
  /** Chỉ URL khớp regex này mới được coi là trang chi tiết job. */
  jobUrlPattern?: RegExp;
  /**
   * Chỉ đi vào các sitemap CON khớp regex này.
   *
   * Không có nó thì ngân sách bị đốt hết vào những file vô dụng: sitemap index
   * của ITviec có 13 file con, hai file chứa tin nằm CUỐI CÙNG, còn bốn file
   * đầu là danh mục công ty nặng tổng cộng 17 MB. Đi tuần tự là hết trần trước
   * khi chạm tới một URL tin nào.
   *
   * Nó cũng là cách loại bản dịch trùng: ITviec có `jobs_desc_en` và
   * `jobs_desc_vn` chứa CÙNG một tập tin ở hai ngôn ngữ — nạp cả hai là mọi
   * thống kê bị đếm đôi.
   */
  sitemapUrlPattern?: RegExp;
  /**
   * Lọc thêm, CỘNG DỒN với `jobUrlPattern`: URL phải khớp cả hai mới được lấy.
   *
   * Tách khỏi `jobUrlPattern` vì hai thứ này trả lời hai câu khác nhau:
   * `jobUrlPattern` hỏi "đây có phải trang tin không", còn cái này hỏi "tin này
   * có thuộc lát cắt tôi đang nhắm không". Trộn làm một là mất khả năng nhận ra
   * nguồn đang bị thu hẹp — thứ mà `reapMissing` bắt buộc phải biết.
   */
  urlIncludePattern?: RegExp;
  /** Bỏ qua URL có lastmod cũ hơn mốc này. Đây là cơ chế crawl tăng dần. */
  modifiedSince?: Date | null;
  /** Trần số file sitemap đọc, để không vô tình quét cả sàn. */
  maxSitemaps?: number;
  maxDepth?: number;
  /** Trần số URL trả về. */
  maxUrls?: number;
}

export interface SitemapWalkResult {
  entries: SitemapEntry[];
  sitemapsFetched: number;
  /** Sitemap đọc hỏng — báo lên chứ không nuốt, vì đây là dấu hiệu nguồn đổi. */
  errors: { url: string; message: string }[];
  /** true khi dừng vì chạm trần chứ không phải vì đã đi hết. */
  truncated: boolean;
}

const LOC_RE = /<loc>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/loc>/gi;
const URL_BLOCK_RE = /<url>([\s\S]*?)<\/url>/gi;
const SITEMAP_BLOCK_RE = /<sitemap>([\s\S]*?)<\/sitemap>/gi;
const LASTMOD_RE = /<lastmod>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/lastmod>/i;

/**
 * Đọc XML bằng regex chứ không bằng bộ parse XML thật.
 *
 * Cân nhắc có chủ đích: sitemap là XML cực kỳ đều đặn do máy sinh ra, còn thêm
 * một phụ thuộc parse XML vào đây là thêm một thứ nữa để vá lỗi bảo mật. Nếu
 * sau này gặp sitemap có namespace lạ thì hãy đổi — nhưng 5 nguồn đã đo đều
 * dùng đúng lược đồ sitemaps.org chuẩn.
 */
function parseEntries(xml: string, blockRe: RegExp): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  blockRe.lastIndex = 0;

  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(xml)) !== null) {
    const chunk = block[1];
    if (!chunk) continue;

    LOC_RE.lastIndex = 0;
    const loc = LOC_RE.exec(chunk)?.[1]?.trim();
    if (!loc) continue;

    const lastmodRaw = LASTMOD_RE.exec(chunk)?.[1]?.trim();
    const lastModified = lastmodRaw ? toDate(lastmodRaw) : null;

    entries.push({ url: decodeXml(loc), lastModified });
  }

  // Có sitemap không bọc <url>/<sitemap> đúng chuẩn — vớt <loc> trần.
  if (entries.length === 0) {
    LOC_RE.lastIndex = 0;
    let loc: RegExpExecArray | null;
    while ((loc = LOC_RE.exec(xml)) !== null) {
      const value = loc[1]?.trim();
      if (value) entries.push({ url: decodeXml(value), lastModified: null });
    }
  }

  return entries;
}

function decodeXml(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function toDate(input: string): Date | null {
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Đây là sitemap index (chứa sitemap khác) hay sitemap chứa URL thật? */
function isIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

/**
 * Đi hết cây sitemap, trả về các URL trang chi tiết job.
 *
 * Đi theo chiều rộng có kiểm soát, chặn ở `maxDepth` để một sitemap tự trỏ vào
 * chính nó không làm crawler chạy mãi.
 */
export async function walkSitemap(
  fetcher: PoliteFetcher,
  rootUrl: string,
  options: SitemapWalkOptions = {},
): Promise<SitemapWalkResult> {
  const {
    jobUrlPattern,
    sitemapUrlPattern,
    urlIncludePattern,
    modifiedSince = null,
    maxSitemaps = MAX_SITEMAP_PAGES_PER_SOURCE,
    maxDepth = MAX_SITEMAP_DEPTH,
    maxUrls = Number.POSITIVE_INFINITY,
  } = options;

  const result: SitemapWalkResult = {
    entries: [],
    sitemapsFetched: 0,
    errors: [],
    truncated: false,
  };

  const seenSitemaps = new Set<string>();
  const seenUrls = new Set<string>();
  let queue: { url: string; depth: number }[] = [{ url: rootUrl, depth: 0 }];

  while (queue.length > 0) {
    if (result.sitemapsFetched >= maxSitemaps || result.entries.length >= maxUrls) {
      result.truncated = true;
      break;
    }

    const item = queue.shift();
    if (!item) break;
    if (item.depth > maxDepth) continue;
    if (seenSitemaps.has(item.url)) continue;
    seenSitemaps.add(item.url);

    let xml: string;
    try {
      const res = await fetcher.fetch(item.url, { accept: 'application/xml,text/xml,*/*' });
      result.sitemapsFetched += 1;
      if (res.status !== 200 || !res.body) {
        result.errors.push({ url: item.url, message: `HTTP ${res.status}` });
        continue;
      }
      xml = res.body;
    } catch (err) {
      result.errors.push({ url: item.url, message: (err as Error).message });
      // Lỗi ở một file sitemap không được làm hỏng cả cây — nhưng nếu là
      // HostAbortedError thì ném tiếp, vì lúc đó phải dừng hẳn.
      if ((err as Error).name === 'HostAbortedError') throw err;
      continue;
    }

    if (isIndex(xml)) {
      const children = parseEntries(xml, SITEMAP_BLOCK_RE);
      const worth = children.filter((child) => {
        // Lọc theo tên file TRƯỚC: đây là chỗ quyết định ngân sách được tiêu
        // vào đâu, và bỏ qua một file là tiết kiệm cả một request nặng.
        if (sitemapUrlPattern && !sitemapUrlPattern.test(child.url)) return false;
        // lastmod cho phép bỏ qua CẢ MỘT FILE nếu nó không đổi kể từ lần chạy
        // trước — chỗ tiết kiệm lớn nhất khi crawl tăng dần.
        return !modifiedSince || !child.lastModified || child.lastModified >= modifiedSince;
      });
      queue = queue.concat(worth.map((child) => ({ url: child.url, depth: item.depth + 1 })));
      continue;
    }

    const nested: SitemapEntry[] = [];

    for (const entry of parseEntries(xml, URL_BLOCK_RE)) {
      if (result.entries.length >= maxUrls) {
        result.truncated = true;
        break;
      }
      // Sitemap LỒNG NHAU nhưng khai sai kiểu: `<urlset>` chứa toàn `.xml`.
      //
      // Đúng chuẩn thì một file trỏ sang file khác phải bọc `<sitemapindex>`.
      // vieclamnhamay.vn không làm thế — đo thật 11/09/2026,
      // `tin-tuyen-dung.xml` là `<urlset>` gồm 39 mục, mục nào cũng là
      // `tin-tuyen-dung-pN.xml`. Chỉ nhìn thẻ bọc thì cả 39 mục rơi vào vòng
      // dưới, trượt `jobUrlPattern`, và nguồn im lặng trả 0 URL.
      //
      // Nhận diện theo NỘI DUNG chứ không theo thẻ bọc, và chỉ khi mục đó đã
      // trượt `jobUrlPattern` — nên nguồn nào đặt tin ở đuôi `.xml` (không có)
      // vẫn được xử đúng, còn 6 nguồn cũ thì không đổi hành vi một chút nào.
      if (isNestedSitemap(entry.url, jobUrlPattern)) {
        nested.push(entry);
        continue;
      }
      if (jobUrlPattern && !jobUrlPattern.test(entry.url)) continue;
      // Lọc nhắm mục tiêu chạy TRƯỚC khi tính vào `maxUrls`: mục đích của nó là
      // để ngân sách chỉ tiêu vào lát cắt đang nhắm.
      if (urlIncludePattern && !urlIncludePattern.test(entry.url)) continue;
      if (modifiedSince && entry.lastModified && entry.lastModified < modifiedSince) continue;

      let canonical: string;
      try {
        canonical = canonicalizeUrl(entry.url);
      } catch {
        continue; // URL rác trong sitemap, bỏ qua
      }
      if (seenUrls.has(canonical)) continue;
      seenUrls.add(canonical);

      result.entries.push({ url: canonical, lastModified: entry.lastModified });
    }

    // Xếp sau các URL tin: file lồng chỉ được đi khi vòng này không tìm ra tin.
    for (const child of nested) {
      if (sitemapUrlPattern && !sitemapUrlPattern.test(child.url)) continue;
      if (modifiedSince && child.lastModified && child.lastModified < modifiedSince) continue;
      queue.push({ url: child.url, depth: item.depth + 1 });
    }
  }

  return result;
}

/**
 * Mục này là một sitemap con trá hình hay là một trang tin?
 *
 * Cố ý hỏi `jobUrlPattern` TRƯỚC: nguồn nào đặt tin ở URL đuôi `.xml` thì mẫu
 * của nó khớp, và mục đó vẫn được coi là tin. Chỉ khi đã chắc chắn không phải
 * tin thì đuôi `.xml` mới có nghĩa là "đây là file sitemap khác".
 */
function isNestedSitemap(url: string, jobUrlPattern?: RegExp): boolean {
  if (jobUrlPattern?.test(url)) return false;
  return /\.xml(?:\.gz)?(?:[?#]|$)/i.test(url);
}

/** Tách riêng để test được mà không cần mạng. */
export const __testing = {
  parseEntries,
  isIndex,
  isNestedSitemap,
  URL_BLOCK_RE,
  SITEMAP_BLOCK_RE,
};
