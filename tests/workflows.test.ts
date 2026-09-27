import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

import { sourceSeedsFor } from '@/constants/source';
import { WORKSPACES, type WorkspaceId } from '@/constants/workspace';
import { SourceKind } from '@/enums';

/**
 * Hai workflow GitHub Actions là đường THU THẬP DỮ LIỆU của cả dự án, mà không
 * chạy thử được dưới máy: sai một chữ thì phải đợi tới giờ chạy mới biết, và
 * kiểu hỏng tệ nhất không báo đỏ mà chỉ lặng lẽ không cào gì.
 *
 * Sáu kiểu hỏng câm mà các test dưới đây chặn:
 *
 *   1. Đổi chuỗi cron mà quên đổi `if: github.event.schedule == '...'` →
 *      những bước "một lần mỗi ngày" không bao giờ chạy nữa. Lượt chạy vẫn
 *      XANH, chỉ là không có tin mới.
 *   2. Hai lịch xô vào nhau → GitHub chỉ giữ MỘT lượt chờ mỗi nhóm
 *      concurrency, lượt chờ cũ bị huỷ im lặng.
 *   3. Gõ sai mã nguồn (`itvec`) hoặc hẹn lịch một nguồn đang tắt → crawler
 *      chạy xong, không cào gì, vẫn báo thành công.
 *   4. Thêm nguồn vào catalog mà quên thêm vào lịch → nguồn nằm trong CSDL,
 *      bật sẵn, và không bao giờ được gọi.
 *   5. Một dòng ma trận thiếu `phut` → `timeout-minutes` rỗng, job treo được
 *      phép chạy tới trần 6 giờ mặc định của GitHub trong khi vẫn giữ nhóm
 *      concurrency, tức chặn mọi lượt sau đó.
 *   6. Workflow của workspace này lại trỏ vào ngành/CSDL của workspace kia.
 */

const ROOT = resolve(__dirname, '..');

interface Step {
  name?: string;
  if?: string;
  run?: string;
}
interface Job {
  'timeout-minutes'?: number | string;
  env?: Record<string, string>;
  strategy?: { matrix?: { include?: Record<string, unknown>[] } };
  steps?: Step[];
}
interface Workflow {
  file: string;
  ws: WorkspaceId;
  on: {
    schedule?: { cron: string }[];
    workflow_dispatch?: { inputs?: { sources?: { default?: string } } };
  };
  dispatchSources?: string;
  concurrency: { group: string; 'cancel-in-progress': boolean };
  /** Biến môi trường ở cấp workflow, gộp với cấp job khi đọc. */
  env: Record<string, string>;
  jobs: Record<string, Job>;
}

function load(file: string, ws: WorkspaceId): Workflow {
  const raw = parse(readFileSync(resolve(ROOT, '.github/workflows', file), 'utf8'));
  // YAML 1.1 đọc `on:` thành khoá boolean true; `yaml` mặc định 1.2 nên giữ
  // nguyên chữ "on". Nhận cả hai để test không phụ thuộc phiên bản thư viện.
  // (khoá boolean thành chuỗi "true" khi `parse` dựng object JavaScript)
  const on = raw.on ?? raw['true'];
  return {
    file,
    ws,
    on,
    dispatchSources: on.workflow_dispatch?.inputs?.sources?.default,
    concurrency: raw.concurrency,
    env: raw.env ?? {},
    jobs: raw.jobs,
  };
}

const WORKFLOWS = [load('crawl.yml', 'bae'), load('crawl-swe.yml', 'swe')];
const CASES = WORKFLOWS.map((w) => [w.file, w] as const);

const jobsOf = (w: Workflow): Job[] => Object.values(w.jobs);
const stepsOf = (w: Workflow): Step[] => jobsOf(w).flatMap((j) => j.steps ?? []);
const envOf = (w: Workflow): Record<string, string> =>
  Object.assign({}, w.env, ...jobsOf(w).map((j) => j.env ?? {}));

/** Mã nguồn mà một workflow thật sự gọi tới — cả dạng ma trận lẫn dạng viết thẳng. */
function sourcesOf(w: Workflow): string[] {
  const fromMatrix = jobsOf(w).flatMap((j) =>
    (j.strategy?.matrix?.include ?? []).map((row) => String(row.nguon ?? '')),
  );
  const fromSteps = stepsOf(w).flatMap((s) => {
    // Ba dạng viết: `--source itviec`, `--source glints,topdev`, và
    // `--source ${{ inputs.sources || 'vnw' }}` — dạng thứ ba chỉ lấy được
    // phần mặc định nằm trong dấu nháy.
    const run = s.run ?? '';
    const direct = [...run.matchAll(/--source\s+([a-z0-9,-]+)/g)].map((m) => m[1]!);
    const fallback = [...run.matchAll(/inputs\.sources\s*\|\|\s*'([^']+)'/g)].map((m) => m[1]!);
    return [...direct, ...fallback];
  });
  // Ô mặc định của nút bấm tay — nơi dễ để lại một mã nguồn đã tắt nhất, vì
  // nó không bao giờ chạy theo lịch nên không ai thấy nó hỏng.
  const fromButton = w.dispatchSources ? [w.dispatchSources] : [];

  return [...fromMatrix, ...fromSteps, ...fromButton]
    .flatMap((list) => list.split(','))
    .map((code) => code.trim())
    .filter(Boolean);
}

/** Mọi phút trong ngày mà một chuỗi cron sẽ kích hoạt (chỉ lịch hằng ngày). */
function fireMinutes(cron: string): number[] {
  const [minute, hour, dom, month, dow] = cron.split(/\s+/);
  expect([dom, month, dow], `cron "${cron}" phải là lịch hằng ngày`).toEqual(['*', '*', '*']);
  const nums = (field: string): number[] => field.split(',').map(Number);
  const out: number[] = [];
  for (const h of nums(hour!)) for (const m of nums(minute!)) out.push(h * 60 + m);
  return out;
}

describe('workflow cào tin — mỗi file tự nhất quán', () => {
  it.each(CASES)('%s là YAML hợp lệ, có đủ khung', (_f, w) => {
    expect(w.on.schedule?.length).toBeGreaterThan(0);
    expect(jobsOf(w).length).toBeGreaterThan(0);
    expect(stepsOf(w).length).toBeGreaterThan(0);
  });

  it.each(CASES)('%s: mọi job đều có trần thời gian THẬT', (_f, w) => {
    for (const [name, job] of Object.entries(w.jobs)) {
      const timeout = job['timeout-minutes'];
      expect(timeout, `job "${name}" không có timeout-minutes`).toBeDefined();

      if (typeof timeout === 'number') {
        expect(timeout).toBeGreaterThan(0);
        continue;
      }
      // Dạng `${{ matrix.phut }}`: mọi dòng ma trận PHẢI khai khoá đó, không
      // thì GitHub thay bằng chuỗi rỗng và job được chạy tới 6 tiếng.
      const key = String(timeout).match(/matrix\.(\w+)/)?.[1];
      expect(key, `timeout-minutes của "${name}" không đọc được: ${timeout}`).toBeTruthy();
      const rows = job.strategy?.matrix?.include ?? [];
      expect(rows.length).toBeGreaterThan(0);
      expect(
        rows.filter((r) => typeof r[key!] !== 'number' || (r[key!] as number) <= 0).map((r) => r.nguon),
      ).toEqual([]);
    }
  });

  it.each(CASES)('%s: mọi `if` theo lịch đều trỏ vào một cron CÓ THẬT', (_f, w) => {
    const declared = new Set(w.on.schedule!.map((s) => s.cron));
    const referenced = stepsOf(w)
      .map((s) => s.if?.match(/github\.event\.schedule\s*==\s*'([^']+)'/)?.[1])
      .filter((c): c is string => Boolean(c));
    expect(referenced.filter((c) => !declared.has(c))).toEqual([]);
  });

  it.each(CASES)('%s chỉ cào nguồn đang BẬT của đúng workspace của nó', (_f, w) => {
    const active = new Set(
      sourceSeedsFor(w.ws)
        .filter((s) => s.isActive)
        .map((s) => s.code),
    );
    const scheduled = sourcesOf(w);
    expect(scheduled.length).toBeGreaterThan(0);
    expect(scheduled.filter((code) => !active.has(code))).toEqual([]);
  });

  it.each(CASES)('%s kiểm tin còn tuyển đúng ngành mặc định của workspace', (_f, w) => {
    const step = stepsOf(w).find((s) => s.run?.includes('npm run recheck'));
    expect(step?.run).toContain(`--filter ${WORKSPACES[w.ws].defaultField}`);
  });
});

describe('"mọi nguồn" phải đúng nghĩa mọi nguồn', () => {
  // Chỉ áp cho swe: lịch của Bae cố ý chạy một lát cắt (xem crawl.yml), còn
  // Ngành của tôi thì yêu cầu là cào hết.
  it('crawl-swe.yml gọi tới MỌI nguồn đang bật của swe', () => {
    const swe = WORKFLOWS[1]!;
    const crawlable = sourceSeedsFor('swe')
      // Nguồn nhập tay không có adapter — `loadSources` cũng loại chúng.
      .filter((s) => s.isActive && s.kind !== SourceKind.MANUAL)
      .map((s) => s.code)
      .sort();
    expect([...new Set(sourcesOf(swe))].sort()).toEqual(crawlable);
  });

  it('nguồn nhập tay KHÔNG bao giờ nằm trong lịch', () => {
    // robots.txt của Facebook và LinkedIn cấm user-agent của ta. Đường vào duy
    // nhất là `npm run ingest`, do người dùng tự đọc rồi dán.
    for (const w of WORKFLOWS) {
      expect(sourcesOf(w).filter((c) => c === 'fb-tay' || c === 'li-tay'), w.file).toEqual([]);
    }
  });
});

describe('hai workflow so với nhau', () => {
  it('dùng CHUNG nhóm concurrency và không huỷ lượt đang chạy', () => {
    for (const w of WORKFLOWS) {
      // Chung nhóm vì hai workspace gõ vào cùng các sàn: `MIN_DELAY_MS` chỉ
      // đúng khi mỗi host có một tiến trình xếp hàng.
      expect(w.concurrency.group, w.file).toBe('crawl');
      expect(w.concurrency['cancel-in-progress'], w.file).toBe(false);
    }
  });

  it('không lịch nào của swe nằm gần lịch của bae dưới 90 phút', () => {
    const [bae, swe] = WORKFLOWS;
    const baeMinutes = bae!.on.schedule!.flatMap((s) => fireMinutes(s.cron));
    const sweMinutes = swe!.on.schedule!.flatMap((s) => fireMinutes(s.cron));

    // Khoảng cách VÒNG TRÒN: 23:50 và 00:10 cách nhau 20 phút, không phải 1.420.
    const gap = (a: number, b: number): number => {
      const d = Math.abs(a - b);
      return Math.min(d, 1440 - d);
    };

    const tooClose = sweMinutes.flatMap((s) =>
      baeMinutes.filter((b) => gap(s, b) < 90).map((b) => `${hhmm(s)} (swe) ~ ${hhmm(b)} (bae)`),
    );
    expect(tooClose).toEqual([]);
  });

  it('mỗi workflow tự khai workspace của mình, không mượn của nhau', () => {
    const [bae, swe] = WORKFLOWS;
    // bae là workspace mặc định — cố ý KHÔNG khai biến, để mọi thứ có từ trước
    // ngày tách chạy y như cũ.
    expect(envOf(bae!).BJ_WORKSPACE).toBeUndefined();
    expect(envOf(swe!).BJ_WORKSPACE).toBe('swe');

    // Khai workspace ở cả biến môi trường lẫn cờ `--ws` mà lệch nhau thì
    // `readWorkspaceId` ném lỗi; chặn luôn từ đây cho khỏi phải chờ tới giờ chạy.
    for (const w of WORKFLOWS) {
      const flags = stepsOf(w).flatMap((s) => [...(s.run ?? '').matchAll(/--ws\s+(\w+)/g)]);
      expect(flags.map((m) => m[1]), w.file).toEqual([]);
    }
  });

  it('swe đọc CSDL riêng, và mang theo CSDL của bae chỉ để đối chiếu', () => {
    const env = envOf(WORKFLOWS[1]!);
    expect(env.DATABASE_URL_SWE).toContain('secrets.DATABASE_URL_SWE');
    // `assertDistinctDatabases` chỉ phát hiện được "dán nhầm chuỗi của Bae"
    // khi nhìn thấy CẢ HAI chuỗi — xem ghi chú trong crawl-swe.yml.
    expect(env.DATABASE_URL).toContain('secrets.DATABASE_URL');
  });
});

function hhmm(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
