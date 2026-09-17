import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FsBlobStore, NullBlobStore, PrefixedBlobStore, createBlobStore } from '@/crawler/storage/blob';
import {
  databaseIdentity,
  describeDatabase,
  missingDatabaseSentinel,
  planWorkspace,
  readWorkspaceId,
  withoutWorkspaceFlag,
} from '@/lib/workspace';

/**
 * Chọn workspace cho script. Mỗi ca ở đây là một cách ghi nhầm CSDL — thứ
 * không để lại lỗi nào, chỉ để lại tin của nghề này nằm trong kho của nghề kia.
 */

const BAE_URL = 'postgresql://u:p@ep-old-123-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const SWE_URL = 'postgresql://u:p@ep-new-456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

describe('readWorkspaceId', () => {
  it('mặc định là bae — lệnh cũ chạy y như trước ngày tách', () => {
    expect(readWorkspaceId(['--source', 'vnw'], {})).toBe('bae');
  });

  it('đọc --ws và BJ_WORKSPACE', () => {
    expect(readWorkspaceId(['--ws', 'swe'], {})).toBe('swe');
    expect(readWorkspaceId([], { BJ_WORKSPACE: 'swe' })).toBe('swe');
    expect(readWorkspaceId(['--ws', 'swe'], { BJ_WORKSPACE: 'swe' })).toBe('swe');
  });

  it('hai chỗ khai khác nhau thì dừng, không tự chọn một', () => {
    expect(() => readWorkspaceId(['--ws', 'swe'], { BJ_WORKSPACE: 'bae' })).toThrow(/mâu thuẫn/);
  });

  it('không nhận workspace lạ hay cờ thiếu giá trị', () => {
    expect(() => readWorkspaceId(['--ws', 'toi'], {})).toThrow(/Không có workspace "toi"/);
    expect(() => readWorkspaceId(['--ws'], {})).toThrow(/cần một giá trị/);
    expect(() => readWorkspaceId(['--ws', '--dry'], {})).toThrow(/cần một giá trị/);
  });

  it('KHÔNG đọc biến WORKSPACE trơn — Jenkins đặt nó thành đường dẫn thư mục', () => {
    expect(readWorkspaceId([], { WORKSPACE: '/var/jenkins/job' })).toBe('bae');
  });
});

describe('planWorkspace', () => {
  it('bae đọc DATABASE_URL cũ khi chưa có DATABASE_URL_BAE', () => {
    const plan = planWorkspace([], { DATABASE_URL: BAE_URL });
    expect(plan).toEqual({ ws: 'bae', databaseUrl: BAE_URL, databaseUrlFrom: 'DATABASE_URL' });
  });

  it('DATABASE_URL_BAE thắng DATABASE_URL', () => {
    const plan = planWorkspace([], { DATABASE_URL_BAE: BAE_URL, DATABASE_URL: 'postgresql://khac/x' });
    expect(plan.databaseUrlFrom).toBe('DATABASE_URL_BAE');
  });

  it('swe KHÔNG rơi về DATABASE_URL — thiếu biến thì báo là thiếu', () => {
    const plan = planWorkspace(['--ws', 'swe'], { DATABASE_URL: BAE_URL });
    expect(plan.ws).toBe('swe');
    expect(plan.databaseUrl).toBeNull();
  });

  it('swe dùng DATABASE_URL_SWE', () => {
    const plan = planWorkspace(['--ws', 'swe'], { DATABASE_URL: BAE_URL, DATABASE_URL_SWE: SWE_URL });
    expect(plan.databaseUrl).toBe(SWE_URL);
  });

  it('chặn hai workspace trỏ cùng một CSDL — kể cả khi một bên pooled, một bên direct', () => {
    const direct = BAE_URL.replace('-pooler', '');
    expect(() =>
      planWorkspace(['--ws', 'swe'], { DATABASE_URL: BAE_URL, DATABASE_URL_SWE: direct }),
    ).toThrow(/CÙNG một CSDL/);
    // Chặn cả khi đang chạy workspace bae: cấu hình sai là sai, dù lệnh này
    // chưa đụng tới workspace kia.
    expect(() => planWorkspace([], { DATABASE_URL: BAE_URL, DATABASE_URL_SWE: BAE_URL })).toThrow(
      /CÙNG một CSDL/,
    );
  });

  it('cùng host nhưng khác tên CSDL là hai CSDL khác nhau', () => {
    const other = BAE_URL.replace('/neondb', '/swedb');
    expect(() =>
      planWorkspace(['--ws', 'swe'], { DATABASE_URL: BAE_URL, DATABASE_URL_SWE: other }),
    ).not.toThrow();
  });
});

describe('hiển thị chuỗi kết nối', () => {
  it('không bao giờ in mật khẩu', () => {
    const shown = describeDatabase('postgresql://user:matkhau-bi-mat@ep-x-pooler.neon.tech/neondb');
    expect(shown).toBe('ep-x-pooler.neon.tech/neondb');
    expect(shown).not.toContain('matkhau');
  });

  it('danh tính bỏ -pooler và mặc định cổng 5432', () => {
    expect(databaseIdentity('postgresql://a:b@ep-x-pooler.neon.tech/db')).toBe(
      databaseIdentity('postgresql://a:b@ep-x.neon.tech:5432/db'),
    );
  });

  it('chuỗi hỏng cố ý nêu tên biến còn thiếu và là một URL hợp lệ', () => {
    const sentinel = missingDatabaseSentinel('swe');
    expect(sentinel).toContain('database-url-swe-chua-khai.invalid');
    expect(() => new URL(sentinel)).not.toThrow();
  });
});

describe('withoutWorkspaceFlag', () => {
  it('bỏ cờ --ws và giá trị, giữ nguyên phần còn lại cho Prisma', () => {
    expect(withoutWorkspaceFlag(['db', 'push', '--ws', 'swe', '--accept-data-loss'])).toEqual([
      'db',
      'push',
      '--accept-data-loss',
    ]);
    expect(withoutWorkspaceFlag(['studio'])).toEqual(['studio']);
  });
});

describe('tiền tố blob', () => {
  it('ghi có tiền tố, trả khoá ĐẦY ĐỦ, đọc lại bằng đúng khoá đó', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bj-blob-'));
    try {
      const store = new PrefixedBlobStore(new FsBlobStore(dir), 'swe/');
      const key = await store.put('vnw/2026-09/1.json.gz', { hello: 'swe' });
      expect(key).toBe('swe/vnw/2026-09/1.json.gz');
      expect(await store.get(key)).toEqual({ hello: 'swe' });
      // Kho không tiền tố vẫn đọc được — con trỏ trong CSDL tự đủ nghĩa.
      expect(await new FsBlobStore(dir).get(key)).toEqual({ hello: 'swe' });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('kho rỗng vẫn trả chuỗi rỗng, không thành con trỏ chết "swe/"', async () => {
    const store = new PrefixedBlobStore(new NullBlobStore(), 'swe/');
    expect(await store.put('vnw/2026-09/1.json.gz', {})).toBe('');
  });

  it('workspace bae không bọc gì — khoá cũ giữ nguyên', () => {
    expect(createBlobStore('null', '')).toBeInstanceOf(NullBlobStore);
    expect(createBlobStore('null', 'swe/')).toBeInstanceOf(PrefixedBlobStore);
  });
});
