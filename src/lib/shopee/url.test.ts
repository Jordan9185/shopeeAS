import { describe, expect, it } from "vitest"
import { extractShopeeUrl, isShortLink, parseShopeeIds } from "./url"

describe("extractShopeeUrl", () => {
  it("從一段話中抽出蝦皮網址", () => {
    const text = "這個好便宜 https://shopee.tw/product/123/456 快買"
    expect(extractShopeeUrl(text)).toBe("https://shopee.tw/product/123/456")
  })

  it("抽得出短網址 shp.ee", () => {
    expect(extractShopeeUrl("看這個 https://shp.ee/abc123")).toBe("https://shp.ee/abc123")
  })

  it("抽得出短網址 s.shopee.tw", () => {
    expect(extractShopeeUrl("https://s.shopee.tw/xyz789 推薦")).toBe("https://s.shopee.tw/xyz789")
  })

  it("多個網址時只取第一個", () => {
    const text = "https://shopee.tw/product/1/2 還有 https://shopee.tw/product/3/4"
    expect(extractShopeeUrl(text)).toBe("https://shopee.tw/product/1/2")
  })

  it("沒有蝦皮網址回 null", () => {
    expect(extractShopeeUrl("今天天氣真好")).toBeNull()
    expect(extractShopeeUrl("https://www.google.com")).toBeNull()
    expect(extractShopeeUrl("")).toBeNull()
  })

  it("不可誤判仿冒網域", () => {
    // 這類網域常見於釣魚訊息，必須排除
    expect(extractShopeeUrl("https://shopee.tw.evil.com/product/1/2")).toBeNull()
    expect(extractShopeeUrl("https://fakeshopee.tw/product/1/2")).toBeNull()
  })

  it("網址後面緊接中文字要能正確切斷", () => {
    expect(extractShopeeUrl("https://shopee.tw/product/123/456好便宜")).toBe(
      "https://shopee.tw/product/123/456"
    )
  })
})

describe("parseShopeeIds", () => {
  it("解析 /product/{shopId}/{itemId} 格式", () => {
    expect(parseShopeeIds("https://shopee.tw/product/123456/789012")).toEqual({
      shopId: 123456n,
      itemId: 789012n,
    })
  })

  it("解析 -i.{shopId}.{itemId} 格式（分享連結最常見）", () => {
    expect(parseShopeeIds("https://shopee.tw/無線藍牙耳機-i.123456.789012")).toEqual({
      shopId: 123456n,
      itemId: 789012n,
    })
  })

  it("解析帶 query string 的網址", () => {
    expect(parseShopeeIds("https://shopee.tw/product/123/456?smtt=0.0.9")).toEqual({
      shopId: 123n,
      itemId: 456n,
    })
  })

  it("解析 universal-link 格式", () => {
    expect(parseShopeeIds("https://shopee.tw/universal-link/product/123/456")).toEqual({
      shopId: 123n,
      itemId: 456n,
    })
  })

  it("處理超過 Number.MAX_SAFE_INTEGER 的 ID 不失真", () => {
    // 蝦皮 itemid 會超過 2^53，用 Number 會被四捨五入，必須用 BigInt
    const huge = "https://shopee.tw/product/123/9007199254740993"
    expect(parseShopeeIds(huge)?.itemId).toBe(9007199254740993n)
  })

  it("非商品頁回 null", () => {
    expect(parseShopeeIds("https://shopee.tw/")).toBeNull()
    expect(parseShopeeIds("https://shopee.tw/mall/search?keyword=abc")).toBeNull()
  })

  it("短網址回 null（需先展開才能解析）", () => {
    expect(parseShopeeIds("https://shp.ee/abc123")).toBeNull()
  })
})

describe("isShortLink", () => {
  it("認得出短網址", () => {
    expect(isShortLink("https://shp.ee/abc")).toBe(true)
    expect(isShortLink("https://s.shopee.tw/abc")).toBe(true)
  })

  it("完整網址不算短網址", () => {
    expect(isShortLink("https://shopee.tw/product/1/2")).toBe(false)
  })
})
