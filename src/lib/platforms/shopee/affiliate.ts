import { parsePriceToCents } from "@/lib/pricing/price"
import type { Product } from "../types"
import { ShopeeProviderBase } from "./base"
import { buildAuthHeader } from "./signature"
import { buildShopeeUrl, fromExternalId, toExternalId } from "./url"

const DEFAULT_ENDPOINT = "https://open-api.affiliate.shopee.tw/graphql"
const REQUEST_TIMEOUT_MS = 8_000

/** 蝦皮回傳的商品節點。欄位名稱以官方文件為準，缺漏時視為無效資料 */
type OfferNode = {
  itemId?: number | string
  shopId?: number | string
  productName?: string
  imageUrl?: string
  price?: string | number
  priceMin?: string | number
  priceDiscountRate?: number
  productLink?: string
  offerLink?: string
}

type GraphQLResponse<T> = {
  data?: T
  errors?: { message: string }[]
}

/**
 * 蝦皮聯盟官方 API 實作。
 *
 * ⚠️ 尚未以真實憑證驗證過。簽章演算法有單元測試覆蓋，
 * 但 GraphQL 的欄位名稱與回應結構是依官方文件推導的，
 * 首次拿到憑證後必須實際打一次確認，並依實際回應調整 `toProduct`。
 */
export class ShopeeAffiliateProvider extends ShopeeProviderBase {
  constructor(
    private readonly appId: string,
    private readonly secret: string,
    private readonly endpoint: string = process.env.SHOPEE_AFFILIATE_ENDPOINT ?? DEFAULT_ENDPOINT
  ) {
    super()
  }

  /**
   * 送出 GraphQL 請求。
   *
   * payload 只序列化一次並同時用於簽章與送出——若分別序列化，
   * 兩者可能因鍵順序不同而不一致，伺服器會回 401 且不說明原因。
   */
  private async request<T>(query: string, variables?: Record<string, unknown>): Promise<T | null> {
    const payload = JSON.stringify(variables ? { query, variables } : { query })
    const timestamp = Math.floor(Date.now() / 1000)

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: buildAuthHeader({
            appId: this.appId,
            timestamp,
            payload,
            secret: this.secret,
          }),
        },
        body: payload,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      if (!response.ok) {
        const detail = await response.text().catch(() => "(無法讀取回應)")
        console.error(`[shopee-affiliate] HTTP ${response.status}: ${detail}`)
        return null
      }

      const body = (await response.json()) as GraphQLResponse<T>

      // GraphQL 即使出錯也常回 HTTP 200，錯誤在 body.errors 裡
      if (body.errors?.length) {
        console.error(
          "[shopee-affiliate] GraphQL 錯誤:",
          body.errors.map((e) => e.message)
        )
        return null
      }

      return body.data ?? null
    } catch (error) {
      console.error("[shopee-affiliate] 請求失敗:", error)
      return null
    }
  }

  /** 把 API 回傳的節點轉成內部的 Product。資料不完整時回 null */
  private toProduct(node: OfferNode): Product | null {
    if (node.itemId === undefined || node.shopId === undefined) return null

    const currentPrice = parsePriceToCents(node.price ?? node.priceMin)
    if (currentPrice === null) return null

    const ids = { shopId: BigInt(node.shopId), itemId: BigInt(node.itemId) }

    // 折扣率換算原價。API 未提供折扣時視為沒有原價，
    // 寧可不顯示也不要顯示一個推算錯誤的原價
    const rate = node.priceDiscountRate
    const originalPrice =
      typeof rate === "number" && rate > 0 && rate < 100
        ? Math.round(currentPrice / (1 - rate / 100))
        : null

    return {
      platform: "shopee",
      externalId: toExternalId(ids),
      title: node.productName ?? "（未提供商品名稱）",
      imageUrl: node.imageUrl ?? "",
      productUrl: node.productLink ?? buildShopeeUrl(ids),
      currentPrice,
      originalPrice,
    }
  }

  async getProduct(externalId: string): Promise<Product | null> {
    const ids = fromExternalId(externalId)
    if (!ids) return null

    const data = await this.request<{ productOfferV2: { nodes: OfferNode[] } }>(
      `query ProductOffer($itemId: Int64, $shopId: Int64) {
        productOfferV2(itemId: $itemId, shopId: $shopId) {
          nodes { itemId shopId productName imageUrl price priceDiscountRate productLink offerLink }
        }
      }`,
      { itemId: Number(ids.itemId), shopId: Number(ids.shopId) }
    )

    const node = data?.productOfferV2?.nodes?.[0]
    return node ? this.toProduct(node) : null
  }

  async searchProducts(keyword: string, limit: number): Promise<Product[]> {
    if (!keyword.trim()) return []

    const data = await this.request<{ productOfferV2: { nodes: OfferNode[] } }>(
      `query SearchOffers($keyword: String, $limit: Int) {
        productOfferV2(keyword: $keyword, limit: $limit) {
          nodes { itemId shopId productName imageUrl price priceDiscountRate productLink offerLink }
        }
      }`,
      { keyword, limit }
    )

    const nodes = data?.productOfferV2?.nodes ?? []
    return nodes.map((n) => this.toProduct(n)).filter((p): p is Product => p !== null)
  }

  async generateAffiliateLink(productUrl: string): Promise<string> {
    const data = await this.request<{ generateShortLink: { shortLink: string } }>(
      `mutation GenerateLink($input: GenerateShortLinkInput!) {
        generateShortLink(input: $input) { shortLink }
      }`,
      { input: { originUrl: productUrl, subIds: ["line_bot"] } }
    )

    // 產生失敗時退回原始網址：使用者至少拿得到能用的連結，
    // 只是這一筆不會有分潤。比回傳錯誤或空白好。
    const shortLink = data?.generateShortLink?.shortLink
    if (!shortLink) {
      console.warn("[shopee-affiliate] 短連結產生失敗，改用原始網址")
      return productUrl
    }
    return shortLink
  }
}
