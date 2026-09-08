# Bae-Job

Thu thập tin tuyển dụng từ nhiều nguồn, **đảm bảo tin còn hiệu lực**, thống kê
theo **ngành nghề do người dùng tự định nghĩa**.

Thiết kế và toàn bộ căn cứ nằm ở [PLAN.md](PLAN.md) và [TECHSTACK.md](TECHSTACK.md).
README này chỉ nói cách chạy.

> **Trạng thái: lõi crawler đã xong, bảng điều khiển web đã chạy.**
> Chặng 0–2 theo [TECHSTACK.md §9](TECHSTACK.md). Xem [§ Đã có gì](#đã-có-gì).

---

## Chạy thử trong 2 phút, không cần CSDL

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
#  -> sửa CRAWLER_CONTACT_EMAIL thành email thật của bạn

npm run probe -- --source vnw --limit 3
npm run probe -- --source topdev --limit 2
```

`probe` chạy **thật** vào sàn thật — đi hết chuỗi robots.txt → sitemap →
JSON-LD → chuẩn hoá — rồi in ra thứ parser đọc được, **không đụng vào CSDL**.
Đây là công cụ dùng nhiều nhất khi thêm nguồn mới.

Kết quả thật đo được:

```
┌─ TopDev (topdev) · sitemap-jsonld
  · sitemap: 2 file, 6 URL job
  ✓ Nhân Viên Giám Sát CCTV
    công ty   CÔNG TY TNHH TAIXIN PRINTING VINA  [taixin-printing-vina]
    lương     thoả thuận
    nơi làm   Bắc Ninh   ONSITE
    hiệu lực  2026-08-23 → 2026-09-03
```

---

## Chạy đầy đủ (cần PostgreSQL)

Cần một Postgres. Tạo miễn phí ở [neon.tech](https://neon.tech) rồi dán chuỗi
**pooled** vào `DATABASE_URL`.

```bash
npm run db:push       # tạo bảng
npm run db:seed       # nạp 6 nguồn + 34 tỉnh/thành + bí danh tên cũ
npm run crawl -- --source vnw --limit 200
```

> **Bắt buộc Postgres, không chạy được SQLite.** Cần `pg_trgm` để khử trùng
> lặp, `unaccent` cho tìm kiếm tiếng Việt, `pgvector` cho tìm theo ngành nghề.
> Xem [TECHSTACK.md §6](TECHSTACK.md).

---

## Bảng điều khiển web

```bash
npm run dev        # http://localhost:3000
```

Bốn màn hình, mỗi màn hình trả lời **đúng một câu hỏi**. Đó là phép thử để nó
không phình ra: thêm một trang mà không viết nổi câu hỏi nó trả lời, hoặc câu
hỏi trùng với trang đã có, thì đó là một khối trong trang cũ chứ không phải một
trang mới.

| Đường dẫn | Trả lời câu |
|---|---|
| `/` **Tổng quan** | Kho tin đang có gì, và có đáng tin không? |
| `/viec` **Kho tin** | Tin nào khớp với thứ tôi đang tìm? |
| `/luong` **Lương** | Mức nào là phổ biến, và bao nhiêu tin dám ghi số? |
| `/nguon` **Nguồn & vận hành** | Crawler còn sống không, nguồn nào đang hỏng? |

Vì sao trang chủ **không** phải là danh sách việc làm: cào job về rồi hiển thị
lại danh sách thì TopCV làm tốt hơn và có sẵn nút ứng tuyển. Thứ đáng đặt lên
trước là thứ **không sàn đơn lẻ nào tính được** — tỷ lệ tin dám ghi lương,
khoảng lương theo cấp bậc gom từ nhiều sàn, và tình trạng sống chết của chính
kho tin ([PLAN.md §1](PLAN.md)).

### Ba ràng buộc kỹ thuật của phần web

**1. Chỉ đọc.** Không có đường nào từ lượt truy cập của người dùng đi ra sàn
nguồn. Mọi thứ ghi vào CSDL đều đi qua crawler, nên trang vẫn chạy bình thường
kể cả khi cả bốn nguồn cùng sập.

**2. Gần như không có JavaScript.** Mỗi trang chỉ nặng thêm **142 B** JS của
riêng nó — toàn bộ biểu đồ, bộ lọc, sắp xếp và phân trang đều dựng sẵn trên máy
chủ. Bộ lọc là `<form method="get">` thuần, nên mỗi trạng thái màn hình là một
URL dán được và đánh dấu trang được. Component phía trình duyệt duy nhất là
danh sách điều hướng, vì "tôi đang ở trang nào" thì không thể chờ JS tải xong.

**3. Biểu đồ tự vẽ, không thư viện.** Thêm một thư viện biểu đồ là kéo theo hàng
trăm KB JS cho vài chục hình chữ nhật, và đánh mất ràng buộc số 2. Phần hình học
nằm ở [src/lib/chart.ts](src/lib/chart.ts), phần vẽ ở
[src/components/charts](src/components/charts/).

### Nói thật, không làm đẹp số

Đây là nguyên tắc chi phối gần như mọi lựa chọn hiển thị:

- Đếm tin **còn hiệu lực**, không đếm tổng số dòng trong bảng. Khoe "5.000 tin"
  trong khi một nửa đã hết hạn là tự nói dối mình.
- Tin đã hết hạn / bị gỡ vẫn **giữ lại và hiện ra** với nhãn đúng, chỉ không
  đếm vào thống kê. Bật `Kể cả tin đã gỡ` ở kho tin để xem.
- Mọi phân vị lương đi kèm **cỡ mẫu**. Nhóm dưới 3 tin ghi lương không được vẽ
  thành khoảng — một tin lẻ không phải một phân bố; nhóm dưới 8 tin vẫn vẽ
  nhưng vẽ nhạt.
- Tin "Thoả thuận" **không bao giờ** bị quy thành 0 đồng. Một số 0 lọt vào là
  mọi trung vị đều sai, và sai theo hướng không ai phát hiện được.
- Độ tươi nói bằng con số thật: *thu thập 1 giờ trước*, *còn thấy trong danh mục
  nguồn 3 giờ trước*. Nguồn không báo cho ta khi họ gỡ tin, nên đó là điều
  trung thực nhất có thể nói ([TECHSTACK.md §4](TECHSTACK.md)).

---

## Toàn bộ lệnh

| Lệnh | Việc |
|---|---|
| `npm run probe -- --source <code>` | **Dò một nguồn, không cần DB.** Thêm `--limit N` |
| `npm run crawl` | Quét tăng dần mọi nguồn đang bật |
| `npm run crawl -- --source topcv,itviec` | Chỉ vài nguồn |
| `npm run crawl -- --full` | Quét đầy đủ — **và chỉ khi đó mới dám đóng tin đã biến mất** |
| `npm run crawl -- --dry` | Không ghi DB, chỉ in ra |
| `npm run reparse` | **Tính lại toàn bộ từ blob đã lưu, không gọi mạng.** `-- --failed --dry` |
| `npm run db:push` / `db:seed` / `db:studio` | Thao tác CSDL |
| `npm test` | 102 test, chạy trên fixture JSON-LD **thật** của 3 sàn |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run dev` | **Bảng điều khiển web** ở http://localhost:3000 |
| `npm run build` / `npm start` | Bản production |

`npm run reparse` là lệnh quan trọng nhất khi bảo trì: mỗi tin được lưu bản
JSON-LD gốc trên blob store, nên sửa parser rồi chạy lệnh này là toàn bộ lịch sử
được tính lại trong vài giây — không phải cào lại sáu nguồn.

---

## Tình trạng 6 nguồn — đã chạy thật 25/08/2026

| Nguồn | Trạng thái | Đo được |
|---|---|---|
| **VietnamWorks** | ✅ chạy | 1 request → 50 tin đầy đủ |
| **TopDev** | ✅ chạy | 5 request, 9,4s. Cần `sitemapUrlPattern` — index có 257 file `_en` + 257 file `_vi` chứa **cùng** tập tin |
| **ITviec** | ✅ chạy | 847 URL ở `jobs_desc_en`. **Bắt buộc** `sitemapUrlPattern`: file tin nằm cuối trong 13 file, bốn file đầu là danh mục công ty nặng 17 MB |
| **vieclam24h** | ✅ chạy | `daily/job-0.xml` → `job/tintuyendung-N.xml` |
| **TopCV** | ⛔ tắt | **Chặn ở tầng dấu vân tay TLS.** Xem bên dưới |
| **CareerViet** | ⛔ tắt | Không có sitemap dùng được: `/sitemap.xml` 404 kèm 1,2 MB body; `/sitemap/sitemap-index.xml` trả 200 nhưng **rỗng 0 byte**; robots.txt không khai sitemap nào |

### TopCV — cần anh quyết

Cùng một URL, cùng User-Agent, cùng headers:

| | Kết quả |
|---|---|
| `curl` | **200** (9/9 lần) |
| Node `fetch` | **403** (6/6 lần, kể cả với UA trình duyệt) |

Ép `--http1.1` không đổi kết quả → không phải phiên bản giao thức, mà là **dấu
vân tay TLS (JA3/JA4)** của `undici` bị Cloudflare xếp loại bot.

Điều đáng nói: **robots.txt của TopCV CHO PHÉP** mọi trang việc làm (chỉ chặn khu
vực CV/hồ sơ). Chính sách công bố thì đồng ý, chỉ tầng biên chặn.

Vượt qua nó đòi hỏi **nguỵ trang dấu vân tay TLS thành trình duyệt** — tức là né
tránh phát hiện. Tôi cố ý **không** làm việc đó, và đã tắt nguồn này thay vì
lặng lẽ luồn qua. Cấu hình đã kiểm đúng và giữ nguyên, bật lại là chạy.

---

## Đã có gì

```
src/
├─ crawler/
│  ├─ fetcher.ts          ★ nơi DUY NHẤT định nghĩa "lịch sự"
│  ├─ jsonld.ts           ★ bộ bóc JobPosting dùng chung cho MỌI nguồn
│  ├─ pipeline.ts           DISCOVER → FETCH → NORMALIZE → UPSERT → REAP → LOG
│  ├─ discover/sitemap.ts   đi sitemap index lồng nhau, hỗ trợ crawl tăng dần
│  ├─ normalize/
│  │  ├─ salary.ts          VND/tháng · "15-20 triệu" · "$2000-3000" · thoả thuận
│  │  ├─ level.ts           cấp bậc + số năm kinh nghiệm
│  │  ├─ location.ts        34 tỉnh/thành + bí danh tên CŨ trước sáp nhập 2025
│  │  └─ text.ts            NFC · bỏ dấu · gộp tên công ty · cắt query string
│  ├─ sources/
│  │  ├─ generic-jsonld.ts  ★ MỘT adapter cho 5 sàn
│  │  └─ vietnamworks.ts      adapter API riêng
│  └─ storage/blob.ts       R2 / đĩa — HTML thô KHÔNG BAO GIỜ vào Postgres
├─ api/                     ★ tầng đọc CSDL cho web — CHỈ ĐỌC
│  ├─ job.api.ts            danh sách + chi tiết tin, URL -> bộ lọc
│  ├─ stats.api.ts          số liệu tổng hợp, phân vị lương (percentile_cont)
│  └─ ops.api.ts            sức khoẻ nguồn, nhật ký crawl, khả năng reparse
├─ lib/
│  ├─ query.ts            ★ đọc/dựng query string — MỘT quy tắc phân trang
│  └─ chart.ts              hình học biểu đồ: mốc trục đẹp, tỷ lệ, dải phân vị
├─ components/
│  ├─ ui/                 ★ mảnh ghép không biết gì về nghiệp vụ
│  │  └─ tone.ts            ★ CHỖ DUY NHẤT dịch từ ý nghĩa sang màu
│  ├─ charts/               SVG/CSS tự vẽ, không thư viện
│  ├─ job/                  thẻ tin · bộ lọc · dải chip đang lọc
│  └─ layout/               khung ngoài + điều hướng
├─ app/                     4 màn hình (xem § Bảng điều khiển web)
├─ styles/globals.css     ★ toàn bộ hệ màu, đã kiểm bằng máy
├─ constants/{crawl,source,nav}/  quy tắc lịch sự · 6 nguồn · 4 màn hình
└─ enums/                   JobStatus · Level · SourceKind · ...
```

**Chưa có:** máy kiểm còn-sống tầng 3–4 (`recheck`), khử trùng lặp `JobGroup`,
tác vụ ghi `SalaryStat` theo lô, tìm kiếm vector. Xem lộ trình ở
[TECHSTACK.md §9](TECHSTACK.md).

---

## Hai quyết định kiến trúc đáng nhớ

**1. Một bộ bóc cho mọi nguồn.** Sáu nguồn đã khảo sát đều nhúng JSON-LD
`JobPosting` chuẩn schema.org — vì Google **bắt buộc** thế để được lên Google
Jobs. Nên thêm nguồn mới lý tưởng là INSERT một dòng vào bảng `Source`, không
phải viết code. Nếu số adapter bắt đầu tăng cùng nhịp với số nguồn thì kiến trúc
đã sai ở đâu đó.

**2. HTML thô không bao giờ vào Postgres.** Đo thật: một trang chi tiết TopDev
nặng **828 KB**, Neon gói Free có **0,5 GB**. 10.000 tin là 8 GB — gấp 16 lần
hạn mức. Postgres giữ dữ liệu đã cấu trúc (~50 MB), blob thô đã gzip nằm trên
Cloudflare R2 (10 GB miễn phí, egress miễn phí).

---

## Quy tắc thu thập

Cài cứng trong [src/constants/crawl](src/constants/crawl/index.ts) và
[fetcher.ts](src/crawler/fetcher.ts) — **không phải tuỳ chọn**:

- Nghỉ **≥ 2 giây** giữa hai request tới cùng một host, mỗi lúc **một** request
- **robots.txt được đọc và tuân thủ tự động** — adapter không thể lách
- User-Agent **định danh kèm email liên hệ**, không giả làm Chrome
- Gặp **429/503 → dừng cả phiên** cho host đó, không thử lại
- Conditional GET (`ETag`/`If-Modified-Since`) — gặp 304 thì không tải body

Đo thật khi dò TopDev: **5 request, 9,4 giây** cho 6 URL + 2 trang chi tiết.

## Bản quyền

Chỉ tái sử dụng **số liệu** (tên công ty, mức lương, địa điểm, ngày đăng — là
dữ kiện, không thuộc phạm vi bảo hộ quyền tác giả). Mô tả công việc được lưu để
**máy** phân tích nhưng chỉ hiển thị trích dẫn ngắn kèm nút về tin gốc. Chi tiết
ở [PLAN.md §7](PLAN.md).
