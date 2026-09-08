/**
 * Chia nghề mua hàng thành các LOẠI.
 *
 * "Nhân viên thu mua" ở nhà máy dệt may và "nhân viên thu mua" ở công ty xây
 * dựng là hai nghề khác nhau: khác thứ phải mua, khác cách làm việc với nhà
 * cung cấp, khác kinh nghiệm mà nhà tuyển dụng đòi. Gộp chung là bắt người
 * đọc tự lọc bằng mắt qua vài trăm tin.
 *
 * ## Vì sao dựa vào NGÀNH do nguồn khai, không đoán từ mô tả
 *
 * Đo 08/09/2026: đếm từ khoá trên mô tả cho ra "43% tin thuộc ngành dược" —
 * hoàn toàn giả, vì sau khi bỏ dấu thì "dược" trùng "được", mà "được" thì tin
 * nào chẳng có. Trong khi `industry` do nguồn khai có ở **258/258** tin.
 *
 * Nên: ngành trước, từ khoá chỉ là đường lùi khi ngành không nói gì.
 *
 * ## Bảng này là DỮ LIỆU
 *
 * Sửa cách gộp không cần migrate, không cần cào lại — chỉ sửa file này. Cột
 * `JobPosting.industry` lưu NGUYÊN VĂN nguồn khai, đúng để sau này gộp lại
 * kiểu khác mà không mất gì.
 */

export interface PurchaseType {
  slug: string;
  label: string;
  /** Mô tả ngắn, hiện khi rê chuột — nói loại này mua CÁI GÌ. */
  hint: string;
  /**
   * Khớp theo TOKEN của `JobPosting.industry` (đã tách bằng dấu phẩy), so khớp
   * kiểu chứa và bỏ dấu. Đây là tín hiệu chính.
   */
  industryKeys: readonly string[];
  /** Đường lùi: khớp trên tiêu đề + mô tả khi ngành không nói gì. */
  keywords: readonly string[];
}

/**
 * Token ngành cần BỎ QUA trước khi phân loại.
 *
 * vieclam24h nhét danh mục NGHỀ vào cùng chỗ với ngành công ty, nối bằng dấu
 * phẩy: `"Xây dựng,Thu mua - Kho Vận - Chuỗi cung ứng"`. Token thứ hai chỉ nói
 * "đây là tin thu mua" — thứ ta đã biết — nhưng nó chứa chữ "Chuỗi cung ứng"
 * nên sẽ cướp mất mọi tin về loại logistics nếu không loại ra trước.
 */
const NOISE_TOKENS: readonly string[] = [
  'thu mua kho van chuoi cung ung',
  'lao dong pho thong',
  'nghe nghiep khac',
  'khac',
];

/**
 * XÉT THEO THỨ TỰ NÀY. Ngành hẹp phải đứng trước ngành rộng, vì một tin có thể
 * mang nhiều token và token đầu tiên khớp sẽ thắng.
 */
export const PURCHASE_TYPES: readonly PurchaseType[] = [
  {
    slug: 'det-may',
    label: 'Dệt may & da giày',
    hint: 'Mua vải, phụ liệu, theo dõi đơn hàng gia công — nghề merchandiser',
    industryKeys: ['dệt may', 'may mặc', 'giày dép', 'thời trang', 'trang sức', 'da giày'],
    keywords: ['merchandiser', 'garment', 'footwear', 'vải', 'phụ liệu may', 'dệt may'],
  },
  {
    slug: 'y-te-duoc',
    label: 'Y tế & dược',
    hint: 'Mua thuốc, vật tư y tế, thiết bị — thường phải hiểu quy định đăng ký',
    industryKeys: ['y tế', 'dược phẩm', 'thiết bị y tế', 'chăm sóc sức khỏe', 'bệnh viện'],
    keywords: ['dược phẩm', 'vật tư y tế', 'thiết bị y tế', 'pharmaceutical', 'medical device'],
  },
  {
    slug: 'xay-dung',
    label: 'Xây dựng & dự án',
    hint: 'Mua vật liệu, thiết bị công trình, đấu thầu gói thầu theo dự án',
    industryKeys: [
      'xây dựng',
      'vật liệu xây dựng',
      'cơ sở hạ tầng',
      'kiến trúc',
      'thiết kế nội thất',
      'bất động sản',
    ],
    keywords: ['công trình', 'dự toán', 'gói thầu', 'vật liệu xây dựng', 'qs'],
  },
  {
    slug: 'thuc-pham',
    label: 'Thực phẩm, F&B & nông nghiệp',
    hint: 'Mua nguyên liệu tươi sống, bao bì thực phẩm — nhạy về hạn dùng và mùa vụ',
    industryKeys: [
      'nhà hàng',
      'khách sạn',
      'lưu trú',
      'du lịch',
      'nông nghiệp',
      'lâm nghiệp',
      'thủy sản',
      'thực phẩm',
    ],
    keywords: ['thực phẩm', 'nguyên liệu tươi', 'f&b', 'nhà hàng', 'bếp'],
  },
  {
    slug: 'san-xuat',
    label: 'Sản xuất & nhà máy',
    hint: 'Mua nguyên vật liệu, linh kiện, máy móc cho dây chuyền — gắn với kế hoạch sản xuất',
    industryKeys: [
      'sản xuất',
      'cơ khí',
      'máy móc',
      'thiết bị công nghiệp',
      'điện tử',
      'điện/điện tử',
      'hoá chất',
      'hóa chất',
      'nhựa',
      'cao su',
      'ô tô',
      'tự động hoá',
      'tự động hóa',
      'bao bì',
      'in ấn',
      'lắp ráp',
      'chế biến',
      'nội thất',
      'gỗ',
      'khai khoáng',
      'dầu khí',
      'khí đốt',
    ],
    keywords: ['nguyên vật liệu', 'nvl', 'linh kiện', 'nhà máy', 'dây chuyền', 'mrp', 'bom'],
  },
  {
    slug: 'thuong-mai',
    label: 'Thương mại & bán lẻ',
    hint: 'Mua hàng để bán lại — chọn nguồn hàng, đàm phán giá, theo mùa bán',
    industryKeys: [
      'bán lẻ',
      'bán sỉ',
      'hàng tiêu dùng',
      'thương mại điện tử',
      'nhập khẩu',
      'xuất khẩu',
      'phân phối',
    ],
    keywords: ['bán lẻ', 'phân phối', 'nguồn hàng', 'fmcg', 'nhập khẩu', 'trading'],
  },
  {
    slug: 'logistics',
    label: 'Hậu cần & chuỗi cung ứng',
    hint: 'Mua dịch vụ vận tải, kho bãi — hoặc làm mua hàng bên trong công ty logistics',
    // 'chuỗi cung ứng' ĐƯỢC PHÉP nằm đây, nhưng chỉ vì token rác
    // "Thu mua - Kho Vận - Chuỗi cung ứng" của vieclam24h đã bị loại NGUYÊN
    // TOKEN trước khi so khớp. Bỏ bước loại đó đi thì dòng này sẽ nuốt mọi tin
    // thu mua của nguồn ấy vào "hậu cần".
    industryKeys: ['hậu cần', 'giao nhận', 'vận tải', 'kho bãi', 'logistics', 'chuỗi cung ứng'],
    keywords: ['forwarding', 'cước vận chuyển', '3pl', 'kho vận'],
  },
  {
    slug: 'dich-vu',
    label: 'Dịch vụ, CNTT & tài chính',
    hint: 'Mua hàng gián tiếp: thiết bị văn phòng, phần mềm, dịch vụ thuê ngoài',
    industryKeys: [
      'information technology',
      'phần mềm',
      'cntt',
      'viễn thông',
      'ngân hàng',
      'tài chính',
      'giáo dục',
      'đào tạo',
      'truyền thông',
      'quảng cáo',
      'báo chí',
      'cung cấp nhân lực',
      'kế toán',
      'kiểm toán',
      'bảo hiểm',
    ],
    keywords: ['mua sắm gián tiếp', 'indirect', 'văn phòng phẩm', 'thuê ngoài', 'gnfr'],
  },
];

/** Loại cho tin không xếp được vào đâu. Không phải một loại thật — là chỗ chứa. */
export const PURCHASE_TYPE_UNKNOWN = {
  slug: 'chua-ro',
  label: 'Chưa phân loại',
  hint: 'Ngành nguồn khai không đủ để xếp loại, và mô tả cũng không nói',
} as const;

export { NOISE_TOKENS };
