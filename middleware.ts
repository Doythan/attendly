import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Auth는 /app/layout.tsx에서 처리
  // Supabase SSR은 Cloudflare edge 미들웨어에서 로드 실패 유발
  return NextResponse.next()
}

export const config = {
  matcher: ['/app/:path*', '/login'],
}
