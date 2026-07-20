import { discountPercent, formatPrice, type PriceVerdict } from "@/lib/shopee/price"
import type { ShopeeItem } from "@/lib/shopee/types"
import type { LineMessage } from "./client"

// 刻意不使用蝦皮品牌橘。高飽和的橘色會讓卡片看起來像廣告，
// 中性的深藍灰更像「資訊卡片」，由使用者自行判斷要不要買。
const TEXT_PRIMARY = "#1F2933"
const TEXT_MUTED = "#7B8794"
const BUTTON_COLOR = "#3E4C59"

type Badge = { text: string; color: string }

/**
 * 依比價結果決定標籤文字與顏色。
 *
 * 文案原則：只陳述觀測到的事實，不做價值判斷、不催促。
 * 「目前是觀測以來的最低價」是事實；「🔥 歷史新低！快搶」是推銷。
 * 後者會讓使用者感覺被推著走，長期反而損害信任。
 *
 * 措辭一律加上「觀測以來」的限定，因為本系統只看得到自己記錄過的價格，
 * 不等於這個商品真正的歷史最低價——不加限定就是誇大。
 */
function badgeFor(verdict: PriceVerdict): Badge {
  switch (verdict.kind) {
    case "new_low":
      return { text: "目前是觀測以來的最低價", color: "#2E7D5B" }
    case "tie_low":
      return { text: "與觀測到的最低價相同", color: TEXT_MUTED }
    case "above_low":
      return {
        text: `高於觀測到的最低價 $${formatPrice(verdict.gapFromLowest)}`,
        color: TEXT_MUTED,
      }
    case "first_seen":
      return { text: "首次收錄，開始記錄價格", color: TEXT_MUTED }
  }
}

/** LINE Carousel 上限為 12 個 bubble，但太多會讓使用者滑不完 */
const MAX_CAROUSEL_ITEMS = 10

/**
 * 把多個商品組成可左右滑動的 Carousel。
 *
 * @param entries 每筆包含商品、比價判定與分潤連結
 */
export function buildCarousel(
  entries: { item: ShopeeItem; verdict: PriceVerdict; affiliateUrl: string }[],
  keyword: string
): Extract<LineMessage, { type: "flex" }> {
  const limited = entries.slice(0, MAX_CAROUSEL_ITEMS)

  return {
    type: "flex",
    altText: `「${keyword}」的搜尋結果（${limited.length} 筆）`,
    contents: {
      type: "carousel",
      contents: limited.map((e) => buildBubble(e.item, e.verdict, e.affiliateUrl)),
    },
  }
}

/** 產生單一商品卡片 Flex Message */
export function buildItemFlex(
  item: ShopeeItem,
  verdict: PriceVerdict,
  affiliateUrl: string
): Extract<LineMessage, { type: "flex" }> {
  return {
    type: "flex",
    // 未支援 Flex 的環境（例如舊版 LINE、通知列）只看得到 altText
    altText: `${item.title} — $${formatPrice(item.currentPrice)}`,
    contents: buildBubble(item, verdict, affiliateUrl),
  }
}

/** 單一商品的 bubble。單張卡片與 Carousel 共用同一份樣式 */
function buildBubble(item: ShopeeItem, verdict: PriceVerdict, affiliateUrl: string) {
  const badge = badgeFor(verdict)
  const discount =
    item.originalPrice !== null ? discountPercent(item.currentPrice, item.originalPrice) : 0

  // 價格區：現價一定顯示；原價與折扣只在有原價且確實有折扣時才顯示
  const priceRow: unknown[] = [
    {
      type: "text",
      text: `$${formatPrice(item.currentPrice)}`,
      size: "xl",
      weight: "bold",
      color: TEXT_PRIMARY,
      flex: 0,
    },
  ]

  if (item.originalPrice !== null && discount > 0) {
    priceRow.push({
      type: "text",
      text: `$${formatPrice(item.originalPrice)}`,
      size: "sm",
      color: "#9AA5B1",
      decoration: "line-through",
      gravity: "bottom",
      margin: "sm",
      flex: 0,
    })
    priceRow.push({
      type: "text",
      // 折扣用中性灰而非紅色。紅色數字是廣告語彙，會催促決策
      text: `較原價少 ${discount}%`,
      size: "sm",
      color: TEXT_MUTED,
      gravity: "bottom",
      margin: "sm",
    })
  }

  return {
    type: "bubble",
    // kilo 比預設的 mega 窄一級，在群組裡不會佔掉整個畫面寬度
    size: "kilo",
    hero: {
      type: "image",
      url: item.imageUrl,
      size: "full",
      // 正方形。蝦皮商品圖本身就是 1:1，用其他比例會裁掉商品主體。
      // 卡片寬度是 kilo（窄一級），所以正方形圖不會像滿版時那麼佔高度
      aspectRatio: "1:1",
      aspectMode: "cover",
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "12px",
      contents: [
        {
          type: "text",
          text: badge.text,
          size: "xs",
          weight: "bold",
          color: badge.color,
        },
        {
          type: "text",
          text: item.title,
          weight: "bold",
          size: "md",
          wrap: true,
          maxLines: 2,
        },
        {
          type: "box",
          layout: "baseline",
          spacing: "sm",
          contents: priceRow,
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      paddingTop: "0px",
      contents: [
        {
          type: "button",
          // secondary 而非 primary：不強調、不誘導點擊
          style: "secondary",
          color: BUTTON_COLOR,
          height: "sm",
          action: {
            type: "uri",
            // 「查看」而非「購買」——決定權在使用者，機器人只提供資訊
            label: "在蝦皮查看",
            uri: affiliateUrl,
          },
        },
      ],
    },
  }
}
