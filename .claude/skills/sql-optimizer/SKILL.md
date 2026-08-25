---
name: sql-optimizer
description: Phân tích truy vấn chậm - đọc execution plan, tìm đúng nút thắt, đề xuất thay đổi nhỏ nhất chữa được. Dùng khi crawl/upsert chậm, khử trùng lặp pg_trgm chậm, tìm kiếm tiếng Việt chậm, truy vấn vector chậm, nghi N+1 trong Prisma, hoặc cân nhắc thêm index. SQL performance, slow query, EXPLAIN ANALYZE, pg_trgm, pgvector, Prisma query.
---

# Tối ưu truy vấn

Prisma trên PostgreSQL (Neon). Bảng nặng nhất là `JobPosting`; các đường chậm
đáng ngại nhất là khử trùng lặp bằng `pg_trgm`, tìm kiếm tiếng Việt qua
`unaccent`, và tìm theo ngành nghề bằng `pgvector`.

## Trước khi tối ưu bất cứ thứ gì

**1. Đọc index đã có.** [prisma/schema.prisma](prisma/schema.prisma) đã khai khá
nhiều trên `JobPosting`:

```
@@unique([sourceId, externalId])
@@index([status, postedAt])      @@index([postedAt])
@@index([companyId])             @@index([sourceId, lastSeenAt])
@@index([status, expiresAt])     @@index([status, lastCheckedAt])
@@index([jobGroupId])
```

Khuyên thêm index mà chưa đọc danh sách này là khuyên bừa và rất dễ tạo trùng.

**2. Loại trừ cold start của Neon trước.** Neon tự ngủ khi rảnh; truy vấn đầu
tiên sau đó chậm vì DB vừa thức, không phải vì truy vấn tồi. **Luôn đo từ lần
thứ hai trở đi.** Bỏ qua bước này là tối ưu nhầm cả buổi.

**3. Nhớ ngân sách 0,5 GB.** Index không miễn phí về dung lượng, mà dung lượng ở
đây là tài nguyên khan hiếm nhất. GIN trgm và HNSW đặc biệt tốn.

## Quy trình

1. **Xem SQL thật Prisma sinh ra**, đừng đoán từ code Prisma:
   ```ts
   // src/api/db.ts
   new PrismaClient({ log: ['query'] })
   ```
   hoặc đặt `DEBUG="prisma:query"` khi chạy.
2. **Lấy plan thật:**
   ```sql
   EXPLAIN (ANALYZE, BUFFERS) <câu truy vấn>;
   ```
   Không có `ANALYZE` thì không nói được gì về thời gian thật.
3. **Tìm nút đắt tiền:** Seq Scan trên `JobPosting`; nested loop số dòng cao
   (thường là N+1); sort ghi ra đĩa; index scan nhưng lọc bỏ gần hết dòng (sai
   index); ước lượng dòng lệch xa thực tế (thống kê cũ → chạy `ANALYZE`).
4. **Phân biệt tương quan với nhân quả.** Chậm có thể do plan tồi, thống kê cũ,
   tranh khoá lúc crawler đang ghi, cold start, hay đơn giản là quá nhiều dữ
   liệu. Đừng nhảy ngay sang "thêm index".
5. **Chọn thay đổi nhỏ nhất.** Đổi index rẻ hơn viết lại truy vấn; viết lại truy
   vấn rẻ hơn đổi schema; đổi schema rẻ hơn phi chuẩn hoá.

## Bẫy đặc thù của dự án này

### pg_trgm (khử trùng lặp `JobGroup`)
- `similarity(a, b) > 0.x` **không dùng được index** nếu viết dạng đó. Muốn ăn
  index GIN thì dùng toán tử `%` (và đặt `pg_trgm.similarity_threshold`), hoặc
  `<->` cho truy vấn xếp hạng gần nhất.
- Index phải là `USING gin (col gin_trgm_ops)` — index B-tree thường vô dụng ở đây.
- So khớp trùng lặp là **bậc hai theo bản chất**. Phải chặn không gian so sánh
  trước (cùng công ty, cùng tỉnh, cùng cửa sổ thời gian) rồi mới tính similarity.
  Đây gần như luôn là bản sửa đúng, chứ không phải thêm index.

### unaccent (tìm kiếm tiếng Việt)
- `unaccent()` là `STABLE`, **không phải `IMMUTABLE`** → **không thể** tạo
  functional index thẳng trên `unaccent(title)`. Postgres sẽ từ chối.
- Cách làm: bọc trong một hàm `IMMUTABLE` tự viết rồi index hàm đó, hoặc lưu sẵn
  một cột đã bỏ dấu (dự án đã có `removeDiacritics` ở tầng ứng dụng — cân nhắc
  ghi luôn cột chuẩn hoá khi upsert, rẻ hơn nhiều so với tính lúc truy vấn).
- Nếu dùng full-text search, `to_tsvector` với cấu hình phù hợp + index GIN.

### pgvector (tìm theo ngành nghề)
- Truy vấn ANN phải dùng đúng toán tử khớp với index (`<=>` cosine, `<->` L2).
  Sai toán tử là index bị bỏ qua **im lặng** và rơi về quét toàn bảng.
- `LIMIT` phải nằm trong truy vấn để index ANN có tác dụng.
- HNSW: chỉnh `hnsw.ef_search` để đổi giữa tốc độ và độ chính xác.
- Lọc kèm điều kiện (`WHERE status = 'OPEN'`) có thể làm hỏng hiệu quả ANN —
  cân nhắc partial index theo `status`.

### Prisma
- **N+1 khi dựng thống kê.** Lặp qua từng `Company`/`Location` rồi query tin cho
  mỗi cái → gộp thành một truy vấn `where: { id: { in: [...] } }` rồi nhóm trong JS.
- **Quên `select`.** Prisma mặc định lấy hết cột — kể cả mô tả công việc dài hàng
  chục KB. Trên Neon, lưu lượng có tính tiền. Luôn khai `select` cho truy vấn danh sách.
- **Upsert từng dòng trong vòng lặp crawl.** Với `--limit 200` là 200 lượt khứ
  hồi. Cân nhắc `createMany` + xử lý xung đột, hoặc gom lô.
- **Lọc trong JS thay vì trong DB** — kéo cả nghìn dòng về rồi `.filter()`.

### REAP
Bước đóng tin đã biến mất quét theo `[sourceId, lastSeenAt]`. Nếu nó chậm, kiểm
tra xem truy vấn có thực sự ăn index đó không, và nhớ **REAP chỉ chạy sau
`--full`** — chạy nhầm sau quét tăng dần vừa sai nghiệp vụ vừa đắt.

## Đầu ra

````markdown
## Truy vấn này làm gì
[Diễn giải bằng lời thường]

## Execution plan
[Đi qua các nút đắt tiền — thời gian, số dòng, thao tác]

## Nguyên nhân gốc
[Đúng MỘT thứ — nút thắt thật, không phải danh sách dài]

## Đề xuất sửa
```sql
-- Thay đổi, kèm chú thích nó làm gì
```
**Cải thiện dự kiến:** [từ X xuống Y]
**Đánh đổi:** [ghi chậm hơn, tốn bao nhiêu MB trong ngân sách 0,5 GB]

## Kiểm chứng
1. Áp dụng trên Neon branch tạo từ production
2. Chạy EXPLAIN ANALYZE, so với mốc cũ (bỏ lần đo đầu — cold start)
3. Theo dõi chỉ số nào sau khi deploy
````

## Tránh

- Khuyên thêm index mà chưa đọc index hiện có
- Đo lần chạy đầu tiên rồi kết luận (cold start Neon)
- Đề xuất phi chuẩn hoá làm cách chữa đầu tiên
- Bỏ qua ảnh hưởng lên đường ghi — crawler ghi liên tục, index không miễn phí
- Quên tính dung lượng index vào hạn mức 0,5 GB
