import type { ReactNode } from 'react';

import { saveDictionary } from '@/actions/dictionary';
import {
  dictionaryReport,
  getFieldDefinition,
  getProvinceNames,
  listFields,
  scoreField,
  type FieldDefinition,
  type TermCount,
} from '@/api/field.api';
import { getTopProvinces } from '@/api/stats.api';
import { AppearanceForm } from '@/components/settings/appearance-form';
import { EditLock } from '@/components/settings/edit-lock';
import { Callout } from '@/components/ui/callout';
import { Cmd, Empty } from '@/components/ui/empty';
import { Glyph } from '@/components/ui/glyph';
import { LiveDot } from '@/components/ui/status';
import { Mascot } from '@/components/ui/mascot';
import { Kicker } from '@/components/ui/stat';
import { cx } from '@/components/ui/tone';
import { WORKSPACES } from '@/constants/workspace';
import { getAppearance } from '@/lib/appearance';
import { getEditAccess } from '@/lib/edit-access';
import {
  DRAFT_KEYS,
  FRESHNESS_CHOICES,
  applyDraft,
  diffDraft,
  draftHref,
  hasChanges,
  isGray,
  opsToEntries,
  readDraftOps,
  termLabel,
  withMaxAge,
  withPromoted,
  withProvince,
  withoutExclude,
  withoutKeyword,
  type Dictionary,
  type DraftOps,
} from '@/lib/field-draft';
import { readParam, type SearchParams } from '@/lib/query';
import { wsHref } from '@/lib/workspace-path';
import { workspaceParam } from '@/lib/workspace-route';
import { formatCount, formatDateTime, formatPercent } from '@/utils/format';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Cài đặt ngành' };


/**
 * Cài đặt — "Dạy mèo biết ngành của bạn".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Sửa trên BẢN NHÁP, xem trước, rồi mới lưu
 *
 * Mọi cú bấm trên trang (gỡ một từ, nâng từ xám, thêm tỉnh, đổi tuổi tin) chỉ
 * đổi URL — xem `lib/field-draft`. Trang đọc URL, dựng bản nháp, chấm lại TOÀN
 * BỘ tin bằng bản nháp đó bằng đúng bộ chấm của trang Ngành, rồi hiện số ở ô
 * "Xem trước kết quả". Chỉ nút "Lưu từ điển" mới ghi vào CSDL.
 *
 * Nhờ vậy lời hứa của bản thiết kế — "thêm từ là số tin khớp đổi ngay, không
 * phải chờ quét lại" — đúng theo nghĩa đen, mà gỡ nhầm một từ thì bấm Back là
 * xong, không mất gì.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Nút "Xem khi không có tin nào khớp" của bản thiết kế là lối tắt của bản mẫu
 * để xem màn rỗng; ở app thật màn đó tự hiện ở trang Ngành khi lọc ra 0 tin,
 * nên chỗ đó dành cho "Bỏ thay đổi".
 */
export default async function SettingsPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ ws: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const ws = await workspaceParam(routeParams);
  const PATH = wsHref(ws, '/cai-dat');
  const defaultField = WORKSPACES[ws].defaultField;
  const params = await searchParams;
  const slug = readParam(params, 'f') ?? defaultField;
  const fieldParam = slug === defaultField ? undefined : slug;

  const [definition, fields, access, appearance] = await Promise.all([
    getFieldDefinition(ws, slug),
    listFields(ws),
    getEditAccess(),
    getAppearance(ws),
  ]);

  if (!definition) {
    return (
      <Empty title={`Chưa có ngành “${slug}”`}>
        Chạy <Cmd>npm run db:seed -- --ws {ws}</Cmd> để nạp ngành mẫu, rồi quay lại đây để dạy mèo.
      </Empty>
    );
  }

  const saved: Dictionary = definition;
  const ops = readDraftOps(params);
  const draft = applyDraft(saved, ops);
  // Chuẩn hoá lại: URL gõ tay có thể mang thay đổi thừa (thêm một từ đã có).
  const pending = diffDraft(saved, draft);
  const dirty = hasChanges(pending);
  const draftDefinition: FieldDefinition = { ...definition, ...draft, updatedAt: null };

  const [preview, current, report, draftProvinceNames, topProvinces] = await Promise.all([
    scoreField(draftDefinition),
    dirty ? scoreField(definition) : null,
    dictionaryReport(draftDefinition),
    getProvinceNames(ws, draft.provinces),
    getTopProvinces(ws, 8),
  ]);

  const href = (next: Dictionary) => draftHref(PATH, saved, next, fieldParam);
  const savedKeys = new Set(saved.keywords);
  const isNew = (raw: string) => !savedKeys.has(raw);

  const strong = draft.keywords.filter((raw) => !isGray(raw));
  const gray = draft.keywords.filter(isGray);
  const strongTotal = preview.total;
  const suggestions = topProvinces.filter((p) => !draft.provinces.includes(p.key)).slice(0, 3);
  const noStrong = strong.length === 0;

  const hidden = (
    <>
      {fieldParam && <input type="hidden" name="f" value={fieldParam} />}
      {opsToEntries(pending).map(([key, value], index) => (
        <input key={`${key}-${index}`} type="hidden" name={key} value={value} />
      ))}
    </>
  );

  return (
    <>
      <section className="brand-field flex flex-wrap items-center gap-7 px-4 py-7.5 sm:px-6">
        <div className="min-w-0 flex-[1_1_420px]">
          <Kicker>Từ điển ngành của bạn · {definition.name}</Kicker>
          <h1 className="mb-2.5 text-[32px] leading-[1.05] sm:text-[38px]">Dạy mèo biết ngành của bạn</h1>
          <p className="max-w-140 text-[15px] leading-[1.55] text-pretty text-neutral-800">
            Mình chấm điểm tin bằng đúng mấy từ khoá dưới đây. Thêm hay bớt từ là số tin khớp đổi ngay —
            không phải chờ quét lại. Chỉ khi bấm “Lưu từ điển” thì danh sách ngành mới đổi theo.
          </p>
          {fields.length > 1 && (
            <nav aria-label="Chọn ngành" className="seg mt-4 bg-bg">
              {fields.map((field) => (
                <a
                  key={field.slug}
                  href={field.slug === defaultField ? PATH : `${PATH}?f=${encodeURIComponent(field.slug)}`}
                  aria-current={field.slug === slug ? 'true' : undefined}
                  className="seg-opt"
                >
                  {field.name}
                </a>
              ))}
            </nav>
          )}
        </div>
        <div className="hidden sm:block">
          <Mascot pose="sit" width={160} />
        </div>
      </section>

      {readParam(params, 'da-luu') && !dirty && (
        <Callout tone="live" className="px-4 sm:px-6" icon={<LiveDot size={9} />}>
          Đã lưu từ điển. Trang Ngành, Tổng quan và Lương đã chấm lại theo từ mới.
        </Callout>
      )}
      {readParam(params, 'loi') === 'trong' && (
        <Callout tone="warn" className="px-4 sm:px-6" icon={<Glyph name="alert" size={18} />}>
          Chưa lưu: cần ít nhất một từ khớp chắc. Từ khớp yếu không bao giờ tự kéo tin vào ngành, nên
          một từ điển chỉ có từ yếu sẽ luôn ra 0 tin.
        </Callout>
      )}

      <div className="flex flex-wrap items-start">
        <div className="flex min-w-0 flex-[999_1_440px] flex-col gap-7 border-divider px-4 pt-6.5 pb-10 sm:px-6 lg:border-r-2">
          {/* ── Khớp chắc ──────────────────────────────────────────────── */}
          <Group
            title="Từ khoá khớp chắc"
            badge={<span className="tag tag-solid text-[11px]">{formatCount(strongTotal)} tin</span>}
            lead="Tin có một trong các từ này ở tiêu đề sẽ vào thẳng danh sách của bạn. Số trên mỗi từ là số tin có từ đó ở tiêu đề."
          >
            {strong.map((raw) => (
              <a
                key={raw}
                href={href(withoutKeyword(draft, termLabel(raw)))}
                title={isNew(raw) ? 'Mới thêm, chưa lưu — bấm để gỡ' : 'Gỡ từ này khỏi bản nháp'}
                className={cx('tag tag-solid px-3 py-2 hover:bg-accent-600', isNew(raw) && 'italic')}
              >
                {termLabel(raw)} · {countOf(report.strong, termLabel(raw))} ✕
              </a>
            ))}
            <AddTerm param={DRAFT_KEYS.add} label="+ thêm từ khoá" hidden={hidden} />
          </Group>

          {/* ── Khớp yếu (xám) ─────────────────────────────────────────── */}
          <Group
            title="Từ khoá khớp yếu"
            badge={
              <span className="tag tag-neutral text-[11px]">
                {formatCount(report.grayReach)} tin · đang tắt
              </span>
            }
            lead="Từ gần ngành nhưng dễ lẫn. Mình chỉ dùng chúng để cộng điểm khi tiêu đề đã có một từ khớp chắc. Bấm một từ để nâng nó thành từ khớp chắc — danh sách dài hơn mà lẫn cũng nhiều hơn. Số trên mỗi từ là số tin sẽ vào thêm."
          >
            {gray.map((raw) => (
              <span key={raw} className={cx('tag tag-neutral p-0', isNew(raw) && 'italic')}>
                <a
                  href={href(withPromoted(draft, termLabel(raw)))}
                  title="Nâng thành từ khớp chắc"
                  className="py-2 pr-1.5 pl-3 text-neutral-800 hover:text-accent-700"
                >
                  {termLabel(raw)} · {countOf(report.gray, termLabel(raw))}
                </a>
                <a
                  href={href(withoutKeyword(draft, termLabel(raw)))}
                  aria-label={`Gỡ “${termLabel(raw)}”`}
                  title="Gỡ hẳn từ này"
                  className="py-2 pr-3 pl-1 text-neutral-600 hover:text-critical-ink"
                >
                  ✕
                </a>
              </span>
            ))}
            <AddTerm param={DRAFT_KEYS.addGray} label="+ thêm từ khớp yếu" hidden={hidden} />
          </Group>

          {/* ── Loại trừ ───────────────────────────────────────────────── */}
          <Group
            title="Từ khoá loại trừ"
            badge={<span className="tag tag-neutral text-[11px]">−{formatCount(report.excludedTotal)} tin</span>}
            lead="Tin có các từ này ở tiêu đề bị loại, kể cả khi khớp từ chính. Số trên mỗi từ là số tin đang bị chính từ đó chặn."
          >
            {draft.excludes.map((term) => (
              <a
                key={term}
                href={href(withoutExclude(draft, term))}
                title="Gỡ từ loại trừ này"
                className={cx(
                  'tag bg-neutral-300 px-3 py-2 text-text line-through hover:bg-neutral-400 hover:text-text',
                  !saved.excludes.includes(term) && 'italic',
                )}
              >
                {term} · {countOf(report.excludes, term)} ✕
              </a>
            ))}
            <AddTerm param={DRAFT_KEYS.addExclude} label="+ thêm từ loại trừ" hidden={hidden} />
          </Group>

          <hr className="hr" />

          {/* ── Địa bàn & độ tươi ──────────────────────────────────────── */}
          <div>
            <h5 className="mb-3.5">Địa bàn &amp; độ tươi</h5>
            <div className="flex flex-wrap gap-5">
              <div className="flex-[1_1_240px]">
                <p className="mb-2 text-xs text-neutral-700">Tỉnh / thành</p>
                <div className="popwrap flex flex-wrap gap-1.5">
                  {draft.provinces.length === 0 && (
                    <span className="tag tag-neutral px-2.75 py-1.75">Mọi nơi</span>
                  )}
                  {draft.provinces.map((province, index) => (
                    <a
                      key={province}
                      href={href(withProvince(draft, province, false))}
                      className="tag tag-solid px-2.75 py-1.75 hover:bg-accent-600"
                    >
                      {draftProvinceNames[index]} ✕
                    </a>
                  ))}
                  {suggestions.map((province) => (
                    <a
                      key={province.key}
                      href={href(withProvince(draft, province.key, true))}
                      title={`${formatCount(province.count)} tin còn hiệu lực`}
                      className="tag tag-outline px-2.75 py-1.75"
                    >
                      + {province.name}
                    </a>
                  ))}
                </div>
              </div>
              <div className="flex-[1_1_240px]">
                <p className="mb-2 text-xs text-neutral-700">Chỉ tin đăng trong</p>
                <nav aria-label="Tuổi tin" className="seg">
                  {freshnessOptions(draft.maxAgeDays).map((days) => (
                    <a
                      key={String(days)}
                      href={href(withMaxAge(draft, days))}
                      aria-current={draft.maxAgeDays === days ? 'true' : undefined}
                      className="seg-opt"
                    >
                      {days === null ? 'Mọi lúc' : `${days} ngày`}
                    </a>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </div>

        {/* ── Xem trước & lưu ──────────────────────────────────────────── */}
        <aside className="flex w-full flex-col gap-5 border-t-2 border-divider px-4 pt-6.5 pb-10 sm:px-6 lg:w-auto lg:max-w-90 lg:flex-[1_1_280px] lg:border-t-0">
          <div className="bg-text p-5 text-neutral-100">
            <p className="mb-2.5 text-[11px] tracking-widest text-accent-400 uppercase">
              {dirty ? 'Xem trước bản nháp' : 'Xem trước kết quả'}
            </p>
            <p className="mb-1.5 font-heading text-[40px] leading-none font-extrabold">
              {formatCount(preview.total)}
            </p>
            <p className="mb-4.5 text-[13px] text-neutral-300">
              tin khớp chắc trên {formatCount(preview.scanned)} tin đã chấm (
              {formatPercent(preview.total, preview.scanned)})
            </p>

            {current && (
              <div className="mb-4.5 border-t border-neutral-700 pt-3 text-[13px] text-neutral-300">
                <p>
                  Bản đang lưu: {formatCount(current.total)} tin ·{' '}
                  <strong className="font-extrabold text-neutral-100">
                    {signed(preview.total - current.total)} tin
                  </strong>
                </p>
                <p className="mt-1 text-xs text-neutral-400">Chưa lưu: {summarize(pending)}</p>
              </div>
            )}

            <form action={saveDictionary} className="flex flex-col gap-2.5">
              {hidden}
              <input type="hidden" name="ws" value={ws} />
              {!fieldParam && <input type="hidden" name="f" value={slug} />}
              <button
                type="submit"
                disabled={!dirty || !access.allowed || noStrong}
                title={
                  !access.allowed
                    ? 'Nhập khoá sửa để lưu'
                    : noStrong
                      ? 'Cần ít nhất một từ khớp chắc'
                      : !dirty
                        ? 'Chưa có thay đổi nào'
                        : undefined
                }
                className="btn btn-primary btn-block h-11"
              >
                Lưu từ điển
              </button>
              {dirty ? (
                <a
                  href={fieldParam ? `${PATH}?f=${encodeURIComponent(fieldParam)}` : PATH}
                  className="btn btn-secondary btn-block border-neutral-600 text-[13px] text-neutral-100 hover:text-neutral-100"
                >
                  Bỏ thay đổi
                </a>
              ) : (
                <a
                  href={wsHref(ws, fieldParam ? `/nganh?f=${encodeURIComponent(fieldParam)}` : '/nganh')}
                  className="btn btn-secondary btn-block border-neutral-600 text-[13px] text-neutral-100 hover:text-neutral-100"
                >
                  Xem danh sách ngành
                </a>
              )}
            </form>
            {definition.updatedAt && (
              <p className="mt-3 text-[11px] text-neutral-400">
                Sửa lần cuối {formatDateTime(definition.updatedAt)}
              </p>
            )}
          </div>

          <EditLock
            back={draftHref(PATH, saved, draft, fieldParam)}
            wrong={readParam(params, 'khoa') === 'sai'}
          />

          <Callout
            tone="brand"
            align="start"
            className="p-4"
            icon={<Mascot pose="head" width={46} motion="none" />}
          >
            Mẹo của mèo: giữ 4–6 từ khớp chắc thật đặc trưng là đủ. Thêm nhiều quá thì danh sách toàn tin
            lệch ngành, mà bạn lại phải tự soi.
          </Callout>

          <hr className="hr" />
          <AppearanceForm appearance={appearance} ws={ws} />
        </aside>
      </div>
    </>
  );
}

function Group({
  title,
  badge,
  lead,
  children,
}: {
  title: string;
  badge: ReactNode;
  lead: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <h5>{title}</h5>
        {badge}
      </div>
      <p className="mb-3.5 max-w-170 text-[13px] text-neutral-700">{lead}</p>
      <div className="popwrap flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/**
 * "+ thêm từ khoá" — nhãn viền mở ra một ô nhập.
 *
 * Là `<form method="get">`: từ mới đi vào URL như mọi thay đổi khác của bản
 * nháp, kèm toàn bộ thay đổi đang có (input ẩn), nên thêm từ không làm mất
 * những gì vừa gỡ.
 */
function AddTerm({ param, label, hidden }: { param: string; label: string; hidden: ReactNode }) {
  return (
    <details className="group">
      <summary className="tag tag-outline cursor-pointer list-none px-3 py-2 [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">{label}</span>
        <span className="hidden group-open:inline">Huỷ</span>
      </summary>
      <form method="get" className="mt-2 flex items-center gap-1.5">
        {hidden}
        <input
          type="text"
          name={param}
          required
          maxLength={60}
          placeholder="gõ một từ…"
          aria-label={label.replace('+ ', '')}
          className="input h-9 w-44 bg-neutral-100"
        />
        <button type="submit" className="btn btn-primary h-9 px-3">
          Thêm
        </button>
      </form>
    </details>
  );
}

function countOf(rows: TermCount[], label: string): string {
  return formatCount(rows.find((row) => row.label === label)?.count ?? 0);
}

function signed(value: number): string {
  if (value === 0) return '±0';
  return `${value > 0 ? '+' : '−'}${formatCount(Math.abs(value))}`;
}

function freshnessOptions(current: number | null): (number | null)[] {
  const options: (number | null)[] = [...FRESHNESS_CHOICES];
  // Giá trị đang lưu nằm ngoài ba mốc (sửa bằng SQL) thì vẫn phải hiện, nếu
  // không dãy lựa chọn không có ô nào sáng và người dùng không biết đang là gì.
  if (current === null || !options.includes(current)) options.push(current);
  return options;
}

/** "+2 từ chắc, −1 từ loại, đổi tuổi tin" — tóm tắt phần chưa lưu. */
function summarize(ops: DraftOps): string {
  const parts: string[] = [];
  const count = (n: number, text: string) => n > 0 && parts.push(`${n} ${text}`);
  count(ops.add.length, 'từ chắc mới');
  count(ops.promote.length, 'từ được nâng');
  count(ops.addGray.length, 'từ yếu mới');
  count(ops.remove.length, 'từ bị gỡ');
  count(ops.addExclude.length, 'từ loại mới');
  count(ops.removeExclude.length, 'từ loại bị gỡ');
  count(ops.addProvince.length + ops.removeProvince.length, 'thay đổi tỉnh');
  if (ops.maxAgeDays !== undefined) parts.push('đổi tuổi tin');
  return parts.join(', ');
}
