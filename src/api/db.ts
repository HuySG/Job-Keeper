import { PrismaClient } from '@prisma/client';

/**
 * Prisma client dùng chung.
 *
 * Giữ một thể hiện toàn cục khi phát triển: tsx và Next.js đều nạp lại module
 * khi file đổi, và mỗi lần nạp lại mà tạo client mới thì Postgres sẽ hết slot
 * kết nối sau vài chục lần lưu file — lỗi này rất khó đoán ra khi gặp lần đầu.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
