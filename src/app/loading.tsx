/**
 * Khung chờ.
 *
 * Cố ý dựng đúng hình dạng của bảng điều khiển — một khối lớn rồi tới một dãy
 * ô nhỏ — chứ không phải một vòng xoay giữa màn hình. Giữ nguyên bố cục thì
 * lúc dữ liệu về, trang không nhảy; còn vòng xoay thì mọi thứ nhảy một cái.
 */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy aria-label="Đang tải dữ liệu">
      <div className="h-8 w-56 rounded-lg bg-inset" />
      <div className="h-32 rounded-card border border-border bg-surface" />
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-20 rounded-card border border-border bg-surface" />
        ))}
      </div>
      <div className="h-56 rounded-card border border-border bg-surface" />
    </div>
  );
}
