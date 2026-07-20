import { prisma } from "@/lib/db/client"

/// 健康檢查端點：確認服務活著、且資料庫連得上。
/// 部署後打這支就知道 DATABASE_URL 有沒有設對。
export async function GET() {
  try {
    // 最輕量的連線測試，不依賴任何資料表存在
    await prisma.$queryRaw`SELECT 1`
    return Response.json({ ok: true, db: "connected" })
  } catch (error) {
    console.error("[health] 資料庫連線失敗:", error)
    return Response.json({ ok: false, db: "error" }, { status: 503 })
  }
}
