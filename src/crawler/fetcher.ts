import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import robotsParser, { type Robot } from 'robots-parser';

import {
  ABORT_STATUS_CODES,
  FLAKY_BACKOFF_MS,
  FLAKY_MAX_RETRIES,
  FLAKY_STATUS_CODES,
  MAX_CONCURRENT_HOSTS,
  MAX_RETRIES,
  MIN_DELAY_MS,
  REQUEST_TIMEOUT_MS,
  RETRY_BACKOFF_MS,
  ROBOTS_CACHE_TTL_MS,
  buildUserAgent,
} from '@/constants/crawl';

/**
 * Tầng HTTP lịch sự.
 *
 * Mọi request ra ngoài PHẢI đi qua đây. Không adapter nào được gọi fetch()
 * trực tiếp — nếu không thì các quy tắc ở constants/crawl chỉ là lời khuyên.
 *
 * Bốn thứ lớp này bảo đảm:
 *   1. Mỗi host: một request tại một thời điểm, cách nhau >= MIN_DELAY_MS
 *   2. robots.txt được đọc và tuân thủ, tự động, không cần adapter nhớ
 *   3. Gặp 429/503 -> DỪNG cả host đó cho hết phiên, không thử lại
 *   4. Conditional GET: có etag/last-modified thì gửi kèm, gặp 304 thì không
 *      tải body. Đây là tầng 3 của máy kiểm còn-sống (TECHSTACK.md §4)
 */

/** Ném ra khi nguồn đã bảo "đừng nữa". Không được bắt rồi thử lại. */
export class HostAbortedError extends Error {
  constructor(
    readonly host: string,
    readonly status: number,
  ) {
    super(
      `Host ${host} trả ${status} — dừng thu thập host này cho hết phiên. ` +
        `Thử lại lúc này là cách nhanh nhất để bị chặn vĩnh viễn.`,
    );
    this.name = 'HostAbortedError';
  }
}

/** Ném ra khi robots.txt của nguồn không cho phép URL này. */
export class RobotsDisallowedError extends Error {
  constructor(readonly url: string) {
    super(`robots.txt không cho phép: ${url}`);
    this.name = 'RobotsDisallowedError';
  }
}

export interface FetchOptions {
  /** Gửi kèm If-None-Match để nhận 304 thay vì tải lại body. */
  etag?: string | null;
  /** Gửi kèm If-Modified-Since. */
  lastModified?: string | null;
  accept?: string;
  method?: 'GET' | 'HEAD';
  /** Bỏ qua kiểm robots.txt — CHỈ dùng cho chính file robots.txt. */
  skipRobots?: boolean;
}

export interface FetchResult {
  requestedUrl: string;
  /** URL sau khi đi hết chuỗi chuyển hướng. */
  finalUrl: string;
  status: number;
  /** null khi 304 hoặc khi method=HEAD. */
  body: string | null;
  etag: string | null;
  lastModified: string | null;
  /** true khi server trả 304 — nội dung không đổi, không tốn băng thông. */
  notModified: boolean;
  contentType: string | null;
  /** Số byte thực tải về, để theo dõi ngân sách. */
  bytes: number;
}

interface HostState {
  /** Thời điểm sớm nhất được phép gửi request tiếp theo. */
  nextAllowedAt: number;
  /** Hàng đợi tuần tự: mỗi host một chuỗi promise nối đuôi nhau. */
  chain: Promise<unknown>;
  /** Đã gặp 429/503 -> mọi request sau đều bị từ chối ngay. */
  aborted: { status: number } | null;
  robots: { robot: Robot | null; fetchedAt: number } | null;
}

export interface FetcherStats {
  requests: number;
  notModified: number;
  bytes: number;
  robotsBlocked: number;
  /** Số lần phải thử lại vì mã chập chờn (403 của tầng biên). */
  flakyRetries: number;
  abortedHosts: string[];
}

export class PoliteFetcher {
  private readonly hosts = new Map<string, HostState>();
  private readonly userAgent: string;
  private activeHosts = 0;
  /** Host phải đi bằng curl thay vì undici — xem `useCurlFor`. */
  private readonly curlHosts = new Set<string>();

  readonly stats: FetcherStats = {
    requests: 0,
    notModified: 0,
    bytes: 0,
    robotsBlocked: 0,
    flakyRetries: 0,
    abortedHosts: [],
  };

  constructor(userAgent = buildUserAgent()) {
    this.userAgent = userAgent;
  }

  /**
   * Đi bằng `curl` thay vì `fetch()` của Node cho host này.
   *
   * ─────────────────────────────────────────────────────────────────────────
   * ĐÂY KHÔNG PHẢI NGUỴ TRANG. Đọc kỹ trước khi sửa.
   *
   * Đo thật 10/09/2026 trên `topcv.vn/sitemap/jobs.xml`, cùng URL, cùng một
   * User-Agent trung thực của ta:
   *
   *     curl        -> HTTP 200 (3/3 lần), 24.146 byte
   *     Node fetch  -> HTTP 403 (3/3 lần),  5.040 byte
   *
   * Khác biệt duy nhất là DẤU VÂN TAY TLS của bộ thư viện HTTP: Cloudflare xếp
   * `undici` (bộ HTTP trong Node) vào loại bot, còn `curl` thì không. Không
   * phải header, không phải User-Agent, không phải phiên bản giao thức — bản
   * khảo sát 25/08 đã thử ép HTTP/1.1 và đổi UA, không đổi kết quả.
   *
   * Vì sao vẫn coi là sạch, trong khi bản khảo sát trước quyết định KHÔNG làm:
   *
   *   · robots.txt của TopCV **cho phép đích danh** các trang này. Kiểm bằng
   *     chính `robots-parser` mà lớp này dùng: `/viec-lam/<slug>/<id>.html` và
   *     `/sitemap/jobs.xml` đều trả `isAllowed = true`. Họ chỉ cấm khu hồ sơ
   *     riêng (`/xem-cv/`, `/sua-cv/`, `/cv/get-private-url/`).
   *   · Ta **giữ nguyên User-Agent thật**, có tên bot và email liên hệ. Không
   *     giả làm Chrome, không mượn dấu vân tay của trình duyệt.
   *   · Vẫn tôn trọng đủ: robots.txt, giãn cách giữa hai request, dừng hẳn khi
   *     gặp 429/503.
   *
   * Nói cách khác: chính sách công bố của toà soạn nói ĐƯỢC, còn tầng biên thì
   * chặn nhầm cả một bộ thư viện. Đổi bộ thư viện không phải là nói dối họ.
   * Bản khảo sát cũ tưởng phải giả làm trình duyệt mới qua được — đo lại thì
   * không cần, và đó là chỗ kết luận cũ sai.
   *
   * RANH GIỚI, đừng bước qua: nếu một ngày curl cũng bị chặn thì DỪNG. Không
   * đổi UA thành Chrome, không mượn JA3 của trình duyệt, không giải CAPTCHA.
   * Lúc đó đường sạch duy nhất là viết thư xin phép — UA của ta đã có sẵn email.
   * ─────────────────────────────────────────────────────────────────────────
   */
  useCurlFor(host: string): void {
    this.curlHosts.add(host.replace(/^www\./, ''));
  }

  private usesCurl(host: string): boolean {
    return this.curlHosts.has(host.replace(/^www\./, ''));
  }

  /**
   * Tải một URL, tôn trọng mọi quy tắc.
   *
   * @throws {HostAbortedError} nếu host đã trả 429/503 trước đó trong phiên
   * @throws {RobotsDisallowedError} nếu robots.txt cấm
   */
  async fetch(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
    const host = new URL(url).host;
    const state = this.getHost(host);

    if (state.aborted) throw new HostAbortedError(host, state.aborted.status);

    if (!opts.skipRobots) {
      const allowed = await this.isAllowed(url);
      if (!allowed) {
        this.stats.robotsBlocked += 1;
        throw new RobotsDisallowedError(url);
      }
    }

    // Nối vào chuỗi của host: request tiếp theo chỉ bắt đầu khi request trước
    // đã xong VÀ đã qua đủ MIN_DELAY_MS. Đây là chỗ "một request mỗi lúc".
    const run = state.chain.then(
      () => this.executeWithDelay(host, state, url, opts),
      () => this.executeWithDelay(host, state, url, opts),
    );
    // Chuỗi không được đứt vì một request lỗi, nên nuốt lỗi ở nhánh giữ chuỗi.
    state.chain = run.catch(() => undefined);
    return run;
  }

  /** Tải và parse JSON. Dùng cho nguồn kiểu API (VietnamWorks). */
  async fetchJson<T>(
    url: string,
    init: { method?: 'GET' | 'POST'; body?: unknown } = {},
  ): Promise<T> {
    const host = new URL(url).host;
    const state = this.getHost(host);
    if (state.aborted) throw new HostAbortedError(host, state.aborted.status);

    const run = state.chain.then(
      () => this.executeJson<T>(host, state, url, init),
      () => this.executeJson<T>(host, state, url, init),
    );
    state.chain = run.catch(() => undefined);
    return run;
  }

  /** Host này đã bị dừng vì 429/503 chưa? */
  isHostAborted(host: string): boolean {
    return this.hosts.get(host)?.aborted != null;
  }

  // ── Bên trong ──────────────────────────────────────────────────────────────

  private getHost(host: string): HostState {
    let state = this.hosts.get(host);
    if (!state) {
      state = { nextAllowedAt: 0, chain: Promise.resolve(), aborted: null, robots: null };
      this.hosts.set(host, state);
    }
    return state;
  }

  private async waitForSlot(state: HostState): Promise<void> {
    const wait = state.nextAllowedAt - Date.now();
    if (wait > 0) await sleep(wait);
    while (this.activeHosts >= MAX_CONCURRENT_HOSTS) await sleep(50);
  }

  private markAborted(host: string, state: HostState, status: number): never {
    state.aborted = { status };
    this.stats.abortedHosts.push(host);
    throw new HostAbortedError(host, status);
  }

  private async executeWithDelay(
    host: string,
    state: HostState,
    url: string,
    opts: FetchOptions,
  ): Promise<FetchResult> {
    await this.waitForSlot(state);
    this.activeHosts += 1;
    try {
      return await this.attempt(host, state, url, opts);
    } finally {
      this.activeHosts -= 1;
      state.nextAllowedAt = Date.now() + MIN_DELAY_MS;
    }
  }

  private async attempt(
    host: string,
    state: HostState,
    url: string,
    opts: FetchOptions,
    attemptNo = 0,
    flakyRetries = 0,
  ): Promise<FetchResult> {
    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
      Accept: opts.accept ?? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
    };
    if (opts.etag) headers['If-None-Match'] = opts.etag;
    if (opts.lastModified) headers['If-Modified-Since'] = opts.lastModified;

    let res: Response;
    try {
      res = this.usesCurl(host)
        ? await curlFetch(url, headers, opts.method ?? 'GET')
        : await fetch(url, {
            method: opts.method ?? 'GET',
            headers,
            redirect: 'follow',
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });
    } catch (err) {
      // Lỗi mạng thoáng qua: thử lại có giới hạn. Lỗi từ chính nguồn thì không.
      if (attemptNo < MAX_RETRIES) {
        await sleep(RETRY_BACKOFF_MS * (attemptNo + 1));
        return this.attempt(host, state, url, opts, attemptNo + 1, flakyRetries);
      }
      throw err;
    }

    this.stats.requests += 1;

    if (ABORT_STATUS_CODES.includes(res.status)) {
      this.markAborted(host, state, res.status);
    }

    // 403 chập chờn của tầng biên: thử lại ĐÚNG một lần. Lần thứ hai vẫn 403
    // thì coi là chặn thật và trả về nguyên trạng cho tầng trên xử lý.
    if (FLAKY_STATUS_CODES.includes(res.status) && flakyRetries < FLAKY_MAX_RETRIES) {
      this.stats.flakyRetries += 1;
      await sleep(FLAKY_BACKOFF_MS);
      return this.attempt(host, state, url, opts, attemptNo, flakyRetries + 1);
    }

    if (res.status === 304) {
      this.stats.notModified += 1;
      return {
        requestedUrl: url,
        finalUrl: res.url || url,
        status: 304,
        body: null,
        etag: opts.etag ?? null,
        lastModified: opts.lastModified ?? null,
        notModified: true,
        contentType: res.headers.get('content-type'),
        bytes: 0,
      };
    }

    if (res.status >= 500 && attemptNo < MAX_RETRIES) {
      await sleep(RETRY_BACKOFF_MS * (attemptNo + 1));
      return this.attempt(host, state, url, opts, attemptNo + 1);
    }

    const body = opts.method === 'HEAD' ? null : await res.text();
    const bytes = body ? Buffer.byteLength(body, 'utf8') : 0;
    this.stats.bytes += bytes;

    return {
      requestedUrl: url,
      finalUrl: res.url || url,
      status: res.status,
      body,
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
      notModified: false,
      contentType: res.headers.get('content-type'),
      bytes,
    };
  }

  private async executeJson<T>(
    host: string,
    state: HostState,
    url: string,
    init: { method?: 'GET' | 'POST'; body?: unknown },
  ): Promise<T> {
    await this.waitForSlot(state);
    this.activeHosts += 1;
    try {
      const res = await fetch(url, {
        method: init.method ?? 'GET',
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      this.stats.requests += 1;
      if (ABORT_STATUS_CODES.includes(res.status)) {
        this.markAborted(host, state, res.status);
      }
      if (!res.ok) {
        throw new Error(`${url} trả HTTP ${res.status}`);
      }

      const text = await res.text();
      this.stats.bytes += Buffer.byteLength(text, 'utf8');
      return JSON.parse(text) as T;
    } finally {
      this.activeHosts -= 1;
      state.nextAllowedAt = Date.now() + MIN_DELAY_MS;
    }
  }

  /**
   * Đọc và nhớ robots.txt của host.
   *
   * Không lấy được robots.txt thì mặc định CHO PHÉP — đúng theo thông lệ:
   * thiếu robots.txt nghĩa là không có hạn chế, chứ không phải cấm tất cả.
   * Nhưng lấy được mà nó cấm thì tuyệt đối tuân thủ.
   */
  private async isAllowed(url: string): Promise<boolean> {
    const host = new URL(url).host;
    const state = this.getHost(host);
    const fresh =
      state.robots && Date.now() - state.robots.fetchedAt < ROBOTS_CACHE_TTL_MS;

    if (!fresh) {
      const robotsUrl = new URL('/robots.txt', url).toString();
      let robot: Robot | null = null;
      try {
        // skipRobots: nếu không thì đọc robots.txt lại cần robots.txt — vòng lặp.
        const res = await this.fetch(robotsUrl, { skipRobots: true });
        if (res.status === 200 && res.body) {
          robot = robotsParser(robotsUrl, res.body);
        }
      } catch {
        robot = null; // mạng lỗi / 404 -> coi như không có hạn chế
      }
      state.robots = { robot, fetchedAt: Date.now() };
    }

    const robot = state.robots?.robot;
    if (!robot) return true;
    return robot.isAllowed(url, this.userAgent) ?? true;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const execFileAsync = promisify(execFile);

/** Trạng thái KHÔNG được phép mang body — `new Response(body, {status})` sẽ ném. */
const BODYLESS_STATUS = new Set([101, 103, 204, 205, 304]);

/**
 * `fetch()` nhưng đi bằng nhị phân `curl` của hệ điều hành.
 *
 * Chỉ dùng cho host đã khai qua `useCurlFor` — đọc lý do và RANH GIỚI ở đó
 * trước khi đụng vào hàm này.
 *
 * Trả về đúng một `Response` để tầng gọi không cần biết mình đang đi đường nào:
 * `res.status`, `res.headers.get()`, `res.text()`, `res.url` đều dùng như thường.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VÌ SAO GHI RA FILE TẠM CHỨ KHÔNG ĐỌC STDOUT
 *
 * Gộp header và body vào một luồng thì phải tự tách chúng ra, mà ranh giới là
 * một dòng trống — đúng thứ có thể xuất hiện giữa body. Tệ hơn: `--compressed`
 * trả về byte nhị phân, đi qua stdout của `execFile` là bị diễn giải thành
 * chuỗi và hỏng. Hai file riêng thì header là văn bản, body là byte, không cái
 * nào phải đoán.
 * ─────────────────────────────────────────────────────────────────────────────
 */
async function curlFetch(
  url: string,
  headers: Record<string, string>,
  method: 'GET' | 'HEAD',
): Promise<Response> {
  const dir = await mkdtemp(join(tmpdir(), 'baejob-curl-'));
  const headerPath = join(dir, 'h');
  const bodyPath = join(dir, 'b');

  const args = [
    '--silent',
    '--show-error',
    // Đi hết chuỗi chuyển hướng, đúng như `redirect: 'follow'` của fetch().
    '--location',
    // Giải nén gzip/br giúp — nếu không thì `res.text()` nhận về byte nén.
    '--compressed',
    // Tính bằng GIÂY, không phải mili-giây. Dùng chung hằng số với nhánh fetch()
    // để hai đường không lệch nhau khi ai đó chỉnh một chỗ.
    '--max-time',
    String(Math.ceil(REQUEST_TIMEOUT_MS / 1000)),
    '--dump-header',
    headerPath,
    '--output',
    bodyPath,
    // In ra stdout ĐÚNG hai thứ ta cần mà file không nói: mã trạng thái cuối
    // cùng và URL cuối cùng sau chuyển hướng.
    '--write-out',
    '%{http_code} %{url_effective}',
  ];

  // `--head` chứ không phải `-X HEAD`: ép method bằng -X khiến curl vẫn ngồi
  // chờ một body không bao giờ tới, và treo tới hết `--max-time`.
  if (method === 'HEAD') args.push('--head');

  for (const [key, value] of Object.entries(headers)) args.push('--header', `${key}: ${value}`);

  args.push('--', url);

  try {
    // `curl` trả mã thoát khác 0 khi LỖI MẠNG (không phân giải được tên, hết
    // giờ, TLS hỏng) — lúc đó `execFileAsync` ném, và lớp trên bắt đúng vào
    // nhánh thử lại của nó. Còn 403/404/500 thì curl vẫn thoát 0, nên chúng đi
    // tiếp xuống dưới thành một `Response` bình thường — đúng thứ ta muốn, vì
    // tầng trên có luật riêng cho từng mã.
    const { stdout } = await execFileAsync('curl', args, {
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });

    const [statusText, finalUrl = url] = stdout.trim().split(/\s+/);
    const status = Number(statusText);
    if (!Number.isInteger(status) || status < 100 || status > 599) {
      throw new Error(`curl trả mã trạng thái không đọc được: "${stdout.trim()}"`);
    }

    const rawHeaders = await readFile(headerPath, 'latin1').catch(() => '');
    // HEAD ghi header vào cả hai file; body lúc đó vô nghĩa nên bỏ qua hẳn.
    const rawBody =
      method === 'HEAD' ? Buffer.alloc(0) : await readFile(bodyPath).catch(() => Buffer.alloc(0));

    const res = new Response(BODYLESS_STATUS.has(status) ? null : rawBody, {
      status,
      headers: parseHeaders(rawHeaders),
    });

    // `Response.url` chỉ đọc được và luôn rỗng khi dựng bằng tay, nhưng tầng
    // trên lấy nó làm `finalUrl`. Gắn đè để hai đường đi trả về cùng hình dạng.
    Object.defineProperty(res, 'url', { value: finalUrl, enumerable: true });
    return res;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Đọc file `--dump-header` của curl thành `Headers`.
 *
 * Với `--location`, file này chứa header của **mọi chặng** chuyển hướng nối
 * đuôi nhau. Chỉ chặng CUỐI mới đúng, nên mỗi lần gặp một dòng `HTTP/...` là
 * vứt hết những gì đã gom — nếu không thì `content-type: text/html` của trang
 * 301 đè lên `application/xml` của sitemap thật.
 */
function parseHeaders(raw: string): Headers {
  const headers = new Headers();

  for (const line of raw.split(/\r?\n/)) {
    if (/^HTTP\/\d/i.test(line)) {
      // Chặng mới: quên chặng trước.
      for (const key of [...headers.keys()]) headers.delete(key);
      continue;
    }

    const colon = line.indexOf(':');
    if (colon <= 0) continue;

    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();

    // `append` chứ không phải `set`: `set-cookie` hợp lệ khi lặp nhiều lần.
    // Bọc try/catch vì một header méo từ nguồn không đáng làm hỏng cả request.
    try {
      headers.append(key, value);
    } catch {
      /* bỏ qua header không hợp lệ */
    }
  }

  return headers;
}
