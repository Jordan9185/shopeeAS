import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * registry 在模組載入時就決定 provider，因此每個情境都要重置模組快取，
 * 否則第一個測試設定的環境變數會影響後續測試。
 */
async function loadRegistry(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return import("./registry")
}

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "info").mockImplementation(() => {})
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

describe("蝦皮 provider 的選擇", () => {
  it("預設（未設定）使用 mock", async () => {
    const { allProviders } = await loadRegistry({
      SHOPEE_PROVIDER: undefined,
      SHOPEE_APP_ID: undefined,
      SHOPEE_APP_SECRET: undefined,
    })
    expect(allProviders()[0].constructor.name).toBe("ShopeeMockProvider")
  })

  it("SHOPEE_PROVIDER=mock 使用 mock", async () => {
    const { allProviders } = await loadRegistry({ SHOPEE_PROVIDER: "mock" })
    expect(allProviders()[0].constructor.name).toBe("ShopeeMockProvider")
  })

  it("affiliate 且憑證齊全時使用官方 API", async () => {
    const { allProviders } = await loadRegistry({
      SHOPEE_PROVIDER: "affiliate",
      SHOPEE_APP_ID: "id",
      SHOPEE_APP_SECRET: "secret",
    })
    expect(allProviders()[0].constructor.name).toBe("ShopeeAffiliateProvider")
  })

  it("affiliate 但憑證缺漏時退回 mock，不可拋例外", async () => {
    // 部署時漏設環境變數是常見狀況。整個服務掛掉比用假資料更難察覺與修復
    const { allProviders } = await loadRegistry({
      SHOPEE_PROVIDER: "affiliate",
      SHOPEE_APP_ID: undefined,
      SHOPEE_APP_SECRET: undefined,
    })
    expect(allProviders()[0].constructor.name).toBe("ShopeeMockProvider")
  })

  it("affiliate 但只有 APP_ID 沒有 SECRET 也要退回 mock", async () => {
    const { allProviders } = await loadRegistry({
      SHOPEE_PROVIDER: "affiliate",
      SHOPEE_APP_ID: "id",
      SHOPEE_APP_SECRET: undefined,
    })
    expect(allProviders()[0].constructor.name).toBe("ShopeeMockProvider")
  })

  it("未知的設定值退回 mock", async () => {
    const { allProviders } = await loadRegistry({ SHOPEE_PROVIDER: "banana" })
    expect(allProviders()[0].constructor.name).toBe("ShopeeMockProvider")
  })
})

describe("依網址找 provider", () => {
  it("蝦皮網址找得到 provider", async () => {
    const { providerForUrl } = await loadRegistry({ SHOPEE_PROVIDER: "mock" })
    expect(providerForUrl("https://shopee.tw/product/1/2")?.platform).toBe("shopee")
  })

  it("非蝦皮網址回 null", async () => {
    const { providerForUrl } = await loadRegistry({ SHOPEE_PROVIDER: "mock" })
    expect(providerForUrl("https://www.google.com")).toBeNull()
    // 釣魚網域也不可匹配
    expect(providerForUrl("https://shopee.tw.evil.com/product/1/2")).toBeNull()
  })
})
