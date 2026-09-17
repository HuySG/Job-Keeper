import { ComponentGallery, ReplayButton } from '@/components/gallery/component-gallery';
import { AppearanceForm } from '@/components/settings/appearance-form';
import { Callout } from '@/components/ui/callout';
import { Glyph } from '@/components/ui/glyph';
import { Mascot } from '@/components/ui/mascot';
import { Kicker } from '@/components/ui/stat';
import { THEMES } from '@/constants/appearance';
import { getAppearance } from '@/lib/appearance';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Bộ thành phần' };

/**
 * Bộ thành phần & chuyển động — tài liệu sống của hệ giao diện.
 *
 * Mở bằng nút sóng trên thanh điều hướng. Không nằm trong năm mục chính vì nó
 * không trả lời câu hỏi nào về thị trường việc làm; nó trả lời "dựng màn mới
 * thì dùng mảnh nào, chuyển động ra sao".
 *
 * Hai công tắc giao diện (bảng màu, chuyển động) có mặt ở đây vì đây là chỗ
 * nhìn thấy tác dụng của chúng rõ nhất.
 */
export default async function ComponentsPage() {
  const appearance = await getAppearance();
  const theme = THEMES.find((item) => item.value === appearance.theme) ?? THEMES[0];

  return (
    <>
      <section className="brand-field flex flex-wrap items-center gap-7 px-4 py-8.5 sm:px-6">
        <div className="min-w-0 flex-[1_1_420px]">
          <Kicker>Thành phần lõi &amp; chuyển động</Kicker>
          <h1 className="mb-2.5 text-[34px] leading-[1.04] sm:text-[42px]">Bộ thành phần của Bae-Job</h1>
          <p className="max-w-145 text-base leading-[1.55] text-pretty text-neutral-800">
            Mỗi khối dưới đây là một thành phần thật, bấm thử được, kèm đúng đoạn chuyển động nó dùng
            trong app. Dùng trang này làm nguồn khi dựng màn mới.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <ReplayButton />
            <a
              href="/nganh"
              className="btn btn-secondary h-11 border-accent-700 px-4.5 text-accent-800 hover:text-accent-800"
            >
              Về app
            </a>
          </div>
        </div>
        <Mascot pose="sit" width={86} />
      </section>

      <div className="border-b-2 border-divider px-4 py-5 sm:px-6">
        <AppearanceForm appearance={appearance} />
      </div>

      <ComponentGallery brand={{ label: theme.label, swatch: theme.swatch }} />

      <Callout
        tone="brand"
        className="mx-4 mb-10 sm:mx-6"
        icon={<Glyph name="shield" size={16} stroke="var(--color-accent-700)" />}
      >
        Mọi chuyển động ở đây tắt được bằng công tắc <strong>chuyển động</strong> phía trên, và tự tắt
        khi máy bạn bật chế độ giảm hiệu ứng.
      </Callout>
    </>
  );
}
