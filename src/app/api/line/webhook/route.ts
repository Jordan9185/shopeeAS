import { recordObservation } from "@/lib/db/products"
import { addTracking, listTracked, removeTracking } from "@/lib/db/tracking"
import { replyMessage } from "@/lib/line/client"
import {
  buildCarousel,
  buildItemFlex,
  buildTrackedCarousel,
  type CardEntry,
  type TrackedEntry,
} from "@/lib/line/flex"
import { extractMentionQuery } from "@/lib/line/mention"
import {
  isTextMessageEvent,
  type LineSource,
  type LineWebhookBody,
  type LineWebhookEvent,
} from "@/lib/line/types"
import { verifyLineSignature } from "@/lib/line/verify"
import { allProviders, providerFor } from "@/lib/platforms/registry"
import { resolveProductFromText } from "@/lib/platforms/resolve"
import type { AffiliateProvider, Product } from "@/lib/platforms/types"
import { formatPrice } from "@/lib/pricing/price"
import { parseCommand } from "@/lib/tracking/commands"

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

    // 分支一：被 @ 標註 → 依指令處理
    const query = extractMentionQuery(event.message)
    if (query !== null) {
      await handleCommand(event.replyToken, query, event.source)
      return
    }

    // 分支二：訊息含商品連結 → 單張商品卡
    await handleProductLink(event.replyToken, event.message.text)
  } catch (error) {
    // 這裡吞掉例外是刻意的：單一事件失敗不該讓整個 webhook 回 500
    console.error("[webhook] 處理事件時發生錯誤:", error)
  }
}

/** 把商品組成卡片所需的資料：寫入觀測紀錄並產生分潤連結 */
async function toCardEntry(provider: AffiliateProvider, product: Product): Promise<CardEntry> {
  return {
    product,
    verdict: await recordObservation(product),
    affiliateUrl: await provider.generateAffiliateLink(product.productUrl),
    platform: { displayName: provider.displayName, brandColor: provider.brandColor },
  }
}

async function handleProductLink(replyToken: string, text: string): Promise<void> {
  const resolved = await resolveProductFromText(text)
  // 訊息裡沒有任何平台認得的商品連結——靜默略過。
  // 群組中話多的機器人會被踢，寧可少回也不要洗頻。
  if (!resolved) return

  const { provider, externalId } = resolved
  const product = await provider.getProduct(externalId)
  if (!product) {
    console.warn(`[webhook] 查不到商品 platform=${provider.platform} id=${externalId}`)
    return
  }

  await replyMessage(replyToken, [buildItemFlex(await toCardEntry(provider, product))])
}

const HELP_TEXT = [
  "可以這樣用我：",
  "",
  "・貼上商品連結 → 顯示價格資訊",
  "・@我 關鍵字 → 搜尋商品",
  "・@我 追蹤 商品連結 → 加入追蹤",
  "・@我 我的追蹤 → 查看追蹤清單與價格變化",
  "・@我 取消追蹤 商品連結 → 移除追蹤",
].join("\n")

/** 依解析出的指令分派 */
async function handleCommand(replyToken: string, query: string, source: LineSource): Promise<void> {
  const command = parseCommand(query)

  switch (command.kind) {
    case "help":
      await replyMessage(replyToken, [{ type: "text", text: HELP_TEXT }])
      return
    case "search":
      await handleSearch(replyToken, command.text)
      return
    case "track":
      await handleTrack(replyToken, command.text, source)
      return
    case "untrack":
      await handleUntrack(replyToken, command.text, source)
      return
    case "list":
      await handleList(replyToken, source)
      return
  }
}

/**
 * 取得發話者的 LINE userId。
 *
 * 群組事件中，若使用者未同意提供個人資料，`source.userId` 可能不存在。
 * 此時無法把追蹤紀錄綁到人，只能請他改用一對一聊天。
 */
function userIdOf(source: LineSource): string | null {
  return source.userId ?? null
}

const NEED_USER_ID_TEXT = "抱歉，這裡無法識別你的身分。請直接加我好友、在一對一聊天中使用追蹤功能。"

async function handleTrack(replyToken: string, text: string, source: LineSource): Promise<void> {
  const userId = userIdOf(source)
  if (!userId) {
    await replyMessage(replyToken, [{ type: "text", text: NEED_USER_ID_TEXT }])
    return
  }

  const resolved = await resolveProductFromText(text)
  if (!resolved) {
    await replyMessage(replyToken, [
      { type: "text", text: "請一起附上商品連結，例如：@我 追蹤 https://shopee.tw/..." },
    ])
    return
  }

  const product = await resolved.provider.getProduct(resolved.externalId)
  if (!product) {
    await replyMessage(replyToken, [{ type: "text", text: "找不到這個商品，可能已經下架了" }])
    return
  }

  // 追蹤時一併記錄觀測，讓每日回檢排程之後會照顧到這個商品
  await recordObservation(product)
  const result = await addTracking(userId, product)

  const message =
    result.kind === "added"
      ? `已加入追蹤：${product.title}\n目前 $${formatPrice(product.currentPrice)}\n用「@我 我的追蹤」查看變化`
      : result.kind === "already_tracked"
        ? "這個商品已經在你的追蹤清單裡了"
        : `追蹤數量已達上限（${result.limit} 個），請先取消一些再加入`

  await replyMessage(replyToken, [{ type: "text", text: message }])
}

async function handleUntrack(replyToken: string, text: string, source: LineSource): Promise<void> {
  const userId = userIdOf(source)
  if (!userId) {
    await replyMessage(replyToken, [{ type: "text", text: NEED_USER_ID_TEXT }])
    return
  }

  const resolved = await resolveProductFromText(text)
  if (!resolved) {
    await replyMessage(replyToken, [{ type: "text", text: "請附上要取消追蹤的商品連結" }])
    return
  }

  const removed = await removeTracking(userId, resolved.provider.platform, resolved.externalId)
  await replyMessage(replyToken, [
    { type: "text", text: removed ? "已取消追蹤" : "這個商品不在你的追蹤清單裡" },
  ])
}

async function handleList(replyToken: string, source: LineSource): Promise<void> {
  const userId = userIdOf(source)
  if (!userId) {
    await replyMessage(replyToken, [{ type: "text", text: NEED_USER_ID_TEXT }])
    return
  }

  const tracked = await listTracked(userId)
  if (tracked.length === 0) {
    await replyMessage(replyToken, [
      { type: "text", text: "你還沒有追蹤任何商品。用「@我 追蹤 商品連結」加入吧" },
    ])
    return
  }

  const entries: TrackedEntry[] = []
  for (const item of tracked) {
    const provider = providerFor(item.product.platform)
    if (!provider) continue
    entries.push({
      product: item.product,
      priceAtTrack: item.priceAtTrack,
      affiliateUrl: await provider.generateAffiliateLink(item.product.productUrl),
      platform: { displayName: provider.displayName, brandColor: provider.brandColor },
    })
  }

  await replyMessage(replyToken, [buildTrackedCarousel(entries)])
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

  // 向所有啟用中的平台搜尋，結果合併呈現
  const perPlatform = await Promise.all(
    allProviders().map(async (provider) => {
      const products = await provider.searchProducts(query, SEARCH_LIMIT)
      return Promise.all(products.map((product) => toCardEntry(provider, product)))
    })
  )
  const entries = perPlatform.flat()

  if (entries.length === 0) {
    await replyMessage(replyToken, [{ type: "text", text: `找不到「${query}」的相關商品` }])
    return
  }

  await replyMessage(replyToken, [buildCarousel(entries, query)])
}
