import type { ReactNode } from 'react';

import type { Facet, FieldPage } from '@/api/field.api';
import { BarRow } from '@/components/ui/bar-row';
import { Glyph, type GlyphName } from '@/components/ui/glyph';
import { cx } from '@/components/ui/tone';
import { WORKSPACES } from '@/constants/workspace';
import { FACET_NONE } from '@/lib/field-bands';
import { readFlag, readParam, readParams, type SearchParams } from '@/lib/query';
import { formatCount } from '@/utils/format';

import { activeFieldFilters } from './field-active-filters';

/**
 * Bảng lọc của trang Ngành — `<form method="get">` thuần, không một dòng
 * JavaScript.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BA CÁCH CHỐNG LỌC SÓT, tất cả đều nhìn thấy được trên màn hình
 *
 *   1. **Mỗi ô mang số tin của chính nó**, đếm trên tập đã áp mọi bộ lọc KHÁC
 *      trừ chiều của nó. Nhìn là biết tích vào còn lại bao nhiêu.
 *   2. **Ô 0 tin vẫn hiện**, chỉ làm mờ. Ẩn đi thì bảng lọc tự đổi hình mỗi
 *      lần chọn và người dùng tưởng mình bấm nhầm.
 *   3. **Ô "Tin không ghi" là một lựa chọn thật**, không phải luật ngầm trong
 *      code — xem `FACET_NONE`. Cộng số trong các ô của một chiều lại đúng
 *      bằng tổng số tin, nên tự kiểm được là bảng lọc không nuốt mất ai.
 * ─────────────────────────────────────────────────────────────────────────────
 * HAI CHỖ LỆCH CÓ CHỦ Ý SO VỚI BẢN THIẾT KẾ
 *
 * · **Giữ đủ các chiều lọc.** Bản v2 vẽ bốn: loại mua hàng, lương, kinh
 *   nghiệm, quận. "Lịch thứ 7" và "Phạm vi" đang chạy thật và đang được dùng —
 *   bỏ đi là lấy mất tính năng nhân danh một bản vẽ. Hai chiều thêm dùng đúng
 *   ngôn ngữ thị giác của hai chiều đứng trên nó.
 * · **"Thoả thuận" là một dòng bấm được**, không chỉ là chú thích. Bản thiết
 *   kế ghi "214 tin ghi thoả thuận" như một dòng chữ; ở đây nó vẫn trông như
 *   thế, nhưng có ô tích — vì đó chính là ô `FACET_NONE` của chiều lương.
 * ─────────────────────────────────────────────────────────────────────────────
 * MỘT BẢNG LỌC, HAI NGHỀ
 *
 * Chiều đầu tiên đổi theo `WorkspaceConfig.taxonomy`, và chỉ chiều đó đổi:
 *
 *   · `purchase` → "Loại mua hàng" (ngành của công ty)
 *   · `stack`    → "Ngôn ngữ & nền tảng" + "Cấp bậc" + "Hình thức làm"
 *
 * "Loại mua hàng" KHÔNG được hiện ở nghề phần mềm. Nó vẫn chấm ra giá trị ở đó
 * — `classifyPurchase` đọc cột `industry` mà sàn nào cũng khai — nhưng "mua cho
 * nhà máy nào" là một câu vô nghĩa với một tin tuyển backend. Đây là chỗ duy
 * nhất trong bảng lọc buộc phải rẽ nhánh theo workspace.
 *
 * Ngược lại, "Cấp bậc" và "Hình thức làm" là chiều DÙNG ĐƯỢC CHO CẢ HAI nghề,
 * nhưng hiện chỉ bật ở `stack` — bản thiết kế chỉ vẽ chúng ở màn SWE, và thêm
 * hai chiều vào trang đã chốt của Bae là một thay đổi không ai yêu cầu. Muốn
 * bật cho cả hai thì bỏ điều kiện, phần đọc dữ liệu đã đếm sẵn.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ `<form>` không khai `action` nộp về đúng trang hiện tại, nhưng MỌI tham số
 *    không có ô nhập tương ứng sẽ bị xoá sạch. `page` thì đáng xoá — đổi bộ lọc
 *    mà giữ trang 7 là ra danh sách rỗng khó hiểu. Còn `f` phải mang theo.
 */
export function FieldFilterPanel({
  result,
  params,
  fields,
}: {
  result: FieldPage;
  params: SearchParams;
  fields: { slug: string; name: string }[];
}) {
  const conditions = activeFieldFilters(params).length;
  const cover = (n: number): string => `${formatCount(n)}/${formatCount(result.inFieldTotal)}`;
  const byStack = WORKSPACES[result.ws].taxonomy === 'stack';

  const purchase = result.facets.purchaseTypes;
  const purchaseSelected = new Set(readParams(params, 'loai'));
  // Bốn nhóm đầu hiện sẵn; phần còn lại gập vào. Nhóm ĐANG CHỌN thì luôn
  // hiện, dù nằm sâu tới đâu — giấu một ô đang tích là giấu lý do danh sách ngắn.
  const purchaseTop = purchase.filter((facet, index) => index < 4 || purchaseSelected.has(facet.value));
  const purchaseRest = purchase.filter((facet) => !purchaseTop.includes(facet));

  // Stack đi theo đúng khuôn của loại mua hàng: năm cái đông nhất hiện sẵn,
  // phần còn lại gập vào, cái đang chọn luôn hiện.
  const stack = result.facets.skills;
  const stackSelected = new Set(readParams(params, 'stack'));
  const stackTop = stack.filter((facet, index) => index < 5 || stackSelected.has(facet.value));
  const stackRest = stack.filter((facet) => !stackTop.includes(facet));

  const salaryBands = result.facets.salary.filter((facet) => facet.value !== FACET_NONE);
  const salaryNone = result.facets.salary.find((facet) => facet.value === FACET_NONE);
  const salarySelected = new Set(readParams(params, 'luong'));
  const salaryCeil = Math.max(1, ...salaryBands.map((facet) => facet.count));

  return (
    <form method="get" className="flex flex-col gap-5">
      {/* Chỉ khi KHÔNG có ô chọn ngành. Có cả hai thì `f` bị gửi hai lần và
          `readParam` lấy cái đầu — tức ô chọn ngành mất tác dụng. */}
      {fields.length <= 1 && <input type="hidden" name="f" value={result.slug} />}

      <div className="flex items-center gap-2">
        <Glyph name="funnel" size={16} stroke="var(--color-accent)" />
        <h6>Lọc</h6>
        <span className="ml-auto text-[11px] text-neutral-600">
          {conditions === 0 ? 'chưa lọc gì' : `${conditions} điều kiện`}
        </span>
      </div>

      {/* `defaultValue` chứ không phải `value`: form thuần, ô tự giữ chữ người
          dùng gõ; React chỉ đặt giá trị ban đầu lấy từ URL. */}
      <label className="relative block">
        <span className="sr-only">Tìm trong ngành</span>
        <Glyph
          name="search"
          size={15}
          stroke="var(--color-neutral-600)"
          className="absolute top-1/2 left-2.5 -translate-y-1/2"
        />
        <input
          type="search"
          name="q"
          defaultValue={readParam(params, 'q') ?? ''}
          placeholder={`Tìm trong ${formatCount(result.inFieldTotal)} tin…`}
          className="input h-10 bg-neutral-100 pl-8"
        />
      </label>

      {fields.length > 1 && (
        <Group icon="globe" title="Ngành">
          <select name="f" defaultValue={result.slug} className="input h-10 cursor-pointer bg-neutral-100">
            {fields.map((field) => (
              <option key={field.slug} value={field.slug}>
                {field.name}
              </option>
            ))}
          </select>
        </Group>
      )}

      {byStack ? (
        <>
          <Group
            icon="code"
            title="Ngôn ngữ & nền tảng"
            note={`${cover(result.coverage.skill)} bóc được`}
            gap="tight"
          >
            {stack.length === 0 ? (
              // Không phải "chưa có dữ liệu" chung chung: ở nghề phần mềm, bảng
              // `Skill` rỗng là một sự cố nạp dữ liệu, và người đọc phải biết
              // phải làm gì với nó.
              <p className="text-xs text-neutral-600">
                Chưa bóc được stack nào. Chạy <code className="font-mono">npm run db:seed -- --ws swe</code>{' '}
                rồi <code className="font-mono">npm run reparse -- --ws swe</code>.
              </p>
            ) : (
              stackTop.map((facet) => (
                <CheckRow
                  key={facet.value}
                  name="stack"
                  facet={facet}
                  checked={stackSelected.has(facet.value)}
                  bold
                />
              ))
            )}
            {stackRest.length > 0 && (
              <details className="group">
                {/* `.btn` khai `white-space: nowrap`, mà dòng này dài hơn cột
                    lọc ở mọi bề rộng dưới ~1800px — nên phải cho xuống dòng,
                    nếu không đuôi bị cắt cụt ngay giữa một tên stack. */}
                <summary className="btn btn-ghost w-full list-none justify-start gap-1.5 text-left text-xs whitespace-normal [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 group-open:hidden">
                    + {stackRest.length} stack khác ({stackRest.slice(0, 3).map((f) => f.label).join(', ')}
                    {stackRest.length > 3 ? '…' : ''})
                  </span>
                  <span className="hidden group-open:inline">Thu gọn</span>
                  <Glyph name="chevronDown" size={13} className="transition-transform group-open:rotate-180" />
                </summary>
                {/* Danh mục stack dài hơn danh mục loại mua hàng nhiều — cuộn
                    trong khung thay vì đẩy nút "Áp bộ lọc" xuống quá xa. */}
                <div className="mt-2 flex max-h-64 flex-col gap-2 overflow-y-auto">
                  {stackRest.map((facet) => (
                    <CheckRow
                      key={facet.value}
                      name="stack"
                      facet={facet}
                      checked={stackSelected.has(facet.value)}
                      bold
                    />
                  ))}
                </div>
              </details>
            )}
          </Group>

          <hr className="hr" />

          <Group icon="briefcase" title="Cấp bậc" note={cover(result.coverage.level)}>
            <Tags name="cap" options={result.facets.levels} params={params} />
          </Group>

          <hr className="hr" />

          <Group icon="globe" title="Hình thức làm" note={cover(result.coverage.workMode)}>
            <Tags name="ht" options={result.facets.workModes} params={params} />
          </Group>
        </>
      ) : (
        <Group icon="building" title="Loại mua hàng" gap="tight">
          {purchase.length === 0 && <NoData />}
          {purchaseTop.map((facet) => (
            <CheckRow key={facet.value} name="loai" facet={facet} checked={purchaseSelected.has(facet.value)} />
          ))}
          {purchaseRest.length > 0 && (
            <details className="group">
              <summary className="btn btn-ghost w-fit list-none gap-1.5 text-xs [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">+ {purchaseRest.length} nhóm khác</span>
                <span className="hidden group-open:inline">Thu gọn</span>
                <Glyph name="chevronDown" size={13} className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                {purchaseRest.map((facet) => (
                  <CheckRow key={facet.value} name="loai" facet={facet} checked={purchaseSelected.has(facet.value)} />
                ))}
              </div>
            </details>
          )}
        </Group>
      )}

      <hr className="hr" />

      <Group icon="money" title="Lương" note={`${cover(result.coverage.salary)} có ghi`}>
        {salaryBands.map((facet) => {
          const checked = salarySelected.has(facet.value);
          return (
            <OptionLabel key={facet.value} facet={facet} checked={checked} className="px-2 py-1.25 text-[13px]">
              <input
                type="checkbox"
                name="luong"
                value={facet.value}
                defaultChecked={checked}
                className="peer sr-only"
              />
              <BarRow
                className="flex-1 peer-focus-visible:underline"
                label={facet.short ?? facet.label}
                count={facet.count}
                ratio={facet.count / salaryCeil}
                // Màu "đang chọn" do CSS `.fopt:has(:checked)` lo, để bỏ tích
                // là thanh nhạt đi ngay chứ không giữ màu của lần tải trang.
                fill="soft"
                height={9}
                labelWidth={78}
                countWidth={24}
              />
            </OptionLabel>
          );
        })}
        {salaryNone && (
          <OptionLabel
            facet={salaryNone}
            checked={salarySelected.has(FACET_NONE)}
            className="gap-2 px-2 py-1 text-[11px] text-neutral-600"
          >
            <input
              type="checkbox"
              name="luong"
              value={FACET_NONE}
              defaultChecked={salarySelected.has(FACET_NONE)}
              className="peer sr-only"
            />
            <Square small />
            <span className="peer-checked:font-extrabold peer-checked:text-accent-700">
              {formatCount(salaryNone.count)} tin ghi “thoả thuận”
            </span>
          </OptionLabel>
        )}
      </Group>

      <hr className="hr" />

      <Group icon="briefcase" title="Kinh nghiệm" note={cover(result.coverage.experience)}>
        <Tags name="kn" options={result.facets.experience} params={params} />
      </Group>

      <hr className="hr" />

      {/* Quận có thể lên tới vài chục giá trị. Cuộn trong khung thay vì cắt
          bớt: cắt bớt là giấu mất chính cái quận người ta đang tìm. */}
      <Group icon="pin" title="Quận / khu" note={cover(result.coverage.district)}>
        <div className="max-h-52 overflow-y-auto">
          <Tags name="quan" options={result.facets.districts} params={params} />
        </div>
      </Group>

      <hr className="hr" />

      <Group icon="calendar" title="Lịch thứ 7" note={cover(result.coverage.saturday)}>
        <Tags name="t7" options={result.facets.saturday} params={params} />
      </Group>

      <hr className="hr" />

      <Group icon="shield" title="Phạm vi" gap="tight">
        <Toggle
          name="weak"
          checked={readFlag(params, 'weak')}
          hint="Tin chỉ có từ khoá ở phần mô tả, không có ở tiêu đề"
        >
          Kể cả tin khớp yếu
          {result.weakHidden > 0 && <span className="text-neutral-600"> · {result.weakHidden}</span>}
        </Toggle>
        {/* Sáp nhập 2025 gộp Bình Dương và Bà Rịa – Vũng Tàu vào TP.HCM. Đúng về
            hành chính, nhưng Thủ Đức và Bến Cát là hai thế giới đi lại khác
            nhau — để người dùng tự chọn, đừng quyết hộ. */}
        <Toggle
          name="hep"
          checked={readFlag(params, 'hep')}
          hint="Bỏ tin ở Bình Dương và Bà Rịa – Vũng Tàu, phần sáp nhập vào TP.HCM năm 2025"
        >
          Chỉ TP.HCM cũ
        </Toggle>
      </Group>

      {/* Nút nộp DÍNH ĐÁY khung lọc: danh sách ô dài hơn một màn hình, mà
          tích xong không thấy nút thì tưởng bộ lọc đã tự áp. Con số trên nút
          là số tin CỦA LẦN LỌC TRƯỚC — tích thêm ô rồi mới bấm thì số đổi. */}
      <div className="sticky bottom-0 bg-bg pt-1 pb-1">
        <button type="submit" className="btn btn-primary btn-block h-11 gap-2">
          <Glyph name="check" size={16} strokeWidth={1.9} />
          Áp bộ lọc · {formatCount(result.total)} tin
        </button>
      </div>
    </form>
  );
}

// ─── Mảnh giao diện ──────────────────────────────────────────────────────────

function Group({
  icon,
  title,
  note,
  gap = 'normal',
  children,
}: {
  icon: GlyphName;
  title: string;
  /** Dòng phụ — dùng cho ĐỘ PHỦ, không dùng cho lời giải thích dài. */
  note?: string;
  gap?: 'normal' | 'tight';
  children: ReactNode;
}) {
  return (
    <fieldset className={cx('m-0 flex min-w-0 flex-col border-0 p-0', gap === 'tight' ? 'gap-2' : 'gap-2.5')}>
      <legend className="sr-only">{title}</legend>
      <div className="mb-0.5 flex items-center gap-1.75">
        <Glyph name={icon} size={14} stroke="var(--color-accent)" />
        <span className="font-heading text-[13px] font-extrabold">{title}</span>
        {note && <span className="ml-auto text-[11px] text-neutral-600">{note}</span>}
      </div>
      {children}
    </fieldset>
  );
}

function NoData() {
  return <p className="text-xs text-neutral-600">Chưa có dữ liệu</p>;
}

/**
 * Nhãn bọc một ô tích ẩn. Ô tích thật bị ẩn bằng `sr-only` chứ không phải
 * `display:none`: ẩn hẳn thì bàn phím không tới được và trình đọc màn hình không
 * thấy. Hình vẽ đứng SAU ô tích vì `peer-*` chỉ nhìn được về phía trước.
 */
function OptionLabel({
  facet,
  checked,
  className,
  children,
}: {
  facet: Facet;
  checked: boolean;
  className?: string;
  children: ReactNode;
}) {
  // Ô rỗng mà CHƯA chọn thì làm mờ. Ô rỗng mà ĐANG chọn thì để sáng, vì nó là
  // lý do danh sách đang trống.
  const empty = facet.count === 0 && !checked;
  return (
    <label
      title={facet.hint}
      className={cx('fopt flex cursor-pointer items-center has-checked:bg-accent-100', empty && 'opacity-45', className)}
    >
      {children}
    </label>
  );
}

function Square({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        'flex-none border-[1.5px] border-neutral-500 peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
        small ? 'size-2.5' : 'size-3.5',
      )}
    />
  );
}

/** Ô tích vuông — cho chiều có ÍT giá trị và nhãn DÀI (loại mua hàng, stack). */
function CheckRow({
  name,
  facet,
  checked,
  bold = false,
}: {
  name: string;
  facet: Facet;
  checked: boolean;
  /**
   * Nhãn in Archivo 800. Dùng cho tên stack: "TypeScript", "PostgreSQL" là
   * TÊN RIÊNG của công nghệ, và bản thiết kế in chúng bằng nét tiêu đề để đọc
   * ra ngay giữa một cột toàn chữ thường.
   */
  bold?: boolean;
}) {
  return (
    <OptionLabel facet={facet} checked={checked} className="gap-2.5 px-2 py-1.75 text-sm">
      <input type="checkbox" name={name} value={facet.value} defaultChecked={checked} className="peer sr-only" />
      <Square />
      <span className={cx('min-w-0 flex-1 truncate', bold && 'font-heading font-extrabold')}>
        {facet.label}
      </span>
      <span className="tnum flex-none text-xs text-neutral-700 peer-checked:font-extrabold peer-checked:text-accent-700">
        {facet.count}
      </span>
    </OptionLabel>
  );
}

/**
 * Nhãn bấm được — cho chiều có NHIỀU giá trị và nhãn NGẮN. Xếp cuộn dòng nên
 * hai chục quận vẫn gọn trong một cột hẹp. Số tin đi LIỀN trong nhãn
 * ("Quận 7 · 17") chứ không tách cột.
 */
function Tags({ name, options, params }: { name: string; options: Facet[]; params: SearchParams }) {
  const selected = new Set(readParams(params, name));
  if (options.length === 0) return <NoData />;

  return (
    <div className="popwrap flex flex-wrap gap-1.5">
      {options.map((option) => {
        const checked = selected.has(option.value);
        const empty = option.count === 0 && !checked;
        return (
          <label
            key={option.value}
            title={option.hint}
            // Trạng thái chọn đi theo `:has(:checked)` chứ không theo URL: tích
            // xong là thấy ngay, không phải đợi bấm "Áp bộ lọc" mới biết mình
            // vừa chọn gì.
            className={cx(
              'tag tag-neutral cursor-pointer px-2.5 py-1.5 text-xs hover:bg-neutral-300',
              'has-checked:bg-accent has-checked:font-extrabold has-checked:text-white has-checked:hover:bg-accent-600',
              empty && 'opacity-45',
            )}
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={checked}
              className="peer sr-only"
            />
            <span className="peer-focus-visible:underline peer-focus-visible:underline-offset-2">
              {option.short ?? option.label} · {option.count}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** Công tắc bật/tắt một cờ — không có số đếm riêng, vì nó đổi PHẠM VI chứ không lọc. */
function Toggle({
  name,
  checked,
  hint,
  children,
}: {
  name: string;
  checked: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label
      title={hint}
      className="fopt flex cursor-pointer items-center gap-2.5 px-2 py-1.75 text-sm has-checked:bg-accent-100"
    >
      <input type="checkbox" name={name} value="1" defaultChecked={checked} className="peer sr-only" />
      <Square />
      <span className="peer-checked:font-extrabold peer-checked:text-accent-700">{children}</span>
    </label>
  );
}
