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
const PURCHASE_SLUG =
  'thu-mua|mua-hang|mua-sam|vat-tu|nha-cung-cap|cung-ung|dau-thau|purchasing|' +
  'purchaser|procurement|sourcing|buyer|merchandiser|merchandise|supply-chain|' +
  'supplier|vendor|commodity|tender';

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
    // BẬT LẠI 09/09/2026. Lần khảo sát 25/08 kết luận "không có sitemap dùng
    // được" — kết luận đó SAI, vì đã thử /sitemap.xml, /sitemap_index.xml,
    // /vi/sitemap.xml và /sitemap/sitemap-INDEX.xml mà chưa thử đúng địa chỉ
    // dưới đây. /sitemap/sitemap.xml trả 200 kèm một index 12 file thật.
    entryUrl: 'https://careerviet.vn/sitemap/sitemap.xml',
    // /vi/tim-viec-lam/<slug>.35C86620.html
    jobUrlPattern: '/vi/tim-viec-lam/[^/]+\\.\\w+$',
    // Trường dữ liệu giàu thứ nhì sau VietnamWorks — xem note. Đứng trên
    // TopCV/ITviec/TopDev vì có đủ lương VND, kinh nghiệm và giờ làm việc.
    priority: 15,
    config: {
      externalIdPattern: '\\.([0-9A-F]+)\\.html$',
      // BẮT BUỘC, hai việc cùng lúc:
      //  1. bỏ 5 file không phải tin (searchjob/searchresume/employer/...),
      //  2. bỏ bản dịch trùng — `job_en_*` là CÙNG tin với `job_vi_*`, chỉ khác
      //     đường dẫn (/en/search-job/ so với /vi/tim-viec-lam/). Nạp cả hai là
      //     mọi thống kê bị đếm đôi.
      // Giữ `job_current_date` vì đó là file tin đăng trong ngày (860 URL, gồm
      // cả hai thứ tiếng — `jobUrlPattern` ở trên lọc nốt bản `en`).
      sitemapUrlPattern: 'job_(?:vi_|current_date)',
      // Sàn này KHÔNG mã hoá ngành vào URL, nên chỉ lọc được theo tên tin.
      // Đo thật 09/09/2026: 14.368 URL /vi/ -> 428 khớp (3,0%).
      urlIncludePattern: PURCHASE_SLUG,
    },
    isActive: true,
    note:
      'ĐO THẬT 09/09/2026: /sitemap/sitemap.xml -> index 12 file, trong đó ' +
      'job_vi_0..2 (6.974 URL mỗi file) + job_current_date (860 URL). <lastmod> ' +
      'là THẬT — 2.256 giá trị khác nhau trên 6.974 URL — nên crawl tăng dần ' +
      'dùng được, KHÔNG cần ignoreLastmod như vieclam24h. ' +
      'JSON-LD giàu nhất trong nhóm sitemap: baseSalary VND có min/max, ' +
      'validThrough, experienceRequirements.monthsOfExperience, industry ' +
      '("Thu mua / Vật tư" — khớp thẳng bảng chia loại), và workHours ' +
      '("Thứ2-Thứ6(08:00-17:30)") tức cột lịch thứ 7 sẽ có dữ liệu thật. ' +
      'robots.txt CHO PHÉP đích danh ClaudeBot/GPTBot/Googlebot; nhánh /vi/ ' +
      'tim-viec-lam/ không bị cấm (nhưng /en/tim-viec-lam/ và /vi/jobs/ thì CÓ ' +
      '— thêm một lý do chỉ đi nhánh vi). ' +
      'HAI BẪY đã phải vá ở parser, đừng gỡ: (1) sàn đảo addressRegion và ' +
      'addressLocality — region là QUẬN ("Quận 5"), locality mới là TỈNH — nên ' +
      'extractLocations phải thử lần lượt, không thì mọi tin ra province null ' +
      'và biến mất khỏi trang Ngành; (2) employmentType trả ["\\"FULL_TIME\\""] ' +
      'có dấu nháy thừa nằm trong chuỗi.',
  },
  {
    code: 'timviec365',
    name: 'Tìm Việc 365',
    homeUrl: 'https://timviec365.vn',
    kind: SourceKind.SITEMAP_JSONLD,
    entryUrl: 'https://timviec365.vn/sitemap.xml',
    // /<slug>-p2070117.html — tin nằm ngay ở gốc, không có đoạn đường dẫn riêng.
    jobUrlPattern: '/[a-z0-9-]+-p\\d+\\.html$',
    priority: 45,
    config: {
      externalIdPattern: '-p(\\d+)\\.html$',
      // Index có 40 file: blog, mẫu CV, biểu mẫu, danh mục theo tỉnh/quận,
      // công ty... Tin chỉ nằm ở 8 file `sitemap-job-*` (job-1..7 + job-new).
      sitemapUrlPattern: 'sitemap-job-',
      // Đo thật 09/09/2026: 12.357 URL -> 156 khớp (1,3%).
      urlIncludePattern: PURCHASE_SLUG,
    },
    isActive: true,
    note:
      'ĐO THẬT 09/09/2026: sitemap.xml là index 40 file -> sitemap-job-1..7 ' +
      '(2.000 URL mỗi file) + sitemap-job-new (24 tin mới nhất), tổng 12.357 ' +
      'URL tin. <lastmod> THẬT ở mức từng tin — 1.996 giá trị khác nhau trên ' +
      '2.000 URL — nên crawl tăng dần chạy đúng. ' +
      'JSON-LD JobPosting đầy đủ: baseSalary VND min/max unitText MONTH, ' +
      'datePosted, validThrough, industry + occupationalCategory, ' +
      'identifier.value = đúng id trong URL. ' +
      'robots.txt cởi mở: Allow / cho *, chỉ chặn khu admin/ajax/CV/ứng viên. ' +
      'Trang chi tiết SSR, Node fetch đọc được 200 (214 KB) — KHÔNG bị chặn ' +
      'dấu vân tay TLS như TopCV. ' +
      'Lưu ý: slug bỏ dấu theo kiểu riêng ("đ" -> "dj", ví dụ "ky-su-djien"), ' +
      'nên đừng dựa vào slug để đoán nội dung; chỉ dùng nó để lọc URL. ' +
      'BẪY ĐÁNG KỂ NHẤT — `datePosted` ở đây là ngày ĐĂNG LẦN ĐẦU, không phải ' +
      'ngày gia hạn: đo thật có tin datePosted 2022-02-11 mà validThrough ' +
      '2026-09-12, tức tin cũ được nhà tuyển dụng gia hạn liên tục. Hệ quả: ' +
      'bộ lọc `maxAgeDays` của SavedFilter (đang để 90 ngày) sẽ loại phần lớn ' +
      'kho cũ của nguồn này và chỉ giữ tin trong `sitemap-job-new`. Đó là hành ' +
      'vi ĐÚNG cho câu hỏi "tin nào mới", nhưng nếu muốn cả tin gia hạn thì ' +
      'phải nới maxAgeDays, chứ đừng sửa parser để nói dối ngày đăng.',
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

  // ── Khảo sát 09/09/2026, đo bằng Node fetch với đúng User-Agent của ta ─────
  {
    name: 'mywork.com.vn',
    reason:
      'ĐO LẠI 09/09: robots.txt CHO PHÉP (Allow: / cho *), nhưng /sitemap.xml trả ' +
      'HTTP 200 với 1,26 MB HTML của ứng dụng Next.js chứ không phải XML — tức ' +
      'không có sitemap, chỉ có route bắt-tất-cả. Muốn dùng phải qua list-jsonld.',
  },
  {
    name: '123job.vn',
    reason:
      'ĐO LẠI 09/09: robots.txt rất thoáng và CÓ khai sitemap, nhưng ' +
      '/sitemap.xml là <sitemapindex> RỖNG — 125 byte, không một <loc> nào.',
  },
  {
    name: 'job3s.ai (job3s.vn)',
    reason:
      'robots.txt kết thúc bằng "Disallow: /*" cho user-agent *, tức cấm toàn bộ. ' +
      'Có khai Sitemap nhưng lời cấm mới là thứ phải nghe.',
  },
  {
    name: 'CareerLink',
    reason:
      'robots.txt cấm ĐÍCH DANH ClaudeBot, Claude-Web, anthropic-ai, GPTBot và ' +
      'meta-externalagent bằng "Disallow: /". Nhóm * chỉ bị chặn vài trang lọc, ' +
      'nên về mặt kỹ thuật UA của ta lọt — nhưng ý của toà soạn đã quá rõ: họ ' +
      'không muốn công cụ AI đọc trang. CỐ Ý không lách bằng cách đổi tên bot.',
  },
  {
    name: 'Việc Làm Tốt (Chợ Tốt)',
    reason:
      'Cùng lý do CareerLink: robots.txt liệt kê ClaudeBot/anthropic-ai/GPTBot ' +
      'trong nhóm "Block AI training crawlers" với Disallow: /. Thêm nữa ' +
      'sitemap-index.xml trả HTTP 403 cho Node fetch.',
  },
  {
    name: 'JobOKO',
    reason:
      'robots.txt cho phép trang tin, nhưng không tìm được sitemap: /sitemap.xml, ' +
      '/sitemap-index.xml, /sitemap_index.xml, /sitemaps.xml đều 404 và robots ' +
      'không khai Sitemap nào. Là sàn tổng hợp lại tin của sàn khác nên độ ưu ' +
      'tiên thấp — trùng lặp cao mà nguồn gốc thì đã có sẵn.',
  },
  {
    name: 'HR1Jobs / JobStreet VN / vieclam.thanhnien.vn',
    reason: 'Node fetch không kết nối được tới robots.txt (fetch failed / DNS) 09/09.',
  },
  { name: 'freec.asia', reason: 'robots.txt trả HTTP 429 ngay lần gọi đầu — nguồn đang giới hạn gắt.' },
];
