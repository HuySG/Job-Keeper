import { SourceKind } from '@/enums';

import { normalizeJobPosting } from '../normalize';
import { buildBlobKey } from '../storage/blob';
import type { CrawlItem, SourceAdapter, SourceRunContext } from './types';

/**
 * VietnamWorks — nguồn API JSON.
 *
 * Đo thật 25/08/2026: `POST ms.vietnamworks.com/job-search/v1.0/search` trả
 * HTTP 200, **10.556 tin**, **không cần token**, mỗi bản ghi có **106 trường**.
 * Đây là nguồn rẻ nhất và sạch nhất — làm đầu tiên là đúng.
 *
 * Ba lợi thế riêng chỉ nguồn này có:
 *   - `isActive` / `isOnline` / `expiredOn` — tín hiệu còn-sống lấy thẳng từ
 *     nguồn, không phải suy đoán. Máy kiểm 4 tầng gần như không phải làm gì.
 *   - `lastUpdatedOn` — crawl tăng dần chính xác tới từng tin.
 *   - `isReposted` — nguồn tự khai tin đăng lại, khỏi phải tự phát hiện.
 *
 * Và hai cái bẫy, đều gặp ngay ở bản ghi đầu tiên khi khảo sát:
 *   - `salaryCurrency` KHÔNG đáng tin (xem `readSalary` bên dưới)
 *   - `salaryMin: 0` nghĩa là "không có sàn", KHÔNG phải "lương bằng không"
 */

const SEARCH_ENDPOINT = 'https://ms.vietnamworks.com/job-search/v1.0/search';
const HITS_PER_PAGE = 50;

interface VnwSearchResponse {
  meta?: { nbHits?: number; nbPages?: number; page?: number };
  data?: VnwJob[];
}

/** Chỉ khai những trường ta thật sự dùng trong số 106 trường nguồn trả về. */
interface VnwJob {
  jobId: number;
  jobTitle: string;
  jobUrl: string;
  companyName?: string;
  companyId?: number;
  companyLogo?: string;
  companyUrl?: string;
  jobDescription?: string;
  jobRequirement?: string;
  approvedOn?: string;
  createdOn?: string;
  expiredOn?: string;
  lastUpdatedOn?: string;
  isActive?: boolean;
  isOnline?: boolean;
  isSalaryVisible?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  prettySalary?: string;
  jobLevel?: string;
  jobLevelVI?: string;
  yearsOfExperience?: number;
  typeWorkingId?: number;
  address?: string;
  skills?: { skillName?: string }[];
  workingLocations?: { address?: string; cityName?: string; cityNameVI?: string }[];
  industriesV3?: { industryV3Name?: string; industryV3NameVI?: string }[];
  jobFunction?: { parentName?: string; parentNameVI?: string };
}

/** typeWorkingId -> employmentType của schema.org. */
const WORKING_TYPE: Record<number, string> = {
  1: 'FULL_TIME',
  2: 'PART_TIME',
  3: 'CONTRACT',
  4: 'INTERN',
  5: 'TEMPORARY',
};

/** Cấu hình riêng của nguồn này, đọc từ cột `Source.config`. */
interface VnwConfig {
  /**
   * Danh sách truy vấn để NHẮM MỤC TIÊU. Rỗng/không khai = quét tin mới nhất
   * của cả sàn như trước.
   *
   * Đo thật 08/09/2026: `query` là chuỗi tự do và ăn ngay —
   * "thu mua" trả 407 tin, "purchasing" 1.200, "procurement" 849.
   *
   * ⚠️ ĐÃ THỬ VÀ KHÔNG DÙNG ĐƯỢC: lọc địa điểm phía nguồn. Bốn tên trường
   *    (`workingLocationsCityId`, `cityId`, `locationId`, `cityIds`) đều trả
   *    `nbHits: 0`, và `value` phải là chuỗi chứ mảng thì HTTP 400. Nên tỉnh
   *    thành lọc ở phía ta, bằng bảng Location — cách đó còn đúng hơn vì nó
   *    gộp được tên cũ trước sáp nhập 2025.
   */
  queries?: string[];
}

export const vietnamworksAdapter: SourceAdapter = {
  kind: SourceKind.API,

  async *run(ctx: SourceRunContext): AsyncGenerator<CrawlItem, void, undefined> {
    const { fetcher, log } = ctx;
    const endpoint = ctx.source.entryUrl || SEARCH_ENDPOINT;
    const config = (ctx.source.config ?? {}) as VnwConfig;

    const queries = (config.queries ?? []).map((q) => q.trim()).filter(Boolean);
    // Không khai query nào thì giữ nguyên hành vi cũ: một lượt quét rỗng =
    // tin mới nhất của cả sàn.
    const plan = queries.length > 0 ? queries : [''];

    const maxJobs = ctx.limits.maxDetailPages;
    // Chia đều ngân sách cho từng từ khoá. Không chia thì từ khoá đầu tiên ăn
    // hết trần và những từ sau không lấy được tin nào — đúng cái làm hỏng mục
    // đích của việc khai nhiều từ khoá.
    const perQuery = Math.max(1, Math.ceil(maxJobs / plan.length));

    /** Khử trùng GIỮA các từ khoá: "thu mua" và "mua hang" chồng nhau rất nhiều. */
    const seenIds = new Set<string>();
    let fetched = 0;

    if (queries.length > 0) {
      log(`nhắm mục tiêu ${queries.length} từ khoá, mỗi từ tối đa ${perQuery} tin`);
    }

    for (const query of plan) {
      if (fetched >= maxJobs) break;

      const label = query || '(mọi tin)';
      const startedAt = fetched;
      let page = 0;
      let stop = false;

      while (!stop && fetched < maxJobs && fetched - startedAt < perQuery) {
        const body = {
          query,
          filter: [],
          ranges: [],
          // Mặc định của nguồn đã là mới nhất trước, nên trang 0 là tin mới nhất.
          order: [],
          hitsPerPage: HITS_PER_PAGE,
          page,
        };

        let response: VnwSearchResponse;
        try {
          response = await fetcher.fetchJson<VnwSearchResponse>(endpoint, {
            method: 'POST',
            body,
          });
        } catch (err) {
          yield {
            kind: 'error',
            url: `${endpoint}#q=${encodeURIComponent(query)}&page=${page}`,
            message: (err as Error).message,
          };
          break; // hỏng một từ khoá thì thử từ tiếp theo, không bỏ cả nguồn
        }

        const jobs = response.data ?? [];
        if (jobs.length === 0) break;

        if (page === 0) {
          log(`"${label}": ${response.meta?.nbHits ?? '?'} tin, ${response.meta?.nbPages ?? '?'} trang`);
        }

        for (const job of jobs) {
          if (fetched >= maxJobs || fetched - startedAt >= perQuery) {
            stop = true;
            break;
          }

          const externalId = String(job.jobId);
          if (seenIds.has(externalId)) continue;
          seenIds.add(externalId);

          yield { kind: 'seen', externalId, url: job.jobUrl };

          const updated = parseDate(job.lastUpdatedOn ?? job.approvedOn);
          const tooOld = Boolean(ctx.modifiedSince && updated && updated < ctx.modifiedSince);
          if (tooOld) {
            // Không có từ khoá: nguồn sắp mới-nhất-trước, nên gặp tin cũ hơn
            // mốc là mọi tin sau cũng cũ hơn -> dừng luôn, khỏi đọc tiếp.
            // CÓ từ khoá: thứ tự là theo ĐỘ LIÊN QUAN, không đơn điệu theo
            // ngày, nên dừng sớm là bỏ sót. Chỉ bỏ qua đúng tin này.
            if (!query) {
              log(`"${label}": dừng ở trang ${page} — đã tới tin cũ hơn mốc`);
              stop = true;
              break;
            }
            yield { kind: 'skipped', url: job.jobUrl, reason: 'cũ hơn mốc crawl tăng dần' };
            continue;
          }

          try {
            yield await toCrawlItem(ctx, job, externalId);
            fetched += 1;
          } catch (err) {
            yield { kind: 'error', url: job.jobUrl, message: (err as Error).message };
          }
        }

        page += 1;
        const totalPages = response.meta?.nbPages ?? 0;
        if (totalPages > 0 && page >= totalPages) break;
      }

      if (query) log(`"${label}": lấy ${fetched - startedAt} tin`);
    }

    log(`đã duyệt ${seenIds.size} tin, lấy ${fetched}`);
  },
};

async function toCrawlItem(
  ctx: SourceRunContext,
  job: VnwJob,
  externalId: string,
): Promise<CrawlItem> {
  // Dựng lại bản ghi API thành hình dạng schema.org JobPosting rồi mới nắn.
  //
  // Cố ý đi vòng qua JSON-LD thay vì viết một đường nắn riêng: như vậy toàn bộ
  // logic lương / cấp bậc / địa danh chỉ tồn tại MỘT bản, được test một lần, và
  // sửa một chỗ là cả 6 nguồn cùng đúng. Nguồn API mà có đường nắn riêng thì
  // sớm muộn nó sẽ lệch khỏi các nguồn kia mà không ai nhận ra.
  const jsonLd = toJsonLd(job);

  const normalized = normalizeJobPosting(jsonLd as never, {
    pageUrl: job.jobUrl,
    externalIdFromUrl: () => externalId,
    fallback: {
      salaryText: job.isSalaryVisible === false ? 'Thoả thuận' : (job.prettySalary ?? null),
      skills: (job.skills ?? []).map((s) => s.skillName ?? '').filter(Boolean),
    },
  });

  // Nguồn tự khai tin đã tắt -> tin cậy hơn mọi suy đoán của ta.
  if (job.isActive === false || job.isOnline === false) {
    normalized.expiresAt = normalized.expiresAt ?? new Date(0);
  }

  // Dùng khoá do kho blob TRẢ VỀ, không dùng khoá tự dựng.
  //
  // Kho rỗng (BLOB_DRIVER=null, dùng khi chạy khô hoặc chạy trên CI không có
  // R2) trả chuỗi rỗng. Ghi bừa khoá tự dựng vào DB là tạo ra một con trỏ tới
  // tệp không bao giờ tồn tại: `npm run reparse` sau này sẽ báo "thiếu blob"
  // mãi mãi, và siêu năng lực tính-lại-không-cào-lại mất dần mà không ai thấy.
  const stored = await ctx.blobs.put(buildBlobKey(ctx.source.code, externalId), {
    fetchedAt: new Date().toISOString(),
    api: job,
  });

  return { kind: 'job', job: normalized, rawKey: stored || null };
}

/**
 * Dựng lại bản ghi API thành hình dạng schema.org.
 *
 * MỞ RA NGOÀI vì `scripts/reparse.ts` cần nó: blob của nguồn này lưu bản ghi
 * API thô chứ không phải JSON-LD, nên không có hàm này thì reparse phải bỏ qua
 * toàn bộ tin VietnamWorks — mà đó đang là 1.737/2.169 tin trong kho. Không
 * backfill được nghĩa là mỗi lần thêm một trường mới lại phải đi cào lại nguồn,
 * đúng cái mà `rawKey` sinh ra để tránh.
 */
export function vnwRecordToJsonLd(job: unknown): Record<string, unknown> {
  return toJsonLd(job as VnwJob);
}

function toJsonLd(job: VnwJob): Record<string, unknown> {
  const description = [job.jobDescription, job.jobRequirement].filter(Boolean).join('\n');

  return {
    '@type': 'JobPosting',
    title: job.jobTitle,
    description,
    url: job.jobUrl,
    datePosted: job.approvedOn ?? job.createdOn,
    validThrough: job.expiredOn,
    employmentType: WORKING_TYPE[job.typeWorkingId ?? 1] ?? 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: job.companyName,
      url: job.companyUrl || undefined,
      logo: job.companyLogo || undefined,
    },
    jobLocation: buildLocations(job),
    baseSalary: readSalary(job),
    skills: (job.skills ?? []).map((s) => s.skillName).filter(Boolean),
    // NGÀNH CỦA CÔNG TY — tách riêng khỏi occupationalCategory là có chủ ý.
    // `jobFunction` của nguồn này gần như luôn là "Hậu Cần/Xuất Nhập Khẩu/Kho
    // Bãi" với mọi tin thu mua (đo: 44%), tức nó nói NHÓM NGHỀ chứ không nói
    // công ty làm gì. Còn `industriesV3` mới phân biệt được mua hàng cho nhà
    // máy dệt may với mua hàng cho công ty xây dựng — đúng thứ cần để chia loại.
    industry: (job.industriesV3 ?? [])
      .map((i) => i.industryV3NameVI || i.industryV3Name)
      .filter(Boolean),
    occupationalCategory: [
      job.jobFunction?.parentNameVI,
      job.jobFunction?.parentName,
      ...(job.industriesV3 ?? []).map((i) => i.industryV3NameVI || i.industryV3Name),
    ].filter(Boolean),
    experienceRequirements:
      job.yearsOfExperience && job.yearsOfExperience > 0
        ? `${job.yearsOfExperience} năm kinh nghiệm`
        : undefined,
    // jobLevel của nguồn ("Manager"/"Trưởng phòng") được nhét vào tiêu đề phụ
    // để inferLevel đọc được, thay vì thêm một đường suy luận riêng.
    identifier: { '@type': 'PropertyValue', value: String(job.jobId) },
    jobLevelHint: job.jobLevelVI || job.jobLevel,
  };
}

function buildLocations(job: VnwJob): unknown[] {
  const locations = (job.workingLocations ?? []).map((loc) => ({
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      streetAddress: loc.address,
      addressRegion: loc.cityNameVI || loc.cityName,
      addressCountry: 'VN',
    },
  }));

  if (locations.length === 0 && job.address) {
    locations.push({
      '@type': 'Place',
      address: { '@type': 'PostalAddress', streetAddress: job.address, addressRegion: undefined, addressCountry: 'VN' },
    });
  }
  return locations;
}

/**
 * Đọc lương từ bản ghi API — chỗ có hai cái bẫy thật.
 *
 * **Bẫy 1: `salaryCurrency` nói dối.** Bản ghi đầu tiên gặp khi khảo sát ghi
 * `salaryCurrency: "USD"`, `salaryMax: 150000000`, `prettySalary: "Tới $ 150tr
 * /tháng"`. Một trăm năm mươi triệu **đồng**, không phải đô. Tin thẳng trường
 * đó là thổi lương lên 25.000 lần và phá nát mọi trung vị. Quy tắc: giá trị
 * >= 1.000.000 thì chắc chắn là VND bất kể nguồn khai gì — không ai trả
 * 150 triệu USD một tháng.
 *
 * **Bẫy 2: `salaryMin: 0`** nghĩa là "không có sàn" (tin dạng "Tới 150tr"),
 * chứ không phải lương bằng không. Để số 0 lọt vào là kéo trung vị xuống đáy.
 */
function readSalary(job: VnwJob): Record<string, unknown> | undefined {
  if (job.isSalaryVisible === false) return undefined;

  const min = job.salaryMin && job.salaryMin > 0 ? job.salaryMin : null;
  const max = job.salaryMax && job.salaryMax > 0 ? job.salaryMax : null;
  if (min === null && max === null) return undefined;

  const largest = Math.max(min ?? 0, max ?? 0);
  const declared = String(job.salaryCurrency ?? 'VND').toUpperCase();
  const currency = declared === 'USD' && largest < 1_000_000 ? 'USD' : 'VND';

  return {
    '@type': 'MonetaryAmount',
    currency,
    value: {
      '@type': 'QuantitativeValue',
      minValue: min ?? undefined,
      maxValue: max ?? undefined,
      unitText: 'MONTH',
    },
  };
}

function parseDate(input: string | undefined): Date | null {
  if (!input) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}
