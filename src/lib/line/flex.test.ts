import { describe, expect, it } from "vitest"
import type { Product } from "@/lib/platforms/types"
import type { PriceVerdict } from "@/lib/pricing/price"
import { buildCarousel, buildItemFlex, type CardEntry } from "./flex"

const PRODUCT: Product = {
  platform: "shopee",
  externalId: "123.456",
  title: "無線藍牙耳機 降噪版",
  imageUrl: "https://example.com/img.jpg",
  productUrl: "https://shopee.tw/product/123/456",
  currentPrice: 29900,
  originalPrice: 49900,
}

const SHOPEE_BADGE = { displayName: "蝦皮購物", brandColor: "#EE4D2D" }
const AFF_URL = "https://shopee.tw/product/123/456?aff_mock=1"

function entry(verdict: PriceVerdict, product: Product = PRODUCT): CardEntry {
  return { product, verdict, affiliateUrl: AFF_URL, platform: SHOPEE_BADGE }
}

/** 把 Flex 結構攤平成字串，方便斷言某段文字是否出現 */
function flatten(message: unknown): string {
  return JSON.stringify(message)
}

const FIRST_SEEN: PriceVerdict = { kind: "first_seen", newLowest: 29900 }

describe("buildItemFlex", () => {
  it("altText 要含商品標題，讓未支援 Flex 的裝置也看得懂", () => {
    const message = buildItemFlex(entry(FIRST_SEEN))
    expect(message.type).toBe("flex")
    expect(message.altText).toContain("無線藍牙耳機")
  })

  it("按鈕要連到分潤連結，不是原始網址", () => {
    expect(flatten(buildItemFlex(entry(FIRST_SEEN)))).toContain("aff_mock=1")
  })

  it("要顯示平台名稱與品牌色，讓使用者知道來源", () => {
    const text = flatten(buildItemFlex(entry(FIRST_SEEN)))
    expect(text).toContain("蝦皮購物")
    expect(text).toContain("#EE4D2D")
  })

  it("品牌色只用於小標籤，按鈕維持中性色", () => {
    const message = buildItemFlex(entry(FIRST_SEEN))
    const footer = flatten(
      (message.contents as { footer: unknown }).footer as Record<string, unknown>
    )
    // 按鈕區塊不得出現平台品牌色，否則卡片會變成該平台的廣告
    expect(footer).not.toContain("#EE4D2D")
  })

  it("首次收錄不可出現任何「最低價」宣稱", () => {
    const text = flatten(buildItemFlex(entry(FIRST_SEEN)))
    expect(text).toContain("首次收錄")
    expect(text).not.toContain("最低")
  })

  it("觀測以來的最低價要標示出來", () => {
    expect(flatten(buildItemFlex(entry({ kind: "new_low", newLowest: 25000 })))).toContain("最低")
  })

  it("與最低價相同時要標示出來", () => {
    expect(flatten(buildItemFlex(entry({ kind: "tie_low", newLowest: 29900 })))).toContain("相同")
  })

  it("高於歷史低點要顯示差距金額", () => {
    const verdict: PriceVerdict = { kind: "above_low", newLowest: 25000, gapFromLowest: 4900 }
    // 4900 分 = 49 元
    expect(flatten(buildItemFlex(entry(verdict)))).toContain("49")
  })

  it("有原價時顯示原價與折扣", () => {
    const text = flatten(buildItemFlex(entry(FIRST_SEEN)))
    expect(text).toContain("499") // 原價
    expect(text).toContain("40%") // (1 - 299/499) ≈ 40%
  })

  it("沒有原價時不可顯示折扣，也不可出現 NaN 或 null", () => {
    const text = flatten(buildItemFlex(entry(FIRST_SEEN, { ...PRODUCT, originalPrice: null })))
    expect(text).not.toContain("NaN")
    expect(text).not.toContain("null")
    expect(text).not.toContain("%")
  })

  it("價格要有千分位，不可出現未格式化的分", () => {
    const pricey: Product = { ...PRODUCT, currentPrice: 1234500, originalPrice: null }
    const text = flatten(buildItemFlex(entry({ kind: "first_seen", newLowest: 1234500 }, pricey)))
    expect(text).toContain("12,345")
    expect(text).not.toContain("1234500")
  })

  it("文案不可含煽動性字眼或推銷 emoji", () => {
    const verdicts: PriceVerdict[] = [
      FIRST_SEEN,
      { kind: "new_low", newLowest: 25000 },
      { kind: "tie_low", newLowest: 29900 },
      { kind: "above_low", newLowest: 25000, gapFromLowest: 4900 },
    ]
    for (const verdict of verdicts) {
      const text = flatten(buildItemFlex(entry(verdict)))
      for (const banned of ["🔥", "快搶", "限時", "必買", "手刀", "錯過"]) {
        expect(text).not.toContain(banned)
      }
    }
  })
})

describe("buildCarousel", () => {
  it("每個商品各一張卡片", () => {
    const message = buildCarousel([entry(FIRST_SEEN), entry(FIRST_SEEN)], "耳機")
    const contents = message.contents as { type: string; contents: unknown[] }
    expect(contents.type).toBe("carousel")
    expect(contents.contents).toHaveLength(2)
  })

  it("altText 要含關鍵字與筆數", () => {
    const message = buildCarousel([entry(FIRST_SEEN)], "耳機")
    expect(message.altText).toContain("耳機")
    expect(message.altText).toContain("1")
  })

  it("超過 LINE 上限時要截斷，不可送出過長的 Carousel", () => {
    const many = Array.from({ length: 20 }, () => entry(FIRST_SEEN))
    const contents = buildCarousel(many, "耳機").contents as { contents: unknown[] }
    expect(contents.contents.length).toBeLessThanOrEqual(12)
  })

  it("不同平台的商品可以並存於同一個 Carousel", () => {
    const momo: CardEntry = {
      product: { ...PRODUCT, platform: "shopee", externalId: "999.888" },
      verdict: FIRST_SEEN,
      affiliateUrl: "https://example.com/momo",
      platform: { displayName: "momo購物網", brandColor: "#D5006D" },
    }
    const text = flatten(buildCarousel([entry(FIRST_SEEN), momo], "耳機"))
    expect(text).toContain("蝦皮購物")
    expect(text).toContain("momo購物網")
    expect(text).toContain("#D5006D")
  })
})
