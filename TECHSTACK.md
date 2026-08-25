# Bae-Job — Tech stack cho **cào** và **lưu trữ** (nghiên cứu sâu)

> Bổ sung cho [PLAN.md](PLAN.md). Tài liệu này chỉ trả lời hai câu: *cào bằng gì*
> và *cất ở đâu*. Mọi con số đều **đo thật ngày 24–25/08/2026**, nguồn ghi kèm.

---

## 0. Ba ràng buộc đẻ ra mọi lựa chọn dưới đây

1. **Đa nguồn, mở** — không phải 4 sàn cố định, mà "tìm thấy nguồn nào lấy nguồn
   đó", theo ngành nghề người dùng quan tâm.
2. **Phải đảm bảo tin còn sống.** Một trang thống kê đầy tin chết thì tệ hơn là
   không có trang nào.
3. **Thống kê theo ngành nghề người dùng muốn**, chứ không phải theo cây danh mục
   cứng của một sàn nào.

Ràng buộc 1 quyết định lớp *khám phá*. Ràng buộc 2 quyết định lớp *kiểm tra sống*.
Ràng buộc 3 quyết định lớp *tìm kiếm*. Ba lớp này là phần khó; phần còn lại là
việc tay chân.

---

## 1. Khám phá nguồn — Google **không** phải đường đi

Đây là chỗ tôi phải nói ngược lại ý ban đầu, vì số liệu không ủng hộ.

### Đo được về các search API

| Cách | Hạn mức miễn phí | Giá | Tình trạng |
|---|---|---|---|
| **Google Custom Search JSON API** | 100 lượt/ngày | $5/1.000, trần 10k/ngày | ❌ **Đã đóng với khách mới, khai tử 01/01/2027.** Loại thẳng |
| **SerpApi** (có engine `google_jobs`) | 250 lượt/**tháng** | $25/tháng cho 1.000 lượt | Đắt gấp ~25 lần Serper |
| **Serper.dev** | 2.500 lượt (một lần) | ~$1/1.000 (gói $50 = 50k credit), credit hết hạn sau 6 tháng | Rẻ nhất. 1 credit = 10 kết quả; xin 11–100 kết quả tính 2 credit |
| **Brave Search API** | $5 credit/tháng ≈ 1.000 lượt | $5/1.000 | ⚠️ Gói mặc định **không cho phép lưu trữ kết quả** — muốn lưu phải mua gói có quyền lưu |

### Vì sao search API sai công cụ cho việc này

Một truy vấn trả **10 kết quả**. Muốn phủ 10.000 job thì cần ~1.000 truy vấn cho
**mỗi lần quét**, mà kết quả trùng lặp nặng nề giữa các truy vấn, và Google
không cho lọc "chỉ tin đăng trong 24h qua" một cách đáng tin. Chi phí tăng tuyến
tính theo số job, còn giá trị thì không.

### Đường đúng: **sitemap**

Đo thật:

| Nguồn | Sitemap | Kết quả đo |
|---|---|---|
| **TopDev** | `topdev.vn/sitemap-jobs.xml` | Sitemap index → **463 sitemap con × 20 URL ≈ 9.260 URL job**. Hai request là có toàn bộ danh mục |
| **vieclam24h** | `/file/sitemap/sitemap-index.xml` | Có `<lastmod>`, và **chia sẵn theo `nganhnghe-*.xml`, `tinhthanh-*.xml`, `nganhtinh-*.xml`** — đúng chiều cắt mà ràng buộc 3 cần |
| **ITviec** | `/dunggiatminh.xml` | Chia theo skill / city / title, cả EN lẫn VN |
| **TopCV** | `/sitemap.xml` | Khai báo trong robots.txt |
| **123job** | `/sitemap.xml` | Khai báo trong robots.txt |

Chi phí: **~10–50 request/nguồn/ngày** cho toàn bộ danh mục. Miễn phí, không phụ
thuộc bên thứ ba, không có ai để mà tăng giá hay đóng cửa.

### Vậy search API dùng vào việc gì?

Đúng một việc, và nó có giá trị thật: **trinh sát nguồn mới**. Người dùng quan
tâm "cơ khí ở Hải Phòng" → chạy vài chục truy vấn Google → phát hiện ra những sàn
ngách mà mình chưa biết tồn tại. Chạy **1 lần/tháng**, vài chục truy vấn → nằm
gọn trong 2.500 lượt free của Serper, không tốn đồng nào.

> **Search API = trinh sát. Sitemap = vận tải.**
> Đừng để trinh sát làm việc của vận tải.

Bảng `Source` trong DB vì thế cần thêm cột `discoveredVia` (`manual` | `search` |
`referral`) và `sitemapUrl`, để quy trình thêm nguồn mới là **dữ liệu chứ không
phải code**.

---

## 2. Bóc tách — một bộ giải mã cho tất cả nguồn

### Bằng chứng

| Nguồn | JSON-LD `JobPosting` ở trang chi tiết |
|---|---|
| VietnamWorks | *(không cần — có API JSON, 10.556 job)* |
| TopCV | ✅ đầy đủ: `baseSalary` min/max VND/MONTH, `employmentType`, `jobLocation.address`, `skills`, `experienceRequirements` |
| ITviec | ✅ |
| CareerViet | ✅ (có cả ở trang danh sách) |
| **vieclam24h** | ✅ (2 khối) |
| **TopDev** | ✅ + có `datePosted`, `validThrough` |

**Sáu nguồn, một parser.** Và đây không phải may mắn — nó có nguyên nhân cấu trúc:

Google for Jobs **bắt buộc** JobPosting JSON-LD với năm trường: `datePosted`,
`description`, `hiringOrganization`, `jobLocation`, `title`. Sàn nào muốn xuất
hiện trên Google Jobs thì buộc phải có, đúng chuẩn schema.org. Nghĩa là **Google
đã ép cả thị trường chuẩn hoá dữ liệu giúp ta rồi** — ta chỉ việc đọc.

Hệ quả kiến trúc:

```
Nguồn mới  ─►  có JobPosting JSON-LD?  ─ có ─►  DÙNG PARSER CHUNG, 0 dòng code
                        │
                      không
                        │
                        ▼
              viết adapter riêng (CSS selector) — chỉ khi nguồn đó đủ đáng
```

CSS selector tụt xuống vai trò **phụ**: chỉ dùng để vá trường mà JSON-LD thiếu
(thường là lương và skill), không phải xương sống. Đây là khác biệt lớn nhất so
với `crapper`, nơi parser HTML là trung tâm.

### Bẫy khi parse JSON-LD (gặp đủ cả rồi mới biết)

- Một trang có **nhiều khối** `ld+json`; `JobPosting` không phải khối đầu tiên
- Khối bọc trong `@graph` hoặc là **mảng** ở cấp cao nhất
- `description` là **HTML đã escape** — phải unescape rồi mới tước thẻ
- `baseSalary` khi thì `QuantitativeValue` có `minValue`/`maxValue`, khi thì `value` là **một số trần**, khi thì thiếu hẳn
- `jobLocation` có thể là **mảng** (nhiều chi nhánh) — đừng lấy phần tử đầu rồi thôi
- `validThrough` khi có timezone khi không (`"2026-09-11"` vs `"2026-09-05T23:59:59+07:00"`)
- Có sàn ghi `addressLocality` ở cấp **phường** (`"Phường Long Biên"`), không phải quận/tỉnh

→ **Bắt buộc có tầng Zod schema + normalize.** Tin JSON-LD về *cấu trúc*, không
tin về *chất lượng*. Sai ở đây là hỏng toàn bộ thống kê lương.

---

## 3. Khung cào

| Lựa chọn | Được | Mất |
|---|---|---|
| **Tự viết** (undici + p-queue + robots-parser + cheerio) — cách `crapper` đang làm | Ít phụ thuộc, hiểu từng dòng, chạy đâu cũng được | Tự viết hàng đợi, khử trùng URL, backoff, giới hạn theo domain. Với 1 nguồn thì ổn; với 6+ nguồn là công việc thật |
| **Crawlee (TS)** | `CheerioCrawler`/`PlaywrightCrawler`, hàng đợi có khử trùng URL sẵn, autoscaling, retry + backoff, session pool, và **`respectRobotsTxtFile: true \| { userAgent }`** — tự đọc robots.txt mỗi domain và bỏ qua URL bị cấm, kể cả URL vào qua `enqueueLinks` | Nặng, **không chạy được trên Vercel serverless** |
| **Playwright** | Lấy được trang render bằng JS | Chậm, tốn RAM, dễ bị coi là bot |

**Đã chốt khi bắt tay làm: tự viết + `robots-parser`.** *(Sửa lại khuyến nghị
Crawlee ban đầu — ghi lại cả hai để sau này còn đối chiếu.)*

Lý do đảo ý: giá trị lớn nhất của Crawlee là `respectRobotsTxtFile`, và điều đó
lấy được bằng `robots-parser` trong ~15 dòng. Còn `RequestQueue` — phần nặng
nhất của Crawlee — thì **trùng lặp với state đã nằm trong Postgres**: bảng
`JobPosting` đã là hàng đợi có khử trùng, có `lastSeenAt`, có `missCount`. Giữ
hai nơi cùng nhớ "URL nào đã xử lý" là tự tạo ra một lớp đồng bộ để mà hỏng.

Điều thật sự quan trọng vẫn được giữ nguyên: **mọi request phải đi qua đúng một
lớp** ([`src/crawler/fetcher.ts`](src/crawler/fetcher.ts)) đọc robots.txt tự
động, và không adapter nào gọi `fetch()` trực tiếp. Lịch sự là **mặc định của hệ
thống**, không phải quy tắc phải nhớ ở từng adapter — đó mới là điều Crawlee
được chọn vì nó, và nó không cần Crawlee mới có.

### Và tin tốt: **không cần headless browser**

Có ba sàn (TopDev, mywork, 123job) render danh sách bằng JS — đo được là trang
danh sách chỉ trả về khung, không có link job. Nhưng:

> TopDev: sitemap → `topdev.vn/detail-jobs/...` → **curl thường, HTTP 200, có
> `JobPosting` + `datePosted` + `validThrough`**.

Trang **chi tiết** vẫn SSR đầy đủ vì chúng *phải* SSR — nếu không Googlebot
không đọc được JSON-LD và họ mất suất trên Google Jobs. Sitemap đi vòng qua đúng
chỗ khó.

→ **Giai đoạn 1–3 không cần Playwright.** Tiết kiệm RAM, thời gian, và rủi ro bị
chặn. Chỉ mở lại chuyện headless nếu gặp nguồn vừa không sitemap vừa không JSON-LD
— và khi đó nên hỏi lại là nguồn đó có đáng không.

---

## 4. Đảm bảo tin còn **active** — hợp đồng đã có sẵn, không cần tự nghĩ

Google quy định sàn phải gỡ tin hết hạn bằng **đúng ba cách**:

1. đặt `validThrough` về quá khứ, hoặc
2. trả **404 / 410**, hoặc
3. gỡ hẳn khối JSON-LD `JobPosting` khỏi trang

("Failure to take timely action on expired jobs may result in a manual action" —
tức là sàn nào không tuân thủ sẽ bị Google phạt. Nên đa số tuân thủ thật.)

Vậy ta không cần phát minh định nghĩa "còn sống" — **dùng đúng ba tín hiệu đó**,
vì cả thị trường đã bị ép tuân theo chúng rồi.

### Bốn tầng kiểm, xếp theo giá

| Tầng | Cách | Chi phí | Bắt được |
|---|---|---|---|
| **1** | `validThrough < hôm nay` | **0 request** — đã có sẵn trong DB | Phần lớn tin hết hạn tự nhiên |
| **2** | Vắng mặt khỏi sitemap/danh sách N lần liên tiếp | ~0 (đằng nào cũng đọc sitemap) | Tin bị gỡ sớm |
| **3** | Conditional GET: `If-Modified-Since` / `If-None-Match` → **304** | Rất rẻ, không tải body | Tin bị **sửa** (đổi lương, đổi hạn) |
| **4** | GET thật → 404/410, hoặc mất khối JSON-LD, hoặc có chữ "đã hết hạn" | Đắt | Phần còn lại |

**Ngân sách tầng 4** — chỉ gọi cho job thoả một trong ba:
(a) `validThrough` còn ≤ 3 ngày, (b) đã vắng sitemap ít nhất 1 lần, (c) chưa kiểm
quá 7 ngày.

→ ~**500–1.000 request/ngày** thay vì 10.000. Vừa lịch sự vừa chạy được trên hạ
tầng miễn phí.

### Máy trạng thái

```
                 thấy lần đầu
                      │
                      ▼
                   ┌──────┐  validThrough < today ─────────► ┌─────────┐
                   │ OPEN │  404/410 ────────────────────────► │ EXPIRED │
                   └──────┘  mất JSON-LD ────────────────────► └─────────┘
                      │ ▲                                          │
     vắng sitemap 1-2 │ │ thấy lại                                 │ thấy lại
                      ▼ │                                          │ (đăng lại)
                   ┌──────────┐  vắng sitemap ≥3   ┌────────┐      │
                   │ STALE    │ ─────────────────► │ CLOSED │ ◄────┘
                   └──────────┘                    └────────┘   repostCount++
```

Chỉ `OPEN` mới được vào thống kê và hiện ở kết quả tìm kiếm. `STALE` vẫn hiện
nhưng có nhãn "chưa xác nhận lại".

### Và: nói thật với người dùng

Mỗi tin hiện **"kiểm lần cuối: 3 giờ trước"**. Không giả vờ realtime. Ba dòng chữ
trung thực này đáng giá hơn mọi nỗ lực kỹ thuật để đạt độ tươi tuyệt đối — mà
đằng nào cũng không đạt được, vì nguồn không báo cho ta khi họ gỡ tin.

`/api/health` trả **503** khi lô kiểm tra gần nhất quá 24 giờ — để giám sát ngoài
báo động, đúng như `crapper`.

---

## 5. Lưu trữ — chỗ dễ chết nhất, và ít ai tính trước

### Con số làm hỏng kế hoạch

| Đo được | |
|---|---|
| Trang chi tiết TopDev | **828 KB** |
| Trang danh sách TopCV | **2 MB** |
| **Neon gói Free** | **0,5 GB / project** |

10.000 job × ~800 KB = **8 GB** — **gấp 16 lần hạn mức**. Lưu HTML thô vào
Postgres như `crapper` đang làm sẽ **chết trong tháng đầu tiên**. Đây là khác biệt
quan trọng nhất giữa hai dự án: bài báo giá gạo nhẹ, trang tuyển dụng thì phình.

### Kiến trúc hai tầng

```
                       ┌──────────────────────────────────┐
   crawler ──────────► │ Postgres (Neon)                  │
        │              │ dữ liệu ĐÃ CẤU TRÚC ~3–5 KB/job  │  10k job ≈ 50 MB ✓
        │              │ + index FTS + vector             │
        │              └──────────────────────────────────┘
        │
        └────────────► ┌──────────────────────────────────┐
                       │ Cloudflare R2                    │
                       │ HTML/JSON thô, đã gzip           │  10k job ≈ 600 MB ✓
                       │ khoá: {source}/{yyyy-mm}/{id}.gz │
                       └──────────────────────────────────┘
```

**Cloudflare R2** đo được: **10 GB-tháng miễn phí**, **1 triệu** thao tác class A
+ **10 triệu** class B mỗi tháng, và **egress hoàn toàn miễn phí**. Cột
`rawPayload` trong schema đổi thành `rawKey String?` trỏ tới object trên R2.

Như vậy vẫn giữ nguyên siêu năng lực `npm run reparse` của `crapper` — sửa parser
rồi tính lại toàn bộ lịch sử mà không cào lại — nhưng không phá vỡ hạn mức DB.
(Với 6 nguồn thì năng lực này còn quý hơn, vì mỗi lần sửa chuẩn hoá lương là ảnh
hưởng cả 6.)

### So sánh nền CSDL miễn phí

| | Dung lượng free | Có `pg_trgm` | Có `pgvector` | Ghi chú |
|---|---|---|---|---|
| **Neon** | 0,5 GB/project, 100 CU-giờ | ✅ v1.6 | ✅ v0.8 | Đã quen từ `crapper`; có branching |
| Supabase | ~500 MB DB + 1 GB file storage | ✅ | ✅ | Postgres không ngủ → `pg_cron` chạy thật |
| Cloudflare D1 | **5 GB**, 5 tr. dòng đọc/ngày, 100k dòng ghi/ngày | ❌ | ❌ | SQLite — mất cả FTS nâng cao lẫn vector. Loại |
| Turso | tuỳ gói | ❌ | ❌ | Cùng vấn đề |

**Chọn Neon** — vì đã quen, và vì `pgvector` + `pg_trgm` + `unaccent` là ba thứ
§6 bắt buộc phải có. D1 tuy 5 GB nhưng thiếu cả ba, không đánh đổi được.

> ⚠️ **Cạm bẫy `pg_cron` trên Neon:** Neon có `pg_cron` v1.6 nhưng nó **chỉ chạy
> khi compute đang thức**. Gói Free ngủ sau vài phút không hoạt động → job tổng
> hợp ban đêm sẽ **im lặng không chạy**, không báo lỗi. Đừng dựa vào nó. Mọi việc
> định kỳ đẩy hết sang GitHub Actions.

### Vòng đời dữ liệu

| Dữ liệu | Giữ |
|---|---|
| `SalaryStat`, `JobGroup` | Vĩnh viễn — đây là tài sản thật của dự án |
| Bản ghi job đã cấu trúc | Vĩnh viễn (nhẹ) |
| `descriptionHtml` trong DB | Chỉ giữ bản đã tước thẻ, cắt ≤ 8 KB |
| Blob thô trên R2 của job `CLOSED` | Xoá sau **180 ngày**, và chỉ sau khi `SalaryStat` của kỳ đó đã chốt |

---

## 6. Tìm kiếm theo **ngành nghề** — phần người dùng thực sự cần

Đây là ràng buộc 3, và là chỗ dễ làm hời hợt nhất.

**Vấn đề thật:** người dùng gõ *"cơ khí"*. Tin tuyển dụng viết *"kỹ sư chế tạo
máy"*, *"CNC operator"*, *"bảo trì thiết bị"*, *"QC cơ khí"*, *"thiết kế khuôn
mẫu"*. Khớp từ khoá bắt được chưa tới một nửa. Mà thống kê lương dựa trên nửa dữ
liệu sai lệch thì tệ hơn không thống kê.

Ba tầng, dùng đồng thời:

**Tầng 1 — FTS (Postgres)**
```sql
to_tsvector('simple', unaccent(title || ' ' || description_text))
```
Postgres **không có** cấu hình ngôn ngữ tiếng Việt, nhưng `simple` + `unaccent`
chạy tốt bất ngờ, vì tiếng Việt gần như không biến hình (không chia động từ,
không số nhiều) — thứ mà stemmer sinh ra để xử lý thì tiếng Việt vốn không có.
Index GIN. `unaccent` (v1.1 trên Neon) lo phần "co khi" ↔ "cơ khí".

**Tầng 2 — `pg_trgm`**
Bắt viết sai, viết tắt, tên công nghệ viết dính (`reactjs` / `react.js`).
`similarity()` + GIN trigram index.

**Tầng 3 — `pgvector` + embedding đa ngữ** ← **đây mới là câu trả lời thật**

Nhúng `title + skills + đoạn mô tả` của mỗi job thành vector. Rồi:

- Người dùng **không** gõ một từ khoá — họ **đánh dấu vài tin đúng ý**.
- Ta lấy **trọng tâm (centroid)** của các vector đó làm định nghĩa "ngành nghề
  của tôi", lưu vào bảng `UserField`.
- Thống kê chạy trên `cosine_distance < ngưỡng` quanh centroid đó.

Định nghĩa ngành nghề trở thành **một vector do người dùng dạy**, không phải một
nhánh trong cây danh mục của TopCV. Đó đúng là điều đề bài yêu cầu, và không sàn
nào làm được vì họ bị khoá vào cây danh mục của chính mình.

Mô hình: **BGE-M3** hoặc **multilingual-e5** — đều đa ngữ mạnh, tiếng Việt tốt.
Chạy **local** bằng `transformers.js` trong Node ở bước crawl → 10k job nhúng một
lần, **không tốn tiền API**, không gửi dữ liệu đi đâu. Chỉ khi nào dữ liệu lên
hàng trăm nghìn mới cần tính tới API embedding trả phí.

**Kết hợp (hybrid):** FTS/trigram lọc thô xuống vài nghìn → vector xếp hạng lại.
Nhanh hơn quét vector toàn bảng, và chính xác hơn dùng riêng một tầng nào.

---

## 7. Chạy ở đâu

| Thành phần | Nơi | Vì sao |
|---|---|---|
| Web + API đọc | **Vercel** | Server Component đọc thẳng Neon. Nhẹ, không cần gì hơn |
| **Crawler** | **GitHub Actions** (mỗi 2–3 giờ) | Crawlee không chạy được trên serverless. Actions có toàn quyền, thời gian chạy dài, kết nối thẳng Neon |
| Kiểm tra "còn sống" | **GitHub Actions** (mỗi 6 giờ) | Tách khỏi crawl để hỏng cái này không kéo theo cái kia |
| Tổng hợp `SalaryStat` + nhúng vector | **GitHub Actions** (đêm) | **Không** dùng `pg_cron` — xem cảnh báo ở §5 |
| CSDL | **Neon** | pgvector + pg_trgm + unaccent |
| Blob thô | **Cloudflare R2** | 10 GB free, egress free |

**Vercel Cron chỉ giữ làm lưới an toàn**, đo được: gói **Hobby giới hạn 1 lần/ngày**,
và độ chính xác **±59 phút** (`0 1 * * *` có thể nổ bất kỳ lúc nào trong khoảng
01:00–01:59). Biểu thức cron chạy dày hơn sẽ **fail ngay lúc deploy**. Với tin
tuyển dụng thì như vậy là không dùng được làm lịch chính.

---

## 8. Bảng quyết định — tóm tắt

| Câu hỏi | Quyết | Vì |
|---|---|---|
| Khám phá bằng gì? | **Sitemap**, không phải search API | 2 request lấy 9.260 URL; Google CSE thì đã khai tử 2027 |
| Search API còn dùng không? | Có — **Serper, ~1 lần/tháng, chỉ để tìm nguồn mới** | Nằm trong 2.500 lượt free |
| Bóc tách bằng gì? | **JSON-LD `JobPosting` + Zod**, CSS selector là phụ | 6/6 nguồn đã kiểm đều có; Google ép cả thị trường chuẩn hoá |
| Khung cào? | **Tự viết + `robots-parser`**, mọi request qua đúng một `fetcher.ts` | Lịch sự thành mặc định hệ thống, mà không phải ôm `RequestQueue` trùng với Postgres |
| Headless browser? | **Không**, giai đoạn 1–3 | Trang chi tiết buộc phải SSR để lên Google Jobs |
| "Active" định nghĩa sao? | **`validThrough` / 404-410 / mất JSON-LD** + vắng sitemap | Chính là hợp đồng Google đã áp lên các sàn |
| Ngân sách kiểm tra? | 4 tầng, chỉ tầng 4 tốn request → **~500–1.000/ngày** | Thay vì 10.000 |
| DB? | **Neon** | pgvector 0.8 + pg_trgm 1.6 + unaccent 1.1 |
| HTML thô để đâu? | **R2**, không phải Postgres | 828 KB/trang vs 0,5 GB hạn mức |
| Lịch chạy? | **GitHub Actions**, không `pg_cron`, không Vercel Cron | pg_cron ngủ theo compute; Vercel Hobby 1 lần/ngày ±59 phút |
| Tìm theo ngành nghề? | **Hybrid FTS + trigram + pgvector centroid** | Từ khoá bắt chưa tới một nửa |

---

## 9. Lộ trình cập nhật

Thay cho §6 của [PLAN.md](PLAN.md):

| Chặng | Nội dung | Khác gì so với bản cũ |
|---|---|---|
| **0** | Next 15 + Prisma + Neon + **R2** + Tailwind/shadcn | Thêm R2 ngay từ đầu, đừng để sau |
| **1** | VietnamWorks (API JSON) + schema + `CrawlRun` | Như cũ |
| **2** | **Lớp sitemap-discovery + parser JSON-LD dùng chung** | **Mới, và là chặng quan trọng nhất** — làm xong là thêm nguồn gần như miễn phí |
| **3** | Bật TopCV + ITviec + TopDev + vieclam24h + CareerViet | Nhờ chặng 2, đây chỉ là thêm dòng vào bảng `Source` |
| **4** | **Máy kiểm-tra-còn-sống 4 tầng** + máy trạng thái | **Mới** — ràng buộc 2 |
| **5** | Tìm kiếm hybrid: FTS + trigram + **pgvector centroid** | Nâng cấp từ "FTS đơn thuần" |
| **6** | Khử trùng lặp (`JobGroup`) | Như cũ |
| **7** | `SalaryStat` + biểu đồ theo ngành nghề người dùng tự định nghĩa | Lý do dự án tồn tại |
| **8** | Cảnh báo, API mở, CSV | Như cũ |

Chặng **2** là chỗ dồn sức. Làm đúng thì chặng 3 tốn một buổi cho năm nguồn; làm
sai thì mỗi nguồn là một tuần và dự án chết ở nguồn thứ ba.

---

## Phụ lục — lệnh đã dùng để đo

```bash
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"

# 1. Sitemap khai báo ở đâu
curl -sSL -A "$UA" https://topdev.vn/robots.txt | grep -i sitemap

# 2. Sitemap job của TopDev (index lồng 2 tầng)
curl -sSL -A "$UA" https://topdev.vn/sitemap-jobs.xml | grep -c '<loc>'      # 463
curl -sSL -A "$UA" https://topdev.vn/sitemap/jobs_desc_en_page_1.xml \
  | grep -c '<loc>'                                                          # 20

# 3. Trang chi tiết có JobPosting + validThrough không
curl -sSL -A "$UA" "<url job>" -o d.html
grep -c 'JobPosting' d.html
grep -oE '"(datePosted|validThrough|employmentType)":"[^"]*"' d.html

# 4. Kích thước thật (để tính hạn mức lưu trữ)
curl -sSL -A "$UA" "<url job>" -o d.html -w "size %{size_download}\n"

# 5. API VietnamWorks
curl -sS -X POST https://ms.vietnamworks.com/job-search/v1.0/search \
  -H "Content-Type: application/json" \
  -d '{"query":"","filter":[],"ranges":[],"order":[],"hitsPerPage":2,"page":0}'
```

Chạy lại trước khi bắt đầu chặng 2 — các sàn đổi cấu trúc thường xuyên, và toàn
bộ §1–§2 phụ thuộc vào việc sitemap + JSON-LD còn ở đó.
