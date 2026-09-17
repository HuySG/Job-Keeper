import type { WorkspaceId } from '@/constants/workspace';
import type { SourceKind } from '@/enums';

import { SOURCE_CATALOG } from './catalog';
import { TARGETING } from './targeting';

/**
 * Một dòng `Source` như seed sẽ ghi vào CSDL của MỘT workspace.
 *
 * Ghép từ hai nửa: cách vào sàn (`catalog.ts`, dùng chung) và lát cắt theo
 * nghề (`targeting.ts`, theo workspace). Xem docs/plan-swe.md §9.2.
 */
export interface SourceSeed {
  code: string;
  name: string;
  homeUrl: string;
  kind: SourceKind;
  entryUrl: string | null;
  jobUrlPattern: string | null;
  priority: number;
  config: Record<string, unknown> | null;
  /** false = không dùng ở workspace này, hoặc đã kiểm và biết là chưa chạy được. */
  isActive: boolean;
  /** Ghi chú khảo sát — đừng xoá, đây là bằng chứng cho mọi lựa chọn ở trên. */
  note: string;
}

/**
 * Danh sách nguồn của một workspace.
 *
 * Workspace `bae` ra ĐÚNG những gì seed đã ghi trước ngày tách — có test so
 * với bản chụp `tests/fixtures/source-seeds-bae.json`.
 */
export function sourceSeedsFor(ws: WorkspaceId): SourceSeed[] {
  const targeting = TARGETING[ws];

  const unknown = Object.keys(targeting).filter(
    (code) => !SOURCE_CATALOG.some((entry) => entry.code === code),
  );
  if (unknown.length > 0) {
    throw new Error(
      `targeting.ts khai lát cắt cho nguồn không có trong catalog (${ws}): ${unknown.join(', ')}`,
    );
  }

  return SOURCE_CATALOG.map((entry) => {
    const target = targeting[entry.code];
    if (!target) {
      // Thiếu thì dừng, không mặc định bật hay tắt: cả hai lựa chọn đều là
      // một quyết định mà không ai thật sự đưa ra.
      throw new Error(
        `Workspace "${ws}" chưa khai lát cắt cho nguồn "${entry.code}" — ` +
          'thêm vào src/constants/source/targeting.ts',
      );
    }

    const config: Record<string, unknown> = { ...entry.quirks };
    if (target.queries?.length) config.queries = [...target.queries];
    if (target.urlIncludePattern) config.urlIncludePattern = target.urlIncludePattern;

    return {
      code: entry.code,
      name: entry.name,
      homeUrl: entry.homeUrl,
      kind: entry.kind,
      entryUrl: entry.entryUrl,
      jobUrlPattern: entry.jobUrlPattern,
      priority: entry.priority,
      config: Object.keys(config).length > 0 ? config : null,
      isActive: target.isActive,
      note: entry.note,
    };
  });
}

export { REJECTED_SOURCES, SOURCE_CATALOG, type SourceCatalogEntry } from './catalog';
export { PURCHASE_SLUG, SOFTWARE_SLUG, TARGETING, type SourceTargeting } from './targeting';
