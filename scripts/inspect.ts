import { db } from '@/api/db';

import { loadEnv } from './_env';

/**
 * Xem nhanh tình trạng dữ liệu từ dòng lệnh.
 *
 *   npm run db:inspect
 *
 * Có Prisma Studio rồi nhưng lệnh này trả lời câu khác: không phải "có những
 * dòng nào" mà là **"dữ liệu có LÀNH không"** — bao nhiêu phần trăm tin đọc
 * được lương, bao nhiêu tin mất địa điểm, parser đang âm thầm hỏng ở đâu.
 */
async function main(): Promise<void> {
  loadEnv();

  const total = await db.jobPosting.count();
  if (total === 0) {
    console.log('Chưa có tin nào. Chạy: npm run crawl -- --source vnw --limit 100');
    return;
  }

  const [withSalary, partial, withBlob, companies, jobLocations, expired] = await Promise.all([
    db.jobPosting.count({ where: { salaryIsPublic: true } }),
    db.jobPosting.count({ where: { parseStatus: 'PARTIAL' } }),
    db.jobPosting.count({ where: { rawKey: { not: null } } }),
    db.company.count(),
    db.jobLocation.count(),
    db.jobPosting.count({ where: { status: 'EXPIRED' } }),
  ]);

  const pct = (n: number): string => `${Math.round((n / total) * 100)}%`;

  console.log(`\n┌─ ${total} tin · ${companies} công ty`);
  console.log(`│  có lương công khai   ${String(withSalary).padStart(5)}  ${pct(withSalary)}`);
  console.log(`│  có gắn địa điểm      ${String(jobLocations).padStart(5)}  ${pct(jobLocations)}`);
  console.log(`│  có blob để reparse   ${String(withBlob).padStart(5)}  ${pct(withBlob)}`);
  console.log(`│  parse PARTIAL        ${String(partial).padStart(5)}  ${pct(partial)}`);
  console.log(`│  đã hết hạn           ${String(expired).padStart(5)}  ${pct(expired)}`);
  console.log('└──────────────────────────────────');

  console.log('\nTheo nguồn:');
  for (const row of await db.jobPosting.groupBy({ by: ['sourceId'], _count: true })) {
    const source = await db.source.findUnique({ where: { id: row.sourceId } });
    console.log(`  ${(source?.code ?? '?').padEnd(14)} ${row._count}`);
  }

  console.log('\nTheo cấp bậc:');
  const levels = await db.jobPosting.groupBy({
    by: ['level'],
    _count: true,
    orderBy: { _count: { level: 'desc' } },
  });
  for (const row of levels) {
    console.log(`  ${(row.level ?? '(không rõ)').padEnd(14)} ${row._count}  ${pct(row._count)}`);
  }

  console.log('\nTop 8 tỉnh/thành:');
  const places = await db.jobLocation.groupBy({
    by: ['locationId'],
    _count: true,
    orderBy: { _count: { locationId: 'desc' } },
    take: 8,
  });
  for (const row of places) {
    const location = await db.location.findUnique({ where: { id: row.locationId } });
    console.log(`  ${(location?.name ?? '?').padEnd(18)} ${row._count}`);
  }

  console.log('\nLương (chỉ tin công khai, VND/tháng):');
  const salaries = (
    await db.jobPosting.findMany({
      where: { salaryIsPublic: true, salaryMin: { not: null } },
      select: { salaryMin: true },
    })
  )
    .map((row) => row.salaryMin!)
    .sort((a, b) => a - b);

  if (salaries.length > 0) {
    const at = (q: number): string =>
      `${(salaries[Math.floor(salaries.length * q)]! / 1e6).toFixed(1)}tr`;
    console.log(`  p25 ${at(0.25)} · trung vị ${at(0.5)} · p75 ${at(0.75)}`);
  }

  console.log('\n5 tin gần nhất:');
  const recent = await db.jobPosting.findMany({
    orderBy: { postedAt: 'desc' },
    take: 5,
    include: { company: true, locations: { include: { location: true } } },
  });
  for (const job of recent) {
    const salary = job.salaryIsPublic
      ? `${fmt(job.salaryMin)}–${fmt(job.salaryMax)}`
      : 'thoả thuận';
    const place = job.locations.map((l) => l.location.name).join(', ') || '—';
    console.log(`  ${job.title.slice(0, 46).padEnd(48)} ${salary.padEnd(14)} ${place}`);
    console.log(`    ${job.company.name.slice(0, 44)}`);
  }

  console.log('\nLần chạy gần nhất:');
  for (const run of await db.crawlRun.findMany({ orderBy: { id: 'desc' }, take: 3 })) {
    console.log(
      `  #${run.id} ${run.trigger.padEnd(9)} ${run.status.padEnd(8)} ` +
        `${run.postingsNew} mới · ${run.postingsUpdated} sửa · ${run.postingsFailed} lỗi`,
    );
  }
  console.log();
}

function fmt(value: number | null): string {
  return value === null ? '?' : `${(value / 1e6).toFixed(1)}tr`;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect().catch(() => undefined);
  });
