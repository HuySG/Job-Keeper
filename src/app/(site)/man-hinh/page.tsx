'use client';

import { useEffect, useState } from 'react';

/**
 * Trang đo màn hình — TẠM THỜI, xoá sau khi chốt bề rộng khung.
 *
 * Lý do phải có: bề rộng CSS KHÔNG bằng bề rộng vật lý. Windows để tỷ lệ 150%
 * thì một màn 2560px báo về cho trình duyệt là 1706px, và mọi `clamp(…, vw, …)`
 * chạy trên con số 1706 đó. Chốt bề rộng khung mà không biết con số này thì là
 * đoán mò.
 */
export default function ScreenPage() {
  const [rows, setRows] = useState<[string, string][] | null>(null);

  useEffect(() => {
    const read = () => {
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;visibility:hidden';
      document.body.appendChild(probe);
      const tok = (name: string): string => {
        probe.style.width = `var(--${name})`;
        return getComputedStyle(probe).width;
      };
      const shell = parseFloat(tok('shell'));
      const out: [string, string][] = [
        ['Bề rộng CSS của cửa sổ', `${window.innerWidth}px`],
        ['Bề rộng màn hình vật lý', `${window.screen.width}px`],
        ['Tỷ lệ phóng', `${Math.round(window.devicePixelRatio * 100)}%`],
        ['Khung trang đang rộng', tok('shell')],
        ['Lề trống mỗi bên', `${Math.max(0, Math.round((window.innerWidth - shell) / 2))}px`],
        ['Lề trong', tok('pad')],
        ['Tiêu đề hero', tok('h-hero')],
      ];
      probe.remove();
      setRows(out);
    };
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);

  if (!rows) return null;

  return (
    <div className="px-(--pad) py-12">
      <h1 className="mb-6 text-(length:--h-hero)">Màn hình của bạn</h1>
      <table className="table max-w-200">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="text-neutral-700">{k}</td>
              <td className="font-heading text-xl font-extrabold">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-6 text-[13px] text-neutral-700">
        Mở <code className="font-mono">/man-hinh</code> rồi đọc cho tôi hai dòng đầu.
      </p>
    </div>
  );
}
