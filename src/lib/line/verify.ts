import crypto from "node:crypto"

/**
 * 驗證 LINE Webhook 請求的 `X-Line-Signature`。
 *
 * LINE 的規格是：對「原始 request body 字串」以 channel secret 做 HMAC-SHA256，
 * 再轉成 base64。因此呼叫端**必須**傳入未經 JSON.parse 的原始字串——
 * 先 parse 再 stringify 會因鍵順序或空白差異導致簽章對不上。
 *
 * @param rawBody   原始請求內容（`await request.text()`）
 * @param signature `X-Line-Signature` header 的值
 * @param channelSecret LINE channel secret
 */
export function verifyLineSignature(
  rawBody: string,
  signature: string | null | undefined,
  channelSecret: string
): boolean {
  // secret 沒設定時一律拒絕。若在這裡放行，等同於在環境變數漏設時
  // 讓 webhook 完全不設防，是最危險的失敗模式。
  if (!channelSecret) return false
  if (!signature) return false

  const expected = crypto.createHmac("sha256", channelSecret).update(rawBody, "utf8").digest()

  // 非法 base64 不會拋例外，只會解出長度不符的內容，由下方長度檢查擋掉
  const received = Buffer.from(signature, "base64")

  // timingSafeEqual 對長度不同的 Buffer 會拋 RangeError，必須先擋
  if (received.length !== expected.length) return false

  // 用時間恆定比較，避免透過回應時間差反推簽章
  return crypto.timingSafeEqual(received, expected)
}
