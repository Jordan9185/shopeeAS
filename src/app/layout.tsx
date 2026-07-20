import type { ReactNode } from "react"

export const metadata = {
  title: "蝦皮優惠小幫手",
  description: "LINE 機器人後端",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  )
}
