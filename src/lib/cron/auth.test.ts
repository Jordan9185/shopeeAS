import { describe, expect, it } from "vitest"
import { isAuthorizedCronRequest } from "./auth"

const SECRET = "super-secret-value"

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/cron/refresh-prices", { headers })
}

describe("isAuthorizedCronRequest", () => {
  it("正確的 Bearer token 通過", () => {
    expect(isAuthorizedCronRequest(req({ authorization: `Bearer ${SECRET}` }), SECRET)).toBe(true)
  })

  it("錯誤的 token 拒絕", () => {
    expect(isAuthorizedCronRequest(req({ authorization: "Bearer wrong" }), SECRET)).toBe(false)
  })

  it("缺少 Authorization header 拒絕", () => {
    expect(isAuthorizedCronRequest(req(), SECRET)).toBe(false)
  })

  it("格式不對（沒有 Bearer 前綴）拒絕", () => {
    expect(isAuthorizedCronRequest(req({ authorization: SECRET }), SECRET)).toBe(false)
  })

  it("secret 未設定時一律拒絕，不可視為不需驗證", () => {
    // 若在此放行，等同於環境變數漏設時端點完全不設防
    expect(isAuthorizedCronRequest(req({ authorization: "Bearer anything" }), "")).toBe(false)
    expect(isAuthorizedCronRequest(req({ authorization: "Bearer " }), undefined)).toBe(false)
  })

  it("長度不同的 token 不可拋例外", () => {
    expect(() => isAuthorizedCronRequest(req({ authorization: "Bearer x" }), SECRET)).not.toThrow()
    expect(isAuthorizedCronRequest(req({ authorization: "Bearer x" }), SECRET)).toBe(false)
  })
})
