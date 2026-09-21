import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

import { sourceSeedsFor } from '@/constants/source';
import { WORKSPACES, type WorkspaceId } from '@/constants/workspace';

/**
 * Hai workflow GitHub Actions là đường THU THẬP DỮ LIỆU của cả dự án, mà không
 * chạy thử được dưới máy: sai một chữ thì phải đợi tới giờ chạy mới biết, và
 * kiểu hỏng tệ nhất không báo đỏ mà chỉ lặng lẽ không cào gì.
 *
 * Bốn kiểu hỏng câm mà các test dưới đây chặn:
 *
 *   1. Đổi chuỗi cron mà quên đổi `if: github.event.schedule == '...'` →
 *      những bước "một lần mỗi ngày" không bao giờ chạy nữa. Lượt chạy vẫn
 *      XANH, chỉ là không có tin mới.
 *   2. Hai lịch xô vào nhau → GitHub chỉ giữ MỘT lượt chờ mỗi nhóm
 *      concurrency, lượt chờ cũ bị huỷ im lặng.
 *   3. Gõ sai mã nguồn (`itvec`) hoặc hẹn lịch một nguồn đang tắt → crawler
 *      chạy xong, không cào gì, vẫn báo thành công.
 *   4. Workflow của workspace này lại trỏ vào ngành/CSDL của workspace kia.
 */

const ROOT = resolve(__dirname, '..');

interface Workflow {
  file: string;
  ws: WorkspaceId;
  on: {
    schedule?: { cron: string }[];
    workflow_dispatch?: { inputs?: { sources?: { default?: string } } };
  };
  /** Giá trị mặc định của ô "Nguồn cần cào" trên nút bấm tay. */
  dispatchSources?: string;
  concurrency: { group: string; 'cancel-in-progress': boolean };
  job: {
    'timeout-minutes'?: number;
    env?: Record<string, string>;
    steps: { name?: string; if?: string; run?: string }[];
  };
}

function load(file: string, ws: WorkspaceId): Workflow {
  const raw = parse(readFileSync(resolve(ROOT, '.github/workflows', file), 'utf8'));
  // YAML 1.1 đọc `on:` thành khoá boolean `true`; `yaml` mặc định 1.2 nên giữ
  // nguyên chữ "on". Nhận cả hai để test không phụ thuộc phiên bản thư viện.
  // (khoá boolean thành chuỗi "true" khi `parse` dựng object JavaScript)
  const on = raw.on ?? raw['true'];
  return {
    file,
    ws,
    on,
    dispatchSources: on.workflow_dispatch?.inputs?.sources?.default,
    concurrency: raw.concurrency,
    job: raw.jobs.crawl,
  };
}

const WORKFLOWS = [load('crawl.yml', 'bae'), load('crawl-swe.yml', 'swe')];

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
  it.each(WORKFLOWS.map((w) => [w.file, w] as const))('%s là YAML hợp lệ, có đủ khung', (_f, w) => {
    expect(w.on.schedule?.length).toBeGreaterThan(0);
    expect(w.job.steps.length).toBeGreaterThan(0);
    // Không có trần thời gian thì một lượt treo chạy tới 6 tiếng mặc định của
    // GitHub, tay vẫn giữ nhóm concurrency — chặn mọi lượt sau đó.
    expect(w.job['timeout-minutes']).toBeGreaterThan(0);
  });

  it.each(WORKFLOWS.map((w) => [w.file, w] as const))(
    '%s: mọi `if` theo lịch đều trỏ vào một cron CÓ THẬT',
    (_f, w) => {
      const declared = new Set(w.on.schedule!.map((s) => s.cron));
      const referenced = w.job.steps
        .map((s) => s.if?.match(/github\.event\.schedule\s*==\s*'([^']+)'/)?.[1])
        .filter((c): c is string => Boolean(c));

      // Bước "một lần mỗi ngày" phải tồn tại — nếu không thì lịch nặng vô nghĩa.
      expect(referenced.length).toBeGreaterThan(0);
      expect(referenced.filter((c) => !declared.has(c))).toEqual([]);
    },
  );

  it.each(WORKFLOWS.map((w) => [w.file, w] as const))(
    '%s chỉ cào nguồn đang BẬT của đúng workspace của nó',
    (_f, w) => {
      const active = new Set(
        sourceSeedsFor(w.ws)
          .filter((s) => s.isActive)
          .map((s) => s.code),
      );
      const fromSteps = w.job.steps.flatMap((s) => {
        // Ba dạng viết trong một file: `--source itviec`,
        // `--source glints,topdev`, và `--source ${{ inputs.sources || 'vnw' }}`
        // — dạng thứ ba chỉ lấy được phần mặc định nằm trong dấu nháy.
        const run = s.run ?? '';
        const direct = [...run.matchAll(/--source\s+([a-z0-9,-]+)/g)].map((m) => m[1]!);
        const fallback = [...run.matchAll(/inputs\.sources\s*\|\|\s*'([^']+)'/g)].map((m) => m[1]!);
        return [...direct, ...fallback];
      });
      // Ô mặc định của nút bấm tay — nơi dễ để lại một mã nguồn đã tắt nhất,
      // vì nó không bao giờ chạy theo lịch nên không ai thấy nó hỏng.
      const fromButton = w.dispatchSources ? [w.dispatchSources] : [];

      const scheduled = [...fromSteps, ...fromButton].flatMap((list) => list.split(','));
      expect(scheduled.length).toBeGreaterThan(0);
      expect(scheduled.filter((code) => !active.has(code))).toEqual([]);
    },
  );

  it.each(WORKFLOWS.map((w) => [w.file, w] as const))(
    '%s kiểm tin còn tuyển đúng ngành mặc định của workspace',
    (_f, w) => {
      const step = w.job.steps.find((s) => s.run?.includes('npm run recheck'));
      expect(step?.run).toContain(`--filter ${WORKSPACES[w.ws].defaultField}`);
    },
  );
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
    expect(bae!.job.env?.BJ_WORKSPACE).toBeUndefined();
    expect(swe!.job.env?.BJ_WORKSPACE).toBe('swe');

    // Khai workspace ở cả biến môi trường lẫn cờ `--ws` mà lệch nhau thì
    // `readWorkspaceId` ném lỗi; chặn luôn từ đây cho khỏi phải chờ tới giờ chạy.
    for (const w of WORKFLOWS) {
      const flags = w.job.steps.flatMap((s) => [...(s.run ?? '').matchAll(/--ws\s+(\w+)/g)]);
      expect(flags.map((m) => m[1]), w.file).toEqual([]);
    }
  });

  it('swe đọc CSDL riêng, và mang theo CSDL của bae chỉ để đối chiếu', () => {
    const swe = WORKFLOWS[1]!;
    const env = swe.job.env!;
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
