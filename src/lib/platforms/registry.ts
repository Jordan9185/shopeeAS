import { ShopeeMockProvider } from "./shopee"
import type { AffiliateProvider, Platform } from "./types"

/**
 * 所有啟用中的平台。
 *
 * 新增平台（momo、PChome…）時，只要在這個陣列加一個實作即可，
 * webhook、卡片、資料庫層都不需要改動。
 */
function buildProviders(): AffiliateProvider[] {
  const kind = process.env.SHOPEE_PROVIDER ?? "mock"

  if (kind === "affiliate") {
    // TODO: 蝦皮聯盟 API 審核通過後接上 ShopeeAffiliateProvider
    console.warn("[platforms] 蝦皮聯盟 API 實作尚未完成，暫時使用 mock")
  } else if (kind !== "mock") {
    console.warn(`[platforms] 未知的 SHOPEE_PROVIDER="${kind}"，使用 mock`)
  }

  return [new ShopeeMockProvider()]
}

// 每次冷啟動建立一次即可，provider 本身無狀態
const providers = buildProviders()

/** 全部啟用中的平台 */
export function allProviders(): AffiliateProvider[] {
  return providers
}

/** 找出能處理這個網址的平台。沒有平台認得就回 null */
export function providerForUrl(url: string): AffiliateProvider | null {
  return providers.find((p) => p.matchesUrl(url)) ?? null
}

/** 依平台代號取得 provider */
export function providerFor(platform: Platform): AffiliateProvider | null {
  return providers.find((p) => p.platform === platform) ?? null
}
