import type { LineMentionee, LineTextMessage } from "./types"

/** 判斷某個標註是否指向本機器人 */
function isSelfMention(mentionee: LineMentionee, botUserId: string | undefined): boolean {
  // 新版 API 直接給 isSelf，最可靠
  if (mentionee.isSelf === true) return true
  // 舊版沒有 isSelf，退回比對 userId
  return Boolean(botUserId && mentionee.userId === botUserId)
}

/**
 * 從訊息中取出「@ 機器人之後的搜尋關鍵字」。
 *
 * 刻意用 LINE 提供的 mention 結構判定，而非比對機器人名稱字串：
 * 名稱可以被改、也可能有人在訊息裡打出一模一樣的文字，字串比對會誤判。
 *
 * @returns 關鍵字；沒有標註本機器人時回 null；只標註沒帶關鍵字時回空字串
 */
export function extractMentionQuery(
  message: LineTextMessage,
  botUserId: string | undefined = process.env.LINE_BOT_USER_ID
): string | null {
  const mentionees = message.mention?.mentionees
  if (!mentionees?.length) return null

  const selfMentions = mentionees.filter((m) => isSelfMention(m, botUserId))
  if (selfMentions.length === 0) return null

  // 由後往前切除。若由前往後，切掉第一段後後面每個 index 都會失效
  const ordered = [...selfMentions].sort((a, b) => b.index - a.index)

  let text = message.text
  for (const mention of ordered) {
    text = text.slice(0, mention.index) + text.slice(mention.index + mention.length)
  }

  return text.trim()
}
