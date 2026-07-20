import type { AffiliateProvider, Product } from "../types"
import { followRedirects } from "../url"
import { isShopeeUrl, isShortLink, parseShopeeIds, toExternalId } from "./url"

/**
 * 蝦皮各實作的共用部分。
 *
 * 網址判定與解析不依賴資料來源，Mock 與正式 API 實作共用同一份，
 * 避免兩邊各寫一次而行為不一致。
 */
export abstract class ShopeeProviderBase implements AffiliateProvider {
  readonly platform = "shopee" as const
  readonly displayName = "蝦皮購物"
  readonly brandColor = "#EE4D2D"

  matchesUrl(url: string): boolean {
    return isShopeeUrl(url)
  }

  parseUrl(url: string): string | null {
    const ids = parseShopeeIds(url)
    return ids ? toExternalId(ids) : null
  }

  async expandUrl(url: string): Promise<string | null> {
    return isShortLink(url) ? followRedirects(url) : url
  }

  abstract getProduct(externalId: string): Promise<Product | null>
  abstract searchProducts(keyword: string, limit: number): Promise<Product[]>
  abstract generateAffiliateLink(productUrl: string): Promise<string>
}
