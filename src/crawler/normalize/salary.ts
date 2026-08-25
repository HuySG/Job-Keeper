import {
  SALARY_VND_MONTH_MAX,
  SALARY_VND_MONTH_MIN,
} from '@/constants/crawl';
import { Currency, SalaryPeriod } from '@/enums';

import { normalizeWhitespace, removeDiacritics } from './text';

/**
 * Chuẩn hoá lương về **VND/tháng**.
 *
 * Đây là chỗ sai một ly đi một dặm: nếu để "Thoả thuận" thành `min = 0` thì mọi
 * trung vị trong SalaryStat đều hỏng, mà hỏng lặng lẽ — biểu đồ vẫn vẽ ra, chỉ
 * là sai. Nên nguyên tắc cứng: **không đọc được số thì `isPublic = false`,
 * TUYỆT ĐỐI không phải số 0.**
 */

export interface NormalizedSalary {
  /** VND/tháng. null khi không công khai. */
  min: number | null;
  max: number | null;
  /** Tiền tệ GỐC trước quy đổi, giữ để truy vết. */
  currency: Currency;
  /** Chu kỳ GỐC trong tin. */
  period: SalaryPeriod;
  /** false = "Thoả thuận"/"Cạnh tranh"/không đọc được. */
  isPublic: boolean;
  raw: string | null;
  fxRate: number | null;
  fxRateDate: Date | null;
  /** true khi đọc ra số nhưng số đó nằm ngoài khoảng hợp lý -> PARTIAL. */
  outOfRange: boolean;
}

const NOT_PUBLIC: Omit<NormalizedSalary, 'raw'> = {
  min: null,
  max: null,
  currency: Currency.VND,
  period: SalaryPeriod.MONTH,
  isPublic: false,
  fxRate: null,
  fxRateDate: null,
  outOfRange: false,
};

/** Các cách nói "không công bố lương". Đây là câu trả lời, không phải thất bại. */
const NEGOTIABLE_MARKERS = [
  'thoa thuan',
  'thuong luong',
  'canh tranh',
  'hap dan',
  'theo nang luc',
  'theo thoa thuan',
  'deal',
  'negotiable',
  'competitive',
  'attractive',
  'up to you',
] as const;

/** Hệ số quy về tháng. 22 ngày công, 8 giờ/ngày — chuẩn hành chính Việt Nam. */
const PERIOD_TO_MONTH: Record<SalaryPeriod, number> = {
  HOUR: 22 * 8,
  DAY: 22,
  WEEK: 52 / 12,
  MONTH: 1,
  YEAR: 1 / 12,
};

function getFxRate(): { rate: number; date: Date } {
  const rate = Number(process.env.USD_VND_RATE ?? 25_400);
  const raw = process.env.USD_VND_RATE_DATE;
  const date = raw ? new Date(raw) : new Date();
  return { rate, date: Number.isNaN(date.getTime()) ? new Date() : date };
}

/**
 * Đọc số kiểu Việt lẫn kiểu Anh.
 *
 * "20.000.000" (VN, chấm ngăn nghìn) và "20,000,000" (Anh) đều là hai mươi
 * triệu; còn "15,5" (VN) và "15.5" (Anh) đều là mười lăm phẩy năm. Cùng một ký
 * tự mang hai nghĩa ngược nhau, nên phải đoán bằng ngữ cảnh chứ không thể chọn
 * cứng một quy ước.
 *
 * Quy tắc: nhóm cuối cùng có đúng 3 chữ số thì dấu đó là ngăn nghìn; 1–2 chữ số
 * thì là dấu thập phân.
 */
export function parseNumber(input: string): number | null {
  const cleaned = input.replace(/[^\d.,]/g, '').trim();
  if (!cleaned) return null;

  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  const lastSep = Math.max(lastDot, lastComma);

  if (lastSep === -1) {
    const value = Number(cleaned);
    return Number.isFinite(value) ? value : null;
  }

  const tail = cleaned.slice(lastSep + 1);
  const isThousandsSep = tail.length === 3 && /^\d{3}$/.test(tail);

  let normalized: string;
  if (isThousandsSep) {
    normalized = cleaned.replace(/[.,]/g, '');
  } else {
    const head = cleaned.slice(0, lastSep).replace(/[.,]/g, '');
    normalized = `${head}.${tail}`;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Hệ số của đơn vị đứng sau số: "20 triệu" -> 20 × 1e6. */
function unitMultiplier(text: string): number {
  if (/\bt(y|ỷ)\b|\bty\b/.test(text)) return 1e9;
  if (/\btr(i(e|ệ)u)?\b|\btrd?\b|\bcu\b/.test(text)) return 1e6;
  if (/\bng(h)?[ai]n\b|\bk\b/.test(text)) return 1e3;
  return 1;
}

function detectCurrency(text: string): Currency {
  if (/\$|\busd\b|\bdola?r?\b|\bdo la\b/.test(text)) return Currency.USD;
  return Currency.VND;
}

function detectPeriod(text: string): SalaryPeriod {
  if (/\/\s*(h|gio|hour)\b|\bmoi gio\b|\bper hour\b/.test(text)) return SalaryPeriod.HOUR;
  if (/\/\s*(ngay|day)\b|\bmoi ngay\b|\bper day\b/.test(text)) return SalaryPeriod.DAY;
  if (/\/\s*(tuan|week)\b|\bper week\b/.test(text)) return SalaryPeriod.WEEK;
  if (/\/\s*(nam|year|yr)\b|\bmoi nam\b|\bper year\b|\bannual/.test(text)) return SalaryPeriod.YEAR;
  return SalaryPeriod.MONTH;
}

/**
 * Đọc lương từ chuỗi thô trong tin.
 *
 * Bắt được: "15 - 20 triệu", "Upto 60tr", "$2000-3000", "Trên 30 triệu",
 * "Tới 25 triệu", "20,000,000 - 30,000,000 VNĐ", "8-10 tr", "Thoả thuận".
 */
export function parseSalaryText(raw: string | null | undefined): NormalizedSalary {
  if (!raw) return { ...NOT_PUBLIC, raw: null };

  const original = normalizeWhitespace(raw);
  const text = removeDiacritics(original).toLowerCase();

  if (NEGOTIABLE_MARKERS.some((marker) => text.includes(marker))) {
    return { ...NOT_PUBLIC, raw: original };
  }

  const currency = detectCurrency(text);
  const period = detectPeriod(text);

  // Nhặt mọi cụm số kèm đơn vị đứng ngay sau nó, theo đúng thứ tự xuất hiện.
  const tokenRe = /([\d][\d.,]*)\s*(ty|trieu|trd|tr|k|ngan|nghin|cu)?/g;
  const tokens: { value: number; multiplier: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(text)) !== null) {
    const value = parseNumber(match[1] ?? '');
    if (value === null || value === 0) continue;
    const unit = match[2] ?? '';
    tokens.push({ value, multiplier: unit ? unitMultiplier(` ${unit} `) : 1 });
  }

  if (tokens.length === 0) return { ...NOT_PUBLIC, raw: original };

  // Đơn vị chỉ viết MỘT lần cho cả khoảng: "15 - 20 triệu", "8-10tr".
  // Chữ "triệu"/"tr" đứng cuối áp cho cả hai vế — 15 không phải mười lăm đồng.
  //
  // Suy đơn vị từ chính các token đã nhặt chứ không dò lại trong cả chuỗi: dò
  // cả chuỗi cần ranh giới từ (\b), mà "10tr" thì giữa "0" và "t" KHÔNG có
  // ranh giới từ nào — đó là lý do "8-10tr" từng cho ra 8 đồng.
  const dominant = Math.max(...tokens.map((t) => t.multiplier));
  if (dominant > 1 && currency === Currency.VND) {
    for (const token of tokens) {
      if (token.multiplier === 1 && token.value < 1000) token.multiplier = dominant;
    }
  }

  const values = tokens.map((t) => t.value * t.multiplier);

  // "Trên 30 triệu" / "Từ 20tr" -> chỉ có sàn. "Tới 25 triệu" / "Upto" -> chỉ trần.
  const onlyMin = /\b(tren|tu|from|min|it nhat)\b/.test(text) && values.length === 1;
  const onlyMax = /\b(toi|den|upto|up to|max|toi da|duoi)\b/.test(text) && values.length === 1;

  let min: number | null;
  let max: number | null;
  if (onlyMin) {
    min = values[0]!;
    max = null;
  } else if (onlyMax) {
    min = null;
    max = values[0]!;
  } else {
    min = Math.min(...values);
    max = Math.max(...values);
  }

  return finalize({ min, max, currency, period, raw: original });
}

/**
 * Đọc lương từ `baseSalary` của JSON-LD.
 *
 * Đây là đường chính vì đã có cấu trúc. Nhưng vẫn phải chịu được ba dạng gặp
 * thật: `value` là QuantitativeValue có min/max, `value` là một số trần, hoặc
 * `value` là chuỗi.
 */
export function parseSalaryJsonLd(baseSalary: unknown): NormalizedSalary | null {
  if (baseSalary == null) return null;

  // Có nguồn để thẳng một chuỗi thay vì MonetaryAmount.
  if (typeof baseSalary === 'string') {
    const parsed = parseSalaryText(baseSalary);
    return parsed.isPublic ? parsed : null;
  }
  if (typeof baseSalary !== 'object') return null;

  const amount = baseSalary as Record<string, unknown>;
  const currency =
    String(amount['currency'] ?? amount['salaryCurrency'] ?? 'VND').toUpperCase() === 'USD'
      ? Currency.USD
      : Currency.VND;

  const value = amount['value'];
  let min: number | null = null;
  let max: number | null = null;
  let period: SalaryPeriod = SalaryPeriod.MONTH;

  if (value != null && typeof value === 'object') {
    const qv = value as Record<string, unknown>;
    min = toNumber(qv['minValue']);
    max = toNumber(qv['maxValue']);
    // Không có min/max nhưng có value: một con số duy nhất, coi là cả sàn lẫn trần.
    if (min === null && max === null) {
      const single = toNumber(qv['value']);
      min = single;
      max = single;
    }
    period = toPeriod(qv['unitText']);
  } else if (typeof value === 'number' || typeof value === 'string') {
    const single = toNumber(value);
    min = single;
    max = single;
    period = toPeriod(amount['unitText']);
  }

  if (min === null && max === null) return null;
  return finalize({ min, max, currency, period, raw: JSON.stringify(baseSalary).slice(0, 300) });
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return parseNumber(value);
  return null;
}

function toPeriod(unitText: unknown): SalaryPeriod {
  const text = String(unitText ?? '').toUpperCase();
  if (text === 'HOUR') return SalaryPeriod.HOUR;
  if (text === 'DAY') return SalaryPeriod.DAY;
  if (text === 'WEEK') return SalaryPeriod.WEEK;
  if (text === 'YEAR') return SalaryPeriod.YEAR;
  return SalaryPeriod.MONTH;
}

/** Quy về VND/tháng, đổi ngoại tệ, rồi kiểm khoảng hợp lý. */
function finalize(input: {
  min: number | null;
  max: number | null;
  currency: Currency;
  period: SalaryPeriod;
  raw: string;
}): NormalizedSalary {
  const { currency, period, raw } = input;
  const factor = PERIOD_TO_MONTH[period];

  let fxRate: number | null = null;
  let fxRateDate: Date | null = null;
  let rate = 1;
  if (currency === Currency.USD) {
    const fx = getFxRate();
    rate = fx.rate;
    fxRate = fx.rate;
    fxRateDate = fx.date;
  }

  const convert = (value: number | null): number | null =>
    value === null ? null : Math.round(value * factor * rate);

  let min = convert(input.min);
  let max = convert(input.max);

  if (min !== null && max !== null && min > max) [min, max] = [max, min];

  // Ngoài khoảng hợp lý = gần như chắc chắn đọc sai đơn vị (nhầm "triệu" với
  // "đồng"). Đánh dấu thay vì để số rác lọt vào trung vị.
  const check = (value: number | null): boolean =>
    value !== null && (value < SALARY_VND_MONTH_MIN || value > SALARY_VND_MONTH_MAX);
  const outOfRange = check(min) || check(max);

  return {
    min,
    max,
    currency,
    period,
    isPublic: min !== null || max !== null,
    raw,
    fxRate,
    fxRateDate,
    outOfRange,
  };
}
