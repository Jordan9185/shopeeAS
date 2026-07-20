import { discountPercent, formatPrice, type PriceVerdict } from "@/lib/shopee/price"
import type { ShopeeItem } from "@/lib/shopee/types"
import type { LineMessage } from "./client"

/** 蝦皮品牌橘，用在主要按鈕 */
const SHOPEE_ORANGE = "#EE4D2D"

type Badge = { text: string; color: string }

/**
 * 依比價結果決定標籤文字與顏色。
 *
 * 首次收錄刻意用中性的灰色與「首次收錄」字樣——此時沒有任何歷史可比，
 * 用紅色或「最低價」會讓使用者誤以為現在是好時機。
 */
function badgeFor(verdict: PriceVerdict): Badge {
  switch (verdict.kind) {
    case "new_low":
      return { text: "🔥 歷史新低", color: "#D0021B" }
    case "tie_low":
      return { text: "≡ 追平歷史最低", color: "#F5A623" }
    case "above_low":
      return { text: `距歷史低點 +$${formatPrice(verdict.gapFromLowest)}`, color: "#7B8794" }
    case "first_seen":
      return { text: "首次收錄，開始追蹤價格", color: "#7B8794" }
  }
}

/** 產生商品卡片 Flex Message */
export function buildItemFlex(
  item: ShopeeItem,
  verdict: PriceVerdict,
  affiliateUrl: string
): Extract<LineMessage, { type: "flex" }> {
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
      color: SHOPEE_ORANGE,
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
      text: `${discount}%off`,
      size: "sm",
      color: "#D0021B",
      weight: "bold",
      gravity: "bottom",
      margin: "sm",
    })
  }

  return {
    type: "flex",
    // 未支援 Flex 的環境（例如舊版 LINE、通知列）只看得到 altText
    altText: `${item.title} — $${formatPrice(item.currentPrice)}`,
    contents: {
      type: "bubble",
      // kilo 比預設的 mega 窄一級，在群組裡不會佔掉整個畫面寬度
      size: "kilo",
      hero: {
        type: "image",
        url: item.imageUrl,
        size: "full",
        // 用 20:13 而非 1:1。正方形圖在手機上很吃高度，
        // 而商品縮圖的重點是辨識，不需要完整呈現整張圖
        aspectRatio: "20:13",
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
            style: "primary",
            color: SHOPEE_ORANGE,
            height: "sm",
            action: {
              type: "uri",
              label: "前往蝦皮購買",
              uri: affiliateUrl,
            },
          },
        ],
      },
    },
  }
}
