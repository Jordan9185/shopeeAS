// 這個專案本質上是 LINE Webhook 後端，沒有前端介面。
// 保留一個極簡首頁，讓人誤打網址時知道這是什麼，也方便確認部署成功。
export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "3rem", lineHeight: 1.8 }}>
      <h1>蝦皮優惠小幫手</h1>
      <p>這是 LINE 機器人的後端服務，沒有網頁介面。</p>
      <p>
        Webhook 端點：<code>/api/line/webhook</code>
      </p>
    </main>
  )
}
