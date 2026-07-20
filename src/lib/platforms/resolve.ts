import { providerForUrl } from "./registry"
import type { AffiliateProvider } from "./types"
import { extractUrls } from "./url"

export type ResolvedProduct = {
  provider: AffiliateProvider
  externalId: string
}

/**
 * 從使用者訊息中找出第一個可辨識的商品連結。
 *
 * 逐一嘗試訊息中的每個網址，交給認得它的平台解析；
 * 短網址會先展開。全部都不是商品頁時回 null。
 */
export async function resolveProductFromText(text: string): Promise<ResolvedProduct | null> {
  for (const url of extractUrls(text)) {
    const provider = providerForUrl(url)
    if (!provider) continue

    const fullUrl = await provider.expandUrl(url)
    if (!fullUrl) continue

    // 展開後的網址可能落到另一個平台（例如轉址服務），重新確認歸屬
    const finalProvider = providerForUrl(fullUrl) ?? provider
    const externalId = finalProvider.parseUrl(fullUrl)
    if (externalId) return { provider: finalProvider, externalId }
  }

  return null
}
