---
name: systematic-debugging
description: Quy trình gỡ lỗi bốn pha — tìm nguyên nhân gốc trước, cấm sửa mò. Dùng cho mọi trục trặc - test đỏ, probe không ra tin, sitemap rỗng, lương chuẩn hoá sai, tin bị đóng nhầm, nguồn trả 403/429, blob không đọc được, build hoặc typecheck fail. Systematic debugging, root cause analysis, crawler bug, parser regression.
---

# Gỡ lỗi có hệ thống

Sửa mò tốn thời gian và đẻ ra lỗi mới. Vá triệu chứng che mất bệnh thật.

**Nguyên tắc lõi:** LUÔN tìm ra nguyên nhân gốc trước khi đề xuất bất kỳ bản sửa nào.

## Luật sắt

```
KHÔNG SỬA GÌ TRƯỚC KHI ĐIỀU TRA XONG NGUYÊN NHÂN GỐC
```

Chưa xong Pha 1 thì không được đề xuất cách sửa.

## Luật sắt thứ hai — riêng cho dự án này

```
NGUỒN CHẶN KHÔNG PHẢI LÀ LỖI CẦN SỬA
```

Khi điều tra dẫn tới "sàn này chặn mình", điều tra đã **xong**. Kết luận đúng là
tắt nguồn và ghi lại vì sao — như đã làm với TopCV (chặn ở tầng dấu vân tay TLS).
Không được để việc gỡ lỗi trượt thành né tránh phát hiện:

- Không nguỵ trang dấu vân tay TLS/JA3 thành trình duyệt
- Không dùng trình duyệt headless để lách tầng biên đã nói không
- Không đổi User-Agent thành Chrome để qua mặt
- Không xoay IP, không đổi proxy để tránh 429
- Không hạ ngưỡng trong [src/constants/crawl](src/constants/crawl/index.ts) cho "chạy nhanh hơn"

Quy tắc trong `constants/crawl` là **cài cứng, không phải tuỳ chọn**. Nếu một bản
sửa đòi nới quy tắc đó, bản sửa sai chứ không phải quy tắc.

## Bốn pha

### Pha 1 — Điều tra nguyên nhân gốc

1. **Đọc kỹ thông báo lỗi.** Đọc hết stack trace, ghi số dòng, đường dẫn, mã HTTP.

2. **Tái hiện cho chắc — bằng công cụ rẻ nhất trước.** Thứ tự từ rẻ đến đắt:

   ```bash
   npm test                                   # 101 test trên fixture JSON-LD thật, không mạng
   npm run typecheck                          # tsc --noEmit
   npm run reparse -- --failed --dry          # tính lại từ blob đã lưu, KHÔNG gọi mạng
   npm run probe -- --source vnw --limit 3    # chạm mạng thật, KHÔNG đụng DB
   npm run crawl -- --source vnw --dry        # đủ pipeline, không ghi DB
   ```

   **Đừng bao giờ bắt đầu bằng `npm run crawl` thật.** Mỗi lần chạy là gõ cửa sàn
   thật, mà quy tắc nghỉ 2 giây/host nghĩa là mỗi vòng lặp gỡ lỗi tốn hàng phút.
   `probe` và `reparse` tồn tại chính là để không phải làm thế.

3. **Soát thay đổi gần đây.** `git diff`, dependency mới, đổi config, khác biệt
   môi trường (có `DATABASE_URL` chưa, blob đang ở R2 hay `.blobs/` trên đĩa).

4. **Thu chứng cứ theo từng tầng.** Pipeline nối nhau như sau:

   ```
   DISCOVER  →  FETCH  →  NORMALIZE  →  UPSERT  →  REAP  →  LOG
   (sitemap)   (fetcher)  (jsonld +    (Prisma)  (đóng   (CrawlRun)
                           salary/       tin đã
                           level/loc)    biến mất)
   ```

   Trước khi đề xuất sửa, xác định nó gãy ở **tầng nào**:

   | Triệu chứng | Tầng nghi trước tiên | Kiểm bằng |
   |---|---|---|
   | Không ra URL nào | DISCOVER | `probe` — sitemap index có lồng nhau không, `sitemapUrlPattern` có lọc nhầm không |
   | Ra URL nhưng không ra tin | FETCH hoặc jsonld | `probe --limit 2`, xem trang có nhúng `JobPosting` không |
   | Ra tin nhưng thiếu trường | NORMALIZE | `reparse --dry` trên blob đã lưu |
   | Lương/địa điểm sai | `normalize/salary.ts`, `location.ts` | test đơn vị, đừng crawl lại |
   | Tin trùng lặp | UPSERT — `@@unique([sourceId, externalId])` | truy vấn DB |
   | Tin còn sống bị đóng | REAP | **REAP chỉ được chạy sau `--full`** — kiểm xem có phải quét tăng dần mà vẫn reap không |
   | 403 / 429 / 503 | FETCH | Xem Luật sắt thứ hai. Đây có thể **không phải lỗi** |

   Chạy **một lần** để lấy chứng cứ chỉ ra tầng hỏng, RỒI mới đào sâu tầng đó.

5. **Lần theo dòng dữ liệu.** Trường sai đó sinh ra từ đâu? Lần ngược lên tới
   nguồn. Sửa ở nguồn, không sửa chỗ triệu chứng lộ ra.

### Pha 2 — Phân tích mẫu

1. **Tìm ví dụ đang chạy đúng.** Sáu nguồn đi qua **cùng một** bộ bóc
   [jsonld.ts](src/crawler/jsonld.ts) và **cùng một** adapter
   [generic-jsonld.ts](src/crawler/sources/generic-jsonld.ts). Nếu 3 sàn parse
   đúng mà 1 sàn sai, khác biệt nằm ở dữ liệu sàn đó hoặc ở cấu hình `Source`,
   **gần như chắc chắn không nằm ở bộ bóc dùng chung**.
2. **Đối chiếu đầy đủ.** Đọc hết JSON-LD thật của sàn hỏng, so với fixture của
   sàn chạy được trong `tests/fixtures/`.
3. **Liệt kê mọi khác biệt.** Đừng tự nhủ "cái đó chắc không liên quan".

**Cảnh báo kiến trúc:** nếu bản sửa của bạn là "thêm một adapter riêng cho sàn
này", hãy dừng lại. README nói rõ: *nếu số adapter tăng cùng nhịp với số nguồn
thì kiến trúc đã sai ở đâu đó*. Thêm nguồn lý tưởng là INSERT một dòng vào bảng
`Source`. Hỏi người dùng trước khi phá tính chất đó.

### Pha 3 — Giả thuyết và kiểm chứng

1. **Nêu MỘT giả thuyết**, viết ra rõ ràng: "Tôi cho rằng X là nguyên nhân, vì Y."
2. **Thử ở mức nhỏ nhất.** Một biến một lúc.
3. **Xác nhận rồi mới đi tiếp.** Sai → giả thuyết MỚI, đừng chồng vá lên vá.
4. **Không biết thì nói không biết.**

### Pha 4 — Sửa

1. **Viết test đỏ trước.** Lưu JSON-LD thật vào `tests/fixtures/` rồi thêm case
   vào `tests/jsonld.test.ts` / `salary.test.ts` / `normalize.test.ts` /
   `sitemap.test.ts`. Phải đỏ TRƯỚC khi sửa.
2. **Sửa đúng một chỗ.** Không tiện tay dọn thêm.
3. **Kiểm chứng:** `npm test` && `npm run typecheck`, rồi `npm run reparse --dry`
   để xem toàn bộ lịch sử tính lại có sạch không.
4. **Sửa không ăn thua:** DỪNG. Dưới 3 lần → quay lại Pha 1. **Từ 3 lần trở lên
   → dừng hẳn, đặt câu hỏi về kiến trúc**, bàn với người dùng trước khi thử tiếp.

## Cờ đỏ — thấy là quay lại Pha 1

- "Sửa tạm đã, điều tra sau"
- "Cứ đổi thử X xem sao"
- "Chạy `npm run crawl` xem có hết không" (đắt, chậm, gõ cửa sàn thật)
- "Bỏ test, kiểm tra tay cũng được"
- "Chưa hiểu lắm nhưng chắc cách này chạy"
- **"Thử User-Agent khác xem qua được không"** ← dừng, đọc Luật sắt thứ hai
- **"Giảm delay xuống cho nhanh"** ← dừng
- "Thử thêm một lần nữa thôi" (khi đã trượt 2 lần)

## Nguỵ biện thường gặp

| Cái cớ | Sự thật |
|---|---|
| "Lỗi đơn giản, khỏi cần quy trình" | Lỗi đơn giản cũng có nguyên nhân gốc, và quy trình chạy rất nhanh với chúng. |
| "Đang gấp" | Gỡ lỗi có hệ thống NHANH HƠN đoán mò. |
| "Sửa xong rồi viết test" | Bản sửa không có test thì không bền. |
| "Sửa nhiều thứ một lúc cho nhanh" | Không tách được cái nào có tác dụng. |
| "Tôi thấy vấn đề rồi" | Thấy triệu chứng ≠ hiểu nguyên nhân gốc. |
| "Sàn chặn thì phải tìm cách qua" | Không. Tắt nguồn, ghi lý do, đi tiếp. |

## Khi kết luận là "không có nguyên nhân gốc trong code"

Nếu điều tra cho thấy vấn đề nằm ngoài tầm (sàn đổi cấu trúc, sitemap rỗng thật,
tầng biên chặn):

1. Ghi lại đã điều tra những gì và đo được gì — **kèm số liệu thật**, như cách
   README ghi "curl 200 (9/9), Node fetch 403 (6/6)"
2. Xử lý cho đúng: tắt nguồn, đánh dấu trạng thái, ghi `CrawlRun`
3. Giữ nguyên cấu hình đã kiểm đúng để bật lại được

**Nhưng:** phần lớn ca "không tìm ra nguyên nhân" là điều tra chưa tới.
