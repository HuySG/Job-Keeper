import 'server-only';

import { cache } from 'react';

import { db } from '@/api/db';
import { LIST_INCLUDE, PAGE_SIZE, type JobListItem } from '@/api/job.api';
import { FRESH_CHECK_HOURS } from '@/constants/field';
import { JobStatus, SaturdayWork } from '@/enums';
import {
  EXPERIENCE_BANDS,
  FACET_NONE,
  SALARY_BANDS,
  experienceBandOf,
  salaryBandOf,
  salaryValue,
} from '@/lib/field-bands';
import {
  compileField,
  isNarrowHcm,
  matchJob,
  type CompiledField,
  type MatchKeyMode,
  type MatchResult,
} from '@/lib/field-match';
import { matchKeyOf } from '@/lib/cv-profile';
import { classifyPurchase, type PurchaseTypeResult } from '@/lib/purchase-type';
import { toMatchKey } from '@/crawler/normalize/text';

// Bảng khoảng lọc nằm ở `lib/field-bands` (không có `server-only`) để giao
// diện tra được nhãn; xuất lại ở đây cho chỗ gọi cũ khỏi phải biết chuyện đó.
export { EXPERIENCE_BANDS, FACET_NONE, SALARY_BANDS, salaryValue } from '@/lib/field-bands';

/**
 * Đọc tin theo "ngành của tôi" — bộ lọc do người dùng định nghĩa, lưu trong
 * bảng `SavedFilter`.
 *
 * Khác `job.api.ts` ở đúng một điểm, nhưng là điểm quan trọng: ở đó bộ lọc là
 * những gì gõ được thành SQL (tỉnh, cấp bậc, lương), còn ở đây bộ lọc là một
 * TỪ ĐIỂN có luật ưu tiên — từ loại thắng từ nhận, tiêu đề nặng hơn mô tả,
 * từ xám không tự kéo tin vào ngành. Luật đó sống ở `lib/field-match.ts` và
 * chạy trong JS.
 *
 * Hệ quả phải nói rõ: **phân trang và đếm facet làm trong bộ nhớ**. Ta lấy toàn
 * bộ tin còn sống trong phạm vi tỉnh của ngành (hiện ~800) rồi mới chấm, đếm và
 * cắt trang. Đây là đánh đổi có ý thức, không phải sơ suất — nó đổi lấy việc từ
 * điển và cách chia loại sửa được bằng một câu UPDATE hoặc một dòng hằng số,
 * không phải một lần migrate. Khi phạm vi vượt vài nghìn tin thì phải chuyển
 * sang cột tsvector + index GIN; con số cần theo dõi là `FieldPage.scanned`.
 */

/** Tin còn sống — cùng định nghĩa với `job.api.ts`, cố ý lặp lại để đọc là thấy. */
const ALIVE: string[] = [JobStatus.OPEN, JobStatus.STALE];

// Ngưỡng "vừa kiểm" nay nằm ở `constants/field` để giao diện dùng chung.
export { FRESH_CHECK_HOURS };

export interface FieldMatchedJob {
  job: JobListItem;
  match: MatchResult;
  purchase: PurchaseTypeResult;
}

/** Một dòng trong bảng đếm: giá trị, nhãn, số tin. */
export interface Facet {
  value: string;
  label: string;
  /** Nhãn gọn, nếu bảng khoảng có khai — xem `EXPERIENCE_BANDS.short`. */
  short?: string;
  count: number;
  hint?: string;
}

export interface FieldPage {
  slug: string;
  name: string;
  keywordCount: number;
  excludeCount: number;
  /** Slug tỉnh/thành của ngành — dùng cho truy vấn, KHÔNG dùng để hiện ra. */
  provinces: string[];
  /**
   * Tên tỉnh/thành đọc được, cùng thứ tự với `provinces`.
   *
   * Tách riêng vì giao diện từng hiện thẳng slug ("ho-chi-minh") cho người
   * dùng đọc. Slug là khoá của máy; tra tên là việc của tầng đọc dữ liệu, nơi
   * đã sẵn có kết nối CSDL, chứ không phải việc của component.
   */
  provinceNames: string[];
  maxAgeDays: number | null;

  items: FieldMatchedJob[];
  /** Số tin còn lại SAU KHI áp mọi bộ lọc. */
  total: number;
  /**
   * Số tin thuộc ngành TRƯỚC khi áp bộ lọc loại/quận/thứ 7/lương.
   *
   * Phải tách khỏi `total`, vì `coverage` bên dưới đếm trên tập này. Ghép nhầm
   * hai con số của hai tập khác nhau thì ra nhãn kiểu "117/3 tin có" — đúng
   * kiểu vô nghĩa mà người đọc không có cách nào tự phát hiện.
   */
  inFieldTotal: number;
  strong: number;
  weak: number;
  /**
   * Tin khớp yếu bị ẩn vì chưa bật "Kể cả tin khớp yếu". Luôn đếm — kể cả khi
   * đang ẩn — để giao diện nói được "còn 23 tin khớp yếu nếu bạn muốn soi".
   */
  weakHidden: number;
  /** Số tin đã chấm để ra được từng ấy — mẫu số của "lọt qua từ điển". */
  scanned: number;
  /**
   * Số tin TỪ ĐIỂN nhận, đếm trước mọi lựa chọn của người dùng.
   *
   * Tách khỏi `total` vì hai con số trả lời hai câu khác nhau, mà đặt cạnh nhau
   * thì nhìn giống hệt. `total` là "còn bao nhiêu tin sau khi tôi lọc"; con số
   * này là "từ điển ngành chặt tới đâu" — thuộc tính của TỪ ĐIỂN, không phải
   * của phiên xem này.
   *
   * Trước đây giao diện lấy `total/scanned` làm tỷ lệ "lọt qua từ điển". Sai:
   * tích thêm một ô lọc quận là tỷ lệ đó tụt, làm như từ điển vừa chặt hơn —
   * trong khi từ điển không hề đổi. Mẫu số đúng là `scanned - droppedByNarrowHcm`
   * (số tin thật sự được đưa qua từ điển).
   */
  dictionaryAccepted: number;
  freshlyChecked: number;
  droppedByNarrowHcm: number;

  /**
   * Đếm theo từng chiều, tính TRƯỚC khi áp bộ lọc của chiều đó (nếu không thì
   * chọn một giá trị xong mọi giá trị khác hiện số 0 và không quay lại được).
   */
  facets: {
    purchaseTypes: Facet[];
    districts: Facet[];
    saturday: Facet[];
    experience: Facet[];
    salary: Facet[];
  };

  /**
   * Thống kê của tập ĐANG XEM (sau bộ lọc), không phải của cả ngành.
   * Giao diện phải ghi mẫu số kèm theo, nếu không hai con số của hai tập khác
   * nhau đứng cạnh nhau là đọc sai ngay.
   */
  stats: {
    /** VND/tháng, trung vị trên số tin CÓ ghi lương. `null` khi chưa tin nào ghi. */
    salaryMedian: number | null;
    /**
     * Số tin có CON SỐ lương dùng được — cùng luật với ô "Thoả thuận" của bảng
     * lọc, nên `salaryCount` + số tin trong ô đó luôn bằng `total`.
     */
    salaryCount: number;
    topCompanies: Facet[];
    sources: Facet[];
    levels: Facet[];
    /** Tin đăng trong 24 giờ qua, trong tập đang xem. */
    postedLast24h: number;
    /**
     * Trung vị lương theo từng khoảng kinh nghiệm (trừ ô "không ghi").
     * `count` là số tin của khoảng, `sample` là số tin trong đó CÓ ghi số —
     * trung vị chỉ tính trên `sample`, nên giao diện phải nói cả hai.
     */
    salaryByExperience: {
      value: string;
      label: string;
      count: number;
      sample: number;
      median: number | null;
    }[];
  };

  /**
   * Lọc ra 0 tin thì bỏ chiều nào sẽ có lại bao nhiêu tin. Rỗng khi còn kết quả.
   * Xem `relaxHints`.
   */
  relax: Facet[];
  /**
   * Bao nhiêu tin có dữ liệu cho từng chiều — để nói thật về độ phủ.
   * Đếm trên `inFieldTotal`, KHÔNG phải trên `total`.
   */
  coverage: {
    district: number;
    saturday: number;
    experience: number;
    salary: number;
  };

  page: number;
  pageCount: number;
  /** Lần sửa từ điển gần nhất — `null` khi đang chấm một bản nháp chưa lưu. */
  updatedAt: Date | null;
}

export interface FieldQuery {
  page?: number;
  /**
   * `true` = `items` gồm MỌI tin từ trang 1 tới trang `page`, không chỉ trang
   * `page`. Đây là "Xem thêm 20 tin" của trang Ngành: bấm là danh sách dài
   * thêm tại chỗ, không phải nhảy sang một trang mới rồi mất dấu tin vừa đọc.
   */
  cumulative?: boolean;
  /** false = chỉ hiện tin "nhận chắc" (từ nhận nằm ở TIÊU ĐỀ). */
  includeWeak?: boolean;
  /** true = bỏ tin ở Bình Dương / Bà Rịa – Vũng Tàu (phần sáp nhập 2025). */
  strictHcm?: boolean;

  /**
   * Tìm chữ trong TIÊU ĐỀ và TÊN CÔNG TY của tin đã vào ngành.
   *
   * Đây là chiều THU HẸP PHẠM VI, cùng hạng với `includeWeak`/`strictHcm`, chứ
   * không phải chiều lọc như `districts`. Khác biệt quan trọng: nó áp TRƯỚC lúc
   * đếm facet, nên gõ "Vietmap" thì mọi con số trong bảng lọc — quận, lương,
   * kinh nghiệm — đều đếm lại trong phạm vi Vietmap. Nếu áp sau như một chiều
   * lọc thì bảng lọc hiện số của cả ngành trong khi danh sách chỉ có Vietmap,
   * và hai bên nói hai chuyện khác nhau.
   *
   * Bỏ dấu hai đầu bằng `toMatchKey`, nên gõ "ke toan" ra "Kế Toán". CỐ Ý không
   * tìm trong `descriptionText`: mô tả dài và đầy chữ soạn sẵn, tìm ở đó thì
   * gõ "sản xuất" ra gần như mọi tin — đúng kiểu ồn ào làm ô tìm kiếm vô dụng.
   */
  q?: string;

  /**
   * Bốn chiều dưới đây đều là **chọn nhiều**. Quy ước ở khắp nơi:
   * nhiều giá trị TRONG một chiều là HOẶC, giữa các chiều là VÀ.
   * Mảng rỗng = không lọc chiều đó.
   *
   * "Sản xuất HOẶC Dệt may" VÀ "Quận 7 HOẶC Bình Tân" — đó là cách người ta
   * thật sự đi tìm việc, và là lý do bản một-giá-trị cũ bắt phải tìm ba lượt.
   */
  purchaseTypes?: readonly string[];
  districts?: readonly string[];
  saturdays?: readonly string[];
  /** Khoảng kinh nghiệm — xem `EXPERIENCE_BANDS`. */
  experience?: readonly string[];
  /** Khoảng lương — xem `SALARY_BANDS`. */
  salary?: readonly string[];
}

/**
 * Định nghĩa một ngành — đúng những cột của `SavedFilter` mà việc chấm điểm cần.
 *
 * Tách khỏi dòng CSDL vì trang Cài đặt phải chấm được một từ điển CHƯA LƯU (bản
 * nháp trong URL) bằng đúng bộ luật chấm từ điển đã lưu. Hai đường chấm riêng là
 * hai con số lệch nhau, và "xem trước 318 tin" thành lời nói dối.
 */
export interface FieldDefinition {
  slug: string;
  name: string;
  keywords: readonly string[];
  excludes: readonly string[];
  provinces: readonly string[];
  levels: readonly string[];
  maxAgeDays: number | null;
  /** Cách chuẩn hoá chữ của từ điển — xem `MatchKeyMode`. */
  matchKey: MatchKeyMode;
  updatedAt: Date | null;
}

/**
 * Bọc `cache()`: một lượt tải trang Kho tin hay Chi tiết hỏi định nghĩa ngành
 * hai, ba lần (khung ngoài, bảng tin, tin tương tự).
 */
export const getFieldDefinition = cache(async (slug: string): Promise<FieldDefinition | null> => {
  const row = await db.savedFilter.findUnique({ where: { slug } });
  if (!row) return null;
  return {
    slug: row.slug,
    name: row.name,
    keywords: row.keywords,
    excludes: row.excludes,
    provinces: row.provinces,
    levels: row.levels,
    maxAgeDays: row.maxAgeDays,
    matchKey: matchKeyOf(row.profile),
    updatedAt: row.updatedAt,
  };
});

/**
 * Tin còn sống trong PHẠM VI của một ngành (tỉnh, cấp bậc, tuổi tin).
 *
 * Khoá cache là một chuỗi chứ không phải object: `cache()` so tham số bằng
 * danh tính, nên hai object cùng nội dung vẫn là hai lần truy vấn. Trang Cài
 * đặt chấm bản đã lưu, bản nháp VÀ dựng báo cáo từng từ — cùng một phạm vi thì
 * chỉ đọc CSDL một lần.
 */
const loadCandidates = cache(async (scopeKey: string) => {
  const scope = JSON.parse(scopeKey) as {
    provinces: string[];
    levels: string[];
    maxAgeDays: number | null;
  };
  const since = scope.maxAgeDays
    ? new Date(Date.now() - scope.maxAgeDays * 24 * 60 * 60 * 1000)
    : null;

  return db.jobPosting.findMany({
    where: {
      status: { in: ALIVE },
      ...(scope.provinces.length
        ? { locations: { some: { location: { slug: { in: scope.provinces } } } } }
        : {}),
      ...(since ? { postedAt: { gte: since } } : {}),
      ...(scope.levels.length ? { level: { in: scope.levels } } : {}),
    },
    orderBy: { postedAt: 'desc' },
    include: LIST_INCLUDE,
  });
});

function candidatesFor(definition: FieldDefinition) {
  return loadCandidates(
    JSON.stringify({
      provinces: [...definition.provinces].sort(),
      levels: [...definition.levels].sort(),
      maxAgeDays: definition.maxAgeDays,
    }),
  );
}

/**
 * Tên đọc được của các slug tỉnh/thành, giữ đúng thứ tự truyền vào.
 *
 * Slug nào chưa có trong bảng Location thì giữ nguyên slug — thà hiện một
 * chuỗi xấu còn hơn nuốt mất cả tỉnh khỏi dòng "phạm vi".
 */
export async function getProvinceNames(slugs: readonly string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  const rows = await db.location.findMany({
    where: { slug: { in: [...slugs] } },
    select: { slug: true, name: true },
  });
  const byslug = new Map(rows.map((row) => [row.slug, row.name]));
  return slugs.map((slug) => byslug.get(slug) ?? slug);
}

export async function findFieldJobs(
  slug: string,
  query: FieldQuery = {},
): Promise<FieldPage | null> {
  const definition = await getFieldDefinition(slug);
  return definition ? scoreField(definition, query) : null;
}

/** Chấm một định nghĩa ngành bất kỳ — đã lưu hay còn là bản nháp. */
export async function scoreField(
  definition: FieldDefinition,
  query: FieldQuery = {},
): Promise<FieldPage> {
  const [candidates, provinceNames] = await Promise.all([
    candidatesFor(definition),
    getProvinceNames(definition.provinces),
  ]);

  const field = compileField(
    { keywords: definition.keywords, excludes: definition.excludes },
    { matchKey: definition.matchKey },
  );

  // ── Bước 1: vào ngành hay không ────────────────────────────────────────────
  const inField: FieldMatchedJob[] = [];
  let droppedByNarrowHcm = 0;
  let dictionaryAccepted = 0;
  let weakHidden = 0;

  // Chuẩn hoá MỘT LẦN ngoài vòng lặp: `toMatchKey` chạy regex, và vòng này
  // quay vài nghìn lượt mỗi lần tải trang.
  const needle = query.q?.trim() ? toMatchKey(query.q) : null;

  for (const job of candidates) {
    if (query.strictHcm && !isNarrowHcm(job.locations.map((l) => l.rawText))) {
      droppedByNarrowHcm += 1;
      continue;
    }

    const match = matchJob(field, { title: job.title, description: job.descriptionText });
    if (match.verdict === 'reject') continue;

    // Đếm NGAY ĐÂY, trước mọi lựa chọn của người dùng. Đây là thước đo của
    // riêng TỪ ĐIỂN — nó không được nhúc nhích khi ai đó tích thêm một ô lọc
    // hay gõ vào ô tìm kiếm. Xem `dictionaryAccepted` ở `FieldPage`.
    dictionaryAccepted += 1;

    if (needle && !hitsText(job, needle)) continue;
    if (match.verdict === 'weak' && !query.includeWeak) {
      weakHidden += 1;
      continue;
    }

    inField.push({ job, match, purchase: classifyPurchase(job) });
  }

  // ── Bước 2: đếm facet ──────────────────────────────────────────────────────
  //
  // Mỗi chiều được đếm trên tập đã áp MỌI bộ lọc KHÁC, trừ chính nó. Đếm trên
  // tập đã lọc hết thì vừa chọn "Sản xuất" xong là mọi loại khác hiện 0 và
  // người dùng không còn đường quay lại — lỗi kinh điển của giao diện lọc.
  const facets = {
    purchaseTypes: countBy(
      inField.filter((r) => keep(r, query, 'purchaseTypes')),
      (r) => [r.purchase.slug, r.purchase.label, r.purchase.hint],
    ),
    // Quận và lịch thứ 7 nay có thêm ô "Tin không ghi" thay vì bị bỏ qua bằng
    // `null` — xem `FACET_NONE`. Nhờ vậy con số trong các ô cộng lại đúng bằng
    // tổng số tin, tức là nhìn bảng lọc là kiểm được nó có bỏ sót gì không.
    districts: countBy(
      inField.filter((r) => keep(r, query, 'districts')),
      (r) => (r.job.district ? [r.job.district, r.job.district] : [FACET_NONE, 'Tin không ghi quận']),
    ),
    saturday: countBy(
      inField.filter((r) => keep(r, query, 'saturdays')),
      (r) =>
        r.job.saturdayWork
          ? [r.job.saturdayWork, SATURDAY_LABELS[r.job.saturdayWork] ?? r.job.saturdayWork]
          : [FACET_NONE, 'Tin không ghi'],
    ),
    experience: countBands(
      inField.filter((r) => keep(r, query, 'experience')),
      EXPERIENCE_BANDS,
      (r) => experienceBandOf(r.job.yearsExpMin),
    ),
    salary: countBands(
      inField.filter((r) => keep(r, query, 'salary')),
      SALARY_BANDS,
      (r) => salaryBandOf(r.job),
    ),
  };

  // Độ phủ phải dùng ĐÚNG luật mà ô lọc bên cạnh dùng, nếu không hai con số
  // đứng cạnh nhau lại đá nhau. Hai chỗ từng lệch:
  //   · kinh nghiệm: coverage nhận cả tin chỉ có `yearsExpMax`, còn khoảng lọc
  //     cắt theo `yearsExpMin` — nên tin đó vừa được đếm là "có ghi" vừa rơi
  //     vào ô "Tin không ghi".
  //   · lương: `salaryIsPublic` bật nhưng cả min lẫn max đều rỗng thì
  //     `salaryValue` trả null và tin rơi vào ô "Thoả thuận".
  const coverage = {
    district: inField.filter((r) => r.job.district !== null).length,
    saturday: inField.filter((r) => r.job.saturdayWork !== null).length,
    experience: inField.filter((r) => r.job.yearsExpMin !== null).length,
    salary: inField.filter((r) => salaryValue(r.job) !== null).length,
  };

  // ── Bước 3: áp bộ lọc rồi mới cắt trang ────────────────────────────────────
  const matched = inField.filter((r) => keep(r, query, null));
  const strong = matched.filter((m) => m.match.verdict === 'strong').length;

  matched.sort((a, b) => {
    if (a.match.verdict !== b.match.verdict) return a.match.verdict === 'strong' ? -1 : 1;
    return b.job.postedAt.getTime() - a.job.postedAt.getTime();
  });

  const freshBefore = new Date(Date.now() - FRESH_CHECK_HOURS * 60 * 60 * 1000);
  const freshlyChecked = matched.filter(
    ({ job }) => job.lastCheckedAt !== null && job.lastCheckedAt >= freshBefore,
  ).length;

  const total = matched.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(query.page ?? 1)), pageCount);

  // ── Bước 4: thống kê ───────────────────────────────────────────────────────
  //
  // Tính trên `matched` (tập ĐANG XEM) chứ không trên `inField`: người dùng lọc
  // xong thì câu hỏi đổi từ "ngành này thế nào" sang "chỗ tôi đang nhắm thế
  // nào" — lương trung vị của 12 tin ở Quận 7 mới là con số đáng đọc, chứ
  // không phải trung vị của cả ngành. Giao diện ghi rõ mẫu số để khỏi nhầm.
  const stats = {
    salaryMedian: median(matched.map((r) => salaryValue(r.job)).filter((v): v is number => v !== null)),
    salaryCount: matched.filter((r) => salaryValue(r.job) !== null).length,
    topCompanies: countBy(matched, (r) => [r.job.company.name, r.job.company.name]).slice(0, 8),
    sources: countBy(matched, (r) => [r.job.source.name, r.job.source.name]),
    levels: countBy(matched, (r) => (r.job.level ? [r.job.level, LEVEL_LABELS[r.job.level] ?? r.job.level] : [FACET_NONE, 'Không ghi cấp bậc'])),
    postedLast24h: matched.filter((r) => r.job.postedAt.getTime() >= Date.now() - 24 * 60 * 60 * 1000).length,
    salaryByExperience: EXPERIENCE_BANDS.filter((band) => band.value !== FACET_NONE).map((band) => {
      const rows = matched.filter((r) => experienceBandOf(r.job.yearsExpMin) === band.value);
      const values = rows.map((r) => salaryValue(r.job)).filter((v): v is number => v !== null);
      return {
        value: band.value,
        label: band.short,
        count: rows.length,
        sample: values.length,
        median: median(values),
      };
    }),
  };

  return {
    slug: definition.slug,
    name: definition.name,
    keywordCount: definition.keywords.length,
    excludeCount: definition.excludes.length,
    provinces: [...definition.provinces],
    provinceNames,
    maxAgeDays: definition.maxAgeDays,

    items: matched.slice(query.cumulative ? 0 : (page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total,
    inFieldTotal: inField.length,
    strong,
    weak: total - strong,
    weakHidden,
    scanned: candidates.length,
    dictionaryAccepted,
    freshlyChecked,
    droppedByNarrowHcm,
    facets,
    coverage,
    stats,
    relax: total === 0 ? relaxHints(inField, query) : [],

    page,
    pageCount,
    updatedAt: definition.updatedAt,
  };
}

/**
 * Trung vị, KHÔNG phải trung bình.
 *
 * Lương là phân bố lệch phải: vài tin giám đốc 150 triệu kéo trung bình lên
 * trên mức mà phần lớn người đọc thật sự gặp. Trung vị nói đúng "một nửa số
 * tin nằm dưới mức này".
 */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2) : (sorted[mid] ?? null);
}

const LEVEL_LABELS: Record<string, string> = {
  INTERN: 'Thực tập',
  FRESHER: 'Mới ra trường',
  JUNIOR: 'Junior',
  MID: 'Middle',
  SENIOR: 'Senior',
  LEAD: 'Trưởng nhóm',
  MANAGER: 'Quản lý',
};

/**
 * Tin có lọt qua bộ lọc không.
 *
 * `except` cho phép bỏ qua đúng một chiều — dùng khi đếm facet của chính chiều
 * đó, để các lựa chọn còn lại vẫn hiện số thật thay vì 0.
 */
export type FieldDimension = 'purchaseTypes' | 'districts' | 'saturdays' | 'experience' | 'salary';

/**
 * Tin có chứa chuỗi tìm kiếm trong tiêu đề hoặc tên công ty không.
 *
 * `needle` phải ĐÃ qua `toMatchKey` trước khi gọi — chuẩn hoá lại trong này là
 * chạy regex thêm vài nghìn lần cho mỗi lần tải trang.
 *
 * Dùng `toMatchKey(job.title)` chứ không dùng cột `titleNorm` có sẵn: `titleNorm`
 * do crawler ghi, nên nếu luật chuẩn hoá đổi thì các tin cũ mang chuẩn cũ và
 * cùng một câu tìm ra hai kết quả khác nhau tuỳ tin cũ hay mới. Tính tại chỗ
 * thì hai vế luôn cùng một luật.
 */
function hitsText(job: JobListItem, needle: string): boolean {
  return (
    toMatchKey(job.title).includes(needle) || toMatchKey(job.company.name).includes(needle)
  );
}

function keep(row: FieldMatchedJob, query: FieldQuery, except: FieldDimension | null): boolean {
  const { job } = row;

  // Một chiều chỉ lọc khi có ít nhất một ô được tích; nhiều ô là HOẶC.
  // `FACET_NONE` làm cho "tin không ghi" trở thành một giá trị bình thường,
  // nên không còn nhánh đặc biệt nào ẩn trong hàm này nữa.
  const on = (dim: FieldDimension, value: string): boolean => {
    if (except === dim) return true;
    const chosen = query[dim];
    if (!chosen || chosen.length === 0) return true;
    return chosen.includes(value);
  };

  return (
    on('purchaseTypes', row.purchase.slug) &&
    on('districts', job.district ?? FACET_NONE) &&
    on('saturdays', job.saturdayWork ?? FACET_NONE) &&
    on('experience', experienceBandOf(job.yearsExpMin)) &&
    on('salary', salaryBandOf(job))
  );
}

/** Chiều nào đang được lọc, kèm tên đọc được — dùng cho gợi ý nới lọc. */
const DIMENSION_LABELS: Record<FieldDimension, string> = {
  purchaseTypes: 'Loại mua hàng',
  districts: 'Quận / khu',
  saturdays: 'Lịch thứ 7',
  experience: 'Kinh nghiệm',
  salary: 'Lương',
};

/**
 * Khi lọc ra 0 tin: bỏ chiều nào thì được bao nhiêu tin?
 *
 * Đây là phần thứ hai của việc **tránh lọc sót**. Một danh sách rỗng tự nó
 * không nói được lỗi nằm ở đâu: người dùng tích năm ô ở bốn chiều rồi phải tự
 * đoán ô nào giết hết kết quả, thường là gỡ bừa từng cái. Ở đây ta tính hộ —
 * thử bỏ từng chiều một rồi đếm lại — và chỉ nêu những chiều thật sự cứu được
 * kết quả, xếp theo số tin thu về.
 */
function relaxHints(inField: FieldMatchedJob[], query: FieldQuery): Facet[] {
  const active = (Object.keys(DIMENSION_LABELS) as FieldDimension[]).filter(
    (dim) => (query[dim]?.length ?? 0) > 0,
  );
  if (active.length < 1) return [];

  return active
    .map((dim) => ({
      value: dim,
      label: DIMENSION_LABELS[dim],
      count: inField.filter((row) => keep(row, { ...query, [dim]: [] }, null)).length,
    }))
    .filter((hint) => hint.count > 0)
    .sort((a, b) => b.count - a.count);
}

const SATURDAY_LABELS: Record<string, string> = {
  [SaturdayWork.NONE]: 'Nghỉ thứ 7',
  [SaturdayWork.HALF_DAY]: 'Sáng thứ 7',
  [SaturdayWork.ALTERNATE]: 'Thứ 7 luân phiên',
  [SaturdayWork.FULL]: 'Làm cả thứ 7',
};

/**
 * Khoảng kinh nghiệm — **rời nhau**, không chồng lấn.
 *
 * Đổi hẳn cách cắt so với bản trước, và đây là thay đổi có hệ quả nên phải nói
 * rõ. Bản trước là bốn ngưỡng CỘNG DỒN ("tối đa 1 năm", "tối đa 3 năm"…), tức
 * mỗi ô đã bao trùm mọi ô nhỏ hơn. Hai hệ quả xấu:
 *
 *   · Chọn nhiều ô trở nên vô nghĩa — "tối đa 1" HOẶC "tối đa 5" thì đúng bằng
 *     "tối đa 5". Không cắt rời thì không bao giờ có bộ lọc chọn nhiều thật.
 *   · Không cách nào hỏi "tin nào dành cho người 3–5 năm", câu mà người đi làm
 *     hỏi nhiều nhất, vì mọi ô đều kéo theo cả nhóm mới ra trường.
 *
 * Cắt theo `yearsExpMin` (số năm nhà tuyển dụng ĐÒI tối thiểu) vì đó là thứ
 * quyết định "tôi có nộp được không". Cột là `Int?` nên các khoảng số nguyên
 * dưới đây phủ kín, không có kẽ hở.
 *
 * Ô cuối là `FACET_NONE` — tin không ghi năm nào. Nó chiếm phần lớn kho, nên
 * giấu đi là giấu mất phần lớn thị trường.
 */
/** Đếm theo một bảng khoảng cố định — giữ nguyên THỨ TỰ khai báo, kể cả ô 0 tin. */
function countBands(
  rows: FieldMatchedJob[],
  bands: readonly { value: string; label: string; short: string; hint: string }[],
  bandOf: (row: FieldMatchedJob) => string,
): Facet[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = bandOf(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // CỐ Ý giữ cả ô có 0 tin: ô lọc biến mất rồi hiện lại giữa các lần chọn là
  // cách chắc chắn làm người dùng tưởng mình bấm nhầm. Giao diện tự làm mờ.
  return bands.map((band) => ({
    value: band.value,
    label: band.label,
    short: band.short,
    count: counts.get(band.value) ?? 0,
    ...(band.hint ? { hint: band.hint } : {}),
  }));
}

function countBy(
  rows: FieldMatchedJob[],
  pick: (row: FieldMatchedJob) => readonly [string, string, string?] | null,
): Facet[] {
  const map = new Map<string, Facet>();
  for (const row of rows) {
    const picked = pick(row);
    if (!picked) continue;
    const [value, label, hint] = picked;
    const existing = map.get(value);
    if (existing) existing.count += 1;
    else map.set(value, { value, label, count: 1, ...(hint ? { hint } : {}) });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** Danh sách ngành đã định nghĩa, cho ô chọn ở đầu trang. */
export async function listFields(): Promise<{ slug: string; name: string }[]> {
  return db.savedFilter.findMany({
    select: { slug: true, name: true },
    orderBy: { slug: 'asc' },
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   DÙNG CHUNG CHO CÁC TRANG KHÁC
   ───────────────────────────────────────────────────────────────────────────*/

/** Một tin nằm ở đâu so với ngành: có trong phạm vi không, và từ điển nói gì. */
export interface FieldVerdict {
  /** Trong tỉnh, cấp bậc và tuổi tin của ngành. */
  inScope: boolean;
  match: MatchResult;
  /**
   * Tin này có hiện ở danh sách "Ngành của tôi" MẶC ĐỊNH không — tức trong
   * phạm vi VÀ khớp chắc. Đây là nghĩa của ô vuông đầu dòng ở Kho tin; tin khớp
   * yếu không được đánh dấu vì mặc định trang Ngành đang ẩn chúng.
   */
  listed: boolean;
}

type ScopedJob = Pick<JobListItem, 'title' | 'descriptionText' | 'postedAt' | 'level'> & {
  locations: { location: { slug: string } }[];
};

/**
 * Bộ chấm dựng một lần, dùng cho cả trang Kho tin (20 dòng) lẫn Chi tiết.
 *
 * Cùng `compileField` + `matchJob` với trang Ngành — ô vuông "đúng ngành" ở Kho
 * tin mà dùng một luật khác thì hai trang cãi nhau về cùng một tin.
 */
export function fieldJudge(definition: FieldDefinition): (job: ScopedJob) => FieldVerdict {
  const field: CompiledField = compileField(
    { keywords: definition.keywords, excludes: definition.excludes },
    { matchKey: definition.matchKey },
  );
  const since = definition.maxAgeDays
    ? Date.now() - definition.maxAgeDays * 24 * 60 * 60 * 1000
    : null;

  return (job) => {
    const inScope =
      (definition.provinces.length === 0 ||
        job.locations.some((entry) => definition.provinces.includes(entry.location.slug))) &&
      (definition.levels.length === 0 || (job.level !== null && definition.levels.includes(job.level))) &&
      (since === null || job.postedAt.getTime() >= since);
    const match = matchJob(field, { title: job.title, description: job.descriptionText });
    return { inScope, match, listed: inScope && match.verdict === 'strong' };
  };
}

export interface TermCount {
  label: string;
  count: number;
}

/**
 * Mỗi từ trong từ điển đang kéo về bao nhiêu tin — số trên từng nhãn ở trang
 * Cài đặt.
 *
 * Ba con số, ba câu hỏi khác nhau, nên đếm theo ba luật khác nhau:
 *
 *   · từ CHẮC — bao nhiêu tin (không bị loại) có từ này ở TIÊU ĐỀ. Gỡ từ này
 *     thì những tin chỉ nhờ nó mới vào sẽ rơi ra; con số là trần của mất mát.
 *   · từ XÁM  — bao nhiêu tin SẼ VÀO THÊM nếu nâng từ này lên chắc: tiêu đề có
 *     từ xám, không có từ chắc nào, không bị loại. Tin đã vào nhờ từ chắc
 *     không tính, vì nâng lên cũng chẳng đổi gì với chúng.
 *   · từ LOẠI — bao nhiêu tin đang bị CHÍNH từ này chặn mà nếu không chặn thì
 *     từ điển đã nhận (chắc hoặc yếu). Tin vốn không khớp gì thì chặn hay không
 *     cũng vậy, đếm vào là thổi phồng công của từ loại.
 *
 * Một tin bị nhiều từ loại cùng chặn thì chỉ tính cho từ ĐẦU TIÊN — đúng như
 * `matchJob` báo `rejectedBy`. Nhờ vậy tổng các nhãn bằng đúng số tin bị loại.
 */
export interface DictionaryReport {
  strong: TermCount[];
  gray: TermCount[];
  /** Số tin khác nhau sẽ vào thêm nếu nâng TẤT CẢ từ xám. */
  grayReach: number;
  excludes: TermCount[];
  /** Số tin khác nhau đang bị từ loại chặn. */
  excludedTotal: number;
  scanned: number;
}

export async function dictionaryReport(definition: FieldDefinition): Promise<DictionaryReport> {
  const candidates = await candidatesFor(definition);
  const field = compileField(
    { keywords: definition.keywords, excludes: definition.excludes },
    { matchKey: definition.matchKey },
  );

  const strong = new Map(field.strong.map((term) => [term.label, 0]));
  const gray = new Map(field.gray.map((term) => [term.label, 0]));
  const excludes = new Map(field.excludes.map((term) => [term.label, 0]));
  let grayReach = 0;
  let excludedTotal = 0;

  const bump = (map: Map<string, number>, label: string) => map.set(label, (map.get(label) ?? 0) + 1);

  for (const job of candidates) {
    const titleKey = toMatchKey(job.title);
    const strongHits = field.strong.filter((term) => term.re.test(titleKey));
    const blocker = field.excludes.find((term) => term.re.test(titleKey));

    if (blocker) {
      let wouldAccept = strongHits.length > 0;
      if (!wouldAccept && job.descriptionText) {
        // Chỉ chuẩn hoá mô tả khi thật cần — mô tả dài tới 8 KB mỗi tin.
        const descKey = toMatchKey(job.descriptionText);
        wouldAccept = field.strong.filter((term) => term.re.test(descKey)).length >= 2;
      }
      if (wouldAccept) {
        bump(excludes, blocker.label);
        excludedTotal += 1;
      }
      continue;
    }

    for (const term of strongHits) bump(strong, term.label);

    if (strongHits.length === 0) {
      const grayHits = field.gray.filter((term) => term.re.test(titleKey));
      for (const term of grayHits) bump(gray, term.label);
      if (grayHits.length > 0) grayReach += 1;
    }
  }

  const list = (map: Map<string, number>): TermCount[] =>
    [...map].map(([label, count]) => ({ label, count }));

  return {
    strong: list(strong),
    gray: list(gray),
    grayReach,
    excludes: list(excludes),
    excludedTotal,
    scanned: candidates.length,
  };
}
