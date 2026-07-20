import { describe, expect, it } from "vitest"
import {
  buildShopeeUrl,
  fromExternalId,
  isShopeeUrl,
  isShortLink,
  parseShopeeIds,
  toExternalId,
} from "./url"

describe("isShopeeUrl", () => {
  it("認得蝦皮網域", () => {
    expect(isShopeeUrl("https://shopee.tw/product/1/2")).toBe(true)
    expect(isShopeeUrl("https://www.shopee.tw/product/1/2")).toBe(true)
    expect(isShopeeUrl("https://shp.ee/abc")).toBe(true)
    expect(isShopeeUrl("https://s.shopee.tw/abc")).toBe(true)
  })

  it("不可誤判仿冒網域", () => {
    // 這類網域常見於釣魚訊息，若用字串包含比對就會被騙過去
    expect(isShopeeUrl("https://shopee.tw.evil.com/product/1/2")).toBe(false)
    expect(isShopeeUrl("https://fakeshopee.tw/product/1/2")).toBe(false)
    expect(isShopeeUrl("https://evil.com/?x=shopee.tw")).toBe(false)
  })

  it("非網址不會拋例外", () => {
    expect(isShopeeUrl("這不是網址")).toBe(false)
    expect(isShopeeUrl("")).toBe(false)
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

  it("非蝦皮網域回 null", () => {
    expect(parseShopeeIds("https://shopee.tw.evil.com/product/1/2")).toBeNull()
  })

  it("短網址回 null（需先展開才能解析）", () => {
    expect(parseShopeeIds("https://shp.ee/abc123")).toBeNull()
  })
})

describe("externalId 轉換", () => {
  it("來回轉換不失真", () => {
    const ids = { shopId: 123456n, itemId: 9007199254740993n }
    expect(fromExternalId(toExternalId(ids))).toEqual(ids)
  })

  it("格式不符回 null", () => {
    expect(fromExternalId("not-an-id")).toBeNull()
    expect(fromExternalId("123")).toBeNull()
    expect(fromExternalId("123.456.789")).toBeNull()
  })

  it("由 ID 組回的網址可以再被解析", () => {
    const ids = { shopId: 111n, itemId: 222n }
    expect(parseShopeeIds(buildShopeeUrl(ids))).toEqual(ids)
  })
})
