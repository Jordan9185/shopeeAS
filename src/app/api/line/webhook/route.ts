import { recordObservation } from "@/lib/db/items"
import { replyMessage } from "@/lib/line/client"
import { buildCarousel, buildItemFlex } from "@/lib/line/flex"
import { extractMentionQuery } from "@/lib/line/mention"
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

    // 分支一：被 @ 標註 → 關鍵字搜尋
    const query = extractMentionQuery(event.message)
    if (query !== null) {
      await handleSearch(event.replyToken, query)
      return
    }

    // 分支二：訊息含蝦皮商品連結 → 單張商品卡
    const ids = await resolveShopeeIdsFromText(event.message.text)
    // 兩者皆非——靜默略過。
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

/** 一次搜尋回傳幾筆商品 */
const SEARCH_LIMIT = 5

/**
 * 處理關鍵字搜尋。
 *
 * 這條路徑一定是使用者主動 @ 觸發的，所以「查無結果」時**要**回覆——
 * 使用者明確問了問題卻毫無反應，會讓人以為機器人壞了。
 * 這與「沒被 @ 就靜默」並不衝突：前者是回應提問，後者是不主動插話。
 */
async function handleSearch(replyToken: string, query: string): Promise<void> {
  if (!query) {
    await replyMessage(replyToken, [{ type: "text", text: "想找什麼商品呢？例如：@我 降噪耳機" }])
    return
  }

  const provider = getShopeeProvider()
  const items = await provider.searchItems(query, SEARCH_LIMIT)

  if (items.length === 0) {
    await replyMessage(replyToken, [{ type: "text", text: `找不到「${query}」的相關商品` }])
    return
  }

  // 每筆結果都記錄觀測，讓之後有人貼這些商品的連結時已有價格歷史
  const entries = await Promise.all(
    items.map(async (item) => ({
      item,
      verdict: await recordObservation(item),
      affiliateUrl: await provider.generateAffiliateLink(buildShopeeUrl(item.shopId, item.itemId)),
    }))
  )

  await replyMessage(replyToken, [buildCarousel(entries, query)])
}
