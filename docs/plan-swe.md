# Kế hoạch — Hai workspace: **Ngành của Bae** (thu mua) và **Ngành của tôi** (phần mềm)

> Viết ngày **17/09/2026**. Tài liệu có ba phần: **nghiệp vụ** (§2–§5),
> **kiến trúc** (§6–§10), **thi công** (§11–§15).
>
> **Cập nhật 17/09/2026:** đã chốt Q1, Q2, Q7 (§14), **xong chặng 1**, chặng 2
> đã có CSDL swe + schema + số đo nguồn (§15).
>
> Không thay [plan.md](plan.md) (nhiệm vụ thu mua) hay [PLAN.md](../PLAN.md)
> (kiến trúc tổng). Theo đúng quy ước của plan.md: số nào **đã kiểm** thì ghi
> kiểm bằng cách nào (phụ lục cuối); số nào là **ước lượng** thì ghi rõ
> *chưa đo* — chặng 2 sẽ đo và sửa lại tài liệu này.

---

## 0. Tóm tắt trong một màn hình

Ba thay đổi:

1. Mục **"Ngành của tôi"** hiện tại (thu mua — TP.HCM) **đổi tên thành
   "Ngành của Bae"**. CSDL, nguồn, từ điển, lịch cào **giữ nguyên**.
2. Thêm mục **"Ngành của tôi" mới**: việc lập trình khớp CV — backend
   .NET/C#, fullstack .NET + React, TP.HCM hoặc remote, khoảng 2 năm kinh nghiệm.
3. Ngành mới nằm trong **một CSDL Postgres riêng**. Code dùng chung, dữ liệu
   tách hẳn.

Khái niệm mới là **workspace** (viết tắt `ws`) = một CSDL + một bộ cấu hình
nguồn + một ngành mặc định + một bộ chấm điểm. Tài liệu cố ý không gọi nó là
"kho", vì "Kho tin" đã là tên trang `/viec`.

```
                ┌──────────── MỘT codebase, MỘT bản deploy ────────────┐
 /bae/...  ──►  │  workspace "bae" → DATABASE_URL      (Neon hiện tại)  │
 /swe/...  ──►  │  workspace "swe" → DATABASE_URL_SWE  (Neon mới)       │
                └───────────────────────────────────────────────────────┘

 npm run crawl -- --ws swe   ──►  chỉ đọc và ghi CSDL của workspace swe
 npm run crawl               ──►  như hôm nay: workspace bae
```

---

## 1. Nghiệm thu — thế nào là XONG

| # | Điều kiện | Cách đo |
|---|---|---|
| **N0** | **Bae không đổi gì.** Sau mỗi chặng: `/bae/nganh` ra đúng số tin như `/nganh` trước khi làm; `db:inspect` workspace bae không đổi; toàn bộ test hiện có vẫn xanh | ghi số trước khi bắt đầu, so lại sau mỗi chặng |
| **N1** | ≥ **300 tin** phần mềm còn sống ở TP.HCM/remote trong workspace swe, trong đó ≥ **60 tin** ở mức "Hợp" trở lên *(chưa đo — sửa sau chặng 2)* | `npm run db:inspect -- --ws swe`, trang `/swe/nganh` |
| **N2** | ≥ **95%** tin hiển thị đã kiểm còn sống trong **48 giờ** | ô chỉ số trên trang, như bên Bae |
| **N3** | Lấy ngẫu nhiên **30 tin** mức "Rất hợp"/"Hợp": ≥ **24 tin** (80%) anh thật sự muốn nộp | kiểm tay → `docs/audit-swe.md` |
| **N4** | Không một dòng nào của workspace này nằm trong CSDL của workspace kia | test cô lập (C17) + đối chiếu bằng truy vấn |

N3 đặt 80% chứ không phải 90% như bên thu mua: câu hỏi ở đây khó hơn — không
chỉ "có đúng nghề không" mà là "có đáng nộp không".

---

# PHẦN A — NGHIỆP VỤ

## 2. Hai ngành, hai câu hỏi khác nhau

| | Ngành của Bae | Ngành của tôi |
|---|---|---|
| Nghề | Thu mua / mua hàng | Lập trình phần mềm |
| Câu hỏi của trang | Tin nào **đúng nghề**, còn tuyển? | Tin nào **đúng nghề**, **hợp CV của tôi**, còn tuyển? |
| Bộ lọc chính | từ điển ngành | từ điển ngành **+ độ hợp CV** |
| Chia loại theo | loại mua hàng (ngành của công ty) | loại việc (stack) |
| Tín hiệu chính | `industry` do nguồn khai | **kỹ năng** (nguồn khai + bóc từ mô tả) |
| Nguồn mạnh | VNW, CareerViet, vieclam24h | ITviec, TopDev, VNW *(chưa đo)* |

Khác biệt cốt lõi: với nghề thu mua, trả lời được "có thuộc ngành không" là
đủ. Với nghề lập trình thì chưa đủ — "Java Developer" thuộc ngành nhưng vô dụng
với một CV .NET. Nên workspace swe có thêm **tầng thứ hai: độ hợp CV** (§5).

---

## 3. Hồ sơ ứng viên — đọc từ CV

Chỉ lấy những gì dùng để chấm tin. **Không** đưa số điện thoại, email, năm
sinh hay ảnh vào repo — repo có thể public. File PDF của CV cũng không commit.

| Mục | Giá trị | Căn cứ |
|---|---|---|
| Kinh nghiệm | **khoảng 2 năm** (08/2024 → nay, liên tục) | 3 vị trí: Exps (fullstack) → Exps (backend) → THLONE (fullstack) |
| Cấp nhắm tới | JUNIOR, MID | |
| Nơi ở | Thủ Đức, TP.HCM | |
| Tiếng Anh | IELTS 5.5 · TOEIC LR 520 — đọc tài liệu tốt, giao tiếp lưu loát chưa chắc | |
| Tiếng Nhật | không có | |
| Miền nghiệp vụ | ERP (mua hàng, bán hàng, tài chính, HRM, CRM), chuyển PowerBuilder/Oracle lên web | cả ba vị trí đều là ERP |

Kỹ năng, chia theo vai trò trong phép chấm:

| Nhóm | Kỹ năng | Vai trò |
|---|---|---|
| **Lõi backend** | C#, .NET 8/9, ASP.NET Core Web API, REST | nặng nhất |
| **Lõi frontend** | React (19, Hooks, Context), TypeScript | |
| **Lõi CSDL** | SQL Server, PostgreSQL, Oracle | |
| **Cộng thêm** | EF Core, Dapper, MediatR, Clean Architecture, modular monolith, microservices, JWT, Docker/Compose, Jenkins CI/CD, IIS, React Query, DevExtreme, Ant Design, Tailwind, Less, Jira, Scrum | cộng điểm, có trần |
| **Stack khác** | Java/Spring, PHP/Laravel, Go, Python, Ruby, Node.js (backend), Angular, Vue, Flutter, iOS, Android, Unity, SAP ABAP | chặn hoặc trừ khi là stack **chính** của tin |
| **Thị trường hay đòi, CV chưa có** | Azure, AWS, Kubernetes, Redis, RabbitMQ/Kafka, gRPC, SignalR, Blazor, Next.js | **không** trừ điểm; đếm để ra "khoảng trống kỹ năng" (§5.4) |

Hồ sơ này là **dữ liệu**: lưu ở `SavedFilter.profile` (JSON), seed từ
`src/constants/profile`. Học xong Azure thì sửa JSON, không sửa code, không
deploy — đúng lời hứa mà từ điển ngành đang giữ.

---

## 4. "Thuộc ngành phần mềm" — từ điển `phan-mem-hcm`

Dùng lại nguyên bộ luật của [field-match.ts](../src/lib/field-match.ts): từ
loại ở tiêu đề thắng → từ nhận ở tiêu đề → khớp yếu → loại. Chỉ khác từ điển
và cách chuẩn hoá chữ (§4.3).

### 4.1 Từ nhận (bản đề xuất)

```
Lõi:  lập trình viên · lập trình · developer · software engineer · kỹ sư phần mềm
      backend · back-end · fullstack · full-stack · full stack · frontend · front-end
      web developer · dotnet · csharp · aspnet · reactjs · react
Xám:  ~engineer · ~kỹ sư · ~it · ~erp · ~devops · ~system
```

`engineer` và `kỹ sư` phải để **xám**: "Kỹ sư xây dựng", "Sales Engineer",
"Process Engineer" đều chứa chữ đó. Từ xám không tự kéo tin vào ngành — đúng
quy ước `GRAY_PREFIX` đang có.

### 4.2 Từ loại (khớp ở tiêu đề là loại thẳng)

```
Kiểm thử:     tester · qa · qc · kiểm thử · automation test
Không code:   business analyst · product owner · project manager · scrum master · comtor
Bán hàng:     sales · kinh doanh · presales · tư vấn
Nhân sự:      tuyển dụng · recruiter · talent acquisition · headhunt
Hỗ trợ:       helpdesk · it support · hỗ trợ kỹ thuật · kỹ thuật viên
Đào tạo:      giảng viên · giáo viên · trainer
Nghề khác:    designer · ui/ux · game · embedded · nhúng
              kỹ sư cơ khí · kỹ sư xây dựng · kỹ sư điện
```

### 4.3 ⚠️ BẪY: bộ chuẩn hoá hiện tại xoá mất tên công nghệ

[`toMatchKey()`](../src/crawler/normalize/text.ts) thay mọi ký tự không phải
chữ/số bằng khoảng trắng:

```
".NET Developer"  → "net developer"  → \bnet khớp cả "network", "netsuite"
"C# Developer"    → "c developer"    → không phân biệt được với lập trình C nhúng
"Node.js"         → "node js"
"C++"             → "c"
```

Cùng họ với bài học "dược/được" ở [plan.md §13](plan.md): **khoá so khớp đã
bỏ ký tự thì mất nghĩa.**

Cách chữa — thêm `toTechKey()`: thay thế trước, rồi mới gọi `toMatchKey()`:

```
.net · dotnet · .net core · asp.net     → dotnet   (asp.net → aspnet dotnet)
c#   → csharp        c++ → cpp           f# → fsharp
node.js · nodejs     → nodejs
react.js · reactjs   → reactjs react
vue.js → vuejs       next.js → nextjs    ci/cd → cicd
```

Mỗi từ điển tự chọn cách chuẩn hoá (`matchKey: 'plain' | 'tech'`).
**Workspace bae giữ `plain`** — hành vi của ngành thu mua không đổi một ký tự.

Và thêm một khác biệt: **kỹ năng cần ranh giới ở CẢ HAI đầu**. Từ điển ngành
chỉ chặn đầu từ (để "buyer" bắt được "buyers"), nhưng với kỹ năng thì
`\bjava` khớp "javascript" và `\breact` khớp "reactive".

---

## 5. Độ hợp CV — tầng thứ hai, chỉ có ở workspace swe

### 5.1 Luồng chấm

```
tin ──► [1] thuộc ngành? (từ điển §4) ────── không ──► loại
             │ có
             ▼
        [2] dính cờ cứng? ─────────────────── có ────► mức "Lệch" (ẩn mặc định, nêu lý do)
             │ không
             ▼
        [3] điểm 0–100 ──► mức: Rất hợp · Hợp · Với tới · Lệch
             │
             ▼
        [4] lời giải: khớp gì · thiếu gì · cờ mềm
```

### 5.2 Cờ cứng — ẩn khỏi danh sách mặc định, luôn nêu tên

| Cờ | Điều kiện | Vì sao cứng |
|---|---|---|
| `ja-required` | đòi tiếng Nhật: N1–N3, JLPT, BrSE | CV không có tiếng Nhật — nộp cũng không qua vòng hồ sơ |
| `too-senior` | `yearsExpMin ≥ 5`, hoặc tiêu đề/cấp bậc là Lead, Manager, Principal, Architect, Head | lệch từ 3 năm trở lên |
| `other-stack` | tiêu đề nêu stack khác (Java, PHP, Go, Python, iOS…) **và** không nêu .NET/React | "Java Developer" không phải việc của CV này, dù mô tả có nhắc SQL Server |
| `out-of-area` | không ở TP.HCM và không remote | đã lọc ở tầng tỉnh; cờ chỉ để giải thích |

Giống nút "Kể cả tin khớp yếu" bên Bae: có công tắc "Kể cả tin lệch" để soi.

### 5.3 Điểm (tổng 100)

| Thành phần | Tối đa | Cách tính |
|---|---|---|
| Lõi stack | 50 | .NET/C# **25** · React **15** · SQL Server/PostgreSQL/Oracle **10**. Có ở tiêu đề hoặc trong kỹ năng nguồn khai → đủ điểm; chỉ có trong mô tả → nửa điểm |
| Cộng thêm | 15 | mỗi kỹ năng nhóm "cộng thêm" **+3**, trần 15 |
| Cấp bậc | 20 | `yearsExpMin` ≤ 2 → **20** · 3 → **14** · 4 → **6** · không ghi → **10** · FRESHER/INTERN → **5** (dưới tầm) · SENIOR mà chỉ đòi ≤ 3 năm → **12** |
| Điều kiện làm việc | 15 | remote/hybrid **+5** · quận gần nhà (Thủ Đức, Bình Thạnh…) **+5** · miền ERP **+5** |
| Trừ | — | frontend là Angular/Vue mà không có React **−8** · đòi giao tiếp tiếng Anh lưu loát **−5** |

Mức: **Rất hợp** ≥ 70 · **Hợp** 50–69 · **Với tới** 30–49 · **Lệch** < 30
hoặc dính cờ cứng.

"Không ghi số năm" được 10/20 chứ không phải 0 — tin không nói không có nghĩa
là không hợp, y như "Thoả thuận" không có nghĩa là 0 đồng.

Ngưỡng và trọng số nằm trong `SavedFilter.profile`: chỉnh sau lần soi tay
(chặng 7) bằng một câu `UPDATE`, không sửa code.

### 5.4 Nói thật về điểm số

- **Không hiện phần trăm** kiểu "87% phù hợp". Điểm chỉ để **xếp thứ tự**;
  giao diện hiện **mức + lời giải**: *"khớp .NET, React, SQL Server · thiếu
  Azure · đòi 3 năm"*. Một con số chính xác tới hàng đơn vị cho một phép cộng
  trọng số tự đặt là độ chính xác giả.
- Tin **không bóc được kỹ năng nào** thì ghi *"không đủ dữ liệu để chấm"* và
  nằm ở nhóm riêng — không bị quy thành "Lệch".
- **Khoảng trống kỹ năng**: đếm kỹ năng hay xuất hiện trong tin mức Hợp trở lên
  mà CV chưa có (*"Azure: 34 tin · Redis: 21 tin"*, kèm cỡ mẫu). Trả lời câu
  *"học gì tiếp thì mở thêm nhiều cửa nhất"* — thứ không sàn nào trả lời.

### 5.5 Loại việc — thay cho "loại mua hàng"

Xét **theo thứ tự**, hẹp trước rộng sau (cùng quy tắc với
[constants/purchase](../src/constants/purchase/index.ts)):

| slug | Nhãn | Điều kiện |
|---|---|---|
| `dotnet-fullstack` | Fullstack .NET + React | có .NET **và** (React hoặc chữ "fullstack") |
| `dotnet-backend` | Backend .NET | có .NET/C#, không có framework frontend |
| `react-frontend` | Frontend React | có React, không có backend nào |
| `fullstack-khac` | Fullstack stack khác | fullstack với Node/Java/PHP… |
| `backend-khac` | Backend stack khác | |
| `devops` | DevOps / hạ tầng | |
| `chua-ro` | Chưa phân loại | |

Cũng hai tầng như `classifyPurchase`: kỹ năng nguồn khai trước, quét tiêu
đề/mô tả sau.

### 5.6 Bộ lọc trên trang "Ngành của tôi"

| Chiều | Lấy từ | Độ phủ |
|---|---|---|
| Mức hợp CV | tính lúc đọc | 100% (tin thiếu dữ liệu có nhóm riêng) |
| Loại việc | tính lúc đọc | *chưa đo* |
| Kinh nghiệm | `yearsExpMin` | *chưa đo* |
| Hình thức | `workMode` (onsite/hybrid/remote) | *chưa đo* — với nghề IT đây là chiều quan trọng |
| Lương | `salaryMin`/`salaryMax` | *chưa đo* — ITviec hay ghi USD, bộ quy đổi đã có |
| Quận | `district` | *chưa đo* |
| Lịch thứ 7 | `saturdayWork` | giữ lại; dữ liệu mỏng như bên Bae |

---

# PHẦN B — KIẾN TRÚC

## 6. Workspace

```ts
// src/constants/workspace/index.ts — phác thảo
export const WORKSPACES = {
  bae: {
    label: 'Ngành của Bae',
    // Đọc lần lượt: DATABASE_URL cũ vẫn chạy, không phải đổi secret nào.
    dbUrlEnv: ['DATABASE_URL_BAE', 'DATABASE_URL'],
    blobPrefix: '',            // khoá blob cũ giữ nguyên
    defaultField: 'thu-mua-hcm',
    classifier: 'purchase',
    theme: 'pastel-green',
  },
  swe: {
    label: 'Ngành của tôi',
    dbUrlEnv: ['DATABASE_URL_SWE'],
    blobPrefix: 'swe/',
    defaultField: 'phan-mem-hcm',
    classifier: 'software',
    theme: 'blue',
  },
} as const;
```

Ba nguyên tắc:

1. **Thứ gì là code thì nằm ở cấu hình workspace** (CSDL nào, bộ chấm nào).
   **Thứ gì người dùng chỉnh thì nằm trong CSDL** (từ điển, hồ sơ CV, cấu hình
   nguồn) — y như hôm nay.
2. **`bae` là mặc định ở mọi chỗ cũ.** Script không có `--ws` chạy đúng như
   hôm nay; secret `DATABASE_URL` không phải đổi tên.
3. **Hai workspace khác màu mặc định** (xanh lá / xanh dương, hai bảng màu đã
   có sẵn). Nhìn là biết đang ở CSDL nào, trước khi kịp lưu nhầm một tin.

---

## 7. Tách CSDL

### 7.1 Một schema, hai CSDL

Cả hai CSDL dùng **cùng** `prisma/schema.prisma` và cùng Prisma Client, chỉ
khác chuỗi kết nối:

```ts
// src/api/db.ts — phác thảo
export function getDb(ws: WorkspaceId): PrismaClient // web: một client mỗi workspace, nhớ trên globalThis
export const db: PrismaClient                        // script: workspace chọn lúc khởi động (--ws)
```

Prisma 6 nhận `new PrismaClient({ datasourceUrl })`, nên không cần hai schema
và không cần hai lần `prisma generate`.

**Vì sao tách CSDL thay vì thêm cột `workspace` vào mọi bảng:**

- Crawler, pipeline, recheck, reparse **không phải sửa một truy vấn nào** —
  chúng vẫn thấy "một CSDL".
- Không bao giờ lẫn: không có truy vấn nào để quên `WHERE workspace = …`.
- Hạn mức 0,5 GB của Neon Free tính **riêng từng project** — workspace swe
  không ăn vào phần của Bae.

**Hệ quả phải nhớ:** `JobPosting.id`, `Source.id` tự tăng **trong từng CSDL**,
nên hai workspace có thể cùng có tin số 123. Đó là lý do đường dẫn phải mang
tên workspace (§8.1).

**Cái giá chấp nhận:** tin vừa là thu mua vừa là lập trình (ví dụ "Developer
module mua hàng ERP") sẽ nằm ở cả hai CSDL và bị cào hai lần. Số lượng không
đáng kể.

### 7.2 Neon

- **Project mới**, cùng vùng `ap-southeast-1` (Singapore). `vercel.json` đang
  ghim `sin1`; đặt CSDL khác vùng là mỗi truy vấn vượt đại dương hai chiều
  ([deploy.md §2](deploy.md)).
- Dùng chuỗi **pooled**, như workspace cũ.
- Tạo bảng: `npm run db:push -- --ws swe` (bọc qua bộ chọn workspace, §9.1).
  Prisma CLI tự in host đang đẩy tới — đọc dòng đó trước khi gõ `y`.

### 7.3 Thay đổi schema — đúng một cột

```prisma
model SavedFilter {
  // ...
  /// Hồ sơ ứng viên + trọng số chấm độ hợp CV.
  /// NULL = ngành chỉ lọc bằng từ điển (như thu mua).
  profile Json?
}
```

`ADD COLUMN` nullable: không khoá bảng, không mất dữ liệu. Phải `db push` lên
**cả hai** CSDL **trước** khi deploy code — giống lần thêm `SavedJob`
([deploy.md §1](deploy.md)). Soát bằng skill `migrate-db` trước khi đẩy.

Các bảng `Skill`, `SkillAlias`, `JobSkill` **đã có trong schema nhưng đang
rỗng**: `normalize` bóc ra `skillTexts`, nhưng `upsertJob` không ghi xuống —
hiện chỉ `probe` in ra. Workspace swe là lúc lấp chỗ đó (§9.4).

---

## 8. Web nhiều workspace

### 8.1 Đường dẫn

```
/                          → chuyển tới workspace vừa xem (cookie), mặc định /bae
/bae                       Tổng quan          ┐
/bae/nganh                 Ngành của Bae      │
/bae/viec · /bae/viec/[id] Kho tin            │  cùng MỘT bộ trang:
/bae/luong · /bae/nguon                       │  app/(site)/[ws]/...
/bae/da-luu · /bae/cai-dat                    │
/swe/...                   Ngành của tôi      ┘
/thanh-phan                không thuộc workspace nào
/nganh, /viec/123, ...     → chuyển hướng 308 sang /bae/... (giữ nguyên query string)
```

- `[ws]/layout.tsx` kiểm `ws` hợp lệ (sai → 404), dựng `SiteHeader` theo
  workspace, gắn bảng màu mặc định của workspace. `SiteHeader` hiện nằm ở
  `(site)/layout.tsx` và đọc CSDL — phải dời xuống `[ws]`.
- Chuyển hướng khai ở `next.config.ts` — chạy trước khi định tuyến, nên
  `/nganh` không bao giờ rơi vào `[ws] = "nganh"`.

### 8.2 Tầng đọc

Mọi hàm trong `src/api/*.ts` nhận `ws` làm tham số đầu và gọi `getDb(ws)`.
`cache()` của React vẫn chạy, vì `ws` là chuỗi.

**Chốt an toàn:** một test quét `src/app`, `src/api`, `src/actions`,
`src/components` và **cấm import `db` mặc định** (chỉ script được dùng nó).
Quên truyền `ws` ở một hàm là đọc nhầm CSDL mà không lỗi nào báo — đúng kiểu
hỏng tệ nhất.

### 8.3 Server action

- Form gửi kèm `<input type="hidden" name="ws">`; action kiểm hợp lệ rồi mới
  `getDb(ws)`.
- `revalidatePath` / `redirect` đổi sang đường dẫn có workspace (hiện
  `dictionary.ts` đang redirect cứng về `/cai-dat`).
- `EDIT_KEY`: dùng chung hay tách theo workspace — xem **Q6**.

### 8.4 Thanh điều hướng

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🐱 Bae-Job  [ Ngành của Bae │ Ngành của tôi ]   Tổng quan · Ngành · Kho tin · │
│                                                 Lương · Nguồn        🔖  ⚙   │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Công tắc workspace đứng cạnh logo. Năm mục giữ nguyên câu hỏi của mình, chỉ
  đổi đường dẫn theo workspace; mục "Ngành" lấy nhãn theo workspace.
- Công tắc là `<a>` thường — giữ ràng buộc "chạy được khi chưa có JS".
- Chuyển workspace **giữ trang đang đứng** (`/bae/luong` → `/swe/luong`)
  nhưng **bỏ query string**: bộ lọc của workspace này vô nghĩa với workspace kia.

### 8.5 Chỗ DUY NHẤT biết hai nghề khác nhau

Một sổ đăng ký bộ chấm, cùng kiểu với
[sources/registry.ts](../src/crawler/sources/registry.ts):

```ts
interface FieldClassifier {
  /** Loại mua hàng | loại việc — cho ô lọc và nhãn. */
  categories: { slug: string; label: string; hint: string }[];
  classify(job: ScopedJob): CategoryResult;
  /** Chỉ workspace swe có. */
  fit?(job: ScopedJob, profile: CvProfile): FitResult;
}

const CLASSIFIERS = { purchase: purchaseClassifier, software: softwareClassifier };
```

`field.api.ts` gọi qua giao diện này thay vì gọi thẳng `classifyPurchase`;
trang Ngành và `field-active-filters` đọc `categories` từ bộ chấm thay vì
import `PURCHASE_TYPES`. Bộ chấm `purchase` chỉ là vỏ bọc quanh code hiện có.

### 8.6 Hiệu năng đọc — workspace swe không kéo mô tả về

Trang Ngành của Bae kéo khoảng 800 tin **kèm mô tả ≤ 8 KB** mỗi lượt tải
([deploy.md §6c](deploy.md)). Phạm vi IT ở TP.HCM có thể lớn hơn nhiều
*(chưa đo)*, nên workspace swe đổi cách:

- Mô tả chỉ được đọc **lúc cào và lúc reparse**, để bóc kỹ năng và cờ ngôn
  ngữ → ghi vào `JobSkill`.
- Lúc đọc chỉ lấy tiêu đề, các cột ngắn và danh sách slug kỹ năng
  (ước ~1 KB/tin thay vì tới 8 KB).
- "Khớp yếu" của workspace swe = tiêu đề không khớp nhưng có **≥ 2 kỹ năng
  lõi** (thay cho "≥ 2 từ trong mô tả").

Cờ ngôn ngữ (`ja-required`, `en-fluent`) lưu thành **kỹ năng loại `REQ`**
trong bảng `Skill` — không thêm cột. Cùng tinh thần với tiền tố `~` của từ xám:
nhét quy ước vào dữ liệu thay vì migrate cho một khái niệm chưa chắc sống lâu.

---

## 9. Crawler và script

### 9.1 Chọn workspace

```bash
npm run crawl   -- --ws swe --source itviec --dry
npm run db:seed -- --ws swe
npm run recheck -- --ws swe --filter phan-mem-hcm
npm run reparse -- --ws swe
npm run db:push -- --ws swe        # bọc prisma CLI
```

`scripts/_env.ts` → `loadEnv()` đọc `--ws` (hoặc biến `BJ_WORKSPACE`), đặt
`DATABASE_URL` **trước truy vấn đầu tiên**, rồi in một dòng không thể nhầm:

```
WORKSPACE swe · ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb
```

- Tên biến là `BJ_WORKSPACE` chứ không phải `WORKSPACE`: Jenkins tự đặt
  `WORKSPACE` thành đường dẫn thư mục làm việc.
- Đặt lại `DATABASE_URL` sau khi Prisma đã được import vẫn có hiệu lực — **đã
  đo** (phụ lục): Prisma chỉ đọc biến lúc truy vấn đầu tiên. Prisma CLI cũng
  ưu tiên biến có sẵn hơn `.env`.
- Workspace chưa khai CSDL: script dừng ngay với lời nhắn nêu tên biến; riêng
  `probe` vẫn chạy (nó không cần CSDL). `DATABASE_URL` khi đó bị thay bằng một
  chuỗi cố ý hỏng — không để nguyên, vì Prisma đã nạp sẵn chuỗi của Bae.
- Tiền tố blob **không** đi qua biến môi trường: `createBlobStore()` đọc thẳng
  `blobPrefix` trong cấu hình workspace. Một biến `BLOB_PREFIX` đặt trong
  `.env` sẽ áp cho cả hai workspace — đúng kiểu sai phải tránh.

**Chốt an toàn:** hai workspace trỏ cùng host + cùng tên CSDL → dừng ngay.
So sánh bỏ `-pooler`, vì chuỗi pooled và direct của Neon cùng dẫn tới một CSDL.

Pipeline, adapter, recheck, reparse **không phải sửa**: chúng đọc `Source` và
`SavedFilter` từ CSDL đang chọn, nên nhắm nguồn theo workspace là tự động.

### 9.2 Nguồn: tách "cách vào" khỏi "lấy lát nào"

`SOURCE_SEEDS` hôm nay trộn hai thứ khác bản chất:

- **Cách vào một sàn** — sitemap, mẫu URL, curl, bẫy địa chỉ, ghi chú khảo sát.
  Đúng cho **mọi** workspace.
- **Lấy lát nào** — `queries`, `urlIncludePattern`, `isActive`. Khác theo
  workspace. Hiện 6 nguồn dùng `PURCHASE_SLUG`, vieclam24h có mẫu `c14p122`
  riêng, vnw có 10 từ khoá thu mua.

```
src/constants/source/catalog.ts     SOURCE_CATALOG  — cách vào + ghi chú (dùng chung)
src/constants/source/targeting.ts   TARGETING.bae   — ĐÚNG giá trị hôm nay
                                    TARGETING.swe   — mới
```

**Test chặn:** hợp nhất `SOURCE_CATALOG + TARGETING.bae` phải **bằng đúng**
`SOURCE_SEEDS` hiện tại (chụp lại trước khi tách). Đó là bằng chứng N0 cho
phần nguồn.

### 9.3 Nhắm nguồn cho workspace swe — bản đề xuất, TẤT CẢ chưa đo

| Nguồn | Bật | Cách nhắm | Phải đo |
|---|---|---|---|
| `itviec` | ✅ | sàn thuần IT; `urlIncludePattern` theo slug công nghệ, hoặc lấy hết nếu vừa ngân sách (847 URL ngày 25/08) | số URL khớp, giây/URL |
| `topdev` | ✅ | như itviec | như trên |
| `vnw` | ✅ | `queries`: `.net`, `c#`, `asp.net`, `dotnet`, `reactjs`, `fullstack`, `backend developer`, `software engineer` | API có hiểu `.net`/`c#` không; số tin mỗi từ |
| `careerviet` | ✅ | slug: `lap-trinh`, `developer`, `dot-net`, `backend`, `fullstack`, `react`… | tỷ lệ khớp |
| `glints` | ✅ | slug như trên | tỷ lệ khớp |
| `vieclam24h` | ? | tìm mã danh mục IT (thay cho `c14`) + `p122` | mã danh mục |
| `timviec365` | ? | slug | tốc độ — bên Bae đo 23 giây/URL |
| `iconicjob` | ❌ | doanh nghiệp Nhật, phần lớn đòi tiếng Nhật | — |
| `vieclamnhamay` | ❌ | việc nhà máy | — |
| `topcv` | ❌ | vẫn bị chặn ở tầng biên (đo 11/09) | — |
| `li-tay`, `fb-tay` | ✅ | nhập tay — LinkedIn là nơi nhiều tin IT nhất mà không cào được | — |

**Bẫy slug:** `net` là chuỗi con của "internet", "cabinet", "netsuite". Mẫu
URL phải chặn theo **token** của slug — `(?:^|[-/])(?:net|dot-net|dotnet)(?:-|$)`
chứ không phải `net`. Kiểm trên URL thật bằng skill `regex-builder`.

**Lịch sự:** hai workspace gõ cùng một số sàn. Từ nay con số phải nhìn là
**tổng** request mỗi ngày tới một host, cộng cả hai workspace.

### 9.4 Kỹ năng

1. Seed `Skill` + `SkillAlias` cho workspace swe, danh mục ở §3, từ
   `src/constants/skill`.
2. `upsertJob` ghi `JobSkill` từ hai tầng, cùng tinh thần `classifyPurchase`:
   - **(a) nguồn khai** — `skills` của JSON-LD, `skills[].skillName` của VNW.
     Tin cậy.
   - **(b) quét tiêu đề + mô tả** bằng `toTechKey`, ranh giới hai đầu.
     Dự phòng.
3. Bảng alias nạp **một lần mỗi lượt chạy**. Workspace bae không có dòng
   `Skill` nào → bảng rỗng → không thêm truy vấn nào, hành vi không đổi.
4. `npm run reparse -- --ws swe` điền lại kỹ năng cho tin đã cào, 0 request.

### 9.5 Blob

- Khoá của workspace swe: `swe/{source}/{yyyy-MM}/{externalId}.json.gz`.
- `put()` trả khoá **đầy đủ** và `rawKey` lưu nguyên khoá đó — con trỏ nói
  đúng chỗ file nằm, không cần biết workspace nào đang đọc.
- Khoá của workspace bae **không đổi**; không phải di chuyển file nào.

Không có tiền tố thì cùng một tin ITviec cào ở hai workspace sẽ ghi đè cùng
một file. Hôm nay vô hại, nhưng đó là một sợi dây ngầm nối hai CSDL đáng lẽ
tách hẳn.

---

## 10. Tự động hoá

- Workflow mới `.github/workflows/crawl-swe.yml`, dùng **chung**
  `concurrency: group: crawl` với workflow cũ — hai workspace gõ cùng sàn, mà
  `MIN_DELAY_MS` chỉ đúng khi mỗi host có một tiến trình xếp hàng.
- **Lệch giờ, không chồng lên nhau.** GitHub chỉ giữ **một** lượt chờ trong
  mỗi nhóm concurrency; lượt chờ mới đến sẽ **huỷ im lặng** lượt chờ cũ.
  Lịch Bae hiện là `0 1,7,13,19` (nhẹ, ~10 phút) và `30 18` (nặng, ~38 phút).
  Đề xuất cho swe: `0 4,10,16,22` (nhẹ) và `30 21` (nặng) — cách lịch Bae ít
  nhất 1 giờ vì GitHub hay trễ lịch. Thời lượng lượt swe *chưa đo*.
- Secret mới `DATABASE_URL_SWE`; bước "Kiểm secret bắt buộc" kiểm cả nó.
- Vercel: thêm `DATABASE_URL_SWE` cho cả ba môi trường.
- **Ngân sách phút — đã giải bằng Q7.** Cộng theo số ghi trong `crawl.yml`,
  riêng Bae đã khoảng 4 × 10 + 38 ≈ 78 phút/ngày ≈ 2.300 phút/tháng, vượt hạn
  2.000 phút của repo private. Anh chọn **chuyển repo sang public**; runner
  chuẩn của repo public không tính phút, nên thêm lịch swe không tốn gì.
  Trước khi chuyển đã rà lịch sử git (phụ lục): không có chuỗi kết nối, khoá
  hay mật khẩu nào từng được commit.

---

# PHẦN C — THI CÔNG

## 11. Việc phải làm

Ký hiệu: **C** = code · **D** = dữ liệu/hạ tầng · **K** = kiểm tay

| # | Việc | Chạm vào | Ước |
|---|---|---|---|
| | **Chặng 1 — nền cho script, Bae không đổi** | | |
| **C1** | Cấu hình workspace + `resolveWorkspace()` | `constants/workspace` (mới) | 30′ |
| **C2** | `--ws`: đặt `DATABASE_URL`, in dòng workspace, chốt trùng CSDL | `scripts/_env.ts`, `lib/workspace.ts` | 1h |
| **C3** | Tách `SOURCE_SEEDS` → catalog + targeting; test bằng-nhau cho bae | `constants/source` | 1h30 |
| **C4** | Seed theo workspace: nguồn, ngành, kỹ năng, hồ sơ | `prisma/seed.ts` | 1h |
| **C5** | Tiền tố blob | `crawler/storage/blob.ts` | 30′ |
| **C6** | Bọc `db:push` / `db:studio` qua bộ chọn workspace | `package.json`, script mới | 30′ |
| | **Chặng 2 — dựng workspace swe** | | |
| **D1** | Neon project mới (`ap-southeast-1`), thêm `DATABASE_URL_SWE` vào `.env` | Neon | 15′ |
| **D2** | `SavedFilter.profile Json?`; push lên **cả hai** CSDL | `prisma/schema.prisma` | 30′ |
| **D3** | Đo từng nguồn ở §9.3 bằng `probe`, ghi số thật vào note của catalog | `constants/source` | 3h |
| **D4** | Cào thử `--dry`, rồi ghi thật | — | 1h |
| | **Chặng 3 — kỹ năng và độ hợp CV** | | |
| **C7** | `toTechKey()` + test trên tiêu đề thật | `normalize/text.ts` | 1h |
| **C8** | `field-match`: từ điển chọn `matchKey` (bae = `plain`) | `lib/field-match.ts` | 30′ |
| **C9** | Danh mục kỹ năng, bóc hai tầng, ghi `JobSkill` | `constants/skill`, `normalize`, `pipeline.ts` | 3h |
| **C10** | `lib/software-role.ts` (loại việc) + `lib/cv-fit.ts` (điểm, cờ, lời giải) — hàm thuần | mới | 4h |
| **C11** | Test trên fixture thật — `itviec-job.json` có sẵn `Python, FastAPI, Golang` → phải ra `other-stack` | `tests/` | 2h |
| **C12** | `match --ws swe`: in bảng điểm để soi, không ghi DB | `scripts/match.ts` | 1h |
| **D5** | `reparse --ws swe` điền kỹ năng | — | 15′ |
| | **Chặng 4 — web nhiều workspace** | | |
| **C13** | `getDb(ws)`; mọi hàm `src/api` nhận `ws` | `src/api/*` | 3h |
| **C14** | Dời trang vào `app/(site)/[ws]/`, chuyển hướng đường dẫn cũ, `/` chọn workspace | `src/app`, `next.config.ts` | 2h |
| **C15** | Công tắc workspace, nhãn "Ngành của Bae"/"Ngành của tôi", màu theo workspace | `layout`, `constants/nav`, `site-header` | 2h |
| **C16** | Server action mang `ws`; `EDIT_KEY` theo Q6 | `src/actions/*`, `lib/edit-access.ts` | 1h |
| **C17** | Test cô lập: cấm import `db` mặc định ngoài script | `tests/` | 30′ |
| **C18** | Trang báo "workspace chưa cấu hình" khi thiếu `DATABASE_URL_SWE` (thay vì lỗi 500) | `[ws]/layout.tsx` | 30′ |
| | **Chặng 5 — trang Ngành của tôi** | | |
| **C19** | Sổ đăng ký bộ chấm (§8.5); `field.api` đi qua nó | `api/field.api.ts`, `lib/` | 2h |
| **C20** | Ô lọc: mức hợp, loại việc, hình thức; thẻ tin hiện khớp/thiếu | `components/job`, trang `nganh` | 4h |
| **C21** | Khối "khoảng trống kỹ năng" ở trang Lương của swe | trang `luong`, `stats.api.ts` | 2h |
| | **Chặng 6 — tự chạy** | | |
| **C22** | `crawl-swe.yml`, lệch giờ, chung nhóm concurrency | `.github/workflows` | 1h |
| **D6** | Secret `DATABASE_URL_SWE` trên GitHub và Vercel | — | 10′ |
| | **Chặng 7 — soi tay** | | |
| **K1** | 30 tin mức Hợp trở lên → `docs/audit-swe.md`; chỉnh trọng số bằng SQL | — | 1h |

Tổng ≈ **41 giờ**, khoảng **5 ngày làm việc**.

---

## 12. Lộ trình — và vì sao theo thứ tự này

**Dữ liệu trước, giao diện sau.** Chặng 1 → 2 → 3 chỉ đụng script và crawler.
Dữ liệu cần thời gian tích — máy kiểm còn-sống cần vài vòng mới đạt N2. Có
tin thật sớm thì lúc dựng giao diện đã có dữ liệu thật để nhìn, không phải
dựng trên CSDL rỗng.

**Chặng 4 rủi ro nhất cho Bae** — nó dời mọi trang sang đường dẫn mới. Làm
trên một nhánh riêng; cổng ra là N0.

| Chặng | Cổng ra |
|---|---|
| **1** | `npm test` xanh · `npm run crawl -- --dry --source vnw` (không có `--ws`) in đúng dòng workspace bae và đúng 10 từ khoá thu mua như hôm nay |
| **2** | `db:inspect -- --ws swe` có tin · nhìn bằng mắt ≥ 80% dòng `--dry` là việc lập trình |
| **3** | `match -- --ws swe --sample 50`: không tin Java/PHP nào ở mức Hợp; không tin C#/.NET nào bị loại vì chuẩn hoá |
| **4** | **N0** · trang swe chạy được cả khi CSDL rỗng lẫn khi chưa khai biến |
| **5** | **N1** |
| **6** | **N2**, sau 48 giờ chạy theo lịch |
| **7** | **N3** |

---

## 13. Rủi ro và bẫy đã biết

| Rủi ro | Dấu hiệu | Cách chặn |
|---|---|---|
| **Web đọc nhầm CSDL** | số tin hai workspace bằng nhau | `getDb(ws)` bắt buộc + test cấm `db` mặc định (C17) |
| **Script ghi nhầm CSDL** | tin IT hiện ở trang Bae | dòng workspace + chốt trùng CSDL (C2). Nguồn đọc từ CSDL, nên workspace bae vẫn chỉ cào thu mua |
| **`.net`/`c#` mất khi chuẩn hoá** (§4.3) | "Network Engineer" lọt vào; tin C# không được nhận | `toTechKey` (C7) + test |
| **Kỹ năng khớp nửa từ** | tin JavaScript dính cờ `other-stack` vì "java" | ranh giới hai đầu cho kỹ năng |
| **Slug `net` khớp "internet"** | ngân sách request đốt vào tin lạ | mẫu theo token (§9.3) |
| **Lịch Actions chồng nhau** | một lượt cào biến mất không dấu vết | lệch giờ ≥ 1h (§10) |
| ~~Hết phút Actions~~ | — | **đã giải**: repo chuyển public (Q7) |
| **Repo public để lộ bí mật** | chuỗi Neon xuất hiện trên GitHub | đã rà lịch sử git 17/09: sạch. `.env` nằm trong `.gitignore`; không commit file PDF của CV |
| **Neon mới khác vùng** | trang swe chậm hơn trang bae rõ rệt | tạo ở `ap-southeast-1` |
| **Quên push cột mới lên CSDL bae** | trang Bae lỗi thiếu cột `profile` | push cả hai CSDL trước khi deploy (D2) |
| **Điểm CV đẹp mà sai** | tin "Rất hợp" mở ra không muốn nộp | N3 + chỉnh trọng số bằng dữ liệu |
| **Liên kết cũ hỏng** | bookmark `/nganh?loai=…` ra 404 | chuyển hướng 308, giữ query string |

**Ba lằn ranh không vượt**, giữ nguyên từ [plan.md §9](plan.md) — workspace
thứ hai không phải lý do để nới:

1. Không giả dấu vân tay TLS, không giả User-Agent trình duyệt.
2. Tôn trọng `robots.txt` và `MIN_DELAY_MS`; 429/503 là dừng, không lách.
3. Toàn văn mô tả nằm ở blob, CSDL chỉ giữ ≤ 8 KB.

---

## 14. Quyết định

Anh trả lời ngày 17/09/2026 ba câu chặn đường. Các câu còn lại chạy theo **đề
xuất mặc định** — đổi ý thì báo, phần lớn chỉ là sửa dữ liệu.

| # | Câu hỏi | Chốt | Ai chốt |
|---|---|---|---|
| **Q1** | Đường dẫn | **(a)** `/bae/...` + `/swe/...` cho mọi trang, đường dẫn cũ chuyển hướng 308 | anh |
| **Q2** | Neon | **(a)** project mới, vùng `ap-southeast-1` | anh |
| **Q7** | Repo public/private | **public** — Actions không tính phút (§10) | anh *(ghi trong tin nhắn là "Q3")* |
| Q3 | Địa bàn | TP.HCM (gồm BD/BR-VT) + remote, không nhận Hà Nội | mặc định |
| Q4 | Stack | hiện cả frontend React thuần lẫn fullstack Node + React, để điểm tự xếp xuống dưới | mặc định |
| Q5 | Tin đòi tiếng Nhật | cờ cứng, ẩn mặc định | mặc định |
| Q6 | `EDIT_KEY` | một khoá cho cả hai workspace | mặc định |
| Q8 | Lương tối thiểu | không lọc mặc định | mặc định |
| — | Mã workspace | giữ `swe` — đã nằm trong code từ chặng 1 | mặc định |

---

## 15. Tiến độ

### Chặng 1 — nền cho script · ✅ xong 17/09/2026

| Việc | Kết quả |
|---|---|
| C1 | [constants/workspace](../src/constants/workspace/index.ts): `bae`, `swe` |
| C2 | [lib/workspace.ts](../src/lib/workspace.ts) (hàm thuần) + `loadEnv()` chọn workspace; `probe` dùng `loadEnv({ db: false })` |
| C3 | [catalog.ts](../src/constants/source/catalog.ts) (`git mv` từ `index.ts`, giữ lịch sử) + [targeting.ts](../src/constants/source/targeting.ts) + `sourceSeedsFor(ws)` |
| C4 | `prisma/seed.ts` nạp nguồn và ngành theo workspace; `FIELD_SEEDS` thành `{ bae, swe }`; bản nháp `phan-mem-hcm` |
| C5 | `PrefixedBlobStore` — workspace bae không bọc gì |
| C6 | [scripts/prisma-ws.ts](../scripts/prisma-ws.ts); `db:push`, `db:studio` đi qua nó |

**Cổng ra — đạt:**

- `npm test`: **263 xanh** (225 cũ + 38 mới), `typecheck` sạch.
- `sourceSeedsFor('bae')` **bằng đúng** bản chụp `SOURCE_SEEDS` trước khi tách
  (`tests/fixtures/source-seeds-bae.json`) — bằng chứng N0 cho phần nguồn.
- `npm run crawl -- --dry --source vnw --limit 3` (không `--ws`): in
  `WORKSPACE bae · ep-cold-shadow-…/neondb`, nhắm đúng 10 từ khoá thu mua,
  3 request, không ghi gì.
- `--ws swe` khi chưa có `DATABASE_URL_SWE`: `crawl` và `db:push` dừng ở dòng
  đầu với lời nhắn nêu tên biến, mã thoát 1; `probe` vẫn chạy.
- `--ws toi`: dừng, liệt kê workspace hợp lệ.

**Dò thử lát cắt swe trên sàn thật** (chưa phải D3 — mỗi nguồn vài tin):

| Nguồn | Kết quả |
|---|---|
| `vnw` | `.net` **19** tin · `c#` **30** · `asp.net` **3**. Độ phủ thấp; tin đầu của `.net` là việc Python ở Hà Nội. Bản ghi khai kỹ năng có cấu trúc (".NET Core", "C#", "Asp.net", "SQL Server") |
| `itviec` | `SOFTWARE_SLUG` khớp **9 URL** trên 2 file sitemap đầu; cả 3 tin đọc được là fullstack; JSON-LD có `skills` ("ReactJS, .NET, TypeScript"). Một tin là "FullStack Developer Java/Node/AWS/Angular" — đúng ca cờ `other-stack` phải bắt |

Hai điều rút ra cho chặng sau: từ khoá VNW cần đo thêm (`dotnet`,
`net developer`, `reactjs`…) trước khi chốt; và **kỹ năng nguồn khai có sẵn ở
cả hai nguồn mạnh nhất** — tầng (a) của C9 sẽ gánh phần lớn, tầng quét mô tả
chỉ là dự phòng.

### Chặng 2 — dựng workspace swe · 17/09/2026

**D1 ✅** Neon project mới `ep-morning-cloud-…` (`c-4.ap-southeast-1`, cùng
vùng với bae), chuỗi pooled trong `.env` là `DATABASE_URL_SWE`. Chốt trùng CSDL
qua: endpoint khác hẳn bae (`ep-cold-shadow-…`).

**D2 ✅** `SavedFilter.profile Json?` — theo quy trình skill `migrate-db`:

| Bước | Kết quả |
|---|---|
| Soát trước | Bae **khớp** schema cũ (`migrate diff` → "empty migration"); cả hai CSDL chỉ có extension `plpgsql`; bae 19 MB, `SavedFilter` 1 dòng; swe 0 bảng |
| Sao lưu | dòng `SavedFilter` của bae ra JSON (bảng duy nhất bị đụng) |
| Dựng swe | `db:push --ws swe` với schema CŨ — cho swe giống hệt bae để diễn tập |
| SQL sinh ra | cả hai CSDL: đúng một câu `ALTER TABLE "SavedFilter" ADD COLUMN "profile" JSONB;` — không xoá, không default |
| Diễn tập trên swe | tiến → lùi (`DROP COLUMN`) → tiến: cả ba chạy được, sau cùng hết lệch |
| Áp lên bae | **không dùng `db push`** — chạy đúng file SQL (kèm `lock_timeout = '5s'`) bằng `db execute` |
| Kiểm sau | bae hết lệch · `db:inspect` **giống hệt** trước (3.130 tin) · dòng `SavedFilter` giống bản sao lưu, `profile = null` |

Đường lùi nếu cần: `ALTER TABLE "SavedFilter" DROP COLUMN "profile";` rồi bỏ
dòng `profile` khỏi schema.

**D3 ✅** Đo bằng công cụ mới `npm run measure` (tải sitemap một lần, áp mẫu
trong bộ nhớ, không tải trang chi tiết). Số đã ghi vào
[targeting.ts](../src/constants/source/targeting.ts):

| Nguồn | URL tin | Khớp | Ghi chú |
|---|---|---|---|
| `itviec` | 733 (đủ) | **260** (35,5%) | nguồn chính; tin bị loại là SRE/Data/BA/PO |
| `careerviet` | 21.232 (đủ) | 157 (0,7%) | nhiễu: "lập trình CNC", "product developer" ngành may |
| `timviec365` | 12.440 (đủ) | 117 (0,9%) | lẫn "tư vấn phần mềm", PHP, Unity |
| `vieclam24h` | 17.089 (đủ) | 50 (0,3%) | mã danh mục IT là **`c8`**; danh mục này lẫn kế toán, kinh doanh |
| `glints` | 300 (mẫu 3/66 file) | 5 (1,7%) | |
| `topdev` | 100 (mẫu 5/257 file) | 2 (2,0%) | kho nay lẫn nhiều việc phi-IT; mỗi file chỉ 20 URL |
| `vnw` | — | .net 19 · c# 30 · sql server 23 · fullstack 21 · reactjs 5 · backend developer 63 · lap trinh vien 167 · software engineer 506 | kho IT nhỏ; `.net`/`dotnet`/`.net core` trả cùng 19 tin; `net developer` (không chấm) trả 0 |

Hai điều chỉnh rút ra từ số đo:
- **Từ điển** thêm từ loại `cnc`, `plc`, `khuôn`, `gia công`, `merchandiser`;
  đổi `net developer` thành `net develop` vì VNW trả "NET Development Engineer"
  (dấu chấm mất từ nguồn). Khoá bằng 12 test trên tiêu đề thật.
- **vieclam24h** dùng `c8p122` + nhánh slug hẹp (bỏ `lap-trinh`, `phan-mem`
  trần — hai từ kéo CNC và bán phần mềm vào).

**Seed ✅** `db:seed --ws swe`: 12 nguồn (9 bật), 34 tỉnh/thành + làm từ xa,
122 bí danh, ngành `phan-mem-hcm`.

**D4 — chạy khô ✅** `crawl --ws swe --dry --source itviec,vnw --limit 16`:
32 tin, soi bằng mắt **26/32 (81%) là việc lập trình** — qua cổng ≥ 80%, sát
nút. Tách theo nguồn thì khác hẳn: ITviec 16/16, VNW 10/16 (hai từ rộng kéo về
Hardware Engineer, DevOps, tư vấn tài chính). Các tin lạc đều bị từ điển loại.

### Lỗi lộ ra khi cào thật — gỡ theo skill `systematic-debugging`

Lượt cào thật đầu tiên: vnw **217 tin mới**, 0 lỗi. ITviec **DỪNG** sau 74 URL,
và CareerViet không chạy vì lệnh nối bằng `&&`. Truy ra **hai nguyên nhân gốc
độc lập**, nằm trong bộ đọc lương DÙNG CHUNG cho cả hai workspace:

**A — chuỗi lương trong `value` của JSON-LD bị đọc như MỘT con số.**
ITviec tin 5224 — đúng tin khớp CV nhất, "Sr .NET Backend Developer ASP.NET,
C#, SQL, ReactJS" — khai:

```json
{ "currency": "USD", "value": { "unitText": "MONTH", "value": "30,000,000 - 50,000,000đ\t" } }
```

`parseNumber` bỏ khoảng trắng và dấu `-`, hai vế dính liền thành
3.000.000.050.000.000, nhân tỷ giá USD ra 7,62e19 → tràn cột `Int` → Prisma
ném lỗi → pipeline dừng cả nguồn. Sửa: chuỗi trong `value` đi qua
`parseSalaryText` (hiểu khoảng, "upto", đơn vị); tiền tệ **ghi trong chuỗi**
thắng lời khai của sàn, lời khai chỉ dùng khi chuỗi im lặng; thêm đơn vị
`M`/`mil`/`million` = triệu (ITviec ghi "18 - 20M", "Up to 35mil").

**B — tỷ giá rỗng thành 0, làm hỏng số lương của Bae.**
`Number(process.env.USD_VND_RATE ?? 25_400)`: GitHub truyền Variable chưa khai
thành chuỗi rỗng, `??` không bắt chuỗi rỗng, `Number('')` = 0. Đo trong CSDL
bae: **172 tin USD có `fxRate = 0` và lương 0 đồng — cả 172 đều không có blob**
(tức cào trên CI), **151 tin còn sống** và đang nằm trong trung vị lương.
87 tin USD cào ở máy nhà đều đúng `fxRate = 25400`. Sửa: chỉ nhận số dương hữu
hạn, còn lại dùng 25.400; chú thích sai trong `crawl.yml` đã sửa.

**Kiểm chứng:** 14 test mới trên chuỗi THẬT — 11 đỏ trước khi sửa, 3 là hàng
rào giữ nguyên hành vi cũ (timviec365, "Upto $1100", "20 months"); so code cũ và
mới trên **2.926 blob**: bae **0/2.640** đổi, swe 4/286 đổi (đúng 4 tin ITviec
kể trên, cả 4 nay đúng); 0/0 chuỗi lương văn bản trong CSDL bae đổi.

**Chưa sửa — cần anh quyết:**

| # | Vấn đề | Đề xuất |
|---|---|---|
| B′ | 151 tin sống của Bae đang lương 0 đồng. Không có blob nên `reparse` không cứu được | Để lượt cào CI tự ghi đè khi thấy lại tin (VNW 4 lần/ngày) **sau khi đẩy code**. Tin đã hết hạn giữ số 0 nhưng không vào thống kê. Hoặc chạy một câu `UPDATE ... SET "salaryIsPublic" = false WHERE "fxRate" = 0` cho sạch ngay — ghi vào CSDL Bae nên chờ anh đồng ý. Nên khai Variable `USD_VND_RATE` trên GitHub |
| C1 | Lỗi GHI của MỘT tin làm dừng CẢ nguồn (`upsertJob` không được bắt theo từng tin) | Bắt theo từng tin, đếm vào `failed`; dừng nguồn chỉ khi nhiều tin liên tiếp cùng hỏng (dấu hiệu mất kết nối CSDL) |
| C2 | Lương bị cờ `outOfRange` vẫn giữ số và vẫn `salaryIsPublic = true` → vẫn vào trung vị, trái với chú thích "đánh dấu thay vì để số rác lọt vào trung vị". Bae: 185 tin | Để `salaryIsPublic = false` (giữ `salaryRaw` để truy vết) khi ngoài khoảng — đổi thống kê của Bae nên chờ anh quyết |

### D4 — cào thật ✅ (sau khi sửa A, B)

| Nguồn | Kết quả |
|---|---|
| `vnw` | 217 mới · 11 request · 0 lỗi |
| `itviec` | 260 URL · 246 tin (68 lượt đầu + 178) · 0 lỗi |
| `careerviet` | 157 URL · 100 mới (trần 100) · 106 request, 154 MB · 0 lỗi |

`db:inspect --ws swe`: **563 tin · 383 công ty** · 100% có blob (khoá
`.blobs/swe/…`, xác nhận tiền tố hoạt động) · 1 tin PARTIAL · TP.HCM 295,
Hà Nội 276 · lương công khai 30%, trung vị 20,3 triệu (p25 15 · p75 33).

`match --ws swe` (TP.HCM + remote, còn sống, 90 ngày): 292 tin đưa vào chấm.
Lượt soi đầu thấy 4 tin lập trình bị **loại oan** — "Senior .NET Engineer
Fintech domain", "Tuyển Dụng Kỹ Sư Phát Triển Ứng Dụng" (VNW mở đầu tiêu đề
bằng "Tuyển dụng", dính từ loại), "01 Chuyên Viên Phát Triển Phần Mềm", "ATS
Software Development Engineer". Sửa từ điển (thêm `net engineer`,
`phát triển phần mềm`, `phát triển ứng dụng`, `software develop`; thay
`tuyển dụng` trần bằng ba cụm cụ thể), khoá bằng test, nạp bằng
`db:seed --ws swe --force-fields`:

```
NHẬN chắc 196 · NHẬN yếu 12 · LOẠI 84  →  thuộc ngành 208/292 (71%)
⚠ 167/208 tin chưa từng được kiểm còn-sống bằng HTTP
```

Còn cố ý để loại: "Salesforce Developer" (từ loại `sales` khớp tiền tố
"salesforce") — là nghề lập trình nhưng stack không liên quan CV.

Riêng tin nhắc .NET/C# ở tiêu đề (TP.HCM/remote, còn sống): **34 tin**, khoảng
20 tin Junior/Mid — ví dụ ".NET Developer" (NextEdge), "Back End Developer C#,
.NET, SQL" (LG CNS), "Fullstack Developer .NET, ReactJS" (TMA), "MIDDLE BACKEND
DEVELOPER (.NET Core / SQL)" (28–35tr). Tin "[HCM - Tan Phu] C# / SQL
Developer" (Eurofins) nằm ở CẢ vnw lẫn careerviet → cần khử trùng lặp.

**Cổng chặng 2:** có tin ✅ · soi mắt ≥ 80% ✅ (81%). **N1** chưa: 208/300 tin
thuộc ngành từ 3 nguồn — còn topdev, glints, timviec365, vieclam24h chưa cào;
phần "≥ 60 tin mức Hợp" chờ chặng 3.

### Việc tiếp theo

| # | Việc | Ai |
|---|---|---|
| C7–C12 | Kỹ năng + độ hợp CV (chặng 3) — `toTechKey` sẽ thay các từ tạm `net develop`/`net engineer`/`asp net` | tôi |
| — | Cào nốt topdev, glints, vieclam24h (timviec365 chậm, để sau) | tôi |
| — | `recheck --ws swe` cho 167 tin chưa kiểm còn-sống | tôi, hoặc để lịch CI ở chặng 6 |
| B′, C1, C2 | Ba việc ở bảng "Chưa sửa" phía trên | **anh quyết** |
| C7–C12 | Kỹ năng + độ hợp CV (chặng 3) | tôi |
| — | Chuyển repo sang public | **anh** — Settings → General → Danger Zone |
| — | Đổi mật khẩu CSDL swe (chuỗi kết nối đã dán vào khung chat) | **anh** — Neon → Roles → Reset password, rồi sửa `.env` |

---

## Phụ lục — đã kiểm trong code để viết tài liệu này (17/09/2026)

| Kiểm | Kết quả |
|---|---|
| Kết nối CSDL | `src/api/db.ts`: một Prisma client toàn cục, import thẳng ở `src/api/*`, `src/actions/*`, `scripts/*`, `pipeline.ts` |
| `DEFAULT_FIELD_SLUG` | dùng ở 9 file (8 trang + 1 action) — mọi trang neo vào một ngành |
| `classifyPurchase` / `PURCHASE_TYPES` | gọi thẳng ở `field.api.ts`, `viec/[id]`, trang `nganh`, `field-active-filters.tsx` |
| `Skill` / `JobSkill` | có trong schema, **không chỗ nào ghi** — `skillTexts` chỉ được `probe` in ra |
| `toMatchKey` | `[^a-z0-9]+ → ' '` — xoá `.`, `#`, `+` |
| Nhắm nguồn theo nghề thu mua | `PURCHASE_SLUG` ở 6 nguồn, mẫu `c14p122` ở vieclam24h, 10 `queries` ở vnw — nằm lẫn với cấu hình "cách vào" |
| Khoá blob | `{source}/{yyyy-MM}/{externalId}.json.gz`, không có tiền tố workspace |
| Bảng màu | cookie `bj-theme`, hai giá trị `pastel-green` và `blue` |
| Fixture test | `tests/fixtures/itviec-job.json` có `skills: "Python, FastAPI, Docker, Golang, AI, C++"` — mẫu sẵn cho ca `other-stack` |
| GitHub Actions | `concurrency: crawl`, 5 lịch/ngày, trần 45 phút |
| Chuyển hướng hiện có | `redirect` cứng về `/cai-dat` trong `actions/dictionary.ts` — phải đổi ở C16 |
| Prisma Client đọc `DATABASE_URL` khi nào | **lúc truy vấn đầu tiên** — tạo client, đổi biến sang host `khong-ton-tai.invalid`, truy vấn → lỗi báo đúng host mới |
| Prisma CLI: biến có sẵn hay `.env` thắng | **biến có sẵn** — `db pull --print` với host giả báo P1001 ở host giả, không nối vào Neon thật |
| Lịch sử git có bí mật không (trước khi public) | `git log --all -p`: không có chuỗi kết nối kèm mật khẩu, không `npg_…`, `ghp_…`, khoá R2 hay `EDIT_KEY`. Email chỉ xuất hiện ở tên tác giả commit, không nằm trong file nào. Chưa từng commit `.env` hay `.pdf` |
