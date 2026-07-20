import { recordObservation } from "@/lib/db/items"
import { replyMessage } from "@/lib/line/client"
import { buildItemFlex } from "@/lib/line/flex"
import { isTextMessageEvent, type LineWebhookBody, type LineWebhookEvent } from "@/lib/line/types"
import { verifyLineSignature } from "@/lib/line/verify"
import { buildShopeeUrl, getShopeeProvider } from "@/lib/shopee/provider"
import { resolveShopeeIdsFromText } from "@/lib/shopee/url"

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

    const ids = await resolveShopeeIdsFromText(event.message.text)
    // 訊息沒有蝦皮商品連結——靜默略過。
    // 群組中話多的機器人會被踢，寧可少回也不要洗頻。
    if (!ids) return

    const provider = getShopeeProvider()
    const item = await provider.getItem(ids.shopId, ids.itemId)
    if (!item) {
      console.warn(`[webhook] 查不到商品 shop=${ids.shopId} item=${ids.itemId}`)
      return
    }

    // 寫入觀測紀錄並取得比價判定
    const verdict = await recordObservation(item)

    // 分潤連結失敗時 provider 會退回原始網址，使用者至少拿得到能用的連結
    const originalUrl = buildShopeeUrl(item.shopId, item.itemId)
    const affiliateUrl = await provider.generateAffiliateLink(originalUrl)

    await replyMessage(event.replyToken, [buildItemFlex(item, verdict, affiliateUrl)])
  } catch (error) {
    // 這裡吞掉例外是刻意的：單一事件失敗不該讓整個 webhook 回 500
    console.error("[webhook] 處理事件時發生錯誤:", error)
  }
}
