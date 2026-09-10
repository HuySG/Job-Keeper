import { describe, expect, it } from 'vitest';

import {
  buildUrl,
  readParam,
  readParams,
  urlToggleValue,
  urlWithout,
  urlWithoutValue,
  type SearchParams,
} from '@/lib/query';

const PATH = '/nganh';

describe('đọc tham số', () => {
  it('readParams trả MỌI giá trị của một tham số lặp', () => {
    const params: SearchParams = { loai: ['san-xuat', 'det-may'] };
    expect(readParams(params, 'loai')).toEqual(['san-xuat', 'det-may']);
  });

  it('readParams gói giá trị đơn thành mảng một phần tử', () => {
    expect(readParams({ loai: 'san-xuat' }, 'loai')).toEqual(['san-xuat']);
  });

  it('readParams trả mảng RỖNG khi không có, không phải undefined', () => {
    expect(readParams({}, 'loai')).toEqual([]);
    expect(readParams({ loai: '' }, 'loai')).toEqual([]);
  });

  it('readParam vẫn chỉ lấy giá trị đầu, cho chiều đơn giá trị', () => {
    expect(readParam({ luong: ['15000000', '25000000'] }, 'luong')).toBe('15000000');
  });
});

describe('dựng URL với bộ lọc chọn nhiều', () => {
  // Đây là lỗi đã có thật trước khi sửa: buildUrl dùng readParam nên mỗi lần
  // dựng lại URL là vứt mất mọi giá trị trừ cái đầu. Chọn ba loại rồi bấm sang
  // trang 2 thì còn đúng một loại — im lặng, không báo gì.
  it('GIỮ ĐỦ mọi giá trị khi đổi trang', () => {
    const params: SearchParams = { loai: ['san-xuat', 'det-may', 'xay-dung'] };
    const url = buildUrl(PATH, params, { page: 2 });
    expect(url).toBe('/nganh?loai=san-xuat&loai=det-may&loai=xay-dung&page=2');
  });

  it('ghi đè bằng mảng thì thành nhiều tham số cùng tên', () => {
    expect(buildUrl(PATH, {}, { quan: ['Quận 7', 'Bình Tân'] })).toBe(
      '/nganh?quan=Qu%E1%BA%ADn+7&quan=B%C3%ACnh+T%C3%A2n',
    );
  });

  it('mảng rỗng nghĩa là xoá tham số', () => {
    expect(buildUrl(PATH, { loai: ['a', 'b'] }, { loai: [] })).toBe('/nganh');
  });

  it('đổi bộ lọc thì luôn về trang 1', () => {
    const params: SearchParams = { loai: ['a'], page: '7' };
    expect(buildUrl(PATH, params, { quan: 'Quận 1' })).not.toContain('page=7');
  });
});

describe('gỡ và bật/tắt từng giá trị', () => {
  it('urlWithoutValue chỉ bỏ một giá trị, giữ phần còn lại', () => {
    const params: SearchParams = { loai: ['san-xuat', 'det-may'] };
    expect(urlWithoutValue(PATH, params, 'loai', 'det-may')).toBe('/nganh?loai=san-xuat');
  });

  it('urlWithoutValue bỏ nốt giá trị cuối thì xoá hẳn tham số', () => {
    expect(urlWithoutValue(PATH, { loai: ['san-xuat'] }, 'loai', 'san-xuat')).toBe('/nganh');
  });

  it('urlWithout xoá cả tham số, kể cả khi đang có nhiều giá trị', () => {
    expect(urlWithout(PATH, { loai: ['a', 'b'], quan: 'X' }, 'loai')).toBe('/nganh?quan=X');
  });

  it('urlToggleValue thêm khi chưa có', () => {
    expect(urlToggleValue(PATH, { loai: ['a'] }, 'loai', 'b')).toBe('/nganh?loai=a&loai=b');
  });

  it('urlToggleValue bỏ khi đã có — bấm lại dòng đang chọn là gỡ lọc', () => {
    expect(urlToggleValue(PATH, { loai: ['a', 'b'] }, 'loai', 'a')).toBe('/nganh?loai=b');
  });
});
