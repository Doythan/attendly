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

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: students }, { data: prof }] = await Promise.all([
      supabase.from('students').select('*').eq('is_unpaid', true).order('name'),
      supabase.from('profiles').select('*').eq('id', user!.id).single(),
    ])
    setUnpaid(students ?? [])
    setProfile(prof)
  }

  useEffect(() => { fetchData() }, [])

  async function handleGenerate() {
    if (unpaid.length === 0) { alert('미납 학생이 없습니다.'); return }
    setGenerating(true)
    setGenResult('')
    const workersUrl = process.env.NEXT_PUBLIC_WORKERS_URL
    const { data: { session } } = await supabase.auth.getSession()
    let saved = 0
    for (const student of unpaid) {
      const res = await fetch(`${workersUrl}/api/generate-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({ studentName: student.name, type: 'PAYMENT', tone, studentId: student.id }),
      })
      if (res.ok) saved++
    }
    setGenResult(`${saved}건의 미납 리마인드가 Outbox에 저장되었습니다.`)
    setGenerating(false)
  }

  async function handleCheckout() {
    setCheckoutLoading(true)
    const workersUrl = process.env.NEXT_PUBLIC_WORKERS_URL
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${workersUrl}/api/polar/create-checkout`, {
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">미납 관리</h1>
        {profile && (
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
            profile.plan === 'PRO' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {profile.plan} 플랜
          </span>
        )}
      </div>

      {/* PRO Upgrade */}
      {profile?.plan === 'FREE' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-6 flex items-center justify-between">
          <div>
            <p className="font-semibold text-indigo-800">PRO로 업그레이드</p>
            <p className="text-sm text-indigo-600">월 SMS 300건 + 제한 해제 · ₩29,000/월</p>
          </div>
          <button
            onClick={handleCheckout}
            disabled={checkoutLoading}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {checkoutLoading ? '이동 중...' : 'Polar로 결제 →'}
          </button>
        </div>
      )}

      {profile?.plan === 'PRO' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <p className="text-green-700 font-medium">PRO 플랜 활성화됨 — SMS 300건/월 사용 가능</p>
        </div>
      )}

      {/* Unpaid list */}
      <div className="bg-white border rounded-xl overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">학생</th>
              <th className="px-4 py-3 text-left">반</th>
              <th className="px-4 py-3 text-left">학부모 전화</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {unpaid.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-gray-400">{s.class_name}</td>
                <td className="px-4 py-3 text-gray-400">{s.parent_phone}</td>
              </tr>
            ))}
            {unpaid.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">미납 학생이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <select value={tone} onChange={e => setTone(e.target.value as MessageTone)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="FRIENDLY">친근하게</option>
          <option value="FORMAL">공식적으로</option>
          <option value="FIRM">단호하게</option>
        </select>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {generating ? 'AI 생성 중...' : 'AI 미납 리마인드 생성 → Outbox 저장'}
        </button>
        {genResult && <p className="text-sm text-green-600 font-medium">{genResult}</p>}
      </div>
    </div>
  )
}
