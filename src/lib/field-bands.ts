/**
 * Khoảng lọc dùng chung cho trang "Ngành của tôi".
 *
 * Ở đây chứ không nằm trong `api/field.api.ts` vì file đó khai `server-only`:
 * mấy bảng dưới đây chỉ là HẰNG SỐ và cần cho cả tầng đọc dữ liệu lẫn tầng
 * giao diện. Component phải tra được nhãn của một giá trị đang lọc ngay cả khi
 * facet đếm ra 0 tin — không tách ra thì tra nhãn đồng nghĩa với kéo cả tầng
 * máy chủ vào chỗ chỉ cần một chuỗi.
 */

/**
 * Giá trị đại diện cho "tin KHÔNG ghi chiều này".
 *
 * Đây là hòn đá tảng của việc **tránh lọc sót**. Bản trước xử lý tin thiếu dữ
 * liệu bằng luật ngầm nằm trong code: lọc kinh nghiệm thì âm thầm GIỮ tin
 * không ghi, lọc lương thì âm thầm GIỮ tin "thoả thuận". Cả hai đều là lựa
 * chọn đúng, nhưng người dùng không nhìn thấy nên không kiểm soát được — chọn
 * "1–2 năm" mà danh sách vẫn đầy tin không ghi năm nào thì trông như lọc hỏng.
 *
 * Nay mỗi chiều có thêm một ô "Tin không ghi" đếm được và bấm được. Luật ngầm
 * thành một lựa chọn hiện trên màn hình: muốn giữ thì tích, muốn bỏ thì thôi.
 *
 * Dùng tiền tố `__` để không bao giờ đụng một giá trị thật — tên quận, mã
 * SaturdayWork và slug loại mua hàng đều không có dạng đó.
 */
export const FACET_NONE = '__none';

export const EXPERIENCE_BANDS: readonly {
  value: string;
  label: string;
  hint: string;
  test: (years: number | null) => boolean;
}[] = [
  {
    value: '0',
    label: 'Không đòi kinh nghiệm',
    hint: 'Tin nói rõ không cần kinh nghiệm — hợp với người mới ra trường',
    test: (y) => y !== null && y < 1,
  },
  { value: '1-2', label: '1–2 năm', hint: 'Đòi tối thiểu 1 đến 2 năm', test: (y) => y !== null && y >= 1 && y <= 2 },
  { value: '3-5', label: '3–5 năm', hint: 'Đòi tối thiểu 3 đến 5 năm', test: (y) => y !== null && y >= 3 && y <= 5 },
  { value: '5+', label: 'Trên 5 năm', hint: 'Đòi tối thiểu hơn 5 năm — thường là cấp quản lý', test: (y) => y !== null && y > 5 },
  {
    value: FACET_NONE,
    label: 'Tin không ghi',
    hint: 'Nhà tuyển dụng không nói số năm. KHÔNG có nghĩa là không cần kinh nghiệm.',
    test: (y) => y === null,
  },
];

/**
 * Khoảng lương, VND/tháng.
 *
 * Mốc chọn theo cách tin tuyển dụng Việt Nam hay ghi, không phải chia đều.
 * Ô "Thoả thuận" tách riêng vì cùng lý do với `FACET_NONE` ở kinh nghiệm: bản
 * trước lọc "từ 25 triệu" vẫn âm thầm giữ toàn bộ tin thoả thuận (khoảng 2/3
 * kho), nên danh sách trả về phần lớn là tin không hề biết lương bao nhiêu.
 * Giữ chúng là đúng, nhưng phải là một ô người dùng tự tích.
 */
export const SALARY_BANDS: readonly {
  value: string;
  label: string;
  hint: string;
  test: (best: number | null) => boolean;
}[] = [
  { value: '0-15', label: 'Dưới 15 triệu', hint: 'Tin có ghi số, dưới 15 triệu/tháng', test: (v) => v !== null && v < 15_000_000 },
  { value: '15-25', label: '15 – 25 triệu', hint: '', test: (v) => v !== null && v >= 15_000_000 && v < 25_000_000 },
  { value: '25-40', label: '25 – 40 triệu', hint: '', test: (v) => v !== null && v >= 25_000_000 && v < 40_000_000 },
  { value: '40+', label: 'Trên 40 triệu', hint: '', test: (v) => v !== null && v >= 40_000_000 },
  {
    value: FACET_NONE,
    label: 'Thoả thuận',
    hint: 'Tin không ghi số. Chiếm phần lớn thị trường — bỏ ô này là bỏ phần lớn cơ hội.',
    test: (v) => v === null,
  },
];

/**
 * Con số đại diện cho mức lương một tin.
 *
 * Lấy mức CAO NHẤT tin đưa ra: "10–20 triệu" xếp cùng chỗ với "tới 20 triệu",
 * vì đó là con số người đọc dùng để quyết định có nộp hay không. Trả `null`
 * khi tin không công khai lương — và `null` phải đi tới ô "Thoả thuận", không
 * được lặng lẽ thành 0 rồi rơi vào ô "dưới 15 triệu".
 */
export function salaryValue(job: { salaryIsPublic: boolean; salaryMin: number | null; salaryMax: number | null }): number | null {
  if (!job.salaryIsPublic) return null;
  const best = Math.max(job.salaryMin ?? 0, job.salaryMax ?? 0);
  return best > 0 ? best : null;
}

export function experienceBandOf(years: number | null): string {
  return EXPERIENCE_BANDS.find((band) => band.test(years))?.value ?? FACET_NONE;
}

export function salaryBandOf(job: Parameters<typeof salaryValue>[0]): string {
  const value = salaryValue(job);
  return SALARY_BANDS.find((band) => band.test(value))?.value ?? FACET_NONE;
}


/**
 * Bỏ những giá trị KHÔNG có trong bảng — nói cách khác, bỏ qua lọc rác.
 *
 * Vì sao cần: URL là giao diện công khai của trang này, và nó tồn tại lâu hơn
 * mã nguồn. Bản trước cắt kinh nghiệm theo ngưỡng cộng dồn (`?kn=3` nghĩa là
 * "tối đa 3 năm"); bản này cắt theo khoảng rời (`?kn=3-5`). Một liên kết đã
 * lưu từ bản trước vẫn mang `?kn=3`, mà `3` không khớp khoảng nào — nên nếu cứ
 * lọc thẳng thì nó loại sạch mọi tin và trang trả về rỗng, không một lời giải
 * thích. Đó đúng là kiểu "lọc sót" khó lần ra nhất, vì lỗi nằm trong URL chứ
 * không nằm trên màn hình.
 *
 * Bỏ qua giá trị lạ thì liên kết cũ thoái hoá êm: mất đúng chiều lọc đó, giữ
 * nguyên phần còn lại, và trang vẫn ra tin.
 *
 * CỐ Ý chỉ dùng cho chiều có từ vựng CỐ ĐỊNH (khoảng lương, khoảng kinh
 * nghiệm, lịch thứ 7, loại mua hàng). Quận là dữ liệu tự do nên không có bảng
 * nào để đối chiếu — ở đó `relaxHints` là lưới an toàn.
 */
export function onlyKnown(
  values: readonly string[],
  allowed: readonly string[],
): string[] {
  const known = new Set(allowed);
  return values.filter((value) => known.has(value));
}

export const EXPERIENCE_VALUES: readonly string[] = EXPERIENCE_BANDS.map((b) => b.value);
export const SALARY_VALUES: readonly string[] = SALARY_BANDS.map((b) => b.value);
