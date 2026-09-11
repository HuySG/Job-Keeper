import { removeDiacritics, normalizeWhitespace, toMatchKey } from './text';

/**
 * Ánh xạ địa danh thô -> tỉnh/thành hiện hành.
 *
 * Hai lý do bắt buộc phải có tầng này:
 *
 * 1. Nguồn trả cấp PHƯỜNG. Đo thật trên TopCV:
 *      "addressLocality": "Phường Long Biên", "addressRegion": "Hà Nội"
 *    Nhóm theo `addressLocality` là ra hàng nghìn nhóm vô nghĩa.
 *
 * 2. Sáp nhập tỉnh 2025 gộp 63 đơn vị còn 34. Tin đăng vẫn dùng tên cũ
 *    ("Bình Dương", "Bà Rịa - Vũng Tàu") lẫn tên mới trong nhiều năm nữa.
 *    Không gộp thì cùng một thị trường lao động bị xé làm đôi trên biểu đồ.
 *
 * ⚠️ Bảng này là DỮ LIỆU, không phải chân lý. Nó được nạp vào bảng Location +
 *    LocationAlias khi seed, và từ đó sửa được bằng SQL mà không cần deploy.
 *    Đối chiếu lại với danh mục đơn vị hành chính chính thức trước khi chạy
 *    thật — sai một dòng ở đây là sai lệch thống kê cả một vùng.
 */

export interface Province {
  slug: string;
  name: string;
  /** true với 6 thành phố trực thuộc trung ương. */
  isCity: boolean;
  /**
   * Tên cũ trước sáp nhập + cách viết tắt thông dụng. Đây là phần làm nên giá
   * trị của bảng: tin cũ và tin mới quy về cùng một chỗ.
   */
  aliases: readonly string[];
}

export const PROVINCES: readonly Province[] = [
  // ── 6 thành phố trực thuộc trung ương ──────────────────────────────────────
  { slug: 'ha-noi', name: 'Hà Nội', isCity: true, aliases: ['hn', 'thu do', 'hanoi'] },
  {
    slug: 'ho-chi-minh',
    name: 'TP. Hồ Chí Minh',
    isCity: true,
    aliases: [
      'tphcm', 'tp hcm', 'hcm', 'sai gon', 'saigon', 'ho chi minh city', 'sg',
      'binh duong', 'ba ria vung tau', 'ba ria - vung tau', 'vung tau', 'thu dau mot',
    ],
  },
  {
    slug: 'hai-phong',
    name: 'Hải Phòng',
    isCity: true,
    aliases: ['hp', 'haiphong', 'hai duong'],
  },
  {
    slug: 'da-nang',
    name: 'Đà Nẵng',
    isCity: true,
    aliases: ['dn', 'danang', 'quang nam', 'hoi an', 'tam ky'],
  },
  { slug: 'hue', name: 'Huế', isCity: true, aliases: ['thua thien hue', 'thua thien - hue'] },
  {
    slug: 'can-tho',
    name: 'Cần Thơ',
    isCity: true,
    aliases: ['ct', 'cantho', 'soc trang', 'hau giang'],
  },

  // ── 28 tỉnh ────────────────────────────────────────────────────────────────
  { slug: 'tuyen-quang', name: 'Tuyên Quang', isCity: false, aliases: ['ha giang'] },
  { slug: 'lao-cai', name: 'Lào Cai', isCity: false, aliases: ['yen bai', 'sa pa', 'sapa'] },
  { slug: 'thai-nguyen', name: 'Thái Nguyên', isCity: false, aliases: ['bac kan', 'bac can'] },
  { slug: 'phu-tho', name: 'Phú Thọ', isCity: false, aliases: ['vinh phuc', 'hoa binh', 'viet tri'] },
  { slug: 'bac-ninh', name: 'Bắc Ninh', isCity: false, aliases: ['bac giang', 'tu son'] },
  { slug: 'hung-yen', name: 'Hưng Yên', isCity: false, aliases: ['thai binh', 'pho hien'] },
  {
    slug: 'ninh-binh',
    name: 'Ninh Bình',
    isCity: false,
    aliases: ['ha nam', 'nam dinh', 'phu ly'],
  },
  { slug: 'quang-tri', name: 'Quảng Trị', isCity: false, aliases: ['quang binh', 'dong hoi'] },
  { slug: 'quang-ngai', name: 'Quảng Ngãi', isCity: false, aliases: ['kon tum'] },
  { slug: 'gia-lai', name: 'Gia Lai', isCity: false, aliases: ['binh dinh', 'quy nhon', 'pleiku'] },
  { slug: 'khanh-hoa', name: 'Khánh Hòa', isCity: false, aliases: ['ninh thuan', 'nha trang', 'cam ranh'] },
  {
    slug: 'lam-dong',
    name: 'Lâm Đồng',
    isCity: false,
    aliases: ['dak nong', 'dac nong', 'binh thuan', 'da lat', 'dalat', 'phan thiet'],
  },
  { slug: 'dak-lak', name: 'Đắk Lắk', isCity: false, aliases: ['dac lac', 'phu yen', 'buon ma thuot', 'tuy hoa'] },
  { slug: 'dong-nai', name: 'Đồng Nai', isCity: false, aliases: ['binh phuoc', 'bien hoa', 'long thanh'] },
  { slug: 'tay-ninh', name: 'Tây Ninh', isCity: false, aliases: ['long an', 'tan an'] },
  { slug: 'vinh-long', name: 'Vĩnh Long', isCity: false, aliases: ['ben tre', 'tra vinh'] },
  { slug: 'dong-thap', name: 'Đồng Tháp', isCity: false, aliases: ['tien giang', 'my tho', 'cao lanh'] },
  { slug: 'ca-mau', name: 'Cà Mau', isCity: false, aliases: ['bac lieu'] },
  { slug: 'an-giang', name: 'An Giang', isCity: false, aliases: ['kien giang', 'rach gia', 'phu quoc', 'long xuyen'] },
  { slug: 'cao-bang', name: 'Cao Bằng', isCity: false, aliases: [] },
  { slug: 'lang-son', name: 'Lạng Sơn', isCity: false, aliases: [] },
  { slug: 'dien-bien', name: 'Điện Biên', isCity: false, aliases: ['dien bien phu'] },
  { slug: 'lai-chau', name: 'Lai Châu', isCity: false, aliases: [] },
  { slug: 'son-la', name: 'Sơn La', isCity: false, aliases: ['moc chau'] },
  { slug: 'thanh-hoa', name: 'Thanh Hóa', isCity: false, aliases: ['sam son', 'nghi son'] },
  { slug: 'nghe-an', name: 'Nghệ An', isCity: false, aliases: ['vinh', 'cua lo'] },
  { slug: 'ha-tinh', name: 'Hà Tĩnh', isCity: false, aliases: ['vung ang'] },
  { slug: 'quang-ninh', name: 'Quảng Ninh', isCity: false, aliases: ['ha long', 'hạ long', 'cam pha', 'mong cai'] },
];

/** Tin làm từ xa không thuộc tỉnh nào — cần một chỗ riêng, không nhét vào Hà Nội. */
export const REMOTE_SLUG = 'remote';

/** Xây bảng tra một lần lúc nạp module. */
const LOOKUP: ReadonlyMap<string, Province> = (() => {
  const map = new Map<string, Province>();
  for (const province of PROVINCES) {
    map.set(toMatchKey(province.name), province);
    map.set(province.slug.replace(/-/g, ' '), province);
    for (const alias of province.aliases) map.set(toMatchKey(alias), province);
  }
  return map;
})();

/**
 * Tiền tố cấp hành chính cần bóc trước khi tra.
 * "Thành phố Hà Nội", "TP. Hồ Chí Minh", "Tỉnh Đồng Nai" đều phải về tên trần.
 */
const ADMIN_PREFIX_RE =
  /^(thanh pho|tp|tinh|quan|huyen|phuong|xa|thi xa|thi tran|khu vuc|kv)\s+/;

/**
 * Tìm tỉnh/thành từ một chuỗi địa chỉ bất kỳ.
 *
 * Thử theo thứ tự đắt dần: khớp nguyên chuỗi -> bóc tiền tố hành chính -> tìm
 * tên tỉnh nằm bất kỳ đâu trong chuỗi (cho trường hợp địa chỉ đầy đủ nhiều cấp).
 */
export function resolveProvince(input: string | null | undefined): Province | null {
  if (!input) return null;
  const key = toMatchKey(input);
  if (!key) return null;

  const direct = LOOKUP.get(key);
  if (direct) return direct;

  const stripped = key.replace(ADMIN_PREFIX_RE, '').trim();
  const afterStrip = LOOKUP.get(stripped);
  if (afterStrip) return afterStrip;

  // Địa chỉ đầy đủ: "Số 1 Trần Phú, Phường Long Biên, Hà Nội". Duyệt tên tỉnh
  // theo độ dài GIẢM DẦN để "Hà Nam" không bị "Hà" nào đó cướp mất.
  const candidates = [...LOOKUP.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [name, province] of candidates) {
    if (name.length >= 4 && key.includes(name)) return province;
  }

  return null;
}

/** Chuỗi này có nghĩa là làm từ xa không? */
export function isRemoteText(input: string | null | undefined): boolean {
  if (!input) return false;
  const text = removeDiacritics(normalizeWhitespace(input)).toLowerCase();
  return /\b(remote|tu xa|lam viec tai nha|work from home|wfh|telecommute)\b/.test(text);
}

export interface ExtractLocationsOptions {
  /**
   * Tra `streetAddress` TRƯỚC `addressRegion`/`addressLocality`.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * Chỉ bật cho nguồn đã ĐO ĐƯỢC là hai ô cấp tỉnh của nó không đáng tin.
   *
   * Đo thật 11/09/2026, ba tin liên tiếp của `vieclamnhamay.vn`:
   *
   *   streetAddress "435 Quốc lộ 13, ... TP. Hồ Chí Minh"  region/locality "Hà Nội"
   *   streetAddress "1578 Trần Văn Giàu, Bình Chánh, HCM"  region/locality "HCMC"
   *   streetAddress "331 Nguyễn Trọng Tuyển, ... TP HCM"   region/locality "Bình Dương"
   *
   * Cả ba tin đều ở TP.HCM còn cả ba ô cấp tỉnh đều nói một tỉnh khác. Đây
   * KHÔNG phải chuyện đảo region/locality như CareerViet — chỗ đó đảo thì thứ
   * tự tra vẫn cứu được. Ở đây hai ô ấy là RÁC, và chỉ `streetAddress` mới
   * mang tỉnh thật.
   *
   * Hậu quả nếu không bật: tin HCM bị gán Hà Nội/Bình Dương rồi biến mất khỏi
   * trang Ngành (đang lọc `thu-mua-hcm`), còn tin tỉnh khác thì lọt vào. Sai
   * theo cả hai chiều, và không một lỗi nào để lần ra.
   * ─────────────────────────────────────────────────────────────────────────
   */
  trustStreetFirst?: boolean;
}

/**
 * Bóc mọi địa điểm từ `jobLocation` của JSON-LD.
 *
 * `jobLocation` có thể là object, hoặc MẢNG khi công ty tuyển cho nhiều chi
 * nhánh. Lấy phần tử đầu rồi thôi là mất tin ở các tỉnh còn lại — đúng những
 * tỉnh mà dữ liệu đang thưa nhất.
 */
export function extractLocations(
  jobLocation: unknown,
  options: ExtractLocationsOptions = {},
): { raw: string; province: Province | null }[] {
  const results: { raw: string; province: Province | null }[] = [];
  const seen = new Set<string>();

  const visit = (node: unknown): void => {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node === 'string') {
      push(node);
      return;
    }
    if (typeof node !== 'object') return;

    const obj = node as Record<string, unknown>;
    const address = obj['address'];

    if (address && typeof address === 'object') {
      const addr = address as Record<string, unknown>;
      // addressRegion là cấp tỉnh -> ưu tiên. addressLocality có thể là phường.
      const region = clean(str(addr['addressRegion']));
      const locality = clean(str(addr['addressLocality']));
      const street = clean(str(addr['streetAddress']));
      const combined = [street, locality, region].filter(Boolean).join(', ');
      // Thử LẦN LƯỢT chứ không chỉ ô đầu tiên có chữ — xem chú thích ở `push`.
      const order = options.trustStreetFirst
        ? [street, combined, region, locality]
        : [region, locality, combined];
      if (combined) push(combined, order.filter(Boolean));
      return;
    }

    const name = str(obj['name']);
    if (name) push(name);
  };

  /**
   * `lookup` là DANH SÁCH ứng viên thử theo thứ tự, không phải một chuỗi.
   *
   * Vì sao phải thế: schema.org không ép nghĩa cho `addressRegion` và
   * `addressLocality`, nên mỗi sàn hiểu một kiểu. Đo thật 09/09/2026:
   *
   *   ITviec/TopDev  region="Hồ Chí Minh"  locality="Phường Tân Tạo"  (tỉnh ở region)
   *   CareerViet     region="Quận 5"       locality="Hồ Chí Minh"     (tỉnh ở locality)
   *
   * Chỉ tra `region` thì MỌI tin CareerViet ra `province = null`, rơi khỏi bộ
   * lọc theo tỉnh và biến mất khỏi trang Ngành — im lặng, không một lỗi nào để
   * lần ra. Thử lần lượt thì sàn đặt tỉnh ở ô nào cũng tìm được, mà nguồn
   * "thuận" vẫn khớp ngay ở ứng viên đầu nên kết quả cũ không đổi.
   */
  const push = (raw: string, lookup?: readonly string[]): void => {
    const clean = normalizeWhitespace(raw);
    if (!clean || seen.has(clean)) return;
    seen.add(clean);

    let province: Province | null = null;
    for (const candidate of lookup ?? [clean]) {
      if (!candidate) continue;
      province = resolveProvince(candidate);
      if (province) break;
    }

    results.push({ raw: clean, province });
  };

  visit(jobLocation);
  return results;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

/**
 * Giá trị rác mà nguồn nhét vào chỗ đáng lẽ để trống.
 *
 * Gặp thật ở ITviec: `"addressLocality": "Not Available"`. Để nguyên thì chuỗi
 * địa chỉ hiển thị ra có chữ "Not Available" ở giữa, và tệ hơn là nếu
 * addressRegion trống thì nó bị đem đi tra cứu tỉnh.
 */
const JUNK_VALUES = new Set([
  'not available',
  'n/a',
  'na',
  'null',
  'undefined',
  'khong xac dinh',
  'chua cap nhat',
  '-',
]);

function clean(value: string): string {
  const trimmed = value.trim();
  return JUNK_VALUES.has(removeDiacritics(trimmed).toLowerCase()) ? '' : trimmed;
}
