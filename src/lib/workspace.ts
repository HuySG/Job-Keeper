import {
  DEFAULT_WORKSPACE,
  WORKSPACES,
  WORKSPACE_ENV,
  WORKSPACE_IDS,
  isWorkspaceId,
  type WorkspaceId,
} from '@/constants/workspace';

/**
 * Chọn workspace cho MỘT TIẾN TRÌNH script — hàm thuần, không đụng
 * `process`, để test được mọi ca mà không cần CSDL.
 *
 * ⚠️ Chỉ dành cho script. Web phục vụ cả hai workspace trong cùng một tiến
 *    trình, nên ở đó workspace đến từ đường dẫn (`/bae/...`, `/swe/...`), không
 *    bao giờ từ biến môi trường.
 */

type Env = Readonly<Record<string, string | undefined>>;

export interface WorkspacePlan {
  ws: WorkspaceId;
  /** Chuỗi kết nối sẽ được đặt vào `DATABASE_URL`, hoặc null nếu chưa khai. */
  databaseUrl: string | null;
  /** Tên biến đã cung cấp chuỗi kết nối — để thông báo nói đúng chỗ phải sửa. */
  databaseUrlFrom: string | null;
}

/**
 * Đọc workspace từ `--ws <id>` hoặc biến `BJ_WORKSPACE`.
 *
 * Hai chỗ cùng khai mà khác nhau thì ném lỗi thay vì chọn một: đó là dấu hiệu
 * người gõ lệnh và người đặt biến đang nghĩ về hai CSDL khác nhau.
 */
export function readWorkspaceId(argv: readonly string[], env: Env): WorkspaceId {
  const index = argv.indexOf('--ws');
  const fromArg = index >= 0 ? argv[index + 1] : undefined;
  if (index >= 0 && (!fromArg || fromArg.startsWith('--'))) {
    throw new Error(`Cờ --ws cần một giá trị: ${WORKSPACE_IDS.join(' | ')}`);
  }

  const fromEnv = env[WORKSPACE_ENV] || undefined;
  if (fromArg && fromEnv && fromArg !== fromEnv) {
    throw new Error(
      `--ws ${fromArg} mâu thuẫn với ${WORKSPACE_ENV}=${fromEnv}. Bỏ một trong hai.`,
    );
  }

  const raw = fromArg ?? fromEnv ?? DEFAULT_WORKSPACE;
  if (!isWorkspaceId(raw)) {
    throw new Error(`Không có workspace "${raw}". Chọn một trong: ${WORKSPACE_IDS.join(', ')}`);
  }
  return raw;
}

/**
 * Bỏ cờ `--ws <id>` khỏi danh sách tham số, trước khi chuyển tiếp cho một
 * chương trình khác (Prisma CLI) vốn không biết cờ này và sẽ báo lỗi.
 */
export function withoutWorkspaceFlag(argv: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--ws') {
      i += 1; // bỏ luôn giá trị đi kèm
      continue;
    }
    out.push(argv[i]!);
  }
  return out;
}

/** Chuỗi kết nối của một workspace — biến đầu tiên có giá trị thắng. */
export function resolveDatabaseUrl(
  ws: WorkspaceId,
  env: Env,
): { url: string; from: string } | null {
  for (const name of WORKSPACES[ws].dbUrlEnv) {
    const url = env[name]?.trim();
    if (url) return { url, from: name };
  }
  return null;
}

/**
 * Danh tính của một CSDL, để so hai chuỗi kết nối có trỏ cùng chỗ không.
 *
 * Bỏ `-pooler` khỏi host: Neon cho mỗi endpoint hai tên — pooled và direct —
 * cùng dẫn tới MỘT CSDL. So thẳng hai chuỗi thì một bên pooled một bên direct
 * sẽ lọt qua chốt chặn dù ghi vào đúng cùng một chỗ.
 */
export function databaseIdentity(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace('-pooler.', '.');
    return `${host}:${parsed.port || '5432'}${parsed.pathname}`;
  } catch {
    return url.trim();
  }
}

/** Host và tên CSDL để in ra màn hình — KHÔNG kèm tài khoản, mật khẩu. */
export function describeDatabase(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return '(chuỗi kết nối không đọc được)';
  }
}

/**
 * Quyết định toàn bộ: workspace nào, CSDL nào — và chặn ca hai workspace trỏ
 * cùng một CSDL. Ca đó không bao giờ là cố ý, và hậu quả là tin của hai nghề
 * trộn lẫn trong một kho mà không lỗi nào báo.
 */
export function planWorkspace(argv: readonly string[], env: Env): WorkspacePlan {
  const ws = readWorkspaceId(argv, env);
  const resolved = assertDistinctDatabases(env);
  const own = resolved[ws];
  return { ws, databaseUrl: own?.url ?? null, databaseUrlFrom: own?.from ?? null };
}

/**
 * Chuỗi kết nối của MỌI workspace, sau khi chắc chắn không hai workspace nào
 * trỏ cùng một CSDL. Dùng cho cả script (`planWorkspace`) lẫn web (`getDb`).
 */
export function assertDistinctDatabases(
  env: Env,
): Record<WorkspaceId, ReturnType<typeof resolveDatabaseUrl>> {
  const resolved = Object.fromEntries(
    WORKSPACE_IDS.map((id) => [id, resolveDatabaseUrl(id, env)]),
  ) as Record<WorkspaceId, ReturnType<typeof resolveDatabaseUrl>>;

  const seen = new Map<string, WorkspaceId>();
  for (const id of WORKSPACE_IDS) {
    const entry = resolved[id];
    if (!entry) continue;
    const identity = databaseIdentity(entry.url);
    const other = seen.get(identity);
    if (other) {
      throw new Error(
        `Workspace "${other}" và "${id}" đang trỏ CÙNG một CSDL ` +
          `(${describeDatabase(entry.url)}). Mỗi workspace phải có CSDL riêng — ` +
          'xem docs/plan-swe.md §7.',
      );
    }
    seen.set(identity, id);
  }
  return resolved;
}

/**
 * Chuỗi kết nối cố ý HỎNG, đặt vào `DATABASE_URL` khi workspace chưa khai CSDL.
 *
 * Không được để nguyên `DATABASE_URL` cũ: Prisma đã tự nạp `.env` từ lúc
 * import, nên biến đó đang mang chuỗi của Bae — script của workspace swe sẽ
 * lặng lẽ ghi vào CSDL thu mua. Tên host là lời nhắn: nếu có truy vấn nào lọt
 * tới, lỗi của Prisma sẽ in đúng tên biến còn thiếu.
 */
export function missingDatabaseSentinel(ws: WorkspaceId): string {
  const name = WORKSPACES[ws].dbUrlEnv[0]!.toLowerCase().replace(/_/g, '-');
  return `postgresql://chua-khai:chua-khai@${name}-chua-khai.invalid:5432/khong-co`;
}
