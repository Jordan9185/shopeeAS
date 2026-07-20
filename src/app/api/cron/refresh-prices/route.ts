import { isAuthorizedCronRequest } from "@/lib/cron/auth"
import { refreshStalePrices } from "@/lib/pricing/refresh"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// 回檢多筆商品需要時間，拉高上限避免中途被切斷
export const maxDuration = 60

/**
 * 定期回檢商品價格。由 Vercel Cron 觸發（設定見 vercel.json）。
 *
 * 沒有這個排程的話，商品價格只會在有人貼連結時更新，
 * 資料庫裡可能是幾個月前的舊價格，比價結果就失去意義。
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request, process.env.CRON_SECRET)) {
    console.warn("[cron] 未授權的回檢請求")
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    const started = Date.now()
    const summary = await refreshStalePrices()
    const elapsedMs = Date.now() - started

    console.info(
      `[cron] 回檢完成：嘗試 ${summary.attempted}、成功 ${summary.updated}、` +
        `失敗 ${summary.failed}、新低 ${summary.newLows}，耗時 ${elapsedMs}ms`
    )

    return Response.json({ ok: true, ...summary, elapsedMs })
  } catch (error) {
    console.error("[cron] 回檢失敗:", error)
    return Response.json({ ok: false }, { status: 500 })
  }
}
