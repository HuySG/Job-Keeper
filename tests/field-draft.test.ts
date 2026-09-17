import { describe, expect, it } from 'vitest';

import {
  applyDraft,
  cleanTerm,
  diffDraft,
  draftHref,
  hasChanges,
  opsToEntries,
  readDraftOps,
  withMaxAge,
  withoutExclude,
  withoutKeyword,
  withPromoted,
  withProvince,
  type Dictionary,
} from '@/lib/field-draft';

const SAVED: Dictionary = {
  keywords: ['mua hàng', 'purchasing', '~logistics', '~kho vận'],
  excludes: ['telesale', 'bán hàng'],
  provinces: ['ho-chi-minh'],
  maxAgeDays: 90,
};

/** So hai từ điển theo NỘI DUNG — thứ tự từ không phải là một phần của nghĩa. */
function normalized(dictionary: Dictionary) {
  return {
    keywords: [...dictionary.keywords].sort(),
    excludes: [...dictionary.excludes].sort(),
    provinces: [...dictionary.provinces].sort(),
    maxAgeDays: dictionary.maxAgeDays,
  };
}

describe('cleanTerm', () => {
  it('gọn khoảng trắng và hạ chữ thường', () => {
    expect(cleanTerm('  Mua   Hàng ')).toBe('mua hàng');
  });

  it('bỏ tiền tố xám gõ tay — xám hay không là do nút quyết định', () => {
    expect(cleanTerm('~logistics')).toBe('logistics');
  });

  it('không nhận từ rỗng, một ký tự, hoặc dài như cả câu', () => {
    expect(cleanTerm('   ')).toBeNull();
    expect(cleanTerm('a')).toBeNull();
    expect(cleanTerm('x'.repeat(61))).toBeNull();
  });
});

describe('applyDraft', () => {
  it('không có thay đổi thì trả đúng bản đã lưu', () => {
    expect(applyDraft(SAVED, readDraftOps({}))).toEqual(SAVED);
  });

  it('thêm từ chắc, và không thêm trùng khi chỉ khác dấu hay hoa thường', () => {
    const draft = applyDraft(SAVED, readDraftOps({ them: ['thu mua', 'MUA HANG'] }));
    expect(draft.keywords).toEqual(['mua hàng', 'purchasing', '~logistics', '~kho vận', 'thu mua']);
  });

  it('thêm từ chắc trùng một từ xám thì NÂNG từ xám lên', () => {
    const draft = applyDraft(SAVED, readDraftOps({ them: 'logistics' }));
    expect(draft.keywords).toContain('logistics');
    expect(draft.keywords).not.toContain('~logistics');
  });

  it('gỡ trước rồi mới thêm — nên hạ một từ chắc xuống xám được', () => {
    const draft = applyDraft(SAVED, readDraftOps({ bo: 'purchasing', themxam: 'purchasing' }));
    expect(draft.keywords).toContain('~purchasing');
    expect(draft.keywords).not.toContain('purchasing');
  });

  it('bỏ qua slug tỉnh sai hình dạng thay vì ghi rác vào CSDL', () => {
    const draft = applyDraft(SAVED, readDraftOps({ themtinh: ['ha-noi', '../x', 'Ha Noi'] }));
    expect(draft.provinces).toEqual(['ho-chi-minh', 'ha-noi']);
  });

  it('ngay=0 là bỏ giới hạn tuổi tin, số lạ thì giữ nguyên', () => {
    expect(applyDraft(SAVED, readDraftOps({ ngay: '0' })).maxAgeDays).toBeNull();
    expect(applyDraft(SAVED, readDraftOps({ ngay: 'abc' })).maxAgeDays).toBe(90);
    expect(applyDraft(SAVED, readDraftOps({ ngay: '30' })).maxAgeDays).toBe(30);
  });
});

describe('diffDraft', () => {
  const edits: [string, Dictionary][] = [
    ['gỡ một từ chắc', withoutKeyword(SAVED, 'purchasing')],
    ['nâng một từ xám', withPromoted(SAVED, 'kho vận')],
    ['gỡ một từ loại', withoutExclude(SAVED, 'telesale')],
    ['thêm tỉnh', withProvince(SAVED, 'ha-noi', true)],
    ['bỏ tỉnh', withProvince(SAVED, 'ho-chi-minh', false)],
    ['đổi tuổi tin', withMaxAge(SAVED, 30)],
    ['hạ từ chắc xuống xám', { ...SAVED, keywords: ['mua hàng', '~purchasing', '~logistics', '~kho vận'] }],
    [
      'nhiều thứ một lúc',
      {
        keywords: ['mua hàng', 'logistics', 'sourcing'],
        excludes: ['bán hàng', 'kế toán'],
        provinces: [],
        maxAgeDays: null,
      },
    ],
  ];

  it.each(edits)('áp lại tập thay đổi thì ra đúng bản nháp: %s', (_, draft) => {
    const ops = diffDraft(SAVED, draft);
    expect(normalized(applyDraft(SAVED, ops))).toEqual(normalized(draft));
  });

  it('thêm rồi gỡ chính từ đó thì URL trở về rỗng', () => {
    const added = applyDraft(SAVED, readDraftOps({ them: 'thu mua' }));
    const back = withoutKeyword(added, 'thu mua');
    expect(hasChanges(diffDraft(SAVED, back))).toBe(false);
    expect(draftHref('/cai-dat', SAVED, back)).toBe('/cai-dat');
  });

  it('URL chỉ mang phần khác, không chép cả từ điển', () => {
    const entries = opsToEntries(diffDraft(SAVED, withoutKeyword(SAVED, 'purchasing')));
    expect(entries).toEqual([['bo', 'purchasing']]);
  });
});
