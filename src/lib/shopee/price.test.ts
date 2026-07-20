import { describe, expect, it } from "vitest"
import { formatPrice, judgePrice } from "./price"

describe("judgePrice", () => {
  it("首次收錄不可宣稱為歷史最低", () => {
    // 第一次見到商品時 lowest 必然等於 current，此時掛「歷史最低」是誤導
    const verdict = judgePrice({ currentPrice: 29900, previousLowest: null })
    expect(verdict.kind).toBe("first_seen")
    expect(verdict.newLowest).toBe(29900)
  })

  it("低於歷史最低 → 歷史新低，並更新最低價", () => {
    const verdict = judgePrice({ currentPrice: 25000, previousLowest: 29900 })
    expect(verdict.kind).toBe("new_low")
    expect(verdict.newLowest).toBe(25000)
  })

  it("等於歷史最低 → 追平，最低價不變", () => {
    const verdict = judgePrice({ currentPrice: 29900, previousLowest: 29900 })
    expect(verdict.kind).toBe("tie_low")
    expect(verdict.newLowest).toBe(29900)
  })

  it("高於歷史最低 → 回報差距，最低價不變", () => {
    const verdict = judgePrice({ currentPrice: 32000, previousLowest: 29900 })
    expect(verdict.kind).toBe("above_low")
    expect(verdict.newLowest).toBe(29900)
    if (verdict.kind === "above_low") {
      expect(verdict.gapFromLowest).toBe(2100)
    }
  })

  it("歷史最低永遠不會被更高的價格覆蓋", () => {
    const verdict = judgePrice({ currentPrice: 99900, previousLowest: 10000 })
    expect(verdict.newLowest).toBe(10000)
  })
})

describe("formatPrice", () => {
  it("分轉成帶千分位的元", () => {
    expect(formatPrice(29900)).toBe("299")
    expect(formatPrice(150000)).toBe("1,500")
    expect(formatPrice(123456700)).toBe("1,234,567")
  })

  it("有小數的價格四捨五入到整數元", () => {
    expect(formatPrice(29950)).toBe("300")
  })

  it("零元不出錯", () => {
    expect(formatPrice(0)).toBe("0")
  })
})
