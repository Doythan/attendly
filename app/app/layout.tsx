export const runtime = 'edge'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')
  } catch (e: unknown) {
    // redirect()는 내부적으로 throw를 사용하므로 다시 던짐
    const err = e as { digest?: string }
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw e
    // Supabase 오류 시 로그인으로
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
