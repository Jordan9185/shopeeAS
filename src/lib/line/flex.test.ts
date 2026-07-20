import { describe, expect, it } from "vitest"
import type { PriceVerdict } from "@/lib/shopee/price"
import type { ShopeeItem } from "@/lib/shopee/types"
import { buildItemFlex } from "./flex"

const ITEM: ShopeeItem = {
  shopId: 123n,
  itemId: 456n,
  title: "無線藍牙耳機 降噪版",
  imageUrl: "https://example.com/img.jpg",
  currentPrice: 29900,
  originalPrice: 49900,
}

const AFF_URL = "https://shopee.tw/product/123/456?aff_mock=1"

/** 把 Flex 結構攤平成字串，方便斷言某段文字是否出現 */
function flatten(message: unknown): string {
  return JSON.stringify(message)
}

describe("buildItemFlex", () => {
  it("altText 要含商品標題，讓未支援 Flex 的裝置也看得懂", () => {
    const verdict: PriceVerdict = { kind: "first_seen", newLowest: 29900 }
    const message = buildItemFlex(ITEM, verdict, AFF_URL)
    expect(message.type).toBe("flex")
    expect(message.altText).toContain("無線藍牙耳機")
  })

  it("按鈕要連到分潤連結，不是原始網址", () => {
    const verdict: PriceVerdict = { kind: "first_seen", newLowest: 29900 }
    expect(flatten(buildItemFlex(ITEM, verdict, AFF_URL))).toContain("aff_mock=1")
  })

  it("首次收錄不可出現任何「最低價」宣稱", () => {
    const verdict: PriceVerdict = { kind: "first_seen", newLowest: 29900 }
    const text = flatten(buildItemFlex(ITEM, verdict, AFF_URL))
    expect(text).toContain("首次收錄")
    expect(text).not.toContain("最低")
  })

  it("觀測以來的最低價要標示出來", () => {
    const verdict: PriceVerdict = { kind: "new_low", newLowest: 25000 }
    expect(flatten(buildItemFlex(ITEM, verdict, AFF_URL))).toContain("最低")
  })

  it("與最低價相同時要標示出來", () => {
    const verdict: PriceVerdict = { kind: "tie_low", newLowest: 29900 }
    expect(flatten(buildItemFlex(ITEM, verdict, AFF_URL))).toContain("相同")
  })

  it("文案不可含煽動性字眼或推銷 emoji", () => {
    const verdicts: PriceVerdict[] = [
      { kind: "first_seen", newLowest: 29900 },
      { kind: "new_low", newLowest: 25000 },
      { kind: "tie_low", newLowest: 29900 },
      { kind: "above_low", newLowest: 25000, gapFromLowest: 4900 },
    ]
    for (const verdict of verdicts) {
      const text = flatten(buildItemFlex(ITEM, verdict, AFF_URL))
      for (const banned of ["🔥", "快搶", "限時", "必買", "手刀", "錯過"]) {
        expect(text).not.toContain(banned)
      }
    }
  })

  it("高於歷史低點要顯示差距金額", () => {
    const verdict: PriceVerdict = { kind: "above_low", newLowest: 25000, gapFromLowest: 4900 }
    // 4900 分 = 49 元
    expect(flatten(buildItemFlex(ITEM, verdict, AFF_URL))).toContain("49")
  })

  it("有原價時顯示原價與折扣", () => {
    const verdict: PriceVerdict = { kind: "first_seen", newLowest: 29900 }
    const text = flatten(buildItemFlex(ITEM, verdict, AFF_URL))
    expect(text).toContain("499") // 原價
    expect(text).toContain("40%") // (1 - 299/499) ≈ 40%
  })

  it("沒有原價時不可顯示折扣，也不可出現 NaN 或 null", () => {
    const noOriginal: ShopeeItem = { ...ITEM, originalPrice: null }
    const verdict: PriceVerdict = { kind: "first_seen", newLowest: 29900 }
    const text = flatten(buildItemFlex(noOriginal, verdict, AFF_URL))
    expect(text).not.toContain("NaN")
    expect(text).not.toContain("null")
    expect(text).not.toContain("%")
  })

  it("價格要有千分位，不可出現未格式化的分", () => {
    const pricey: ShopeeItem = { ...ITEM, currentPrice: 1234500, originalPrice: null }
    const verdict: PriceVerdict = { kind: "first_seen", newLowest: 1234500 }
    const text = flatten(buildItemFlex(pricey, verdict, AFF_URL))
    expect(text).toContain("12,345")
    expect(text).not.toContain("1234500")
  })
})
