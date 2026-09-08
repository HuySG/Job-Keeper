import { normalizeWhitespace, removeDiacritics } from './text';

/**
 * Bóc QUẬN / KHU CÔNG NGHIỆP từ chuỗi địa chỉ tự do.
 *
 * Bảng `Location` chỉ tới cấp tỉnh, và với TP.HCM thì "Hồ Chí Minh" là một câu
 * trả lời gần như vô dụng cho người đi làm: từ Củ Chi xuống Quận 7 là hơn 40 km.
 * Quận mới là thứ quyết định có đi làm nổi hay không.
 *
 * Nguồn dữ liệu là chuỗi địa chỉ thật, và chúng lộn xộn đúng như đời thật:
 *
 *   "Lô 12 Đường Trung Tâm, KCN Tân Tạo, Phường Tân Tạo, TPHCM, Hồ Chí Minh"
 *   "Dat Bike Factory, Lot II-1, ... Tan Binh Industrial Park, Tay Thanh Ward, ..."
 *   "Tòa Ree – 9 Đoàn Văn Bơ, Phường Xóm Chiếu, HCM, Hồ Chí Minh"
 *
 * ⚠️ Hai giới hạn phải nói rõ:
 *
 * 1. **Độ phủ ~40%.** Rất nhiều tin chỉ ghi "Hồ Chí Minh" và không có gì hơn.
 *    `null` nghĩa là *tin không nói*, không phải "không có quận".
 *
 * 2. **CỐ Ý bỏ qua tên phường.** Sáp nhập 2025 chia TP.HCM thành 168 phường,
 *    nên bóc theo phường sẽ đẻ ra một danh sách 168 giá trị mà mỗi giá trị vài
 *    tin — đúng cái bẫy "nhóm theo addressLocality" đã ghi ở location.ts. Quận
 *    (tên cũ, vẫn dùng phổ biến trong tin) mới là mức gộp có ích.
 */

/** Quận/huyện TP.HCM trước 2025 + các khu đã sáp nhập vào. Khoá là bản KHÔNG DẤU. */
const AREAS: readonly [key: string, canonical: string][] = [
  // ── Nội thành ───────────────────────────────────────────────────────────────
  ['binh thanh', 'Bình Thạnh'],
  ['tan binh', 'Tân Bình'],
  ['tan phu', 'Tân Phú'],
  ['phu nhuan', 'Phú Nhuận'],
  ['go vap', 'Gò Vấp'],
  ['binh tan', 'Bình Tân'],
  // Quận 2 và Quận 9 đã nhập vào Thủ Đức từ 2021 — tin cũ vẫn viết tên cũ.
  ['thu duc', 'Thủ Đức'],
  // ── Ngoại thành ─────────────────────────────────────────────────────────────
  ['binh chanh', 'Bình Chánh'],
  ['hoc mon', 'Hóc Môn'],
  ['cu chi', 'Củ Chi'],
  ['nha be', 'Nhà Bè'],
  ['can gio', 'Cần Giờ'],
  // ── Vùng sáp nhập 2025: Bình Dương và Bà Rịa – Vũng Tàu ─────────────────────
  // Giữ riêng từng nơi thay vì gộp thành "Bình Dương": người đi làm cần biết
  // Dĩ An hay Bến Cát, vì hai chỗ đó cách nhau 50 km.
  ['thu dau mot', 'Thủ Dầu Một'],
  ['di an', 'Dĩ An'],
  ['thuan an', 'Thuận An'],
  ['ben cat', 'Bến Cát'],
  ['tan uyen', 'Tân Uyên'],
  ['vung tau', 'Vũng Tàu'],
  ['ba ria', 'Bà Rịa'],
  ['phu my', 'Phú Mỹ'],
];

/** "Quận 7", "Q.7", "Q7", "District 7" — và KHÔNG khớp "Quận 7X" hay số nhà. */
const NUMBERED_RE = /\b(?:qu[aậ]n|q\.?|district)\s*(\d{1,2})\b/i;

/** "KCN Tân Tạo", "Khu công nghiệp Sóng Thần", "Tan Binh Industrial Park", "KCX Tân Thuận". */
const ZONE_RE =
  /\b(?:kcn|kcx|khu c[ôo]ng nghi[ệe]p|khu ch[ếe] xu[ấa]t)\s+([a-zà-ỹ0-9\s]{2,24}?)(?=\s*[,.;]|$)|\b([a-zà-ỹ0-9\s]{2,24}?)\s+industrial\s+park\b/i;

/** 12 quận đánh số còn tồn tại của TP.HCM. Q2 và Q9 đã nhập Thủ Đức. */
const VALID_NUMBERED = new Set([1, 3, 4, 5, 6, 7, 8, 10, 11, 12]);

/**
 * Trả về tên quận/khu đã chuẩn hoá, hoặc `null` khi địa chỉ không nói.
 *
 * Nhận vào NHIỀU chuỗi vì một tin có thể có nhiều địa điểm; lấy chuỗi đầu tiên
 * bóc được. Thứ tự ưu tiên: quận có tên > quận đánh số > khu công nghiệp —
 * tên quận cụ thể hơn và ít khớp nhầm hơn.
 */
export function extractDistrict(rawTexts: readonly string[]): string | null {
  for (const raw of rawTexts) {
    const found = readOne(raw);
    if (found) return found;
  }
  return null;
}

function readOne(raw: string): string | null {
  if (!raw) return null;
  const plain = removeDiacritics(normalizeWhitespace(raw)).toLowerCase();

  // Lấy tên xuất hiện SỚM NHẤT trong chuỗi, không phải tên đứng đầu bảng.
  //
  // Địa chỉ Việt Nam đi từ hẹp tới rộng: "Phú Mỹ, tỉnh Bà Rịa – Vũng Tàu (cũ)".
  // Duyệt theo thứ tự bảng thì "Vũng Tàu" thắng vì nó nằm trước trong mảng —
  // và ta trả về TÊN TỈNH thay vì NƠI LÀM VIỆC. Một test đỏ đã bắt đúng ca này.
  let best: { at: number; name: string } | null = null;
  for (const [key, canonical] of AREAS) {
    // Ranh giới hai đầu: "di an" không được khớp vào "di an toan" hay "Dĩ Andrew".
    const at = plain.search(new RegExp(String.raw`\b${key}\b`));
    if (at !== -1 && (best === null || at < best.at)) best = { at, name: canonical };
  }
  if (best) return best.name;

  const numbered = NUMBERED_RE.exec(raw);
  if (numbered?.[1]) {
    const n = Number(numbered[1]);
    // Chặn "Quận 15" hay "Q.99" — không tồn tại, gần như chắc chắn là đọc nhầm
    // số nhà hoặc số lô. Thà bỏ sót còn hơn đẻ ra một quận không có thật.
    if (VALID_NUMBERED.has(n)) return `Quận ${n}`;
  }

  const zone = ZONE_RE.exec(raw);
  const zoneName = zone?.[1] ?? zone?.[2];
  if (zoneName) {
    const name = normalizeWhitespace(zoneName)
      .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
    if (name.length >= 2) return `KCN ${name}`;
  }

  return null;
}
