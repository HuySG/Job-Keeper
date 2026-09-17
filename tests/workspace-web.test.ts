import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { NAV_ACTIONS, isActivePath } from '@/constants/nav';
import {
  classifyPath,
  pathWithinWorkspace,
  workspaceFromPath,
  workspaceOr,
  wsHref,
} from '@/lib/workspace-path';

/**
 * Phần web phục vụ HAI workspace trong một tiến trình (docs/plan-swe.md §8).
 * Hai kiểu hỏng không có lỗi nào báo: đọc nhầm CSDL, và liên kết trỏ sang
 * workspace kia. Các test dưới đây chặn cả hai.
 */

const ROOT = resolve(__dirname, '..');

function* sourceFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sourceFiles(path);
    else if (/\.(ts|tsx)$/.test(name)) yield path;
  }
}

describe('cô lập CSDL — phần web không bao giờ dùng `db` của script', () => {
  // `api/db.ts` đọc DATABASE_URL mà SCRIPT đã chọn lúc khởi động. Web dùng nó
  // là mọi trang của workspace swe lặng lẽ hiện dữ liệu của bae.
  const WEB_DIRS = ['src/app', 'src/api', 'src/actions', 'src/components', 'src/lib'];

  it.each(WEB_DIRS)('%s không import @/api/db', (dir) => {
    const offenders: string[] = [];
    for (const file of sourceFiles(join(ROOT, dir))) {
      const text = readFileSync(file, 'utf8');
      if (/from ['"]@\/api\/db['"]/.test(text)) offenders.push(relative(ROOT, file));
    }
    expect(offenders).toEqual([]);
  });

  it('không file nào trong src/app viết cứng đường dẫn trang của workspace', () => {
    const offenders: string[] = [];
    const pattern = /href=["'`{]+\/(viec|nganh|luong|nguon|da-luu|cai-dat)\b/;
    for (const file of sourceFiles(join(ROOT, 'src'))) {
      if (pattern.test(readFileSync(file, 'utf8'))) offenders.push(relative(ROOT, file));
    }
    expect(offenders).toEqual([]);
  });
});

describe('wsHref', () => {
  it('ghép tiền tố workspace', () => {
    expect(wsHref('swe', '/nganh')).toBe('/swe/nganh');
    expect(wsHref('bae', '/viec/12?tu=nganh')).toBe('/bae/viec/12?tu=nganh');
    expect(wsHref('bae', 'luong')).toBe('/bae/luong');
  });

  it('trang đầu của workspace không có dấu / thừa', () => {
    expect(wsHref('bae', '/')).toBe('/bae');
    expect(wsHref('swe', '')).toBe('/swe');
  });
});

describe('đọc workspace từ đường dẫn', () => {
  it.each([
    ['/bae', 'bae', '/'],
    ['/swe/nganh', 'swe', '/nganh'],
    ['/bae/viec/123', 'bae', '/viec/123'],
    ['/thanh-phan', null, '/'],
    ['/abc/nganh', null, '/'],
    ['/', null, '/'],
  ])('%s → %s · %s', (path, ws, rest) => {
    expect(workspaceFromPath(path)).toBe(ws);
    expect(pathWithinWorkspace(path)).toBe(rest);
  });

  it('giá trị cookie lạ rơi về mặc định', () => {
    expect(workspaceOr('swe')).toBe('swe');
    expect(workspaceOr('toi')).toBe('bae');
    expect(workspaceOr(undefined)).toBe('bae');
  });
});

describe('mục đang mở trên thanh điều hướng', () => {
  it('trang đầu workspace chỉ khớp đúng chính nó', () => {
    expect(isActivePath('/bae', '/bae', true)).toBe(true);
    expect(isActivePath('/bae', '/bae/nganh', true)).toBe(false);
  });

  it('mục thường khớp cả trang con', () => {
    expect(isActivePath('/swe/viec', '/swe/viec/12')).toBe(true);
    expect(isActivePath('/swe/viec', '/bae/viec/12')).toBe(false);
  });

  it('Bộ thành phần dùng chung, còn Tin đã lưu / Cài đặt nằm trong workspace', () => {
    expect(NAV_ACTIONS.components.scoped).toBe(false);
    expect(NAV_ACTIONS.saved.scoped).toBe(true);
    expect(NAV_ACTIONS.settings.scoped).toBe(true);
  });
});

describe('classifyPath — middleware làm gì với từng đường dẫn', () => {
  it.each([
    ['/', 'root'],
    ['/bae', 'workspace'],
    ['/swe/viec/12', 'workspace'],
    ['/thanh-phan', 'shared'],
    // Đoạn đầu lạ → 404 "không khớp", thứ Next 15.5 dựng đủ trong HTML.
    ['/abc/nganh', 'unknown'],
    ['/khong-co-trang', 'unknown'],
    ['/nganh', 'unknown'],
  ])('%s → %s', (path, kind) => {
    expect(classifyPath(path).kind).toBe(kind);
  });
});
