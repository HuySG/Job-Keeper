# Bae-Job — Nghiên cứu tech stack & ý tưởng

> Tài liệu khảo sát trước khi viết dòng code đầu tiên. Mọi số liệu về nguồn trong
> §2 là **đo thật bằng curl ngày 24/08/2026**, không phải phỏng đoán — nhưng các
> sàn đổi giao diện liên tục, nên phải đo lại trước khi bắt tay làm.
>
> **Nghiên cứu sâu về lớp cào và lớp lưu trữ nằm ở [TECHSTACK.md](TECHSTACK.md)** —
> khám phá nguồn bằng sitemap thay vì search API, parser JSON-LD dùng chung cho
> mọi nguồn, máy kiểm-tra-còn-sống 4 tầng, và kiến trúc lưu trữ hai tầng
> Postgres + R2. Lộ trình ở §6 dưới đây **đã được thay bằng [TECHSTACK.md §9](TECHSTACK.md)**.

---

## 1. Làm cái gì, và tại sao không phải "thêm một trang việc làm nữa"

Cào job về rồi hiển thị lại danh sách job thì không ai dùng — TopCV làm việc đó
tốt hơn và có sẵn nút ứng tuyển. Giá trị chỉ xuất hiện khi **gộp nhiều nguồn lại
và tính ra thứ mà không sàn đơn lẻ nào tính được**.

Ba ràng buộc định hình toàn bộ thiết kế:

1. **Đa nguồn, mở** — tìm thấy nguồn nào lấy nguồn đó, không khoá vào một danh
   sách sàn cố định.
2. **Tin phải còn sống** — trang thống kê đầy tin chết còn tệ hơn không có trang.
3. **Thống kê theo ngành nghề *người dùng* muốn**, không phải theo cây danh mục
   cứng của một sàn nào. Đây là điểm khác biệt gốc: định nghĩa "ngành của tôi"
   phải do người dùng dạy cho hệ thống (xem [TECHSTACK.md §6](TECHSTACK.md)),
   chứ không phải chọn từ dropdown.

Bốn thứ đáng làm, xếp theo giá trị trên công sức:

**1. Minh bạch lương theo thời gian.** Mỗi tin đăng có khoảng lương (hoặc không).
Gom 3–6 tháng dữ liệu là ra được: lương trung vị cho "Backend Java 3 năm ở Hà Nội"
đang là bao nhiêu, tháng này so tháng trước tăng hay giảm, bao nhiêu % tin dám ghi
số thay vì "Thoả thuận". Không sàn nào công bố cái này vì nó bất lợi cho khách
hàng của họ (nhà tuyển dụng). **Đây là xương sống của sản phẩm.**

**2. Khử trùng lặp giữa các sàn.** Cùng một vị trí thường được đăng ở 3–4 nơi,
đôi khi với mức lương khác nhau, đôi khi qua công ty môi giới giấu tên công ty
thật. Gộp lại thành một "job thật" rồi cho xem cả 3 bản gốc là thông tin có ích
ngay lập tức cho người tìm việc.

**3. Nhu cầu kỹ năng theo thời gian.** Đếm số tin nhắc tới mỗi skill theo tuần →
skill nào đang lên, đang xuống. Cùng một bộ máy chuỗi thời gian với mục 1.

**4. Cảnh báo tin mới theo bộ lọc.** Người dùng lưu một bộ lọc, có job khớp thì
nhận email/Telegram trong vòng một giờ. Đây là thứ giữ chân người dùng quay lại.

Phụ thêm, gần như miễn phí khi đã có dữ liệu: nhãn **"tin đăng lại"** (cùng một
JD xuất hiện lần thứ N trong 90 ngày → nhiều khả năng là tin tuyển ảo / tin ngâm
lâu), **API mở + xuất CSV**.

Cái **không** làm: không tự nhận đơn ứng tuyển, không lưu CV, không đăng lại
toàn văn JD. Đó vừa là rắc rối pháp lý vừa là gánh nặng vận hành, mà không thêm
giá trị cho bốn mục trên.

---

## 2. Khảo sát nguồn — đo thật, 24/08/2026

Kết luận trước: **VietnamWorks có API JSON công khai không cần auth**, và
**TopCV/ITviec nhúng sẵn JSON-LD `JobPosting` chuẩn schema.org** trong trang chi
tiết. Nghĩa là ba nguồn tốt nhất đều **không cần trình duyệt headless, không cần
viết CSS selector mong manh**. Đây là điều thay đổi hoàn toàn độ khó của dự án.

| Nguồn | Truy cập bằng curl | Dạng dữ liệu | Đánh giá |
|---|---|---|---|
| **VietnamWorks** | `POST ms.vietnamworks.com/job-search/v1.0/search` → HTTP 200, **10.556 job**, không cần token | JSON đầy đủ: `jobId, jobTitle, jobUrl, companyName, companyId, approvedOn, expiredOn, lastUpdatedOn…` | **Làm đầu tiên.** Rẻ nhất, sạch nhất, có phân trang + mốc thời gian để crawl tăng dần |
| **TopCV** | `www.topcv.vn/viec-lam-it` → 200, HTML SSR ~2 MB | Trang chi tiết có **JSON-LD `JobPosting` đầy đủ**: `baseSalary` (min/max/VND/MONTH), `employmentType`, `jobLocation.address`, `skills`, `experienceRequirements`, `validThrough` | **Làm thứ hai.** Chất lượng trường dữ liệu tốt nhất trong các sàn |
| **ITviec** | 200, SSR. `robots.txt` chỉ chặn đúng `/subscriptions/new` — **cởi mở nhất** | Trang chi tiết có `JobPosting`; có **sitemap index** (`/dunggiatminh.xml`) chia theo skill/city/title | **Làm thứ ba.** Sitemap là đường phát hiện URL rẻ nhất; mảng IT sâu |
| **CareerViet** | 200, Next.js SSR. `robots.txt` **cho phép đích danh** ClaudeBot/GPTBot/Googlebot, **chặn** CCBot/Bytespider/Amazonbot/Diffbot | Có `JobPosting` ngay trên trang danh sách | Làm được, ưu tiên trung bình |
| Glints VN, Vieclam24h | 200 nhưng không có JSON-LD | Dữ liệu nằm trong `__NEXT_DATA__` / API nội bộ — phải mò | Giai đoạn 2 |
| **JobsGO** | **HTTP 403** — Cloudflare "Just a moment…" | — | Bỏ. Không đáng để chống bot |
| **LinkedIn** | **reCAPTCHA enterprise** ngay ở `robots.txt` | — | Không làm |
| **Indeed VN** | 200 nhưng ToS cấm cào rõ ràng | — | Không làm |

Chi tiết `robots.txt` đáng lưu ý:

- **TopCV** — `User-agent: *` chỉ chặn khu vực CV/hồ sơ cá nhân (`/xem-cv/`,
  `/cv-ung-vien/`, `/private/`). Trang việc làm **không bị chặn**.
- **VietnamWorks** — chặn trang hồ sơ, đăng nhập, nộp đơn, AJAX nội bộ. Trang
  việc làm và sitemap **không bị chặn**.
- **CareerViet** — thái độ rõ: bot AI/tìm kiếm thì hoan nghênh, bot cào-để-bán
  thì cấm. Ta rơi vào nhánh `*`, chỉ bị chặn vài path phụ.

→ Cả bốn nguồn ưu tiên đều **hợp lệ về robots.txt** cho phần ta cần.

### Cụ thể từng nguồn

**VietnamWorks** — chỉ cần một request:

```
POST https://ms.vietnamworks.com/job-search/v1.0/search
Content-Type: application/json
{"query":"","filter":[],"ranges":[],"order":[],"hitsPerPage":50,"page":0}
```

Trả `meta.nbHits` (tổng), `meta.nbPages`, và `data[]` là mảng job đã cấu trúc.
Có `approvedOn`/`lastUpdatedOn` → **crawl tăng dần được**: đọc trang 1 sắp xếp
theo mới nhất, gặp job đã có trong DB và `lastUpdatedOn` không đổi thì dừng.
50 job/trang × 4 trang = 200 job mới nhất, tốn **4 request/lần chạy**.

**TopCV** — JSON-LD lấy được từ trang chi tiết, đã kiểm chứng:

```json
{"@type":"JobPosting","title":"Project Manager (PM) - Phòng Lab Công Nghệ…",
 "datePosted":"2026-08-06","validThrough":"2026-09-05T23:59:59+07:00",
 "employmentType":"FULL_TIME",
 "baseSalary":{"currency":"VND","value":{"unitText":"MONTH","minValue":50000000,"maxValue":60000000}},
 "hiringOrganization":{"name":"Công ty cổ phần Công nghệ Proton","sameAs":"…"},
 "jobLocation":{"address":{"addressLocality":"Phường Long Biên","addressRegion":"Hà Nội","addressCountry":"VN"}},
 "skills":…, "experienceRequirements":…, "industry":…}
```

Đây gần như là schema đích của ta, viết sẵn. Parser cho TopCV ≈ 40 dòng.
Cảnh báo: URL trong trang danh sách có kèm tham số theo dõi
(`?ta_source=…&u_sr_id=…`) — **phải cắt query string** trước khi lưu, nếu không
mỗi lần crawl sẽ đẻ ra một URL "mới" và trùng lặp vô hạn.

**ITviec** — URL chi tiết dạng `/it-jobs/<slug>-<4 chữ số>`, ví dụ
`/it-jobs/ai-software-engineer-python-go-c-c-ai-agents-mb-bank-4101`. Lưu ý
`/it-jobs/backend-developer` (không có số) là **trang chuyên mục, không phải
job** — lọc bằng regex `-\d{3,}$` để khỏi nuốt nhầm.

---

## 3. Tech stack

Đề xuất: **giữ nguyên stack của `crapper`**. Không phải vì lười, mà vì bài toán
giống hệt về hình dạng (cào định kỳ → chuẩn hoá → chuỗi thời gian → web đọc DB),
và mọi thứ đau đớn ở dự án đó đã trả giá xong: cách chia `src/`, quy ước
`core/components/Base*`, cách lưu HTML gốc để re-parse, cách ghi `CrawlRun`.

| Lớp | Chọn | Lý do |
|---|---|---|
| Web + API | **Next.js 15 App Router, React 19, TypeScript** | Đã quen. Server Component đọc thẳng DB, không cần tầng API riêng |
| CSDL | **PostgreSQL (Neon)** | Bắt buộc Postgres chứ không SQLite lần này — cần `tsvector` và `pg_trgm` cho tìm kiếm + khử trùng lặp |
| ORM | **Prisma 6** | Đã quen. Phần FTS dùng `$queryRaw` |
| Tìm kiếm | **Postgres FTS + `pg_trgm`**, KHÔNG Meilisearch/Elastic giai đoạn đầu | Vài chục nghìn job thì Postgres thừa sức. Thêm một service nữa là thêm một thứ để sập |
| Cào | **fetch/undici + `cheerio`**, JSON-LD là đường chính | Đã chứng minh ở §2 là **không cần Playwright**. Chỉ mở lại chuyện headless khi buộc phải lấy Glints/Vieclam24h |
| Kiểm tra dữ liệu | **Zod** | Kiểm JSON-LD trước khi tin nó — nguồn sai schema là chuyện thường |
| Giao diện | **Tailwind v4 + shadcn/radix + Recharts** | Đã có sẵn cả bộ `core/components` bên `crapper`, bê sang được |
| Test | **Vitest + fixture HTML thật** | Bài học lớn nhất từ `crapper`: lưu HTML thật vào `tests/fixtures/` rồi test parser trên đó |
| Chạy định kỳ | **GitHub Actions cron**, không phải Vercel Cron | Xem bên dưới |
| Triển khai | **Vercel + Neon**, cả hai gói miễn phí | Như `crapper` |

### Điểm khác `crapper`: lịch chạy

Vercel Cron gói Hobby giới hạn **1 lần/ngày**. Giá gạo thì được, job thì không —
tin tuyển dụng cạnh tranh theo giờ, và cảnh báo "job mới" mà chậm 20 tiếng thì vô
dụng. Cách làm:

- **GitHub Actions** chạy `npm run crawl` mỗi 2–3 giờ, kết nối thẳng Neon.
  Repo public thì miễn phí không giới hạn phút.
- Vercel Cron giữ lại làm lưới an toàn 1 lần/ngày (chạy full sweep + dọn dẹp).
- Endpoint `/api/cron/crawl` vẫn có, bảo vệ bằng `CRON_SECRET`, để bấm tay được.

Lưu ý từ `crapper`: workflow Actions ở đó đang **tắt lịch** vì repo private thì
Actions tính phút và bị chặn khi tài khoản vướng thanh toán. Bae-Job nên để repo
public từ đầu, hoặc chấp nhận trả phí Actions.

### Điểm khác `crapper`: một job có vòng đời

Giá gạo là sự kiện đóng băng — đăng rồi là xong. Job thì **sống, sửa, và chết**
(hết hạn, tuyển đủ, gỡ bài). Schema phải theo dõi được trạng thái, và crawler
phải biết cách phát hiện job đã biến mất (404 / vắng mặt khỏi danh sách N lần
liên tiếp → `CLOSED`) thay vì để tin ma nằm mãi.

---

## 4. Schema (phác thảo Prisma)

```prisma
/// Một sàn tuyển dụng
model Source {
  id       Int     @id @default(autoincrement())
  code     String  @unique          // "vnw" | "topcv" | "itviec" | "careerviet"
  name     String
  homeUrl  String
  priority Int     @default(100)    // nhỏ hơn = tin hơn khi hai nguồn lệch nhau
  isActive Boolean @default(true)
  postings JobPosting[]
}

/// Công ty đã chuẩn hoá — nhiều bí danh trỏ về một pháp nhân
model Company {
  id        Int      @id @default(autoincrement())
  slug      String   @unique
  name      String
  taxCode   String?               // mã số thuế: khoá gộp đáng tin nhất nếu lấy được
  website   String?
  logoUrl   String?
  aliases   CompanyAlias[]
  postings  JobPosting[]
}

model CompanyAlias {
  id        Int     @id @default(autoincrement())
  raw       String  @unique       // đã lowercase, bỏ "công ty tnhh/cp", bỏ dấu
  companyId Int
  company   Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
}

/// MỘT TIN ĐĂNG trên MỘT sàn. Cùng một việc ở 3 sàn = 3 dòng ở đây.
model JobPosting {
  id          Int      @id @default(autoincrement())
  sourceId    Int
  source      Source   @relation(fields: [sourceId], references: [id])
  externalId  String                  // id của riêng sàn đó
  url         String   @unique        // ĐÃ CẮT query string
  title       String
  titleNorm   String                  // đã chuẩn hoá để so khớp
  companyId   Int
  company     Company  @relation(fields: [companyId], references: [id])

  descriptionHtml String?             // đã tước thẻ, cắt <= 8 KB. KHÔNG hiển thị toàn văn
  contentHash     String              // SHA-256, phát hiện tin bị sửa
  rawKey          String?             // KHOÁ trên Cloudflare R2, KHÔNG phải nội dung.
                                      // Trang chi tiết đo được tới 828 KB, Neon free
                                      // chỉ 0,5 GB -> xem TECHSTACK.md §5

  // Lương đã chuẩn hoá về VND/tháng
  salaryMin      Int?
  salaryMax      Int?
  salaryCurrency String  @default("VND")
  salaryPeriod   String  @default("MONTH")
  salaryIsPublic Boolean @default(false)   // false = "Thoả thuận"
  salaryRaw      String?

  employmentType String?              // FULL_TIME | PART_TIME | CONTRACT | INTERN
  workMode       String?              // ONSITE | HYBRID | REMOTE
  level          String?              // INTERN | FRESHER | JUNIOR | MID | SENIOR | LEAD | MANAGER
  yearsExpMin    Int?
  yearsExpMax    Int?

  postedAt    DateTime
  expiresAt   DateTime?
  status      String   @default("OPEN")   // OPEN | EXPIRED | CLOSED | GONE
  lastSeenAt  DateTime                    // lần cuối còn thấy trên nguồn
  missCount   Int      @default(0)        // vắng mặt liên tiếp -> CLOSED

  jobGroupId  Int?                        // gộp trùng, xem dưới
  jobGroup    JobGroup? @relation(fields: [jobGroupId], references: [id])

  locations   JobLocation[]
  skills      JobSkill[]
  crawledAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([sourceId, externalId])
  @@index([postedAt])
  @@index([status, postedAt])
  @@index([companyId])
}

/// Nhóm các tin đăng được xác định là CÙNG MỘT VIỆC ở nhiều sàn
model JobGroup {
  id           Int      @id @default(autoincrement())
  fingerprint  String   @unique     // companyNorm + titleNorm + tỉnh/thành
  canonicalId  Int?                 // tin đại diện (ưu tiên nguồn priority thấp)
  firstSeenAt  DateTime
  lastSeenAt   DateTime
  repostCount  Int      @default(1) // đăng lại nhiều lần = dấu hiệu tin ma
  postings     JobPosting[]
}

model Skill {
  id      Int    @id @default(autoincrement())
  slug    String @unique
  name    String
  category String              // LANG | FRAMEWORK | DB | CLOUD | SOFT
  aliases SkillAlias[]
  jobs    JobSkill[]
}

model SkillAlias {
  id      Int    @id @default(autoincrement())
  raw     String @unique       // "reactjs", "react.js", "react js" -> react
  skillId Int
  skill   Skill  @relation(fields: [skillId], references: [id], onDelete: Cascade)
}

model JobSkill {
  postingId Int
  skillId   Int
  posting   JobPosting @relation(fields: [postingId], references: [id], onDelete: Cascade)
  skill     Skill      @relation(fields: [skillId], references: [id])
  @@id([postingId, skillId])
}

model Location {
  id       Int    @id @default(autoincrement())
  slug     String @unique
  name     String
  province String               // gộp "P. Long Biên" -> "Hà Nội"
  jobs     JobLocation[]
}

model JobLocation {
  postingId  Int
  locationId Int
  rawText    String
  posting    JobPosting @relation(fields: [postingId], references: [id], onDelete: Cascade)
  location   Location   @relation(fields: [locationId], references: [id])
  @@id([postingId, locationId])
}

/// Bảng tổng hợp lương theo ngày — nguồn của mọi biểu đồ. Tính lại bằng cron.
model SalaryStat {
  id         Int      @id @default(autoincrement())
  statDate   DateTime
  dimension  String              // "skill" | "level" | "province" | "skill+level"
  dimKey     String              // "react" | "senior" | "ha-noi" | "react|senior"
  sampleSize Int
  p25        Int
  median     Int
  p75        Int
  disclosureRate Float           // % tin có ghi lương thật
  @@unique([statDate, dimension, dimKey])
  @@index([dimension, dimKey, statDate])
}

model CrawlRun   { /* y như crapper: trigger, các số đếm, status, errorLog */ }
model SavedAlert { /* bộ lọc + email/telegram + lastNotifiedAt */ }
```

Hai điểm cố ý:

- **`JobPosting` là tin đăng, `JobGroup` là công việc.** Không gộp thẳng vào một
  bảng, vì khử trùng lặp bao giờ cũng có lúc sai — phải sửa được nhóm mà không
  mất dữ liệu gốc của từng sàn. Đây đúng là bài học `Price.sourceId` ở `crapper`.
- **`rawPayload` giữ JSON/HTML gốc** → sửa parser rồi chạy `npm run reparse`,
  tính lại toàn bộ lịch sử trong vài giây, không phải cào lại. Ở `crapper` đây là
  lệnh giá trị nhất; ở đây còn giá trị hơn vì có 4 nguồn.

---

## 5. Đường đi của dữ liệu

```
DISCOVER ─► FETCH ─► EXTRACT ─► NORMALIZE ─► DEDUPE ─► UPSERT ─► AGGREGATE
   │          │         │           │           │         │          │
API/sitemap  1 req   JSON-LD    lương->VND/th  fingerprint  DB    SalaryStat
/trang list  2s/lần  hoặc       skill->alias   + trigram          (cron đêm)
             cheerio            địa danh->tỉnh
                                level từ title
                                                  REAPER: job vắng mặt
                                                  3 lần liên tiếp -> CLOSED
```

Vẫn giữ nguyên tắc của `crapper`: **crawler chỉ ghi, web chỉ đọc.** Không có
đường nào từ lượt truy cập của người dùng đi thẳng ra sàn nguồn.

Cấu trúc `src/crawler/sources/` theo đúng mẫu bộ đọc-theo-nguồn đã làm ở
`crapper` (`registry.ts` + `types.ts` + một file mỗi sàn): mỗi nguồn tự khai báo
cách phát hiện URL, cách bóc tách, độ ưu tiên. Thêm sàn thứ 5 = thêm một file.

### Bốn chỗ khó thật sự

**1. Chuẩn hoá lương.** Đầu vào hỗn loạn: `"15 - 20 triệu"`, `"Upto 60tr"`,
`"$2000-3000"`, `"Thoả thuận"`, `"Cạnh tranh"`, `"Lương cứng 8tr + hoa hồng"`.
Quy tắc: quy hết về VND/tháng; USD nhân tỷ giá **lưu kèm ngày quy đổi**; không
có số → `salaryIsPublic = false` chứ **không phải `salaryMin = 0`** (0 sẽ phá
nát mọi trung vị). Ngoài khoảng 1–500 triệu → cờ chờ duyệt tay, y như `BR-07`.

**2. Khử trùng lặp.** Hai vòng: (a) khoá cứng `companyNorm|titleNorm|province`
bắt được ~70%; (b) phần còn lại dùng `pg_trgm` `similarity(titleNorm) > 0.8`
cùng công ty cùng tỉnh. Bẫy: công ty môi giới đăng hộ (tên công ty khác nhau,
JD giống hệt) — bắt bằng similarity trên `descriptionHtml` đã tước thẻ.

**3. Suy ra cấp bậc.** `level` hiếm khi có sẵn, phải suy từ tiêu đề + số năm kinh
nghiệm. Từ khoá tiếng Việt lẫn tiếng Anh (`"trưởng nhóm"`, `"lead"`, `"thực
tập"`, `"fresher"`). Sai ở đây làm hỏng thống kê lương → cần test riêng.

**4. Địa danh sau sáp nhập.** JSON-LD TopCV trả `addressLocality: "Phường Long
Biên"` — cấp phường, không phải quận. Cần bảng ánh xạ phường/xã → tỉnh/thành
theo đơn vị hành chính hiện hành, cập nhật được bằng dữ liệu chứ không hard-code
trong parser.

---

## 6. Lộ trình — ⚠️ ĐÃ THAY, dùng [TECHSTACK.md §9](TECHSTACK.md)

> Bảng dưới đây là bản đầu, viết khi còn nghĩ theo mô hình "4 sàn cố định". Sau
> khi khảo sát sâu thì chặng quan trọng nhất hoá ra là **lớp sitemap-discovery +
> parser JSON-LD dùng chung** — làm xong nó thì thêm nguồn gần như miễn phí, nên
> nó phải nằm ở chặng 2 chứ không phải rải rác về sau. Giữ bảng này để đối chiếu.

| Chặng | Nội dung | Xong là có |
|---|---|---|
| **0** | `create-next-app` + Prisma + Neon + Tailwind/shadcn, bê `core/components` từ `crapper` | Khung chạy được |
| **1** | Nguồn VietnamWorks (API JSON) + schema + `CrawlRun` + `reparse` | ~10k job trong DB sau một buổi tối |
| **2** | Trang tìm kiếm: FTS + lọc theo tỉnh/skill/lương/level | Đã dùng được |
| **3** | Nguồn TopCV + ITviec (JSON-LD) | 3 nguồn, bắt đầu có trùng lặp thật để xử lý |
| **4** | Khử trùng lặp (`JobGroup`) + reaper vòng đời | "Việc này đăng ở 3 nơi, lương lệch nhau" |
| **5** | `SalaryStat` + biểu đồ lương/skill theo thời gian | **Phần khác biệt thật sự của sản phẩm** |
| **6** | `SavedAlert` qua email/Telegram | Người dùng quay lại |
| **7** | CareerViet, API mở, xuất CSV, `/api/health` | Đủ đầy |

Chặng 1–2 là bản chạy được nhỏ nhất. Chặng 5 là lý do dự án tồn tại — đừng để nó
tụt xuống cuối rồi bỏ dở.

---

## 7. Quy tắc lịch sự & pháp lý

Chép nguyên tinh thần đã áp dụng ở `crapper`, cài cứng trong `fetcher.ts`:

- Nghỉ **≥ 2 giây** giữa hai request, mỗi lúc **một** request cho mỗi tên miền
- User-Agent định danh kèm email liên hệ — không giả làm Chrome
- Gặp **429/503 → dừng cả phiên**, không thử lại dồn dập
- Tôn trọng `robots.txt` (đã đối chiếu ở §2), không đụng khu vực hồ sơ/CV
- Không tải logo về máy chủ, hotlink qua `next/image` `remotePatterns`
- Tin đã lấy thành công thì không tải lại, trừ khi cần kiểm `contentHash`

**Về bản quyền:** *sự kiện* (tên công ty, mức lương, địa điểm, ngày đăng) không
thuộc phạm vi bảo hộ quyền tác giả — thống kê thoải mái. *Văn bản mô tả công
việc* thì có. Vì vậy: lưu toàn văn để **máy** phân tích, nhưng **hiển thị tối đa
2–3 câu trích dẫn + nút "Xem tin gốc trên <sàn>"**. Mọi bảng và biểu đồ đều có
dòng ghi nguồn. Đây vừa đúng luật vừa đúng đạo — và tiện là nó cũng khiến các
sàn không có động cơ chặn ta, vì ta đẩy lượt truy cập về cho họ.

**Về dữ liệu cá nhân:** JD đôi khi lộ tên/điện thoại/email người tuyển dụng.
Phải lọc bỏ ở bước chuẩn hoá trước khi lưu — Nghị định 13/2023 về bảo vệ dữ liệu
cá nhân áp dụng cho cả dữ liệu thu thập công khai.

---

## 8. Rủi ro

| Rủi ro | Xác suất | Cách giảm |
|---|---|---|
| VietnamWorks đóng API công khai | Trung bình | `rawPayload` giữ lại dữ liệu đã lấy; có sẵn 3 nguồn HTML thay thế |
| Sàn đổi HTML, parser chết im lặng | **Cao** | `/api/health` trả **503** khi không có tin mới quá 24h (đúng như `crapper`); test parser trên fixture thật |
| Cloudflare bật lên cho TopCV/ITviec | Trung bình | Giữ nhịp cào thấp và UA trung thực để không kích hoạt; dự phòng: chuyển nguồn đó sang chạy trên Actions với Playwright |
| Khử trùng lặp gộp nhầm hai việc khác nhau | Cao lúc đầu | `JobGroup` tách rời tin gốc → gỡ nhóm được; có trang admin duyệt tay như `crapper` |
| Neon gói miễn phí hết dung lượng vì `descriptionHtml` | Trung bình | Nén, hoặc xoá `rawPayload` của tin `CLOSED` quá 180 ngày sau khi đã chốt thống kê |

---

## Phụ lục — lệnh đã dùng để khảo sát

```bash
# robots.txt (chú ý: topcv/vietnamworks trả 301 nếu thiếu www)
curl -sSL -A "Mozilla/5.0" https://www.topcv.vn/robots.txt
curl -sSL -A "Mozilla/5.0" https://itviec.com/robots.txt
curl -sSL -A "Mozilla/5.0" https://careerviet.vn/robots.txt

# API VietnamWorks — không cần auth
curl -sS -X POST https://ms.vietnamworks.com/job-search/v1.0/search \
  -H "Content-Type: application/json" \
  -d '{"query":"","filter":[],"ranges":[],"order":[],"hitsPerPage":2,"page":0}'

# Kiểm tra JSON-LD JobPosting của một trang chi tiết
curl -sSL -A "Mozilla/5.0 ... Chrome/126" "<url job>" -o job.html
node -e "const h=require('fs').readFileSync('job.html','utf8');
 const re=/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g; let m;
 while((m=re.exec(h))){ console.log(JSON.parse(m[1])['@type']); }"
```

Chạy lại toàn bộ phụ lục này **trước khi bắt đầu chặng 1** — số liệu ở §2 chỉ
đúng tại ngày 24/08/2026.
