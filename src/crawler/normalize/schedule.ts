import { SaturdayWork } from '@/enums';

import { normalizeWhitespace, removeDiacritics } from './text';

/**
 * Đọc lịch làm việc từ mô tả tin — trả lời câu **"có phải làm thứ Bảy không"**.
 *
 * Vì sao đáng làm riêng một bộ đọc: ở Việt Nam đây là điều kiện đổi hẳn chất
 * lượng sống, mà không sàn nào cho lọc. Nó chỉ nằm rải rác trong mô tả, viết
 * theo hàng chục kiểu — và không có cấu trúc nào để bám vào.
 *
 * ⚠️ ĐỘ PHỦ THẤP, và phải nói thẳng chứ không giấu. Đo 08/09/2026 trên tin
 *    thật: chỉ **2%** tin VietnamWorks nhắc tới lịch làm việc, còn vieclam24h
 *    là **22%**. Nên `null` (tin không nói) sẽ là đa số, và `null` KHÔNG được
 *    hiểu là "không phải làm thứ Bảy".
 *
 * Thứ tự xét là phần quan trọng nhất, vì các mẫu chồng lên nhau: câu
 * "làm thứ 2 - thứ 6, sáng thứ 7 online" khớp CẢ "thứ 2 đến thứ 6" lẫn
 * "sáng thứ 7". Cái cụ thể hơn phải thắng, nếu không sẽ kết luận là được nghỉ
 * trọn thứ Bảy trong khi thật ra vẫn phải làm nửa ngày.
 */

export interface ParsedSchedule {
  saturday: SaturdayWork | null;
  /** Câu gốc để người đọc tự kiểm chứng. Đã cắt <= SCHEDULE_RAW_MAX ký tự. */
  raw: string | null;
}

/** Cắt ngắn câu gốc: Neon Free chỉ 0,5 GB, cột text không giới hạn là lỗ rò. */
export const SCHEDULE_RAW_MAX = 200;

/**
 * `T2`, `t 2`, `thứ 2`, `thứ hai`, `thu hai` — cùng một thứ.
 * Chuỗi vào đã bỏ dấu nên chỉ cần lo biến thể không dấu.
 */
// Tiền tố BẮT BUỘC, không được để tuỳ chọn.
//
// Bài học từ một test đỏ: để tuỳ chọn thì một chữ số trơ trọi cũng khớp, và
// "Thời gian làm việc: 7h30-11h" bị đọc thành "làm sáng thứ Bảy" — chữ "7"
// trong "7h30" khớp D7 rồi "-11h" khớp mẫu giờ nghỉ. Cùng lỗi đó biến
// "2-6 triệu" thành "thứ 2 đến thứ 6".
//
// `\b` ở đầu là bắt buộc nốt: không có nó thì "lot 2" cũng khớp "t 2".
const DAY = String.raw`(?:\bth[uw]\s*|\bt\s*\.?\s*)`;
const D2 = String.raw`(?:${DAY}2|\bthu hai\b)`;
const D6 = String.raw`(?:${DAY}6|\bthu sau\b)`;
const D7 = String.raw`(?:${DAY}7|\bthu bay\b)`;
const TO = String.raw`\s*(?:-|–|—|>|den|toi|to|~)\s*`;

/**
 * Các mẫu, XÉT THEO THỨ TỰ NÀY. Cụ thể trước, tổng quát sau.
 */
const RULES: readonly { kind: SaturdayWork; re: RegExp; why: string }[] = [
  {
    kind: SaturdayWork.ALTERNATE,
    // "thứ 7 luân phiên", "cách tuần làm thứ 7", "xen kẽ thứ 7", "2 thứ 7/tháng"
    re: new RegExp(
      String.raw`(?:${D7}[^.;]{0,40}(?:luan phien|cach tuan|xen ke|\d\s*(?:lan|buoi)?\s*\/\s*thang))` +
        String.raw`|(?:(?:luan phien|cach tuan|xen ke)[^.;]{0,40}${D7})`,
    ),
    why: 'luân phiên/cách tuần',
  },
  {
    kind: SaturdayWork.HALF_DAY,
    // "sáng thứ 7", "thứ 7 làm nửa ngày", "thứ 7: 8h-12h"
    re: new RegExp(
      String.raw`(?:sang\s*${D7})` +
        String.raw`|(?:${D7}[^.;]{0,30}(?:nua ngay|buoi sang|den\s*1[12]\s*h|-\s*1[12]\s*h|8h\s*-\s*12))`,
    ),
    why: 'nửa ngày thứ Bảy',
  },
  {
    kind: SaturdayWork.NONE,
    // "thứ 2 đến thứ 6", "nghỉ thứ 7", "off thứ 7 và chủ nhật"
    re: new RegExp(
      String.raw`(?:${D2}${TO}${D6})` + String.raw`|(?:(?:nghi|off|duoc nghi)[^.;]{0,25}${D7})`,
    ),
    why: 'nghỉ trọn thứ Bảy',
  },
  {
    kind: SaturdayWork.FULL,
    // "thứ 2 đến thứ 7", "làm cả thứ 7"
    re: new RegExp(String.raw`(?:${D2}${TO}${D7})` + String.raw`|(?:lam\s*(?:ca|luon)\s*${D7})`),
    why: 'làm trọn thứ Bảy',
  },
];

/** Nơi có khả năng chứa câu về lịch: dùng để cắt lấy đoạn trích. */
const CONTEXT_RE =
  /.{0,60}(?:th[ờo]i gian l[àa]m vi[ệe]c|gi[ờo] l[àa]m vi[ệe]c|working (?:time|hours?|days?)|ng[àa]y l[àa]m vi[ệe]c|th[ứu]\s*7|t7\b).{0,110}/i;

export function parseSchedule(text: string | null | undefined): ParsedSchedule {
  if (!text) return { saturday: null, raw: null };

  const flat = normalizeWhitespace(text);
  // So khớp trên bản KHÔNG DẤU: tin viết "thứ", "thư", "thu" lẫn lộn, và nhiều
  // tin gõ thiếu dấu hoàn toàn. Giữ bản có dấu riêng để trích câu gốc cho người
  // đọc — đoạn trích mất dấu thì đọc rất khó chịu.
  const plain = removeDiacritics(flat).toLowerCase();

  for (const rule of RULES) {
    if (rule.re.test(plain)) {
      return { saturday: rule.kind, raw: excerpt(flat) };
    }
  }

  // Có nhắc thứ Bảy nhưng không khớp mẫu nào: KHÔNG đoán bừa. Vẫn giữ câu gốc
  // để người đọc tự quyết, và để lần sau biết mẫu nào còn thiếu.
  if (/\bthu\s*7\b|\bt7\b|saturday/.test(plain)) {
    return { saturday: null, raw: excerpt(flat) };
  }

  return { saturday: null, raw: null };
}

function excerpt(text: string): string | null {
  const match = CONTEXT_RE.exec(text);
  const found = normalizeWhitespace(match?.[0] ?? '');
  if (!found) return null;
  return found.length <= SCHEDULE_RAW_MAX ? found : `${found.slice(0, SCHEDULE_RAW_MAX - 1)}…`;
}

/** Nhãn tiếng Việt để hiện lên giao diện. */
export const SATURDAY_LABEL: Record<SaturdayWork, string> = {
  [SaturdayWork.NONE]: 'Nghỉ thứ 7',
  [SaturdayWork.HALF_DAY]: 'Sáng thứ 7',
  [SaturdayWork.ALTERNATE]: 'Thứ 7 luân phiên',
  [SaturdayWork.FULL]: 'Làm thứ 7',
};
