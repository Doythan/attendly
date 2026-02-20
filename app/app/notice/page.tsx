'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Student } from '@/lib/types'

const NOTICE_TYPES = [
  '휴원 안내',
  '명절 인사',
  '새해 인사',
  '행사 안내',
  '개강 안내',
  '기타 공지',
]

export default function NoticePage() {
  const supabase = createClient()
  const [students, setStudents] = useState<Student[]>([])
  const [noticeType, setNoticeType] = useState(NOTICE_TYPES[0])
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [tone, setTone] = useState<'FRIENDLY' | 'FORMAL'>('FRIENDLY')
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState('')

  useEffect(() => {
    supabase.from('students').select('*').order('name').then(({ data }) => {
      setStudents(data ?? [])
    })
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    setPreview('')
    setSaveResult('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/generate-notice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
      body: JSON.stringify({ noticeType, additionalInfo, tone }),
    })
    const data = await res.json()
    if (res.ok && data.content) {
      setPreview(data.content)
    } else {
      alert('생성 실패: ' + (data.error ?? ''))
    }
    setGenerating(false)
  }

  async function handleSaveToOutbox() {
    if (!preview) return
    if (students.length === 0) { alert('등록된 학생이 없습니다.'); return }
    setSaving(true)
    setSaveResult('')
    const { data: { user } } = await supabase.auth.getUser()

    const inserts = students.map(s => ({
      owner_id: user!.id,
      student_id: s.id,
      type: 'NOTICE' as const,
      tone: tone === 'FORMAL' ? 'FORMAL' as const : 'FRIENDLY' as const,
      content: preview,
      status: 'DRAFT' as const,
    }))
    await supabase.from('messages').insert(inserts)
    setSaving(false)
    setSaveResult(`${inserts.length}명 학부모 대상으로 Outbox에 저장되었습니다.`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">전체 공지</h1>
          <p className="text-sm text-gray-400 mt-0.5">AI가 공지 문자를 생성하고 전체 학부모에게 발송합니다.</p>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 max-w-xl mb-4">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">공지 유형</label>
          <div className="flex flex-wrap gap-2">
            {NOTICE_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setNoticeType(t)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${
                  noticeType === t
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">추가 정보 (선택)</label>
          <input
            type="text"
            value={additionalInfo}
            onChange={e => setAdditionalInfo(e.target.value)}
            placeholder="예: 2월 9~12일 설 연휴로 휴원, 2월 13일 정상 수업"
            className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">어조</label>
          <div className="flex gap-2">
            {[{ value: 'FRIENDLY', label: '친근하게' }, { value: 'FORMAL', label: '공식적으로' }].map(t => (
              <button
                key={t.value}
                onClick={() => setTone(t.value as 'FRIENDLY' | 'FORMAL')}
                className={`px-4 py-1.5 rounded-lg text-sm border transition ${
                  tone === t.value
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {generating ? 'AI 생성 중...' : 'AI 문자 생성'}
        </button>
      </div>

      {/* 미리보기 */}
      {preview && (
        <div className="bg-white border rounded-xl p-6 max-w-xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">생성된 문자 미리보기</h2>
            <span className="text-xs text-gray-400">전체 {students.length}명 대상</span>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed mb-4 border">
            {preview}
          </div>
          <textarea
            value={preview}
            onChange={e => setPreview(e.target.value)}
            rows={4}
            className="hidden"
          />
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-400">직접 수정하려면 위 텍스트를 클릭하세요.</p>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleSaveToOutbox}
              disabled={saving || students.length === 0}
              className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? '저장 중...' : `전체 ${students.length}명 Outbox에 저장`}
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="border px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              다시 생성
            </button>
          </div>
          {saveResult && <p className="text-sm text-green-600 font-medium mt-3">{saveResult}</p>}
        </div>
      )}

      {preview && (
        <div className="mt-3 text-xs text-gray-400 max-w-xl">
          저장 후 Outbox에서 전체 선택 → 선택 전송으로 일괄 발송하세요.
        </div>
      )}
    </div>
  )
}
