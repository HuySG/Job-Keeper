import { describe, expect, it } from 'vitest';

import {
  collectJobPostings,
  extractJobPostings,
  extractJsonLdBlocks,
  hasJobPosting,
  validateJobPosting,
} from '@/crawler/jsonld';

import topcv from './fixtures/topcv-job.json';
import topdev from './fixtures/topdev-job.json';
import itviec from './fixtures/itviec-job.json';

const wrap = (json: string): string =>
  `<html><head><script type="application/ld+json">${json}</script></head><body>x</body></html>`;

describe('extractJsonLdBlocks', () => {
  it('lấy được nhiều khối trong một trang', () => {
    const html = `
      <script type="application/ld+json">{"@type":"WebSite","name":"a"}</script>
      <script type="application/ld+json">{"@type":"JobPosting","title":"b"}</script>
    `;
    expect(extractJsonLdBlocks(html)).toHaveLength(2);
  });

  it('chịu được thuộc tính phụ và khoảng trắng lạ trong thẻ script', () => {
    const html = `<script  id="x"   type='application/ld+json'  data-n="1" >{"@type":"JobPosting"}</script>`;
    expect(extractJsonLdBlocks(html)).toHaveLength(1);
  });

  it('gỡ được CDATA', () => {
    expect(extractJsonLdBlocks(wrap('<![CDATA[{"@type":"JobPosting"}]]>'))).toHaveLength(1);
  });

  it('giải mã được JSON bị HTML-escape', () => {
    const html = wrap('{&quot;@type&quot;:&quot;JobPosting&quot;,&quot;title&quot;:&quot;A &amp; B&quot;}');
    const blocks = extractJsonLdBlocks(html);
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as Record<string, unknown>)['title']).toBe('A & B');
  });

  it('bỏ dấu phẩy thừa', () => {
    expect(extractJsonLdBlocks(wrap('{"@type":"JobPosting","a":1,}'))).toHaveLength(1);
  });

  it('một khối hỏng KHÔNG được làm mất các khối còn lại', () => {
    const html = `
      <script type="application/ld+json">{ hỏng hoàn toàn %%% }</script>
      <script type="application/ld+json">{"@type":"JobPosting","title":"còn sống"}</script>
    `;
    const blocks = extractJsonLdBlocks(html);
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as Record<string, unknown>)['title']).toBe('còn sống');
  });
});

describe('collectJobPostings', () => {
  it('tìm được khối nằm trong @graph', () => {
    const root = {
      '@context': 'https://schema.org',
      '@graph': [{ '@type': 'Organization' }, { '@type': 'JobPosting', title: 'trong graph' }],
    };
    const found = collectJobPostings(root);
    expect(found).toHaveLength(1);
    expect(found[0]!['title']).toBe('trong graph');
  });

  it('tìm được khi cấp trên cùng là mảng', () => {
    const root = [{ '@type': 'WebPage' }, { '@type': 'JobPosting', title: 'trong mảng' }];
    expect(collectJobPostings(root)[0]!['title']).toBe('trong mảng');
  });

  it('chấp nhận @type là mảng', () => {
    const root = { '@type': ['JobPosting', 'Thing'], title: 'kiểu mảng' };
    expect(collectJobPostings(root)).toHaveLength(1);
  });

  it('chấp nhận @type có tiền tố namespace', () => {
    expect(collectJobPostings({ '@type': 'schema:JobPosting' })).toHaveLength(1);
  });

  it('không chết vì cây tự tham chiếu vòng', () => {
    const root: Record<string, unknown> = { '@type': 'JobPosting', title: 'vòng' };
    root['self'] = root;
    expect(() => collectJobPostings(root)).not.toThrow();
    expect(collectJobPostings(root)).toHaveLength(1);
  });

  it('không nhận nhầm loại khác', () => {
    expect(collectJobPostings({ '@type': 'Organization' })).toHaveLength(0);
  });
});

describe('trên dữ liệu THẬT của ba sàn', () => {
  const fixtures = [
    ['TopCV', topcv],
    ['TopDev', topdev],
    ['ITviec', itviec],
  ] as const;

  it.each(fixtures)('%s: nhận ra là JobPosting', (_name, fixture) => {
    expect(collectJobPostings(fixture)).toHaveLength(1);
  });

  it.each(fixtures)('%s: qua được kiểm kiểu, không thiếu trường bắt buộc', (_name, fixture) => {
    const { posting, missingRequired } = validateJobPosting(fixture);
    expect(posting).not.toBeNull();
    expect(missingRequired).toEqual([]);
  });

  it('extractJobPostings đi được cả chặng từ HTML', () => {
    const html = wrap(JSON.stringify(topcv));
    expect(extractJobPostings(html)).toHaveLength(1);
    expect(hasJobPosting(html)).toBe(true);
  });

  it('hasJobPosting trả false khi khối đã bị gỡ — tín hiệu hết hạn của Google', () => {
    expect(hasJobPosting('<html><body>Tin đã hết hạn</body></html>')).toBe(false);
  });
});

describe('validateJobPosting', () => {
  it('báo đúng trường Google bắt buộc còn thiếu', () => {
    const { missingRequired } = validateJobPosting({ '@type': 'JobPosting', title: 'chỉ có tiêu đề' });
    expect(missingRequired).toContain('description');
    expect(missingRequired).toContain('datePosted');
    expect(missingRequired).toContain('hiringOrganization');
    expect(missingRequired).toContain('jobLocation');
  });

  it('tin remote được miễn jobLocation', () => {
    const { missingRequired } = validateJobPosting({
      '@type': 'JobPosting',
      title: 'a',
      description: 'b',
      datePosted: '2026-01-01',
      hiringOrganization: { name: 'c' },
      jobLocationType: 'TELECOMMUTE',
    });
    expect(missingRequired).not.toContain('jobLocation');
  });

  it('applicantLocationRequirements KHÔNG được coi là remote', () => {
    // Fixture TopDev có cả jobLocation lẫn applicantLocationRequirements.
    // Nếu coi trường sau là remote thì hàng loạt tin onsite bị gán nhầm nhãn.
    const { missingRequired } = validateJobPosting({
      '@type': 'JobPosting',
      title: 'a',
      description: 'b',
      datePosted: '2026-01-01',
      hiringOrganization: { name: 'c' },
      applicantLocationRequirements: { '@type': 'Country', name: 'Vietnam' },
    });
    expect(missingRequired).toContain('jobLocation');
  });
});
