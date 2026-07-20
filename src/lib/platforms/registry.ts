import { ShopeeAffiliateProvider, ShopeeMockProvider } from "./shopee"
import type { AffiliateProvider, Platform } from "./types"

/**
 * 所有啟用中的平台。
 *
 * 新增平台（momo、PChome…）時，只要在這個陣列加一個實作即可，
 * webhook、卡片、資料庫層都不需要改動。
 */
function buildProviders(): AffiliateProvider[] {
  return [buildShopeeProvider()]
}

/**
 * 依環境變數選擇蝦皮的資料來源。
 *
 * 設成 affiliate 但憑證沒填時**退回 mock 而非直接失敗**：
 * 部署時漏設環境變數是常見狀況，讓機器人繼續用假資料運作，
 * 比整個服務掛掉容易察覺也容易修。日誌會明確說明原因。
 */
function buildShopeeProvider(): AffiliateProvider {
  const kind = process.env.SHOPEE_PROVIDER ?? "mock"

  if (kind === "affiliate") {
    const appId = process.env.SHOPEE_APP_ID
    const secret = process.env.SHOPEE_APP_SECRET

    if (appId && secret) {
      console.info("[platforms] 蝦皮使用聯盟官方 API")
      return new ShopeeAffiliateProvider(appId, secret)
    }

    console.warn(
      "[platforms] SHOPEE_PROVIDER=affiliate 但未設定 SHOPEE_APP_ID / SHOPEE_APP_SECRET，改用 mock"
    )
  } else if (kind !== "mock") {
    console.warn(`[platforms] 未知的 SHOPEE_PROVIDER="${kind}"，使用 mock`)
  }

  return new ShopeeMockProvider()
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
