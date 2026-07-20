/** 使用者 @ 機器人之後的指令解析 */

export type Command =
  | { kind: "track"; text: string }
  | { kind: "untrack"; text: string }
  | { kind: "list" }
  | { kind: "search"; text: string }
  | { kind: "help" }

/** 列出追蹤清單的說法。使用者不會只用一種講法，多收幾個同義詞 */
const LIST_KEYWORDS = ["我的追蹤", "追蹤清單", "我的清單", "追蹤列表"]
const HELP_KEYWORDS = ["說明", "help", "使用說明", "怎麼用"]

/**
 * 解析指令。
 *
 * 判斷順序很重要：「取消追蹤」必須在「追蹤」之前比對，
 * 否則 `取消追蹤 <網址>` 會被前綴比對成 track 指令。
 * 同理，完全相符的清單關鍵字要在前綴比對之前處理。
 */
export function parseCommand(raw: string): Command {
  const text = raw.trim()

  if (!text) return { kind: "help" }
  if (HELP_KEYWORDS.includes(text.toLowerCase())) return { kind: "help" }
  if (LIST_KEYWORDS.includes(text)) return { kind: "list" }

  // 先比對較長的「取消追蹤」，再比對「追蹤」
  const untrack = stripPrefix(text, "取消追蹤")
  if (untrack !== null) return { kind: "untrack", text: untrack }

  const track = stripPrefix(text, "追蹤")
  if (track !== null) return { kind: "track", text: track }

  return { kind: "search", text }
}

/**
 * 若字串以 prefix 開頭，回傳去掉前綴並去除頭尾空白的剩餘部分；否則回 null。
 *
 * 只認「開頭」是刻意的：使用者搜尋「運動追蹤手環」時，
 * 不該因為字串中間含有「追蹤」就被當成指令。
 */
function stripPrefix(text: string, prefix: string): string | null {
  if (!text.startsWith(prefix)) return null
  return text.slice(prefix.length).trim()
}
