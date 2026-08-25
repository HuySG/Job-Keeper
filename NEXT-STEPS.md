# Các bước còn thiếu — theo phạm vi đã chốt

> **Phạm vi:** crawler cá nhân. Cào tin tuyển dụng, **lọc theo đúng ngành nghề
> mình muốn**, đảm bảo tin còn sống. KHÔNG phải trang thống kê lương công cộng.
>
> Điều này đổi thứ tự so với [TECHSTACK.md §9](TECHSTACK.md): bộ lọc "ngành của
> tôi" từ chặng 5 nhảy lên thành **việc chính**, còn `SalaryStat` / API mở /
> xuất CSV tụt xuống hàng tuỳ chọn.

## Bỏ khỏi phạm vi (nói rõ để anh phản đối được)

| Việc | Vì sao bỏ |
|---|---|
| Trang web công cộng | Một người dùng thì không cần |
| `SalaryStat` + biểu đồ lương theo thời gian | Là tài sản của sản phẩm công cộng, không phải của người đi tìm việc |
| API mở, xuất CSV | Không có ai gọi |
| Khử trùng lặp `JobGroup` xuyên sàn | Vẫn cần, nhưng **hạ ưu tiên**: chỉ chạy trên tập tin ĐÃ LỌC (vài trăm) chứ không phải toàn kho (vài chục nghìn) |

Nếu sau này muốn mở thành sản phẩm công cộng thì mọi thứ vẫn còn nguyên trong
schema — chỉ là chưa dùng đến.

---

# ✅ Đã xong

- Lõi crawler: fetcher lịch sự, bóc JSON-LD, chuẩn hoá lương/cấp bậc/địa danh
- 4 nguồn chạy thật: **VietnamWorks, TopDev, ITviec, vieclam24h**
- 102 test trên fixture JSON-LD thật của 3 sàn
- `npm run probe` — dò nguồn không cần CSDL

---

# BƯỚC 1 — Dựng CSDL  ⏱️ 10 phút · **anh làm**

Đây là thứ **duy nhất** đang chặn đường. Mọi phần đụng DB mới qua typecheck,
chưa chạy lần nào.

1. Vào [neon.tech](https://neon.tech) → đăng ký (miễn phí, không cần thẻ)
2. **Create project** → chọn region **Singapore** (gần Việt Nam nhất)
3. Ở màn hình Connection string, chọn **Pooled connection** (chuỗi có `-pooler`
   trong tên host — chọn nhầm chuỗi direct là sau này crawler sẽ hết kết nối)
4. Dán vào `.env`:

```
DATABASE_URL="postgresql://...-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

**Xong bước này báo tôi** — tôi chạy `db:push` → `db:seed` → `crawl` thật và
báo lại số liệu.

---

# BƯỚC 2 — Chạy thật lần đầu  ⏱️ 30 phút · **tôi làm**

```bash
npm run db:push     # tạo bảng
npm run db:seed     # 4 nguồn + 34 tỉnh/thành + bí danh tên cũ
npm run crawl -- --source vnw --full
```

Việc thật của bước này không phải gõ 3 lệnh, mà là **sửa những gì vỡ ra khi
lần đầu ghi vào DB**. Dự đoán chỗ sẽ vỡ:

- `upsertCompany` chạy đua khi hai tin cùng công ty vào gần nhau
- Ràng buộc unique trên `CompanyAlias.raw` khi hai công ty chuẩn hoá về cùng khoá
- Ngày tháng lệch múi giờ khi Postgres lưu `timestamptz`

Kết quả mong đợi: **~10.000 tin VietnamWorks** trong DB, rồi thêm 3 nguồn kia.

---

# BƯỚC 3 — Bộ lọc "ngành nghề tôi muốn"  ⏱️ 1 ngày · **tôi làm, anh dạy máy**

**Đây là việc chính của cả dự án.** Không có bước này thì 10.000 tin chỉ là
một đống rác lớn hơn TopCV.

### Vì sao không dùng từ khoá

Anh gõ *"cơ khí"*. Tin viết *"kỹ sư chế tạo máy"*, *"CNC operator"*, *"bảo trì
thiết bị"*, *"QC cơ khí"*, *"thiết kế khuôn mẫu"*. Khớp từ khoá bắt được chưa
tới một nửa.

### Cách làm — ba tầng, dựng theo thứ tự

**3a. Bật extension + FTS** (~2 giờ)
```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
```
Cột `tsvector` sinh sẵn trên `title + descriptionText`, index GIN. Dùng cấu hình
`simple` + `unaccent` — Postgres không có bộ tiếng Việt, nhưng tiếng Việt gần
như không biến hình nên `simple` chạy tốt bất ngờ.

**3b. Nhúng vector** (~4 giờ)
- Thêm `scripts/embed.ts`: chạy `multilingual-e5-small` qua `transformers.js`
  **ngay trên máy**, không gọi API, không tốn tiền
- Nhúng `title + skills + 500 ký tự đầu mô tả` → cột `embedding vector(384)`
- Chạy theo lô 10.000 tin ≈ vài phút

> Lưu ý: schema đang khai `vector(1024)`. `multilingual-e5-small` ra 384 chiều —
> sẽ sửa lại schema khi chốt mô hình. Nhỏ hơn = nhanh hơn và đủ dùng cho tiếng Việt.

**3c. Dạy máy "ngành của tôi"** (~2 giờ) ← **chỗ anh phải làm**

Không phải chọn từ dropdown. Cách làm:

```bash
npm run field -- --new "backend-python"     # tạo một "ngành"
npm run field -- --teach backend-python     # hiện tin ngẫu nhiên, anh gõ y/n
```

Anh đánh dấu **10–20 tin** là đúng ý / không đúng ý. Hệ thống lấy **trọng tâm
vector** của các tin "đúng" làm định nghĩa ngành, lưu vào `UserField.centroid`.

Từ đó:
```bash
npm run jobs -- --field backend-python --new
```
→ chỉ những tin nằm trong bán kính cosine quanh trọng tâm đó.

**Càng đánh dấu, càng chuẩn.** Đây là thứ không sàn nào làm được, vì họ bị khoá
vào cây danh mục của chính họ.

---

# BƯỚC 4 — Đảm bảo tin còn sống (tầng 3–4)  ⏱️ nửa ngày · **tôi làm**

Tầng 1–2 đã có (`validThrough`, vắng khỏi sitemap). Còn thiếu `scripts/recheck.ts`:

| Tầng | Cách | Chi phí |
|---|---|---|
| 3 | Conditional GET (`ETag`/`If-Modified-Since`) → 304 | rất rẻ |
| 4 | GET thật → 404/410, mất khối JSON-LD, hoặc có chữ "đã hết hạn" | đắt |

Chỉ gọi tầng 4 cho tin thoả **một** trong ba: sắp hết `validThrough` (≤3 ngày),
đã vắng sitemap, hoặc >7 ngày chưa kiểm.

→ ~500–1.000 request/ngày thay vì 10.000.

Với phạm vi cá nhân còn rẻ hơn nữa: **chỉ kiểm tin nằm trong ngành anh quan
tâm**, tức vài trăm tin chứ không phải cả kho.

```bash
npm run recheck -- --field backend-python
```

---

# BƯỚC 5 — Cách xem  ⏱️ 1 ngày · **tôi làm** · *chọn một*

| Cách | Được | Mất |
|---|---|---|
| **A. CLI** `npm run jobs` | Xong trong 2 giờ. Đủ cho một người | Không xem được trên điện thoại |
| **B. Next.js một trang** | Xem được mọi nơi, lọc bằng chuột | Mất 1 ngày, phải deploy |
| **C. Đẩy thẳng vào Telegram** | Không cần mở gì cả, tin tự tới | Khó xem lại tin cũ |

**Gợi ý: A trước, rồi C.** B chỉ làm khi thật sự thấy thiếu — với một người
dùng thì giao diện web thường là công sức đổ vào chỗ không ai nhìn.

---

# BƯỚC 6 — Cảnh báo tin mới  ⏱️ nửa ngày · **tôi làm**

Sau mỗi lần crawl, tin mới nào rơi vào ngành anh đã dạy thì đẩy đi:

- **Telegram bot** — đơn giản nhất, không cần dịch vụ email, không vào spam
- Kèm: tiêu đề · công ty · lương · nơi làm · link

---

# BƯỚC 7 — Tự chạy  ⏱️ 2 giờ · **tôi làm**

`.github/workflows/crawl.yml` — chạy mỗi 3 giờ:

```
crawl 4 nguồn → embed tin mới → lọc theo ngành → recheck → báo Telegram
```

Repo để **public** thì GitHub Actions miễn phí không giới hạn phút. Nhớ để
`DATABASE_URL` trong repo secrets, đừng commit.

**Không dùng `pg_cron`**: trên Neon nó chỉ chạy khi compute thức, gói Free ngủ
sau vài phút và job sẽ **im lặng không chạy**.

---

# Tóm tắt thứ tự

```
1. Neon URL          ← ANH, 10 phút, đang chặn tất cả
2. Chạy thật         ← tôi, 30 phút
3. Bộ lọc ngành      ← tôi + ANH dạy máy, 1 ngày   ★ việc chính
4. Kiểm còn sống     ← tôi, nửa ngày
5. Cách xem          ← tôi, 2 giờ (CLI)
6. Cảnh báo Telegram ← tôi, nửa ngày
7. Tự chạy           ← tôi, 2 giờ
```

**Sau bước 3 là đã dùng được thật.** Bước 4–7 là làm cho nó tự chạy mà không
cần anh nhớ tới nó.

---

# Hai việc treo, cần anh quyết

**1. TopCV** — bị chặn ở tầng dấu vân tay TLS (curl 200 9/9, Node fetch 403 6/6),
dù robots.txt của họ CHO PHÉP. Vượt qua đòi hỏi nguỵ trang thành trình duyệt,
tức né tránh phát hiện — tôi cố ý không làm. Chọn: viết thư xin phép / bỏ qua /
anh tự quyết dùng thư viện giả vân tay.

**2. Chiều rộng nguồn** — hiện 4 nguồn, nghiêng hẳn về IT (TopDev, ITviec).
Nếu ngành anh nhắm **không phải IT** thì phải thêm nguồn trước bước 3, nếu
không bộ lọc sẽ không có gì để lọc. Cho tôi biết ngành nào, tôi khảo sát nguồn
phù hợp — đây đúng là việc mà Serper (2.500 lượt miễn phí) làm tốt: trinh sát
nguồn ngách.
