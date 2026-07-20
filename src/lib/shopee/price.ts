/** 比價判定。純函式，不碰資料庫，方便單獨測試 */

export type PriceVerdict =
  /** 首次收錄：資料庫沒有歷史，不可宣稱為歷史最低 */
  | { kind: "first_seen"; newLowest: number }
  /** 比過往任何一次都便宜 */
  | { kind: "new_low"; newLowest: number }
  /** 與歷史最低同價 */
  | { kind: "tie_low"; newLowest: number }
  /** 高於歷史最低，附上差距 */
  | { kind: "above_low"; newLowest: number; gapFromLowest: number }

/**
 * 判定目前價格相對於歷史最低的狀態。
 *
 * `previousLowest` 為 null 代表資料庫中沒有這個商品——此時**刻意不判為歷史最低**。
 * 第一次觀測時最低價必然等於現價，掛上「🔥 歷史最低」對使用者是假資訊。
 */
export function judgePrice(input: {
  currentPrice: number
  previousLowest: number | null
}): PriceVerdict {
  const { currentPrice, previousLowest } = input

  if (previousLowest === null) {
    return { kind: "first_seen", newLowest: currentPrice }
  }

  if (currentPrice < previousLowest) {
    return { kind: "new_low", newLowest: currentPrice }
  }

  if (currentPrice === previousLowest) {
    return { kind: "tie_low", newLowest: previousLowest }
  }

  return {
    kind: "above_low",
    // 現價比較貴，歷史最低不可被覆蓋
    newLowest: previousLowest,
    gapFromLowest: currentPrice - previousLowest,
  }
}

/** 把「分」格式化成帶千分位的元，例如 29900 → "299" */
export function formatPrice(cents: number): string {
  return Math.round(cents / 100).toLocaleString("en-US")
}

/** 計算折扣百分比，例如原價 1000 現價 700 → 30（代表折 30%） */
export function discountPercent(currentPrice: number, originalPrice: number): number {
  if (originalPrice <= 0 || currentPrice >= originalPrice) return 0
  return Math.round((1 - currentPrice / originalPrice) * 100)
}
