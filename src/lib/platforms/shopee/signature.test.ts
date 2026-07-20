import crypto from "node:crypto"
import { describe, expect, it } from "vitest"
import { buildAuthHeader, signRequest } from "./signature"

const APP_ID = "test-app-id"
const SECRET = "test-secret"
const PAYLOAD = '{"query":"{ shopeeOfferV2 { nodes { offerLink } } }"}'
const TIMESTAMP = 1_700_000_000

describe("signRequest", () => {
  it("依官方規格計算 SHA256(AppId + Timestamp + Payload + Secret)", () => {
    const expected = crypto
      .createHash("sha256")
      .update(`${APP_ID}${TIMESTAMP}${PAYLOAD}${SECRET}`)
      .digest("hex")

    expect(
      signRequest({ appId: APP_ID, timestamp: TIMESTAMP, payload: PAYLOAD, secret: SECRET })
    ).toBe(expected)
  })

  it("payload 有任何差異就會產生不同簽章", () => {
    const base = { appId: APP_ID, timestamp: TIMESTAMP, secret: SECRET }
    const a = signRequest({ ...base, payload: PAYLOAD })
    const b = signRequest({ ...base, payload: `${PAYLOAD} ` })
    expect(a).not.toBe(b)
  })

  it("timestamp 不同就會產生不同簽章", () => {
    const base = { appId: APP_ID, payload: PAYLOAD, secret: SECRET }
    expect(signRequest({ ...base, timestamp: TIMESTAMP })).not.toBe(
      signRequest({ ...base, timestamp: TIMESTAMP + 1 })
    )
  })

  it("回傳小寫十六進位字串", () => {
    const sig = signRequest({
      appId: APP_ID,
      timestamp: TIMESTAMP,
      payload: PAYLOAD,
      secret: SECRET,
    })
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })

  it("串接時不可有任何分隔字元", () => {
    // 若實作誤加了分隔符（例如底線），結果會與官方規格不同
    const withSeparator = crypto
      .createHash("sha256")
      .update(`${APP_ID}_${TIMESTAMP}_${PAYLOAD}_${SECRET}`)
      .digest("hex")
    expect(
      signRequest({ appId: APP_ID, timestamp: TIMESTAMP, payload: PAYLOAD, secret: SECRET })
    ).not.toBe(withSeparator)
  })
})

describe("buildAuthHeader", () => {
  it("格式為 SHA256 Credential={AppId}, Timestamp={ts}, Signature={sig}", () => {
    const header = buildAuthHeader({
      appId: APP_ID,
      timestamp: TIMESTAMP,
      payload: PAYLOAD,
      secret: SECRET,
    })
    expect(header).toMatch(
      new RegExp(`^SHA256 Credential=${APP_ID}, Timestamp=${TIMESTAMP}, Signature=[0-9a-f]{64}$`)
    )
  })

  it("header 內不可洩漏 secret", () => {
    const header = buildAuthHeader({
      appId: APP_ID,
      timestamp: TIMESTAMP,
      payload: PAYLOAD,
      secret: SECRET,
    })
    expect(header).not.toContain(SECRET)
  })
})
