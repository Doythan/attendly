import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Attendly — 학원 출결 SMS 자동화',
  description: '출결 관리부터 학부모 SMS까지 한 번에',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
