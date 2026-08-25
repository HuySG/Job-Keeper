import type { Prisma } from '@prisma/client';

import { db } from '@/api/db';
import { SOURCE_SEEDS } from '@/constants/source';
import { PROVINCES, REMOTE_SLUG } from '@/crawler/normalize/location';
import { toMatchKey } from '@/crawler/normalize/text';

import { loadEnv } from '../scripts/_env';

/**
 * Nạp dữ liệu nền: nguồn và địa danh.
 *
 * Chạy được nhiều lần mà không hỏng (idempotent) — seed mà chạy một lần rồi
 * thôi thì mỗi lần thêm nguồn lại phải nhớ viết migration tay, và sớm muộn sẽ
 * có môi trường thiếu dữ liệu nền mà không ai để ý.
 */
async function main(): Promise<void> {
  loadEnv();

  // ── Nguồn ──────────────────────────────────────────────────────────────────
  for (const seed of SOURCE_SEEDS) {
    await db.source.upsert({
      where: { code: seed.code },
      update: {
        name: seed.name,
        homeUrl: seed.homeUrl,
        kind: seed.kind,
        entryUrl: seed.entryUrl,
        jobUrlPattern: seed.jobUrlPattern,
        priority: seed.priority,
        config: (seed.config ?? undefined) as Prisma.InputJsonValue | undefined,
        // KHÔNG đụng vào isActive: người vận hành có thể đã cố ý tắt một nguồn,
        // và seed chạy lại không được phép bật nó lên sau lưng họ.
      },
      create: {
        code: seed.code,
        name: seed.name,
        homeUrl: seed.homeUrl,
        kind: seed.kind,
        entryUrl: seed.entryUrl,
        jobUrlPattern: seed.jobUrlPattern,
        priority: seed.priority,
        config: (seed.config ?? undefined) as Prisma.InputJsonValue | undefined,
        discoveredVia: 'manual',
        // isActive CHỈ đặt lúc tạo mới. Lần seed sau không được đụng vào (xem
        // nhánh update ở trên) — nguồn nào bị tắt tay thì phải ở nguyên trạng thái tắt.
        isActive: seed.isActive,
      },
    });
  }
  console.log(`✓ ${SOURCE_SEEDS.length} nguồn`);

  // ── Địa danh ───────────────────────────────────────────────────────────────
  let aliasCount = 0;
  for (const province of PROVINCES) {
    const location = await db.location.upsert({
      where: { slug: province.slug },
      update: { name: province.name, province: province.slug },
      create: { slug: province.slug, name: province.name, province: province.slug },
    });

    // Tên cũ trước sáp nhập 2025 + cách viết tắt. Đây là phần làm nên giá trị
    // của bảng: tin viết "Bình Dương" và tin viết "TP. Hồ Chí Minh" phải cùng
    // rơi vào một chỗ, nếu không thì một thị trường lao động bị xé làm đôi.
    const aliases = new Set([
      toMatchKey(province.name),
      province.slug.replace(/-/g, ' '),
      ...province.aliases.map(toMatchKey),
    ]);

    for (const raw of aliases) {
      if (!raw) continue;
      await db.locationAlias.upsert({
        where: { raw },
        update: { locationId: location.id },
        create: { raw, locationId: location.id },
      });
      aliasCount += 1;
    }
  }

  await db.location.upsert({
    where: { slug: REMOTE_SLUG },
    update: {},
    create: { slug: REMOTE_SLUG, name: 'Làm từ xa', province: REMOTE_SLUG },
  });

  console.log(`✓ ${PROVINCES.length} tỉnh/thành + 1 mục "làm từ xa", ${aliasCount} bí danh`);
  console.log('\nTiếp theo: npm run crawl -- --source vnw --limit 50');
}

main()
  .catch((err) => {
    console.error('Seed hỏng:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect().catch(() => undefined);
  });
