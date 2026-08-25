# Bae-Job

Thu thập tin tuyển dụng từ nhiều nguồn, **đảm bảo tin còn hiệu lực**, thống kê
theo **ngành nghề do người dùng tự định nghĩa**.

Thiết kế và toàn bộ căn cứ nằm ở [PLAN.md](PLAN.md) và [TECHSTACK.md](TECHSTACK.md).
README này chỉ nói cách chạy.

> **Trạng thái: lõi crawler đã xong, chưa có giao diện web.**
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
| `npm test` | 101 test, chạy trên fixture JSON-LD **thật** của 3 sàn |
| `npm run typecheck` | `tsc --noEmit` |

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
├─ constants/{crawl,source}/  quy tắc lịch sự · 6 nguồn đã khảo sát thật
├─ enums/                    JobStatus · Level · SourceKind · ...
└─ api/db.ts
```

**Chưa có:** giao diện web, máy kiểm còn-sống tầng 3–4 (`recheck`), khử trùng
lặp `JobGroup`, `SalaryStat`, tìm kiếm vector. Xem lộ trình ở
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
