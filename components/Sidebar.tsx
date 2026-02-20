'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/app/dashboard',  label: '대시보드' },
  { href: '/app/students',   label: '학생 관리' },
  { href: '/app/attendance', label: '출결 관리' },
  { href: '/app/billing',    label: '미납 관리' },
  { href: '/app/notice',     label: '전체 공지' },
  { href: '/app/outbox',     label: 'Outbox' },
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
    <aside className="w-52 min-h-screen bg-white border-r flex flex-col py-6 px-4 shrink-0">
      <Link href="/app/dashboard" className="text-lg font-bold text-indigo-600 mb-8 block">
        Attendly
      </Link>
      <nav className="flex-1 space-y-1">
        {navItems.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`block px-3 py-2 rounded-lg text-sm font-medium transition ${
              pathname.startsWith(href)
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-t pt-3 mt-2">
        <Link
          href="/app/settings"
          className={`block px-3 py-2 rounded-lg text-sm font-medium transition mb-1 ${
            pathname.startsWith('/app/settings')
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          설정
        </Link>
        <button
          onClick={handleSignOut}
          className="text-xs text-gray-400 hover:text-gray-700 px-3"
        >
          로그아웃
        </button>
      </div>
    </aside>
  )
}
