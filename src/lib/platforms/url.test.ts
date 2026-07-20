import { describe, expect, it } from "vitest"
import { extractUrls } from "./url"

describe("extractUrls", () => {
  it("從一段話中抽出網址", () => {
    expect(extractUrls("這個好便宜 https://shopee.tw/product/123/456 快買")).toEqual([
      "https://shopee.tw/product/123/456",
    ])
  })

  it("抽出多個網址並保留順序", () => {
    expect(extractUrls("https://a.com/1 和 https://b.com/2")).toEqual([
      "https://a.com/1",
      "https://b.com/2",
    ])
  })

  it("網址後面緊接中文字要能正確切斷", () => {
    expect(extractUrls("https://shopee.tw/product/123/456好便宜")).toEqual([
      "https://shopee.tw/product/123/456",
    ])
  })

  it("網址後面接全形標點要能正確切斷", () => {
    expect(extractUrls("看這個 https://shopee.tw/product/1/2，超划算！")).toEqual([
      "https://shopee.tw/product/1/2",
    ])
  })

  it("沒有網址回空陣列", () => {
    expect(extractUrls("今天天氣真好")).toEqual([])
    expect(extractUrls("")).toEqual([])
  })

  it("http 與 https 都認得", () => {
    expect(extractUrls("http://a.com/1")).toEqual(["http://a.com/1"])
  })
})
