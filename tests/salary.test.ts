import { beforeAll, describe, expect, it } from 'vitest';

import {
  parseNumber,
  parseSalaryJsonLd,
  parseSalaryText,
  replaceSalaryProblem,
  salaryFromRaw,
} from '@/crawler/normalize/salary';

import topcv from './fixtures/topcv-job.json';
import topdev from './fixtures/topdev-job.json';
import itviec from './fixtures/itviec-job.json';

const TR = 1_000_000;

beforeAll(() => {
  // Cố định tỷ giá để test không đổi kết quả theo .env của từng máy.
  process.env.USD_VND_RATE = '25000';
  process.env.USD_VND_RATE_DATE = '2026-08-25';
});

describe('parseNumber — dấu chấm/phẩy mang hai nghĩa ngược nhau', () => {
  it('chấm ngăn nghìn kiểu Việt', () => {
    expect(parseNumber('20.000.000')).toBe(20_000_000);
  });

  it('phẩy ngăn nghìn kiểu Anh', () => {
    expect(parseNumber('20,000,000')).toBe(20_000_000);
  });

  it('phẩy thập phân kiểu Việt', () => {
    expect(parseNumber('15,5')).toBe(15.5);
  });

  it('chấm thập phân kiểu Anh', () => {
    expect(parseNumber('15.5')).toBe(15.5);
  });

  it('số trần', () => {
    expect(parseNumber('6200')).toBe(6200);
  });

  it('chuỗi không có số', () => {
    expect(parseNumber('Thoả thuận')).toBeNull();
  });
});

describe('parseSalaryText', () => {
  it('khoảng có đơn vị ở cuối áp cho cả hai vế', () => {
    // "15 - 20 triệu": số 15 KHÔNG phải mười lăm đồng
    const s = parseSalaryText('15 - 20 triệu');
    expect(s.isPublic).toBe(true);
    expect(s.min).toBe(15 * TR);
    expect(s.max).toBe(20 * TR);
  });

  it('viết tắt "tr"', () => {
    const s = parseSalaryText('8-10tr');
    expect(s.min).toBe(8 * TR);
    expect(s.max).toBe(10 * TR);
  });

  it('"M" / "mil" / "million" là triệu — cách ghi của sàn IT', () => {
    expect(parseSalaryText('15 - 20M')).toMatchObject({ min: 15 * TR, max: 20 * TR, currency: 'VND' });
    expect(parseSalaryText('Up to 35mil')).toMatchObject({ min: null, max: 35 * TR });
    expect(parseSalaryText('25 million VND')).toMatchObject({ min: 25 * TR, max: 25 * TR });
  });

  it('chữ "m" đầu một từ khác không phải đơn vị triệu', () => {
    // "20 months" không được thành 20 triệu — nó là 20 đồng, tức ngoài khoảng.
    const s = parseSalaryText('20 months');
    expect(s.outOfRange).toBe(true);
    expect(s.min).not.toBe(20 * TR);
  });

  it('"Upto" chỉ cho trần, không có sàn', () => {
    const s = parseSalaryText('Upto 60tr');
    expect(s.min).toBeNull();
    expect(s.max).toBe(60 * TR);
  });

  it('"Trên X triệu" chỉ cho sàn', () => {
    const s = parseSalaryText('Trên 30 triệu');
    expect(s.min).toBe(30 * TR);
    expect(s.max).toBeNull();
  });

  it('số đầy đủ kèm đơn vị tiền', () => {
    const s = parseSalaryText('20,000,000 - 30,000,000 VNĐ');
    expect(s.min).toBe(20 * TR);
    expect(s.max).toBe(30 * TR);
  });

  it('USD quy về VND và ghi lại tỷ giá đã dùng', () => {
    const s = parseSalaryText('$2000-3000');
    expect(s.currency).toBe('USD');
    expect(s.min).toBe(2000 * 25_000);
    expect(s.max).toBe(3000 * 25_000);
    expect(s.fxRate).toBe(25_000);
    expect(s.fxRateDate).toBeInstanceOf(Date);
  });

  it('lương năm được quy về tháng', () => {
    const s = parseSalaryText('600 triệu/năm');
    expect(s.period).toBe('YEAR');
    expect(s.min).toBe(50 * TR);
  });

  it.each([
    'Thoả thuận',
    'Thương lượng',
    'Cạnh tranh',
    'Negotiable',
    'Competitive',
    'Lương thoả thuận theo năng lực',
  ])('"%s" -> không công khai, KHÔNG phải số 0', (input) => {
    const s = parseSalaryText(input);
    expect(s.isPublic).toBe(false);
    // Đây là điều kiện quan trọng nhất trong cả file: một số 0 lọt vào là mọi
    // trung vị trong SalaryStat đều sai, mà sai lặng lẽ.
    expect(s.min).toBeNull();
    expect(s.max).toBeNull();
  });

  it('chuỗi rỗng / null', () => {
    expect(parseSalaryText(null).isPublic).toBe(false);
    expect(parseSalaryText('').isPublic).toBe(false);
  });

  it('đảo lại khi nguồn ghi ngược min/max', () => {
    const s = parseSalaryText('30 - 20 triệu');
    expect(s.min).toBe(20 * TR);
    expect(s.max).toBe(30 * TR);
  });

  it('cắm cờ khi số ngoài khoảng hợp lý', () => {
    // 900 triệu/tháng: gần như chắc chắn parser đọc nhầm đơn vị
    expect(parseSalaryText('900 triệu').outOfRange).toBe(true);
    expect(parseSalaryText('20 triệu').outOfRange).toBe(false);
  });

  it('số ngoài khoảng KHÔNG được công khai — cờ thôi thì vẫn lọt vào trung vị', () => {
    // Đo 17/09/2026: thống kê chỉ lọc theo `salaryIsPublic`, nên số bị cờ mà
    // vẫn công khai thì vẫn vào p25/trung vị/p75. 185 tin của bae như thế.
    const s = parseSalaryText('900 triệu');
    expect(s.isPublic).toBe(false);
    expect(s.min).toBeNull();
    expect(s.max).toBeNull();
    // Giữ chuỗi gốc để còn soi lại vì sao bị loại.
    expect(s.raw).toBe('900 triệu');
  });
});

describe('parseSalaryJsonLd trên dữ liệu THẬT', () => {
  it('TopCV: QuantitativeValue có min/max VND', () => {
    const s = parseSalaryJsonLd(topcv.baseSalary);
    expect(s?.isPublic).toBe(true);
    expect(s?.min).toBe(50 * TR);
    expect(s?.max).toBe(60 * TR);
  });

  it('ITviec: USD/tháng được quy về VND', () => {
    const s = parseSalaryJsonLd(itviec.baseSalary);
    expect(s?.currency).toBe('USD');
    expect(s?.min).toBe(800 * 25_000);
    expect(s?.max).toBe(2000 * 25_000);
  });

  it('TopDev: value là chữ "Negotiable" -> trả null để rơi về đường văn bản', () => {
    // Bẫy thật: currency VND, unitText MONTH, nhưng value lại là một CHỮ.
    expect(parseSalaryJsonLd(topdev.baseSalary)).toBeNull();
  });

  it('value là một số trần -> vừa là sàn vừa là trần', () => {
    const s = parseSalaryJsonLd({
      '@type': 'MonetaryAmount',
      currency: 'VND',
      value: { '@type': 'QuantitativeValue', value: 25_000_000, unitText: 'MONTH' },
    });
    expect(s?.min).toBe(25 * TR);
    expect(s?.max).toBe(25 * TR);
  });

  it('baseSalary vắng mặt', () => {
    expect(parseSalaryJsonLd(undefined)).toBeNull();
    expect(parseSalaryJsonLd(null)).toBeNull();
  });

  it('lương giờ được quy về tháng', () => {
    const s = parseSalaryJsonLd({
      currency: 'VND',
      value: { minValue: 50_000, maxValue: 60_000, unitText: 'HOUR' },
    });
    expect(s?.period).toBe('HOUR');
    expect(s?.min).toBe(50_000 * 176);
  });

  // ITviec, tin 5224, cào 17/09/2026 — nguyên văn `baseSalary`. Hai bẫy chồng
  // lên nhau: `value` là CHUỖI KHOẢNG (không có minValue/maxValue), và sàn khai
  // `currency: "USD"` cho một chuỗi ghi rõ "đ". Trước khi sửa: hai số dính liền
  // thành 3.000.000.050.000.000, nhân tỷ giá USD ra 7,62e19 — tràn cột Int và
  // làm DỪNG cả lượt cào ITviec.
  const ITVIEC_5224 = {
    '@type': 'MonetaryAmount',
    currency: 'USD',
    value: {
      '@type': 'QuantitativeValue',
      unitText: 'MONTH',
      value: '30,000,000 - 50,000,000đ\t',
    },
  };

  it('ITviec 5224: chuỗi KHOẢNG trong value được đọc thành khoảng', () => {
    const s = parseSalaryJsonLd(ITVIEC_5224);
    expect(s?.min).toBe(30 * TR);
    expect(s?.max).toBe(50 * TR);
    expect(s?.outOfRange).toBe(false);
  });

  it('ITviec 5224: chuỗi ghi "đ" thắng lời khai currency USD của sàn', () => {
    const s = parseSalaryJsonLd(ITVIEC_5224);
    expect(s?.currency).toBe('VND');
    expect(s?.fxRate).toBeNull();
  });

  // Ba chuỗi THẬT khác của ITviec (tin 3903, 5745, 3443 — cào 17/09/2026),
  // cùng khai `currency: "USD"`. So code cũ với mới trên 2.926 blob thì chỉ bốn
  // tin này đổi kết quả, và cả bốn đều là ITviec.
  const itviecValue = (value: string) => ({
    '@type': 'MonetaryAmount',
    currency: 'USD',
    value: { '@type': 'QuantitativeValue', unitText: 'MONTH', value },
  });

  it('ITviec 3903: "18 - 20M" là 18–20 triệu ĐỒNG, dù sàn khai USD', () => {
    const s = parseSalaryJsonLd(itviecValue('18 - 20M'));
    expect(s?.currency).toBe('VND');
    expect(s?.min).toBe(18 * TR);
    expect(s?.max).toBe(20 * TR);
  });

  it('ITviec 5745: "Up to 35mil" là tối đa 35 triệu đồng', () => {
    const s = parseSalaryJsonLd(itviecValue('Up to 35mil'));
    expect(s?.currency).toBe('VND');
    expect(s?.min).toBeNull();
    expect(s?.max).toBe(35 * TR);
  });

  it('ITviec 3443: "Upto $1100 gross/tháng" là TRẦN 1.100 USD, không phải cả sàn lẫn trần', () => {
    const s = parseSalaryJsonLd(itviecValue('Upto $1100 gross/tháng'));
    expect(s?.currency).toBe('USD');
    expect(s?.min).toBeNull();
    expect(s?.max).toBe(1100 * 25_000);
  });

  it('chuỗi KHÔNG nói tiền tệ thì tin lời khai currency của JSON-LD', () => {
    // Ca biên tự dựng — chưa gặp thật, nhưng là điều ngược lại của ca trên.
    const s = parseSalaryJsonLd({
      currency: 'USD',
      value: { unitText: 'MONTH', value: '800 - 2,000' },
    });
    expect(s?.currency).toBe('USD');
    expect(s?.min).toBe(800 * 25_000);
    expect(s?.max).toBe(2000 * 25_000);
  });

  it('timviec365: value là chuỗi một số — giữ nguyên kết quả cũ', () => {
    // Dạng của 69 tin timviec365 + 4 tin CareerViet trong CSDL bae (đo 17/09).
    const s = parseSalaryJsonLd({
      '@type': 'MonetaryAmount',
      currency: 'VND',
      value: { '@type': 'QuantitativeValue', unitText: 'MONTH', value: '20000000' },
    });
    expect(s?.min).toBe(20 * TR);
    expect(s?.max).toBe(20 * TR);
    expect(s?.currency).toBe('VND');
  });
});

describe('tỷ giá — biến môi trường RỖNG không được thành 0', () => {
  // Đo 17/09/2026 trong CSDL bae: 172 tin USD có fxRate = 0 và lương = 0, cả
  // 172 đều cào trên GitHub Actions. Workflow truyền `${{ vars.USD_VND_RATE }}`,
  // mà Variable chưa khai thì GitHub đưa vào CHUỖI RỖNG — và
  // `Number('' ?? 25_400)` là 0, vì `??` chỉ bắt null/undefined.
  const USD_800 = { currency: 'USD', value: { minValue: 800, maxValue: 800, unitText: 'MONTH' } };

  it.each(['', '   ', 'abc', '0', '-5'])('USD_VND_RATE=%j → dùng mức dự phòng, không bao giờ 0', (raw) => {
    const saved = process.env.USD_VND_RATE;
    process.env.USD_VND_RATE = raw;
    try {
      const s = parseSalaryJsonLd(USD_800);
      expect(s?.fxRate).toBe(25_400);
      expect(s?.min).toBe(800 * 25_400);
      expect(s?.outOfRange).toBe(false);
    } finally {
      process.env.USD_VND_RATE = saved;
    }
  });
});

describe('lương 0 đồng từ JSON-LD là "không đọc được", không phải số 0', () => {
  it('minValue/maxValue = 0 -> không công khai', () => {
    const s = parseSalaryJsonLd({ currency: 'VND', value: { minValue: 0, maxValue: 0, unitText: 'MONTH' } });
    expect(s?.isPublic ?? false).toBe(false);
    expect(s?.min ?? null).toBeNull();
  });
});

describe('salaryFromRaw — tính lại từ salaryRaw đã lưu (tin không có blob)', () => {
  it('JSON baseSalary: tính lại bằng tỷ giá hiện hành', () => {
    // Nguyên văn salaryRaw của một tin VNW cào trên CI, lưu với fxRate = 0.
    const raw =
      '{"@type":"MonetaryAmount","currency":"USD","value":{"@type":"QuantitativeValue","minValue":600,"maxValue":1000,"unitText":"MONTH"}}';
    const s = salaryFromRaw(raw);
    expect(s?.isPublic).toBe(true);
    expect(s?.min).toBe(600 * 25_000);
    expect(s?.max).toBe(1000 * 25_000);
    expect(s?.fxRate).toBe(25_000);
    expect(s?.raw).toBe(raw);
  });

  it('chuỗi văn bản: đọc như lương viết tay', () => {
    expect(salaryFromRaw('15 - 20 triệu')).toMatchObject({ min: 15 * TR, max: 20 * TR });
  });

  it('JSON bị cắt cụt ở 300 ký tự thì không đoán — trả null để bỏ qua', () => {
    expect(salaryFromRaw('{"@type":"MonetaryAmount","currency":"VND","value":{"minVal')).toBeNull();
  });

  it('không có chuỗi gốc thì không có gì để tính', () => {
    expect(salaryFromRaw(null)).toBeNull();
  });
});

describe('replaceSalaryProblem — chỉ thay đúng mục lương trong parseError', () => {
  const bad = parseSalaryText('900 triệu');
  const good = parseSalaryText('20 triệu');

  it('bỏ mục lương cũ, giữ nguyên các lỗi khác', () => {
    const before = 'thiếu description; lương ngoài khoảng hợp lý: {"currency":"USD"}; thiếu jobLocation';
    expect(replaceSalaryProblem(before, good)).toBe('thiếu description; thiếu jobLocation');
  });

  it('chỉ còn mỗi lỗi lương mà nay đã hết -> null', () => {
    expect(replaceSalaryProblem('lương ngoài khoảng hợp lý: x', good)).toBeNull();
  });

  it('lương vẫn ngoài khoảng -> ghi lại đúng một mục, với chuỗi gốc mới', () => {
    expect(replaceSalaryProblem('lương ngoài khoảng hợp lý: cũ', bad)).toBe(
      'lương ngoài khoảng hợp lý: 900 triệu',
    );
  });
});
