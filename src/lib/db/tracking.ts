import type { Platform, Product } from "@/lib/platforms/types"
import { prisma } from "./client"

/**
 * 單一使用者可追蹤的商品數上限。
 *
 * 除了避免濫用，也是為了讓「我的追蹤」清單能塞進一則 Carousel（上限 12 張）
 * 而不需要分頁。
 */
export const MAX_TRACKED_PER_USER = 10

export type TrackResult =
  | { kind: "added" }
  | { kind: "already_tracked" }
  | { kind: "limit_reached"; limit: number }

/** 加入追蹤。已在追蹤中或超過上限時不寫入，並回報原因讓呼叫端給出明確訊息 */
export async function addTracking(lineUserId: string, product: Product): Promise<TrackResult> {
  const key = {
    lineUserId_platform_externalId: {
      lineUserId,
      platform: product.platform,
      externalId: product.externalId,
    },
  }

  const existing = await prisma.tracking.findUnique({ where: key })
  if (existing) return { kind: "already_tracked" }

  const count = await prisma.tracking.count({ where: { lineUserId } })
  if (count >= MAX_TRACKED_PER_USER) {
    return { kind: "limit_reached", limit: MAX_TRACKED_PER_USER }
  }

  await prisma.tracking.create({
    data: {
      lineUserId,
      platform: product.platform,
      externalId: product.externalId,
      priceAtTrack: product.currentPrice,
    },
  })

  return { kind: "added" }
}

/** 取消追蹤。回傳是否真的有刪到東西，讓呼叫端能區分「取消成功」與「本來就沒追蹤」 */
export async function removeTracking(
  lineUserId: string,
  platform: Platform,
  externalId: string
): Promise<boolean> {
  const result = await prisma.tracking.deleteMany({
    where: { lineUserId, platform, externalId },
  })
  return result.count > 0
}

export type TrackedItem = {
  product: Product
  /** 加入追蹤當下的價格，用於計算變化 */
  priceAtTrack: number
}

/**
 * 列出使用者追蹤中的商品，附上目前已知價格。
 *
 * 價格取自 Product 表（由每日回檢排程更新），不即時查詢外部 API——
 * 一次列出 10 個商品若都打外部 API，會超出 LINE 的回覆時限。
 */
export async function listTracked(lineUserId: string): Promise<TrackedItem[]> {
  const trackings = await prisma.tracking.findMany({
    where: { lineUserId },
    orderBy: { createdAt: "desc" },
  })

  if (trackings.length === 0) return []

  const products = await prisma.product.findMany({
    where: {
      OR: trackings.map((t) => ({ platform: t.platform, externalId: t.externalId })),
    },
  })

  const byKey = new Map(products.map((p) => [`${p.platform}/${p.externalId}`, p]))

  return trackings.flatMap((tracking) => {
    const row = byKey.get(`${tracking.platform}/${tracking.externalId}`)
    // 商品紀錄不知何故消失時略過該筆，不讓整份清單失敗
    if (!row) return []

    return [
      {
        product: {
          platform: row.platform as Platform,
          externalId: row.externalId,
          title: row.title,
          imageUrl: row.imageUrl,
          productUrl: row.productUrl,
          currentPrice: row.currentPrice,
          originalPrice: row.originalPrice,
        },
        priceAtTrack: tracking.priceAtTrack,
      },
    ]
  })
}
