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

/**
 * 把電商 API 回傳的價格字串（例如 "299.00"）轉成「分」的整數。
 *
 * 刻意不用 `Math.round(parseFloat(s) * 100)`：浮點乘法會有誤差，
 * 例如 `19.99 * 100 === 1998.9999999999998`，四捨五入雖然多半正確，
 * 但在某些數值會差一分。改用字串拆解小數點，完全避開浮點運算。
 *
 * @returns 分為單位的整數；無法解析回 null
 */
export function parsePriceToCents(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null

  const text = String(raw).trim()
  if (!/^\d+(\.\d+)?$/.test(text)) return null

  const [whole, fraction = ""] = text.split(".")
  // 補足或截斷到兩位小數
  const cents = `${fraction}00`.slice(0, 2)
  return Number(whole) * 100 + Number(cents)
}

/** 計算折扣百分比，例如原價 1000 現價 700 → 30（代表折 30%） */
export function discountPercent(currentPrice: number, originalPrice: number): number {
  if (originalPrice <= 0 || currentPrice >= originalPrice) return 0
  return Math.round((1 - currentPrice / originalPrice) * 100)
}
