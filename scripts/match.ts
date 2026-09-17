import { db } from '@/api/db';
import { WORKSPACES } from '@/constants/workspace';
import { JobStatus } from '@/enums';
import {
  compileField,
  isNarrowHcm,
  matchJob,
  type MatchResult,
  type Verdict,
} from '@/lib/field-match';

import { loadEnv, parseArgs } from './_env';

/**
 * Soi xem từ điển ngành đang bắt đúng cái gì — **KHÔNG ghi DB**.
 *
 *   npm run match                                  ngành mặc định, 20 dòng mỗi loại
 *   npm run match -- --ws swe                      ngành mặc định của workspace swe
 *   npm run match -- --filter thu-mua-hcm
 *   npm run match -- --show reject                 xem tin bị loại, để dò loại oan
 *   npm run match -- --show weak --sample 40
 *   npm run match -- --strict-hcm                  bỏ Bình Dương / Vũng Tàu
 *   npm run match -- --all-provinces               bỏ luôn ràng buộc tỉnh
 *
 * Đây là vòng lặp làm việc chính khi chỉnh ngành: chạy → nhìn 20 dòng → sửa từ
 * điển bằng SQL → chạy lại. Không lần nào phải sửa code, và vì không ghi gì nên
 * chạy sai cũng không hỏng dữ liệu.
 */
async function main(): Promise<void> {
  const ws = loadEnv();
  const args = parseArgs(process.argv.slice(2));

  // Mặc định là ngành chính của workspace đang chọn — `--ws swe` mà vẫn tìm
  // `thu-mua-hcm` thì chỉ ra "không có ngành" trong CSDL phần mềm.
  const slug = args.string('filter') ?? WORKSPACES[ws].defaultField;
  const sample = args.number('sample') ?? 20;
  const show = (args.string('show') ?? 'strong') as Verdict | 'all';
  const strictHcm = args.boolean('strict-hcm');
  const allProvinces = args.boolean('all-provinces');
  const includeDead = args.boolean('include-dead');

  const filter = await db.savedFilter.findUnique({ where: { slug } });
  if (!filter) {
    console.error(`Không có ngành "${slug}". Chạy \`npm run db:seed\` trước.`);
    process.exitCode = 1;
    return;
  }

  const field = compileField({ keywords: filter.keywords, excludes: filter.excludes });

  const provinces = allProvinces ? [] : filter.provinces;
  const since = filter.maxAgeDays
    ? new Date(Date.now() - filter.maxAgeDays * 24 * 60 * 60 * 1000)
    : null;

  const postings = await db.jobPosting.findMany({
    where: {
      ...(includeDead ? {} : { status: { in: [JobStatus.OPEN, JobStatus.STALE] } }),
      ...(provinces.length ? { locations: { some: { location: { slug: { in: provinces } } } } } : {}),
      ...(since ? { postedAt: { gte: since } } : {}),
    },
    select: {
      id: true,
      title: true,
      descriptionText: true,
      url: true,
      status: true,
      salaryMin: true,
      salaryMax: true,
      salaryIsPublic: true,
      postedAt: true,
      expiresAt: true,
      lastCheckedAt: true,
      company: { select: { name: true } },
      source: { select: { code: true } },
      locations: { select: { rawText: true } },
    },
    orderBy: { postedAt: 'desc' },
  });

  console.log(`\n┌─ Ngành "${filter.name}" (${slug})`);
  console.log(`│  ${filter.keywords.length} từ nhận · ${filter.excludes.length} từ loại`);
  console.log(
    `│  phạm vi: ${provinces.join(', ') || 'mọi tỉnh'}` +
      `${strictHcm ? ' · CHỈ HCM CŨ' : ''}` +
      `${since ? ` · đăng từ ${since.toISOString().slice(0, 10)}` : ''}` +
      `${includeDead ? ' · kể cả tin đã chết' : ' · chỉ tin còn sống'}`,
  );
  console.log(`└─ ${postings.length} tin đưa vào chấm\n`);

  if (postings.length === 0) {
    console.log('Không có tin nào lọt vào phạm vi. Cào trước đã:');
    console.log('  npm run crawl -- --source vnw --full --limit 400');
    return;
  }

  const buckets: Record<Verdict, { posting: (typeof postings)[number]; result: MatchResult }[]> = {
    strong: [],
    weak: [],
    reject: [],
  };
  let droppedByHcm = 0;

  for (const posting of postings) {
    if (strictHcm && !isNarrowHcm(posting.locations.map((l) => l.rawText))) {
      droppedByHcm += 1;
      continue;
    }
    const result = matchJob(field, { title: posting.title, description: posting.descriptionText });
    buckets[result.verdict].push({ posting, result });
  }

  for (const bucket of Object.values(buckets)) {
    bucket.sort((a, b) => b.result.score - a.result.score);
  }

  const inField = buckets.strong.length + buckets.weak.length;
  const scored = inField + buckets.reject.length;

  console.log('┌─ Kết quả chấm');
  console.log(`│  NHẬN chắc  (từ nhận ở TIÊU ĐỀ)     ${String(buckets.strong.length).padStart(5)}`);
  console.log(`│  NHẬN yếu   (>=2 từ trong MÔ TẢ)    ${String(buckets.weak.length).padStart(5)}   ← soi tay`);
  console.log(`│  LOẠI                               ${String(buckets.reject.length).padStart(5)}`);
  if (droppedByHcm > 0) {
    console.log(`│  bỏ vì ngoài HCM cũ                 ${String(droppedByHcm).padStart(5)}`);
  }
  console.log(`└─ thuộc ngành: ${inField}/${scored} (${pct(inField, scored)})\n`);

  const wanted: Verdict[] = show === 'all' ? ['strong', 'weak', 'reject'] : [show];
  for (const verdict of wanted) {
    const rows = buckets[verdict];
    if (!rows) continue;

    console.log(`── ${LABEL[verdict]} — ${rows.length} tin, hiện ${Math.min(sample, rows.length)}`);
    for (const { posting, result } of rows.slice(0, sample)) {
      const salary =
        posting.salaryIsPublic && (posting.salaryMin || posting.salaryMax)
          ? `${money(posting.salaryMin)}–${money(posting.salaryMax)}`
          : 'thoả thuận';
      const why =
        verdict === 'reject'
          ? `✗ ${result.rejectedBy}`
          : [
              result.titleHits.length ? `tiêu đề: ${result.titleHits.join(', ')}` : '',
              result.grayHits.length ? `xám: ${result.grayHits.join(', ')}` : '',
              !result.titleHits.length && result.descHits.length
                ? `mô tả: ${result.descHits.slice(0, 4).join(', ')}`
                : '',
            ]
              .filter(Boolean)
              .join(' · ');

      console.log(`  ${trim(posting.title, 52).padEnd(52)} ${salary.padEnd(14)} ${posting.source.code}`);
      console.log(`    ${trim(posting.company.name, 40).padEnd(40)} ${why}`);
    }
    console.log('');
  }

  const stale = buckets.strong
    .concat(buckets.weak)
    .filter(({ posting }) => !posting.lastCheckedAt).length;
  if (stale > 0) {
    console.log(
      `⚠ ${stale}/${inField} tin thuộc ngành CHƯA từng được kiểm còn-sống bằng HTTP.\n` +
        `  Chạy: npm run recheck -- --filter ${slug}`,
    );
  }
}

const LABEL: Record<Verdict, string> = {
  strong: 'NHẬN CHẮC',
  weak: 'NHẬN YẾU (cần soi tay)',
  reject: 'LOẠI',
};

function pct(part: number, whole: number): string {
  return whole === 0 ? '0%' : `${Math.round((part / whole) * 100)}%`;
}

function money(value: number | null): string {
  return value === null ? '?' : `${(value / 1e6).toFixed(0)}tr`;
}

function trim(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

main()
  .catch((err) => {
    console.error('Chấm hỏng:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect().catch(() => undefined);
  });
