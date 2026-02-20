'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/app/dashboard',  label: '대시보드',  icon: '◈' },
  { href: '/app/students',   label: '학생 관리', icon: '👤' },
  { href: '/app/attendance', label: '출결 관리', icon: '📅' },
  { href: '/app/billing',    label: '미납 관리', icon: '💰' },
  { href: '/app/notice',     label: '전체 공지', icon: '📢' },
  { href: '/app/outbox',     label: 'Outbox',   icon: '📤' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 min-h-screen bg-white border-r border-gray-200 flex flex-col py-6 px-3 shrink-0">
      {/* 로고 */}
      <Link href="/app/dashboard" className="flex items-center gap-2 px-3 mb-8">
        <span className="text-xl font-bold text-indigo-600">Attendly</span>
      </Link>

      {/* 메인 네비 */}
      <nav className="flex-1 space-y-0.5">
        {navItems.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* 하단: 설정 + 로그아웃 */}
      <div className="border-t border-gray-100 pt-3 mt-3 space-y-0.5">
        <Link
          href="/app/settings"
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
            pathname.startsWith('/app/settings')
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
          }`}
        >
          <span className="text-base">⚙️</span>
          설정
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition text-left"
        >
          <span className="text-base">🚪</span>
          로그아웃
        </button>
      </div>
    </aside>
  )
}
