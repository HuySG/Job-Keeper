import * as cheerio from 'cheerio';

import { SourceKind } from '@/enums';

import { walkSitemap } from '../discover/sitemap';
import { HostAbortedError, RobotsDisallowedError } from '../fetcher';
import { extractJobPostings, validateJobPosting } from '../jsonld';
import { normalizeJobPosting } from '../normalize';
import { buildBlobKey } from '../storage/blob';
import type {
  CrawlItem,
  GenericJsonLdConfig,
  SourceAdapter,
  SourceRunContext,
} from './types';

/**
 * Adapter dùng chung cho MỌI nguồn có sitemap + JSON-LD.
 *
 * Đây là chỗ khoản đầu tư vào khảo sát được hoàn vốn. Năm nguồn — TopCV,
 * ITviec, CareerViet, vieclam24h, TopDev — chạy được bằng đúng file này, khác
 * nhau chỉ ở vài dòng cấu hình trong bảng `Source`. Thêm nguồn thứ sáu, thứ
 * bảy là INSERT một dòng, không phải deploy.
 *
 * Lý do nó khả thi: Google bắt buộc JobPosting JSON-LD để được lên Google Jobs,
 * nên sàn nào cũng phải có, đúng chuẩn schema.org. TECHSTACK.md §2.
 */
export const genericJsonLdAdapter: SourceAdapter = {
  kind: SourceKind.SITEMAP_JSONLD,

  async *run(ctx: SourceRunContext): AsyncGenerator<CrawlItem, void, undefined> {
    const { source, fetcher, blobs, log } = ctx;
    const config = (source.config ?? {}) as GenericJsonLdConfig;

    if (!source.entryUrl) {
      yield { kind: 'error', url: source.homeUrl, message: 'Nguồn thiếu entryUrl (sitemap)' };
      return;
    }

    // ── Bước 1: khám phá ─────────────────────────────────────────────────────
    const jobUrlPattern = source.jobUrlPattern ? new RegExp(source.jobUrlPattern) : undefined;
    const exclude = (config.excludePatterns ?? []).map((p) => new RegExp(p));

    // Nguồn ghi lastmod rác thì crawl tăng dần không những vô dụng mà còn nguy
    // hiểm: nó làm nguồn im lặng trả 0 tin. Xem `ignoreLastmod` ở types.ts.
    const modifiedSince = config.ignoreLastmod ? null : ctx.modifiedSince;
    if (config.ignoreLastmod && ctx.modifiedSince) {
      log('bỏ qua lastmod của nguồn này (ignoreLastmod) — quét lại toàn bộ lát cắt');
    }

    log(`đọc sitemap ${source.entryUrl}`);
    const walk = await walkSitemap(fetcher, source.entryUrl, {
      jobUrlPattern,
      ...(config.sitemapUrlPattern
        ? { sitemapUrlPattern: new RegExp(config.sitemapUrlPattern) }
        : {}),
      // Cờ `i`: mẫu nhắm mục tiêu tra TỪ NGHỀ trong slug, mà không sàn nào
      // thống nhất kiểu chữ. Đo thật 11/09/2026 — iconicjob.vn viết hoa từng
      // từ (`/viec-lam/Senior-Purchasing-Staff-125687`) còn careerviet và
      // timviec365 viết thường. Không có cờ này thì mẫu chữ thường lọc sạch
      // 255/255 URL của iconicjob và nguồn im lặng trả 0 tin.
      ...(config.urlIncludePattern
        ? { urlIncludePattern: new RegExp(config.urlIncludePattern, 'i') }
        : {}),
      modifiedSince,
      maxSitemaps: ctx.limits.maxSitemaps,
      maxUrls: ctx.limits.maxDetailPages * 3,
    });

    for (const error of walk.errors) {
      yield { kind: 'error', url: error.url, message: `sitemap: ${error.message}` };
    }
    log(
      `sitemap: ${walk.sitemapsFetched} file, ${walk.entries.length} URL job` +
        (walk.truncated ? ' (chạm trần)' : ''),
    );

    const externalIdOf = makeExternalIdExtractor(config.externalIdPattern);

    // ── Bước 2: lấy chi tiết ─────────────────────────────────────────────────
    let fetched = 0;
    for (const entry of walk.entries) {
      if (exclude.some((re) => re.test(entry.url))) {
        yield { kind: 'skipped', url: entry.url, reason: 'khớp excludePatterns' };
        continue;
      }

      const externalId = externalIdOf(entry.url);
      // Phát tín hiệu "còn thấy" TRƯỚC khi tải chi tiết: kể cả khi chạm trần
      // số trang, thông tin "tin này vẫn nằm trong sitemap" vẫn có giá trị cho
      // máy kiểm còn-sống, và nó không tốn thêm request nào.
      yield { kind: 'seen', externalId, url: entry.url };

      if (fetched >= ctx.limits.maxDetailPages) continue;

      try {
        const item = await fetchAndParse(ctx, entry.url, externalId, config);
        fetched += 1;
        if (item) yield item;
        else yield { kind: 'skipped', url: entry.url, reason: 'không có khối JobPosting' };
      } catch (err) {
        // Host bảo dừng thì dừng hẳn — không phải lỗi của một tin.
        if (err instanceof HostAbortedError) throw err;
        if (err instanceof RobotsDisallowedError) {
          yield { kind: 'skipped', url: entry.url, reason: 'robots.txt cấm' };
          continue;
        }
        yield { kind: 'error', url: entry.url, message: (err as Error).message };
      }
    }
  },
};

async function fetchAndParse(
  ctx: SourceRunContext,
  url: string,
  externalId: string,
  config: GenericJsonLdConfig,
): Promise<CrawlItem | null> {
  const res = await ctx.fetcher.fetch(url);
  if (res.status !== 200 || !res.body) {
    return { kind: 'error', url, message: `HTTP ${res.status}` };
  }

  const blocks = extractJobPostings(res.body);
  if (blocks.length === 0) return null;

  // Trang chi tiết đôi khi có cả JobPosting của "tin liên quan" ở sidebar.
  // Lấy khối ĐẦY ĐỦ NHẤT (nhiều trường nhất) — khối chính bao giờ cũng giàu
  // trường hơn khối gợi ý.
  const best = blocks.reduce((a, b) => (Object.keys(b).length > Object.keys(a).length ? b : a));

  const { posting, missingRequired } = validateJobPosting(best);
  if (!posting) return { kind: 'error', url, message: 'JSON-LD không hợp lệ' };

  const fallback = extractFallbacks(res.body, config);

  const job = normalizeJobPosting(posting, {
    pageUrl: url,
    externalIdFromUrl: () => externalId,
    fallback,
    trustStreetFirst: config.trustStreetFirst ?? false,
  });

  if (missingRequired.length > 0) {
    job.parseError = [job.parseError, `thiếu trường Google bắt buộc: ${missingRequired.join(', ')}`]
      .filter(Boolean)
      .join('; ');
  }

  // Lưu JSON-LD gốc, KHÔNG lưu cả trang HTML: khối JSON-LD là toàn bộ thứ
  // parser cần để chạy lại, mà chỉ nặng vài KB thay vì 828 KB.
  // Khoá do kho blob TRẢ VỀ, không phải khoá tự dựng — xem chú thích cùng chỗ
  // trong vietnamworks.ts: kho rỗng trả '' và ghi bừa khoá là tạo con trỏ chết.
  const rawKey = await ctx.blobs.put(buildBlobKey(ctx.source.code, externalId), {
    url,
    fetchedAt: new Date().toISOString(),
    etag: res.etag,
    lastModified: res.lastModified,
    jsonLd: best,
    fallback,
  });

  return { kind: 'job', job, rawKey: rawKey || null };
}

/**
 * Vá các trường JSON-LD thiếu bằng CSS selector.
 *
 * Đây là đường PHỤ, cố ý. Lương là trường hay thiếu nhất trong JSON-LD (nhiều
 * sàn để "Thoả thuận" ở JSON-LD nhưng lại hiện số thật trên giao diện), nên
 * selector chỉ dùng cho đúng chỗ đó. Không bao giờ để selector trở thành đường
 * chính — đó là cách để mỗi lần nguồn đổi giao diện là parser chết.
 */
function extractFallbacks(
  html: string,
  config: GenericJsonLdConfig,
): { salaryText?: string | null; skills?: string[] } {
  if (!config.salarySelector && !config.skillsSelector) return {};

  const $ = cheerio.load(html);
  const result: { salaryText?: string | null; skills?: string[] } = {};

  if (config.salarySelector) {
    const text = $(config.salarySelector).first().text().trim();
    if (text) result.salaryText = text;
  }
  if (config.skillsSelector) {
    const skills = $(config.skillsSelector)
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);
    if (skills.length) result.skills = skills;
  }

  return result;
}

/**
 * Rút externalId từ URL theo mẫu của từng nguồn.
 *
 * Không có mẫu thì lấy đoạn cuối đường dẫn. Đó là phương án dự phòng chấp nhận
 * được nhưng kém: slug đổi khi toà soạn sửa tiêu đề, và khi đó tin cũ bị coi
 * là tin mới. Nên mọi nguồn thật đều phải khai `externalIdPattern`.
 */
function makeExternalIdExtractor(pattern?: string): (url: string) => string {
  if (!pattern) {
    return (url) => {
      const segments = new URL(url).pathname.split('/').filter(Boolean);
      return segments[segments.length - 1] ?? url;
    };
  }
  const re = new RegExp(pattern);
  return (url) => {
    const match = re.exec(url);
    return match?.[1] ?? match?.[0] ?? new URL(url).pathname;
  };
}
