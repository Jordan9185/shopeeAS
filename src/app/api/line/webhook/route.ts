import { replyMessage } from "@/lib/line/client"
import { isTextMessageEvent, type LineWebhookBody, type LineWebhookEvent } from "@/lib/line/types"
import { verifyLineSignature } from "@/lib/line/verify"

// node:crypto 需要 Node runtime，不能跑在 Edge
export const runtime = "nodejs"
// Webhook 不可被快取
export const dynamic = "force-dynamic"

/**
 * LINE Webhook 端點。
 *
 * 回應碼的策略很重要：除了驗簽失敗回 401 之外，**一律回 200**。
 * 若回非 2xx，LINE 會重送同一批事件，且連續失敗會自動停用 Webhook。
 * 所以單一事件處理失敗必須自己吞掉，不能讓例外冒出來變成 500。
 */
export async function POST(request: Request) {
  // 驗簽必須用「原始字串」，不能先 parse 再 stringify
  const rawBody = await request.text()
  const signature = request.headers.get("x-line-signature")

  if (!verifyLineSignature(rawBody, signature, process.env.LINE_CHANNEL_SECRET ?? "")) {
    console.warn("[webhook] 簽章驗證失敗，拒絕請求")
    return new Response("Invalid signature", { status: 401 })
  }

  let body: LineWebhookBody
  try {
    body = JSON.parse(rawBody)
  } catch (error) {
    console.error("[webhook] 無法解析 request body:", error)
    // 驗簽已過表示確實來自 LINE，重送也不會變好，回 200 讓它別再送
    return new Response("OK", { status: 200 })
  }

  // 各事件獨立處理，一個失敗不影響其他事件
  await Promise.allSettled((body.events ?? []).map(handleEvent))

  return new Response("OK", { status: 200 })
}

async function handleEvent(event: LineWebhookEvent): Promise<void> {
  try {
    // 目前只處理文字訊息。join / follow / sticker 等一律略過。
    if (!isTextMessageEvent(event)) return

    const text = event.message.text.trim()

    // TODO(第 3 階段): 換成蝦皮網址解析 → 商品查詢 → Flex 卡片
    // 現在先回聲，用途是驗證整條管線（LINE → Vercel → 驗簽 → 回覆）是否暢通
    await replyMessage(event.replyToken, [{ type: "text", text }])
  } catch (error) {
    // 這裡吞掉例外是刻意的：單一事件失敗不該讓整個 webhook 回 500
    console.error("[webhook] 處理事件時發生錯誤:", error)
  }
}
