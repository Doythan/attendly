import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import UpgradeBanner from './upgrade-banner'

const FREE_LIMIT = 20
const PRO_LIMIT = 300

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { count: absentToday }, { count: unpaidCount }, { count: sentThisMonth }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user!.id).single(),
      supabase
        .from('attendance_records')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user!.id)
        .eq('date', new Date().toISOString().slice(0, 10))
        .eq('status', 'ABSENT'),
      supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user!.id)
        .eq('is_unpaid', true),
      supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user!.id)
        .eq('status', 'SENT'),
    ])

  const plan = profile?.plan ?? 'FREE'
  const sent = profile?.sms_sent_count ?? 0
  const limit = plan === 'PRO' ? PRO_LIMIT : FREE_LIMIT
  const remaining = Math.max(0, limit - sent)

  return (
    <div>
      <Suspense><UpgradeBanner /></Suspense>
      <h1 className="text-xl font-bold mb-6">대시보드</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="오늘 결석" value={absentToday ?? 0} />
        <StatCard label="미납 학생" value={unpaidCount ?? 0} />
        <StatCard label="이번 달 발송" value={sentThisMonth ?? 0} />
        <StatCard label="남은 무료 건수" value={remaining} sub={`/ ${limit}건`} />
      </div>

      <div className="bg-white border rounded-xl p-5 inline-block">
        <p className="text-sm text-gray-500 mb-1">현재 플랜</p>
        <span
          className={`text-lg font-bold ${plan === 'PRO' ? 'text-indigo-600' : 'text-gray-700'}`}
        >
          {plan}
        </span>
        {plan === 'FREE' && (
          <a
            href="/app/billing"
            className="ml-4 text-sm text-indigo-600 underline hover:text-indigo-800"
          >
            PRO로 업그레이드
          </a>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white border rounded-xl p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800">
        {value}
        {sub && <span className="text-sm font-normal text-gray-400 ml-1">{sub}</span>}
      </p>
    </div>
  )
}
