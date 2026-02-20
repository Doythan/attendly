'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Student, MessageTone, Profile } from '@/lib/types'

export default function BillingPage() {
  const supabase = createClient()
  const [unpaid, setUnpaid] = useState<Student[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tone, setTone] = useState<MessageTone>('FIRM')
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [editingMonths, setEditingMonths] = useState<Record<string, number>>({})
  const [editingFee, setEditingFee] = useState<Record<string, number>>({})

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: students }, { data: prof }] = await Promise.all([
      supabase.from('students').select('*').eq('is_unpaid', true).order('name'),
      supabase.from('profiles').select('*').eq('id', user!.id).single(),
    ])
    const s = (students ?? []) as Student[]
    setUnpaid(s)
    setProfile(prof)
    const months: Record<string, number> = {}
    const fees: Record<string, number> = {}
    s.forEach(st => {
      months[st.id] = st.unpaid_months ?? 1
      fees[st.id] = st.monthly_fee ?? 0
    })
    setEditingMonths(months)
    setEditingFee(fees)
  }

  useEffect(() => { fetchData() }, [])

  async function updateUnpaidMonths(studentId: string, months: number) {
    setEditingMonths(prev => ({ ...prev, [studentId]: months }))
    await supabase.from('students').update({ unpaid_months: months }).eq('id', studentId)
  }

  async function updateMonthlyFee(studentId: string, fee: number) {
    setEditingFee(prev => ({ ...prev, [studentId]: fee }))
    await supabase.from('students').update({ monthly_fee: fee }).eq('id', studentId)
  }

  async function handleGenerate() {
    if (unpaid.length === 0) { alert('미납 학생이 없습니다.'); return }
    setGenerating(true)
    setGenResult('')
    const { data: { session } } = await supabase.auth.getSession()
    let saved = 0
    for (const student of unpaid) {
      const res = await fetch('/api/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({
          studentName: student.name,
          type: 'PAYMENT',
          tone,
          studentId: student.id,
          unpaidMonths: editingMonths[student.id] ?? student.unpaid_months ?? 1,
        }),
      })
      if (res.ok) saved++
    }
    setGenResult(`${saved}건의 미납 리마인드가 Outbox에 저장되었습니다.`)
    setGenerating(false)
  }

  async function handleCheckout() {
    setCheckoutLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/polar/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
    })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      alert('결제 세션 생성 실패: ' + (data.error ?? ''))
      setCheckoutLoading(false)
    }
  }

  const totalUnpaid = unpaid.reduce((sum, s) => {
    return sum + (editingFee[s.id] ?? 0) * (editingMonths[s.id] ?? 1)
  }, 0)

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">미납 관리</h1>
        {profile && (
          <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${
            profile.plan === 'PRO' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {profile.plan} 플랜
          </span>
        )}
      </div>

      {/* 업그레이드 배너 */}
      {profile?.plan === 'FREE' && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold text-indigo-800">PRO로 업그레이드</p>
            <p className="text-sm text-indigo-600 mt-0.5">월 SMS 300건 + 제한 해제 · ₩29,000/월</p>
          </div>
          <button onClick={handleCheckout} disabled={checkoutLoading}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50">
            {checkoutLoading ? '이동 중...' : 'PRO 시작하기 →'}
          </button>
        </div>
      )}
      {profile?.plan === 'PRO' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-700 font-medium">PRO 플랜 활성화됨 — SMS 300건/월 사용 가능</p>
        </div>
      )}

      {/* 미납 합계 */}
      {unpaid.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">미납 학생 수</p>
            <p className="text-2xl font-bold text-gray-900">{unpaid.length}<span className="text-sm font-normal text-gray-400 ml-1">명</span></p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">총 미수금 (예상)</p>
            <p className="text-2xl font-bold text-red-600">
              {totalUnpaid > 0 ? `₩${totalUnpaid.toLocaleString()}` : '-'}
            </p>
          </div>
        </div>
      )}

      {/* 미납 목록 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">학생</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">반</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">월 수강료</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">미납 개월</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">미수금</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {unpaid.map(s => {
              const months = editingMonths[s.id] ?? 1
              const fee = editingFee[s.id] ?? 0
              const total = fee * months
              return (
                <tr key={s.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-400">{s.parent_phone}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{s.class_name || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">₩</span>
                      <input
                        type="number"
                        value={fee || ''}
                        placeholder="0"
                        onChange={e => updateMonthlyFee(s.id, parseInt(e.target.value) || 0)}
                        className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateUnpaidMonths(s.id, Math.max(1, months - 1))}
                        className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 flex items-center justify-center text-sm transition"
                      >−</button>
                      <span className="w-6 text-center font-semibold text-sm">{months}</span>
                      <button
                        onClick={() => updateUnpaidMonths(s.id, months + 1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 flex items-center justify-center text-sm transition"
                      >+</button>
                      <span className="text-xs text-gray-400">개월</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${total > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {total > 0 ? `₩${total.toLocaleString()}` : '-'}
                    </span>
                  </td>
                </tr>
              )
            })}
            {unpaid.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">미납 학생이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* AI 생성 */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={tone} onChange={e => setTone(e.target.value as MessageTone)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
          <option value="FRIENDLY">친근하게</option>
          <option value="FORMAL">공식적으로</option>
          <option value="FIRM">단호하게</option>
        </select>
        <button onClick={handleGenerate} disabled={generating}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50">
          {generating ? 'AI 생성 중...' : 'AI 미납 리마인드 생성 → Outbox'}
        </button>
        {genResult && <p className="text-sm text-green-600 font-medium">{genResult}</p>}
      </div>
    </div>
  )
}
