import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { WORKSPACES, WORKSPACE_ENV, type WorkspaceId } from '@/constants/workspace';
import { describeDatabase, missingDatabaseSentinel, planWorkspace } from '@/lib/workspace';

export interface LoadEnvOptions {
  /**
   * Script này có đụng CSDL không. `true` (mặc định) thì workspace chưa khai
   * chuỗi kết nối là DỪNG NGAY với lời nhắn rõ ràng — thay vì để Prisma chết ở
   * truy vấn đầu tiên với một câu không nhắc gì tới biến nào còn thiếu.
   * Chỉ `probe` đặt `false`: nó chạy được trên máy trắng.
   */
  db?: boolean;
  path?: string;
}

/**
 * Nạp .env **và chọn workspace** cho tiến trình này.
 *
 * Hai việc nằm chung một hàm là cố ý: mọi script đều gọi `loadEnv()`, nên đặt
 * việc chọn workspace ở đây thì không script nào quên được — giống cách
 * `PoliteFetcher` là chỗ duy nhất định nghĩa "lịch sự". Quên chọn workspace
 * nghĩa là ghi vào CSDL của nghề kia mà không lỗi nào báo.
 *
 *   npm run crawl -- --ws swe      (hoặc biến BJ_WORKSPACE=swe)
 *   npm run crawl                  workspace bae, đúng như trước ngày tách
 *
 * Sau khi chạy: `DATABASE_URL` mang chuỗi của workspace đã chọn, và
 * `BJ_WORKSPACE` mang tên workspace. Đặt lại `DATABASE_URL` SAU khi Prisma đã
 * được import vẫn có hiệu lực — đo 17/09/2026: Prisma chỉ đọc biến này ở truy
 * vấn đầu tiên (đổi sang host không tồn tại ngay sau `new PrismaClient()` thì
 * truy vấn báo đúng host mới).
 */
export function loadEnv(options: LoadEnvOptions = {}): WorkspaceId {
  const { db = true, path = '.env' } = options;
  readDotEnv(path);

  const plan = planWorkspace(process.argv.slice(2), process.env);
  process.env[WORKSPACE_ENV] = plan.ws;

  if (plan.databaseUrl) {
    process.env.DATABASE_URL = plan.databaseUrl;
    console.log(`WORKSPACE ${plan.ws} · ${describeDatabase(plan.databaseUrl)}\n`);
    return plan.ws;
  }

  // Không để nguyên DATABASE_URL: nó có thể đang mang chuỗi của workspace kia.
  process.env.DATABASE_URL = missingDatabaseSentinel(plan.ws);
  const names = WORKSPACES[plan.ws].dbUrlEnv.join(' hoặc ');
  if (db) {
    throw new Error(
      `Workspace "${plan.ws}" chưa có CSDL: khai ${names} trong .env ` +
        '(hoặc GitHub Secrets). Xem docs/plan-swe.md §7.2.',
    );
  }
  console.log(`WORKSPACE ${plan.ws} · không dùng CSDL (chưa khai ${names})\n`);
  return plan.ws;
}

/** Workspace mà `loadEnv()` đã chọn cho tiến trình này. */
export function currentWorkspace(): WorkspaceId {
  return planWorkspace([], process.env).ws;
}

/**
 * Đọc .env mà không cần thư viện.
 *
 * Node 20+ có `--env-file` nhưng nó không chạy khi script được gọi qua tsx từ
 * npm script, nên tự đọc cho chắc. Đủ dùng: file .env của dự án chỉ có
 * KEY=VALUE, không có cú pháp phức tạp.
 */
function readDotEnv(path: string): void {
  let content: string;
  try {
    content = readFileSync(resolve(process.cwd(), path), 'utf8');
  } catch {
    return; // không có .env cũng không sao, biến môi trường có thể đến từ CI
  }

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Biến đã có sẵn (từ CI) thắng .env — nếu không thì không ghi đè được lúc chạy thật.
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export interface Args {
  boolean(name: string): boolean;
  string(name: string): string | undefined;
  number(name: string): number | null;
}

/** Đọc cờ dòng lệnh dạng `--key value` và `--flag`. */
export function parseArgs(argv: string[]): Args {
  const map = new Map<string, string | true>();

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token?.startsWith('--')) continue;

    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      map.set(key, next);
      i += 1;
    } else {
      map.set(key, true);
    }
  }

  return {
    boolean: (name) => map.get(name) !== undefined,
    string: (name) => {
      const value = map.get(name);
      return typeof value === 'string' ? value : undefined;
    },
    number: (name) => {
      const value = map.get(name);
      if (typeof value !== 'string') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    },
  };
}
