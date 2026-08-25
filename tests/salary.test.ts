import { beforeAll, describe, expect, it } from 'vitest';

import { parseNumber, parseSalaryJsonLd, parseSalaryText } from '@/crawler/normalize/salary';

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
});
