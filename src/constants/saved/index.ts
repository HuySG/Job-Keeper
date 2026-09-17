/**
 * Trần số tin được lưu.
 *
 * Không phải giới hạn của bảng — `SavedJob` vài nghìn dòng vẫn nhẹ. Đây là
 * trần của LỜI HỨA: máy kiểm gọi lại từng tin đã lưu mỗi ngày, trước mọi tin
 * khác, và mỗi lần gọi là một request tới sàn nguồn. Hai mươi tin là hai mươi
 * request một ngày; không có trần thì một buổi bấm lưu hăng tay là đẩy ngân
 * sách lịch sự của crawler đi xa.
 */
export const SAVED_JOB_LIMIT = 20;

/** Tin đã lưu chưa được gọi lại trong ngần này giờ thì máy kiểm ưu tiên gọi. */
export const SAVED_RECHECK_HOURS = 20;
