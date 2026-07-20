import type { ShopeeItem, ShopeeProvider } from "./types"

/**
 * Mock 資料來源，供蝦皮聯盟 API 審核通過前開發使用。
 *
 * 價格用 itemId 推導而非亂數，這樣同一個商品連結每次貼都會得到相同價格，
 * 才能真的測出「第二次貼同商品」的比價行為。
 */
export class MockShopeeProvider implements ShopeeProvider {
  async getItem(shopId: bigint, itemId: bigint): Promise<ShopeeItem | null> {
    // 用 itemId 決定價格，讓結果可重現
    const seed = Number(itemId % 1000n)
    const currentPrice = (299 + seed) * 100
    // 讓部分商品沒有原價，測試卡片在缺欄位時的呈現
    const hasOriginal = seed % 3 !== 0

    return {
      shopId,
      itemId,
      title: `【測試商品】無線藍牙耳機 降噪版 #${itemId}`,
      imageUrl: "https://placehold.co/600x600/ee4d2d/white?text=Shopee",
      currentPrice,
      originalPrice: hasOriginal ? Math.round(currentPrice * 1.4) : null,
    }
  }

  async generateAffiliateLink(originalUrl: string): Promise<string> {
    // 加上可辨識的追蹤參數，代表「這是分潤連結」
    const url = new URL(originalUrl)
    url.searchParams.set("aff_mock", "1")
    return url.toString()
  }
}
