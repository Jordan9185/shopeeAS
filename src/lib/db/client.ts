import { PrismaClient } from "@prisma/client"

// Next.js 開發模式會頻繁重新載入模組，若每次都 new 一個 PrismaClient
// 會很快耗盡資料庫連線。掛在 globalThis 上重用同一個實例。
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
