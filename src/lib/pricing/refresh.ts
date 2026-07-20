import { prisma } from "@/lib/db/client"
import { recordObservation } from "@/lib/db/products"
import { providerFor } from "@/lib/platforms/registry"
import type { Platform } from "@/lib/platforms/types"

/**
 * 單次回檢的商品數量上限。
 *
 * serverless 函式有執行時間限制，一次處理太多會逾時而整批失敗。
 * 依「最久沒更新」排序，所以即使一次處理不完，多跑幾天也會輪到，
 * 不會有商品永遠被忽略。
 */
const DEFAULT_BATCH_SIZE = 50

/** 同時發出的請求數。太高會觸發對方的速率限制 */
const CONCURRENCY = 5

export type RefreshSummary = {
  attempted: number
  updated: number
  failed: number
  newLows: number
}

/**
 * 回檢最久未更新的商品，重新取得價格並寫入。
 *
 * 這解決的是「資料過期」問題：沒有回檢的話，商品價格只會在有人
 * 貼連結時更新，資料庫裡可能躺著三個月前的價格，
 * 而卡片上的「觀測以來的最低價」就會是基於過期資料的錯誤判斷。
 */
export async function refreshStalePrices(batchSize = DEFAULT_BATCH_SIZE): Promise<RefreshSummary> {
  const stale = await prisma.product.findMany({
    orderBy: { updatedAt: "asc" },
    take: batchSize,
    select: { platform: true, externalId: true },
  })

  const summary: RefreshSummary = {
    attempted: stale.length,
    updated: 0,
    failed: 0,
    newLows: 0,
  }

  // 分批並行，避免一次打出太多請求
  for (let i = 0; i < stale.length; i += CONCURRENCY) {
    const chunk = stale.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      chunk.map((row) => refreshOne(row.platform as Platform, row.externalId))
    )

    for (const result of results) {
      if (result.status === "rejected" || result.value === null) {
        summary.failed++
        continue
      }
      summary.updated++
      if (result.value === "new_low") summary.newLows++
    }
  }

  return summary
}

/**
 * 回檢單一商品。
 *
 * @returns 比價結果種類；查不到商品或出錯時回 null
 */
async function refreshOne(platform: Platform, externalId: string): Promise<string | null> {
  const provider = providerFor(platform)
  if (!provider) {
    console.warn(`[refresh] 找不到 platform="${platform}" 的 provider，略過`)
    return null
  }

  try {
    const product = await provider.getProduct(externalId)
    if (!product) {
      // 商品下架或查詢失敗。保留既有紀錄不刪除——
      // 暫時查不到不代表商品永久消失，刪掉會連價格歷史一起失去
      console.warn(`[refresh] 查不到商品 ${platform}/${externalId}`)
      return null
    }

    const verdict = await recordObservation(product)
    return verdict.kind
  } catch (error) {
    console.error(`[refresh] 回檢 ${platform}/${externalId} 失敗:`, error)
    return null
  }
}
