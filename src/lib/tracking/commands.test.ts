import { describe, expect, it } from "vitest"
import { parseCommand } from "./commands"

const URL = "https://shopee.tw/product/123/456"

describe("parseCommand", () => {
  it("「追蹤 <連結>」→ 加入追蹤", () => {
    expect(parseCommand(`追蹤 ${URL}`)).toEqual({ kind: "track", text: URL })
  })

  it("「取消追蹤 <連結>」→ 取消追蹤", () => {
    expect(parseCommand(`取消追蹤 ${URL}`)).toEqual({ kind: "untrack", text: URL })
  })

  it("「我的追蹤」→ 列出清單", () => {
    expect(parseCommand("我的追蹤")).toEqual({ kind: "list" })
    expect(parseCommand("追蹤清單")).toEqual({ kind: "list" })
    expect(parseCommand("我的清單")).toEqual({ kind: "list" })
  })

  it("「取消追蹤」必須優先於「追蹤」判斷", () => {
    // 若先比對「追蹤」，「取消追蹤 X」會被誤判為追蹤 "取消追蹤 X"
    const result = parseCommand(`取消追蹤 ${URL}`)
    expect(result.kind).toBe("untrack")
  })

  it("「我的追蹤」不可被當成「追蹤」指令", () => {
    expect(parseCommand("我的追蹤").kind).toBe("list")
  })

  it("一般文字 → 關鍵字搜尋", () => {
    expect(parseCommand("降噪耳機")).toEqual({ kind: "search", text: "降噪耳機" })
  })

  it("空字串 → 說明用法", () => {
    expect(parseCommand("")).toEqual({ kind: "help" })
    expect(parseCommand("   ")).toEqual({ kind: "help" })
  })

  it("「說明」「help」→ 說明用法", () => {
    expect(parseCommand("說明")).toEqual({ kind: "help" })
    expect(parseCommand("help")).toEqual({ kind: "help" })
    expect(parseCommand("HELP")).toEqual({ kind: "help" })
  })

  it("指令後沒有連結時，text 為空字串", () => {
    expect(parseCommand("追蹤")).toEqual({ kind: "track", text: "" })
    expect(parseCommand("取消追蹤")).toEqual({ kind: "untrack", text: "" })
  })

  it("指令與參數之間可有多個空白", () => {
    expect(parseCommand(`追蹤    ${URL}`)).toEqual({ kind: "track", text: URL })
  })

  it("搜尋關鍵字中若含「追蹤」二字不受影響", () => {
    // 只有開頭是指令詞才視為指令
    expect(parseCommand("運動追蹤手環")).toEqual({ kind: "search", text: "運動追蹤手環" })
  })
})
