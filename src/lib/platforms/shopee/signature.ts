import crypto from "node:crypto"

export type SignatureInput = {
  appId: string
  /** Unix 時間（秒）。與伺服器時間差距過大會驗證失敗 */
  timestamp: number
  /** 實際送出的 request body 字串，必須與最後送出的內容完全一致 */
  payload: string
  secret: string
}

/**
 * 依蝦皮聯盟 API 規格計算簽章。
 *
 *     Signature = SHA256(AppId + Timestamp + Payload + Secret)
 *
 * 四個值直接串接，**中間不可有任何空白或分隔字元**。
 *
 * payload 必須是實際送出的 body 字串本身，不能重新序列化——
 * 重新 JSON.stringify 可能產生鍵順序或空白差異，簽章就會對不上，
 * 而伺服器只會回 401，不會告訴你差在哪裡。
 */
export function signRequest({ appId, timestamp, payload, secret }: SignatureInput): string {
  return crypto.createHash("sha256").update(`${appId}${timestamp}${payload}${secret}`).digest("hex")
}

/** 組出 Authorization header */
export function buildAuthHeader(input: SignatureInput): string {
  const signature = signRequest(input)
  return `SHA256 Credential=${input.appId}, Timestamp=${input.timestamp}, Signature=${signature}`
}
