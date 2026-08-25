import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Logo công ty được hotlink từ CDN của nguồn, KHÔNG tải về máy chủ.
    // Đây vừa là chuyện dung lượng vừa là chuyện bản quyền (PLAN.md §7).
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
