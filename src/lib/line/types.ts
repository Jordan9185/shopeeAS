/**
 * LINE Messaging API 的型別定義。
 *
 * 只定義本專案實際用到的欄位，不追求涵蓋官方全部規格——
 * 完整照抄反而會讓人以為每個欄位都有被處理。
 */

/** 訊息來源。群組與 1 對 1 的差別只在這裡 */
export type LineSource =
  | { type: "user"; userId: string }
  | { type: "group"; groupId: string; userId?: string }
  | { type: "room"; roomId: string; userId?: string }

export type LineTextMessage = { type: "text"; id: string; text: string }
/** 貼圖、圖片、影片等，本機器人不處理 */
export type LineNonTextMessage = { type: string; id: string }

export type LineMessageEvent = {
  type: "message"
  replyToken: string
  source: LineSource
  message: LineTextMessage | LineNonTextMessage
}

/** message 已確定是文字的訊息事件 */
export type LineTextMessageEvent = LineMessageEvent & { message: LineTextMessage }

/** 其他事件型別（join / leave / follow…）目前不處理，統一收斂成這個形狀 */
export type LineOtherEvent = {
  type: Exclude<string, "message">
  replyToken?: string
  source: LineSource
}

export type LineWebhookEvent = LineMessageEvent | LineOtherEvent

export type LineWebhookBody = {
  destination?: string
  events: LineWebhookEvent[]
}

/** 判斷是否為「使用者傳來的文字訊息」——這是本機器人唯一要處理的事件 */
export function isTextMessageEvent(event: LineWebhookEvent): event is LineTextMessageEvent {
  if (event.type !== "message" || !("message" in event)) return false
  const message = event.message as { type?: unknown; text?: unknown } | undefined
  return message?.type === "text" && typeof message.text === "string"
}
