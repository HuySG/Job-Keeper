---
name: migrate-db
description: Lập kế hoạch đổi schema Postgres an toàn - soi thao tác nguy hiểm, dựng đường lùi, chia nhiều bước. Dùng khi sửa prisma/schema.prisma, thêm/xoá/đổi kiểu cột, thêm index trên JobPosting, bật extension pg_trgm/unaccent/pgvector, thêm cột vector, hoặc trước khi đẩy schema lên Neon. Database migration, prisma schema change, pgvector, zero-downtime.
---

# Lập kế hoạch đổi schema

Prisma trên PostgreSQL. **Dự án này KHÔNG chạy được SQLite** — bắt buộc Postgres
vì cần `pg_trgm` khử trùng lặp, `unaccent` cho tìm kiếm tiếng Việt, `pgvector`
cho tìm theo ngành nghề. Đừng đề xuất "quay về SQLite cho tiện".

## Ba ràng buộc phải thuộc trước khi đụng vào schema

**1. `npm run db:push` xoá dữ liệu không hỏi lại.**
Đó là `prisma db push` — đồng bộ schema, không sinh file migration, và **có thể
drop cột/bảng** khi Prisma thấy cần dựng lại. Dùng thoải mái trên DB dùng thử;
**với DB có dữ liệu thật thì không**.

**2. Neon gói Free có 0,5 GB — và kiến trúc đã được thiết kế quanh con số đó.**
HTML thô nằm trên R2, không bao giờ vào Postgres (một trang TopDev nặng 828 KB;
10.000 tin là 8 GB = gấp 16 lần hạn mức). **Mọi cột `String` không giới hạn độ
dài là một lỗ rò tiềm tàng vào ngân sách đó.** Thêm cột kiểu text lớn thì phải
trả lời được: dữ liệu này có nên nằm trên blob store thay vì Postgres không?

**3. Có `JobAudit` — đừng phá vết truy.**
Bảng này ghi lịch sử thay đổi tin. Thay đổi schema làm mất khả năng đối chiếu
lịch sử là mất nhiều hơn vẻ ngoài của nó.

## Quy trình

1. **Đọc schema hiện tại.** [prisma/schema.prisma](prisma/schema.prisma) — 414
   dòng, 16 model, nhiều `@@index` đã có. Đọc cả chú thích trong file: chúng ghi
   căn cứ thiết kế, không phải trang trí.
2. **Xem dữ liệu thật.** `npm run db:inspect`, `npm run db:studio`. Bao nhiêu
   dòng, cột định đổi có bao nhiêu NULL, có giá trị nào không hợp kiểu mới không.
3. **Phân loại thay đổi:**

   | Loại | Rủi ro | Cách làm |
   |---|---|---|
   | Thêm cột nullable | Thấp | Đi thẳng |
   | Thêm cột NOT NULL có default | Trung bình | Trên `JobPosting` có thể khoá bảng — thêm nullable, backfill, rồi mới siết |
   | Thêm index thường | Trung bình | `CREATE INDEX CONCURRENTLY` |
   | Thêm index GIN/trgm hoặc HNSW | **Cao** | Dựng rất tốn CPU và RAM; xem mục pgvector bên dưới |
   | Đổi kiểu cột | Cao | Cột mới → backfill → đổi code → xoá cột cũ |
   | Đổi tên cột/bảng | Cao | Ba bước: thêm mới, ghi cả hai, bỏ cũ |
   | Thêm `@@unique` | Cao | **Đếm trùng TRƯỚC** — dữ liệu crawl gần như chắc chắn có trùng |
   | Xoá cột/bảng | **Không lùi được** | Chỉ sau khi có backup và code không còn đụng tới |

4. **Soát an toàn** trước khi sinh migration:
   - Có thao tác xoá dữ liệu nào không? Nêu rõ và **đợi người dùng đồng ý**.
   - Có khoá bảng lâu trên `JobPosting` không?
   - Khoá ngoại mới đã có index chưa?
   - `@@unique` mới có xung đột với dữ liệu đang có không? Chạy truy vấn đếm trùng trước.
   - Cột mới có phải chỗ nên nằm trên blob store không? (ràng buộc 0,5 GB)
5. **Viết đường lùi.** Mỗi bước tiến phải kèm câu trả lời "hỏng thì quay lại kiểu
   gì". Không có đường lùi thì chưa được chạy.
6. **Diễn tập trên Neon branch** tạo từ production, đừng thử thẳng.

## Extension — chỗ dễ vấp nhất

`prisma db push` **không tự tạo extension**. Phải bật trước, bằng SQL trực tiếp
hoặc khai báo `postgresqlExtensions` trong generator:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS vector;
```

- Chạy **trước** khi đẩy schema có cột/index phụ thuộc chúng, nếu không push sẽ đổ.
- Neon cho phép cả ba, nhưng phải bật **trên từng branch** — branch mới không tự kế thừa.
- `unaccent` là hàm `STABLE`, **không phải `IMMUTABLE`** → không index trực tiếp
  `unaccent(col)` được. Muốn index thì bọc trong một hàm `IMMUTABLE` tự viết.
  Đây là lỗi kinh điển, gặp là mất nửa buổi.

## Khi thêm pgvector (đang trong lộ trình, chưa làm)

- Prisma chưa có kiểu vector gốc → dùng `Unsupported("vector(N)")`, và chấp nhận
  là Prisma Client không truy vấn trực tiếp được — phải `$queryRaw`.
- Chốt **số chiều** trước khi tạo cột. Đổi số chiều sau là dựng lại cột và **nạp
  lại toàn bộ embedding**.
- Index: HNSW truy vấn nhanh hơn, dựng chậm và ngốn RAM; IVFFlat dựng nhanh hơn
  nhưng cần dữ liệu đã có sẵn để phân cụm cho tốt. Trên Neon Free, **cân nhắc để
  sau cùng** — dựng index HNSW trên bảng lớn có thể chạm trần tài nguyên.
- Vector chiếm chỗ thật: 1536 chiều × 4 byte ≈ 6 KB/dòng. 10.000 tin ≈ 60 MB,
  bằng hơn 10% hạn mức. Tính vào ngân sách 0,5 GB trước khi cam kết.

## Đầu ra

````markdown
## Thay đổi
[Mô tả bằng lời, kèm diff schema]

## Đánh giá rủi ro
[Từng thao tác: mức rủi ro, có mất dữ liệu không, có khoá bảng không, tốn bao nhiêu dung lượng]

## Kế hoạch từng bước
1. ...

## Đường lùi
[Chính xác phải chạy gì để quay lại trạng thái cũ]

## Kiểm chứng
[npm test, npm run typecheck, npm run db:inspect, truy vấn đếm]
````

## Nguyên tắc

- **Backup trước**, với mọi thay đổi có rủi ro.
- **Mở rộng rồi mới thu hẹp.** Thêm cái mới → chuyển code sang dùng → mới xoá cái
  cũ. Đừng làm cả hai trong một lần deploy.
- **Nói rõ cái đánh đổi.** Index mới làm crawler ghi chậm hơn và ăn dung lượng —
  mà dung lượng ở đây là tài nguyên khan hiếm nhất.
- **Đừng lặng lẽ xoá.** Kế hoạch có mất dữ liệu thì nói thẳng và đợi xác nhận.
