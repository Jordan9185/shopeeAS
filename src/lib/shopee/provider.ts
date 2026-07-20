import { MockShopeeProvider } from "./mock"
import type { ShopeeProvider } from "./types"

/**
 * 依環境變數決定用哪個資料來源。
 *
 * `SHOPEE_PROVIDER=mock`（預設）用假資料；`affiliate` 走蝦皮聯盟官方 API。
 * 聯盟 API 審核通過後，在此加上 AffiliateShopeeProvider 分支即可。
 */
export function getShopeeProvider(): ShopeeProvider {
  const kind = process.env.SHOPEE_PROVIDER ?? "mock"

  switch (kind) {
    case "mock":
      return new MockShopeeProvider()
    case "affiliate":
      // TODO(第 5 階段): 聯盟 API 審核通過後接上真實實作
      console.warn("[shopee] affiliate provider 尚未實作，暫時退回 mock")
      return new MockShopeeProvider()
    default:
      console.warn(`[shopee] 未知的 SHOPEE_PROVIDER="${kind}"，使用 mock`)
      return new MockShopeeProvider()
  }
}

/** 由商品 ID 組回蝦皮的標準商品網址 */
export function buildShopeeUrl(shopId: bigint, itemId: bigint): string {
  return `https://shopee.tw/product/${shopId}/${itemId}`
}
