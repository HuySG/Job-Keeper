import type { FieldPage } from '@/api/field.api';
import { Callout } from '@/components/ui/callout';
import { Cmd, Empty } from '@/components/ui/empty';
import { Glyph } from '@/components/ui/glyph';
import { buildUrl, readParam, type SearchParams } from '@/lib/query';
import { wsHref } from '@/lib/workspace-path';
import { formatCount } from '@/utils/format';

import { activeFieldFilters } from './field-active-filters';

/** Chiều lọc trong `FieldPage.relax` → tên tham số trên URL. */
const RELAX_KEY: Record<string, string> = {
  purchaseTypes: 'loai',
  districts: 'quan',
  saturdays: 't7',
  experience: 'kn',
  salary: 'luong',
};

/**
 * "Không có tin nào khớp — mèo đi ngủ tiếp."
 *
 * Một danh sách trống tự nó không nói lỗi nằm ở đâu, nên màn này nói ba thứ:
 *
 *   1. **Đang chặt ở đâu** — kể ra từng điều kiện đang bật, nối bằng dấu "+".
 *   2. **Nới chỗ nào thì được bao nhiêu** — tầng dữ liệu đã thử bỏ từng chiều
 *      một và đếm lại, nên mỗi nút ghi sẵn "+25 tin".
 *   3. **Đường thoát chắc chắn** — xoá hết, về đủ số tin của ngành.
 *
 * Ba trường hợp rỗng khác hẳn nhau, và lời khuyên cho trường hợp này là sai
 * cho trường hợp kia: kho chưa có tin (chạy crawler), ô tìm kiếm là thủ phạm
 * (gõ chữ khác), hoặc bộ lọc quá chặt (nới ra).
 */
export function FieldEmpty({
  result,
  params,
  pathname,
}: {
  result: FieldPage;
  params: SearchParams;
  pathname: string;
}) {
  const reset = `${pathname}?f=${encodeURIComponent(result.slug)}`;

  if (result.scanned === 0) {
    return (
      <Empty title="Kho chưa có tin nào trong phạm vi này">
        Mèo chưa quét được tin nào ở {result.provinceNames.join(', ') || 'phạm vi của ngành'}. Chạy{' '}
        <Cmd>npm run crawl -- --source vnw --full --limit 800</Cmd> rồi tải lại trang.
      </Empty>
    );
  }

  const query = readParam(params, 'q')?.trim();
  if (query && result.inFieldTotal === 0) {
    // Ô tìm kiếm áp TRƯỚC khi đếm, nên khi nó là thủ phạm thì mọi chiều lọc
    // khác đều đếm ra 0 — bảo người ta đi nới bộ lọc là chỉ sai đường.
    return (
      <Empty
        title={`Không tin nào có “${query}”`}
        actions={
          <a href={buildUrl(pathname, params, { q: undefined })} className="btn btn-primary h-11 gap-2 px-5">
            Bỏ ô tìm kiếm
            <Glyph name="arrowRight" size={16} />
          </a>
        }
      >
        Mình chỉ tìm trong tiêu đề và tên công ty, không tìm trong mô tả. Thử chữ ngắn hơn, hoặc tên
        công ty viết khác đi.
      </Empty>
    );
  }

  const constraints = activeFieldFilters(params).map((filter) => filter.text);

  return (
    <Empty
      title="Không có tin nào khớp — mèo đi ngủ tiếp"
      actions={
        <div className="flex flex-col items-center gap-3">
          {result.relax.length > 0 && (
            <div className="flex max-w-165 flex-wrap justify-center gap-2.5">
              {result.relax.map((hint) => (
                <a
                  key={hint.value}
                  href={buildUrl(pathname, params, { [RELAX_KEY[hint.value] ?? hint.value]: undefined })}
                  className="btn btn-secondary"
                >
                  Bỏ lọc {hint.label.toLowerCase()} · +{formatCount(hint.count)} tin
                </a>
              ))}
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">
            <a href={reset} className="btn btn-primary h-11.5 gap-2 px-5">
              Xoá hết bộ lọc · về {formatCount(result.inFieldTotal)} tin
              <Glyph name="arrowRight" size={16} />
            </a>
            <a href={wsHref(result.ws, '/cai-dat')} className="btn btn-ghost h-11.5 px-4">
              Sửa từ điển ngành
            </a>
          </div>
          <Callout
            tone="brand"
            className="mt-2.5 border-l-0 px-4 py-3"
            icon={<Glyph name="shield" size={16} stroke="var(--color-accent-700)" />}
          >
            Mình không bịa tin để lấp chỗ trống. Không có là không có.
          </Callout>
        </div>
      }
    >
      {constraints.length > 0 ? (
        <>
          Bộ lọc đang chặt quá:{' '}
          {constraints.map((text, index) => (
            <span key={text}>
              {index > 0 && ' + '}
              <strong className="font-extrabold">{text}</strong>
            </span>
          ))}
          .{' '}
          {result.relax.length > 0
            ? 'Nới một điều kiện là có tin ngay.'
            : 'Có ít nhất hai điều kiện cùng lúc loại hết tin, nên bỏ riêng điều kiện nào cũng vẫn rỗng.'}
        </>
      ) : (
        <>
          Từ điển ngành chưa nhận tin nào trong {formatCount(result.scanned)} tin đã chấm. Nếu nghi
          từ điển loại oan, soi bằng <Cmd>npm run match -- --show reject</Cmd>.
        </>
      )}
    </Empty>
  );
}
