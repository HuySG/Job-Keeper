import { describe, expect, it } from 'vitest';

import { WorkMode } from '@/enums';
import { locationSlugsFor } from '@/crawler/pipeline';
import { REMOTE_SLUG, resolveProvince } from '@/crawler/normalize/location';

/**
 * Tin làm từ xa không thuộc tỉnh nào phải được nối vào `remote` — nếu không,
 * nó rơi khỏi bộ lọc theo tỉnh và biến mất khỏi trang Ngành mà không lỗi nào
 * báo. Đo 28/09/2026 trước khi sửa: 0 `JobLocation` mang slug `remote` trên cả
 * hai CSDL, dù ngành phần mềm vẫn khai `remote` trong `provinces`.
 */

const hcm = { raw: 'Hồ Chí Minh', province: resolveProvince('Hồ Chí Minh') };
const anywhere = { raw: 'Anywhere', province: null };

describe('locationSlugsFor', () => {
  it('tin remote không tra ra tỉnh → nối vào "remote"', () => {
    // Đúng hình dạng tin của RemoteOK / NODESK / Working Nomads.
    expect(locationSlugsFor({ locations: [anywhere], workMode: WorkMode.REMOTE })).toEqual([
      REMOTE_SLUG,
    ]);
    expect(locationSlugsFor({ locations: [], workMode: WorkMode.REMOTE })).toEqual([REMOTE_SLUG]);
  });

  it('tin remote CÓ tỉnh thì giữ tỉnh, không gắn thêm nhãn remote', () => {
    // Cố ý hẹp: "Remote — TP.HCM" vẫn là một tin ở TP.HCM. Gắn thêm `remote`
    // sẽ làm đổi số đếm của những ngành có cả hai tỉnh trong bộ lọc.
    expect(locationSlugsFor({ locations: [hcm], workMode: WorkMode.REMOTE })).toEqual([
      'ho-chi-minh',
    ]);
  });

  it('tin KHÔNG remote mà không tra ra tỉnh thì vẫn không có tỉnh nào', () => {
    // Không được đoán: tin thiếu nơi làm là tin thiếu dữ liệu, không phải tin
    // làm từ xa.
    expect(locationSlugsFor({ locations: [anywhere], workMode: WorkMode.ONSITE })).toEqual([]);
    expect(locationSlugsFor({ locations: [], workMode: null })).toEqual([]);
  });

  it('nhiều tỉnh thì giữ đủ, không trùng', () => {
    expect(
      locationSlugsFor({
        locations: [hcm, { raw: 'TP. Hồ Chí Minh', province: resolveProvince('TP. Hồ Chí Minh') }],
        workMode: WorkMode.ONSITE,
      }),
    ).toEqual(['ho-chi-minh']);
  });
});
