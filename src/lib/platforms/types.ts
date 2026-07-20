/** 支援的電商平台代號。新增平台時在此加上，TypeScript 會強制其他地方一併處理 */
export type Platform = "shopee"

/** 平台商品。價格一律為「分」的整數（NT$299 → 29900） */
export type Product = {
  platform: Platform
  /** 該平台內唯一識別商品的字串 */
  externalId: string
  title: string
  imageUrl: string
  /** 原始商品網址，未加分潤參數 */
  productUrl: string
  currentPrice: number
  originalPrice: number | null
}

/**
 * 分潤平台的統一介面。
 *
 * 每個電商平台（蝦皮、momo…）實作一份，其餘程式碼只依賴這個介面，
 * 不知道也不在意背後是哪一家。新增平台時不需要改動 webhook 或卡片邏輯。
 */
export interface AffiliateProvider {
  readonly platform: Platform
  /** 顯示給使用者看的平台名稱，例如「蝦皮購物」 */
  readonly displayName: string
  /** 平台代表色（HEX）。僅用於卡片上的小標籤點綴，不用於按鈕或大面積填色 */
  readonly brandColor: string

  /** 這個網址是否屬於本平台 */
  matchesUrl(url: string): boolean

  /** 從網址解析出 externalId。非商品頁回 null */
  parseUrl(url: string): string | null

  /** 若為短網址則展開，回傳可解析的完整網址。不需展開時原樣回傳 */
  expandUrl(url: string): Promise<string | null>

  /** 取得商品資訊。查不到回 null */
  getProduct(externalId: string): Promise<Product | null>

  /** 關鍵字搜尋。查無結果或失敗回空陣列 */
  searchProducts(keyword: string, limit: number): Promise<Product[]>

  /** 產生分潤連結。失敗時回傳原始網址，確保使用者至少拿得到可用連結 */
  generateAffiliateLink(productUrl: string): Promise<string>
}
