import { describe, expect, it } from 'vitest';

import { extractDistrict } from '@/crawler/normalize/district';
import { parseSchedule, SCHEDULE_RAW_MAX } from '@/crawler/normalize/schedule';
import { SaturdayWork } from '@/enums';

/**
 * Mọi chuỗi trong file này đều LẤY TỪ BLOB THẬT đã cào ngày 08/09/2026, không
 * phải ví dụ tự nghĩ ra. Ví dụ tự nghĩ thì bao giờ cũng vừa khít với regex mình
 * vừa viết — và đó chính là lý do chúng không bắt được lỗi nào.
 */

describe('lịch làm việc — câu thật từ tin tuyển dụng', () => {
  it('"Thứ Hai – Thứ Sáu (08:15 AM – 17:15 PM)" → nghỉ thứ 7', () => {
    const r = parseSchedule(
      'Thời gian làm việc / 工作时间: Thứ Hai – Thứ Sáu (08:15 AM – 17:15 PM) / 周一至周五',
    );
    expect(r.saturday).toBe(SaturdayWork.NONE);
    expect(r.raw).toContain('Thời gian làm việc');
  });

  it('"từ thứ 2 - thứ 6 (8:30-17:30), làm việc online sáng thứ 7" → NỬA NGÀY, không phải nghỉ', () => {
    // Ca quan trọng nhất của cả bộ đọc: câu này khớp CẢ hai mẫu. Nếu xét
    // "thứ 2 - thứ 6" trước thì kết luận được nghỉ trọn thứ Bảy — sai, và sai
    // theo hướng có lợi cho tin, tức là đúng kiểu sai tệ nhất.
    const r = parseSchedule(
      'Thời gian làm việc: từ thứ 2 - thứ 6 (8:30-17:30), làm việc online sáng thứ 7 (8:30-12:00).',
    );
    expect(r.saturday).toBe(SaturdayWork.HALF_DAY);
  });

  it('"Thứ 2 đến Thứ 6 (từ 08h00 đến 17h00)" → nghỉ thứ 7', () => {
    expect(parseSchedule('Thời gian làm việc: Thứ 2 đến Thứ 6 (từ 08h00 đến 17h00).').saturday).toBe(
      SaturdayWork.NONE,
    );
  });

  it('"từ thứ 2 đến thứ 7 (Từ 8h đến 17h30, riêng Thứ 7 từ 8h đến 12h)" → nửa ngày', () => {
    const r = parseSchedule(
      'Thời gian làm việc từ thứ 2 đến thứ 7 (Từ 8h đến 17h30, riêng Thứ 7 từ 8h đến 12h)',
    );
    expect(r.saturday).toBe(SaturdayWork.HALF_DAY);
  });

  it('"7h30 - 18h00 T2 - T7 hoặc T2 - CN" → làm trọn thứ 7', () => {
    expect(parseSchedule('Thời gian làm việc: 7h30 - 18h00 T2 - T7 hoặc T2 - CN').saturday).toBe(
      SaturdayWork.FULL,
    );
  });

  it('"T2-T6, riêng T7 làm việc linh hoạt tại nhà" → nghỉ thứ 7 tại văn phòng', () => {
    // Viết tắt T2-T6 phải bắt được y như "thứ 2 - thứ 6".
    expect(
      parseSchedule('Thời gian làm việc: T2-T6, riêng T7 làm việc linh hoạt tại nhà').saturday,
    ).toBe(SaturdayWork.NONE);
  });

  it('"Thứ hai đến Thứ sáu" viết bằng chữ → nghỉ thứ 7', () => {
    expect(parseSchedule('Thời gian làm việc: Thứ hai đến Thứ sáu').saturday).toBe(
      SaturdayWork.NONE,
    );
  });

  it('luân phiên / cách tuần', () => {
    expect(parseSchedule('Làm việc T2-T7, thứ 7 luân phiên').saturday).toBe(SaturdayWork.ALTERNATE);
    expect(parseSchedule('Nghỉ thứ 7 cách tuần').saturday).toBe(SaturdayWork.ALTERNATE);
  });

  it('tin viết KHÔNG DẤU vẫn đọc được — rất phổ biến', () => {
    expect(parseSchedule('Thoi gian lam viec: thu 2 den thu 6').saturday).toBe(SaturdayWork.NONE);
  });

  it('"7h30-11h, 13h-17h" — có giờ nhưng KHÔNG nói ngày → không kết luận', () => {
    // Đây là chỗ dễ sai nhất: có chữ "thời gian làm việc" nên rất dễ tưởng là
    // đã biết. Nhưng câu này không nói gì về thứ Bảy cả.
    const r = parseSchedule('Thời gian làm việc: 7h30-11h, 13h-17h');
    expect(r.saturday).toBeNull();
  });

  it('tin không nhắc gì → null cả hai, KHÔNG đoán', () => {
    const r = parseSchedule('Phụ trách mua hàng nguyên vật liệu, làm việc với nhà cung cấp.');
    expect(r.saturday).toBeNull();
    expect(r.raw).toBeNull();
  });

  it('nhắc thứ 7 nhưng không rõ kiểu → giữ câu gốc, vẫn không kết luận', () => {
    const r = parseSchedule('Có thể hỗ trợ thêm vào thứ 7 khi cần thiết.');
    expect(r.saturday).toBeNull();
    expect(r.raw).not.toBeNull();
  });

  it('câu gốc bị cắt đúng ngưỡng', () => {
    const long = `Thời gian làm việc: ${'chi tiết '.repeat(60)} thứ 2 đến thứ 6`;
    const r = parseSchedule(long);
    expect(r.raw!.length).toBeLessThanOrEqual(SCHEDULE_RAW_MAX);
  });

  it('không có mô tả → không nổ', () => {
    expect(parseSchedule(null).saturday).toBeNull();
    expect(parseSchedule('').raw).toBeNull();
  });
});

describe('quận/KCN — địa chỉ thật từ tin', () => {
  it.each([
    ['Lô 12 Đường Trung Tâm, KCN Tân Tạo, Phường Tân Tạo, TPHCM, Hồ Chí Minh', 'KCN Tân Tạo'],
    ['Khu chế xuất Tân Thuận, TP.HCM, Hồ Chí Minh', 'KCN Tân Thuận'],
    ['Tòa Ree – 9 Đoàn Văn Bơ, Phường Xóm Chiếu, HCM, Hồ Chí Minh', null],
    ['123 Nguyễn Văn Trỗi, Phú Nhuận, Hồ Chí Minh', 'Phú Nhuận'],
    ['Toà nhà Bitexco, Quận 1, TP. Hồ Chí Minh', 'Quận 1'],
    ['số 5 đường số 7, Q.7, Hồ Chí Minh', 'Quận 7'],
    ['Đường D1, Thu Duc, Ho Chi Minh City', 'Thủ Đức'],
    ['Tan Binh Industrial Park, Tay Thanh Ward, Ho Chi Minh City', 'Tân Bình'],
    ['Hồ Chí Minh, Việt Nam, Hồ Chí Minh', null],
  ])('%s → %s', (address, expected) => {
    expect(extractDistrict([address])).toBe(expected);
  });

  it('vùng sáp nhập 2025 giữ tên riêng, không gộp thành "Bình Dương"', () => {
    // Dĩ An và Bến Cát cách nhau 50 km. Gộp lại thành một là bỏ đi đúng thông
    // tin mà người đi làm cần.
    expect(extractDistrict(['KCN Sóng Thần, Dĩ An, Bình Dương'])).toBe('Dĩ An');
    expect(extractDistrict(['Bến Cát, Bình Dương'])).toBe('Bến Cát');
    expect(extractDistrict(['Phú Mỹ, tỉnh Bà Rịa – Vũng Tàu (cũ)'])).toBe('Phú Mỹ');
  });

  it('KHÔNG bịa ra quận không tồn tại', () => {
    // "Quận 15" không có thật — gần như chắc chắn là đọc nhầm số nhà.
    expect(extractDistrict(['Lô 15, Quận 15, Hồ Chí Minh'])).toBeNull();
    // Quận 2 và Quận 9 đã nhập vào Thủ Đức từ 2021.
    expect(extractDistrict(['Quận 2, Hồ Chí Minh'])).toBeNull();
  });

  it('không khớp nhầm khi tên quận nằm lọt trong từ khác', () => {
    expect(extractDistrict(['Công ty Dĩ Andrew, Hà Nội'])).toBeNull();
  });

  it('nhiều địa điểm → lấy chỗ đầu tiên bóc được', () => {
    expect(extractDistrict(['Hồ Chí Minh', 'Số 1, Gò Vấp, Hồ Chí Minh'])).toBe('Gò Vấp');
  });

  it('danh sách rỗng → null', () => {
    expect(extractDistrict([])).toBeNull();
  });
});
