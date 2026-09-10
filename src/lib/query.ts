/**
 * Đọc và dựng lại query string — lõi dùng chung cho MỌI liên kết có bộ lọc.
 *
 * Vì sao gom lại một chỗ: bản trước có hai bản sao gần giống nhau, `urlWith()`
 * trong `app/page.tsx` và `urlWithout()` trong `components/active-filters.tsx`.
 * Chúng lệch nhau ở một điểm chết người — bản sau tự động xoá `page`, bản
 * trước thì không — nên bấm gỡ một chip thì về trang 1, còn đổi kiểu sắp xếp
 * thì giữ nguyên trang 7 rồi hiện ra một danh sách rỗng.
 *
 * Ở đây chỉ có MỘT quy tắc, viết ra thành lời: **đổi bất cứ thứ gì trừ `page`
 * thì luôn về trang 1**, vì tập kết quả đã khác thì số trang cũ vô nghĩa.
 *
 * Toàn bộ trạng thái của giao diện nằm trong URL chứ không nằm trong React
 * state: mỗi màn hình đều dán được, đánh dấu trang được, mở lại đúng chỗ cũ,
 * và chạy cả khi JavaScript chưa tải xong.
 */

/** Đúng hình dạng `searchParams` mà Next.js đưa vào page component. */
export type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Một tham số có thể tới hai lần (`?level=A&level=B`). Hàm này CỐ Ý chỉ lấy
 * giá trị đầu — dùng cho những chiều chỉ có một giá trị (trang, lương tối
 * thiểu, cờ bật/tắt). Chiều chọn được nhiều thì dùng `readParams`.
 */
export function readParam(params: SearchParams, key: string): string | undefined {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === '' ? undefined : value;
}

/**
 * MỌI giá trị của một tham số, cho bộ lọc chọn được nhiều.
 *
 * `?loai=san-xuat&loai=det-may` -> `['san-xuat', 'det-may']`. Đây là dạng mà
 * một `<form method="get">` với nhiều `<input type="checkbox">` cùng `name`
 * sinh ra, nên bộ lọc nhiều lựa chọn không cần một dòng JavaScript nào.
 *
 * Trả mảng RỖNG khi không có, không phải `undefined`: chỗ gọi luôn lặp được mà
 * không phải kiểm tra null, và "không lọc" với "lọc bằng danh sách rỗng" là
 * cùng một thứ.
 */
export function readParams(params: SearchParams, key: string): string[] {
  const raw = params[key];
  if (raw === undefined) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter((value): value is string => typeof value === 'string' && value !== '');
}

/** Số hợp lệ hoặc `undefined`. `?page=abc` phải rơi về mặc định, không phải NaN. */
export function readNumber(params: SearchParams, key: string): number | undefined {
  const raw = readParam(params, key);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/** Quy ước cờ bật/tắt trong URL là `=1`, ngắn và đọc được bằng mắt. */
export function readFlag(params: SearchParams, key: string): boolean {
  return readParam(params, key) === '1';
}

/**
 * `undefined` trong `overrides` nghĩa là XOÁ tham số đó.
 * Mảng nghĩa là ghi NHIỀU giá trị cho cùng một tên; mảng rỗng cũng là xoá.
 */
export type Overrides = Record<string, string | number | readonly string[] | undefined>;

/**
 * Dựng URL mới từ URL hiện tại.
 *
 * `page` được xử lý riêng: chỉ giữ khi lần ghi đè này nói rõ về nó. Nhờ vậy
 * mọi nơi gọi hàm — đổi sắp xếp, gỡ chip, đổi khoảng thời gian — đều tự động
 * đúng mà không phải ai cũng nhớ tự xoá `page`.
 */
export function buildUrl(pathname: string, params: SearchParams, overrides: Overrides = {}): string {
  const query = new URLSearchParams();
  const changesPage = 'page' in overrides;

  for (const key of Object.keys(params)) {
    if (key in overrides) continue;
    if (key === 'page' && !changesPage) continue;
    // `append` từng giá trị, KHÔNG phải `set` giá trị đầu: bộ lọc chọn nhiều
    // gửi lên `?loai=a&loai=b`, mà bản cũ dùng `readParam` nên mỗi lần dựng
    // lại URL — bấm sang trang 2, gỡ một chip khác — là lặng lẽ vứt mất mọi
    // giá trị trừ cái đầu tiên. Người dùng chọn ba loại, sang trang 2 còn một.
    for (const value of readParams(params, key)) query.append(key, value);
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === '') continue;

    if (Array.isArray(value)) {
      for (const item of value) if (item !== '') query.append(key, item);
      continue;
    }

    const text = String(value);
    // Trang 1 là mặc định — để `?page=1` trong URL chỉ làm liên kết dài ra.
    if (key === 'page' && text === '1') continue;
    query.set(key, text);
  }

  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}

/** URL hiện tại nhưng bỏ đúng một tham số (mọi giá trị của nó). */
export function urlWithout(pathname: string, params: SearchParams, key: string): string {
  return buildUrl(pathname, params, { [key]: undefined });
}

/**
 * Bỏ ĐÚNG MỘT GIÁ TRỊ khỏi một bộ lọc chọn nhiều, giữ nguyên các giá trị còn lại.
 *
 * Đây là thứ nút × trên chip cần khi một chiều mang nhiều giá trị: đang lọc
 * "Sản xuất, Dệt may" mà bấm × trên "Dệt may" thì phải còn lại "Sản xuất", chứ
 * không phải mất cả hai. `urlWithout` xoá cả tham số nên chỉ đúng cho chiều
 * đơn giá trị.
 */
export function urlWithoutValue(
  pathname: string,
  params: SearchParams,
  key: string,
  value: string,
): string {
  const rest = readParams(params, key).filter((item) => item !== value);
  return buildUrl(pathname, params, { [key]: rest.length ? rest : undefined });
}

/**
 * Bật/tắt một giá trị trong bộ lọc chọn nhiều.
 *
 * Dùng cho những chỗ vừa HIỂN THỊ số vừa là chỗ BẤM để lọc — như bảng chia
 * loại. Bấm vào dòng chưa chọn thì thêm; bấm lại đúng dòng đang chọn thì bỏ,
 * nếu không thì dòng đang sáng trở thành một liên kết không làm gì cả.
 */
export function urlToggleValue(
  pathname: string,
  params: SearchParams,
  key: string,
  value: string,
): string {
  const current = readParams(params, key);
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
  return buildUrl(pathname, params, { [key]: next.length ? next : undefined });
}

/**
 * Có tham số nào ĐANG THU HẸP kết quả không.
 *
 * `sort` và `page` không thu hẹp gì cả — chúng chỉ sắp xếp lại và cắt lát. Gộp
 * chúng vào là câu "khớp bộ lọc" hiện lên ngay cả khi người dùng chưa lọc gì.
 */
const NOT_A_FILTER = new Set(['sort', 'page', 'range']);

export function hasActiveFilter(params: SearchParams): boolean {
  return Object.keys(params).some((key) => !NOT_A_FILTER.has(key) && readParam(params, key));
}

export function isFilterKey(key: string): boolean {
  return !NOT_A_FILTER.has(key);
}
