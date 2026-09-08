import { describe, expect, it } from 'vitest';

import { FIELD_SEEDS } from '@/constants/field';
import { compileField, isNarrowHcm, matchJob } from '@/lib/field-match';

/**
 * Bộ khớp ngành, thử trên đúng những tiêu đề đã gặp thật khi khảo sát
 * vieclam24h và VietnamWorks ngày 08/09/2026.
 *
 * Mỗi ca "loại" ở đây là một tin ĐÃ lọt vào lát cắt thu mua + TP.HCM. Đó là lý
 * do chúng đáng được khoá bằng test: chúng không phải giả định, chúng là nhiễu
 * đã đo được.
 */

const seed = FIELD_SEEDS.find((f) => f.slug === 'thu-mua-hcm');
if (!seed) throw new Error('thiếu seed ngành thu-mua-hcm');

const field = compileField({ keywords: seed.keywords, excludes: seed.excludes });

const verdictOf = (title: string, description?: string): string =>
  matchJob(field, { title, description }).verdict;

describe('nhận đúng nghề thu mua', () => {
  it.each([
    'Trưởng Phòng Mua Hàng (Procurement Manager)',
    'Nhân Viên Thu Mua',
    'Chuyên Viên Mua Hàng Quốc Tế - Thu Nhập Up To 25M',
    'Nhân Viên Thu Mua (Yêu Cầu Tiếng Trung)',
    'Purchasing Staff',
    'Senior Procurement Executive',
    'Merchandiser - Nhân Viên Quản Lý Đơn Hàng',
    'Nhân viên vật tư',
    'Trưởng nhóm đấu thầu',
    'Strategic Sourcing Manager',
  ])('nhận chắc: %s', (title) => {
    expect(verdictOf(title)).toBe('strong');
  });

  it('bỏ dấu vẫn khớp — tin viết không dấu rất phổ biến', () => {
    expect(verdictOf('NHAN VIEN THU MUA VAT TU')).toBe('strong');
  });

  it('khớp cả hậu tố: "buyer" phải bắt được "buyers"', () => {
    expect(verdictOf('Senior Buyers - Electronics')).toBe('strong');
  });
});

describe('loại đúng ba tầng nhiễu đã đo', () => {
  it.each([
    // Nhiễu 1 — sales đội lốt
    'Nhân Viên Tư Vấn Mua Hàng',
    'Nhân Viên Kinh Doanh Vật Tư Trang Trí Nội Thất',
    'Nhân Viên Kinh Doanh Đấu Thầu - Đi Làm Ngay',
    // Nhiễu 2 — kho bãi cùng danh mục c14 của sàn
    'Nhân Viên Kho Hàng',
    'Nam Nhân Viên Phụ Kho - Bán Thời Gian',
    'Nhân viên xử lý đơn kho vận',
    // Nhiễu 3 — kế toán
    'Kế Toán Mua Hàng',
    'Thực Tập Sinh Kế Toán',
    // Nhiễu 4 — nhân sự dùng chung chữ "sourcing"
    'Talent Sourcing Trainee',
    'Chuyên viên tuyển dụng - Recruitment Executive',
  ])('loại: %s', (title) => {
    expect(verdictOf(title)).toBe('reject');
  });

  it('nêu đích danh từ đã chặn, để gỡ rối được khi loại oan', () => {
    const result = matchJob(field, { title: 'Kế Toán Mua Hàng' });
    expect(result.rejectedBy).toBe('kế toán mua hàng');
  });

  it('từ loại trong TIÊU ĐỀ thắng cả từ nhận trong tiêu đề', () => {
    // "mua hàng" là từ nhận, nhưng nghề ở đây là kế toán.
    expect(verdictOf('Kế toán mua hàng cho nhà cung cấp nước ngoài')).toBe('reject');
  });

  it('từ loại trong MÔ TẢ không chặn — chỉ tiêu đề mới quyết định nghề', () => {
    // Tin thu mua nào chẳng nhắc tới kho và giao hàng trong phần mô tả.
    expect(
      verdictOf('Nhân viên thu mua', 'Phối hợp với thủ kho và bộ phận giao hàng để nhận vật tư'),
    ).toBe('strong');
  });
});

describe('mô tả chỉ là bằng chứng yếu', () => {
  it('>= 2 từ khác nhau trong mô tả -> nhận yếu, để soi tay', () => {
    const result = matchJob(field, {
      title: 'Chuyên viên hành chính tổng hợp',
      description: 'Làm việc với nhà cung cấp, theo dõi đơn mua hàng và hợp đồng',
    });
    expect(result.verdict).toBe('weak');
  });

  it('đúng 1 từ trong mô tả thì KHÔNG đủ — tin nào chẳng nhắc nhà cung cấp', () => {
    const result = matchJob(field, {
      title: 'Nhân viên hành chính',
      description: 'Liên hệ nhà cung cấp văn phòng phẩm khi cần',
    });
    expect(result.verdict).toBe('reject');
    expect(result.rejectedBy).toBe('chỉ 1 từ trong mô tả, không đủ');
  });
});

describe('từ xám không tự kéo tin vào ngành', () => {
  it('chỉ có từ xám ở tiêu đề -> loại', () => {
    expect(verdictOf('Nhân viên logistics')).toBe('reject');
    expect(verdictOf('Điều phối viên kho vận')).toBe('reject');
  });

  it('có từ nhận thật thì từ xám mới được tính, và chỉ để cộng điểm', () => {
    const plain = matchJob(field, { title: 'Nhân viên thu mua' });
    const withGray = matchJob(field, { title: 'Nhân viên thu mua kiêm logistics' });
    expect(withGray.verdict).toBe('strong');
    expect(withGray.grayHits).toContain('logistics');
    expect(withGray.score).toBeGreaterThan(plain.score);
  });
});

describe('điểm số dùng để xếp thứ tự khi soi', () => {
  it('từ nhận ở tiêu đề ăn đứt từ nhận ở mô tả', () => {
    const inTitle = matchJob(field, { title: 'Nhân viên thu mua' });
    const inDesc = matchJob(field, {
      title: 'Trợ lý ban giám đốc',
      description: 'Hỗ trợ thu mua và làm việc với nhà cung cấp',
    });
    expect(inTitle.score).toBeGreaterThan(inDesc.score);
  });
});

describe('TP.HCM hẹp — trước sáp nhập 2025', () => {
  it('tin ở Bình Dương / Vũng Tàu bị loại khi bật cờ hẹp', () => {
    expect(isNarrowHcm(['Bình Dương'])).toBe(false);
    expect(isNarrowHcm(['Bà Rịa - Vũng Tàu'])).toBe(false);
  });

  it('tin ở HCM thật thì giữ', () => {
    expect(isNarrowHcm(['TP. Hồ Chí Minh'])).toBe(true);
    expect(isNarrowHcm(['Thủ Đức'])).toBe(true);
  });

  it('tin đăng ở CẢ HCM lẫn Bình Dương vẫn là tin HCM', () => {
    expect(isNarrowHcm(['TP. Hồ Chí Minh', 'Bình Dương'])).toBe(true);
  });

  it('không có địa điểm nào thì không dám nhận là HCM', () => {
    expect(isNarrowHcm([])).toBe(false);
  });
});
