'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { BarRow } from '@/components/ui/bar-row';
import { Glyph } from '@/components/ui/glyph';
import { Mascot } from '@/components/ui/mascot';
import { IdleDot, LiveDot } from '@/components/ui/status';
import { cx } from '@/components/ui/tone';

/**
 * Bộ thành phần của Bae-Job — mỗi khối là một thành phần THẬT, bấm thử được,
 * kèm đúng đoạn chuyển động nó dùng trong app.
 *
 * Đây là trang phía trình duyệt duy nhất có trạng thái riêng. Phần còn lại của
 * app dựng trên máy chủ và chạy không cần JavaScript; ở đây thì không tránh
 * được — tab, công tắc, hộp thoại chính là thứ đang được trình diễn.
 *
 * Nội dung trong các khối là CHỮ MẪU, cố ý: trang này dạy hình dạng và nhịp
 * chuyển động, không nói về dữ liệu thật. Số thật nằm ở năm trang chính.
 */

const REPLAY_EVENT = 'bj:replay';

/** Nút "Chạy lại toàn bộ" ở hero — nằm ngoài lưới nên nói chuyện bằng sự kiện. */
export function ReplayButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(REPLAY_EVENT))}
      className="btn btn-primary h-11 gap-2 px-4.5"
    >
      <Glyph name="replay" size={16} />
      Chạy lại toàn bộ
    </button>
  );
}

export function ComponentGallery({ brand }: { brand: { label: string; swatch: string } }) {
  // Đổi `run` là dựng lại cả lưới: mọi animation CSS chạy lại từ đầu, số chạy
  // đếm lại từ 0, khối hiện-dần được gài lại.
  const [run, setRun] = useState(0);

  useEffect(() => {
    const replay = () => setRun((value) => value + 1);
    window.addEventListener(REPLAY_EVENT, replay);
    return () => window.removeEventListener(REPLAY_EVENT, replay);
  }, []);

  return <Grid key={run} brand={brand} />;
}

function Grid({ brand }: { brand: { label: string; swatch: string } }) {
  const ref = useReveal<HTMLDivElement>();
  const [tab, setTab] = useState(0);
  const [switchOn, setSwitchOn] = useState(false);
  const [checked, setChecked] = useState(true);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(false);
  const [dialog, setDialog] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const fireToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setToast(true);
    toastTimer.current = setTimeout(() => setToast(false), 3200);
  }, []);

  const tabs = ['Khớp chắc', 'Khớp yếu', 'Đã loại'];
  const tabText = [
    '318 tin vào thẳng danh sách của bạn.',
    '614 tin gần ngành, đang tắt.',
    '107 tin bị từ khoá loại trừ chặn lại.',
  ];

  return (
    <div ref={ref} className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-stretch gap-4.5 p-4 sm:p-6">
      <Demo group="Hành động" title="Nút" note="Nhấc 1px khi trỏ vào, lún 1px khi bấm. Nút chính thêm bóng.">
        <button type="button" className="btn btn-primary gap-2">
          Mở tin gốc <Glyph name="external" size={14} />
        </button>
        <button type="button" className="btn btn-secondary gap-2">
          <Glyph name="bookmark" size={14} /> Lưu tin
        </button>
        <button type="button" className="btn btn-ghost">
          Bỏ lọc
        </button>
        <button type="button" className="btn btn-secondary btn-icon size-9.5" aria-label="Lưu">
          <Glyph name="bookmark" size={15} />
        </button>
      </Demo>

      <Demo group="Hành động" title="Nút đang chạy" note="Ô vuông quay theo 8 bước — nhịp pixel, không quay mượt.">
        <button type="button" className="btn btn-primary pointer-events-none gap-2.5">
          <span className="spinsq block size-3.25 border-3 border-current border-r-transparent border-b-transparent" />
          Đang quét 6 sàn…
        </button>
        <button type="button" className="btn btn-secondary" disabled>
          Chờ kết quả
        </button>
      </Demo>

      <Demo group="Nhãn" title="Thẻ lọc" note="Cả dãy nảy vào lần lượt cách nhau 40ms; trỏ vào thì nhấc lên.">
        <div className="popwrap flex flex-wrap gap-2">
          <button type="button" className="tag tag-solid cursor-pointer px-2.75 py-1.75">
            mua hàng · 189 ✕
          </button>
          <button type="button" className="tag tag-neutral cursor-pointer px-2.75 py-1.75">
            cung ứng · 122
          </button>
          <button type="button" className="tag tag-neutral cursor-pointer px-2.75 py-1.75">
            vật tư · 96
          </button>
          <button type="button" className="tag tag-outline cursor-pointer px-2.75 py-1.75">
            + thêm từ khoá
          </button>
        </div>
      </Demo>

      <Demo group="Biểu thị dữ liệu" title="Thanh đếm" note="Mọc từ trái theo 0,8s, cùng một hàm giảm tốc với thẻ tin.">
        <div className="flex w-full flex-col gap-2.5 text-[13px]">
          <BarRow label="15 – 25 tr" count={55} ratio={1} fill="accent" labelWidth={86} countWidth={26} className="[&_.bar-count]:font-extrabold" />
          <BarRow label="25 – 40 tr" count={25} ratio={0.45} delay={0.08} labelWidth={86} countWidth={26} className="[&_.bar-count]:font-extrabold" />
        </div>
      </Demo>

      <Demo group="Biểu thị dữ liệu" title="Số chạy" note="Đếm từ 0 lên số thật trong 1,1s, chữ số cố định bề rộng nên không giật.">
        <div className="flex flex-wrap gap-6.5">
          <div>
            <p className="mb-1.25 text-xs text-neutral-700">Tin còn hiệu lực</p>
            <CountUp to={2103} className="text-[34px]" />
          </div>
          <div>
            <p className="mb-1.25 text-xs text-neutral-700">Đúng ngành</p>
            <CountUp to={318} className="text-[34px] text-accent-700" />
          </div>
        </div>
      </Demo>

      <Demo group="Chờ dữ liệu" title="Khung xương" note="Vệt sáng chạy ngang 1,5s. Bấm để xem lúc dữ liệu về.">
        <div className="w-full" aria-busy={loading}>
          {loading ? (
            <div className="flex flex-col gap-2.5">
              <span className="skel h-4.5 w-[72%]" />
              <span className="skel h-3.25 w-[48%]" />
              <span className="skel h-3.25 w-[58%]" />
            </div>
          ) : (
            <div className="rise flex flex-col gap-1.5">
              <p className="font-heading text-[17px] font-extrabold">Purchasing Staff</p>
              <p className="text-[13px] text-neutral-700">Vietmap · Quận 5 · 2+ năm KN</p>
              <p className="font-heading text-[15px] font-extrabold text-accent-700">13–17 tr</p>
            </div>
          )}
          <button type="button" onClick={() => setLoading((value) => !value)} className="btn btn-ghost mt-3.5 text-xs">
            Đổi trạng thái
          </button>
        </div>
      </Demo>

      <Demo group="Lựa chọn" title="Tab có thanh trượt" note="Thanh xanh trượt sang tab được chọn trong 0,26s.">
        <div className="w-full">
          <div role="tablist" className="relative flex border-b-2 border-divider">
            {tabs.map((label, index) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={tab === index}
                onClick={() => setTab(index)}
                className={cx(
                  'flex-1 cursor-pointer px-1 py-2.5 text-center text-[13px] font-extrabold transition-colors',
                  tab === index ? 'text-accent-800' : 'text-neutral-700',
                )}
              >
                {label}
              </button>
            ))}
            <span
              aria-hidden
              className="absolute -bottom-0.5 left-0 h-0.75 w-1/3 bg-accent transition-transform duration-[260ms] ease-(--ease-out-soft)"
              style={{ transform: `translateX(${tab * 100}%)` }}
            />
          </div>
          <p role="tabpanel" className="pt-3.5 text-[13px] text-neutral-800">
            {tabText[tab]}
          </p>
        </div>
      </Demo>

      <Demo group="Lựa chọn" title="Công tắc & hộp kiểm" note="Núm trượt 0,2s; dấu kiểm được vẽ nét trong 0,4s.">
        <div className="flex w-full flex-col gap-4">
          <button
            type="button"
            role="switch"
            aria-checked={switchOn}
            onClick={() => setSwitchOn((value) => !value)}
            className="flex cursor-pointer items-center gap-3 text-sm"
          >
            <span className={cx('block h-6 w-11 flex-none p-0.75 transition-colors', switchOn ? 'bg-accent' : 'bg-neutral-400')}>
              <span className={cx('block size-4.5 bg-white transition-transform duration-200', switchOn && 'translate-x-5')} />
            </span>
            Bật cả từ khoá khớp yếu
          </button>
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={() => setChecked((value) => !value)}
            className="flex cursor-pointer items-center gap-3 text-sm"
          >
            <span
              className={cx(
                'flex size-5 flex-none items-center justify-center border-2 transition-colors',
                checked ? 'border-accent bg-accent' : 'border-neutral-500 bg-transparent',
              )}
            >
              {checked && (
                <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="square">
                  <path className="drawcheck" d="M5 12l4 4 10-10" />
                </svg>
              )}
            </span>
            Chỉ tin đã kiểm còn-sống
          </button>
        </div>
      </Demo>

      <Demo
        group="Nhập liệu"
        title="Ô tìm kiếm"
        note="Viền đổi sang xanh đậm 0,14s khi bấm vào, không dùng viền xanh mặc định của trình duyệt."
      >
        <label className="relative w-full">
          <span className="sr-only">Tìm thử</span>
          <Glyph name="search" size={16} stroke="var(--color-neutral-600)" className="absolute top-1/2 left-3 -translate-y-1/2" />
          <input type="search" placeholder="Chức danh, công ty, từ khoá…" className="input h-10.5 bg-neutral-100 pl-9" />
        </label>
      </Demo>

      <Demo group="Danh sách" title="Dòng tin" note="Trôi lên so le 60ms khi vào màn; trỏ vào hiện vạch xanh bên trái.">
        <div className="rise-list flex w-full flex-col border-b border-divider">
          {[
            ['Senior Sourcing Executive', 'Thủ Đức · 25–32 tr'],
            ['Chuyên viên Thu mua', 'Quận 7 · 18–22 tr'],
            ['Nhân viên Mua hàng', 'Không ghi quận · 12–15 tr'],
          ].map(([title, meta]) => (
            <div key={title} className="jrow cursor-pointer border-t border-divider px-2.5 py-3">
              <p className="font-heading text-sm font-extrabold">{title}</p>
              <p className="text-xs text-neutral-700">{meta}</p>
            </div>
          ))}
        </div>
      </Demo>

      <Demo group="Phản hồi" title="Thông báo nổi" note="Trượt lên 14px kèm mờ dần, tự ẩn sau 3,2s.">
        <div className="w-full">
          <button type="button" onClick={fireToast} className="btn btn-secondary gap-2">
            <Glyph name="bookmark" size={14} /> Lưu tin này
          </button>
          <div role="status" aria-live="polite">
            {toast && (
              <div className="toast mt-3.5 flex items-center gap-2.5 bg-text px-3.5 py-3 text-[13px] text-neutral-100">
                <span className="live-dot size-2 bg-accent-400" />
                Đã lưu · mèo sẽ kiểm tin này mỗi ngày
              </div>
            )}
          </div>
        </div>
      </Demo>

      <Demo group="Phản hồi" title="Hộp thoại" note="Nền mờ dần 0,2s, khung trượt lên 16px trong 0,3s.">
        <button type="button" onClick={() => setDialog(true)} className="btn btn-secondary">
          Xoá từ khoá “mua hàng”
        </button>
        {dialog && <ConfirmDialog onClose={() => setDialog(false)} />}
      </Demo>

      <Demo group="Trình bày" title="Khối gập" note="Chiều cao mở trong 0,3s, mũi tên quay 180°.">
        <div className="w-full">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex w-full cursor-pointer items-center gap-2.5 border-t-2 border-divider py-3 text-left"
          >
            <span className="flex-1 font-heading text-sm font-extrabold">Vì sao tin này khớp ngành?</span>
            <span className={cx('block transition-transform duration-[260ms]', open && 'rotate-180')}>
              <Glyph name="chevronDown" size={16} />
            </span>
          </button>
          <div
            className="overflow-hidden transition-[max-height] duration-300 ease-(--ease-out-soft)"
            style={{ maxHeight: open ? 160 : 0 }}
          >
            <p className="mb-3 text-[13px] leading-[1.6] text-neutral-800">
              Tiêu đề chứa <strong>mua hàng</strong> và <strong>purchasing</strong> — cả hai đều nằm trong nhóm
              khớp chắc, nên tin vào danh sách mà không cần bạn soi lại.
            </p>
          </div>
        </div>
      </Demo>

      <Demo group="Trạng thái" title="Chấm còn-sống" note="Nhấp nháy 1,9s kèm vòng sóng lan ra rồi tắt.">
        <div className="flex w-full flex-col gap-3.5">
          <span className="inline-flex items-center gap-2.5 text-[13px] font-extrabold text-live-700">
            <LiveDot size={9} /> Đã kiểm 3 giờ trước · còn mở
          </span>
          <span className="inline-flex items-center gap-2.5 text-[13px] text-neutral-700">
            <IdleDot size={9} /> Chưa kiểm còn-sống
          </span>
        </div>
      </Demo>

      <Demo
        group="Linh vật"
        title="Bốn trạng thái của mèo Bae"
        note="Nhấp nhô khi rảnh · rung khi cảnh báo · thở và nhả zzz khi rỗng · vỗ chân khi đang quét."
      >
        <div className="flex w-full flex-wrap items-end gap-5.5">
          <Pose label="rảnh">
            <Mascot pose="sit" width={86} />
          </Pose>
          <Pose label="cảnh báo">
            <Mascot pose="head" width={74} motion="shake" />
          </Pose>
          <Pose label="đang quét">
            <Mascot pose="scan" width={74} />
          </Pose>
          <Pose label="rỗng / ngủ">
            <Mascot pose="sleep" width={110} zzz />
          </Pose>
        </div>
      </Demo>

      <Demo group="Nền" title="Trường màu & vạch quét" note="Mỗi khối pastel có một vạch mảnh quét ngang 7s như đầu đọc.">
        <div className="brand-field w-full px-4.5 py-5.5">
          <p className="mb-2 text-[11px] tracking-[0.12em] text-accent-800 uppercase">
            {brand.label} · {brand.swatch}
          </p>
          <p className="font-heading text-2xl leading-[1.1] font-extrabold">318 tin đúng ngành</p>
        </div>
      </Demo>

      <Demo
        group="Chuyển màn"
        title="Vào màn so le"
        note="Ô số liệu và thẻ tin trôi lên cách nhau 60ms, nội dung dưới màn hiện dần khi cuộn tới."
      >
        <div className="rise-list flex w-full flex-wrap border-t-2 border-accent-700 [&>*:not(:last-child)]:border-r [&>*:not(:last-child)]:border-divider">
          {[
            ['Tin', '318'],
            ['Trung vị', '20,2'],
            ['Sàn', '2/6'],
          ].map(([label, value], index) => (
            <div key={label} className={cx('flex-[1_1_120px] py-3.5', index === 0 ? 'pr-3.5' : 'px-3.5')}>
              <p className="mb-1.25 text-[11px] text-neutral-700">{label}</p>
              <p className="font-heading text-2xl leading-none font-extrabold">{value}</p>
            </div>
          ))}
        </div>
      </Demo>
    </div>
  );
}

function Demo({ group, title, note, children }: { group: string; title: string; note: string; children: ReactNode }) {
  return (
    <section className="demo reveal flex flex-col border-2 border-divider bg-bg">
      <header className="border-b-2 border-divider px-4.5 pt-3.5 pb-3">
        <p className="mb-1.5 text-[10px] tracking-[0.12em] text-accent-700 uppercase">{group}</p>
        <h2 className="mb-1 text-base">{title}</h2>
        <p className="text-xs leading-normal text-neutral-700">{note}</p>
      </header>
      <div className="flex flex-1 flex-wrap items-center gap-3 px-4.5 py-5">{children}</div>
    </section>
  );
}

function Pose({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="text-center">
      <div className="swatch">{children}</div>
      <p className="mt-2 text-[11px] text-neutral-700">{label}</p>
    </div>
  );
}

/** Hộp thoại xác nhận — đóng bằng Esc, bằng nền mờ, hoặc bằng hai nút. */
function ConfirmDialog({ onClose }: { onClose: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="dlg-back fixed inset-0 z-40 flex items-center justify-center bg-[rgb(32_30_29/0.55)] p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-dialog-title"
        className="dlg w-full max-w-105 bg-bg shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3.5 px-5.5 pt-5.5">
          <Mascot pose="head" width={44} motion="shake" />
          <div>
            <h2 id="demo-dialog-title" className="mb-2 text-[19px]">
              Xoá “mua hàng” khỏi từ điển?
            </h2>
            <p className="text-sm leading-[1.55] text-neutral-800">
              Danh sách của bạn sẽ mất 189 tin. Mình không xoá tin nào, chỉ thôi chấm điểm theo từ này.
            </p>
          </div>
        </div>
        <div className="flex gap-2.5 px-5.5 pt-5 pb-5.5">
          <button ref={confirmRef} type="button" onClick={onClose} className="btn btn-primary">
            Xoá từ khoá
          </button>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Thôi
          </button>
        </div>
      </div>
    </div>
  );
}

/** Chuyển động đang bị tắt — bởi công tắc của app hoặc cài đặt của máy. */
function motionOff(): boolean {
  return (
    document.documentElement.dataset.motion === 'off' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Số đếm từ 0 lên `to` trong 1,1s, giảm tốc bậc ba. */
function CountUp({ to, className }: { to: number; className?: string }) {
  const [value, setValue] = useState(to);

  useEffect(() => {
    if (motionOff()) return;
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 1100);
      setValue(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    setValue(0);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [to]);

  return (
    <p className={cx('tnum font-heading leading-none font-extrabold', className)}>
      {value.toLocaleString('vi-VN')}
    </p>
  );
}

/**
 * Khối `.reveal` hiện dần khi cuộn tới.
 *
 * Gài `armed` bằng JavaScript chứ không đặt sẵn trong HTML: không có JavaScript
 * thì khối vẫn hiện đủ. Lưới an toàn 1,4s gỡ gài mọi khối còn sót — trình duyệt
 * chụp ảnh trang hay khung iframe thấp có thể không bao giờ báo "đã vào màn".
 */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || motionOff()) return;
    const nodes = [...root.querySelectorAll<HTMLElement>('.reveal')];
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }),
      { rootMargin: '0px 0px -6% 0px', threshold: 0.05 },
    );
    nodes.forEach((node) => {
      node.classList.add('armed');
      observer.observe(node);
    });
    const safety = setTimeout(() => nodes.forEach((node) => node.classList.add('in')), 1400);
    return () => {
      observer.disconnect();
      clearTimeout(safety);
    };
  }, []);

  return ref;
}
