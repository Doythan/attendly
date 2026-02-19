import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // env vars가 없으면 미들웨어 건너뜀 (빌드 환경 대비)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next()
  }

  try {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    const { data: { user } } = await supabase.auth.getUser()

    const isAppRoute = request.nextUrl.pathname.startsWith('/app')
    const isLoginRoute = request.nextUrl.pathname === '/login'

    if (isAppRoute && !user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (isLoginRoute && user) {
      return NextResponse.redirect(new URL('/app/dashboard', request.url))
    }

    return supabaseResponse
  } catch {
    // 예외 발생 시 그냥 통과 (각 페이지/레이아웃에서 auth 처리)
    return NextResponse.next()
  }
}

export const config = {
  matcher: ['/app/:path*', '/login'],
}
