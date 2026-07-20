# 蝦皮分潤 LINE 機器人 — 設計文件

日期：2026-07-20
狀態：已確認，待排實作計畫

---

## 1. 目標

一個 LINE 機器人，使用者貼上蝦皮商品連結後，回傳一張含商品資訊、價格判定與**蝦皮分潤連結**的 Flex Message 卡片。

## 2. 使用場景

| 場景 | `event.source.type` | 支援 |
|---|---|---|
| 使用者加官方帳號好友，1 對 1 私訊 | `user` | ✅ |
| 機器人被邀請進一般 LINE 群組 | `group` | ✅ |
| 多人聊天室 | `room` | ✅ |
| LINE 社群（OpenChat） | — | ❌ 平台不支援 Bot 加入 |

**OpenChat 不在範圍內**：LINE Messaging API 的 Bot 無法加入 OpenChat，沒有 Webhook event，這是平台限制，非技術可繞過。原始 Spec 寫的「進駐 LINE 社群 (OpenChat)」已改為「官方帳號 + 一般群組」。

必要的 LINE Developers Console 設定：
- Messaging API channel
- **允許加入群組與多人聊天室**（預設為關閉，必須手動開啟）
- 關閉自動回覆訊息 / 歡迎訊息（否則會與 Bot 回覆打架）
- Webhook URL 指向 Vercel 部署網址

## 3. 範圍

### 做

- 解析訊息中的蝦皮商品網址（含 `shp.ee` / `s.shopee.tw` 短網址還原）
- 取得商品資訊（標題、現價、原價、圖片）
- 與資料庫紀錄比對，判定價格狀態
- 產生蝦皮分潤連結
- 回傳 Flex Message 卡片

### 不做（MVP 範圍外）

- **關鍵字商品搜尋**：屬於另一組功能（搜尋 API、Carousel 多卡、排序過濾），之後再加
- **完整價格歷史表**：判定邏輯只需 `lowestPrice` + `firstSeenAt` 兩個欄位，`PriceHistory` 表在 MVP 是多餘的。未來要畫價格曲線再加
- **排程回檢價格**：Vercel Cron 主動更新已收錄商品，之後再評估
- **多商品訊息**：一則訊息含多個連結時，只處理第一個

## 4. 技術選型

沿用 taskpulse（`/Users/user/Documents/進度觀測站`）的技術棧：

| 項目 | 選擇 | 理由 |
|---|---|---|
| 框架 | Next.js 15（App Router）+ TypeScript | 已熟悉；Route Handler 直接當 Webhook；部署即有 HTTPS，不需 ngrok |
| 資料庫 | PostgreSQL（Neon，**新開實例**） | 歷史最低價需要持久寫入。SQLite 在 Vercel serverless 會隨 lambda 重啟消失 |
| ORM | Prisma 6 | 與 taskpulse 一致 |
| 部署 | Vercel | 同上 |
| 測試 | Vitest | 核心邏輯皆為純函式，好測 |
| Lint/Format | Biome | 與 taskpulse 一致 |

**不與 taskpulse 共用 repo 或資料庫**：兩者是不相干的產品，混在一起後難以拆分，且 taskpulse 的 migration 或額度問題會波及機器人。

Neon 連線需使用 **pooled connection string**（serverless 環境每次冷啟動都會開新連線，直連會很快耗盡連線數）。

## 5. 架構

```
LINE 使用者（1 對 1 或群組）
   │ 貼上蝦皮連結
   ▼
LINE Messaging API ── POST ──▶ Vercel: /api/line/webhook
                                  │
                                  ├─ 1. 驗簽（HMAC-SHA256）
                                  ├─ 2. lib/shopee/url.ts      解析網址 → shopId / itemId
                                  ├─ 3. lib/shopee/provider.ts 取商品資訊
                                  ├─ 4. lib/db/items.ts        比價判定 + upsert
                                  ├─ 5. lib/shopee/provider.ts 產分潤連結
                                  └─ 6. lib/line/flex.ts       組 Flex JSON
                                  │
                                  ▼ Reply API
                             回傳卡片
```

### 模組職責

| 檔案 | 職責 | 依賴 |
|---|---|---|
| `app/api/line/webhook/route.ts` | 驗簽、分派 event、統籌流程、回 200 | 以下全部 |
| `lib/line/verify.ts` | 驗證 `X-Line-Signature` | 無（純函式） |
| `lib/line/client.ts` | 呼叫 LINE Reply API | 無 |
| `lib/line/flex.ts` | 依商品資料產 Flex Bubble JSON | 無（純函式） |
| `lib/shopee/url.ts` | 抽網址、跟隨重定向、regex 取 ID | 無（純函式 + fetch） |
| `lib/shopee/provider.ts` | `ShopeeProvider` 介面 + factory | mock / affiliate |
| `lib/shopee/mock.ts` | Mock 實作 | 無 |
| `lib/shopee/affiliate.ts` | 蝦皮聯盟 GraphQL 實作 | 無 |
| `lib/db/items.ts` | Prisma 讀寫 + 比價判定 | Prisma |

每個模組可獨立理解與測試：純函式（`verify`、`flex`、`url` 的 regex 部分、比價判定）不碰 I/O，直接單元測試。

## 6. 資料來源策略（Mock → 官方 API）

蝦皮聯盟 API **審核中**。因此資料層抽成介面，兩套實作以環境變數切換：

```ts
interface ShopeeProvider {
  getItem(shopId: bigint, itemId: bigint): Promise<ShopeeItem | null>
  generateShortLink(originalUrl: string): Promise<string>
}
```

| `SHOPEE_PROVIDER` | 實作 | 行為 |
|---|---|---|
| `mock`（預設） | `lib/shopee/mock.ts` | 回傳固定假商品；分潤連結為原網址加 `?aff_mock=1` |
| `affiliate` | `lib/shopee/affiliate.ts` | 呼叫蝦皮聯盟 GraphQL |

審核通過後，只需填入 `SHOPEE_APP_ID` / `SHOPEE_APP_SECRET` 並把 `SHOPEE_PROVIDER` 改成 `affiliate`，其餘程式碼不動。

蝦皮聯盟 API 是單一 GraphQL 端點，`productOfferV2`（查商品）與 `generateShortLink`（產短連結）共用同一組簽章機制，因此兩者放在同一個 client 檔案。

**不使用爬蟲**：蝦皮非公開 API 受 Cloudflare 與裝置指紋保護，直接請求幾乎必然失敗，且違反其服務條款。

## 7. 資料模型

```prisma
model Item {
  shopId        BigInt
  itemId        BigInt
  title         String
  imageUrl      String
  currentPrice  Int       // 以「分」為單位的整數，避免浮點誤差
  originalPrice Int?      // 原價（劃線價），可能沒有
  lowestPrice   Int       // 歷史最低（本系統觀測到的）
  firstSeenAt   DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@id([shopId, itemId])
}
```

價格一律以**分**為單位的整數儲存，顯示時才除以 100。

## 8. 比價判定邏輯

```
若為首次收錄（資料庫無此商品）
    → 「首次收錄，開始追蹤價格」        （不掛歷史最低標籤）
否則若 current < lowest
    → 「🔥 歷史新低」                    並更新 lowestPrice
否則若 current == lowest
    → 「≡ 追平歷史最低」
否則
    → 「距歷史低點 +${current - lowest}」
```

**首次收錄不掛「歷史最低價」標籤**：第一次見到商品時資料庫沒有任何歷史，`lowestPrice` 只能等於 `currentPrice`，此時宣稱「歷史最低」是誤導使用者。誠實標示為「首次收錄」，第二次以後才有資格判定。

## 9. 訊息處理與錯誤處理

### 靜默原則

群組中話多的 Bot 會被踢。以下情況**完全不回覆**：

- 訊息不含蝦皮網址
- 網址解析失敗（非商品頁、格式不符）
- 商品查詢失敗（商品下架、API 錯誤）

僅在成功組出卡片時才回覆。所有失敗寫入 log 供排查，不回饋給使用者。

### 錯誤處理分層

| 層級 | 失敗處理 |
|---|---|
| 驗簽失敗 | 回 `401`，不處理 |
| 單一 event 處理失敗 | catch 住、記 log，不影響同批其他 event |
| 短網址重定向 | 設 timeout（5s）與最大重定向次數（5 次），防止無限跳轉 |
| Shopee API 失敗 | 回 `null`，上層靜默略過 |
| Reply API 失敗 | 記 log。reply token 僅約 1 分鐘有效，過期不重試 |

**Webhook 一律回 200**（驗簽失敗除外）。若回非 2xx，LINE 會重送並可能停用 Webhook。

## 10. Flex Message 卡片

單一 Bubble，由上而下：

1. 商品圖（`aspectRatio: 1:1`、`aspectMode: cover`）
2. 價格狀態標籤（依判定結果變色：新低=紅、追平=橘、首次=灰）
3. 商品標題（`maxLines: 2`、`wrap: true`）
4. 現價（大字、粗體）＋原價（劃線、灰色小字）＋折扣百分比
5. 主按鈕「前往蝦皮購買」→ 開啟分潤連結

## 11. 環境變數

```
DATABASE_URL              # Neon pooled connection string
LINE_CHANNEL_SECRET       # 驗簽用
LINE_CHANNEL_ACCESS_TOKEN # 呼叫 Reply API 用
SHOPEE_PROVIDER           # mock | affiliate，預設 mock
SHOPEE_APP_ID             # 審核通過後填
SHOPEE_APP_SECRET         # 審核通過後填
```

## 12. 測試策略

| 對象 | 類型 | 重點 |
|---|---|---|
| `lib/line/verify.ts` | 單元 | 正確簽章通過、竄改 body 失敗、缺 header 失敗 |
| `lib/shopee/url.ts` | 單元 | 各種網址格式；非蝦皮網址回 null；重定向次數上限 |
| 比價判定 | 單元 | 四種分支（首次 / 新低 / 追平 / 高於低點） |
| `lib/line/flex.ts` | 單元 | 有無原價、標題過長、各標籤狀態 |
| Webhook route | 整合 | 用 mock provider 跑完整流程 |

## 13. 部署

1. Neon 開新專案，取 pooled connection string
2. `prisma migrate deploy`
3. Vercel 匯入 repo，設定環境變數
4. 將 Vercel 網址 `https://<app>.vercel.app/api/line/webhook` 填入 LINE Developers Console
5. 用 Console 的「Verify」按鈕確認連通
6. 開啟「允許加入群組」、關閉自動回覆

## 14. 未來擴充

- 關鍵字商品搜尋（Carousel 多卡）
- Vercel Cron 定期回檢價格，加速累積歷史
- `PriceHistory` 表 + 價格曲線圖
- 分潤成效統計（點擊數、轉換數）
- 降價通知推播（需 push message 額度）
