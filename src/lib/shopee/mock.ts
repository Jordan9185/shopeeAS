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

  /**
   * Mock 搜尋：依關鍵字產生固定數量的假商品。
   *
   * itemId 由關鍵字雜湊而來，所以同一個關鍵字每次搜尋都會得到同一批商品，
   * 才能測出「搜尋到的商品再被貼一次連結」時的比價行為。
   */
  async searchItems(keyword: string, limit: number): Promise<ShopeeItem[]> {
    if (!keyword.trim()) return []

    // 簡單的字串雜湊，讓相同關鍵字產生相同結果
    let hash = 0
    for (const char of keyword) {
      hash = (hash * 31 + char.codePointAt(0)!) % 1_000_000
    }

    const results: ShopeeItem[] = []
    for (let i = 0; i < limit; i++) {
      const itemId = BigInt(hash + i * 7919)
      const item = await this.getItem(BigInt(88_000 + i), itemId)
      if (item) {
        results.push({ ...item, title: `【測試】${keyword} 相關商品 ${i + 1}` })
      }
    }
    return results
  }

  async generateAffiliateLink(originalUrl: string): Promise<string> {
    // 加上可辨識的追蹤參數，代表「這是分潤連結」
    const url = new URL(originalUrl)
    url.searchParams.set("aff_mock", "1")
    return url.toString()
  }
}
