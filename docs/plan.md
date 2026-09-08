# Kế hoạch — Thu thập việc làm **PURCHASING** tại **TP. Hồ Chí Minh**, chỉ tin **CÒN TUYỂN**

> Viết ngày **08/09/2026**. Mọi con số trong tài liệu này là **đo thật** bằng
> `curl` / `npm run db:inspect` trong ngày, không phải ước lượng. Chỗ nào đoán
> thì ghi rõ "chưa đo".
>
> Tài liệu này **không thay** [PLAN.md](../PLAN.md) (kiến trúc tổng) hay
> [NEXT-STEPS.md](../NEXT-STEPS.md) (lộ trình chung). Nó là **một nhiệm vụ hẹp**:
> lấy cho bằng được tập tin purchasing ở TP.HCM và bảo đảm tập đó còn sống.

> **Cập nhật 08/09/2026 — đã thi công chặng 1–5.** Xem §12 ở cuối để biết cái
> gì đã chạy thật, số đo ra sao, và hai chỗ kế hoạch này đã SAI so với thực tế.

---

## 0. Nghiệm thu — thế nào là XONG

Ba điều kiện, đủ cả ba mới tính là xong:

| # | Điều kiện | Cách đo |
|---|---|---|
| **N1** | ≥ **150 tin** purchasing tại TP.HCM trong DB | `npm run db:inspect` + truy vấn lọc |
| **N2** | **≥ 95%** số tin hiển thị có `status = OPEN` **và** `lastCheckedAt` trong vòng **48 giờ** | truy vấn kiểm |
| **N3** | Lấy ngẫu nhiên **30 tin**, mở tay: **≥ 27 tin** (90%) đúng là việc purchasing **và** còn nhận hồ sơ | kiểm tay, ghi vào `docs/audit-thu-mua.md` |

N3 là điều kiện quan trọng nhất và là điều kiện duy nhất không tự động hoá được.
Không có nó thì N1/N2 chỉ là con số đẹp về một đống rác.

---

## 1. Hiện trạng đã đo (08/09/2026)

```
┌─ 218 tin · 143 công ty          (npm run db:inspect)
│  có lương công khai   108  50%
│  có gắn địa điểm      243  111%   (một tin có thể ở nhiều tỉnh)
│  có blob để reparse   218  100%
│  parse PARTIAL          0   0%
│  đã hết hạn            33  15%
└──────────────────────────────────
Theo nguồn:  vnw 100 · topdev 40 · vieclam24h 40 · itviec 38
Top tỉnh:    TP.HCM 98 · Hà Nội 80 · Quảng Ninh 15 · ...
```

Đọc ra ba điều:

1. **Kho hiện tại gần như không có purchasing.** 78/218 tin đến từ TopDev +
   ITviec — hai sàn thuần IT, không có thu mua. Phần còn lại là kết quả quét
   *ngẫu nhiên* 100 tin mới nhất của VietnamWorks và 40 URL đầu sitemap
   vieclam24h. Không có bất kỳ sự nhắm mục tiêu nào.
2. **Lõi crawler đã chạy được thật** — 100% tin có blob, 0% parse hỏng. Nghĩa
   là việc phải làm là **nhắm đúng chỗ**, không phải viết lại máy móc.
3. **15% tin trong kho đã hết hạn** dù mới cào hai tuần. Đây chính là lý do
   điều kiện "còn tuyển dụng" phải là một tầng riêng chứ không phải hy vọng.

---

## 2. Định nghĩa "PURCHASING" — phải là DỮ LIỆU, không phải chuỗi if

Đây là quyết định gốc. Sai ở đây thì mọi thứ phía sau vô nghĩa.

### 2.1 Vì sao không dùng một từ khoá

Gõ `"thu mua"` trên VietnamWorks: **407 tin**. Nhưng cùng một nghề còn được
viết là *mua hàng*, *procurement*, *purchasing*, *sourcing*, *merchandiser*,
*vật tư*, *cung ứng*, *đấu thầu*, *vendor*. Đo thật trên API VNW hôm nay:

| Từ khoá | Số tin trả về |
|---|---|
| `mua hang` | **1.258** |
| `purchasing` | **1.200** |
| `procurement` | **849** |
| `cung ung` | **474** |
| `thu mua` | **407** |
| `sourcing` | **351** |
| `merchandiser` | **112** |

Một từ khoá bắt được chưa tới một phần ba nghề. Nhưng chú ý: các con số này là
**độ phủ thô**, chưa lọc — `"mua hang"` nuốt cả *"nhân viên tư vấn mua hàng"*
(thật ra là sales) và *"kế toán mua hàng"* (thật ra là kế toán).

→ **Chiến lược hai thì: nguồn cho ĐỘ PHỦ, ta lọc cho ĐỘ CHÍNH XÁC.**

### 2.2 Từ điển (bản đề xuất — cần anh duyệt ở §10)

**A. Nhận** (khớp bất kỳ; xét `title` trước, `descriptionText` sau):

```
thu mua · mua hàng · thu mua vật tư · nhân viên vật tư · quản lý vật tư
purchasing · purchaser · procurement · buyer · sourcing · strategic sourcing
merchandiser · merchandise · vendor management · supplier quality · SQE
cung ứng · chuỗi cung ứng · supply chain · category buyer · commodity
đấu thầu · thầu mua sắm · mua sắm · tender · quotation · nhà cung cấp
```

**B. Loại** (bất kỳ từ nào khớp trong TIÊU ĐỀ là loại thẳng):

```
bán hàng · kinh doanh · telesale · tư vấn mua hàng · chăm sóc khách hàng
thủ kho · nhân viên kho · phụ kho · bốc xếp · giao hàng · tài xế · lái xe
kế toán kho · kế toán mua hàng · giao nhận · shipper · đóng gói
```

**C. Xám** (cần người quyết — xem §10): `logistics`, `xuất nhập khẩu`,
`kho vận`, `điều phối`, `planner`, `MRP`. Đây là nghề *cạnh* purchasing:
lấy hết thì phồng lên khoảng gấp đôi, bỏ hết thì mất mảng
"supply chain có làm mua hàng".

### 2.3 Lưu ở đâu

Schema **đã có sẵn** model `SavedFilter` (`keywords`, `excludes`, `provinces`,
`levels`, `salaryMin`, `maxAgeDays`) — và **hiện chưa có một dòng code nào dùng
nó** (đã grep toàn repo: 0 chỗ). Nó là cái bình rỗng đúng hình dạng ta cần.

→ Nhiệm vụ này **rót nước vào bình đó**, không đẻ ra khái niệm mới:

```
SavedFilter { slug: "thu-mua-hcm", name: "Thu mua — TP.HCM",
              keywords: [danh sách A], excludes: [danh sách B],
              provinces: ["ho-chi-minh"], includeNoSalary: true, maxAgeDays: 90 }
```

Sửa từ điển = `UPDATE` một dòng SQL, **không deploy**. Đây đúng là nguyên tắc
"nguồn/ngành là dữ liệu" mà [constants/source](../src/constants/source/index.ts)
đã theo.

---

## 3. Định nghĩa "TP. HỒ CHÍ MINH" — cái bẫy sáp nhập 2025

[`src/crawler/normalize/location.ts:38`](../src/crawler/normalize/location.ts#L38)
đang gộp **Bình Dương** và **Bà Rịa – Vũng Tàu** vào slug `ho-chi-minh`:

```ts
aliases: ['tphcm','tp hcm','hcm','sai gon','saigon','ho chi minh city','sg',
          'binh duong','ba ria vung tau','ba ria - vung tau','vung tau','thu dau mot']
```

Đúng theo đơn vị hành chính sau sáp nhập. Nhưng với người đi làm thì
**Thủ Đức và Bến Cát là hai thế giới đi lại khác nhau**.

**Quyết định mặc định (đảo ngược được):** giữ nguyên bảng — `ho-chi-minh` =
HCM mở rộng. Lý do: đây là DỮ LIỆU chuẩn hoá dùng chung, đổi nó là đổi cho
toàn bộ dự án chứ không riêng nhiệm vụ này.

**Cách lọc hẹp mà không đụng bảng:** `JobLocation.rawText` giữ nguyên chuỗi gốc
trong tin (đúng mục đích cột này được đẻ ra). Muốn "chỉ HCM cũ" thì lọc thêm
`rawText NOT ILIKE '%bình dương%' AND rawText NOT ILIKE '%vũng tàu%'`.
Sẽ dựng thành cờ `--strict-hcm` ở chặng 5, mặc định TẮT.

Ghi chú đã đo: trang chi tiết vieclam24h trả `addressRegion: "Ho Chi Minh City"`,
`addressLocality: "Thủ Đức"` — cả hai đều đã nằm trong bảng tra, không phải vá.

---

## 4. Định nghĩa "CÒN TUYỂN DỤNG" — điều kiện anh đặt ra

Đây là chỗ nhiệm vụ này khác một lần cào thường. Máy kiểm 4 tầng đã thiết kế ở
TECHSTACK.md §4; hiện trạng thật:

| Tầng | Tín hiệu | Chi phí | Hiện trạng |
|---|---|---|---|
| **1** | `validThrough` đã qua → `EXPIRED` | 0 request | ✅ **đã có** — `deriveStatus()` trong [pipeline.ts](../src/crawler/pipeline.ts) |
| **2** | Vắng khỏi sitemap → `missCount++` → `STALE` → `CLOSED` | ~0 | ⚠️ **có nhưng không dùng được cho nhiệm vụ này** — xem 4.1 và 4.2 |
| **3** | Conditional GET (`ETag`/`If-Modified-Since`) → 304 = không đổi | rất rẻ | ❌ **cột đã có** (`etag`, `lastModifiedHdr`), **chưa có script gọi** |
| **4** | GET thật → 404/410, mất khối JSON-LD, hoặc có chữ "đã hết hạn" | đắt | ❌ **chưa có** — `scripts/recheck.ts` chưa tồn tại |

### 4.1 BẪY LỚN — `reapMissing` sẽ đóng nhầm cả kho

[`pipeline.ts`](../src/crawler/pipeline.ts) chỉ đóng tin vắng mặt khi chạy
`--full`, và nó so **toàn bộ tin còn sống của nguồn** với tập `seen` của lượt
quét. Nhiệm vụ này quét **có nhắm mục tiêu** (chỉ purchasing + HCM), nên tập
`seen` cố tình chỉ là một góc nhỏ của sàn.

> Chạy `npm run crawl -- --source vnw --full` sau khi đã bật nhắm mục tiêu =
> **đóng sạch mọi tin không phải purchasing** của VietnamWorks với lý do
> `missing_from_sitemap`. Sai lặng lẽ, không báo lỗi, không exit khác 0.

**Bắt buộc sửa trước khi bật nhắm mục tiêu** — việc **C4** ở §7.

### 4.2 Đo thật: vì sao vieclam24h KHÔNG được tin tầng 2

Đo `cdn1.vieclam24h.vn/file/sitemap/job/tintuyendung-0.xml` hôm nay:

- **4.180 URL**, `lastmod` của **tất cả** đều là `2026-07-28T00:13:4x` —
  tức là **dấu thời gian sinh file**, không phải ngày tin đổi.
- File tên "**daily**" nhưng chưa sinh lại từ **28/07** — **hơn 6 tuần**.

Hai hệ quả, cả hai đều nghiêm trọng cho điều kiện "còn tuyển":

1. **Crawl tăng dần chết câm.** `walkSitemap` bỏ URL có `lastmod` cũ hơn mốc.
   Sau lần chạy đầu, mọi lần sau đều thấy 0 URL từ nguồn này — im lặng, không
   báo lỗi. Phải **tắt lọc `modifiedSince`** cho riêng nguồn này.
2. **Tầng 2 vô giá trị ở nguồn này.** Sitemap đóng băng thì "còn thấy trong
   sitemap" không nói gì về việc tin còn sống. Bằng chứng cụ thể — mở một tin
   purchasing lấy thẳng từ sitemap đó:

   ```
   vieclam24h.vn/thu-mua-kho-van-chuoi-cung-ung/truong-phong-mua-hang-c14p122id200731476.html
   → HTTP 200 (397 KB), JSON-LD JobPosting VẪN CÒN
   → datePosted 2026-07-13 · validThrough 2026-08-09   ← ĐÃ QUA 30 NGÀY
   → trong trang: "Việc làm này đã hết hạn nộp hồ sơ"
   ```

   Tin chết mà trả 200 và vẫn còn JSON-LD. Chỉ tầng 1 (`validThrough`) và
   tầng 4 (chữ trong trang) bắt được nó.

3. **Lỗ hổng trong danh sách dấu hiệu.** `EXPIRY_TEXT_MARKERS` ở
   [constants/crawl](../src/constants/crawl/index.ts) có `'việc làm đã hết hạn'`
   nhưng trang thật viết `"Việc làm **này** đã hết hạn nộp hồ sơ"` — **không
   khớp**. Phải thêm mẫu: việc **C5** ở §7.

### 4.3 Riêng VietnamWorks thì gần như miễn phí

VNW trả thẳng `isActive`, `isOnline`, `expiredOn` trong mỗi bản ghi API
(adapter đã đọc `isActive`/`isOnline`). Với nguồn này, "còn tuyển" là lời khai
của chính sàn chứ không phải suy đoán — chỉ cần gọi lại API là biết. Đây là lý
do VNW là nguồn **ưu tiên số 1** cho nhiệm vụ này.

---

## 5. Luồng đi

```
                    ┌───────────────────────────────────────────┐
                    │  SavedFilter "thu-mua-hcm"  (DỮ LIỆU)     │
                    │  keywords · excludes · provinces          │
                    └───────────┬───────────────────────────────┘
                                │ nạp vào cả hai đầu
            ┌───────────────────┴────────────────────┐
            ▼                                        ▼
┌───────────────────────────┐          ┌──────────────────────────────┐
│ ① NHẮM NGUỒN (thu hẹp)    │          │ ④ LỌC LẠI (chính xác)        │
│                           │          │                              │
│ vnw   → API query[]       │          │ title khớp A?  → nhận        │
│ v24h  → URL c14p122       │          │ title khớp B?  → loại        │
│ khác  → tắt cho luồng này │          │ mô tả khớp A?  → nhận (yếu)  │
└─────────┬─────────────────┘          └──────────┬───────────────────┘
          ▼                                       ▲
┌───────────────────────────┐                     │
│ ② FETCH + PARSE (đã có)   │                     │
│ fetcher lịch sự → JSON-LD │                     │
│ → normalize → blob        │                     │
└─────────┬─────────────────┘                     │
          ▼                                       │
┌───────────────────────────┐                     │
│ ③ UPSERT (đã có)          │─────────────────────┘
│ + JobLocation → tỉnh      │
│ + status tầng 1           │
└─────────┬─────────────────┘
          ▼
┌────────────────────────────────────────────────────────────┐
│ ⑤ MÁY KIỂM CÒN-SỐNG   (scripts/recheck.ts — PHẢI VIẾT)     │
│                                                            │
│   chọn tin: thuộc SavedFilter ∧ (sắp hết hạn ≤3 ngày        │
│             ∨ missCount>0 ∨ lastCheckedAt >7 ngày)          │
│   tầng 3: conditional GET → 304 thì thôi                   │
│   tầng 4: GET thật → 404/410 · mất JSON-LD · chữ hết hạn   │
│           · validThrough đã qua                            │
│   ghi: status · statusReason · lastCheckedAt · JobAudit    │
└─────────┬──────────────────────────────────────────────────┘
          ▼
┌───────────────────────────┐     ┌──────────────────────────┐
│ ⑥ XEM  /viec?q=…          │     │ ⑦ TỰ CHẠY (Actions)      │
│ hoặc trang /thu-mua       │     │ mỗi 6h: crawl → recheck  │
└───────────────────────────┘     └──────────────────────────┘
```

Nguyên tắc cứng giữ nguyên từ [pipeline.ts](../src/crawler/pipeline.ts):
**crawler chỉ ghi, web chỉ đọc**. Không có đường nào từ lượt xem của anh đi
thẳng ra sàn nguồn.

---

## 6. Nhắm nguồn — từng nguồn một, kèm bằng chứng

### 6.1 `vnw` — VietnamWorks · **ưu tiên 1** · đã đo ✅

- **Cách nhắm:** API nhận `query` là chuỗi tự do. Đo thật hôm nay:
  `POST ms.vietnamworks.com/job-search/v1.0/search` với `{"query":"thu mua",...}`
  → HTTP 200, **407 tin**, bản ghi đầu là *"Trưởng Phòng Mua Hàng
  (Procurement Manager)"*. Đúng thứ cần.
- **Đã thử và THẤT BẠI:** lọc địa điểm phía nguồn. Thử 4 tên trường
  (`workingLocationsCityId`, `cityId`, `locationId`, `cityIds`) — trường nào
  cũng trả `nbHits: 0`; `value` phải là chuỗi, truyền mảng thì HTTP 400.
  → **Không lọc HCM ở nguồn.** Lấy rộng rồi lọc bằng bảng địa danh của mình —
  cách này còn *tốt hơn*, vì nó gộp đúng Bình Dương/BRVT theo §3.
- **Việc phải làm:** `Source.config.queries = [...]`, adapter lặp từng query.
  ~9 query × 50 tin/trang × vài trang ≈ **50–100 request** cho một lần chạy.
- **Rủi ro:** nhắm bằng `query` làm hỏng mốc crawl tăng dần
  (`lastSuccessfulRun` không phân biệt query nào đã chạy). Chấp nhận ở bản đầu:
  chạy `--full` cho nhánh purchasing, đừng trộn với lượt quét chung.

### 6.2 `vieclam24h` — **ưu tiên 2** · đã đo ✅ · phát hiện đáng giá nhất

**URL tin của họ tự khai ngành và tỉnh:**

```
vieclam24h.vn/thu-mua-kho-van-chuoi-cung-ung/truong-phong-mua-hang-c14p122id200731476.html
                                                                   └┬┘└─┬┘└──┬──┘
                               c14 = thu mua–kho vận–chuỗi cung ứng ┘    │    │
                                              p122 = TP. Hồ Chí Minh ────┘    │
                                                          id tin ─────────────┘
```

Nghĩa là lọc được **ngay ở tầng sitemap, 0 request thừa**, chỉ bằng một regex.
Đo thật trên `tintuyendung-0.xml` (1 trong 4 file, 4.180 URL):

| Lọc | Số URL |
|---|---|
| tất cả | 4.180 |
| `p122` (mọi ngành, TP.HCM) | 1.974 |
| `c14p…` (thu mua, mọi tỉnh) | 119 |
| **`c14p122`** (thu mua **+** TP.HCM) | **50** |

Ngoại suy 4 file: **~200 URL** đúng đích — thay vì tải ~16.700 trang chi tiết
để rồi vứt 99%. Tiết kiệm ~98% ngân sách request.

- **Cảnh báo:** `c14` là *"Thu mua – Kho vận – Chuỗi cung ứng"*, **rộng hơn**
  purchasing. Mẫu thật lẫn cả *"nhân viên kho hàng"*, *"thực tập sinh kế toán"*.
  → `c14p122` cho **độ phủ**, từ điển §2 lọc lại cho **độ chính xác**. Hai tầng
  tách bạch, không lẫn lộn.
- **Bắt buộc kèm theo:** tắt lọc `modifiedSince` (§4.2) và không tin tầng 2.
- Cũng đã dò: có `nganhtinh-0.xml` liệt kê sẵn trang danh sách ngành×tỉnh
  (`viec-lam-thu-mua-kho-van-chuoi-cung-ung-tai-tp-hcm-o14p122.html`, HTTP 200,
  20 tin/trang, không có JSON-LD ở trang danh sách). **Không dùng** — đường
  sitemap ở trên rẻ hơn và không phải phân trang. Ghi lại để khỏi dò lại.

### 6.3 `topdev`, `itviec` — **tắt cho luồng này**

Hai sàn thuần IT. Vẫn để `isActive = true` cho lượt quét chung; chỉ là
`npm run crawl -- --source vnw,vieclam24h` không gọi tới.

### 6.4 `topcv` — treo, chờ anh quyết

Đã tắt từ 25/08 vì bị chặn ở tầng dấu vân tay TLS (curl 200 9/9 · Node fetch
403 6/6), **dù robots.txt của họ CHO PHÉP** trang việc làm. Vượt qua = nguỵ
trang trình duyệt = né tránh phát hiện → **cố ý không làm**. TopCV là sàn lớn
nhất cho nghề phi-IT, nên đây là mất mát thật cho nhiệm vụ này. Đường sạch:
viết thư xin phép (User-Agent của ta đã có sẵn email liên hệ).

### 6.5 `careerviet` — **ứng viên bổ sung nếu thiếu tin** (chưa đo lại)

Tắt vì không tìm được sitemap dùng được, **nhưng trang danh sách CÓ JSON-LD**
và robots.txt cho phép đích danh ClaudeBot/GPTBot. Nếu sau chặng 2 mà chưa đạt
N1 (150 tin) thì đây là chỗ mở tiếp, qua adapter `list-jsonld`. Ước ~1 ngày.

---

## 7. Việc phải làm — danh sách đóng, theo thứ tự

Ký hiệu: **C** = code · **D** = dữ liệu/SQL · **K** = kiểm tay

| # | Việc | Chạm vào | Ước |
|---|---|---|---|
| **C1** | `GenericJsonLdConfig.urlIncludePattern` — lọc URL ngay sau sitemap, cộng thêm (AND) với `jobUrlPattern` | `sources/types.ts`, `generic-jsonld.ts` | 30′ |
| **C2** | `GenericJsonLdConfig.ignoreLastmod` — bỏ qua `modifiedSince` cho nguồn có lastmod rác (§4.2) | như trên | 20′ |
| **C3** | `vnw`: đọc `config.queries: string[]`, lặp từng query, khử trùng `jobId` giữa các query | `sources/vietnamworks.ts` | 1h |
| **C4** | **Chặn `reapMissing` đóng nhầm** (§4.1): khi nguồn có nhắm mục tiêu thì chỉ đối chiếu trong phạm vi đó, hoặc chặn hẳn `--full` khi targeting đang bật | `pipeline.ts` | 1h |
| **C5** | Thêm `'đã hết hạn nộp hồ sơ'`, `'việc làm này đã hết hạn'`, `'ngừng nhận hồ sơ'` vào `EXPIRY_TEXT_MARKERS` | `constants/crawl/index.ts` | 10′ |
| **D1** | `SavedFilter` `thu-mua-hcm` — từ điển §2 (sau khi anh duyệt) | `prisma/seed.ts` | 30′ |
| **D2** | `Source.config`: `vnw` thêm `queries`; `vieclam24h` thêm `urlIncludePattern: 'c14p122id'` + `ignoreLastmod: true` | `constants/source`, seed | 20′ |
| **C6** | `scripts/match.ts` — chấm điểm tin theo `SavedFilter`, in ra để soi, **không ghi DB** | mới | 2h |
| **C7** | **`scripts/recheck.ts`** — máy kiểm tầng 3 + 4 (§4). Có `--filter thu-mua-hcm`, tôn trọng `MAX_RECHECKS_PER_RUN`, ghi `JobAudit` | mới | 4h |
| **C8** | Web: trang `/thu-mua` (hoặc `/viec?filter=thu-mua-hcm`) + huy hiệu "kiểm N giờ trước" từ `lastCheckedAt` | `app/`, `job.api.ts` | 3h |
| **C9** | `.github/workflows/crawl.yml` — mỗi 6h: crawl → recheck → báo | mới | 2h |
| **K1** | **Kiểm tay 30 tin** (điều kiện N3) → `docs/audit-thu-mua.md` | — | 1h |

Tổng ≈ **2 ngày làm việc**. C1–C5 + D1–D2 (~3h30) là đủ để có tin thật trong DB.

---

## 8. Lộ trình theo chặng

### Chặng 0 — Chốt từ điển · **anh làm** · 15 phút
Duyệt/sửa danh sách A/B và trả lời ba câu ở §10. Đây là thứ **đang chặn** —
mọi việc còn lại tôi làm được mà không cần anh.

### Chặng 1 — Nhắm nguồn, chạy khô · ~4h
C1 → C2 → C3 → C5 → D2, rồi:
```bash
npm run probe -- --source vieclam24h --limit 5      # xem regex c14p122 có ăn không
npm run crawl -- --source vnw,vieclam24h --dry --limit 30
```
`--dry` chạy thật vào sàn thật nhưng **không ghi DB** — soi parser đọc ra gì
trước khi cho nó chạm vào dữ liệu.
**Cổng ra:** ≥ 80% dòng in ra nhìn bằng mắt thấy đúng là nghề purchasing.

### Chặng 2 — Ghi thật · ~1h · **phải xong C4 trước**
```bash
npm run crawl -- --source vnw --full --limit 400
npm run crawl -- --source vieclam24h --full --limit 250
npm run db:inspect
```
**Cổng ra:** N1 — ≥ 150 tin purchasing tại TP.HCM. Chưa đạt thì mở careerviet (§6.5).

### Chặng 3 — Lọc chính xác · ~2h
C6 + D1. `npm run match -- --filter thu-mua-hcm --sample 50`, xem 50 dòng,
sửa từ điển bằng SQL, chạy lại. Lặp tới khi hài lòng — **không sửa code**.

### Chặng 4 — Máy kiểm còn-sống · ~4h · ★ điều kiện anh đặt ra
C7. `npm run recheck -- --filter thu-mua-hcm`.
**Cổng ra:** N2 — ≥ 95% tin hiển thị có `lastCheckedAt` < 48h.

### Chặng 5 — Xem · ~3h
C8, kèm cờ `--strict-hcm` ở §3.

### Chặng 6 — Kiểm tay · 1h · **anh + tôi**
K1. **Cổng ra: N3.** Đây là lúc biết mình có thật sự làm xong hay không.

### Chặng 7 — Tự chạy · ~2h
C9.

---

## 9. Rủi ro và bẫy đã biết

| Rủi ro | Dấu hiệu | Cách chặn |
|---|---|---|
| **`reapMissing` đóng nhầm cả kho** (§4.1) | `postingsClosed` nhảy lên hàng nghìn sau một lần `--full` | **C4 làm trước chặng 2.** Chưa xong C4 thì tuyệt đối không chạy `--full` khi targeting đang bật |
| **Sitemap vieclam24h đóng băng** (§4.2) | Lần chạy thứ hai trở đi: `0 URL job` | C2 + không tin tầng 2 ở nguồn này |
| **Tin chết trả HTTP 200** (§4.2) | Tin "còn sống" nhưng mở ra thấy "đã hết hạn" | Tầng 1 (`validThrough`) + tầng 4 (C5 + C7) |
| **`c14` rộng hơn purchasing** | Kho đầy "nhân viên kho", "thủ kho" | Danh sách B ở §2.2, lọc trên tiêu đề |
| **`query` VNW nuốt sales** | "tư vấn mua hàng", "kế toán mua hàng" lọt vào | Danh sách B; đo lại ở chặng 3 |
| **HCM mở rộng gây hiểu nhầm** (§3) | Tin ghi "TP.HCM" hoá ra ở Bến Cát | `rawText` + cờ `--strict-hcm` |
| **Nguồn chặn** | 429/503 | Đã có: `ABORT_STATUS_CODES` dừng cả phiên, không thử lại. **Không nới** |
| **Chỉ còn 2 nguồn cho nghề phi-IT** | Tin ít, lặp lại | §6.4 TopCV (xin phép), §6.5 CareerViet |

**Ba lằn ranh không vượt** (giữ nguyên từ [PLAN.md](../PLAN.md) — nhiệm vụ này
không phải lý do để nới):

1. Không giả dấu vân tay TLS, không giả User-Agent trình duyệt.
2. Tôn trọng `robots.txt` và `MIN_DELAY_MS`; 429/503 là dừng, không lách.
3. Toàn văn mô tả nằm ở blob, DB chỉ giữ ≤ 8 KB — vấn đề bản quyền.

---

## 10. Cần anh quyết — 3 câu, chặn chặng 0

**Q1. Nhóm "xám" (§2.2C): `logistics`, `xuất nhập khẩu`, `kho vận`, `điều phối`, `planner`.**
(a) lấy hết — phủ rộng, nhiễu nhiều · (b) bỏ hết — sạch, hẹp · (c) chỉ lấy khi
tiêu đề *cũng* có từ nhóm A. → *Đề xuất: **(c)**.*

**Q2. Bình Dương / Bà Rịa – Vũng Tàu có tính là TP.HCM không?** (§3)
(a) có — đúng đơn vị hành chính 2025 · (b) không — chỉ HCM cũ.
→ *Đề xuất: **(a)**, kèm cờ `--strict-hcm` để đảo ngược.*

**Q3. Cấp bậc: có lấy thực tập sinh / mới ra trường không?**
→ *Đề xuất: **lấy hết**, để cột `level` lọc lúc xem — lọc lúc cào là mất dữ
liệu không lấy lại được.*

Ngoài ra hai việc treo cũ vẫn chờ anh (§6.4 TopCV, §6.5 CareerViet) — **không
chặn** chặng 1–4.

---

## 11. Bảng lệnh

```bash
# Dò nguồn, KHÔNG cần CSDL — dùng khi sửa regex nhắm mục tiêu
npm run probe   -- --source vieclam24h --limit 5

# Chạy khô: vào sàn thật, KHÔNG ghi DB — soi parser trước khi cho ghi
npm run crawl   -- --source vnw,vieclam24h --dry --limit 30

# Ghi thật (CHỈ sau khi xong C4 — xem §4.1)
npm run crawl   -- --source vnw --full --limit 400
npm run crawl   -- --source vieclam24h --full --limit 250

# Soi độ chính xác của từ điển (C6, chưa có)
npm run match   -- --filter thu-mua-hcm --sample 50

# Máy kiểm còn-sống (C7, chưa có) — điều kiện N2
npm run recheck -- --filter thu-mua-hcm

# Sức khoẻ dữ liệu
npm run db:inspect
```

---

## 12. Đã thi công — 08/09/2026

### Kết quả đo được sau khi chạy thật

```
┌─ 2.169 tin · 1.382 công ty          (từ 218 tin lúc bắt đầu)
│  vnw 1.737 · vieclam24h 354 · topdev 40 · itviec 38
│  có blob để reparse   100%
│  parse PARTIAL          1%
└─────────────────────────────────────

┌─ Ngành "Thu mua — TP.HCM"
│  NHẬN chắc  (từ nhận ở TIÊU ĐỀ)     189
│  NHẬN yếu   (>=2 từ trong MÔ TẢ)     69   ← cần soi tay
│  LOẠI                               539
│  đã kiểm còn-sống trong 48h        100%
└─ thuộc ngành: 258/797 tin trong phạm vi
```

| Nghiệm thu | Mốc | Đạt được |
|---|---|---|
| **N1** ≥ 150 tin purchasing TP.HCM còn sống | 150 | **258** ✅ |
| **N2** ≥ 95% tin hiển thị đã kiểm trong 48h | 95% | **100%** ✅ |
| **N3** 30 tin soi tay, ≥ 27 đúng | — | ⏳ **chưa làm** — việc của anh, §8 chặng 6 |

Chi phí: **~330 request** cho toàn bộ, 0 lỗi, 0 lần bị 429/503.

### Việc đã xong

C1–C7, D1–D2, C8 ✅ · C9 (GitHub Actions) ❌ chưa làm.
136 test xanh (thêm 34 test mới cho bộ khớp ngành), typecheck sạch.

Thêm so với kế hoạch: trang **`/nganh`** (`src/app/nganh/page.tsx`) và
`src/api/field.api.ts` — kế hoạch định làm `/thu-mua` gắn cứng, nhưng ngành là
dữ liệu nên trang cũng phải theo dữ liệu.

### ⚠️ Hai chỗ kế hoạch này SAI, đã sửa theo số đo

**1. §4 nói tầng 4 dò HTTP là được cho mọi nguồn. SAI với VietnamWorks.**

Đo ngày 08/09:

| Trang | HTTP | Nặng | JSON-LD | `<title>` | Chữ báo hết hạn |
|---|---|---|---|---|---|
| tin **đang tuyển** (2098170) | 200 | 67 KB | không | — | — |
| tin **đã hết hạn** (2071986) | 200 | 23 KB | không | không | **không** |

Trang tin đã hết hạn của VNW là **vỏ JS rỗng** — không nói gì cả. Dò vào đó thì
mọi kết quả đều là "còn sống", tức là tự dối mình và còn tốn request để làm việc
đó. Đã đặt `livenessProbe: 'none'` cho `vnw`, và cho crawler ghi `lastCheckedAt`
ngay khi gọi API — vì bản ghi API mang `isActive`/`isOnline`/`expiredOn`, tức
**lượt gọi API CHÍNH LÀ một lần kiểm**, chính xác hơn mọi thứ đọc từ HTML.

**2. §6.2 ước tính vieclam24h có ~200 URL đúng đích. Thực tế 314.**

Ước tính ngoại suy từ 1 file sitemap; chạy thật trên cả 5 file ra **314 URL**,
0 rò rỉ ngoài TP.HCM. Nhánh "slug nghề" của regex đáng giá đúng như dự đoán:
nó vớt được tin thu mua bị sàn xếp nhầm danh mục.

### Ba thứ chỉ lộ ra khi chạy thật

**a. Chốt an toàn C4 đã bật đúng lúc.** Log của lượt `--full` đầu tiên:

> `[vnw] BỎ QUA bước đóng tin vắng mặt: nguồn đang nhắm mục tiêu bằng từ khoá`

Không có C4 thì đúng lệnh đó sẽ đóng sạch mọi tin không thuộc purchasing.

**b. Mẫu chữ mới ở C5 bắt được tin chết thật.** Máy kiểm tìm ra **6 tin** mà
mọi tín hiệu khác đều nói là còn sống — HTTP 200, JSON-LD còn nguyên — nhưng
trang ghi *"hết hạn nộp hồ sơ"*. Trong đó có
*"Nhân Viên Thu Mua (Buyer / Sourcing)"* và *"Nhân Viên Mua Hàng (Ưu Tiên Nam)"*,
đúng loại tin mà nếu không có mẫu chữ này thì anh sẽ nộp hồ sơ vào chỗ không
còn tuyển.

**c. Điều kiện "còn tuyển" cắt đi 42% kết quả.** Cùng bộ từ điển, cùng phạm vi:
**223** tin nếu tính cả tin đã chết, **130** nếu chỉ tính tin còn sống (số đo ở
lượt cào đầu). Gần một nửa số tin purchasing tại TP.HCM tìm được trên mạng đã
hết hạn. Đây là toàn bộ lý do tồn tại của bốn tầng máy kiểm.

### Còn lại

| Việc | Ai |
|---|---|
| **N3 — soi tay 30 tin** (§8 chặng 6) | anh + tôi |
| C9 — GitHub Actions chạy mỗi 6h | tôi, ~2h |
| Trả lời Q1–Q3 ở §10 nếu muốn khác mặc định | anh |
| Mở thêm nguồn (§6.4 TopCV, §6.5 CareerViet) | chờ anh quyết |

Ba câu hỏi ở §10 đã chạy theo **đề xuất mặc định**: nhóm xám chỉ tính khi tiêu
đề cũng có từ lõi · HCM mở rộng (kèm nút "HCM cũ" trên trang, bỏ 53 tin) · lấy
mọi cấp bậc. Đổi ý thì `UPDATE SavedFilter`, không phải sửa code.

---

## 13. Vòng hai — lọc sâu và tự động hoá (08/09/2026)

Bốn yêu cầu thêm: **tự động cào**, **lọc theo kinh nghiệm**, **chia loại mua
hàng**, **lọc theo lương / quận / có làm thứ Bảy**.

Đo dữ liệu trước khi xây, và kết quả đo chia bốn yêu cầu đó thành ba nhóm khác
hẳn nhau:

| Yêu cầu | Độ phủ dữ liệu | Kết quả |
|---|---|---|
| Loại mua hàng | **100%** (`industry` do nguồn khai) | ✅ 9 loại, 250/258 xếp theo ngành |
| Kinh nghiệm | **93%** (`yearsExpMin`) | ✅ lọc theo mức trần |
| Quận / KCN | **45%** (bóc từ địa chỉ) | ✅ có, kèm nhãn nói rõ độ phủ |
| Lương | **25%** công khai | ✅ lọc giữ cả tin "thoả thuận" |
| **Làm thứ Bảy** | **1%** | ⚠️ **xây xong nhưng gần như không có dữ liệu** |
| Tự động cào | — | ✅ GitHub Actions, 4 lượt/ngày |

### ⚠️ Thứ Bảy: bộ lọc đúng, dữ liệu thì không có

Đây là chỗ phải nói thẳng. Bộ đọc lịch làm việc chạy đúng — 28 test trên câu
thật, bắt được cả ca hiểm `"thứ 2 - thứ 6, làm online sáng thứ 7"` (là NỬA
NGÀY, không phải nghỉ). Nhưng **chỉ 3/258 tin trong ngành có dữ liệu**, vì:

- VietnamWorks **không hỏi nhà tuyển dụng về ngày làm việc** — chỉ 2% tin nhắc tới.
  Đang chiếm 257/258 tin còn sống thuộc ngành.
- vieclam24h thì có: **22%** tin nhắc lịch, 7% ghi rõ "T2–T7". Nhưng tin của họ
  phần lớn đã hết hạn (sitemap đóng băng 6 tuần, xem §4.2).

→ Bộ lọc sẽ tự khá lên khi kho có thêm tin từ nguồn chịu ghi lịch. Trang đã
hiện cảnh báo ngay dưới thanh lọc thay vì để người dùng bấm vào rồi tự đoán vì
sao rỗng.

### Vì sao "loại mua hàng" KHÔNG đoán từ mô tả

Thử đếm từ khoá trên mô tả trước: ra **"43% tin thuộc ngành dược"**. Hoàn toàn
giả — sau khi bỏ dấu thì `dược` trùng `được`, mà `được` thì tin nào chẳng có.

> **Bài học chung: từ tiếng Việt MỘT ÂM TIẾT sau khi bỏ dấu là khoá so khớp tồi.**
> Nó áp cho cả `field-match` lẫn mọi bộ đọc sau này.

Đường đúng: `industriesV3` do VietnamWorks tự khai, có ở **258/258** tin. Nhưng
nó nằm trong blob chứ chưa vào CSDL — nên phải thêm cột và backfill.

### Bốn cột mới + một sửa chữa nền

Thêm `industry`, `district`, `saturdayWork`, `scheduleRaw` (đều nullable, SQL
sinh ra chỉ là 4 × `ADD COLUMN`, không khoá bảng, không mất dữ liệu, ~2,5 MB ở
mốc 10.000 tin).

Nhưng backfill lộ ra một chỗ hỏng có sẵn: **`reparse` bỏ qua toàn bộ blob của
nguồn API** — tức 1.737/2.169 tin. Nghĩa là siêu năng lực "tính lại không cào
lại" chưa từng dùng được cho VietnamWorks. Sửa bằng cách mở `vnwRecordToJsonLd`
ra cho reparse dùng lại đúng hàm mà adapter dùng lúc cào.

Kết quả: **2.169/2.169 tin tính lại, 0 lỗi, 0 request mạng.**

### Một con trỏ chết được chặn trước khi kịp sinh ra

Khi viết workflow mới thấy: chạy crawler trên CI với `BLOB_DRIVER=fs` thì blob
ghi vào ổ đĩa runner rồi bị xoá, **nhưng `rawKey` vẫn được ghi vào CSDL** —
adapter dựng khoá tại chỗ và bỏ qua giá trị kho blob trả về. Mỗi tin cào trên
CI sẽ để lại một con trỏ tới tệp không bao giờ tồn tại, và `reparse` báo "thiếu
blob" mãi mãi.

Sửa: adapter dùng khoá do `blobs.put()` **trả về**; kho rỗng trả `''` → ghi
`rawKey = NULL`. Nói thật "không có bản thô" thay vì để lại con trỏ hỏng.

### Seed không được phép ghi đè từ điển nữa

Actions chạy `db:seed` bốn lần một ngày. Seed cũ ghi đè `SavedFilter`, nên mọi
tinh chỉnh bằng SQL sống nhiều nhất sáu tiếng rồi lặng lẽ quay về bản trong mã
nguồn — đúng lời hứa "sửa bằng UPDATE, không cần deploy" bị phá.

Nay seed **chỉ tạo mới**. Đổi từ điển trong mã nguồn thì gọi rõ:
`npm run db:seed -- --force-fields`.

### Phân bố loại mua hàng — 189 tin nhận chắc

```
68  Sản xuất & nhà máy          30  Thương mại & bán lẻ
26  Dệt may & da giày           23  Xây dựng & dự án
12  Y tế & dược                 11  Dịch vụ, CNTT & tài chính
11  Hậu cần & chuỗi cung ứng     7  Thực phẩm, F&B & nông nghiệp
 1  Chưa phân loại
```

Quận có nhiều tin nhất: Thủ Đức 11 · Quận 7 10 · Quận 1 9 · Quận 3 7 ·
Bình Thạnh 5 · Tân Bình 4 · KCN Tân Tạo 4.

### Còn lại

- **N3 — soi tay 30 tin** vẫn chưa làm.
- Bộ lọc thứ Bảy cần thêm nguồn chịu ghi lịch mới có ích thật.
- Actions cần đặt secrets `DATABASE_URL` và `CRAWLER_CONTACT_EMAIL` mới chạy;
  thêm `R2_*` thì giữ được blob của tin cào trên CI.

---

## Phụ lục — nhật ký đo, 08/09/2026

Ghi lại để sáu tháng nữa không ai mất một ngày dò lại và rút ra đúng kết luận cũ.

| Đo | Kết quả |
|---|---|
| VNW `POST /job-search/v1.0/search` `{"query":"thu mua"}` | HTTP 200 · **407 tin** · không cần token |
| VNW độ phủ từ khoá | mua hang 1.258 · purchasing 1.200 · procurement 849 · cung ung 474 · thu mua 407 · sourcing 351 · merchandiser 112 |
| VNW lọc địa điểm phía nguồn | **thất bại** — `workingLocationsCityId` / `cityId` / `locationId` / `cityIds` đều `nbHits: 0`; `value` phải là chuỗi (mảng → HTTP 400) |
| v24h `sitemap-index.xml` | có `nganhnghe-*`, `tinhthanh-*`, **`nganhtinh-*`**, `quanhuyen-*`, `sub-occupation-*`, `level-sub-occupation-*` |
| v24h `tintuyendung-0.xml` | 4.180 URL · **c14p122 = 50** · c14 mọi tỉnh = 119 · p122 mọi ngành = 1.974 |
| v24h `lastmod` | **tất cả** = `2026-07-28T00:13:4x` — dấu thời gian sinh file, đã cũ 6 tuần |
| v24h tin `c14p122id200731476` | HTTP 200 · JSON-LD còn nguyên · `validThrough 2026-08-09` (đã qua) · trang ghi *"Việc làm này đã hết hạn nộp hồ sơ"* · `addressRegion: "Ho Chi Minh City"` |
| v24h trang danh sách `o14p122` | HTTP 200 · 726 KB · 20 link tin/trang · **không có** JSON-LD ở trang danh sách |
| DB (`npm run db:inspect`) | 218 tin · 143 công ty · TP.HCM 98 · **15% đã hết hạn** |
| `SavedFilter` trong code | **0 chỗ dùng** — model rỗng, sẵn sàng cho nhiệm vụ này |
| VNW trang tin **đang tuyển** (2098170) | HTTP 200 · 67 KB · **không có JSON-LD** (trang dựng bằng JS) |
| VNW trang tin **đã hết hạn** (2071986) | HTTP 200 · 23 KB · không JSON-LD · không `<title>` · **không một chữ nào báo hết hạn** |
| VNW tra theo jobId | **không có đường** — `query:"2098170"` trả 0 tin; `/jobs/2098170` 404; `/jobs/v1.0/detail/` 403 |
| v24h regex nhắm mục tiêu, chạy thật 5 file | **314 URL** (ước tính từ 1 file là 200) · 0 rò rỉ ngoài p122 |
| Máy kiểm chạy thật trên ngành | 6 tin "sống" theo HTTP 200 + JSON-LD nhưng trang ghi *"hết hạn nộp hồ sơ"* |
