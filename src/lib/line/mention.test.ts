import { describe, expect, it } from "vitest"
import { extractMentionQuery } from "./mention"
import type { LineTextMessage } from "./types"

const BOT_ID = "U521dec79741ed8c464798fca51e75f00"
const OTHER_ID = "Uother00000000000000000000000000"

function msg(text: string, mentionees?: unknown[]): LineTextMessage {
  return {
    type: "text",
    id: "1",
    text,
    ...(mentionees ? { mention: { mentionees } } : {}),
  } as LineTextMessage
}

describe("extractMentionQuery", () => {
  it("@機器人 加關鍵字 → 取出關鍵字", () => {
    const m = msg("@蝦皮小幫手 降噪耳機", [
      { index: 0, length: 7, type: "user", userId: BOT_ID, isSelf: true },
    ])
    expect(extractMentionQuery(m, BOT_ID)).toBe("降噪耳機")
  })

  it("mention 在句子中間也要能正確切除", () => {
    const m = msg("幫我找 @蝦皮小幫手 藍牙鍵盤", [
      { index: 4, length: 7, type: "user", userId: BOT_ID, isSelf: true },
    ])
    expect(extractMentionQuery(m, BOT_ID)).toBe("幫我找 藍牙鍵盤")
  })

  it("沒有 mention → null（一般聊天不可觸發）", () => {
    expect(extractMentionQuery(msg("今天好熱"), BOT_ID)).toBeNull()
  })

  it("@ 的是別人不是機器人 → null", () => {
    const m = msg("@小明 你看這個", [
      { index: 0, length: 3, type: "user", userId: OTHER_ID, isSelf: false },
    ])
    expect(extractMentionQuery(m, BOT_ID)).toBeNull()
  })

  it("同時 @ 別人和機器人 → 只切掉機器人的 mention", () => {
    const m = msg("@小明 @蝦皮小幫手 咖啡機", [
      { index: 0, length: 3, type: "user", userId: OTHER_ID, isSelf: false },
      { index: 4, length: 7, type: "user", userId: BOT_ID, isSelf: true },
    ])
    expect(extractMentionQuery(m, BOT_ID)).toBe("@小明 咖啡機")
  })

  it("只 @ 機器人沒有關鍵字 → 回空字串（呼叫端才知道要提示用法）", () => {
    const m = msg("@蝦皮小幫手", [
      { index: 0, length: 7, type: "user", userId: BOT_ID, isSelf: true },
    ])
    expect(extractMentionQuery(m, BOT_ID)).toBe("")
  })

  it("沒有 isSelf 欄位時改用 userId 比對（相容舊版 API）", () => {
    const m = msg("@蝦皮小幫手 滑鼠", [{ index: 0, length: 7, type: "user", userId: BOT_ID }])
    expect(extractMentionQuery(m, BOT_ID)).toBe("滑鼠")
  })

  it("isSelf 為 true 時，即使沒設定 botUserId 也要成立", () => {
    const m = msg("@蝦皮小幫手 螢幕", [
      { index: 0, length: 7, type: "user", userId: BOT_ID, isSelf: true },
    ])
    expect(extractMentionQuery(m, undefined)).toBe("螢幕")
  })

  it("多個 mention 時切除順序不可造成位移錯亂", () => {
    // 由後往前切除才不會讓前面的 index 失效
    const m = msg("@bot A @bot B", [
      { index: 0, length: 4, type: "user", userId: BOT_ID, isSelf: true },
      { index: 7, length: 4, type: "user", userId: BOT_ID, isSelf: true },
    ])
    expect(extractMentionQuery(m, BOT_ID)).toBe("A  B")
  })
})
