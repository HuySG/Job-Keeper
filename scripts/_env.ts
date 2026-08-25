import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Nạp .env mà không cần thư viện.
 *
 * Node 20+ có `--env-file` nhưng nó không chạy khi script được gọi qua tsx từ
 * npm script, nên tự đọc cho chắc. Đủ dùng: file .env của dự án chỉ có
 * KEY=VALUE, không có cú pháp phức tạp.
 */
export function loadEnv(path = '.env'): void {
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
