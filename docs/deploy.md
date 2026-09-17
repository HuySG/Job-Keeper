# Triển khai lên Vercel

> Viết 08/09/2026. Mọi thứ trong tài liệu này đã kiểm trên chính máy này:
> `npm run build` chạy sạch, và đã rà bằng grep xem web thật sự đọc biến môi
> trường nào.

---

## 0. Điều phải hiểu trước khi bấm deploy

**Chỉ TRANG WEB lên Vercel. CRAWLER Ở LẠI MÁY.**

Đây không phải giới hạn kỹ thuật tạm thời mà là kiến trúc đã chọn từ đầu
([pipeline.ts](../src/crawler/pipeline.ts)): *crawler chỉ GHI, web chỉ ĐỌC*.
Ba lý do crawler không chạy được trên Vercel:

| Cản trở | Chi tiết |
|---|---|
| Thời gian chạy | Một lượt cào vieclam24h mất ~12 phút. Hàm serverless bị cắt sau vài chục giây. |
| Ổ đĩa | `.blobs` cần ghi được và cần *bền*. Ổ đĩa của Vercel là chỉ-đọc và mất sau mỗi lần chạy. |
| Lịch sự | `MIN_DELAY_MS` giả định một tiến trình duy nhất xếp hàng theo host. Nhiều hàm serverless chạy song song sẽ cùng nện vào một sàn. |

Nên sau khi deploy, luồng vẫn là: **cào ở máy → ghi vào Neon → web trên Vercel
đọc Neon**. Trang sẽ chạy bình thường kể cả khi máy tắt; nó chỉ không có tin
mới cho tới lần cào sau. Muốn tự động thì dùng GitHub Actions
(việc C9 trong [plan.md](plan.md) §7), **không phải** Vercel Cron.

---

## 1. Biến môi trường — hai chuỗi kết nối, một khoá sửa

Đã rà bằng grep toàn bộ `src/`: mọi biến khác (`CRAWLER_CONTACT_EMAIL`,
`BLOB_DRIVER`, `USD_VND_RATE`, `R2_*`) chỉ được đọc trong module của crawler,
mà web không import module nào trong số đó. Web chỉ đi tới
`@/crawler/normalize/text` — một hàm thuần, không đụng `process.env`.

```
DATABASE_URL = postgresql://<user>:<pass>@<endpoint>-pooler.<region>.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

Ba điều về chuỗi này:

1. **Phải là chuỗi POOLED** (có `-pooler` trong host). Mỗi request serverless
   là một kết nối mới; dùng chuỗi direct thì Neon hết slot rất nhanh.
2. Đặt cho cả ba môi trường Production / Preview / Development.
3. Đừng dán vào `vercel.json` hay bất cứ file nào được commit. Nó là mật khẩu.

```
DATABASE_URL_SWE = postgresql://…-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

CSDL của workspace **swe** (Ngành của tôi) — Neon project RIÊNG, cùng vùng
`ap-southeast-1` (xem [plan-swe.md §7](plan-swe.md)). Cùng ba điều như trên.

- **Không đặt** → mọi trang `/swe/...` hiện lời nhắn "chưa có CSDL trên máy chủ
  này" kèm tên biến còn thiếu; workspace bae chạy bình thường.
- Hai biến trỏ **cùng một** CSDL (kể cả một bên pooled, một bên direct) → web
  từ chối dựng trang: đó là cấu hình sai, không bao giờ là cố ý.
- `DATABASE_URL` vẫn là chuỗi của workspace **bae**; có thể đổi tên thành
  `DATABASE_URL_BAE` (tên đó thắng nếu có cả hai).

```
EDIT_KEY = <một chuỗi ngẫu nhiên dài, ví dụ: openssl rand -base64 24>
```

Từ bản giao diện v2, web GHI được hai thứ: **tin đã lưu** và **từ điển ngành**.
Trang chạy công khai không đăng nhập, nên hai đường ghi đó bị khoá sau biến này
([src/lib/edit-access.ts](../src/lib/edit-access.ts)):

- **Không đặt** → bản production ở chế độ chỉ đọc: nút lưu mờ đi, trang Cài đặt
  xem trước được nhưng không lưu được. Mặc định khoá là cố ý — quên đặt biến
  thì mất tính năng, chứ không mở toang cho người lạ sửa từ điển.
- **Có đặt** → mở trang `/bae/cai-dat` (hoặc `/swe/cai-dat`), nhập đúng chuỗi này một lần — một khoá dùng cho cả hai workspace; trình duyệt
  giữ quyền sửa 180 ngày. Đổi giá trị biến là thu hồi quyền trên mọi máy.
- Máy dev (`npm run dev`) không cần biến này — ghi được luôn.

---

### Bảng mới phải có TRƯỚC khi deploy

Bản v2 thêm bảng `SavedJob`. Chạy **một lần** từ máy, trước khi đẩy code lên:

```bash
npm run db:push
```

Đã soát bằng `prisma migrate diff`: lệnh này chỉ `CREATE TABLE "SavedJob"` kèm
hai index và một khoá ngoại — không xoá, không đổi cột nào của bảng cũ. Quay
lại thì `DROP TABLE "SavedJob";`.

Quên bước này thì trang vẫn chạy: nút lưu ẩn đi, trang Tin đã lưu nói thẳng là
thiếu bảng, và `npm run recheck` bỏ qua phần ưu tiên tin đã lưu. Workflow
GitHub Actions **không** tự chạy `db:push` — lệnh đó có thể xoá dữ liệu khi
schema lệch, nên không được chạy tự động.

---

## 2. Vùng máy chủ — đã đặt sẵn `sin1`

[`vercel.json`](../vercel.json) khai `"regions": ["sin1"]` (Singapore).

Không phải làm màu: Neon của dự án nằm ở `ap-southeast-1` (Singapore), còn
vùng mặc định của Vercel là `iad1` (Washington DC). Để mặc định thì **mỗi truy
vấn phải vượt Thái Bình Dương hai chiều**, và trang `/nganh` bắn nhiều truy vấn
nối tiếp nhau cho một lần tải. Đặt cùng vùng với CSDL là thứ rẻ nhất có thể làm
cho tốc độ.

> Gói Hobby chỉ cho chọn MỘT vùng — đúng bằng thứ ta cần. Nếu sau này đổi vùng
> Neon thì phải sửa đúng chỗ này, nếu không sẽ chậm mà không hiểu vì sao.

---

## 3. Đường A — nối GitHub (khuyên dùng)

Repo đã có sẵn: `https://github.com/HuySG/Job-Keeper.git`

1. Vào [vercel.com/new](https://vercel.com/new) → **Import Git Repository** →
   chọn `HuySG/Job-Keeper`.
2. Framework Vercel tự nhận là **Next.js**. Giữ nguyên mọi mặc định:
   - Build Command: `npm run build` — script này đã có sẵn `prisma generate &&`
     ở đầu, **bắt buộc phải giữ**. Vercel nhớ đệm `node_modules`, không sinh lại
     Prisma Client thì sẽ chạy nhầm client cũ và lỗi rất khó hiểu.
   - Output Directory: `.next`
   - Install Command: `npm install`
3. Mở **Environment Variables**, thêm `DATABASE_URL`, `DATABASE_URL_SWE` và `EDIT_KEY` (mục 1) cho cả ba môi trường.
4. **Deploy**.

Từ đó mỗi lần `git push` lên `master` là Vercel tự deploy production; mỗi nhánh
khác được một bản Preview riêng.

---

## 4. Đường B — CLI (khi muốn deploy thẳng từ máy)

Cần một Access Token tạo ở
[vercel.com/account/tokens](https://vercel.com/account/tokens). **Đừng dán
token vào khung chat với ai, kể cả tôi** — đặt vào biến môi trường của phiên
terminal:

```powershell
$env:VERCEL_TOKEN = "<token vừa tạo>"
npx vercel link --yes --token $env:VERCEL_TOKEN
npx vercel env add DATABASE_URL production --token $env:VERCEL_TOKEN
npx vercel env add DATABASE_URL_SWE production --token $env:VERCEL_TOKEN
npx vercel env add EDIT_KEY production --token $env:VERCEL_TOKEN
npx vercel --prod --token $env:VERCEL_TOKEN
```

`.vercelignore` đã loại `.blobs/` (9,6 MB, 2.193 file) khỏi gói tải lên — không
có nó thì mỗi lần deploy phải đẩy cả kho blob mà web không dùng tới.

---

## 5. Kiểm sau khi deploy

Theo đúng thứ tự này, vì mỗi bước loại được một nguyên nhân:

| # | Mở | Phải thấy |
|---|---|---|
| 1 | `/` | Chuyển về `/bae` (hoặc workspace vừa xem) → **middleware chạy** |
| 2 | `/bae/nguon` | Bảng nguồn + lần chạy gần nhất → **CSDL bae nối được** |
| 3 | `/bae/nganh` | Tin thu mua, ô "đã kiểm trong 48h", bảng màu xanh lá |
| 4 | `/nganh` | Chuyển 308 sang `/bae/nganh` → **đường dẫn cũ còn sống** |
| 5 | `/swe/nganh` | Tin phần mềm, bảng màu xanh dương — hoặc lời nhắn "chưa có CSDL" nếu chưa đặt `DATABASE_URL_SWE` |
| 6 | `/abc` | Trang "không tìm thấy", không phải lỗi 500 |

Trang trắng kèm lỗi 500 ở bước 1 gần như luôn là `DATABASE_URL` — chưa đặt,
đặt nhầm môi trường, hoặc dùng chuỗi direct thay vì pooled.

---

## 6. Bốn kiểu hỏng đã biết trước

**a. Lần mở đầu tiên sau vài phút im lặng bị chậm 2–3 giây.**
Neon gói Free ngủ khi không có truy vấn. Không phải lỗi. Đây cũng đúng là lý do
[NEXT-STEPS.md](../NEXT-STEPS.md) chọn GitHub Actions thay vì `pg_cron`.

**b. `prepared statement "s0" already exists`.**
Kiểu hỏng kinh điển của Prisma sau pgBouncer. Chưa gặp — hàng nghìn truy vấn
qua đúng chuỗi pooled này đã chạy trơn ở máy — nhưng nếu gặp thì thêm
`&pgbouncer=true` vào cuối `DATABASE_URL` trên Vercel. Đánh đổi: Prisma tắt
prepared statement, chậm hơn một chút, đổi lấy chạy đúng.

**c. `/nganh` chậm dần theo thời gian.**
Trang này lấy TOÀN BỘ tin còn sống trong phạm vi tỉnh (hiện ~800) rồi mới chấm
từ điển bằng JS — phân trang làm trong bộ nhớ. Đánh đổi có ý thức, đã ghi rõ ở
[field.api.ts](../src/api/field.api.ts): nó đổi lấy việc sửa từ điển bằng một
câu `UPDATE` mà không phải đụng SQL. Khi phạm vi vượt vài nghìn tin thì phải
chuyển sang cột `tsvector` + index GIN. Con số cần theo dõi là **"đã chấm"**
ngay trên trang.

**d. Trình duyệt tắt JavaScript thấy trang trắng ở "tin không tồn tại".**
Đo 17/09/2026 trên Next 15.5: 404 phát sinh TRONG lúc dựng một trang
(`notFound()` khi `/bae/viec/999999` không có trong CSDL) chỉ nằm trong
payload JavaScript — có từ trước khi tách workspace. 404 của đường dẫn không
khớp route nào thì dựng đủ trong HTML, nên middleware chuyển mọi đoạn đầu lạ
(`/abc/...`) sang loại đó; workspace chưa có CSDL thì layout vẽ lời nhắn thẳng,
không qua `notFound()`. Còn lại đúng một ca: số hiệu tin không có thật.

---

## 7. Chi phí

Gói Hobby là đủ và miễn phí cho một người dùng. Hai chỗ **không** tốn tiền, cố
ý như vậy:

- **Không dùng Image Optimization.** Đã grep: trang hiện **không render một tấm
  ảnh nào** — không `next/image`, không cả thẻ `<img>`. `Company.logoUrl` có
  trong CSDL và được `select` ra nhưng chưa chỗ nào hiện. Nghĩa là hạn mức tối
  ưu ảnh của Vercel không bị đụng tới.

  > ⚠️ Ngày nào thêm logo vào thẻ tin thì phải quyết lại: `next.config.ts` đang
  > khai `remotePatterns: hostname '**'` — cho phép tối ưu ảnh từ *mọi* tên
  > miền. Dùng `next/image` với cấu hình đó là mở cửa cho hạn mức Image
  > Optimization bị đốt bởi ảnh của bên thứ ba. Lúc đó hoặc siết
  > `remotePatterns` lại, hoặc dùng thẻ `<img>` thường.

- **Không có font tự host.** Toàn bộ JS chung của trang là 103 KB.

Cần nhớ: Hobby **cấm dùng cho mục đích thương mại**. Đây là công cụ cá nhân đi
tìm việc nên không sao.
