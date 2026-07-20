import type { Product } from "@/lib/platforms/types"
import { discountPercent, formatPrice, type PriceVerdict } from "@/lib/pricing/price"
import type { LineMessage } from "./client"

// 卡片本身刻意保持中性配色。平台品牌色只用在頂部的小標籤點綴——
// 整張卡片套用電商的品牌色會有兩個問題：看起來像廣告，
// 以及讓人誤以為這是該平台官方發出的訊息。
const TEXT_PRIMARY = "#1F2933"
const TEXT_MUTED = "#7B8794"
const BUTTON_COLOR = "#3E4C59"

/** 卡片上需要的平台資訊。只取用到的欄位，不依賴整個 provider */
export type PlatformBadge = {
  displayName: string
  brandColor: string
}

type Badge = { text: string; color: string }

/**
 * 依比價結果決定標籤文字與顏色。
 *
 * 文案原則：只陳述觀測到的事實，不做價值判斷、不催促。
 *
 * 措辭一律加上「觀測以來」的限定，因為本系統只看得到自己記錄過的價格，
 * 不等於商品真正的歷史最低價——不加限定就是誇大。
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

export type CardEntry = {
  product: Product
  verdict: PriceVerdict
  affiliateUrl: string
  platform: PlatformBadge
}

/** 把多個商品組成可左右滑動的 Carousel */
export function buildCarousel(
  entries: CardEntry[],
  keyword: string
): Extract<LineMessage, { type: "flex" }> {
  const limited = entries.slice(0, MAX_CAROUSEL_ITEMS)

  return {
    type: "flex",
    altText: `「${keyword}」的搜尋結果（${limited.length} 筆）`,
    contents: {
      type: "carousel",
      contents: limited.map(buildBubble),
    },
  }
}

/** 產生單一商品卡片 Flex Message */
export function buildItemFlex(entry: CardEntry): Extract<LineMessage, { type: "flex" }> {
  return {
    type: "flex",
    // 未支援 Flex 的環境（例如舊版 LINE、通知列）只看得到 altText
    altText: `${entry.product.title} — $${formatPrice(entry.product.currentPrice)}`,
    contents: buildBubble(entry),
  }
}

/** 單一商品的 bubble。單張卡片與 Carousel 共用同一份樣式 */
function buildBubble(entry: CardEntry) {
  const { product, verdict, affiliateUrl, platform } = entry
  const badge = badgeFor(verdict)
  const discount =
    product.originalPrice !== null
      ? discountPercent(product.currentPrice, product.originalPrice)
      : 0

  // 價格區：現價一定顯示；原價與折扣只在有原價且確實有折扣時才顯示
  const priceRow: unknown[] = [
    {
      type: "text",
      text: `$${formatPrice(product.currentPrice)}`,
      size: "xl",
      weight: "bold",
      color: TEXT_PRIMARY,
      flex: 0,
    },
  ]

  if (product.originalPrice !== null && discount > 0) {
    priceRow.push({
      type: "text",
      text: `$${formatPrice(product.originalPrice)}`,
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
      url: product.imageUrl,
      size: "full",
      // 電商商品圖多為正方形，用其他比例會裁掉商品主體
      aspectRatio: "1:1",
      aspectMode: "cover",
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "12px",
      contents: [
        // 平台標籤：品牌色的小圓點 + 平台名稱。
        // 使用者一眼知道是哪家，但卡片不會變成該平台的廣告
        {
          type: "box",
          layout: "baseline",
          spacing: "xs",
          contents: [
            {
              type: "text",
              text: "●",
              size: "xxs",
              color: platform.brandColor,
              flex: 0,
            },
            {
              type: "text",
              text: platform.displayName,
              size: "xxs",
              color: TEXT_MUTED,
              weight: "bold",
            },
          ],
        },
        {
          type: "text",
          text: badge.text,
          size: "xs",
          weight: "bold",
          color: badge.color,
        },
        {
          type: "text",
          text: product.title,
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
            // 「前往」而非「購買」——決定權在使用者，機器人只提供資訊
            label: `前往${platform.displayName}`,
            uri: affiliateUrl,
          },
        },
      ],
    },
  }
}
