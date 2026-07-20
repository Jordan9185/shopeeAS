import type { Product } from "@/lib/platforms/types"
import { judgePrice, type PriceVerdict } from "@/lib/pricing/price"
import { prisma } from "./client"

/**
 * 記錄一次商品觀測，並回傳比價判定。
 *
 * 流程：讀既有紀錄 → 判定 → 寫回（新增或更新）。
 *
 * 已知限制：同一商品若在極短時間內被多人同時貼出，兩個請求可能都讀到舊值，
 * 導致較低的那次判定被覆蓋。以社群機器人的流量而言發生機率極低，
 * 且後果僅是少記一次歷史低點，故 MVP 不處理。若未來要嚴謹處理，
 * 應改用 `UPDATE ... SET lowestPrice = LEAST(lowestPrice, $1)` 的原子寫法。
 */
export async function recordObservation(product: Product): Promise<PriceVerdict> {
  const key = {
    platform_externalId: { platform: product.platform, externalId: product.externalId },
  }

  const existing = await prisma.product.findUnique({ where: key })
  const verdict = judgePrice({
    currentPrice: product.currentPrice,
    previousLowest: existing?.lowestPrice ?? null,
  })

  // 標題、圖片、網址可能被賣家改動，每次都更新成最新的
  const mutable = {
    title: product.title,
    imageUrl: product.imageUrl,
    productUrl: product.productUrl,
    currentPrice: product.currentPrice,
    originalPrice: product.originalPrice,
    lowestPrice: verdict.newLowest,
  }

  await prisma.product.upsert({
    where: key,
    create: {
      platform: product.platform,
      externalId: product.externalId,
      ...mutable,
    },
    update: mutable,
  })

  return verdict
}
