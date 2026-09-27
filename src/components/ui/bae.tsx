import { cx } from './tone';

/**
 * Bae — cô gái áo dài, linh vật thứ hai của bản v2.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Vì sao có người thứ hai bên cạnh mèo
 *
 * Mèo nói về DỮ LIỆU: nó ngủ khi kho rỗng, vỗ chân khi đang quét, nói thật về
 * độ tươi. Bae nói về CÔNG VIỆC ĐANG LÀM HỘ BẠN: cô ấy quạt trong lúc chờ,
 * đọc khi có tin cần soi lại, vẫy tay khi lưu được tin. Hai giọng khác nhau,
 * nên là hai hình khác nhau — gộp vào một con mèo thì mất cả hai.
 *
 * Quy ước dựng hình: mèo LUÔN đứng bên trái và thấp hơn Bae, để mắt người đọc
 * đi từ mèo sang Bae rồi mới tới chữ.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Toạ độ chép từ `sprite-girl.json` trong bộ bàn giao, bằng script, không vẽ
 * lại tay. Mỗi ô là `x.y.rộng.cao.màu`, màu tra ở `PALETTE`.
 *
 * MỘT CHỖ LỆCH CÓ CHỦ Ý so với bản thiết kế. Trong `sprite-girl.json`, lớp
 * `eyesShut` chứa 4 ô mắt nhắm CỘNG 18 ô `#e9e2d5` chạy dọc thân áo từ y22
 * xuống y40. Lớp đó chỉ hiện đúng 0,1 giây mỗi nhịp nháy mắt, nên ở bản
 * thiết kế tà áo dài thủng một rãnh 2 điểm ảnh suốt chiều cao, và rãnh ấy chỉ
 * được vá trong chớp mắt. Đó là lỗi gói lớp lúc xuất hình, không phải ý đồ:
 * 18 ô ấy nằm ĐÈ LÊN VÙNG TRỐNG của lớp nền, không đè lên ô nào có sẵn. Ở
 * đây chúng được trả về lớp nền và hiện thường trực; nhóm nháy mắt chỉ còn
 * đúng 4 ô mắt.
 * ─────────────────────────────────────────────────────────────────────────────
 */

type PixelColor = 'k' | 'h' | 'w' | 'o' | 's' | 'd' | 'r' | 'a' | 'e' | 'p' | 'i' | 'm' | 'g';

/**
 * Màu của Bae CỐ ĐỊNH ở cả hai bảng màu, giống bộ lông mèo: đổi bảng màu mà áo
 * dài đổi màu là đổi nhầm chỗ. Áo trắng nẹp đỏ, hoa hồng cài tai, lá xanh.
 */
const PALETTE: Record<PixelColor, string> = {
  k: '#2b2724', // viền
  h: '#251f24', // tóc
  w: '#fdfbf7', // áo dài
  o: '#f7e6c6', // giấy quạt
  s: '#f9dcc0', // da
  d: '#e9e2d5', // bóng áo
  r: '#c4362a', // nẹp đỏ
  a: '#9c2a20', // đỏ sẫm
  e: '#e6b895', // bóng da
  p: '#f4a8bd', // hoa
  i: '#ffffff', // đốm sáng trong mắt
  m: '#c8544f', // môi
  g: '#3f8f63', // lá
};

const PIXELS = {
  base:
    '10.0.2.1.k 12.0.9.1.h 21.0.2.1.k 5.1.2.1.k 8.1.2.1.k 10.1.13.1.h 23.1.1.1.k 4.2.1.1.k ' +
    '5.2.2.1.p 7.2.1.1.k 8.2.2.1.g 10.2.14.1.h 24.2.1.1.k 3.3.1.1.k 4.3.2.1.p 6.3.1.1.o ' +
    '7.3.1.1.p 8.3.1.1.k 9.3.16.1.h 25.3.3.1.k 3.4.1.1.k 4.4.1.1.p 5.4.1.1.o 6.4.2.1.p 8.4.1.1.k ' +
    '9.4.19.1.h 28.4.1.1.k 4.5.1.1.k 5.5.2.1.p 7.5.1.1.k 8.5.20.1.h 28.5.1.1.k 5.6.2.1.k ' +
    '7.6.21.1.h 28.6.1.1.k 4.7.1.1.k 5.7.4.1.h 10.7.12.1.s 22.7.1.1.e 24.7.4.1.h 28.7.1.1.k ' +
    '4.8.1.1.k 5.8.4.1.h 9.8.1.1.s 13.8.7.1.s 23.8.1.1.e 24.8.4.1.h 28.8.1.1.k 4.9.1.1.k ' +
    '5.9.4.1.h 9.9.1.1.s 13.9.7.1.s 23.9.1.1.e 24.9.4.1.h 28.9.1.1.k 4.10.1.1.k 5.10.4.1.h ' +
    '13.10.7.1.s 24.10.4.1.h 28.10.1.1.k 4.11.1.1.k 5.11.4.1.h 9.11.1.1.s 13.11.7.1.s ' +
    '23.11.1.1.e 24.11.4.1.h 28.11.1.1.k 4.12.1.1.k 5.12.4.1.h 9.12.1.1.s 13.12.7.1.s ' +
    '23.12.1.1.e 24.12.4.1.h 28.12.1.1.k 4.13.1.1.k 5.13.4.1.h 9.13.7.1.s 16.13.1.1.e ' +
    '17.13.5.1.s 22.13.2.1.e 24.13.4.1.h 28.13.1.1.k 4.14.1.1.k 5.14.3.1.h 8.14.3.1.p ' +
    '11.14.11.1.s 22.14.3.1.p 25.14.3.1.h 28.14.1.1.k 4.15.1.1.k 5.15.4.1.h 9.15.6.1.s ' +
    '15.15.3.1.m 18.15.4.1.s 22.15.2.1.e 24.15.4.1.h 28.15.1.1.k 4.16.1.1.k 5.16.4.1.h ' +
    '9.16.1.1.k 10.16.6.1.s 16.16.1.1.m 17.16.5.1.s 22.16.1.1.e 23.16.1.1.k 24.16.4.1.h ' +
    '28.16.1.1.k 4.17.1.1.k 5.17.4.1.h 9.17.2.1.k 11.17.11.1.s 27.17.1.1.h 28.17.1.1.k ' +
    '4.18.1.1.k 5.18.2.1.h 10.18.2.1.k 12.18.9.1.s 21.18.1.1.k 4.19.1.1.k 5.19.3.1.h 11.19.1.1.h ' +
    '12.19.9.1.a 21.19.1.1.h 4.20.1.1.k 5.20.3.1.h 11.20.1.1.w 12.20.9.1.r 21.20.1.1.w ' +
    '5.21.1.1.k 6.21.1.1.h 7.21.1.1.k 11.21.2.1.w 13.21.1.1.k 14.21.5.1.r 6.22.2.1.k 11.22.2.1.w ' +
    '13.22.1.1.k 14.22.3.1.w 7.23.1.1.k 11.23.2.1.w 13.23.1.1.k 14.23.3.1.w 7.24.1.1.k ' +
    '11.24.2.1.w 13.24.1.1.k 14.24.2.1.w 16.24.1.1.a 7.25.1.1.k 8.25.1.1.w 12.25.1.1.w ' +
    '13.25.1.1.k 14.25.4.1.w 7.26.1.1.k 8.26.1.1.w 12.26.1.1.w 13.26.1.1.k 14.26.5.1.w ' +
    '21.26.1.1.k 7.27.1.1.k 8.27.1.1.w 12.27.1.1.w 13.27.1.1.k 14.27.2.1.w 16.27.1.1.a ' +
    '17.27.3.1.w 8.28.1.1.k 12.28.1.1.w 13.28.1.1.k 14.28.6.1.w 12.29.3.1.w 15.29.3.1.r ' +
    '18.29.2.1.w 22.29.1.1.k 23.29.1.1.h 24.29.1.1.k 11.30.1.1.s 12.30.3.1.w 15.30.3.1.r ' +
    '18.30.2.1.w 22.30.2.1.k 11.31.1.1.k 12.31.3.1.w 15.31.3.1.r 18.31.2.1.w 22.31.2.1.k ' +
    '11.32.4.1.w 15.32.3.1.r 18.32.3.1.w 23.32.1.1.k 10.33.5.1.w 15.33.3.1.r 18.33.3.1.w ' +
    '23.33.1.1.k 10.34.5.1.w 15.34.3.1.r 18.34.3.1.w 23.34.1.1.k 8.35.1.1.k 9.35.6.1.w ' +
    '15.35.3.1.r 18.35.4.1.w 24.35.1.1.k 8.36.1.1.k 9.36.6.1.d 15.36.3.1.r 18.36.6.1.d ' +
    '24.36.1.1.k 9.37.1.1.k 10.37.6.1.w 16.37.1.1.k 17.37.4.1.w 23.37.1.1.k 9.38.1.1.k ' +
    '10.38.6.1.w 16.38.1.1.k 17.38.4.1.w 23.38.1.1.k 9.39.1.1.k 10.39.6.1.w 16.39.1.1.k ' +
    '17.39.4.1.w 23.39.1.1.k 9.40.1.1.k 10.40.6.1.w 16.40.1.1.k 17.40.4.1.w 23.40.1.1.k ' +
    '10.41.6.1.k 17.41.6.1.k 10.42.6.1.k 17.42.6.1.k 17.22.2.1.d 17.23.2.1.d 17.24.2.1.d ' +
    '18.25.2.1.d 19.26.2.1.d 20.27.2.1.d 20.28.2.1.d 20.29.2.1.d 20.30.2.1.d 20.31.2.1.d ' +
    '21.32.2.1.d 21.33.2.1.d 21.34.2.1.d 22.35.2.1.d 21.37.2.1.d 21.38.2.1.d 21.39.2.1.d ' +
    '21.40.2.1.d ',
  braid:
    '7.18.1.1.k 8.18.2.1.h 8.19.1.1.k 9.19.2.1.h 8.20.1.1.k 9.20.2.1.h 8.21.1.1.k 9.21.2.1.h ' +
    '8.22.1.1.k 9.22.2.1.h 8.23.1.1.k 9.23.2.1.h 8.24.1.1.k 9.24.2.1.h 9.25.1.1.k 10.25.2.1.h ' +
    '9.26.1.1.k 10.26.2.1.h 9.27.1.1.k 10.27.2.1.h 9.28.1.1.k 10.28.2.1.h 9.29.1.1.k 10.29.2.1.h ' +
    '8.30.1.1.k 9.30.2.1.h 8.31.1.1.k 9.31.2.1.h 7.32.2.1.k 9.32.2.1.h 6.33.1.1.k 7.33.3.1.r ' +
    '6.34.1.1.k 7.34.3.1.r 7.35.1.1.k ',
  fan:
    '22.16.2.1.k 21.17.7.1.k 22.18.6.1.r 28.18.2.1.k 22.19.1.1.r 23.19.1.1.o 24.19.1.1.a ' +
    '25.19.1.1.o 26.19.3.1.r 29.19.2.1.k 22.20.2.1.o 24.20.1.1.a 25.20.1.1.o 26.20.1.1.a ' +
    '27.20.1.1.o 28.20.3.1.r 31.20.1.1.k 19.21.1.1.k 20.21.2.1.w 22.21.1.1.o 23.21.2.1.a ' +
    '25.21.1.1.o 26.21.1.1.a 27.21.2.1.o 29.21.2.1.r 31.21.2.1.k 19.22.1.1.k 20.22.2.1.w ' +
    '22.22.1.1.o 23.22.1.1.a 24.22.1.1.o 25.22.2.1.a 27.22.1.1.o 28.22.2.1.a 30.22.2.1.r ' +
    '32.22.1.1.k 19.23.1.1.k 20.23.2.1.w 22.23.1.1.o 23.23.1.1.a 24.23.1.1.o 25.23.1.1.a ' +
    '26.23.1.1.o 27.23.2.1.a 29.23.1.1.o 30.23.1.1.r 31.23.2.1.k 19.24.1.1.k 20.24.2.1.w ' +
    '22.24.1.1.o 23.24.5.1.a 28.24.2.1.o 30.24.1.1.k 19.25.1.1.k 20.25.2.1.w 22.25.2.1.o ' +
    '24.25.3.1.a 27.25.1.1.o 28.25.1.1.k 22.26.2.1.k 24.26.3.1.o 21.27.1.1.k 22.27.2.1.s ' +
    '24.27.1.1.k 21.28.1.1.k 22.28.2.1.s 24.28.1.1.k 22.29.2.1.k ',
  eye:
    '9.7.1.1.k 23.7.1.1.k 10.8.3.1.k 20.8.3.1.k 10.9.1.1.i 11.9.2.1.k 20.9.1.1.i 21.9.2.1.k ' +
    '10.10.3.1.k 20.10.3.1.k 10.12.2.1.k 12.12.1.1.i 20.12.2.1.k 22.12.1.1.i ',
  eyeClosed:
    '9.10.1.1.k 23.10.1.1.k 10.11.3.1.k 20.11.3.1.k ',
} as const;

type Rect = readonly [x: number, y: number, w: number, h: number, color: PixelColor];

/** Giải mã một lần lúc nạp module — mỗi trang vẽ Bae vài lần. */
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
  base: decode(PIXELS.base),
  braid: decode(PIXELS.braid),
  fan: decode(PIXELS.fan),
  eye: decode(PIXELS.eye),
  eyeClosed: decode(PIXELS.eyeClosed),
};

/** Khung vẽ, theo đơn vị điểm ảnh. */
const VIEWBOX = [34, 43] as const;

/**
 * Tám hành động, chép từ bảng trong bản thiết kế. Nhịp và chỗ dùng ở
 * `styles/globals.css`; đừng chọn theo cái nào trông vui nhất:
 *
 *   · `fan`    quạt mát    — trạng thái nghỉ: hero, màn chờ
 *   · `wave`   vẫy tay     — mở web, lưu tin thành công
 *   · `hop`    nhảy mừng   — tìm được tin khớp chắc
 *   · `dance`  nhún nhảy   — quét xong mọi sàn
 *   · `twirl`  xoay vòng   — đổi bộ lọc sang ngành khác
 *   · `walk`   đi tìm tin  — hệ thống đang quét
 *   · `read`   đọc tin     — khối "tin cần soi lại"
 *   · `shy`    mắc cỡ      — màn rỗng, màn cảm ơn
 */
export const BAE_ACTIONS = [
  'fan',
  'wave',
  'hop',
  'dance',
  'twirl',
  'walk',
  'read',
  'shy',
] as const;

export type BaeAction = (typeof BAE_ACTIONS)[number];

/**
 * Dưới cỡ này thì bỏ quạt. Quạt là lớp nhiều chi tiết nhất; ở 28px nó nhoè
 * thành một vệt đỏ cạnh người, làm hình khó đọc hơn là thêm nghĩa. Bản thiết
 * kế vẽ đúng như vậy ở thang cỡ ("dưới 30px thì bỏ quạt cho gọn").
 */
const FAN_MIN_WIDTH = 30;

export function Bae({
  action = 'fan',
  width,
  showFan,
  className,
}: {
  /** `none` = đứng yên, chỉ nháy mắt và đưa bím tóc. */
  action?: BaeAction | 'none';
  /** Chiều rộng tính bằng px; chiều cao tự suy theo tỉ lệ khung vẽ. */
  width: number;
  /** Ép hiện/ẩn quạt, thay cho luật theo cỡ. */
  showFan?: boolean;
  className?: string;
}) {
  const [vw, vh] = VIEWBOX;
  const height = Math.round((width * vh) / vw);
  const fan = showFan ?? width >= FAN_MIN_WIDTH;

  const paint = (rects: Rect[]) =>
    rects.map(([x, y, w, h, color], index) => (
      <rect key={`${x}.${y}.${index}`} x={x} y={y} width={w} height={h} fill={PALETTE[color]} />
    ));

  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      viewBox={`0 0 ${vw} ${vh}`}
      shapeRendering="crispEdges"
      className={cx('block flex-none', action !== 'none' && `act-${action}`, className)}
    >
      {paint(SHAPES.base)}
      <g className="braid">{paint(SHAPES.braid)}</g>
      {fan && <g className="fan">{paint(SHAPES.fan)}</g>}
      <g className="px-eye">{paint(SHAPES.eye)}</g>
      <g className="px-eyec">{paint(SHAPES.eyeClosed)}</g>
    </svg>
  );
}
