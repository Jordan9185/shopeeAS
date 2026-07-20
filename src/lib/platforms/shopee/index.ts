import type { AffiliateProvider, Product } from "../types"
import { followRedirects } from "../url"
import {
  buildShopeeUrl,
  fromExternalId,
  isShopeeUrl,
  isShortLink,
  parseShopeeIds,
  toExternalId,
} from "./url"

/** 蝦皮平台的共通屬性，Mock 與正式實作共用 */
const SHOPEE_META = {
  platform: "shopee",
  displayName: "蝦皮購物",
  brandColor: "#EE4D2D",
} as const

/** 網址解析行為與資料來源無關，Mock 與正式實作共用這一份 */
abstract class ShopeeProviderBase implements AffiliateProvider {
  readonly platform = SHOPEE_META.platform
  readonly displayName = SHOPEE_META.displayName
  readonly brandColor = SHOPEE_META.brandColor

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

/**
 * Mock 實作，供蝦皮聯盟 API 審核通過前開發使用。
 *
 * 價格與商品由 ID 推導而非亂數，確保同一個商品每次查詢都得到相同結果，
 * 否則無法測出「第二次貼同商品」的比價行為。
 */
export class ShopeeMockProvider extends ShopeeProviderBase {
  async getProduct(externalId: string): Promise<Product | null> {
    const ids = fromExternalId(externalId)
    if (!ids) return null

    const seed = Number(ids.itemId % 1000n)
    const currentPrice = (299 + seed) * 100
    // 讓部分商品沒有原價，以測試卡片在缺欄位時的呈現
    const hasOriginal = seed % 3 !== 0

    return {
      platform: this.platform,
      externalId,
      title: `【測試商品】無線藍牙耳機 降噪版 #${ids.itemId}`,
      imageUrl: "https://placehold.co/600x600/ee4d2d/white?text=Shopee",
      productUrl: buildShopeeUrl(ids),
      currentPrice,
      originalPrice: hasOriginal ? Math.round(currentPrice * 1.4) : null,
    }
  }

  async searchProducts(keyword: string, limit: number): Promise<Product[]> {
    if (!keyword.trim()) return []

    // 簡單雜湊，讓相同關鍵字每次都產生同一批商品
    let hash = 0
    for (const char of keyword) {
      hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 1_000_000
    }

    const results: Product[] = []
    for (let i = 0; i < limit; i++) {
      const externalId = `${88_000 + i}.${hash + i * 7919}`
      const product = await this.getProduct(externalId)
      if (product) {
        results.push({ ...product, title: `【測試】${keyword} 相關商品 ${i + 1}` })
      }
    }
    return results
  }

  async generateAffiliateLink(productUrl: string): Promise<string> {
    const url = new URL(productUrl)
    url.searchParams.set("aff_mock", "1")
    return url.toString()
  }
}
