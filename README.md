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

Năm màn hình chính, mỗi màn hình trả lời **đúng một câu hỏi**. Đó là phép thử
để nó không phình ra: thêm một trang mà không viết nổi câu hỏi nó trả lời, hoặc
câu hỏi trùng với trang đã có, thì đó là một khối trong trang cũ chứ không phải
một trang mới.

| Đường dẫn | Trả lời câu |
|---|---|
| `/` **Tổng quan** | Kho tin đang có gì, và có đáng tin không? |
| `/nganh` **Ngành của tôi** | Tin nào đúng ngành tôi nhắm, và có còn tuyển không? |
| `/viec` **Kho tin** | Tin nào khớp với thứ tôi đang tìm? |
| `/luong` **Lương** | Ngành tôi trả bao nhiêu, và bao nhiêu tin dám ghi số? |
| `/nguon` **Nguồn & vận hành** | Crawler còn sống không, nguồn nào đang hỏng? |

Ba trang phụ nằm ở nút bên phải thanh điều hướng: `/da-luu` **Tin đã lưu**,
`/cai-dat` **Cài đặt** (từ điển ngành, bảng màu, chuyển động) và
`/thanh-phan` **Bộ thành phần** — tài liệu sống của hệ giao diện.

Giao diện dựng theo bản thiết kế **Bae-Job v2** (Claude Design): hệ Modernist —
góc vuông, vạch 2px, Archivo 800 — nhuộm xanh lá pastel, có bảng màu xanh dương
thứ hai, và linh vật Mèo Bae bằng điểm ảnh. Token và lớp thành phần nằm ở
[src/styles/globals.css](src/styles/globals.css).

### Ba ràng buộc kỹ thuật của phần web

**1. Gần như chỉ đọc.** Không có đường nào từ lượt truy cập của người dùng đi ra
sàn nguồn, nên trang vẫn chạy bình thường kể cả khi mọi nguồn cùng sập. Web chỉ
GHI đúng hai thứ — tin đã lưu (bảng `SavedJob`) và từ điển ngành (`SavedFilter`)
— và cả hai đi qua cổng khoá `EDIT_KEY`
([src/lib/edit-access.ts](src/lib/edit-access.ts)). Chưa đặt khoá thì bản
production chỉ đọc. Từ điển được sửa trên **bản nháp nằm trong URL**, xem trước
số tin khớp, rồi mới lưu ([src/lib/field-draft.ts](src/lib/field-draft.ts)).

**2. Gần như không có JavaScript.** Bộ lọc là `<form method="get">` thuần, lưu tin
và lưu từ điển là server action gắn vào `<form>` — mọi thứ chạy được khi JS chưa
tải, và mỗi trạng thái màn hình là một URL dán được. Component phía trình duyệt
chỉ có hai chỗ: thanh điều hướng (vì "tôi đang ở trang nào" không thể chờ JS) và
trang Bộ thành phần (vì tab, công tắc, hộp thoại chính là thứ đang trình diễn).

**3. Biểu đồ tự vẽ, không thư viện.** Mọi phân bố trong bản v2 là thanh ngang
nhãn · rãnh · số ([src/components/ui/bar-row.tsx](src/components/ui/bar-row.tsx)).
Thêm một thư viện biểu đồ cho vài chục hình chữ nhật là đánh mất ràng buộc số 2.

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
| `npm run measure -- --source <code>` | **Đo lát cắt**: mẫu lọc giữ lại bao nhiêu URL của sàn, không tải trang chi tiết. `--pattern "a\|\|b"` so nhiều mẫu, `--queries` cho VNW |
| `npm run crawl` | Quét tăng dần mọi nguồn đang bật |
| `npm run crawl -- --source topcv,itviec` | Chỉ vài nguồn |
| `npm run crawl -- --full` | Quét đầy đủ — **và chỉ khi đó mới dám đóng tin đã biến mất** |
| `npm run crawl -- --dry` | Không ghi DB, chỉ in ra |
| `npm run reparse` | **Tính lại toàn bộ từ blob đã lưu, không gọi mạng.** `-- --failed --dry` |
| `npm run repair:salary` | Tính lại lương cho tin **không có blob**, từ `salaryRaw`. Mặc định chạy khô; `-- --apply` để ghi, kèm `JobAudit` |
| `npm run db:push` / `db:seed` / `db:studio` | Thao tác CSDL |
| `... -- --ws swe` | **Chọn workspace** cho mọi lệnh trên (mặc định `bae`). Xem bên dưới |
| `npm test` | 263 test, chạy trên fixture JSON-LD **thật** của 3 sàn |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run dev` | **Bảng điều khiển web** ở http://localhost:3000 |
| `npm run build` / `npm start` | Bản production |

### Hai workspace, hai CSDL

Từ 17/09/2026 dự án phục vụ hai nghề, mỗi nghề một CSDL Postgres riêng
([docs/plan-swe.md](docs/plan-swe.md)):

| Workspace | Nghề | CSDL |
|---|---|---|
| `bae` (mặc định) | **Ngành của Bae** — thu mua, TP.HCM | `DATABASE_URL` |
| `swe` | **Ngành của tôi** — phần mềm .NET/React | `DATABASE_URL_SWE` |

Mọi script nhận `--ws <tên>` và in ngay dòng đầu CSDL nó sắp đụng tới:

```bash
npm run probe   -- --ws swe --source itviec    # không cần CSDL
npm run db:push -- --ws swe
npm run db:seed -- --ws swe
npm run crawl   -- --ws swe --source vnw,itviec --dry
```

Không có `--ws` thì mọi lệnh chạy đúng như trước ngày tách. Cách vào từng sàn
nằm ở [catalog.ts](src/constants/source/catalog.ts) (dùng chung), còn lấy lát
nào theo nghề nằm ở [targeting.ts](src/constants/source/targeting.ts).

`npm run reparse` là lệnh quan trọng nhất khi bảo trì: mỗi tin được lưu bản
JSON-LD gốc trên blob store, nên sửa parser rồi chạy lệnh này là toàn bộ lịch sử
được tính lại trong vài giây — không phải cào lại sáu nguồn.

---

## Tình trạng 7 nguồn — đã chạy thật 25/08 và 09/09/2026

| Nguồn | Trạng thái | Đo được |
|---|---|---|
| **VietnamWorks** | ✅ chạy | 1 request → 50 tin đầy đủ |
| **CareerViet** | ✅ chạy | **Bật lại 09/09.** `/sitemap/sitemap.xml` → 12 file con; `job_vi_0..2` (6.974 URL/file) + `job_current_date` (860). `lastmod` thật — 2.256 giá trị khác nhau trên 6.974 URL |
| **TopDev** | ✅ chạy | 5 request, 9,4s. Cần `sitemapUrlPattern` — index có 257 file `_en` + 257 file `_vi` chứa **cùng** tập tin |
| **ITviec** | ✅ chạy | 847 URL ở `jobs_desc_en`. **Bắt buộc** `sitemapUrlPattern`: file tin nằm cuối trong 13 file, bốn file đầu là danh mục công ty nặng 17 MB |
| **vieclam24h** | ✅ chạy | `daily/job-0.xml` → `job/tintuyendung-N.xml` |
| **Tìm Việc 365** | ✅ chạy | **Mới 09/09.** `sitemap.xml` → 40 file, tin nằm ở `sitemap-job-1..7` + `job-new`, tổng 12.357 URL. `lastmod` thật ở mức từng tin |
| **TopCV** | ⛔ tắt | **Chặn ở tầng dấu vân tay TLS.** Xem bên dưới |

Hai nguồn mới đều **nhắm mục tiêu bằng `urlIncludePattern`** như vieclam24h,
vì cả hai đều lớn hơn ngân sách một lần chạy. Đo thật 09/09: CareerViet
14.368 URL `/vi/` → 428 khớp nghề thu mua (3,0%); Tìm Việc 365 12.357 → 156
(1,3%). Mẫu chỉ chứa từ **lõi** của từ điển, cố ý bỏ nhóm từ xám
(`logistics`, `xuat-nhap-khau`, `kho-van`) — từ xám không tự kéo tin vào ngành
nên tải chúng về là chắc chắn tải để rồi vứt.

### Vì sao CareerViet bật lại được

Kết luận "không có sitemap dùng được" hồi 25/08 **sai**, và sai vì thiếu đúng
một phép thử. Lần đó đã thử `/sitemap.xml` (404), `/sitemap_index.xml` (404),
`/vi/sitemap.xml` (404) và `/sitemap/sitemap-**index**.xml` (200 nhưng rỗng 0
byte) — nhưng chưa thử `/sitemap/sitemap.xml`, và đó mới là địa chỉ thật. Bài
học: một sàn trả 200-rỗng ở đường dẫn *gần đúng* thì đừng dừng lại, vì chính
nó chứng tỏ thư mục `sitemap/` có tồn tại.

JSON-LD của họ giàu trường nhất trong nhóm sitemap: lương VND có min/max,
`monthsOfExperience`, `industry` khớp thẳng bảng chia loại mua hàng, và
`workHours` — nguồn đầu tiên cho cột "lịch thứ 7" dữ liệu thật.

Hai bẫy đã phải vá ở parser (đã có test chặn hồi quy, đừng gỡ):

1. Sàn này **đảo** `addressRegion` và `addressLocality`: `region` là *quận*
   ("Quận 5"), `locality` mới là *tỉnh*. Trước khi vá, mọi tin CareerViet ra
   `province = null` rồi biến mất khỏi trang Ngành — im lặng, không lỗi nào.
2. `employmentType` trả `["\"FULL_TIME\""]`, dấu nháy nằm *trong* chuỗi.

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
