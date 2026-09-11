import { describe, expect, it } from 'vitest';

import { __testing, walkSitemap } from '@/crawler/discover/sitemap';
import type { PoliteFetcher } from '@/crawler/fetcher';

const { parseEntries, isIndex, URL_BLOCK_RE, SITEMAP_BLOCK_RE } = __testing;

const INDEX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://topdev.vn/sitemap/jobs_page_1.xml</loc><lastmod>2026-08-24T23:47:42+07:00</lastmod></sitemap>
  <sitemap><loc>https://topdev.vn/sitemap/jobs_page_2.xml</loc><lastmod>2026-01-01T00:00:00+07:00</lastmod></sitemap>
</sitemapindex>`;

const URLSET_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://topdev.vn/detail-jobs/ai-engineer-mbbank-2124771</loc><lastmod>2026-08-24T10:00:00+07:00</lastmod></url>
  <url><loc>https://topdev.vn/detail-jobs/devops-vnggames-2124772?utm_source=x</loc></url>
  <url><loc>https://topdev.vn/companies/mbbank-94346</loc></url>
</urlset>`;

describe('đọc XML sitemap', () => {
  it('phân biệt được sitemap index với sitemap chứa URL', () => {
    expect(isIndex(INDEX_XML)).toBe(true);
    expect(isIndex(URLSET_XML)).toBe(false);
  });

  it('lấy được loc và lastmod của sitemap con', () => {
    const entries = parseEntries(INDEX_XML, SITEMAP_BLOCK_RE);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.url).toBe('https://topdev.vn/sitemap/jobs_page_1.xml');
    expect(entries[0]!.lastModified?.toISOString()).toBe('2026-08-24T16:47:42.000Z');
  });

  it('lấy được URL trong urlset', () => {
    expect(parseEntries(URLSET_XML, URL_BLOCK_RE)).toHaveLength(3);
  });

  it('gỡ CDATA quanh loc', () => {
    const xml = `<urlset><url><loc><![CDATA[https://a.vn/job-1]]></loc></url></urlset>`;
    expect(parseEntries(xml, URL_BLOCK_RE)[0]!.url).toBe('https://a.vn/job-1');
  });

  it('giải mã thực thể XML trong URL', () => {
    const xml = `<urlset><url><loc>https://a.vn/x?a=1&amp;b=2</loc></url></urlset>`;
    expect(parseEntries(xml, URL_BLOCK_RE)[0]!.url).toBe('https://a.vn/x?a=1&b=2');
  });

  it('vớt được loc trần khi sitemap không bọc đúng chuẩn', () => {
    const xml = `<urlset><loc>https://a.vn/1</loc><loc>https://a.vn/2</loc></urlset>`;
    expect(parseEntries(xml, URL_BLOCK_RE)).toHaveLength(2);
  });
});

/** Fetcher giả: trả XML theo bảng, đếm số lần gọi. */
function fakeFetcher(pages: Record<string, string>): {
  fetcher: PoliteFetcher;
  calls: string[];
} {
  const calls: string[] = [];
  const fetcher = {
    async fetch(url: string) {
      calls.push(url);
      const body = pages[url];
      return {
        requestedUrl: url,
        finalUrl: url,
        status: body ? 200 : 404,
        body: body ?? null,
        etag: null,
        lastModified: null,
        notModified: false,
        contentType: 'application/xml',
        bytes: body?.length ?? 0,
      };
    },
  } as unknown as PoliteFetcher;
  return { fetcher, calls };
}

describe('walkSitemap', () => {
  const pages = {
    'https://topdev.vn/sitemap-jobs.xml': INDEX_XML,
    'https://topdev.vn/sitemap/jobs_page_1.xml': URLSET_XML,
    'https://topdev.vn/sitemap/jobs_page_2.xml': URLSET_XML,
  };

  it('đi hết index lồng nhau và gom URL', async () => {
    const { fetcher } = fakeFetcher(pages);
    const result = await walkSitemap(fetcher, 'https://topdev.vn/sitemap-jobs.xml');
    expect(result.sitemapsFetched).toBe(3);
    // 3 URL/trang × 2 trang, nhưng trùng nhau nên chỉ còn 3 sau khi khử trùng
    expect(result.entries.length).toBeGreaterThan(0);
  });

  it('jobUrlPattern loại bỏ trang không phải tin', async () => {
    const { fetcher } = fakeFetcher(pages);
    const result = await walkSitemap(fetcher, 'https://topdev.vn/sitemap-jobs.xml', {
      jobUrlPattern: /\/detail-jobs\/[a-z0-9-]+-\d+/,
    });
    expect(result.entries.every((e) => e.url.includes('/detail-jobs/'))).toBe(true);
    expect(result.entries.some((e) => e.url.includes('/companies/'))).toBe(false);
  });

  it('cắt query string khi chuẩn hoá URL', async () => {
    const { fetcher } = fakeFetcher(pages);
    const result = await walkSitemap(fetcher, 'https://topdev.vn/sitemap-jobs.xml');
    expect(result.entries.every((e) => !e.url.includes('utm_source'))).toBe(true);
  });

  it('khử trùng URL xuất hiện ở nhiều sitemap con', async () => {
    const { fetcher } = fakeFetcher(pages);
    const result = await walkSitemap(fetcher, 'https://topdev.vn/sitemap-jobs.xml');
    expect(new Set(result.entries.map((e) => e.url)).size).toBe(result.entries.length);
  });

  it('modifiedSince bỏ qua CẢ MỘT sitemap con không đổi — chỗ tiết kiệm lớn nhất', async () => {
    const { fetcher, calls } = fakeFetcher(pages);
    await walkSitemap(fetcher, 'https://topdev.vn/sitemap-jobs.xml', {
      modifiedSince: new Date('2026-08-01T00:00:00Z'),
    });
    // page_2 có lastmod 2026-01-01 -> không được tải
    expect(calls).not.toContain('https://topdev.vn/sitemap/jobs_page_2.xml');
    expect(calls).toContain('https://topdev.vn/sitemap/jobs_page_1.xml');
  });

  it('sitemapUrlPattern chỉ đi vào file con khớp mẫu', async () => {
    // Ca thật của ITviec: index 13 file, hai file chứa tin nằm CUỐI, bốn file
    // đầu là danh mục công ty nặng 17 MB. Không lọc là hết ngân sách trước khi
    // chạm tới URL tin nào — đo thật: 5 file, 17,35 MB, 0 tin.
    const { fetcher, calls } = fakeFetcher({
      'https://itviec.com/index.xml': `<sitemapindex>
        <sitemap><loc>https://itviec.com/twinnings_companies_en.xml</loc></sitemap>
        <sitemap><loc>https://itviec.com/twinnings_jobs_desc_en.xml</loc></sitemap>
        <sitemap><loc>https://itviec.com/twinnings_jobs_desc_vn.xml</loc></sitemap>
      </sitemapindex>`,
      'https://itviec.com/twinnings_jobs_desc_en.xml': `<urlset><url><loc>https://itviec.com/it-jobs/abc-4101</loc></url></urlset>`,
    });

    const result = await walkSitemap(fetcher, 'https://itviec.com/index.xml', {
      sitemapUrlPattern: /jobs_desc_en/,
    });

    expect(calls).not.toContain('https://itviec.com/twinnings_companies_en.xml');
    // Bản _vn là CÙNG tập tin ở ngôn ngữ khác — nạp cả hai là đếm đôi thống kê
    expect(calls).not.toContain('https://itviec.com/twinnings_jobs_desc_vn.xml');
    expect(calls).toContain('https://itviec.com/twinnings_jobs_desc_en.xml');
    expect(result.entries).toHaveLength(1);
  });

  it('chạm trần thì báo truncated chứ không im lặng', async () => {
    const { fetcher } = fakeFetcher(pages);
    const result = await walkSitemap(fetcher, 'https://topdev.vn/sitemap-jobs.xml', {
      maxSitemaps: 1,
    });
    expect(result.truncated).toBe(true);
  });

  it('sitemap con lỗi không làm hỏng cả cây', async () => {
    const { fetcher } = fakeFetcher({
      'https://a.vn/index.xml': `<sitemapindex>
        <sitemap><loc>https://a.vn/missing.xml</loc></sitemap>
        <sitemap><loc>https://a.vn/ok.xml</loc></sitemap>
      </sitemapindex>`,
      'https://a.vn/ok.xml': `<urlset><url><loc>https://a.vn/job-1</loc></url></urlset>`,
    });
    const result = await walkSitemap(fetcher, 'https://a.vn/index.xml');
    expect(result.errors).toHaveLength(1);
    expect(result.entries).toHaveLength(1);
  });

  it('không đi vào vòng lặp khi sitemap tự trỏ vào chính nó', async () => {
    const { fetcher } = fakeFetcher({
      'https://a.vn/loop.xml': `<sitemapindex><sitemap><loc>https://a.vn/loop.xml</loc></sitemap></sitemapindex>`,
    });
    const result = await walkSitemap(fetcher, 'https://a.vn/loop.xml');
    expect(result.sitemapsFetched).toBe(1);
  });
});

/**
 * Sitemap LỒNG NHAU nhưng khai sai thẻ bọc — ca thật của vieclamnhamay.vn.
 *
 * Đo 11/09/2026: `tin-tuyen-dung.xml` là `<urlset>` gồm 39 mục, mục nào cũng là
 * một file `tin-tuyen-dung-pN.xml`. Chỉ nhìn thẻ bọc thì cả 39 mục rơi vào vòng
 * xử URL tin, trượt `jobUrlPattern`, và nguồn im lặng trả 0 URL.
 */
describe('sitemap lồng nhau khai sai thẻ bọc', () => {
  const URLSET_OF_SITEMAPS = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://vieclamnhamay.vn/tin-tuyen-dung-p1.xml</loc></url>
  <url><loc>https://vieclamnhamay.vn/tin-tuyen-dung-p2.xml</loc></url>
</urlset>`;

  const JOBS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://vieclamnhamay.vn/viec-lam/249957-chuyen-vien-thu-mua</loc><lastmod>2026-09-11T08:00:00+07:00</lastmod></url>
  <url><loc>https://vieclamnhamay.vn/viec-lam/249969-ke-toan-thue</loc></url>
</urlset>`;

  const pages = {
    'https://vieclamnhamay.vn/tin-tuyen-dung.xml': URLSET_OF_SITEMAPS,
    'https://vieclamnhamay.vn/tin-tuyen-dung-p1.xml': JOBS_XML,
    'https://vieclamnhamay.vn/tin-tuyen-dung-p2.xml': JOBS_XML,
  };

  const jobUrlPattern = /\/viec-lam\/\d+-[a-z0-9-]+$/;

  it('đi tiếp vào file .xml nằm trong <urlset> thay vì coi chúng là tin', async () => {
    const { fetcher, calls } = fakeFetcher(pages);
    const result = await walkSitemap(fetcher, 'https://vieclamnhamay.vn/tin-tuyen-dung.xml', {
      jobUrlPattern,
    });

    expect(calls).toContain('https://vieclamnhamay.vn/tin-tuyen-dung-p1.xml');
    expect(result.entries).toHaveLength(2); // hai file trùng nhau, đã khử
    expect(result.entries.every((e) => e.url.includes('/viec-lam/'))).toBe(true);
  });

  it('KHÔNG nhận nhầm URL tin thành sitemap con', () => {
    const { isNestedSitemap } = __testing;
    expect(isNestedSitemap('https://vieclamnhamay.vn/tin-tuyen-dung-p1.xml', jobUrlPattern)).toBe(true);
    expect(isNestedSitemap('https://vieclamnhamay.vn/viec-lam/249957-chuyen-vien-thu-mua', jobUrlPattern)).toBe(false);
    // Tin có đuôi .xml mà khớp jobUrlPattern thì vẫn là TIN — mẫu được hỏi trước.
    expect(isNestedSitemap('https://x.vn/viec-lam/1-abc', /\/viec-lam\//)).toBe(false);
  });

  it('sitemapUrlPattern vẫn lọc được các file lồng kiểu này', async () => {
    const { fetcher, calls } = fakeFetcher(pages);
    await walkSitemap(fetcher, 'https://vieclamnhamay.vn/tin-tuyen-dung.xml', {
      jobUrlPattern,
      sitemapUrlPattern: /p1\.xml/,
    });
    expect(calls).toContain('https://vieclamnhamay.vn/tin-tuyen-dung-p1.xml');
    expect(calls).not.toContain('https://vieclamnhamay.vn/tin-tuyen-dung-p2.xml');
  });
});
