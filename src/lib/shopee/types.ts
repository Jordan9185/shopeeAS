/** 蝦皮商品資訊。價格一律為「分」的整數（NT$299 → 29900） */
export type ShopeeItem = {
  shopId: bigint
  itemId: bigint
  title: string
  imageUrl: string
  /** 目前售價 */
  currentPrice: number
  /** 原價（劃線價）。蝦皮不一定提供 */
  originalPrice: number | null
}

/**
 * 商品資料來源。
 *
 * 抽成介面是為了在蝦皮聯盟 API 審核通過前，能用 Mock 跑通整條流程；
 * 審核通過後只要換實作，其餘程式碼不動。
 */
export interface ShopeeProvider {
  /** 取得商品資訊。查不到（下架、ID 錯誤、API 失敗）回 null */
  getItem(shopId: bigint, itemId: bigint): Promise<ShopeeItem | null>

  /**
   * 依關鍵字搜尋商品。查無結果或失敗時回空陣列。
   *
   * 注意：Mock 實作只能產生假結果，真正的搜尋需要蝦皮聯盟 API
   * 的 productOfferV2，必須等審核通過。
   */
  searchItems(keyword: string, limit: number): Promise<ShopeeItem[]>

  /** 產生分潤短連結。失敗時回傳原始網址，確保使用者至少拿得到可用連結 */
  generateAffiliateLink(originalUrl: string): Promise<string>
}
