import { gzipSync, gunzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { WORKSPACES } from '@/constants/workspace';
import { readWorkspaceId } from '@/lib/workspace';

/**
 * Kho blob thô — HTML/JSON gốc của mỗi tin.
 *
 * **Vì sao không để trong Postgres:** đo thật, một trang chi tiết TopDev nặng
 * **828 KB**, còn Neon gói Free chỉ có **0,5 GB/project**. 10.000 tin × 800 KB
 * = 8 GB, gấp 16 lần hạn mức. Nhét HTML thô vào DB là chết trong tháng đầu.
 * TECHSTACK.md §5.
 *
 * **Vì sao vẫn phải giữ:** đây là thứ cho phép `npm run reparse` — sửa parser
 * rồi tính lại toàn bộ lịch sử trong vài giây mà không cào lại nguồn. Với 6
 * nguồn, mỗi lần sửa cách chuẩn hoá lương là ảnh hưởng cả 6; không có kho này
 * thì mỗi lần sửa là một đợt cào lại hàng nghìn trang.
 *
 * Nén gzip trước khi ghi: HTML nén được ~85%, nên 10k tin ≈ 600 MB, vừa gọn
 * trong 10 GB miễn phí của Cloudflare R2 (egress cũng miễn phí).
 */

export interface BlobStore {
  /** @returns khoá để lưu vào JobPosting.rawKey */
  put(key: string, payload: unknown): Promise<string>;
  get(key: string): Promise<unknown | null>;
  readonly driver: string;
}

/** Khoá có cấu trúc để xoá theo lô được: xoá cả tháng cũ bằng một prefix. */
export function buildBlobKey(sourceCode: string, externalId: string, when = new Date()): string {
  const yyyyMM = `${when.getUTCFullYear()}-${String(when.getUTCMonth() + 1).padStart(2, '0')}`;
  const safeId = externalId.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100);
  return `${sourceCode}/${yyyyMM}/${safeId}.json.gz`;
}

function encode(payload: unknown): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));
}

function decode(buffer: Buffer): unknown {
  return JSON.parse(gunzipSync(buffer).toString('utf8'));
}

/**
 * Ghi ra đĩa. Mặc định khi phát triển — không cần tài khoản, không cần mạng.
 * Đổi sang R2 chỉ là đổi BLOB_DRIVER, không đụng vào adapter nào.
 */
export class FsBlobStore implements BlobStore {
  readonly driver = 'fs';
  private readonly root: string;

  constructor(dir = process.env.BLOB_FS_DIR || '.blobs') {
    this.root = resolve(process.cwd(), dir);
  }

  async put(key: string, payload: unknown): Promise<string> {
    const path = join(this.root, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, encode(payload));
    return key;
  }

  async get(key: string): Promise<unknown | null> {
    try {
      return decode(await readFile(join(this.root, key)));
    } catch {
      return null;
    }
  }
}

/**
 * Cloudflare R2 qua API tương thích S3.
 *
 * `@aws-sdk/client-s3` được nạp ĐỘNG và nằm trong optionalDependencies: ai chỉ
 * chạy local với driver fs thì không phải tải về ~15 MB phụ thuộc mình không dùng.
 */
export class R2BlobStore implements BlobStore {
  readonly driver = 'r2';
  private client: unknown = null;
  private readonly bucket: string;

  constructor() {
    const bucket = process.env.R2_BUCKET;
    if (!bucket) throw new Error('BLOB_DRIVER="r2" nhưng thiếu R2_BUCKET — xem .env.example');
    this.bucket = bucket;
  }

  private async getClient(): Promise<{
    send: (command: unknown) => Promise<unknown>;
    PutObjectCommand: new (input: unknown) => unknown;
    GetObjectCommand: new (input: unknown) => unknown;
  }> {
    if (this.client) return this.client as never;

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('Thiếu R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY');
    }

    const s3 = await import('@aws-sdk/client-s3').catch(() => {
      throw new Error(
        'Chưa cài @aws-sdk/client-s3. Chạy: npm install @aws-sdk/client-s3 ' +
          '(hoặc để BLOB_DRIVER="fs" khi phát triển)',
      );
    });

    const client = new s3.S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    this.client = {
      send: (command: unknown) => client.send(command as never),
      PutObjectCommand: s3.PutObjectCommand,
      GetObjectCommand: s3.GetObjectCommand,
    };
    return this.client as never;
  }

  async put(key: string, payload: unknown): Promise<string> {
    const { send, PutObjectCommand } = await this.getClient();
    await send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: encode(payload),
        ContentType: 'application/json',
        ContentEncoding: 'gzip',
      }),
    );
    return key;
  }

  async get(key: string): Promise<unknown | null> {
    const { send, GetObjectCommand } = await this.getClient();
    try {
      const res = (await send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      )) as { Body?: { transformToByteArray(): Promise<Uint8Array> } };
      if (!res.Body) return null;
      return decode(Buffer.from(await res.Body.transformToByteArray()));
    } catch {
      return null;
    }
  }
}

/** Kho rỗng — dùng khi cố ý không muốn lưu gì (ví dụ chạy thử khô). */
export class NullBlobStore implements BlobStore {
  readonly driver = 'null';
  async put(): Promise<string> {
    return '';
  }
  async get(): Promise<null> {
    return null;
  }
}

/**
 * Thêm tiền tố workspace vào khoá khi GHI; khi ĐỌC thì dùng nguyên khoá.
 *
 * Bất đối xứng là cố ý: `put()` trả về khoá ĐẦY ĐỦ (`swe/vnw/2026-09/1.json.gz`)
 * và `rawKey` lưu nguyên khoá đó, nên con trỏ trong CSDL tự nói đúng chỗ file
 * nằm — `reparse` đọc lại mà không cần biết workspace nào đã ghi.
 *
 * Không có tiền tố thì cùng một tin ITviec cào ở hai workspace sẽ ghi đè lên
 * cùng một file: một sợi dây ngầm nối hai CSDL đáng lẽ tách hẳn.
 */
export class PrefixedBlobStore implements BlobStore {
  constructor(
    private readonly inner: BlobStore,
    private readonly prefix: string,
  ) {}

  get driver(): string {
    return this.inner.driver;
  }

  put(key: string, payload: unknown): Promise<string> {
    // Trả đúng thứ kho bên trong trả: kho rỗng trả '' và phải giữ nguyên là '',
    // không được thành 'swe/' — đó sẽ là một con trỏ chết.
    return this.inner.put(`${this.prefix}${key}`, payload);
  }

  get(key: string): Promise<unknown | null> {
    return this.inner.get(key);
  }
}

/** Tiền tố blob của workspace mà script này đang chạy (xem scripts/_env.ts). */
function processBlobPrefix(): string {
  return WORKSPACES[readWorkspaceId([], process.env)].blobPrefix;
}

export function createBlobStore(
  driver = process.env.BLOB_DRIVER || 'fs',
  prefix = processBlobPrefix(),
): BlobStore {
  const inner = openBlobStore(driver);
  return prefix ? new PrefixedBlobStore(inner, prefix) : inner;
}

function openBlobStore(driver: string): BlobStore {
  switch (driver) {
    case 'r2':
      return new R2BlobStore();
    case 'null':
      return new NullBlobStore();
    case 'fs':
    default:
      return new FsBlobStore();
  }
}
