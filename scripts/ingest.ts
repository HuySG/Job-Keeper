import { readFileSync } from 'node:fs';

import { db } from '@/api/db';
import { extractLocations, normalizeJobPosting, type NormalizedJob } from '@/crawler/normalize';
import { upsertJob } from '@/crawler/pipeline';
import type { SourceConfig } from '@/crawler/sources/types';
import { SourceKind } from '@/enums';

import { loadEnv, parseArgs } from './_env';

/**
 * Nhập tay MỘT tin tuyển dụng từ nơi crawler không được phép tới.
 *
 *   npm run ingest -- --source fb-tay --url <permalink> --file bai.txt
 *   npm run ingest -- --source li-tay --url <link> --file tin.txt --dry
 *   npm run ingest -- --source fb-tay --url <permalink> --file bai.txt \
 *                     --title "Nhân viên thu mua" --company "Công ty ABC" --ngay 2026-09-08
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ FILE NÀY
 *
 * Facebook và LinkedIn là hai nơi tin tuyển dụng thu mua chảy qua nhiều nhất mà
 * không sàn nào chỉ mục lại. Cả hai đều CẤM crawler của ta trong robots.txt —
 * đo 11/09/2026 bằng đúng UA thật, hỏi bằng chính robots-parser mà crawler
 * dùng: LinkedIn cấm cả /jobs/view/, /jobs/search/ lẫn endpoint khách;
 * Facebook để user-agent * ở Disallow: / và chỉ chừa một danh sách trắng.
 *
 * Đó là lời từ chối, không phải rào kỹ thuật, nên KHÔNG có adapter nào cho hai
 * nguồn ấy và `loadSources` loại chúng khỏi mọi lượt crawl. Không một request
 * nào của máy đi tới facebook.com hay linkedin.com.
 *
 * Nhưng NGƯỜI DÙNG thì vẫn đọc được những bài đó bằng tài khoản của chính họ —
 * kể cả trong nhóm kín mà họ là thành viên. Script này là cây cầu: người đọc,
 * người sao chép, còn máy chỉ làm phần nó giỏi hơn — bóc lương, cấp bậc, tỉnh,
 * quận, lịch thứ Bảy — rồi xếp tin vào chung một danh sách với các sàn khác.
 *
 * Ranh giới, viết ra để sau này không ai vô tình bước qua: nếu một ngày file
 * này bắt đầu TỰ gọi ra facebook.com hay linkedin.com — dù chỉ để "kiểm tin còn
 * sống" — thì nó đã thành thứ mà robots.txt của họ cấm. Lúc đó phải dừng, chứ
 * không phải thêm một cờ cấu hình.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Tin dán tay không có validThrough. Hạn mặc định, xem `--han`. */
const DEFAULT_VALID_DAYS = 30;

async function main(): Promise<void> {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  const code = args.string('source');
  const url = args.string('url');
  const file = args.string('file');
  const dryRun = args.boolean('dry');

  if (!code || !url || !file) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const source = await db.source.findUnique({ where: { code } });
  if (!source) {
    console.error(`Không có nguồn "${code}". Chạy \`npm run db:seed\` trước.`);
    process.exitCode = 1;
    return;
  }
  if (source.kind !== SourceKind.MANUAL) {
    console.error(
      `Nguồn "${code}" là ${source.kind}, không phải nguồn nhập tay.\n` +
        `Nguồn có adapter thì dùng \`npm run crawl -- --source ${code}\` — nhập tay ` +
        `vào đó sẽ bị chính lượt crawl sau ghi đè.`,
    );
    process.exitCode = 1;
    return;
  }

  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`Không đọc được ${file}: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }
  if (!text.trim()) {
    console.error(`${file} rỗng.`);
    process.exitCode = 1;
    return;
  }

  const postedAt = readDate(args.string('ngay')) ?? new Date();
  const validDays = args.number('han') ?? DEFAULT_VALID_DAYS;
  const expiresAt = new Date(postedAt.getTime() + validDays * 24 * 60 * 60 * 1000);

  const title = args.string('title') ?? guessTitle(text);
  const company = args.string('company') ?? guessCompany(text) ?? 'Không rõ';

  // Bài đăng là chữ tự do, không có ô nào cả — nên phải TỰ CHỌN RA dòng nói về
  // lương và dòng nói về nơi làm, rồi mới đưa cho bộ chuẩn hoá.
  //
  // ĐỪNG đưa cả bài cho parseSalaryText. Đo thật trên một bài mẫu có đúng một
  // dòng "Lương: 12 - 18 triệu VNĐ/tháng": đưa cả bài thì nó trả về
  // 2.000.000 – 90.000.000, vì nhặt phải "2 năm kinh nghiệm" và "8h00 - 17h00"
  // rồi lấy biên rộng nhất. Đưa đúng một dòng thì ra 12–18 triệu. Một con số
  // sai kiểu này không báo lỗi ở đâu cả, nó chỉ lặng lẽ kéo lệch mọi trung vị.
  const salaryText = args.string('luong') ?? pickLine(text, SALARY_LINE) ?? null;
  const placeText = args.string('noi') ?? pickPlace(text);

  // Dựng một khối JSON-LD giả rồi cho đi qua ĐÚNG bộ chuẩn hoá của các nguồn
  // khác. Cố ý không viết bộ bóc riêng: tin dán tay mà đi đường riêng thì lương
  // và cấp bậc của nó sẽ lệch chuẩn so với phần còn lại của kho, và mọi so sánh
  // trong thống kê đều hỏng theo một cách rất khó nhìn ra.
  const job = normalizeJobPosting(
    {
      '@type': 'JobPosting',
      title,
      description: text,
      hiringOrganization: { '@type': 'Organization', name: company },
      datePosted: postedAt.toISOString(),
      validThrough: expiresAt.toISOString(),
      jobLocation: placeText
        ? { '@type': 'Place', address: { '@type': 'PostalAddress', streetAddress: placeText } }
        : undefined,
      url,
    },
    {
      pageUrl: url,
      externalIdFromUrl: () => externalIdFrom(url),
      fallback: { salaryText },
      // Chuỗi địa chỉ tự do nằm ở streetAddress, không phải ở ô cấp tỉnh.
      trustStreetFirst: true,
    },
  );

  printSummary(job, source.name, validDays, args.string('ngay') == null);

  if (dryRun) {
    console.log('\n[--dry] Chưa ghi gì vào CSDL.');
    return;
  }

  const outcome = await upsertJob(
    {
      id: source.id,
      code: source.code,
      name: source.name,
      homeUrl: source.homeUrl,
      kind: source.kind as SourceKind,
      entryUrl: source.entryUrl,
      jobUrlPattern: source.jobUrlPattern,
      config: (source.config ?? null) as Record<string, unknown> | null,
      priority: source.priority,
    } satisfies SourceConfig,
    job,
    // Không có blob: nội dung gốc là file người dùng đang giữ, và chép nó lên
    // kho blob không thêm được gì mà lại nhân bản dữ liệu cá nhân của họ.
    null,
  );

  console.log(`\n✓ Đã ${outcome === 'created' ? 'THÊM' : 'CẬP NHẬT'} tin (${source.name}).`);
  console.log('  Xem ở trang Ngành: /nganh?f=thu-mua-hcm');
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Đoán tiêu đề: dòng có chữ ĐẦU TIÊN, cắt còn 120 ký tự.
 *
 * Bài tuyển dụng trên Facebook gần như luôn mở bằng chức danh, thường kèm emoji
 * và dấu chấm than. Đoán sai thì đã có `--title`, nên chỗ này cố ý làm đơn giản
 * thay vì thông minh — một bộ đoán phức tạp sai theo kiểu khó thấy còn tệ hơn.
 */
function guessTitle(text: string): string {
  const line = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s#*\-–—•]+/gu, '').trim())
    .find((l) => l.length >= 3);
  return (line ?? 'Tin tuyển dụng').slice(0, 120);
}

/** Dò tên công ty theo các mẫu hay gặp: "Công ty ...", "Cty ...", "Tại: ...". */
function guessCompany(text: string): string | null {
  const patterns = [
    /(?:^|\n)\s*(?:c[ôo]ng\s*ty|cty|c\.?ty)\s*[:\-–]?\s*([^\n]{3,80})/iu,
    /(?:^|\n)\s*(?:t[êe]n\s*c[ôo]ng\s*ty|nh[àa]\s*tuy[eể]n\s*d[uụ]ng|company)\s*[:\-–]\s*([^\n]{3,80})/iu,
  ];
  for (const re of patterns) {
    const match = re.exec(text);
    const value = match?.[1]?.trim();
    if (value) return value.length > 80 ? value.slice(0, 80) : value;
  }
  return null;
}

/** Dòng nói về tiền. Cố ý KHÔNG bắt "thu nhập" chung chung ở tiêu đề bài. */
const SALARY_LINE = /(?:^|\s)(?:m[ứu]c\s*)?l[ưu][ơo]ng\b|thu\s*nh[aậ]p\b|salary\b|package\b/iu;

/** Dòng nói về nơi làm việc. */
const PLACE_LINE =
  /(?:^|\s)(?:đ[iị]a\s*[đd]i[eể]m|n[oơ]i\s*l[àa]m|đ[iị]a\s*ch[iỉ]|l[àa]m\s*vi[eệ]c\s*t[aạ]i|location|workplace)\b/iu;

/** Dòng ĐẦU TIÊN khớp mẫu, đã bỏ nhãn ở đầu ("Địa điểm:" → phần còn lại). */
function pickLine(text: string, pattern: RegExp): string | null {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length < 3 || !pattern.test(line)) continue;
    return line.slice(0, 300);
  }
  return null;
}

/**
 * Nơi làm việc: ưu tiên dòng có nhãn, không có thì lấy dòng ĐẦU TIÊN tự nó dò
 * ra được một tỉnh.
 *
 * Vì sao không đưa thẳng cả bài cho `extractLocations`: nó tìm ra tỉnh thật,
 * nhưng `raw` khi đó là toàn bộ bài đăng, và chuỗi ấy được ghi vào
 * `JobLocation.rawText` — cột vốn tồn tại để người ta ĐỐI CHIẾU khi nghi ánh xạ
 * sai. Nhét cả bài vào đó là làm hỏng đúng công dụng của nó, và tốn chỗ trong
 * hạn mức 0,5 GB.
 */
function pickPlace(text: string): string | null {
  const labelled = pickLine(text, PLACE_LINE);
  if (labelled) return labelled;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length < 3 || line.length > 200) continue;
    if (extractLocations(line, { trustStreetFirst: true }).some((l) => l.province)) return line;
  }
  return null;
}

/** externalId từ URL: lấy chuỗi số dài nhất, không có thì băm chính URL. */
function externalIdFrom(url: string): string {
  const numbers = url.match(/\d{6,}/g);
  if (numbers?.length) return numbers.sort((a, b) => b.length - a.length)[0]!;
  return url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').slice(0, 60);
}

function readDate(input: string | undefined): Date | null {
  if (!input) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(input) ? `${input}T00:00:00+07:00` : input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function printSummary(
  job: NormalizedJob,
  sourceName: string,
  validDays: number,
  guessedDate: boolean,
): void {
  const money = (n: number | null): string =>
    n === null ? '—' : `${(n / 1e6).toFixed(1).replace(/\.0$/, '')} tr`;

  console.log(`\n┌─ ${sourceName}`);
  console.log(`│  ${job.url}`);
  console.log('└──────────────────────────────────────────────────────\n');
  console.log(`  tiêu đề   ${job.title}`);
  console.log(`  công ty   ${job.companyName}  [${job.companySlug}]`);
  console.log(
    `  lương     ${job.salary.isPublic ? `${money(job.salary.min)} – ${money(job.salary.max)}` : 'thoả thuận'}`,
  );
  console.log(`  cấp bậc   ${job.level ?? '—'}   kinh nghiệm ${job.yearsExpMin ?? '—'}–${job.yearsExpMax ?? '—'} năm`);
  console.log(
    `  nơi làm   ${job.locations.map((l) => l.province?.name ?? `?${l.raw}`).join(', ') || '—'}` +
      `   quận ${job.district ?? '—'}`,
  );
  console.log(`  thứ Bảy   ${job.saturdayWork ?? '—'}   ${job.scheduleRaw ?? ''}`);
  console.log(`  hiệu lực  ${fmt(job.postedAt)} → ${fmt(job.expiresAt)}`);
  console.log(`  mã tin    ${job.externalId}`);

  if (job.parseStatus !== 'OK') console.log(`\n  ⚠ ${job.parseStatus}: ${job.parseError}`);

  // Hai con số dưới đây là PHỎNG ĐOÁN chứ không phải điều nguồn nói. Nói rõ ở
  // đây, mỗi lần chạy, vì đây là chỗ dễ quên nhất khi nhìn lại dữ liệu sau này.
  const warnings: string[] = [];
  if (guessedDate) warnings.push(`ngày đăng lấy theo GIỜ CHẠY LỆNH — dùng --ngay 2026-09-08 nếu biết ngày thật`);
  warnings.push(`hạn ${validDays} ngày là PHỎNG ĐOÁN, bài gốc không nói — dùng --han N để đổi`);
  if (job.companyName === 'Không rõ') warnings.push('không dò được tên công ty — dùng --company "..."');
  if (job.locations.length === 0) warnings.push('không dò được tỉnh, tin sẽ KHÔNG hiện ở bộ lọc theo tỉnh — dùng --noi "TP. Hồ Chí Minh"');

  console.log('');
  for (const line of warnings) console.log(`  · ${line}`);
}

function fmt(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : '—';
}

function printUsage(): void {
  console.log(`
Nhập tay một tin từ nơi crawler không được phép tới (Facebook, LinkedIn).

  npm run ingest -- --source <code> --url <link> --file <bai.txt> [tuỳ chọn]

Bắt buộc
  --source   fb-tay | li-tay
  --url      link gốc của bài/tin — cũng là khoá chống trùng
  --file     file .txt chứa nội dung bài đã sao chép

Tuỳ chọn
  --title    tiêu đề, mặc định lấy dòng có chữ đầu tiên
  --company  tên công ty, mặc định dò trong bài
  --noi      nơi làm việc, ví dụ "Quận 7, TP. Hồ Chí Minh"
  --luong    dòng lương, ví dụ "12 - 18 triệu/tháng" — mặc định dò trong bài
  --ngay     ngày đăng YYYY-MM-DD, mặc định là hôm nay
  --han      số ngày còn hiệu lực, mặc định ${DEFAULT_VALID_DAYS}
  --dry      chỉ in ra, KHÔNG ghi CSDL — nên chạy lần này trước

Ví dụ
  npm run ingest -- --source fb-tay --url https://www.facebook.com/groups/1/posts/2/ \\
                    --file bai.txt --noi "Bình Tân, TP.HCM" --ngay 2026-09-10 --dry
`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
