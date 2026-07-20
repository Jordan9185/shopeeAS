/** 蝦皮專屬的網域判定與商品 ID 解析 */

/** 允許的網域。用完整比對而非 `includes`，避免 `shopee.tw.evil.com` 這類仿冒網域被誤判 */
const ALLOWED_HOSTS = new Set(["shopee.tw", "www.shopee.tw", "s.shopee.tw", "shp.ee"])
const SHORT_LINK_HOSTS = new Set(["s.shopee.tw", "shp.ee"])

/** 網址是否屬於蝦皮 */
export function isShopeeUrl(url: string): boolean {
  try {
    return ALLOWED_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

/** 是否為需要展開的短網址 */
export function isShortLink(url: string): boolean {
  try {
    return SHORT_LINK_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

export type ShopeeIds = { shopId: bigint; itemId: bigint }

/**
 * 從完整商品網址解析出 shopId 與 itemId。
 *
 * ID 用 BigInt：蝦皮的 itemid 會超過 `Number.MAX_SAFE_INTEGER`，
 * 用 Number 會在大數時靜默失真——查到錯的商品卻不會報錯。
 *
 * 支援格式：
 * - `/product/{shopId}/{itemId}`
 * - `/universal-link/product/{shopId}/{itemId}`
 * - `/{商品名稱}-i.{shopId}.{itemId}`（分享連結最常見）
 */
export function parseShopeeIds(url: string): ShopeeIds | null {
  let pathname: string
  try {
    const parsed = new URL(url)
    if (!ALLOWED_HOSTS.has(parsed.hostname)) return null
    pathname = parsed.pathname
  } catch {
    return null
  }

  const productMatch = pathname.match(/\/product\/(\d+)\/(\d+)/)
  if (productMatch) {
    return { shopId: BigInt(productMatch[1]), itemId: BigInt(productMatch[2]) }
  }

  const shareMatch = pathname.match(/-i\.(\d+)\.(\d+)/)
  if (shareMatch) {
    return { shopId: BigInt(shareMatch[1]), itemId: BigInt(shareMatch[2]) }
  }

  return null
}

/** externalId 格式：`{shopId}.{itemId}` */
export function toExternalId(ids: ShopeeIds): string {
  return `${ids.shopId}.${ids.itemId}`
}

/** 反解 externalId。格式不符回 null */
export function fromExternalId(externalId: string): ShopeeIds | null {
  const match = externalId.match(/^(\d+)\.(\d+)$/)
  if (!match) return null
  return { shopId: BigInt(match[1]), itemId: BigInt(match[2]) }
}

/** 由商品 ID 組出蝦皮的標準商品網址 */
export function buildShopeeUrl(ids: ShopeeIds): string {
  return `https://shopee.tw/product/${ids.shopId}/${ids.itemId}`
}
