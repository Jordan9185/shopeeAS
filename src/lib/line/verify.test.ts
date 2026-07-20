import crypto from "node:crypto"
import { describe, expect, it } from "vitest"
import { verifyLineSignature } from "./verify"

const SECRET = "test-channel-secret"
const BODY = JSON.stringify({ events: [{ type: "message" }] })

/** 產生 LINE 官方規格的簽章：HMAC-SHA256(body, secret) 後轉 base64 */
function sign(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64")
}

describe("verifyLineSignature", () => {
  it("正確的簽章要通過", () => {
    expect(verifyLineSignature(BODY, sign(BODY, SECRET), SECRET)).toBe(true)
  })

  it("body 被竄改要失敗", () => {
    const signature = sign(BODY, SECRET)
    const tampered = JSON.stringify({ events: [{ type: "message", evil: true }] })
    expect(verifyLineSignature(tampered, signature, SECRET)).toBe(false)
  })

  it("用錯誤的 secret 簽的要失敗", () => {
    expect(verifyLineSignature(BODY, sign(BODY, "wrong-secret"), SECRET)).toBe(false)
  })

  it("缺少簽章要失敗", () => {
    expect(verifyLineSignature(BODY, null, SECRET)).toBe(false)
    expect(verifyLineSignature(BODY, "", SECRET)).toBe(false)
  })

  it("簽章格式不是合法 base64 也不能拋例外，要回 false", () => {
    expect(() => verifyLineSignature(BODY, "!!!not-base64!!!", SECRET)).not.toThrow()
    expect(verifyLineSignature(BODY, "!!!not-base64!!!", SECRET)).toBe(false)
  })

  it("長度不同的簽章要失敗（timingSafeEqual 對長度不同會拋例外，必須先擋掉）", () => {
    expect(verifyLineSignature(BODY, "c2hvcnQ=", SECRET)).toBe(false)
  })

  it("空的 channel secret 要失敗，不可視為通過", () => {
    expect(verifyLineSignature(BODY, sign(BODY, ""), "")).toBe(false)
  })

  it("空 body 搭配正確簽章仍應通過（LINE 的連線驗證會送空 events）", () => {
    const emptyBody = JSON.stringify({ events: [] })
    expect(verifyLineSignature(emptyBody, sign(emptyBody, SECRET), SECRET)).toBe(true)
  })
})
