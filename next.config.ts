import type { NextConfig } from 'next';

/**
 * Trang của workspace bae từng nằm ở gốc (`/nganh`, `/viec/123`...). Từ khi có
 * hai workspace (docs/plan-swe.md §8.1), mọi trang nằm dưới `/{ws}`. Liên kết
 * cũ — dấu trang, tin nhắn đã gửi — chuyển thẳng về `/bae/...`, giữ nguyên
 * query string (Next tự giữ).
 *
 * 308 (vĩnh viễn) là cố ý: số hiệu tin cũ LUÔN là tin của CSDL bae, nên
 * đích đến không bao giờ đổi. `/` không nằm ở đây — middleware chuyển nó về
 * workspace vừa xem.
 */
const MOVED_TO_BAE = ['/nganh', '/viec', '/viec/:id', '/luong', '/nguon', '/da-luu', '/cai-dat'];

const nextConfig: NextConfig = {
  images: {
    // Logo công ty được hotlink từ CDN của nguồn, KHÔNG tải về máy chủ.
    // Đây vừa là chuyện dung lượng vừa là chuyện bản quyền (PLAN.md §7).
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  async redirects() {
    return MOVED_TO_BAE.map((source) => ({
      source,
      destination: `/bae${source}`,
      permanent: true,
    }));
  },
};

export default nextConfig;
