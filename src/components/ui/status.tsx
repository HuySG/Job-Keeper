import { FRESH_CHECK_HOURS } from '@/constants/field';
import { timeAgo } from '@/utils/format';

import { Glyph } from './glyph';
import { cx } from './tone';

/**
 * Chấm còn-sống: nhấp nháy kèm vòng sóng. CHỈ dùng khi có bằng chứng thật —
 * vừa gọi vào tận trang tin, hoặc crawler vừa chạy. Chấm này mà sáng bừa là
 * lời nói dối đẹp nhất trang.
 */
export function LiveDot({ size = 8, className }: { size?: number; className?: string }) {
  return <span aria-hidden className={cx('live-dot', className)} style={{ width: size, height: size }} />;
}

/** Ô vuông rỗng — đối xứng với `LiveDot` cho trạng thái "chưa có bằng chứng". */
export function IdleDot({ size = 8, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx('inline-block flex-none border-2 border-neutral-500', className)}
      style={{ width: size, height: size }}
    />
  );
}

/** Tin này đã được gọi vào tận nơi gần đây chưa. */
export function isFreshlyChecked(lastCheckedAt: Date | null): boolean {
  return (
    lastCheckedAt !== null &&
    Date.now() - lastCheckedAt.getTime() <= FRESH_CHECK_HOURS * 60 * 60 * 1000
  );
}

/**
 * Dòng "đã kiểm còn-sống" dùng chung cho thẻ tin, bảng và trang chi tiết.
 *
 * Ba trạng thái, không phải hai: chưa gọi lần nào khác hẳn đã gọi nhưng lâu
 * rồi. Gộp chung thành "chưa kiểm" là giấu mất rằng tin từng được xác nhận.
 */
export function CheckedLabel({
  lastCheckedAt,
  className,
}: {
  lastCheckedAt: Date | null;
  className?: string;
}) {
  if (lastCheckedAt === null) {
    return (
      <span
        className={cx('inline-flex items-center gap-1.5', className)}
        title="Chưa lần nào gọi vào tận trang tin để xác nhận còn tuyển"
      >
        <Glyph name="alert" size={13} stroke="var(--color-neutral-600)" />
        Chưa kiểm còn-sống
      </span>
    );
  }

  if (!isFreshlyChecked(lastCheckedAt)) {
    return (
      <span
        className={cx('inline-flex items-center gap-1.5', className)}
        title={`Lần cuối gọi vào tận trang tin: ${timeAgo(lastCheckedAt)} — quá ${FRESH_CHECK_HOURS} giờ`}
      >
        <IdleDot size={8} />
        Kiểm {timeAgo(lastCheckedAt)}
      </span>
    );
  }

  return (
    <span
      className={cx('inline-flex items-center gap-1.5 font-extrabold text-live-700', className)}
      title="Đã gọi vào tận trang tin và thấy còn tuyển"
    >
      <LiveDot size={7} />
      Đã kiểm {timeAgo(lastCheckedAt)}
    </span>
  );
}
