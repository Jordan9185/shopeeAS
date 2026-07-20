/**
 * 與平台無關的網址工具。
 *
 * 平台專屬的網域判定與 ID 解析屬於各 provider，不放在這裡。
 */

/**
 * 從一段文字中抽出所有 http(s) 網址。
 *
 * 網址結尾的判定刻意排除中文字元與全形標點，因為使用者很常
 * 把網址和中文黏在一起打（「...789012好便宜」）。
 */
export function extractUrls(text: string): string[] {
  return text.match(/https?:\/\/[^\s一-鿿，。！？、）】」]+/g) ?? []
}

/** 跟隨重定向的上限，防止惡意網址造成無限跳轉 */
const MAX_REDIRECTS = 5
const REDIRECT_TIMEOUT_MS = 5_000

/**
 * 逐次跟隨重定向，取得最終網址。
 *
 * 用 `redirect: "manual"` 自己控制跳轉，而非交給 fetch 自動處理，
 * 是為了能限制跳轉次數並在需要時檢查中途的每一個網址。
 */
export async function followRedirects(url: string): Promise<string | null> {
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
      console.error(`[platforms] 展開網址失敗 (${current}):`, error)
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

  console.warn(`[platforms] 重定向超過 ${MAX_REDIRECTS} 次，放棄: ${url}`)
  return null
}
