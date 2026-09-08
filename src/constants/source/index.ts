import { SourceKind } from '@/enums';

/**
 * Sáu nguồn đã KHẢO SÁT THẬT bằng curl (24–25/08/2026).
 *
 * Đây là dữ liệu seed, không phải cấu hình runtime: nó được nạp vào bảng
 * `Source` một lần rồi từ đó sửa bằng SQL. Để ở đây chỉ để lần cài đặt đầu
 * tiên có ngay thứ chạy được, và để chỗ nào cũng thấy được nguồn nào đã kiểm
 * bằng cách nào.
 *
 * `priority` nhỏ hơn = tin hơn khi hai nguồn nói khác nhau về cùng một việc.
 * Xếp theo chất lượng trường dữ liệu đo được, không theo tiếng tăm của sàn.
 */

export interface SourceSeed {
  code: string;
  name: string;
  homeUrl: string;
  kind: SourceKind;
  entryUrl: string | null;
  jobUrlPattern: string | null;
  priority: number;
  config: Record<string, unknown> | null;
  /** false = đã kiểm và biết là chưa chạy được. Lý do bắt buộc ghi ở `note`. */
  isActive: boolean;
  /** Ghi chú khảo sát — đừng xoá, đây là bằng chứng cho mọi lựa chọn ở trên. */
  note: string;
}

export const SOURCE_SEEDS: readonly SourceSeed[] = [
  {
    code: 'vnw',
    name: 'VietnamWorks',
    homeUrl: 'https://www.vietnamworks.com',
    kind: SourceKind.API,
    entryUrl: 'https://ms.vietnamworks.com/job-search/v1.0/search',
    jobUrlPattern: null,
    priority: 10,
    // NHẮM MỤC TIÊU ngành thu mua. Đo thật 08/09/2026, số tin mỗi từ khoá trả về:
    //   mua hang 1.258 · purchasing 1.200 · procurement 849 · cung ung 474
    //   thu mua 407 · sourcing 351 · merchandiser 112
    // Một từ khoá bắt được chưa tới một phần ba nghề, nên phải đi cả cụm.
    // Đây là ĐỘ PHỦ thô, còn ĐỘ CHÍNH XÁC do từ điển trong SavedFilter lo —
    // "mua hang" nuốt cả "tư vấn mua hàng" (sales) lẫn "kế toán mua hàng".
    // Muốn đổi ngành: UPDATE cột config, không phải sửa code.
    config: {
      // KHÔNG dò HTTP vào trang tin của nguồn này — đo thật 08/09/2026:
      //   tin ĐANG tuyển  (2098170): HTTP 200, 67 KB
      //   tin ĐÃ hết hạn  (2071986, expiredOn 26/08): HTTP 200, 23 KB
      // Trang hết hạn KHÔNG có JSON-LD, KHÔNG có <title>, KHÔNG một chữ nào
      // báo hết hạn — chỉ là vỏ JS rỗng. Dò vào đây thì mọi kết quả đều là
      // "còn sống", tức là tự dối mình và còn tốn request để làm việc đó.
      // Nguồn này tự khai isActive/isOnline/expiredOn trong API, nên tầng 1 đã
      // đủ và chính xác hơn mọi thứ đọc được từ HTML.
      livenessProbe: 'none',
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
    isActive: true,
    note:
      'ĐÃ CHẠY THẬT 25/08: 1 request -> 50 tin đầy đủ. API JSON công khai, không ' +
      'cần token, 10.556 tin, mỗi bản ghi 106 trường, có isActive/isOnline/' +
      'expiredOn nên tín hiệu còn-sống lấy thẳng từ nguồn. ' +
      'Bẫy: salaryCurrency khai "USD" cho giá trị VND (xem readSalary).',
  },
  {
    code: 'topcv',
    name: 'TopCV',
    homeUrl: 'https://www.topcv.vn',
    kind: SourceKind.SITEMAP_JSONLD,
    // KHÔNG dùng /sitemap.xml: index đó có 16 file con, phần lớn là mẫu CV,
    // trắc nghiệm MBTI, công cụ... Vào thẳng nhánh việc làm, tiết kiệm 1 request
    // và tránh tải nhầm vài MB không dùng đến.
    entryUrl: 'https://www.topcv.vn/sitemap/jobs.xml',
    // /viec-lam/<slug>/2262537.html
    jobUrlPattern: '/viec-lam/[^/]+/\\d+\\.html',
    priority: 20,
    config: {
      externalIdPattern: '/(\\d+)\\.html',
      excludePatterns: ['/cong-ty/', '/cv/', '/mau-cv/'],
    },
    // TẮT — CHẶN Ở TẦNG TLS, KHÔNG PHẢI Ở CHÍNH SÁCH. Xem note.
    isActive: false,
    note:
      'TẮT 25/08 vì bị chặn ở tầng dấu vân tay TLS, KHÔNG phải vì chính sách. ' +
      'Bằng chứng: cùng URL, cùng User-Agent, cùng headers — curl trả 200 (9/9 lần) ' +
      'còn Node fetch trả 403 (6/6 lần), kể cả với UA trình duyệt. Ép HTTP/1.1 ' +
      'không đổi kết quả, nên không phải phiên bản giao thức mà là JA3/JA4 của ' +
      'undici bị Cloudflare xếp loại bot. Trang chi tiết cũng 403 từ Node. ' +
      'ĐÁNG CHÚ Ý: robots.txt của TopCV CHO PHÉP mọi trang việc làm (chỉ chặn ' +
      'khu vực CV/hồ sơ) — tức chính sách công bố thì đồng ý, chỉ tầng biên chặn. ' +
      'Vượt qua nó đòi hỏi nguỵ trang dấu vân tay TLS thành trình duyệt, tức là ' +
      'né tránh phát hiện — cố ý KHÔNG làm. Đường sạch: viết thư xin phép TopCV ' +
      '(User-Agent của ta đã có sẵn email liên hệ). ' +
      'Cấu hình dưới đây đã kiểm đúng và để nguyên, bật lại là chạy được ngay: ' +
      'sitemap/jobs.xml là index -> jobs_0..N.xml, mỗi file 200 URL, 183/200 khớp mẫu.',
  },
  {
    code: 'topdev',
    name: 'TopDev',
    homeUrl: 'https://topdev.vn',
    kind: SourceKind.SITEMAP_JSONLD,
    entryUrl: 'https://topdev.vn/sitemap-jobs.xml',
    // /detail-jobs/<slug>-<id>
    jobUrlPattern: '/detail-jobs/[a-z0-9-]+-\\d+$',
    priority: 30,
    config: {
      externalIdPattern: '-(\\d+)$',
      // Index có 257 file `jobs_desc_en_*` VÀ 257 file `jobs_desc_vi_*` chứa
      // CÙNG một tập tin ở hai ngôn ngữ (`vi` dùng /viec-lam/, `en` dùng
      // /detail-jobs/). Không lọc là tải gấp đôi số file cho đúng số tin.
      sitemapUrlPattern: 'jobs_desc_en',
      excludePatterns: ['/companies/', '/blog/'],
    },
    isActive: true,
    note:
      'ĐÃ CHẠY THẬT 25/08: 5 request, 9,4s, đọc được tin đầy đủ kèm validThrough. ' +
      'Trang danh sách render bằng JS nhưng trang CHI TIẾT vẫn SSR (bắt buộc thế ' +
      'để lên Google Jobs) — nên sitemap đi vòng qua đúng chỗ khó, không cần headless.',
  },
  {
    code: 'itviec',
    name: 'ITviec',
    homeUrl: 'https://itviec.com',
    kind: SourceKind.SITEMAP_JSONLD,
    entryUrl: 'https://itviec.com/dunggiatminh.xml',
    // /it-jobs/<slug>-4101 — BẮT BUỘC có đuôi số
    jobUrlPattern: '/it-jobs/[a-z0-9-]+-\\d{3,}$',
    priority: 25,
    config: {
      externalIdPattern: '-(\\d{3,})$',
      // BẮT BUỘC. Index có 13 file con, hai file chứa tin (`jobs_desc_*`) nằm
      // CUỐI CÙNG, còn bốn file đầu là danh mục công ty nặng tổng 17 MB. Không
      // lọc là đốt hết ngân sách trước khi chạm tới một URL tin nào — đo thật:
      // 5 file, 17,35 MB, 0 tin.
      // Chỉ lấy bản `_en` (/it-jobs/); bản `_vn` (/viec-lam-it/) là CÙNG tin.
      sitemapUrlPattern: 'jobs_desc_en',
      excludePatterns: ['/companies/', '/blog/'],
    },
    isActive: true,
    note:
      'ĐO 25/08: jobs_desc_en.xml có 847 URL, tất cả khớp mẫu. robots.txt cởi mở ' +
      'nhất trong các sàn: chỉ chặn đúng /subscriptions/new. ' +
      'CẨN THẬN: /it-jobs/backend-developer (không đuôi số) là trang CHUYÊN MỤC.',
  },
  {
    code: 'vieclam24h',
    name: 'Việc Làm 24h',
    homeUrl: 'https://vieclam24h.vn',
    kind: SourceKind.SITEMAP_JSONLD,
    // Vào thẳng nhánh tin tuyển dụng. Index gốc còn có blog, employer, và các
    // trang tổng hợp theo ngành/tỉnh — không phải tin.
    entryUrl: 'https://cdn1.vieclam24h.vn/file/sitemap/daily/job-0.xml',
    jobUrlPattern: 'c\\d+p\\d+id\\d+',
    priority: 40,
    config: {
      externalIdPattern: 'id(\\d+)',
      // NHẮM MỤC TIÊU: thu mua + TP.HCM, lọc ngay ở tầng sitemap.
      //
      // URL tin của sàn này tự khai ngành và tỉnh:
      //   .../truong-phong-mua-hang-c14p122id200731476.html
      //        c14 = Thu mua–Kho vận–Chuỗi cung ứng · p122 = TP.HCM
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
      // BẮT BUỘC ở nguồn này — xem note.
      ignoreLastmod: true,
    },
    isActive: true,
    note:
      'ĐO 25/08: job-0.xml là index -> job/tintuyendung-N.xml. Sitemap gốc có ' +
      '<lastmod> và chia sẵn theo nganhnghe-*.xml / tinhthanh-*.xml — đúng chiều ' +
      'cắt cần cho thống kê theo ngành, để dành cho chặng thống kê. ' +
      'ĐO LẠI 08/09: <lastmod> của nguồn này là RÁC — cả 4.180 URL trong ' +
      'tintuyendung-0.xml mang đúng một giá trị 2026-07-28T00:13:4x, tức giờ ' +
      'SINH FILE chứ không phải giờ tin đổi; file tên "daily" mà 6 tuần chưa ' +
      'sinh lại. Hệ quả: không bật ignoreLastmod thì từ lần chạy thứ hai nguồn ' +
      'im lặng trả 0 tin. Và vì sitemap đóng băng nên TẦNG 2 (vắng khỏi sitemap) ' +
      'ở đây VÔ GIÁ TRỊ — bằng chứng: tin c14p122id200731476 vẫn nằm trong ' +
      'sitemap, vẫn trả HTTP 200, vẫn còn JSON-LD, nhưng validThrough 2026-08-09 ' +
      'đã qua và trang ghi "Việc làm này đã hết hạn nộp hồ sơ". Tin cậy tầng 1 + 4.',
  },
  {
    code: 'careerviet',
    name: 'CareerViet',
    homeUrl: 'https://careerviet.vn',
    kind: SourceKind.SITEMAP_JSONLD,
    entryUrl: null,
    jobUrlPattern: '/vi/tim-viec-lam/[^/]+\\.\\w+$',
    priority: 50,
    config: null,
    // TẮT. Không tìm được sitemap dùng được — xem note.
    isActive: false,
    note:
      'TẮT sau khi kiểm 25/08: /sitemap.xml trả HTTP 404 kèm 1,2 MB body rồi ' +
      'timeout; /sitemap_index.xml và /vi/sitemap.xml cũng 404; ' +
      '/sitemap/sitemap-index.xml trả 200 nhưng RỖNG 0 byte; robots.txt không ' +
      'khai Sitemap nào. Trang danh sách CÓ JobPosting nên nguồn này vẫn dùng ' +
      'được — nhưng phải qua adapter list-jsonld, để chặng sau. ' +
      'robots.txt của họ cho phép đích danh Googlebot/GPTBot/ClaudeBot.',
  },
];

/**
 * Nguồn đã kiểm và quyết định KHÔNG dùng. Ghi lại để sáu tháng nữa không ai
 * mất một ngày đi kiểm lại và rút ra đúng kết luận cũ.
 */
export const REJECTED_SOURCES: readonly { name: string; reason: string }[] = [
  { name: 'JobsGO', reason: 'Cloudflare trả HTTP 403 "Just a moment…" — không đáng để chống bot' },
  { name: 'LinkedIn', reason: 'reCAPTCHA enterprise ngay ở robots.txt' },
  { name: 'Indeed VN', reason: 'Điều khoản sử dụng cấm cào rõ ràng' },
  { name: 'Glints VN', reason: 'Không có JSON-LD; dữ liệu nằm trong __NEXT_DATA__ — để giai đoạn 2' },
  { name: 'mywork / 123job', reason: 'Danh sách render bằng JS, chưa tìm được sitemap job riêng' },
];
