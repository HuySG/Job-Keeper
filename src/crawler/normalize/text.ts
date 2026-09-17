/**
 * Chuẩn hoá chuỗi — nền của cả khử trùng lặp lẫn tìm kiếm.
 *
 * Tiếng Việt có hai chuẩn Unicode cho cùng một chữ: dựng sẵn (NFC, "ế" là một
 * code point) và tổ hợp (NFD, "ế" là "e" + hai dấu). Hai chuỗi trông y hệt nhau
 * trên màn hình có thể khác nhau từng byte. Không NFC hoá trước là khử trùng
 * lặp sẽ bỏ sót một cách bí ẩn và không ai tìm ra tại sao.
 */

/** Đưa về NFC + gộp khoảng trắng. Luôn gọi cái này trước mọi so sánh. */
export function normalizeWhitespace(input: string): string {
  return input.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * Bỏ dấu tiếng Việt. Dùng cho khoá so khớp và cho FTS.
 *
 * Xử lý riêng đ/Đ vì nó KHÔNG phải "d + dấu" trong Unicode — nó là một chữ cái
 * riêng, nên NFD không tách được. Quên nó là "Đà Nẵng" không khớp "da nang".
 */
export function removeDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Khoá so khớp: bỏ dấu, thường hoá, chỉ giữ chữ và số. */
export function toMatchKey(input: string): string {
  return removeDiacritics(normalizeWhitespace(input))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Tên công nghệ mà `toMatchKey` sẽ phá: dấu chấm, `#`, `+` mang nghĩa.
 * Thay TRƯỚC khi bỏ ký tự. Thứ tự có nghĩa: dạng dài trước dạng ngắn.
 */
const TECH_REPLACEMENTS: readonly [RegExp, string][] = [
  // "ASP.NET", "VB.NET", "ADO.NET" — vẫn là .NET, giữ cả tên riêng.
  [/\b(asp|vb|ado)\.net\b/gi, ' $1net dotnet '],
  // ".NET" đứng sau ký tự KHÔNG phải chữ/số: "Sr .NET", "C#/.Net", "(.NET".
  // Sau chữ/số thì là tên miền ("example.net") — không đụng.
  [/(^|[^a-z0-9])\.net\b/gi, '$1 dotnet '],
  [/\bc#/gi, ' csharp '],
  [/\bf#/gi, ' fsharp '],
  [/\bc\+\+/gi, ' cpp '],
  // React Native là mobile, KHÔNG phải React web — gộp thành một từ để kỹ năng
  // "react" (khớp hai đầu) không bắt nhầm.
  [/\breact[\s-]*native\b/gi, ' reactnative '],
  [/\breact\.?js\b/gi, ' reactjs react '],
  [/\bnode\.?js\b/gi, ' nodejs '],
  [/\bnext\.?js\b/gi, ' nextjs '],
  [/\bnest\.?js\b/gi, ' nestjs '],
  [/\bvue\.?js\b/gi, ' vuejs vue '],
  [/\bthree\.?js\b/gi, ' threejs '],
  [/\bci\s*\/\s*cd\b/gi, ' cicd '],
];

/**
 * Khoá so khớp cho nghề LẬP TRÌNH — như `toMatchKey`, nhưng giữ nghĩa của tên
 * công nghệ: ".NET" → "dotnet", "C#" → "csharp", "C++" → "cpp".
 *
 * `toMatchKey` xoá mọi ký tự không phải chữ/số, nên ".NET Developer" thành
 * "net developer" (và `\bnet` khớp cả "network"), còn "C# Developer" thành
 * "c developer". Cùng họ với bài học "dược/được": khoá đã bỏ ký tự thì mất
 * nghĩa. Chuỗi không có tên công nghệ nào thì ra y hệt `toMatchKey` — từ điển
 * thu mua dùng hàm nào cũng vậy, nhưng vẫn giữ `toMatchKey` để khỏi phải chứng
 * minh điều đó mỗi lần. Xem docs/plan-swe.md §4.3.
 */
export function toTechKey(input: string): string {
  let text = input;
  for (const [pattern, replacement] of TECH_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return toMatchKey(text);
}

/** Slug dùng cho URL và cho cột slug trong DB. */
export function toSlug(input: string): string {
  return toMatchKey(input).replace(/\s+/g, '-').slice(0, 120) || 'khong-ten';
}

/**
 * Tiền tố loại hình doanh nghiệp — phải bỏ trước khi so khớp công ty.
 *
 * "Công ty TNHH ABC", "CTY CP ABC" và "ABC" là cùng một pháp nhân. Không gộp
 * thì thống kê "công ty tuyển nhiều nhất" chia năm xẻ bảy thành vô nghĩa.
 * Danh sách xếp DÀI TRƯỚC NGẮN vì thay thế theo thứ tự: để "cong ty tnhh mtv"
 * bị bắt trước khi "cong ty" kịp cắt mất phần đuôi.
 */
const COMPANY_PREFIXES = [
  'cong ty tnhh mtv',
  'cong ty tnhh mot thanh vien',
  'cong ty tnhh thuong mai dich vu',
  'cong ty tnhh san xuat thuong mai',
  'cong ty co phan tap doan',
  'cong ty co phan',
  'cong ty tnhh',
  'cong ty lien doanh',
  'tong cong ty',
  'tap doan',
  'cong ty',
  'cty cp',
  'cty tnhh',
  'cty',
  'ct tnhh',
  'chi nhanh',
  'van phong dai dien',
] as const;

const COMPANY_SUFFIXES = [
  'viet nam',
  'vietnam',
  'vn',
  'group',
  'corporation',
  'corp',
  'company limited',
  'co ltd',
  'ltd',
  'jsc',
  'inc',
] as const;

/**
 * Khoá gộp công ty. KHÔNG dùng để hiển thị — tên hiển thị giữ nguyên bản gốc
 * của nguồn có priority tốt nhất.
 */
export function normalizeCompanyName(input: string): string {
  let key = toMatchKey(input);

  for (const prefix of COMPANY_PREFIXES) {
    if (key.startsWith(prefix + ' ')) {
      key = key.slice(prefix.length + 1);
      break; // chỉ cắt MỘT tiền tố, "cong ty cong nghe" không được thành "nghe"
    }
  }

  for (const suffix of COMPANY_SUFFIXES) {
    if (key.endsWith(' ' + suffix)) {
      key = key.slice(0, -(suffix.length + 1));
      break;
    }
  }

  return key.trim() || toMatchKey(input);
}

/**
 * Nhiễu trong tiêu đề tin: lời chào mời, mức lương nhét vào tên, địa điểm.
 * Phải bỏ trước khi so khớp, nếu không cùng một việc ở hai sàn sẽ không gộp
 * được chỉ vì một bên viết thêm "Lương Upto 60tr".
 */
const TITLE_NOISE_PATTERNS: readonly RegExp[] = [
  /\[[^\]]*\]/g, // [HN], [Gấp], [Tuyển gấp]
  /\([^)]*\)/g, // (Hà Nội), (Upto 2000$)
  /\b(luong|salary)\s*(upto|up to|len den|toi)?\s*[\d.,]+\s*(tr|trieu|k|m|usd|\$)?\b/gi,
  /\b(upto|up to)\s*[\d.,]+\s*(tr|trieu|k|m|usd|\$)?\b/gi,
  /\b(tuyen gap|gap|hot|urgent|di lam ngay|khong yeu cau kinh nghiem)\b/gi,
  /\b(thu nhap|income)\s*[\d.,]+\s*(tr|trieu|k|m)?\b/gi,
  /[–—-]{1,2}\s*$/,
];

/** Tiêu đề đã chuẩn hoá, dùng cho `titleNorm` và cho fingerprint gộp trùng. */
export function normalizeTitle(input: string): string {
  let text = removeDiacritics(normalizeWhitespace(input)).toLowerCase();
  for (const pattern of TITLE_NOISE_PATTERNS) text = text.replace(pattern, ' ');
  return text
    .replace(/[^a-z0-9+#./ ]+/g, ' ') // giữ + # . / cho "c++", "c#", ".net", "ui/ux"
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tước thẻ HTML thành văn bản thuần.
 *
 * Cố ý KHÔNG dùng cheerio ở đây: hàm này chạy cho mọi tin, và dựng cả DOM chỉ
 * để lấy text là lãng phí lớn khi trang nặng tới 828 KB.
 */
export function htmlToText(html: string): string {
  return normalizeWhitespace(
    html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n'),
  );
}

/**
 * Cắt URL về dạng chuẩn tắc.
 *
 * TopCV gắn ?ta_source=JobSearchList_LinkDetail&u_sr_id=... vào MỌI link ở
 * trang danh sách. Không cắt thì mỗi lần crawl đẻ ra một URL "mới" và trùng lặp
 * vô hạn — đây là cái bẫy tốn kém nhất phát hiện được khi khảo sát (PLAN.md §2).
 */
export function canonicalizeUrl(input: string): string {
  const url = new URL(input);
  url.hash = '';
  url.search = ''; // cắt sạch: chưa gặp nguồn nào cần query để định danh tin
  url.protocol = 'https:';
  url.hostname = url.hostname.toLowerCase();
  // Bỏ dấu / thừa ở cuối, trừ khi đường dẫn chỉ là "/"
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

/** Cắt chuỗi theo BYTE để vừa hạn mức cột, không cắt giữa một ký tự UTF-8. */
export function truncateBytes(input: string, maxBytes: number): string {
  const buf = Buffer.from(input, 'utf8');
  if (buf.byteLength <= maxBytes) return input;
  // Lùi dần tới ranh giới ký tự hợp lệ
  let end = maxBytes;
  while (end > 0 && (buf[end]! & 0xc0) === 0x80) end -= 1;
  return buf.subarray(0, end).toString('utf8');
}
