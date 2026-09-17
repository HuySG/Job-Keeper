import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FIELD_SEEDS } from '@/constants/field';
import { SOFTWARE_SLUG, SOURCE_CATALOG, TARGETING, sourceSeedsFor } from '@/constants/source';
import { WORKSPACES, WORKSPACE_IDS } from '@/constants/workspace';

/**
 * Tách cấu hình nguồn thành "cách vào" (catalog) + "lát nào" (targeting).
 *
 * Bản chụp `source-seeds-bae.json` là `SOURCE_SEEDS` NGAY TRƯỚC khi tách
 * (17/09/2026). Nó là bằng chứng cho điều kiện N0 của docs/plan-swe.md:
 * workspace bae ghi vào CSDL đúng từng byte như trước.
 */

const snapshot = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/source-seeds-bae.json'), 'utf8'),
) as unknown;

describe('sourceSeedsFor', () => {
  it('bae ra ĐÚNG bản chụp trước khi tách', () => {
    expect(sourceSeedsFor('bae')).toEqual(snapshot);
  });

  it('mọi workspace khai đủ mọi nguồn, không thừa nguồn nào', () => {
    const codes = SOURCE_CATALOG.map((entry) => entry.code).sort();
    for (const ws of WORKSPACE_IDS) {
      expect(Object.keys(TARGETING[ws]).sort()).toEqual(codes);
      expect(() => sourceSeedsFor(ws)).not.toThrow();
    }
  });

  it('catalog không chứa thứ thuộc về nghề', () => {
    for (const entry of SOURCE_CATALOG) {
      expect(entry.quirks).not.toHaveProperty('queries');
      expect(entry.quirks).not.toHaveProperty('urlIncludePattern');
    }
  });

  it('swe không mang từ khoá hay mẫu lọc của nghề thu mua', () => {
    const text = JSON.stringify(sourceSeedsFor('swe').map((seed) => seed.config));
    expect(text).not.toMatch(/thu mua|thu-mua|mua-hang|c14p122/);
  });

  it('TopCV vẫn tắt ở mọi workspace — tầng biên chặn, không phải chuyện nghề', () => {
    for (const ws of WORKSPACE_IDS) {
      expect(sourceSeedsFor(ws).find((seed) => seed.code === 'topcv')?.isActive).toBe(false);
    }
  });
});

describe('SOFTWARE_SLUG — chặn theo token của slug', () => {
  // Cờ `i` khớp đúng cách generic-jsonld và pipeline biên dịch mẫu này.
  const re = new RegExp(SOFTWARE_SLUG, 'i');

  // URL tự dựng theo đúng HÌNH DẠNG của từng sàn (jobUrlPattern trong
  // catalog), KHÔNG phải URL đã đo. Số đo thật thuộc việc D3.
  it.each([
    'https://itviec.com/it-jobs/senior-net-developer-c-sql-server-1234',
    'https://topdev.vn/detail-jobs/fullstack-developer-reactjs-2124771',
    'https://careerviet.vn/vi/tim-viec-lam/lap-trinh-vien-net.35C86620.html',
    'https://careerviet.vn/vi/tim-viec-lam/ky-su-phan-mem.35C86621.html',
    'https://glints.com/vn/opportunities/jobs/backend-engineer/0b8f2c1e-1111-4222-8333-444455556666',
    'https://iconicjob.vn/viec-lam/Senior-NET-Developer-125687',
    'https://timviec365.vn/front-end-react-p2070117.html',
  ])('nhận %s', (url) => {
    expect(re.test(url)).toBe(true);
  });

  it.each([
    'https://careerviet.vn/vi/tim-viec-lam/nhan-vien-ky-thuat-internet.35C86622.html',
    'https://careerviet.vn/vi/tim-viec-lam/tho-lam-cabinet-go.35C86623.html',
    'https://careerviet.vn/vi/tim-viec-lam/business-development-manager.35C86624.html',
    'https://timviec365.vn/netsuite-consultant-p2070118.html',
    'https://timviec365.vn/nhan-vien-thu-mua-p2070119.html',
  ])('loại %s', (url) => {
    expect(re.test(url)).toBe(false);
  });

  it('mẫu vieclam24h của swe chỉ nhận TP.HCM (p122)', () => {
    const pattern = TARGETING.swe.vieclam24h?.urlIncludePattern;
    expect(pattern).toBeDefined();
    const v24h = new RegExp(pattern!, 'i');
    // URL THẬT, đo 17/09/2026.
    const yes = [
      // c8 = IT phần mềm, p122 = TP.HCM
      'https://vieclam24h.vn/it-phan-mem/lap-trinh-vien-frontend-luong-upto-25m-c8p122id200873087.html',
      // danh mục khác (c7 = phần cứng–mạng) nhưng slug là nghề lập trình
      'https://vieclam24h.vn/it-phan-cung-mang/lap-trinh-vien-junior-c7p122id200882927.html',
    ];
    const no = [
      // đúng nghề nhưng ngoài TP.HCM
      'https://vieclam24h.vn/it-phan-mem/pre-senior-backend-developer-c8p73id200872934.html',
      // "lập trình" của máy CNC — nhánh slug cố ý không có `lap-trinh` trần
      'https://vieclam24h.vn/san-xuat-lap-rap-che-bien/nhan-vien-lap-trinh-cnc-thu-nhap-den-20tr-nhan-viec-ngay-c9p122id200874247.html',
      // bán phần mềm, xếp ở danh mục bán hàng
      'https://vieclam24h.vn/ban-hang-kinh-doanh/nhan-vien-kinh-doanh-phan-mem-c13p122id200866968.html',
    ];
    for (const url of yes) expect(v24h.test(url), url).toBe(true);
    for (const url of no) expect(v24h.test(url), url).toBe(false);
  });
});

describe('ngành theo workspace', () => {
  it('ngành mặc định của mỗi workspace có trong seed của chính nó', () => {
    for (const ws of WORKSPACE_IDS) {
      const slugs = FIELD_SEEDS[ws].map((field) => field.slug);
      expect(slugs).toContain(WORKSPACES[ws].defaultField);
    }
  });

  it('hai workspace không dùng chung slug ngành', () => {
    const bae = FIELD_SEEDS.bae.map((field) => field.slug);
    const swe = FIELD_SEEDS.swe.map((field) => field.slug);
    expect(bae.filter((slug) => swe.includes(slug))).toEqual([]);
  });
});
