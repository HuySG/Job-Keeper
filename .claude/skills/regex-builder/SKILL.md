---
name: regex-builder
description: Dựng, giải thích và kiểm thử biểu thức chính quy trên chuỗi thật. Dùng khi viết hoặc sửa regex đọc lương, cấp bậc, số năm kinh nghiệm, tên tỉnh thành, gộp tên công ty, lọc URL sitemap, hoặc khi cần giải thích một pattern khó hiểu có sẵn. Regex, regular expression, pattern matching, salary parsing, sitemapUrlPattern.
---

# Dựng regex

Regex ở đây không phải tiện ích chung chung — nó là lõi chuẩn hoá dữ liệu tuyển
dụng viết tự do bằng tiếng Việt. Sai một ký tự là mọi thống kê `SalaryStat` sai
mà **không có gì báo lỗi**.

## Luật vàng của module lương

[salary.ts](src/crawler/normalize/salary.ts) ghi rõ, và mọi pattern mới phải tuân theo:

```
KHÔNG ĐỌC ĐƯỢC SỐ  →  isPublic = false
KHÔNG BAO GIỜ      →  min = 0
```

Regex không khớp là chuyện bình thường và **đúng**. Regex khớp bừa để "có số cho
đủ" là hỏng lặng lẽ — biểu đồ vẫn vẽ, chỉ là sai. Khi phân vân giữa pattern rộng
và pattern hẹp, **chọn hẹp**.

## Quy trình

1. **Đọc pattern đang có trước.** `normalize/salary.ts`, `level.ts`,
   `location.ts`, `text.ts`, và `sitemapUrlPattern` trong
   [constants/source](src/constants/source/index.ts). Rất có thể cái bạn cần đã
   tồn tại — sửa nó tốt hơn là đẻ thêm một cái gần giống.
2. **Thu chuỗi thật, không bịa.** Lấy từ `tests/fixtures/*.json` hoặc chạy
   `npm run probe -- --source <code> --limit 5` để xem sàn thật viết kiểu gì.
   Regex dựa trên ví dụ tưởng tượng sẽ vỡ ngay khi gặp tin thật.
3. **Lập hai danh sách trước khi viết pattern:** chuỗi PHẢI khớp và chuỗi PHẢI
   KHÔNG khớp. Danh sách thứ hai quan trọng hơn.
4. **Viết pattern, giải thích từng phần** bằng lời thường.
5. **Chạy thử thật**, đừng suy luận trong đầu:
   ```bash
   npx tsx -e 'const re=/.../; for (const s of ["...","..."]) console.log(JSON.stringify(s), re.exec(s))'
   ```
6. **Chốt bằng test** trong `tests/salary.test.ts` / `normalize.test.ts` /
   `sitemap.test.ts`, rồi `npm test`.

## Bẫy đặc thù của dữ liệu tuyển dụng Việt Nam

### Lương
- **Đơn vị chữ:** `15 triệu`, `15tr`, `15 tr`, `15.000.000`, `15,000,000`
- **Khoảng:** `15-20 triệu`, `15 – 20 triệu`, `từ 15 đến 20 triệu`, `trên 20 triệu`, `tới 20 triệu`
- **Đơn vị chỉ ghi một lần:** `15-20 triệu` — số `15` cũng là triệu, đừng đọc thành 15 đồng
- **Ngoại tệ:** `$2000-3000`, `2000 USD`, `USD 2,000`, `2000$` — giữ `currency` GỐC, ghi `fxRate` và `fxRateDate` để truy vết
- **Chu kỳ khác tháng:** `/giờ`, `/ngày`, `/năm`, `per year` — giữ `period` GỐC rồi mới quy đổi
- **Không phải lương:** `thoả thuận`, `thương lượng`, `cạnh tranh`, `negotiable`, `up to 3 tháng lương thưởng`, `phụ cấp 2 triệu` — phải KHÔNG khớp
- **Số ngoài khoảng hợp lý:** so với `SALARY_VND_MONTH_MIN`/`MAX`, ngoài khoảng thì bật `outOfRange` → `PARTIAL`, đừng lặng lẽ nhận

### Địa điểm
- **34 tỉnh/thành sau sáp nhập 2025, cộng bí danh tên CŨ.** Đây là logic tra bảng
  (`LocationAlias`), **không phải regex**. Đừng viết pattern đoán tên tỉnh — nối
  vào bảng bí danh đã seed.
- Dấu tiếng Việt: đi qua `removeDiacritics`/`normalizeWhitespace` trong `text.ts`
  rồi mới so, đừng regex thẳng trên chuỗi có dấu
- Chuẩn hoá NFC trước: `Hồ` tổ hợp sẵn và `Hồ` tổ hợp rời trông giống hệt nhau

### Cấp bậc và kinh nghiệm
- `Senior`, `Sr.`, `Chuyên viên cao cấp`, `Trưởng nhóm`, `Fresher`, `Thực tập sinh`
- `2-3 năm kinh nghiệm`, `ít nhất 2 năm`, `2+ years`, `không yêu cầu kinh nghiệm`
- Bẫy: `Senior` trong `Senior Java Developer` là cấp bậc; trong tên công ty thì không

### URL sitemap (`sitemapUrlPattern`)
- Đây là chỗ pattern sai gây hậu quả **đắt nhất** — lọc sai là tải nhầm file 17 MB
- ITviec: file tin nằm CUỐI trong 13 file, bốn file đầu là danh mục công ty nặng
- TopDev: sitemap index có 257 file `_en` + 257 file `_vi` chứa **cùng** tập tin —
  pattern phải chọn đúng một nhánh, nếu không crawl gấp đôi vô ích
- Luôn thử pattern bằng `npm run probe` trước khi crawl thật

## Khi giải thích một regex có sẵn

- Tách thành từng phần có chú thích
- Chỉ ra nhóm bắt nào ứng với cái gì
- Nêu vấn đề tiềm ẩn: thiếu neo `^`/`$`, dấu chấm chưa escape, `.*` tham lam,
  nguy cơ backtracking bùng nổ trên mô tả công việc dài hàng chục KB
- Đề xuất bản đơn giản hơn nếu pattern phức tạp quá mức

## Nguyên tắc

- **Neo và giới hạn.** `\d{1,3}` nói rõ ý hơn `\d+` và chặn được rác.
- **Nhóm có tên:** `(?<min>\d+)\s*[-–]\s*(?<max>\d+)` dễ đọc hơn `$1`/`$2`.
- **Regex to nên tách nhỏ.** Một pattern làm ba việc là pattern không ai sửa nổi.
- **Đừng parse HTML bằng regex** — đã có cheerio, và tin thì đã có JSON-LD.
- **Cờ `g` có trạng thái.** `RegExp` với `/g` giữ `lastIndex` giữa các lần
  `.test()`; đừng dùng lại một object `/g` cho nhiều chuỗi.
- **Cẩn thận backtracking trên văn bản dài.** Mô tả công việc có thể vài chục KB;
  pattern lồng định lượng như `(\w+\s*)+` có thể treo cả tiến trình.
