import type { WorkspaceId } from '@/constants/workspace';

/**
 * LẤY LÁT NÀO của từng sàn — khác theo workspace.
 *
 * Cách VÀO một sàn (sitemap, mẫu URL tin, curl...) nằm ở `catalog.ts` và đúng
 * cho mọi nghề. Ở đây chỉ có ba thứ đổi theo nghề:
 *
 *   · `isActive`          — nghề này có dùng sàn này không
 *   · `queries`           — từ khoá cho nguồn API (VietnamWorks)
 *   · `urlIncludePattern` — mẫu lọc URL ngay sau sitemap, TRƯỚC khi tiêu ngân
 *                           sách request (xem GenericJsonLdConfig)
 *
 * Mỗi workspace PHẢI khai đủ mọi nguồn của catalog — thiếu một nguồn thì
 * `sourceSeedsFor` ném lỗi, để không nguồn nào lặng lẽ biến khỏi một CSDL.
 *
 * ⚠️ `isActive` chỉ có tác dụng lúc seed TẠO dòng `Source`. Seed chạy lại
 *    không đụng tới nó (người vận hành có thể đã cố ý tắt) — đổi ở đây cho
 *    một nguồn đã tồn tại thì phải `UPDATE "Source"` bằng tay.
 */

export interface SourceTargeting {
  isActive: boolean;
  queries?: readonly string[];
  urlIncludePattern?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// THU MUA — workspace bae
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Các từ LÕI của nghề thu mua, viết theo dạng nằm trong slug URL.
 *
 * Dùng cho `urlIncludePattern` ở những sàn KHÔNG mã hoá ngành vào URL — ở đó
 * tên tin là tín hiệu duy nhất lọc được trước khi tiêu ngân sách request.
 *
 * CỐ Ý chỉ lấy từ LÕI, bỏ hết từ XÁM (`logistics`, `xuat-nhap-khau`,
 * `kho-van`, `dieu-phoi` — xem `GRAY_PREFIX` ở constants/field). Lý do: từ điển
 * quy định từ xám không tự kéo tin vào ngành, nên tải chúng về là chắc chắn
 * tải để rồi vứt. Đo thật 09/09/2026 trên timviec365: thêm nhóm xám vào đây
 * nâng 156 URL lên 299, tức gần gấp đôi ngân sách cho phần mà từ điển sẽ loại.
 *
 * Đo thật 09/09/2026 với đúng mẫu dưới đây:
 *   timviec365  12.357 URL -> 156 (1,3%)
 *   careerviet  14.368 URL -> 428 (3,0%)
 * Cả hai đều lọt trần `maxUrls` (300 × 3 = 900) của một lần chạy.
 *
 * vieclam24h CỐ Ý không dùng hằng số này: URL của sàn đó tự khai mã ngành và
 * mã tỉnh (`c14p122`), nên mẫu của nó có thêm một nhánh bắt được cả tin không
 * có từ khoá nào trong tên. Gộp vào đây là làm hỏng con số đã đo ghi ở nguồn ấy.
 */
export const PURCHASE_SLUG =
  'thu-mua|mua-hang|mua-sam|vat-tu|nha-cung-cap|cung-ung|dau-thau|purchasing|' +
  'purchaser|procurement|sourcing|buyer|merchandiser|merchandise|supply-chain|' +
  'supplier|vendor|commodity|tender';

const BAE: Readonly<Record<string, SourceTargeting>> = {
  vnw: {
    isActive: true,
    // Đo thật 08/09/2026, số tin mỗi từ khoá trả về:
    //   mua hang 1.258 · purchasing 1.200 · procurement 849 · cung ung 474
    //   thu mua 407 · sourcing 351 · merchandiser 112
    // Một từ khoá bắt được chưa tới một phần ba nghề, nên phải đi cả cụm.
    // Đây là ĐỘ PHỦ thô, còn ĐỘ CHÍNH XÁC do từ điển trong SavedFilter lo —
    // "mua hang" nuốt cả "tư vấn mua hàng" (sales) lẫn "kế toán mua hàng".
    queries: [
      'thu mua',
      'mua hang',
      'mua sam',
      'vat tu',
      'purchasing',
      'procurement',
      'sourcing',
      'merchandiser',
      'dau thau',
      'cung ung',
    ],
  },
  // Tắt vì tầng biên chặn, không vì nghề — xem note trong catalog.
  topcv: { isActive: false, urlIncludePattern: PURCHASE_SLUG },
  // Hai sàn thuần IT: không có tin thu mua để lọc, nên không đặt mẫu.
  topdev: { isActive: true },
  itviec: { isActive: true },
  vieclam24h: {
    isActive: true,
    // Thu mua + TP.HCM, lọc ngay ở tầng sitemap. c14 = Thu mua–Kho vận–Chuỗi
    // cung ứng · p122 = TP.HCM.
    //
    // Hai nhánh, và nhánh thứ hai mới là chỗ đáng tiền. Đo trên
    // tintuyendung-0.xml (4.180 URL) ngày 08/09/2026:
    //   chỉ c14p122            -> 50 URL
    //   c14p122 + slug nghề    -> 69 URL  (+38%), 0 rò rỉ ngoài p122
    // 19 tin vớt thêm là tin thu mua bị sàn xếp vào danh mục KHÁC —
    // "nhan-vien-thu-mua-c31p122id...", "chuyen-vien-mua-hang-quoc-te-c15p122id...".
    // Chỉ tin vào c14 là mất đứt số đó.
    //
    // `[a-z0-9-]*` cố ý KHÔNG chứa "/" nên nhánh slug không thể trèo qua dấu
    // gạch chéo để khớp nhầm tên danh mục ở đoạn đường dẫn trước đó.
    urlIncludePattern:
      '(?:c14p122id\\d+|(?:thu-mua|mua-hang|mua-sam|vat-tu|cung-ung|dau-thau|purchasing|procurement|purchaser|merchandiser|sourcing|buyer)[a-z0-9-]*-c\\d+p122id\\d+)',
  },
  // Đo thật 09/09/2026: 14.368 URL /vi/ -> 428 khớp (3,0%).
  careerviet: { isActive: true, urlIncludePattern: PURCHASE_SLUG },
  // Đo thật 09/09/2026: 12.357 URL -> 156 khớp (1,3%).
  timviec365: { isActive: true, urlIncludePattern: PURCHASE_SLUG },
  glints: { isActive: true, urlIncludePattern: PURCHASE_SLUG },
  vieclamnhamay: { isActive: true, urlIncludePattern: PURCHASE_SLUG },
  iconicjob: { isActive: true, urlIncludePattern: PURCHASE_SLUG },
  'fb-tay': { isActive: true },
  'li-tay': { isActive: true },
};

// ─────────────────────────────────────────────────────────────────────────────
// PHẦN MỀM — workspace swe
//
// ĐÃ ĐO 17/09/2026 bằng `npm run measure -- --ws swe` (việc D3,
// docs/plan-swe.md §15). Tỷ lệ khớp ghi ở từng nguồn là trên URL TIN, trước
// khi từ điển lọc — tức ĐỘ PHỦ thô, chưa phải độ chính xác.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Từ của nghề lập trình, dạng nằm trong slug URL — chặn theo TOKEN của slug.
 *
 * Khác `PURCHASE_SLUG` ở một điểm bắt buộc: có ranh giới ở cả hai đầu. Lý do
 * là `net` — viết trần thì nó khớp "inter-NET", "cabi-NET", "NET-suite", tức
 * đốt ngân sách request vào tin chẳng liên quan. Ranh giới trước là `-` hoặc
 * `/`; ranh giới sau là `-`, `.` (CareerViet kết thúc slug bằng `.35C86620.html`),
 * `/` hoặc hết chuỗi.
 *
 * Gồm hai nhóm:
 *   · công nghệ của CV: net, dotnet, asp, csharp, react...
 *   · tên vai trò: developer, lap-trinh, backend... — trên sàn tổng hợp đây
 *     mới là thứ tách tin IT khỏi phần còn lại. `developer` KHÔNG khớp
 *     "development" nhờ ranh giới sau.
 *
 * Không có `c` trần cho C#: slug "lap-trinh-vien-c-net" đã được `net` bắt, còn
 * `c` một mình thì khớp mọi thứ.
 */
const SOFTWARE_TOKENS =
  'net|dotnet|dot-net|aspnet|asp|csharp|c-sharp|reactjs|react-js|react|' +
  'fullstack|full-stack|backend|back-end|frontend|front-end|' +
  'developer|lap-trinh|software|phan-mem';

export const SOFTWARE_SLUG = `(?:^|[-/])(?:${SOFTWARE_TOKENS})(?=[-./]|$)`;

const SWE: Readonly<Record<string, SourceTargeting>> = {
  vnw: {
    isActive: true,
    // Đo 17/09/2026, số tin mỗi từ khoá (18 từ đã thử):
    //   software engineer 506 · ky su phan mem 432 · lap trinh vien 167
    //   developer 166 · backend developer 63 · c# 30 · sql server 23
    //   fullstack 21 · .net 19 · reactjs 5 · asp.net 3 · c# developer 1
    //   net developer 0
    //
    // Ba điều rút ra:
    //  · Kho IT của VNW NHỎ — cả sàn chỉ có 19 tin nhắc .NET. VNW mạnh ở nghề
    //    phi-IT; với nghề này nó là nguồn phụ, không phải nguồn chính.
    //  · ".net", "dotnet", ".net developer", ".net core" trả CÙNG 19 tin — API
    //    quy về một kỹ năng. Giữ một từ là đủ. Còn "net developer" (không dấu
    //    chấm) trả 0: API cần đúng ký hiệu.
    //  · Từ rộng ("software engineer") xếp theo độ liên quan RẤT kém — 5 tin
    //    đầu là DevOps, tư vấn tài chính, PM tiếng Nhật, network, tester. Giữ
    //    để lấy độ phủ, từ điển và độ hợp CV lo độ chính xác. "ky su phan mem"
    //    và "developer" trùng phần lớn với hai từ rộng đã chọn nên bỏ.
    //
    // Bản ghi VNW khai kỹ năng có cấu trúc (".NET Core", "C#", "Asp.net",
    // "SQL Server") — nguồn chính cho việc bóc kỹ năng C9.
    queries: [
      '.net',
      'c#',
      'sql server',
      'reactjs',
      'fullstack',
      'backend developer',
      'lap trinh vien',
      'software engineer',
    ],
  },
  topcv: { isActive: false, urlIncludePattern: SOFTWARE_SLUG },
  // Đo 17/09/2026: kho TopDev nay lẫn rất nhiều việc phi-IT (Jollibee, VPBank,
  // tư vấn tuyển sinh). Mẫu 5 file đầu (trong 257): 100 URL → 2 khớp (2,0%).
  // Mỗi file chỉ 20 URL nên muốn đi hết phải tốn ~257 request chỉ để khám phá
  // — trần 50 file/lượt nghĩa là mỗi lượt thấy khoảng 1.000 URL mới nhất.
  // Nguồn phụ.
  topdev: { isActive: true, urlIncludePattern: SOFTWARE_SLUG },
  // Đo 17/09/2026, đi hết sitemap (2 file, 3 request): 733 URL → 260 khớp
  // (35,5%). Tin bị loại là SRE, DevOps, Data, BA, PO — đúng thứ không cần.
  // Nguồn CHÍNH của workspace này. JSON-LD có `skills` ("ReactJS, .NET").
  itviec: { isActive: true, urlIncludePattern: SOFTWARE_SLUG },
  vieclam24h: {
    isActive: true,
    // Mã danh mục IT phần mềm của sàn là `c8` (thư mục `/it-phan-mem/`); `c7`
    // là phần cứng–mạng. Đo 17/09/2026 trên 5 file (17.089 URL):
    //   chỉ nhánh slug nghề           -> 28 URL, nhiễu: "lập trình CNC",
    //                                    "kinh doanh phần mềm", "CorelDraw"
    //   chỉ c8p122                    -> 46 URL
    //   c8p122 + slug nghề (dưới đây) -> 50 URL
    // Cảnh báo: danh mục c8 của sàn KHÔNG sạch — lẫn "kế toán tổng hợp",
    // "video editor", "nhân viên kinh doanh". Từ điển lo phần đó.
    // Nhánh slug bỏ `lap-trinh` và `phan-mem` trần (hai từ kéo CNC và bán phần
    // mềm vào), chỉ giữ `lap-trinh-vien` và tên công nghệ.
    urlIncludePattern:
      '(?:c8p122id\\d+|(?:^|[-/])(?:net|dotnet|csharp|reactjs|react|fullstack|full-stack|backend|back-end|frontend|front-end|developer|lap-trinh-vien|software-engineer)(?=[-.])[a-z0-9-]*-c\\d+p122id\\d+)',
  },
  // Đo 17/09/2026, đi hết (5 file): 21.232 URL → 157 khớp (0,7%). Nhiễu thấy
  // bằng mắt: "lập trình CNC", "merchandiser product developer", "kinh doanh
  // phần mềm" — từ điển ngành có từ loại cho cả ba.
  careerviet: { isActive: true, urlIncludePattern: SOFTWARE_SLUG },
  // Đo 17/09/2026, đi hết (9 file): 12.440 URL → 117 khớp (0,9%). Lẫn "tư vấn
  // phần mềm", PHP, Unity. Bật nhưng KHÔNG có trong lịch Actions — như bên
  // bae: 23 giây/URL.
  timviec365: { isActive: true, urlIncludePattern: SOFTWARE_SLUG },
  // Đo 17/09/2026, mẫu 3 file (trong 66): 300 URL → 5 khớp (1,7%).
  glints: { isActive: true, urlIncludePattern: SOFTWARE_SLUG },
  // Việc nhà máy — không phải chỗ tìm việc lập trình. Mẫu vẫn đặt để lỡ bật
  // lại bằng SQL thì không cào nguyên kho 195.000 URL.
  vieclamnhamay: { isActive: false, urlIncludePattern: SOFTWARE_SLUG },
  // Doanh nghiệp Nhật: phần lớn tin đòi tiếng Nhật, CV không có (plan-swe §5.2).
  iconicjob: { isActive: false, urlIncludePattern: SOFTWARE_SLUG },
  // LinkedIn là nơi nhiều tin IT nhất mà không cào được — nhập tay.
  'fb-tay': { isActive: true },
  'li-tay': { isActive: true },
};

export const TARGETING: Readonly<Record<WorkspaceId, Readonly<Record<string, SourceTargeting>>>> = {
  bae: BAE,
  swe: SWE,
};
