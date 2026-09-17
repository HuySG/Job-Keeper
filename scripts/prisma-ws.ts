import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { withoutWorkspaceFlag } from '@/lib/workspace';

import { loadEnv } from './_env';

/**
 * Chạy Prisma CLI trên CSDL của MỘT workspace.
 *
 *   npm run db:push                   workspace bae, như trước ngày tách
 *   npm run db:push -- --ws swe       CSDL của workspace swe
 *   npm run db:studio -- --ws swe
 *
 * Vì sao phải bọc: Prisma CLI tự đọc `DATABASE_URL` từ `.env`, tức luôn là
 * CSDL của bae. Bọc qua `loadEnv()` thì biến đó mang đúng chuỗi của workspace
 * đã chọn — đo 17/09/2026: biến đã có sẵn trong môi trường THẮNG `.env`
 * (`db pull` với host giả báo đúng host giả, không nối vào Neon thật).
 *
 * Prisma cũng tự in "Datasource ... at <host>" trước khi làm gì — đọc dòng đó
 * trước khi đồng ý bất kỳ thay đổi nào.
 */
function main(): void {
  try {
    loadEnv();
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
    return;
  }

  // Gọi thẳng file JS của CLI bằng chính node đang chạy: khỏi phụ thuộc vào
  // `npx` hay `prisma.cmd` — hai thứ cư xử khác nhau giữa Windows và Linux.
  const cli = resolve(process.cwd(), 'node_modules/prisma/build/index.js');
  const result = spawnSync(process.execPath, [cli, ...withoutWorkspaceFlag(process.argv.slice(2))], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) console.error('Không chạy được Prisma CLI:', result.error.message);
  process.exitCode = result.status ?? 1;
}

main();
