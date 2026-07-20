import { judgePrice, type PriceVerdict } from "@/lib/shopee/price"
import type { ShopeeItem } from "@/lib/shopee/types"
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
export async function recordObservation(item: ShopeeItem): Promise<PriceVerdict> {
  const key = { shopId_itemId: { shopId: item.shopId, itemId: item.itemId } }

  const existing = await prisma.item.findUnique({ where: key })
  const verdict = judgePrice({
    currentPrice: item.currentPrice,
    previousLowest: existing?.lowestPrice ?? null,
  })

  await prisma.item.upsert({
    where: key,
    create: {
      shopId: item.shopId,
      itemId: item.itemId,
      title: item.title,
      imageUrl: item.imageUrl,
      currentPrice: item.currentPrice,
      originalPrice: item.originalPrice,
      lowestPrice: verdict.newLowest,
    },
    update: {
      // 商品標題與圖片可能會被賣家改動，每次都更新成最新的
      title: item.title,
      imageUrl: item.imageUrl,
      currentPrice: item.currentPrice,
      originalPrice: item.originalPrice,
      lowestPrice: verdict.newLowest,
    },
  })

  return verdict
}
