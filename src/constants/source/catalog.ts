import { SourceKind } from '@/enums';

/**
 * CÁCH VÀO từng sàn — đúng cho MỌI workspace.
 *
 * Nguồn đã KHẢO SÁT THẬT bằng curl (24–25/08, 09/09, 11/09/2026): điểm vào,
 * mẫu URL tin, những bẫy của riêng sàn (curl, địa chỉ đảo, lastmod rác...).
 * Những thứ này không đổi theo nghề đang tìm.
 *
 * Còn LẤY LÁT NÀO của sàn — từ khoá, mẫu lọc URL theo nghề, bật hay tắt — thì
 * khác theo workspace và nằm ở `targeting.ts`. Hai thứ từng nằm chung một
 * object; tách ra từ 17/09/2026 khi có workspace thứ hai (docs/plan-swe.md §9.2).
 *
 * Đây là dữ liệu seed, không phải cấu hình runtime: nó được nạp vào bảng
 * `Source` của từng CSDL rồi từ đó sửa bằng SQL. Để ở đây chỉ để lần cài đặt
 * đầu tiên có ngay thứ chạy được, và để chỗ nào cũng thấy được nguồn nào đã
 * kiểm bằng cách nào.
 *
 * `priority` nhỏ hơn = tin hơn khi hai nguồn nói khác nhau về cùng một việc.
 * Xếp theo chất lượng trường dữ liệu đo được, không theo tiếng tăm của sàn.
 */

export interface SourceCatalogEntry {
  code: string;
  name: string;
  homeUrl: string;
  kind: SourceKind;
  entryUrl: string | null;
  jobUrlPattern: string | null;
  priority: number;
  /**
   * Phần của `Source.config` thuộc về SÀN chứ không thuộc về nghề:
   * `externalIdPattern`, `sitemapUrlPattern`, `useCurl`, `livenessProbe`...
   * `queries` và `urlIncludePattern` KHÔNG được nằm ở đây — xem targeting.ts.
   */
  quirks: Record<string, unknown>;
  /** Ghi chú khảo sát — đừng xoá, đây là bằng chứng cho mọi lựa chọn ở trên. */
  note: string;
}

export const SOURCE_CATALOG: readonly SourceCatalogEntry[] = [
  {
    code: 'vnw',
    name: 'VietnamWorks',
    homeUrl: 'https://www.vietnamworks.com',
    kind: SourceKind.API,
    entryUrl: 'https://ms.vietnamworks.com/job-search/v1.0/search',
    jobUrlPattern: null,
    priority: 10,
    // Từ khoá nhắm mục tiêu (`queries`) nằm ở targeting.ts — mỗi nghề một bộ.
    quirks: {
      // KHÔNG dò HTTP vào trang tin của nguồn này — đo thật 08/09/2026:
      //   tin ĐANG tuyển  (2098170): HTTP 200, 67 KB
      //   tin ĐÃ hết hạn  (2071986, expiredOn 26/08): HTTP 200, 23 KB
      // Trang hết hạn KHÔNG có JSON-LD, KHÔNG có <title>, KHÔNG một chữ nào
      // báo hết hạn — chỉ là vỏ JS rỗng. Dò vào đây thì mọi kết quả đều là
      // "còn sống", tức là tự dối mình và còn tốn request để làm việc đó.
      // Nguồn này tự khai isActive/isOnline/expiredOn trong API, nên tầng 1 đã
      // đủ và chính xác hơn mọi thứ đọc được từ HTML.
      livenessProbe: 'none',
    },
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
    quirks: {
      externalIdPattern: '/(\\d+)\\.html',
      excludePatterns: ['/cong-ty/', '/cv/', '/mau-cv/'],
      // Bắt buộc ở nguồn này — xem note. Cờ này chỉ có tác dụng khi chỗ dựng
      // `PoliteFetcher` gọi `applyFetchQuirks`; ba chỗ đó là pipeline, probe
      // và recheck.
      useCurl: true,
    },
    // VẪN TẮT ở MỌI workspace sau khi đo lại 11/09/2026 (targeting.ts). Đã thử
    // bật bằng cờ useCurl và KHÔNG đủ — xem note. Cấu hình để nguyên vì nó đã
    // kiểm đúng.
    note:
      'TẮT 25/08, ĐO LẠI 11/09/2026 và VẪN TẮT. Nguồn này bị chặn ở tầng biên, ' +
      'KHÔNG phải vì chính sách: robots.txt của TopCV CHO PHÉP mọi trang việc ' +
      'làm (chỉ chặn khu CV/hồ sơ). ' +
      'BƯỚC 1 — curl thay undici, đã thử: đo cũ 25/08 curl 200 (9/9) còn Node ' +
      'fetch 403 (6/6). Đo lại 11/09 vẫn đúng chiều đó — Node fetch 403 (5.041 B ' +
      'trang chặn), curl trần thì 200/200/403. Nên đã nối dây cờ `useCurl` và ' +
      'chạy `npm run probe -- --source topcv`. ' +
      'KẾT QUẢ: 403 cả hai lần chạy, kể cả sau một lần thử lại của ' +
      'FLAKY_STATUS_CODES. Tức curl KHÔNG đủ — kết luận "đổi bộ thư viện là ' +
      'xong" là sai. ' +
      'BƯỚC 2 — tìm chỗ khác nhau. Header không phải thủ phạm: curl với đúng ba ' +
      'header của fetcher (Accept XML, Accept-Language, UA) cho 200/200/200. ' +
      'Thủ phạm là TRÌNH TỰ: mô phỏng đúng lối đi của fetcher — GET robots.txt ' +
      'rồi 2s sau GET sitemap — cho 403/403/200. Giãn lên 15s còn TỆ HƠN: ' +
      '403/403/403. Nghĩa là không phải giới hạn tốc độ, mà chính lượt đọc ' +
      'robots.txt làm tầng biên đánh dấu client. ' +
      'BƯỚC 3 — dừng ở đây, cố ý. Cách duy nhất còn lại là BỎ QUA robots.txt, ' +
      'mà đó vừa là né tránh phát hiện vừa phá đúng quy tắc PoliteFetcher tồn ' +
      'tại để giữ. Không làm. ' +
      'RANH GIỚI: đổi bộ thư viện HTTP không phải nói dối họ, nhưng bỏ đọc ' +
      'robots.txt, nguỵ trang UA thành Chrome hay mượn JA3 của trình duyệt thì ' +
      'LÀ. Đường sạch còn lại là viết thư xin phép TopCV (User-Agent của ta đã ' +
      'có sẵn email liên hệ). ' +
      'Cấu hình đã kiểm đúng và để nguyên, bật lại là chạy được ngay nếu họ mở: ' +
      'sitemap/jobs.xml là index -> jobs_0..N.xml, mỗi file 200 URL, 183/200 ' +
      'khớp mẫu; đã thêm urlIncludePattern để chỉ tải lát cắt thu mua.',
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
    quirks: {
      externalIdPattern: '-(\\d+)$',
      // Index có 257 file `jobs_desc_en_*` VÀ 257 file `jobs_desc_vi_*` chứa
      // CÙNG một tập tin ở hai ngôn ngữ (`vi` dùng /viec-lam/, `en` dùng
      // /detail-jobs/). Không lọc là tải gấp đôi số file cho đúng số tin.
      sitemapUrlPattern: 'jobs_desc_en',
      excludePatterns: ['/companies/', '/blog/'],
    },
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
    quirks: {
      externalIdPattern: '-(\\d{3,})$',
      // BẮT BUỘC. Index có 13 file con, hai file chứa tin (`jobs_desc_*`) nằm
      // CUỐI CÙNG, còn bốn file đầu là danh mục công ty nặng tổng 17 MB. Không
      // lọc là đốt hết ngân sách trước khi chạm tới một URL tin nào — đo thật:
      // 5 file, 17,35 MB, 0 tin.
      // Chỉ lấy bản `_en` (/it-jobs/); bản `_vn` (/viec-lam-it/) là CÙNG tin.
      sitemapUrlPattern: 'jobs_desc_en',
      excludePatterns: ['/companies/', '/blog/'],
    },
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
    quirks: {
      externalIdPattern: 'id(\\d+)',
      // URL tin của sàn này tự khai ngành và tỉnh:
      //   .../truong-phong-mua-hang-c14p122id200731476.html
      //        c14 = Thu mua–Kho vận–Chuỗi cung ứng · p122 = TP.HCM
      // nên lọc được ngay ở tầng sitemap — mẫu lọc theo nghề ở targeting.ts.
      //
      // BẮT BUỘC ở nguồn này — xem note.
      ignoreLastmod: true,
    },
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
    quirks: {
      externalIdPattern: '\\.([0-9A-F]+)\\.html$',
      // BẮT BUỘC, hai việc cùng lúc:
      //  1. bỏ 5 file không phải tin (searchjob/searchresume/employer/...),
      //  2. bỏ bản dịch trùng — `job_en_*` là CÙNG tin với `job_vi_*`, chỉ khác
      //     đường dẫn (/en/search-job/ so với /vi/tim-viec-lam/). Nạp cả hai là
      //     mọi thống kê bị đếm đôi.
      // Giữ `job_current_date` vì đó là file tin đăng trong ngày (860 URL, gồm
      // cả hai thứ tiếng — `jobUrlPattern` ở trên lọc nốt bản `en`).
      sitemapUrlPattern: 'job_(?:vi_|current_date)',
      // Sàn này KHÔNG mã hoá ngành vào URL, nên chỉ lọc được theo tên tin —
      // mẫu theo nghề ở targeting.ts.
    },
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
    quirks: {
      externalIdPattern: '-p(\\d+)\\.html$',
      // Index có 40 file: blog, mẫu CV, biểu mẫu, danh mục theo tỉnh/quận,
      // công ty... Tin chỉ nằm ở 8 file `sitemap-job-*` (job-1..7 + job-new).
      sitemapUrlPattern: 'sitemap-job-',
    },
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

  // ── Khảo sát 11/09/2026 — bốn nguồn thêm vào đợt này ───────────────────────

  {
    code: 'glints',
    name: 'Glints Việt Nam',
    homeUrl: 'https://glints.com',
    kind: SourceKind.SITEMAP_JSONLD,
    entryUrl: 'https://glints.com/sitemap_index.xml',
    // /vn/opportunities/jobs/<slug>/<uuid> — CỐ Ý không nhận /vn/en/, xem note.
    jobUrlPattern: '/vn/opportunities/jobs/[^/]+/[0-9a-f-]{36}$',
    // Trường dữ liệu giàu ngang CareerViet và hơn cả bốn sàn còn lại: đây là
    // nguồn DUY NHẤT ngoài VietnamWorks có đồng thời kỹ năng, phúc lợi, số
    // tháng kinh nghiệm và tên nghề chuẩn hoá. Xem note.
    priority: 18,
    quirks: {
      externalIdPattern: '/([0-9a-f-]{36})$',
      // BẮT BUỘC. Index có 66 file `sitemap_job_vn_*` nhưng cũng có
      // `sitemap_job_id_*` (Indonesia), `_sg_` (Singapore), `_my_` (Malaysia),
      // cộng với company/category/location. Không lọc là tải tin Indonesia về
      // rồi vứt — sàn này là sàn Đông Nam Á, không phải sàn Việt Nam.
      sitemapUrlPattern: 'sitemap_job_vn_',
      // Tầng biên chặn undici — xem note.
      useCurl: true,
    },
    note:
      'LẬT LẠI KẾT LUẬN CŨ. Bản khảo sát trước xếp Glints vào nhóm loại với lý ' +
      '"không có JSON-LD; dữ liệu nằm trong __NEXT_DATA__". ĐO LẠI 11/09/2026 ' +
      'thì SAI: trang tin có đúng một khối ld+json JobPosting đầy đủ. ' +
      'Kết luận cũ nhiều khả năng dựa trên trang tải bằng Node fetch — mà Node ' +
      'fetch ở đây nhận HTTP 403 kèm 1,3 MB trang "Glints - Firewall", tức là ' +
      'đã đọc nhầm trang tường lửa rồi tưởng là trang tin rỗng. ' +
      'ĐO: robots.txt CHO PHÉP cả sitemap lẫn /vn/opportunities/jobs/ (kiểm ' +
      'bằng chính robots-parser với UA thật của ta). curl 200 (374 KB XML). ' +
      'sitemap_index -> 66 file sitemap_job_vn_*, mỗi file 200 <loc> = 100 tin ' +
      'kèm bản song ngữ; 3 file mẫu cho 600 <loc> -> 300 khớp jobUrlPattern -> ' +
      '5 khớp thêm từ khoá thu mua (1,7%). Ước lượng cả nhánh VN ~6.600 tin. ' +
      'BẢN SONG NGỮ: mỗi tin xuất hiện hai lần, /vn/... và /vn/en/... — CÙNG ' +
      'một tin. jobUrlPattern ở trên chỉ khớp nhánh không có /en/, nên bản dịch ' +
      'bị loại ngay ở tầng sitemap và thống kê không bị đếm đôi. ' +
      'GIÀU TRƯỜNG: baseSalary VND min/max trong QuantitativeValue, validThrough, ' +
      'experienceRequirements.monthsOfExperience, industry, occupationalCategory ' +
      '("Social Media Manager"), skills dạng chuỗi phẩy, jobBenefits, và ' +
      'hiringOrganization là CHỦ LAO ĐỘNG THẬT (không phải sàn). ' +
      'Địa chỉ theo chiều THUẬN — addressRegion là tỉnh, addressLocality là ' +
      'quận — nên KHÔNG cần trustStreetFirst như vieclamnhamay. ' +
      'KHÔNG có <lastmod> ở bất kỳ mục nào: crawl tăng dần không có tác dụng, ' +
      'nhưng cũng không gây hại (mục thiếu lastmod luôn được giữ), nên không ' +
      'cần ignoreLastmod — cờ đó chỉ để chữa lastmod RÁC, còn đây là KHÔNG CÓ.',
  },
  {
    code: 'vieclamnhamay',
    name: 'Việc Làm Nhà Máy',
    homeUrl: 'https://vieclamnhamay.vn',
    kind: SourceKind.SITEMAP_JSONLD,
    // urlset chứa 39 file con — KHÔNG phải sitemapindex, xem note.
    entryUrl: 'https://vieclamnhamay.vn/tin-tuyen-dung.xml',
    // /viec-lam/<id>-<slug>
    jobUrlPattern: '/viec-lam/\\d+-[a-z0-9-]+$',
    // Kho lớn nhất trong nhóm và đúng vào nghề đang nhắm (thu mua vật tư ở nhà
    // máy), nhưng trường dữ liệu nghèo và có hai bẫy nặng — xem note.
    priority: 50,
    quirks: {
      externalIdPattern: '/viec-lam/(\\d+)-',
      // BẮT BUỘC ở nguồn này — hai ô cấp tỉnh của họ là rác. Xem note.
      trustStreetFirst: true,
    },
    note:
      'ĐO THẬT 11/09/2026. Sàn chuyên việc làm nhà máy/khu công nghiệp — đúng ' +
      'chỗ nghề thu mua vật tư tập trung, nên dù trường dữ liệu nghèo vẫn đáng ' +
      'lấy. robots.txt CHO PHÉP (151 B, không cấm gì đáng kể), không khai ' +
      'Sitemap nào nhưng /sitemap.xml trả 200. Node fetch đọc được, KHÔNG cần curl. ' +
      'ĐƯỜNG ĐI: /sitemap.xml (index 15 file) -> tin-tuyen-dung.xml -> 39 file ' +
      'tin-tuyen-dung-pN.xml, mỗi file 5.000 URL, tổng ~195.000 URL. Đo trên hai ' +
      'file đầu: 10.000 URL -> 354 khớp từ khoá thu mua (3,5%). ' +
      '<lastmod> THẬT ở mức từng tin (4.904 giá trị khác nhau trên 5.000) nên ' +
      'crawl tăng dần chạy đúng, KHÔNG cần ignoreLastmod. ' +
      'BẪY HẠ TẦNG: tin-tuyen-dung.xml khai là <urlset> chứ không phải ' +
      '<sitemapindex>, dù 39 mục bên trong đều là file .xml. Đã phải dạy ' +
      'walkSitemap nhận diện sitemap lồng theo NỘI DUNG thay vì theo thẻ bọc ' +
      '(xem `isNestedSitemap`); không có nó thì nguồn im lặng trả 0 URL. ' +
      'BẪY 1 — NGÀY: datePosted/validThrough dạng "11-09-2026" (ngày trước ' +
      'tháng). Đưa thẳng vào new Date() thì V8 đoán theo lối Mỹ: "11-09-2026" ' +
      'thành 08/11/2026 (lệch gần hai tháng, và ở tương lai), còn "25-12-2026" ' +
      'thành Invalid Date. Đã vá trong parseDate. ' +
      'BẪY 2 — TỈNH: addressRegion và addressLocality là RÁC, không phải bị đảo ' +
      'như CareerViet. Ba tin liên tiếp đều ở TP.HCM theo streetAddress nhưng ' +
      'hai ô kia lần lượt khai "Hà Nội", "HCMC", "Bình Dương". ' +
      'Trong ba giá trị đó chỉ "Hà Nội" là bằng chứng: "HCMC" và "Bình Dương" ' +
      'đều đã là bí danh hợp lệ của ho-chi-minh (Bình Dương sáp nhập vào TP.HCM ' +
      'năm 2025) nên chúng ra đúng kết quả dù đi đường nào. Một tin sai rõ trên ' +
      'ba tin lấy ngẫu nhiên vẫn là quá nhiều để tin vào hai ô ấy — nhưng đừng ' +
      'trích cả ba như thể cả ba đều hỏng. Chỉ streetAddress mang tỉnh thật, nên ' +
      'bật trustStreetFirst; không bật thì tin HCM rơi khỏi trang Ngành. ' +
      'NGHÈO TRƯỜNG: baseSalary hầu hết là {value: "Thỏa thuận"} chứ không có ' +
      'số (parseSalaryJsonLd đã trả isPublic=false đúng, không cần vá); không ' +
      'có industry, không có experienceRequirements, employmentType khai "Khác".',
  },
  {
    code: 'iconicjob',
    name: 'ICONIC Job (doanh nghiệp Nhật)',
    homeUrl: 'https://iconicjob.vn',
    kind: SourceKind.SITEMAP_JSONLD,
    entryUrl: 'https://iconicjob.vn/sitemap.xml',
    // /viec-lam/<Slug-Viet-Hoa>-<id> — CÓ CHỮ HOA, xem note.
    jobUrlPattern: '/viec-lam/[A-Za-z0-9-]+-\\d+$',
    // Thấp nhất trong các nguồn đang bật: kho nhỏ và cột công ty không dùng
    // được cho thống kê — xem CẢNH BÁO ở note.
    priority: 60,
    quirks: {
      externalIdPattern: '-(\\d+)$',
      sitemapUrlPattern: 'jobs\\.xml',
    },
    note:
      'ĐO THẬT 11/09/2026. Sàn của một công ty tuyển dụng Nhật, chuyên vị trí ' +
      'trong doanh nghiệp Nhật ở Việt Nam — phần lớn là nhà máy, nên tỷ lệ tin ' +
      'thu mua/vật tư cao hơn mặt bằng. robots.txt CHO PHÉP, khai đúng sitemap. ' +
      'Node fetch đọc được, KHÔNG cần curl. ' +
      'ĐO: sitemap.xml -> 3 file, tin nằm hết ở jobs.xml (255 URL, tất cả khớp ' +
      'jobUrlPattern) -> 10 khớp thêm từ khoá thu mua (3,9%). Kho nhỏ nhưng sạch. ' +
      'BẪY — CHỮ HOA TRONG SLUG: URL viết hoa từng từ ' +
      '("/viec-lam/Senior-Purchasing-Staff-125687"), khác mọi sàn còn lại. Đây ' +
      'là lý do jobUrlPattern phải là [A-Za-z0-9-] và urlIncludePattern phải ' +
      'được biên dịch kèm cờ `i` (đã sửa trong generic-jsonld). Để mẫu chữ ' +
      'thường như cũ là lọc sạch 255/255 URL và nguồn im lặng trả 0 tin. ' +
      'KHÔNG có <lastmod> — crawl tăng dần không có tác dụng, nhưng kho chỉ 255 ' +
      'URL nên chi phí quét lại không đáng kể. ' +
      '⚠ CẢNH BÁO VỀ CỘT CÔNG TY — đọc trước khi dùng nguồn này cho thống kê: ' +
      'hiringOrganization.name LUÔN là "ICONIC Co., Ltd." (kiểm hai tin khác ' +
      'nhau, cùng một giá trị), tức TÊN CÔNG TY TUYỂN HỘ chứ không phải chủ lao ' +
      'động. Trang chi tiết cũng không nêu tên khách hàng ở đâu cả — sàn này cố ' +
      'ý giấu, đó là mô hình kinh doanh của họ. Hệ quả: mọi tin của nguồn này ' +
      'gộp về MỘT Company, và bảng "công ty tuyển nhiều nhất" sẽ có một dòng ' +
      'ICONIC to bất thường. Con số ấy không sai về mặt sự thật (nộp hồ sơ đúng ' +
      'là nộp qua ICONIC) nhưng nó KHÔNG so sánh được với các dòng còn lại. ' +
      'Nếu chuyện đó làm hỏng biểu đồ hơn là số tin thu về đáng giá, hãy TẮT ' +
      'nguồn này — đừng bịa tên chủ lao động từ mô tả.',
  },

  // ── Nguồn NHẬP TAY ─────────────────────────────────────────────────────────
  //
  // Hai nguồn dưới đây không có adapter và sẽ không bao giờ có. `loadSources`
  // loại chúng khỏi mọi lượt crawl, nên KHÔNG một request nào của máy đi tới
  // facebook.com hay linkedin.com. Đường vào duy nhất là `npm run ingest`,
  // tức là do người dùng dán vào tin mà chính họ đọc được.
  //
  // Vì sao vẫn dựng chúng thành Source thay vì một bảng riêng: để tin dán tay
  // đi qua đúng bộ chuẩn hoá của các nguồn khác (lương, cấp bậc, tỉnh, quận,
  // lịch thứ Bảy), rồi nằm chung một danh sách, chịu chung một bộ lọc ngành,
  // và vào chung thống kê. Một tin thu mua ở nhóm Facebook không khác gì một
  // tin thu mua ở CareerViet về mặt câu hỏi người dùng đang hỏi.

  {
    code: 'fb-tay',
    name: 'Facebook (dán tay)',
    homeUrl: 'https://www.facebook.com',
    kind: SourceKind.MANUAL,
    entryUrl: null,
    jobUrlPattern: null,
    // Thấp nhất: tin nhóm Facebook thường thiếu trường và không kiểm lại được.
    // Khi trùng với một tin ở sàn chính thì để sàn chính làm bản đại diện.
    priority: 90,
    quirks: {
      // Máy kiểm KHÔNG được gọi HTTP vào nguồn này — robots.txt đã cấm.
      // Tin nhập tay sống bằng hạn `--ngay` mà người nhập tự khai. Xem ingest.ts.
      livenessProbe: 'none',
    },
    note:
      'NGUỒN NHẬP TAY, không cào. Lý do đầy đủ ở REJECTED_SOURCES mục ' +
      '"Facebook (nhóm tuyển dụng)": robots.txt của họ là danh sách trắng, ' +
      'user-agent * bị Disallow: / và cả ba đường đã thử đều CẤM với UA của ta; ' +
      'thêm nữa phần lớn nhóm tuyển dụng thu mua là nhóm KÍN. ' +
      'Cách dùng: đọc bài trong nhóm bằng tài khoản của chính mình, sao chép ' +
      'nội dung ra một file .txt rồi chạy ' +
      '`npm run ingest -- --source fb-tay --url <permalink> --file bai.txt`. ' +
      'Tin đi qua đúng bộ chuẩn hoá của các nguồn khác. ' +
      'HẠN CHẾ, phải nói thẳng: không có validThrough nên không biết tin còn ' +
      'hay hết, và máy kiểm không được phép dò vào đây. Mặc định ingest đặt hạn ' +
      '30 ngày kể từ ngày đăng — một PHỎNG ĐOÁN, không phải sự thật từ nguồn.',
  },
  {
    code: 'li-tay',
    name: 'LinkedIn (dán tay)',
    homeUrl: 'https://www.linkedin.com',
    kind: SourceKind.MANUAL,
    entryUrl: null,
    jobUrlPattern: null,
    // Trên Facebook một bậc: tin LinkedIn có cấu trúc hơn, thường ghi rõ tên
    // công ty, chức danh và nơi làm.
    priority: 85,
    quirks: { livenessProbe: 'none' },
    note:
      'NGUỒN NHẬP TAY, không cào. robots.txt của LinkedIn CẤM cả ba đường đã ' +
      'thử với UA thật của ta (xem REJECTED_SOURCES), và điều khoản dịch vụ ' +
      'cũng cấm — đây là lời từ chối, không phải rào kỹ thuật. ' +
      'Cách dùng: mở tin bằng tài khoản của chính mình rồi ' +
      '`npm run ingest -- --source li-tay --url <link tin> --file tin.txt`. ' +
      'MẸO: tin LinkedIn dán ra text thường giữ nguyên các dòng "Chức danh · ' +
      'Công ty · Địa điểm" ở đầu, nên `--title` và `--company` hay đoán đúng ' +
      'mà không phải gõ tay — cứ chạy thử rồi xem bản tóm tắt trước khi ghi.',
  },
];

/**
 * Nguồn đã kiểm và quyết định KHÔNG dùng. Ghi lại để sáu tháng nữa không ai
 * mất một ngày đi kiểm lại và rút ra đúng kết luận cũ.
 */
export const REJECTED_SOURCES: readonly { name: string; reason: string }[] = [
  { name: 'Indeed VN', reason: 'Điều khoản sử dụng cấm cào rõ ràng' },

  // Glints ĐÃ CHUYỂN sang danh sách nguồn (nay là SOURCE_CATALOG) ngày 11/09/2026 — kết luận
  // "không có JSON-LD" là đọc nhầm trang tường lửa. Xem note của nguồn `glints`.

  // ── Khảo sát 09/09/2026, đo bằng Node fetch với đúng User-Agent của ta ─────
  {
    name: 'mywork.com.vn',
    reason:
      'ĐO 09/09: robots.txt CHO PHÉP (Allow: / cho *) nhưng /sitemap.xml trả HTTP ' +
      '200 với 1,26 MB HTML của ứng dụng Next.js chứ không phải XML. ' +
      'ĐO LẠI 11/09/2026 — LÝ DO LOẠI ĐÃ ĐỔI VÀ NAY NẶNG HƠN: robots.txt hiện ' +
      'cấm ĐÍCH DANH ClaudeBot, anthropic-ai, GPTBot, CCBot, Google-Extended, ' +
      'Bytespider và meta-externalagent bằng Disallow: /. Trước là "không cào ' +
      'được", giờ là "họ đã nói không". Đừng đi tìm đường vòng qua list-jsonld ' +
      'nữa — chuyện kỹ thuật không còn là chuyện đang bàn.',
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

  // ── Khảo sát 11/09/2026 ────────────────────────────────────────────────────
  //
  // Mọi kết luận dưới đây đo bằng ĐÚNG User-Agent thật của ta, và câu hỏi
  // "có được phép không" trả lời bằng chính `robots-parser` mà crawler dùng —
  // nên kết luận ở đây bằng đúng hành vi lúc chạy, không phải phỏng đoán.
  {
    name: 'JobsGO',
    reason:
      'ĐO LẠI 11/09/2026, lý do loại ĐÃ ĐỔI. Chuyện 403 cũ chỉ là dấu vân tay ' +
      'TLS: robots.txt CHO PHÉP cả sitemap lẫn trang tin, và curl lấy được ' +
      'sitemap_index.xml (HTTP 200) trong khi Node fetch vẫn 403 — đúng ca của ' +
      'cờ `useCurl` như TopCV/Glints. Nhưng lý do THẬT để không dùng nằm chỗ ' +
      'khác: sàn này KHÔNG có sitemap tin nào. Index chỉ có post-sitemap1..6 ' +
      '(blog WordPress — kiểm file 1: 983 URL, toàn /blog/), category-sitemap và ' +
      'post_tag-sitemap; các file khai riêng trong robots (sitemap-job-type.xml ' +
      '1 URL, sitemap-job-place.xml 7 URL) chỉ chứa trang DANH MỤC. ' +
      'Muốn lấy tin phải đi qua trang danh sách (viec-lam-thu-mua.html trả 200, ' +
      '452 KB) — tức phải viết adapter list-jsonld, thứ chưa tồn tại. ' +
      'ĐÁNG LÀM SAU: URL danh mục của họ trùng khít với ngành đang nhắm, nên khi ' +
      'nào có list-jsonld thì đây là ứng viên đầu tiên.',
  },
  {
    name: 'LinkedIn',
    reason:
      'ĐO LẠI 11/09/2026, kết luận cũ ("reCAPTCHA ở robots.txt") vẫn đúng chiều ' +
      'nhưng nay có bằng chứng thẳng hơn: hỏi robots-parser với UA thật của ta, ' +
      'cả ba đường đều trả CẤM — /jobs/view/<id>, /jobs/search/, và cả endpoint ' +
      'khách /jobs-guest/jobs/api/seeMoreJobPostings/search. Không có lối vào ' +
      'nào mà robots.txt của họ chừa lại. ' +
      'Điều khoản dịch vụ của LinkedIn cũng cấm cào, và API Job Posting chỉ mở ' +
      'cho đối tác đã ký. Nói cách khác đây KHÔNG phải rào kỹ thuật để tìm cách ' +
      'vượt, mà là lời từ chối. ' +
      'ĐƯỜNG SẠCH ĐÃ DỰNG: nguồn `linkedin-tay` trong SOURCE_SEEDS — người dùng ' +
      'tự dán tin mình đọc được vào bằng `npm run ingest`. Không request nào ' +
      'của máy đi tới linkedin.com.',
  },
  {
    name: 'Facebook (nhóm tuyển dụng)',
    reason:
      'ĐO 11/09/2026. Facebook CÓ công bố sitemap bài viết nhóm công khai ' +
      '(hàng trăm file groups_*_posts_*.xml.gz khai ngay trong robots.txt), nên ' +
      'thoạt nhìn tưởng cào được. Hỏi robots-parser với UA thật của ta thì CẤM ' +
      'cả ba: /groups/<id>/posts/<id>/, chính các file sitemap ấy, và /<page>/posts/. ' +
      'robots.txt của Facebook là danh sách TRẮNG — chỉ vài bot có tên mới được ' +
      'vào, còn user-agent * bị Disallow: /. Sitemap công bố cho nhóm bot đó, ' +
      'không phải cho ta. ' +
      'Thêm nữa phần lớn nhóm tuyển dụng thu mua là nhóm KÍN, tức nội dung sau ' +
      'đăng nhập — đọc bằng máy là dùng phiên của người dùng, chuyện khác hẳn. ' +
      'ĐƯỜNG SẠCH ĐÃ DỰNG: nguồn `facebook-tay` + `npm run ingest`, xem dưới.',
  },
  {
    name: 'Recruitery',
    reason: 'robots.txt vỏn vẹn 28 byte: "User-agent: * / Disallow: /". Cấm toàn bộ.',
  },
  {
    name: 'viecoi.vn',
    reason: 'robots.txt trả HTTP 403 (5,6 KB trang chặn) — không đọc được cả luật chơi.',
  },
  {
    name: 'timviecnhanh.com',
    reason:
      '/robots.txt trả HTTP 200 nhưng nội dung là 1,26 MB HTML chứ không phải ' +
      'text/plain — route bắt-tất-cả, không có robots.txt thật.',
  },
  {
    name: 'tuyendung.com.vn / JobOKO (đo lại)',
    reason:
      'robots.txt CHO PHÉP nhưng /sitemap.xml trả 404 ở cả hai (11/09/2026). ' +
      'Không có đường khám phá nào ngoài trang danh sách.',
  },
  {
    name: 'talentbold.com',
    reason:
      'Bắt tay TLS thất bại ngay: "dh key too small" — máy chủ còn dùng tham số ' +
      'Diffie-Hellman yếu mà OpenSSL hiện đại từ chối. Không phải họ chặn ta, ' +
      'là hạ tầng của họ quá cũ. Hạ mức bảo mật của client để vào thì KHÔNG.',
  },
  {
    name: 'vieclamvietnam.gov.vn',
    reason: 'DNS không phân giải được (ENOTFOUND) 11/09/2026 — tên miền có thể đã đổi.',
  },
];
