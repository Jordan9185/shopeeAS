const LINE_REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply"

/** LINE 訊息物件。文字訊息或 Flex Message */
export type LineMessage =
  | { type: "text"; text: string }
  | { type: "flex"; altText: string; contents: unknown }

/**
 * 以 reply token 回覆訊息。
 *
 * 只用 reply（不用 push）是刻意的：LINE 官方帳號免費方案對主動推播有
 * 每月 200 則的上限，但**回覆訊息不計入額度也無則數限制**。
 * 本機器人所有回應都是被動觸發，因此可長期跑在免費方案。
 *
 * reply token 效期僅約 1 分鐘且只能用一次，過期無法補救，故失敗不重試。
 *
 * @returns 是否成功送出
 */
export async function replyMessage(
  replyToken: string,
  messages: LineMessage[],
  accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
): Promise<boolean> {
  if (!accessToken) {
    console.error("[line] LINE_CHANNEL_ACCESS_TOKEN 未設定，無法回覆")
    return false
  }

  try {
    const response = await fetch(LINE_REPLY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ replyToken, messages }),
      // reply token 1 分鐘就過期，等太久沒有意義
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      // LINE 的錯誤訊息會說明是 token 過期、格式錯誤還是額度問題，值得完整記下來
      const detail = await response.text().catch(() => "(無法讀取回應內容)")
      console.error(`[line] 回覆失敗 HTTP ${response.status}: ${detail}`)
      return false
    }

    return true
  } catch (error) {
    console.error("[line] 呼叫 Reply API 時發生例外:", error)
    return false
  }
}
