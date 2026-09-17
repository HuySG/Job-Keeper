import { cx } from './tone';

/**
 * Mèo Bae — linh vật pixel của bản v2.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Vì sao là dữ liệu điểm ảnh chứ không phải một file ảnh
 *
 * Mèo đổi TRẠNG THÁI theo đúng tình trạng dữ liệu, và mỗi trạng thái là một
 * nhóm điểm ảnh chuyển động riêng: mắt chớp, đuôi vẫy, chân vỗ khi đang quét,
 * chữ z bay lên khi ngủ. Một file PNG/GIF không tách được các nhóm đó ra để
 * tắt theo công tắc chuyển động, và không đổi được màu viền khi mèo nằm trên
 * nền tối. Dựng bằng `<rect>` thì cả hai đều là một thuộc tính CSS.
 *
 * Toạ độ chép ĐÚNG từ `Bae-Job v2.dc.html` bằng script, không vẽ lại tay. Mỗi
 * ô là `x.y.rộng.cao.màu`, màu là một chữ cái tra ở `PALETTE`.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Bốn dáng, mỗi dáng một nghĩa — đừng dùng lẫn:
 *
 *   · `head`  rảnh      — logo, lời nhắn thường
 *   · `sit`   chào      — hero đầu trang
 *   · `scan`  đang quét — chân vỗ theo nhịp
 *   · `sleep` rỗng/ngủ  — không có tin, hoặc giữa hai lượt quét
 *
 * Luôn `aria-hidden`: mèo là trang trí, câu chữ bên cạnh mới mang nghĩa.
 */

type PixelColor = 'k' | 'o' | 'd' | 'w' | 'p' | 'g';

/**
 * Màu lông, mũi, mắt CỐ ĐỊNH ở cả hai bảng màu — đổi bảng màu mà mèo đổi màu
 * lông là đổi nhầm chỗ. Chỉ màu viền (`k`) đổi, và đổi theo NỀN chứ không theo
 * bảng màu: viền mực trên nền sáng, viền kem trên nền tối.
 */
const PALETTE: Record<Exclude<PixelColor, 'k'>, string> = {
  o: 'var(--color-cat)',
  d: '#c26a22',
  w: '#fdfbf6',
  p: '#e8a0a0',
  g: '#4f9a72',
};

const INK = { dark: '#2f2a26', light: '#f5f1ea' } as const;

const PIXELS = {
  head: {
    base:
      '5.0.2.1.k 12.0.2.1.k 4.1.1.1.k 5.1.2.1.o 7.1.1.1.k 11.1.1.1.k 12.1.2.1.o 14.1.1.1.k ' +
      '3.2.1.1.k 4.2.2.1.o 6.2.1.1.d 7.2.1.1.k 10.2.1.1.k 11.2.1.1.d 12.2.2.1.o 14.2.1.1.k ' +
      '3.3.1.1.k 4.3.3.1.o 7.3.1.1.d 8.3.2.1.k 10.3.1.1.d 11.3.3.1.o 14.3.1.1.k 2.4.1.1.k ' +
      '3.4.12.1.o 15.4.1.1.k 2.5.1.1.k 3.5.1.1.o 4.5.1.1.d 5.5.7.1.o 12.5.1.1.d 13.5.1.1.o ' +
      '14.5.1.1.k 2.6.1.1.k 3.6.2.1.o 7.6.4.1.o 13.6.2.1.o 15.6.1.1.k 2.7.1.1.k 3.7.2.1.o 7.7.1.1.o ' +
      '8.7.2.1.w 10.7.1.1.o 13.7.2.1.o 15.7.1.1.k 2.8.1.1.k 3.8.4.1.o 7.8.1.1.w 8.8.2.1.p ' +
      '10.8.1.1.w 11.8.4.1.o 15.8.1.1.k 2.9.1.1.k 3.9.4.1.o 7.9.4.1.w 11.9.4.1.o 15.9.1.1.k ' +
      '3.10.1.1.k 4.10.3.1.o 7.10.4.1.w 11.10.3.1.o 14.10.1.1.k 4.11.1.1.k 5.11.3.1.o 8.11.4.1.w ' +
      '12.11.2.1.o 14.11.1.1.k 5.12.2.1.k 7.12.4.1.o 11.12.2.1.k 7.13.4.1.k ',
    eye:
      '5.6.2.1.g 11.6.2.1.g 5.7.2.1.g 11.7.2.1.g ',
    eyeClosed:
      '5.7.2.1.k 11.7.2.1.k ',
  },
  sit: {
    base:
      '8.0.2.1.k 15.0.2.1.k 7.1.1.1.k 8.1.2.1.o 10.1.1.1.k 14.1.1.1.k 15.1.2.1.o 17.1.1.1.k ' +
      '6.2.1.1.k 7.2.2.1.o 9.2.1.1.d 10.2.1.1.k 13.2.1.1.k 14.2.1.1.d 15.2.2.1.o 17.2.1.1.k ' +
      '6.3.1.1.k 7.3.3.1.o 10.3.1.1.d 11.3.2.1.k 13.3.1.1.d 14.3.3.1.o 17.3.1.1.k 5.4.1.1.k ' +
      '6.4.12.1.o 18.4.1.1.k 5.5.1.1.k 6.5.1.1.o 7.5.1.1.d 8.5.7.1.o 15.5.1.1.d 16.5.1.1.o ' +
      '17.5.1.1.k 5.6.1.1.k 6.6.2.1.o 10.6.4.1.o 16.6.2.1.o 18.6.1.1.k 5.7.1.1.k 6.7.2.1.o ' +
      '10.7.1.1.o 11.7.2.1.w 13.7.1.1.o 16.7.2.1.o 18.7.1.1.k 5.8.1.1.k 6.8.4.1.o 10.8.1.1.w ' +
      '11.8.2.1.p 13.8.1.1.w 14.8.4.1.o 18.8.1.1.k 5.9.1.1.k 6.9.4.1.o 10.9.4.1.w 14.9.4.1.o ' +
      '18.9.1.1.k 6.10.1.1.k 7.10.3.1.o 10.10.4.1.w 14.10.3.1.o 17.10.1.1.k 7.11.1.1.k 8.11.3.1.o ' +
      '11.11.4.1.w 15.11.2.1.o 17.11.1.1.k 8.12.2.1.k 10.12.4.1.o 14.12.2.1.k 10.13.4.1.k ' +
      '5.14.1.1.k 6.14.4.1.o 10.14.4.1.w 14.14.2.1.o 16.14.1.1.k 4.15.1.1.k 5.15.2.1.o 7.15.1.1.d ' +
      '8.15.2.1.o 10.15.4.1.w 14.15.2.1.o 16.15.1.1.k 4.16.1.1.k 5.16.5.1.o 10.16.5.1.w 15.16.1.1.o ' +
      '16.16.1.1.k 3.17.1.1.k 4.17.2.1.o 6.17.1.1.d 7.17.3.1.o 10.17.5.1.w 15.17.1.1.o 16.17.1.1.k ' +
      '3.18.1.1.k 4.18.6.1.o 10.18.5.1.w 15.18.1.1.o 16.18.1.1.k 3.19.1.1.k 4.19.2.1.o 6.19.1.1.d ' +
      '7.19.3.1.o 10.19.6.1.w 16.19.1.1.k 2.20.1.1.k 3.20.7.1.o 10.20.6.1.w 16.20.1.1.k 2.21.1.1.k ' +
      '3.21.2.1.o 5.21.1.1.d 6.21.4.1.o 10.21.6.1.w 16.21.1.1.k 2.22.1.1.k 3.22.7.1.o 10.22.6.1.w ' +
      '16.22.1.1.k 2.23.1.1.k 3.23.2.1.o 5.23.1.1.d 6.23.4.1.o 10.23.6.1.w 16.23.1.1.k 2.24.1.1.k ' +
      '3.24.7.1.o 10.24.6.1.w 16.24.1.1.k 2.25.2.1.k 4.25.5.1.o 9.25.6.1.w 15.25.2.1.k 3.26.14.1.k ',
    eye:
      '8.6.2.1.g 14.6.2.1.g 8.7.2.1.g 14.7.2.1.g ',
    eyeClosed:
      '8.7.2.1.k 14.7.2.1.k ',
    tail:
      '17.22.2.1.o 17.23.1.1.o 18.23.2.1.d 17.24.2.1.o 19.24.2.1.d 17.25.2.1.o 19.25.2.1.d ' +
      '17.26.2.1.d 19.26.2.1.o ',
  },
  sleep: {
    base:
      '4.0.2.1.k 12.0.2.1.k 3.1.1.1.k 4.1.2.1.o 6.1.1.1.k 11.1.1.1.k 12.1.2.1.o 14.1.1.1.k ' +
      '2.2.1.1.k 3.2.2.1.o 5.2.1.1.d 6.2.1.1.k 10.2.1.1.k 11.2.1.1.d 12.2.2.1.o 14.2.1.1.k ' +
      '2.3.1.1.k 3.3.3.1.o 6.3.1.1.d 7.3.3.1.k 10.3.1.1.d 11.3.3.1.o 14.3.1.1.k 1.4.1.1.k ' +
      '2.4.13.1.o 15.4.1.1.k 1.5.1.1.k 2.5.1.1.o 3.5.1.1.d 4.5.9.1.o 13.5.1.1.d 14.5.1.1.o ' +
      '15.5.1.1.k 1.6.1.1.k 2.6.2.1.o 6.6.5.1.o 13.6.2.1.o 15.6.1.1.k 1.7.1.1.k 2.7.2.1.o 6.7.2.1.o ' +
      '8.7.2.1.w 10.7.1.1.o 13.7.2.1.o 15.7.1.1.k 1.8.1.1.k 2.8.5.1.o 7.8.1.1.w 8.8.2.1.p ' +
      '10.8.1.1.w 11.8.4.1.o 15.8.4.1.k 1.9.1.1.k 2.9.6.1.o 8.9.4.1.w 12.9.7.1.o 19.9.2.1.k ' +
      '2.10.1.1.k 3.10.5.1.o 8.10.5.1.w 13.10.8.1.o 21.10.1.1.k 2.11.1.1.k 3.11.3.1.o 6.11.1.1.d ' +
      '7.11.1.1.o 8.11.7.1.w 15.11.3.1.o 18.11.1.1.d 19.11.2.1.o 21.11.1.1.k 1.12.2.1.k 3.12.5.1.o ' +
      '8.12.8.1.w 16.12.5.1.o 21.12.2.1.k 1.13.1.1.k 2.13.6.1.o 8.13.9.1.w 17.13.5.1.o 22.13.1.1.k ' +
      '1.14.2.1.k 3.14.6.1.o 9.14.8.1.w 17.14.4.1.o 21.14.2.1.k 2.15.2.1.k 4.15.6.1.o 10.15.6.1.w ' +
      '16.15.3.1.o 19.15.2.1.k 4.16.16.1.k 4.6.2.1.k 11.6.2.1.k 4.7.2.1.k 11.7.2.1.k ',
    tail:
      '21.15.2.1.o 23.15.1.1.d 20.16.2.1.d 22.16.2.1.o ',
    zzz:
      '19.5.1.1.k 21.3.1.1.k 22.1.1.1.k ',
  },
  paws:
    '2.13.3.1.o 13.13.3.1.o ',
} as const;

type Rect = readonly [x: number, y: number, w: number, h: number, color: PixelColor];

/** Giải mã một lần lúc nạp module — mỗi trang vẽ mèo vài lần. */
function decode(source: string): Rect[] {
  return source
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [x, y, w, h, color] = token.split('.');
      return [Number(x), Number(y), Number(w), Number(h), color as PixelColor] as const;
    });
}

const SHAPES = {
  head: {
    base: decode(PIXELS.head.base),
    eye: decode(PIXELS.head.eye),
    eyeClosed: decode(PIXELS.head.eyeClosed),
  },
  sit: {
    base: decode(PIXELS.sit.base),
    eye: decode(PIXELS.sit.eye),
    eyeClosed: decode(PIXELS.sit.eyeClosed),
    tail: decode(PIXELS.sit.tail),
  },
  sleep: {
    base: decode(PIXELS.sleep.base),
    tail: decode(PIXELS.sleep.tail),
    zzz: decode(PIXELS.sleep.zzz),
  },
  paws: decode(PIXELS.paws),
};

/** Khung vẽ của từng dáng, theo đơn vị điểm ảnh. */
const VIEWBOX = { head: [18, 14], scan: [18, 14], sit: [24, 27], sleep: [24, 17] } as const;

export type MascotPose = keyof typeof VIEWBOX;

export function Mascot({
  pose,
  width,
  ink = 'dark',
  motion,
  zzz = false,
  className,
}: {
  pose: MascotPose;
  /** Chiều rộng tính bằng px; chiều cao tự suy theo tỉ lệ khung vẽ. */
  width: number;
  /** `light` khi mèo nằm trên nền tối (`bg-text`). */
  ink?: keyof typeof INK;
  /**
   * Chuyển động của CẢ con mèo. Mặc định theo dáng: `sit`/`head` nhấp nhô,
   * `sleep` thở. `shake` cho lời cảnh báo, `none` khi mèo đứng cạnh chữ dài
   * mà nhấp nhô sẽ làm rối mắt.
   */
  motion?: 'bob' | 'breathe' | 'shake' | 'none';
  /** Chỉ cho dáng `sleep`: ba chữ z bay lên. */
  zzz?: boolean;
  className?: string;
}) {
  const [vw, vh] = VIEWBOX[pose];
  const height = Math.round((width * vh) / vw);
  const stroke = INK[ink];

  const paint = (rects: Rect[], rectClass?: (index: number) => string | undefined) =>
    rects.map(([x, y, w, h, color], index) => (
      <rect
        key={`${x}.${y}.${index}`}
        x={x}
        y={y}
        width={w}
        height={h}
        fill={color === 'k' ? stroke : PALETTE[color]}
        className={rectClass?.(index)}
      />
    ));

  const whole = motion ?? (pose === 'sleep' ? 'breathe' : pose === 'sit' ? 'bob' : 'none');
  const motionClass =
    whole === 'bob' ? 'cat-bob' : whole === 'breathe' ? 'breathe' : whole === 'shake' ? 'shake' : undefined;

  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      viewBox={`0 0 ${vw} ${vh}`}
      shapeRendering="crispEdges"
      className={cx('block flex-none', motionClass, className)}
    >
      {pose === 'sleep' ? (
        <>
          {paint(SHAPES.sleep.base)}
          <g className="px-tail">{paint(SHAPES.sleep.tail)}</g>
          {zzz && <g>{paint(SHAPES.sleep.zzz, (i) => `z${i + 1}`)}</g>}
        </>
      ) : (
        <>
          {paint(pose === 'sit' ? SHAPES.sit.base : SHAPES.head.base)}
          <g className="px-eye">{paint(pose === 'sit' ? SHAPES.sit.eye : SHAPES.head.eye)}</g>
          <g className="px-eyec">
            {paint(pose === 'sit' ? SHAPES.sit.eyeClosed : SHAPES.head.eyeClosed)}
          </g>
          {pose === 'sit' && <g className="px-tail">{paint(SHAPES.sit.tail)}</g>}
          {pose === 'scan' && <g>{paint(SHAPES.paws, (i) => `paw${i + 1}`)}</g>}
        </>
      )}
    </svg>
  );
}
