export const runtime = 'edge'
export const revalidate = 0

import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import UpgradeBanner from './upgrade-banner'
import Link from 'next/link'

const FREE_LIMIT = 20
const PRO_LIMIT = 300

export default async function DashboardPage() {
  const supabase = await createClient()
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
  const academyName = profile?.academy_name?.trim() || null
  const sent = profile?.sms_sent_count ?? 0
  const limit = plan === 'PRO' ? PRO_LIMIT : FREE_LIMIT
  const remaining = Math.max(0, limit - sent)

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  return (
    <div className="space-y-6">
      <Suspense><UpgradeBanner /></Suspense>

      {/* 인사말 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {academyName ? `${academyName} 대시보드` : '대시보드'}
        </h1>
        <p className="text-sm text-gray-400 mt-1">{today}</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="오늘 결석" value={absentToday ?? 0} color="red" href="/app/attendance" />
        <StatCard label="미납 학생" value={unpaidCount ?? 0} color="orange" href="/app/billing" />
        <StatCard label="이번 달 발송" value={sentThisMonth ?? 0} color="blue" href="/app/outbox" />
        <StatCard label="남은 발송량" value={remaining} sub={`/ ${limit}건`} color={remaining < 5 ? 'red' : 'green'} />
      </div>

      {/* 플랜 + 빠른 이동 */}
      {plan === 'FREE' && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold text-indigo-800">PRO로 업그레이드</p>
            <p className="text-sm text-indigo-600 mt-0.5">월 SMS 300건 + 제한 해제 · ₩29,000/월</p>
          </div>
          <Link href="/app/billing"
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
            PRO 시작하기 →
          </Link>
        </div>
      )}
      {plan === 'PRO' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-xl font-bold text-indigo-600">PRO</span>
          <p className="text-green-700 font-medium">PRO 플랜 활성화됨 — SMS 300건/월 사용 가능</p>
        </div>
      )}

      {/* 하단 정보 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">현재 플랜</p>
          <div className="flex items-center gap-2">
            <span className={`text-xl font-bold ${plan === 'PRO' ? 'text-indigo-600' : 'text-gray-700'}`}>
              {plan}
            </span>
            {plan === 'PRO' && (
              <span className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-lg font-medium">활성화됨 ✓</span>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">빠른 이동</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/attendance" className="text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">출결 관리</Link>
            <Link href="/app/billing" className="text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">미납 관리</Link>
            <Link href="/app/notice" className="text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">전체 공지</Link>
            <Link href="/app/outbox" className="text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">Outbox</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label, value, sub, color, href,
}: {
  label: string
  value: number
  sub?: string
  color?: 'red' | 'orange' | 'blue' | 'green'
  href?: string
}) {
  const colorMap = {
    red: 'text-red-600',
    orange: 'text-orange-500',
    blue: 'text-indigo-600',
    green: 'text-green-600',
  }
  const valueColor = color ? colorMap[color] : 'text-gray-900'

  const content = (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition">
      <p className="text-xs text-gray-500 mb-2 font-medium">{label}</p>
      <p className={`text-3xl font-bold ${valueColor}`}>
        {value}
        {sub && <span className="text-sm font-normal text-gray-400 ml-1">{sub}</span>}
      </p>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}
