import { describe, expect, it } from 'vitest';

import { normalizeJobPosting } from '@/crawler/normalize';
import { inferLevel, parseYearsOfExperience } from '@/crawler/normalize/level';
import { extractLocations, resolveProvince } from '@/crawler/normalize/location';
import {
  canonicalizeUrl,
  htmlToText,
  normalizeCompanyName,
  normalizeTitle,
  removeDiacritics,
  toSlug,
} from '@/crawler/normalize/text';
import { validateJobPosting } from '@/crawler/jsonld';

import topcv from './fixtures/topcv-job.json';
import topdev from './fixtures/topdev-job.json';
import itviec from './fixtures/itviec-job.json';

describe('chuẩn hoá chuỗi', () => {
  it('bỏ dấu, kể cả chữ đ vốn không tách được bằng NFD', () => {
    expect(removeDiacritics('Đà Nẵng')).toBe('Da Nang');
    expect(removeDiacritics('đường')).toBe('duong');
  });

  it('gộp hai chuẩn Unicode về một', () => {
    const dungSan = 'Huế'; // NFC
    const toHop = 'Huê'.normalize('NFD'); // NFD
    expect(toSlug(dungSan)).toBe(toSlug(toHop));
  });

  it('gộp các cách viết tên công ty về một khoá', () => {
    const key = normalizeCompanyName('Công ty Cổ phần Công nghệ Proton');
    expect(normalizeCompanyName('CTY CP Công nghệ Proton')).toBe(key);
    expect(normalizeCompanyName('Công nghệ Proton')).toBe(key);
  });

  it('chỉ cắt MỘT tiền tố, không ăn vào tên thật', () => {
    // "Công ty Công nghệ X" không được thành "X"
    expect(normalizeCompanyName('Công ty Công nghệ ABC')).toBe('cong nghe abc');
  });

  it('bỏ nhiễu trong tiêu đề để gộp trùng được', () => {
    const a = normalizeTitle('Project Manager (PM) - Lương Upto 60tr - Đi Làm Ngay (Hà Nội)');
    const b = normalizeTitle('[HOT] Project Manager (PM)');
    expect(a).toBe(b);
  });

  it('giữ ký tự có nghĩa trong tên công nghệ', () => {
    expect(normalizeTitle('Lập trình viên C++ / .NET (UI/UX)')).toContain('c++');
    expect(normalizeTitle('Lập trình viên C# .NET')).toContain('c#');
  });

  it('cắt query string — cái bẫy trùng lặp vô hạn của TopCV', () => {
    const dirty =
      'https://www.topcv.vn/viec-lam/abc/2262537.html?ta_source=JobSearchList_LinkDetail&u_sr_id=xyz_178';
    expect(canonicalizeUrl(dirty)).toBe('https://www.topcv.vn/viec-lam/abc/2262537.html');
  });

  it('chuẩn hoá scheme, host hoa thường và dấu / cuối', () => {
    expect(canonicalizeUrl('http://WWW.TopCV.vn/viec-lam/abc/1.html/#top')).toBe(
      'https://www.topcv.vn/viec-lam/abc/1.html',
    );
  });

  it('tước thẻ HTML mà vẫn giữ được ngắt dòng danh sách', () => {
    const text = htmlToText('<p>Việc:</p><ul><li>Làm A</li><li>Làm B</li></ul><script>x=1</script>');
    expect(text).toContain('Làm A');
    expect(text).toContain('Làm B');
    expect(text).not.toContain('x=1');
    expect(text).not.toContain('<');
  });
});

describe('số năm kinh nghiệm và cấp bậc', () => {
  it.each([
    ['3 năm kinh nghiệm', 3, 3],
    ['2-4 years', 2, 4],
    ['ít nhất 5 năm', 5, null],
    ['trên 7 năm kinh nghiệm', 7, null],
    ['không yêu cầu kinh nghiệm', 0, 0],
  ])('"%s"', (input, min, max) => {
    expect(parseYearsOfExperience(input)).toEqual({ min, max });
  });

  it('cấp cao thắng cấp thấp khi tiêu đề có cả hai', () => {
    // "Senior Manager" là MANAGER, không phải SENIOR
    expect(inferLevel('Senior Manager').level).toBe('MANAGER');
  });

  it.each([
    ['Thực tập sinh Backend', 'INTERN'],
    ['Fresher Java Developer', 'FRESHER'],
    ['Junior Frontend Developer', 'JUNIOR'],
    ['Senior Backend Engineer', 'SENIOR'],
    ['Trưởng nhóm phát triển', 'LEAD'],
    ['Trưởng phòng Kinh doanh', 'MANAGER'],
  ])('"%s" -> %s', (title, level) => {
    expect(inferLevel(title).level).toBe(level);
  });

  it('không đoán bừa khi không có tín hiệu nào', () => {
    // "Không biết" và "trung cấp" là hai chuyện khác nhau — gộp lại là bơm
    // nhiễu vào đúng nhóm đông nhất.
    expect(inferLevel('Nhân viên kinh doanh').level).toBeNull();
  });

  it('suy từ số năm khi tiêu đề không nói gì', () => {
    expect(inferLevel('Kỹ sư phần mềm', '6 năm kinh nghiệm').level).toBe('SENIOR');
    expect(inferLevel('Kỹ sư phần mềm', '1 năm kinh nghiệm').level).toBe('JUNIOR');
  });
});

describe('địa danh', () => {
  it('tên tỉnh trực tiếp', () => {
    expect(resolveProvince('Hà Nội')?.slug).toBe('ha-noi');
    expect(resolveProvince('Đà Nẵng')?.slug).toBe('da-nang');
  });

  it('bỏ tiền tố cấp hành chính', () => {
    expect(resolveProvince('Thành phố Hà Nội')?.slug).toBe('ha-noi');
    expect(resolveProvince('Tỉnh Đồng Nai')?.slug).toBe('dong-nai');
  });

  it('tên viết tắt', () => {
    expect(resolveProvince('TPHCM')?.slug).toBe('ho-chi-minh');
    expect(resolveProvince('Sài Gòn')?.slug).toBe('ho-chi-minh');
  });

  it('tên CŨ trước sáp nhập 2025 vẫn ra tỉnh mới', () => {
    // Không gộp thì cùng một thị trường lao động bị xé làm đôi trên biểu đồ
    expect(resolveProvince('Bình Dương')?.slug).toBe('ho-chi-minh');
    expect(resolveProvince('Bà Rịa - Vũng Tàu')?.slug).toBe('ho-chi-minh');
    expect(resolveProvince('Quảng Nam')?.slug).toBe('da-nang');
    expect(resolveProvince('Hải Dương')?.slug).toBe('hai-phong');
  });

  it('tìm được tỉnh trong địa chỉ đầy đủ nhiều cấp', () => {
    expect(resolveProvince('Số 1 Trần Phú, Phường Long Biên, Hà Nội')?.slug).toBe('ha-noi');
  });

  it('trả null cho chuỗi vô nghĩa thay vì đoán bừa', () => {
    expect(resolveProvince('Not Available')).toBeNull();
    expect(resolveProvince('')).toBeNull();
  });

  it('jobLocation dạng MẢNG lấy được hết, không chỉ phần tử đầu', () => {
    const locations = extractLocations([
      { '@type': 'Place', address: { addressRegion: 'Hà Nội' } },
      { '@type': 'Place', address: { addressRegion: 'Đà Nẵng' } },
    ]);
    expect(locations.map((l) => l.province?.slug)).toEqual(['ha-noi', 'da-nang']);
  });

  it('bỏ giá trị rác "Not Available" của ITviec', () => {
    const locations = extractLocations(itviec.jobLocation);
    expect(locations[0]?.province?.slug).toBe('ha-noi');
    expect(locations[0]?.raw).not.toContain('Not Available');
  });

  // CareerViet đảo hai ô so với mọi sàn khác: addressRegion là QUẬN, còn tỉnh
  // nằm ở addressLocality. Chỉ tra addressRegion thì "Quận 5" không ra tỉnh
  // nào, tin ra province = null, rơi khỏi bộ lọc tỉnh và biến mất khỏi trang
  // Ngành — im lặng, không một lỗi nào để lần ra. Đo thật 09/09/2026.
  it('tìm được tỉnh cả khi sàn ĐẢO addressRegion/addressLocality (CareerViet)', () => {
    const locations = extractLocations({
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Số 3 Trần Nhân Tôn, phường 9, quận 5, TP.HCM',
        addressRegion: 'Quận 5',
        addressLocality: 'Hồ Chí Minh',
        addressCountry: 'VN',
      },
    });
    expect(locations[0]?.province?.slug).toBe('ho-chi-minh');
  });

  it('vẫn ưu tiên addressRegion khi ô đó ĐÚNG là tỉnh', () => {
    // Bảo hiểm cho cách sửa ở trên: nguồn "thuận" phải khớp ngay ứng viên đầu,
    // chứ không được rơi xuống chuỗi gộp rồi vớ phải một tên tỉnh khác trong
    // địa chỉ đường phố.
    const locations = extractLocations({
      '@type': 'Place',
      address: {
        addressRegion: 'Hồ Chí Minh',
        addressLocality: 'Phường Tân Tạo',
        streetAddress: 'KCN Tân Tạo',
      },
    });
    expect(locations[0]?.province?.slug).toBe('ho-chi-minh');
  });
});

describe('normalizeJobPosting trên dữ liệu THẬT của ba sàn', () => {
  const ctx = (url: string) => ({ pageUrl: url, externalIdFromUrl: () => 'test-id' });

  it('TopCV: đủ tiêu đề, công ty, lương, cấp bậc, tỉnh', () => {
    const { posting } = validateJobPosting(topcv);
    const job = normalizeJobPosting(posting!, ctx('https://www.topcv.vn/viec-lam/a/1.html'));

    expect(job.title).toContain('Project Manager');
    expect(job.companyName).toBe('Công ty cổ phần Công nghệ Proton');
    expect(job.salary.isPublic).toBe(true);
    expect(job.salary.min).toBe(50_000_000);
    expect(job.salary.max).toBe(60_000_000);
    expect(job.employmentType).toBe('FULL_TIME');
    expect(job.locations[0]?.province?.slug).toBe('ha-noi');
    // experienceRequirements.monthsOfExperience = 36 -> 3 năm -> MID
    expect(job.level).toBe('MID');
    expect(job.parseStatus).toBe('OK');
  });

  it('TopDev: monthsOfExperience 60 -> 5 năm, và lương "Negotiable" -> không công khai', () => {
    const { posting } = validateJobPosting(topdev);
    const job = normalizeJobPosting(posting!, ctx('https://topdev.vn/detail-jobs/a-1'));

    expect(job.companyName).toBe('MBBANK');
    expect(job.salary.isPublic).toBe(false);
    expect(job.salary.min).toBeNull();
    expect(job.level).toBe('SENIOR');
    expect(job.locations[0]?.province?.slug).toBe('ha-noi');
    expect(job.expiresAt?.toISOString().slice(0, 10)).toBe('2026-09-11');
  });

  it('ITviec: USD quy về VND, kỹ năng tách từ chuỗi ngăn phẩy', () => {
    const { posting } = validateJobPosting(itviec);
    const job = normalizeJobPosting(posting!, ctx('https://itviec.com/it-jobs/a-4101'));

    expect(job.companyName).toBe('MB Bank');
    expect(job.salary.isPublic).toBe(true);
    expect(job.salary.currency).toBe('USD');
    expect(job.skillTexts).toContain('Python');
    expect(job.skillTexts).toContain('C++');
    expect(job.skillTexts).toContain('Docker');
    expect(job.employmentType).toBe('FULL_TIME');
  });

  // Đo thật ở CareerViet 09/09/2026: `"employmentType": ["\"FULL_TIME\""]` —
  // dấu nháy nằm TRONG nội dung chuỗi, dấu hiệu một lần JSON.stringify thừa ở
  // phía họ. Không bóc thì khoá tra thành `"FULL_TIME"` và cả nguồn ra null.
  it('CareerViet: employmentType có dấu nháy thừa vẫn đọc được', () => {
    const { posting } = validateJobPosting({
      '@type': 'JobPosting',
      title: 'Purchasing Staff',
      description: 'x',
      datePosted: '2026-09-09',
      hiringOrganization: { '@type': 'Organization', name: 'Vietmap' },
      jobLocation: { address: { addressRegion: 'Hồ Chí Minh' } },
      employmentType: ['"FULL_TIME"'],
    });
    const job = normalizeJobPosting(posting!, ctx('https://careerviet.vn/vi/tim-viec-lam/a.1A.html'));
    expect(job.employmentType).toBe('FULL_TIME');
  });

  it('không bao giờ ném lỗi với dữ liệu rác', () => {
    // Một tin dị dạng ở nguồn thứ tư không được xoá sổ ba nguồn trước đó.
    const { posting } = validateJobPosting({ '@type': 'JobPosting' });
    expect(() => normalizeJobPosting(posting!, ctx('https://x.vn/a'))).not.toThrow();

    const job = normalizeJobPosting(posting!, ctx('https://x.vn/a'));
    expect(job.parseStatus).toBe('PARTIAL');
    expect(job.parseError).toContain('thiếu');
  });

  it('ngày trần được hiểu theo giờ Việt Nam, không lệch một ngày', () => {
    const { posting } = validateJobPosting({
      '@type': 'JobPosting',
      title: 'a',
      description: 'b',
      datePosted: '2026-08-06',
      validThrough: '2026-09-11',
      hiringOrganization: { name: 'c' },
      jobLocation: { address: { addressRegion: 'Hà Nội' } },
    });
    const job = normalizeJobPosting(posting!, ctx('https://x.vn/a'));

    // validThrough ngày trần phải là CUỐI ngày, nếu không tin bị coi là hết
    // hạn sớm mất một ngày.
    expect(job.expiresAt!.toISOString()).toBe('2026-09-11T16:59:59.000Z'); // 23:59:59+07
    expect(job.postedAt.toISOString()).toBe('2026-08-05T17:00:00.000Z'); // 00:00:00+07
  });
});

/**
 * Hai bẫy đo được ở vieclamnhamay.vn ngày 11/09/2026. Cả hai đều hỏng LẶNG LẼ:
 * không ném lỗi, không đổi parseStatus, chỉ cho ra số sai.
 */
/**
 * Hai bẫy đo được ở vieclamnhamay.vn ngày 11/09/2026. Cả hai hỏng LẶNG LẼ:
 * không ném lỗi, không đổi parseStatus, chỉ cho ra số sai.
 *
 * Mốc so sánh viết dưới dạng UTC có chủ ý: ngày trần được neo vào +07:00 nên
 * "11/09 giờ Việt Nam" chính là "10/09T17:00Z". So bằng `.slice(0, 10)` của
 * chuỗi ISO là so nhầm sang múi giờ khác và sẽ luôn lệch một ngày.
 */
describe('bẫy dữ liệu của vieclamnhamay.vn', () => {
  const base = {
    '@type': 'JobPosting',
    title: 'Chuyên viên thu mua',
    description: 'Mô tả công việc thu mua vật tư.',
    hiringOrganization: { '@type': 'Organization', name: 'Công ty Tài Ký' },
  };
  const ctx = {
    pageUrl: 'https://vieclamnhamay.vn/viec-lam/249971-abc',
    externalIdFromUrl: () => '249971',
  };

  it('đọc datePosted dạng ngày-tháng-năm chứ không đoán theo lối Mỹ', () => {
    // new Date("11-09-2026") của V8 cho ra 08/11/2026 — lệch gần hai tháng.
    const job = normalizeJobPosting({ ...base, datePosted: '11-09-2026' }, ctx);
    expect(job.postedAt.toISOString()).toBe('2026-09-10T17:00:00.000Z');
  });

  it('đọc được ngày > 12 vốn làm new Date() trả Invalid Date', () => {
    const job = normalizeJobPosting(
      { ...base, datePosted: '25-12-2026', validThrough: '31-12-2026' },
      ctx,
    );
    expect(job.postedAt.toISOString()).toBe('2026-12-24T17:00:00.000Z');
    // validThrough được đẩy về cuối ngày, nên 31/12 giờ VN = 31/12T16:59:59Z.
    expect(job.expiresAt?.toISOString()).toBe('2026-12-31T16:59:59.000Z');
    expect(job.parseError ?? '').not.toContain('datePosted');
  });

  it('không nhận ô THÁNG > 12 — trả null thay vì đảo bừa hai ô', () => {
    const job = normalizeJobPosting({ ...base, datePosted: '09-25-2026' }, ctx);
    expect(job.parseError).toContain('datePosted');
  });

  it('vẫn đọc đúng ISO như cũ', () => {
    const job = normalizeJobPosting({ ...base, datePosted: '2026-08-04' }, ctx);
    expect(job.postedAt.toISOString()).toBe('2026-08-03T17:00:00.000Z');
  });

  /**
   * Ca thật: địa chỉ ở TP.HCM nhưng cả hai ô cấp tỉnh khai "Hà Nội".
   *
   * Chọn đúng mẫu này làm test vì trong ba tin đã đo, đây là tin DUY NHẤT chứng
   * minh được lỗi. Hai tin kia khai "HCMC" và "Bình Dương" — mà "Bình Dương" là
   * bí danh hợp lệ của ho-chi-minh sau sáp nhập 2025, nên chúng ra đúng kết quả
   * dù đi đường nào, và không phân biệt được gì cả.
   */
  it('trustStreetFirst lấy tỉnh từ streetAddress khi ô cấp tỉnh khai sai tỉnh', () => {
    const jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '435 Quốc lộ 13, Khu phố 24, Phường Hiệp Bình, TP. Hồ Chí Minh, Việt Nam',
        addressLocality: 'Hà Nội',
        addressRegion: 'Hà Nội',
      },
    };

    expect(extractLocations(jobLocation)[0]?.province?.slug).toBe('ha-noi');
    expect(extractLocations(jobLocation, { trustStreetFirst: true })[0]?.province?.slug).toBe(
      'ho-chi-minh',
    );
  });

  it('trustStreetFirst KHÔNG làm hỏng nguồn khai địa chỉ đúng chiều', () => {
    // ITviec/TopDev: tỉnh ở region, phường ở locality, street không có tên tỉnh.
    const jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Toà nhà E.Town, 364 Cộng Hoà',
        addressLocality: 'Phường Tân Bình',
        addressRegion: 'Hồ Chí Minh',
      },
    };
    expect(extractLocations(jobLocation, { trustStreetFirst: true })[0]?.province?.slug).toBe(
      'ho-chi-minh',
    );
  });
});
