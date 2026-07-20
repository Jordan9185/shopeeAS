/** 蝦皮商品網址的解析與短網址還原 */

/** 允許的網域。用完整比對而非 `includes`，避免 `shopee.tw.evil.com` 這類仿冒網域被誤判 */
const ALLOWED_HOSTS = new Set(["shopee.tw", "www.shopee.tw", "s.shopee.tw", "shp.ee"])
const SHORT_LINK_HOSTS = new Set(["s.shopee.tw", "shp.ee"])

/** 跟隨重定向的上限，防止惡意網址造成無限跳轉 */
const MAX_REDIRECTS = 5
const REDIRECT_TIMEOUT_MS = 5_000

/**
 * 從一段文字中抽出第一個蝦皮網址。
 *
 * 網址結尾的判定刻意排除中文字元與常見標點，因為使用者很常
 * 直接把網址和中文黏在一起打（「...789012好便宜」）。
 */
export function extractShopeeUrl(text: string): string | null {
  // 先粗略抓出所有 http(s) 開頭、到空白或中文字為止的片段
  const candidates = text.match(/https?:\/\/[^\s一-鿿，。！？、）】」]+/g)
  if (!candidates) return null

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate)
      // 用 hostname 完整比對，仿冒網域不會通過
      if (ALLOWED_HOSTS.has(url.hostname)) return candidate
    } catch {
      // 不是合法網址，換下一個
    }
  }
  return null
}

/** 判斷是否為需要展開的短網址 */
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
 * 蝦皮的 ID 會超過 `Number.MAX_SAFE_INTEGER`，因此一律用 BigInt，
 * 用 Number 會在大數時靜默失真。
 *
 * 支援的格式：
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

  // 格式一：.../product/{shopId}/{itemId}
  const productMatch = pathname.match(/\/product\/(\d+)\/(\d+)/)
  if (productMatch) {
    return { shopId: BigInt(productMatch[1]), itemId: BigInt(productMatch[2]) }
  }

  // 格式二：/{商品名稱}-i.{shopId}.{itemId}
  const shareMatch = pathname.match(/-i\.(\d+)\.(\d+)/)
  if (shareMatch) {
    return { shopId: BigInt(shareMatch[1]), itemId: BigInt(shareMatch[2]) }
  }

  return null
}

/**
 * 展開短網址，取得最終的完整網址。
 *
 * 用 `redirect: "manual"` 逐次跟隨，而非交給 fetch 自動處理，
 * 是為了能自己控制跳轉次數上限並在每一跳都驗證網域。
 *
 * @returns 最終網址；失敗回 null
 */
export async function resolveShortLink(url: string): Promise<string | null> {
  let current = url

  for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
    let response: Response
    try {
      response = await fetch(current, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(REDIRECT_TIMEOUT_MS),
      })
    } catch (error) {
      console.error(`[shopee] 展開短網址失敗 (${current}):`, error)
      return null
    }

    // 不是重定向，表示已到終點
    if (response.status < 300 || response.status >= 400) return current

    const location = response.headers.get("location")
    if (!location) return current

    // location 可能是相對路徑，用目前網址當基準解析
    try {
      current = new URL(location, current).toString()
    } catch {
      return null
    }
  }

  console.warn(`[shopee] 短網址跳轉超過 ${MAX_REDIRECTS} 次，放棄: ${url}`)
  return null
}

/**
 * 一站式：從使用者訊息取得商品 ID。
 * 短網址會自動展開，非蝦皮或非商品頁回 null。
 */
export async function resolveShopeeIdsFromText(text: string): Promise<ShopeeIds | null> {
  const url = extractShopeeUrl(text)
  if (!url) return null

  const fullUrl = isShortLink(url) ? await resolveShortLink(url) : url
  if (!fullUrl) return null

  return parseShopeeIds(fullUrl)
}
