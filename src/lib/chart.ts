/**
 * Phần TÍNH TOÁN của biểu đồ — không có JSX, không đụng React.
 *
 * Tách ra vì hình học của biểu đồ là thứ dễ sai âm thầm nhất: một cột cao 103%
 * chiều cao khung, một trục có mốc 0/33/66/99, một phép chia cho 0 khi kho
 * chưa có tin nào. Ở đây thì kiểm được bằng test thường, còn nằm rải trong
 * component thì chỉ phát hiện bằng mắt.
 *
 * Mọi biểu đồ trong dự án đều là SVG/CSS tự vẽ, KHÔNG có thư viện. Lý do:
 * toàn bộ trang là server component, thêm một thư viện biểu đồ là kéo theo
 * hàng trăm KB JavaScript phía trình duyệt cho vài chục hình chữ nhật — và
 * đánh mất chỗ đứng "trang chạy khi JavaScript chưa tải xong".
 */

/**
 * Mốc trục "đẹp": chỉ dừng ở 1/2/2,5/5/10 nhân luỹ thừa 10.
 *
 * Trục chạy 0–250–500 đọc được ngay; trục 0–247–494 thì phải đọc từng con số.
 */
export function niceStep(rough: number): number {
  if (rough <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Trần trục và các mốc chia.
 *
 * Luôn trả về trần **lớn hơn hoặc bằng** giá trị lớn nhất, nếu không thì cột
 * cao nhất tràn ra ngoài khung. Kho rỗng (max = 0) vẫn phải ra một trục hợp lệ
 * chứ không phải NaN.
 */
export function axisScale(max: number, tickCount = 4): { max: number; ticks: number[] } {
  if (!Number.isFinite(max) || max <= 0) return { max: 1, ticks: [0, 1] };

  const step = niceStep(max / tickCount);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top + step / 2; value += step) ticks.push(Number(value.toFixed(6)));
  return { max: top, ticks };
}

/** Tỷ lệ 0–1 đã chặn hai đầu. Chia cho 0 trả 0 chứ không trả NaN rồi vẽ ra hư vô. */
export function ratio(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(1, Math.max(0, value / max));
}

/** Tỷ lệ thành phần trăm để đặt vào `style.width` / `style.height`. */
export function percent(value: number, max: number): string {
  return `${(ratio(value, max) * 100).toFixed(2)}%`;
}

/**
 * Vị trí một khoảng [min, max] trong một thang [floor, ceil] — dùng cho thanh
 * p25–trung vị–p75. Trả về phần trăm để đặt `left` và `width`.
 */
export function bandPosition(
  from: number,
  to: number,
  floor: number,
  ceil: number,
): { left: string; width: string } {
  const span = ceil - floor;
  if (span <= 0) return { left: '0%', width: '100%' };
  const start = Math.min(1, Math.max(0, (from - floor) / span));
  const end = Math.min(1, Math.max(0, (to - floor) / span));
  return {
    left: `${(start * 100).toFixed(2)}%`,
    // Sàn 1,5% để một khoảng lương hẹp (15–15,5tr) vẫn còn nhìn thấy được
    width: `${Math.max(1.5, (end - start) * 100).toFixed(2)}%`,
  };
}
