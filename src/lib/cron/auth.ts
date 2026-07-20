import crypto from "node:crypto"

/**
 * 驗證 Vercel Cron 的請求。
 *
 * Vercel 在設定了 `CRON_SECRET` 環境變數後，觸發排程時會自動帶上
 * `Authorization: Bearer <CRON_SECRET>`。
 *
 * 這個端點掛在公開網址上，沒有驗證的話任何人都能反覆觸發，
 * 造成資料庫負載與第三方 API 額度被耗盡。
 */
export function isAuthorizedCronRequest(
  request: Request,
  secret: string | undefined | null
): boolean {
  // secret 沒設定時一律拒絕。放行等同於漏設環境變數時完全不設防
  if (!secret) return false

  const header = request.headers.get("authorization")
  if (!header?.startsWith("Bearer ")) return false

  const provided = Buffer.from(header.slice("Bearer ".length))
  const expected = Buffer.from(secret)

  // timingSafeEqual 對長度不同的 Buffer 會拋 RangeError，必須先擋
  if (provided.length !== expected.length) return false

  return crypto.timingSafeEqual(provided, expected)
}
