'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Student, MessageTone, Profile } from '@/lib/types'

function applyTemplate(template: string, student: Student, months: number, fee: number): string {
  const total = fee * months
  return template
    .replace(/\{이름\}/g, student.name)
    .replace(/\{미납개월\}/g, `${months}개월`)
    .replace(/\{월수강료\}/g, fee > 0 ? `₩${fee.toLocaleString()}` : '미설정')
    .replace(/\{미수금\}/g, total > 0 ? `₩${total.toLocaleString()}` : '미설정')
}

export default function BillingPage() {
  const supabase = createClient()
  const [unpaid, setUnpaid] = useState<Student[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tone, setTone] = useState<MessageTone>('FIRM')
  const [generating, setGenerating] = useState(false)
  const [template, setTemplate] = useState('')        // 플레이스홀더 원본
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState('')
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
    setTemplate('')
    setSaveResult('')
    setIsEditing(false)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/generate-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
      body: JSON.stringify({ type: 'PAYMENT', tone, templateMode: true }),
    })
    const data = await res.json()
    if (res.ok && data.content) {
      setTemplate(data.content)
    } else {
      alert('생성 실패: ' + (data.error ?? ''))
    }
    setGenerating(false)
  }

  async function handleSaveToOutbox() {
    if (!template || unpaid.length === 0) return
    setSaving(true)
    setSaveResult('')
    const { data: { user } } = await supabase.auth.getUser()

    const inserts = unpaid.map(s => ({
      owner_id: user!.id,
      student_id: s.id,
      type: 'PAYMENT' as const,
      tone,
      content: applyTemplate(template, s, editingMonths[s.id] ?? 1, editingFee[s.id] ?? 0),
      status: 'DRAFT' as const,
    }))
    await supabase.from('messages').insert(inserts)
    setSaving(false)
    setSaveResult(`${inserts.length}명 미납 리마인드가 Outbox에 저장되었습니다. Outbox에서 전송하세요.`)
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

  const totalUnpaid = unpaid.reduce((sum, s) => sum + (editingFee[s.id] ?? 0) * (editingMonths[s.id] ?? 1), 0)
  const firstStudent = unpaid[0]
  const previewText = template && firstStudent
    ? applyTemplate(template, firstStudent, editingMonths[firstStudent.id] ?? 1, editingFee[firstStudent.id] ?? 0)
    : null

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">미납 관리</h1>
        {profile && (
          <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${
            profile.plan === 'PRO' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
          }`}>{profile.plan} 플랜</span>
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
            <p className="text-xs text-gray-500 mb-1 font-medium">미납 학생 수</p>
            <p className="text-3xl font-bold text-gray-900">{unpaid.length}<span className="text-sm font-normal text-gray-400 ml-1">명</span></p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1 font-medium">총 미수금 (예상)</p>
            <p className="text-3xl font-bold text-red-600">
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
                      <input type="number" value={fee || ''} placeholder="0"
                        onChange={e => updateMonthlyFee(s.id, parseInt(e.target.value) || 0)}
                        className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateUnpaidMonths(s.id, Math.max(1, months - 1))}
                        className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 flex items-center justify-center transition">−</button>
                      <span className="w-6 text-center font-semibold">{months}</span>
                      <button onClick={() => updateUnpaidMonths(s.id, months + 1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 flex items-center justify-center transition">+</button>
                      <span className="text-xs text-gray-400">개월</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${fee * months > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {fee * months > 0 ? `₩${(fee * months).toLocaleString()}` : '-'}
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

      {/* AI 리마인드 생성 — 전체공지 패턴 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽: 설정 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700">AI 미납 리마인드 생성</h2>
          <p className="text-xs text-gray-400 -mt-3">
            템플릿 1회 생성 후 각 학생 정보({'{이름}'}, {'{미납개월}'}, {'{미수금}'})를 자동 치환합니다.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">어조</label>
            <div className="flex gap-2">
              {([
                { value: 'FRIENDLY', label: '친근하게' },
                { value: 'FORMAL',   label: '공식적으로' },
                { value: 'FIRM',     label: '단호하게' },
              ] as { value: MessageTone; label: string }[]).map(t => (
                <button key={t.value} onClick={() => setTone(t.value)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition ${
                    tone === t.value
                      ? 'border-gray-800 bg-gray-800 text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleGenerate} disabled={generating || unpaid.length === 0}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
            {generating ? 'AI 생성 중...' : `✨ 미납 리마인드 템플릿 생성 (API 1회)`}
          </button>
        </div>

        {/* 오른쪽: 미리보기 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              {previewText ? `미리보기 (${firstStudent?.name} 기준)` : '생성된 문자 미리보기'}
            </h2>
            {template && (
              <button onClick={() => setIsEditing(e => !e)}
                className="text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 px-3 py-1 rounded-lg transition">
                {isEditing ? '미리보기' : '템플릿 수정'}
              </button>
            )}
          </div>

          {template ? (
            <>
              {isEditing ? (
                <>
                  <p className="text-xs text-gray-400 mb-2">플레이스홀더: {'{이름}'} {'{미납개월}'} {'{미수금}'} {'{월수강료}'}</p>
                  <textarea value={template} onChange={e => setTemplate(e.target.value)} rows={6}
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 leading-relaxed font-mono" />
                </>
              ) : (
                <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed min-h-[10rem]">
                  {previewText}
                </div>
              )}
              <p className="text-xs text-gray-400 text-right mt-1">{(previewText ?? template).length}자</p>

              <div className="mt-4 space-y-3">
                <button onClick={handleSaveToOutbox} disabled={saving || unpaid.length === 0}
                  className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50">
                  {saving ? '저장 중...' : `전체 ${unpaid.length}명 Outbox에 저장 →`}
                </button>
                <button onClick={handleGenerate} disabled={generating}
                  className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">
                  다시 생성
                </button>
              </div>
              {saveResult && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <p className="text-sm text-green-700 font-medium">{saveResult}</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 text-gray-300">
              <span className="text-5xl mb-3">💌</span>
              <p className="text-sm">어조를 선택하고<br/>AI 템플릿을 생성해보세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
