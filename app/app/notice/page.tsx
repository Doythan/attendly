'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Student } from '@/lib/types'

const NOTICE_TYPES = [
  { value: '휴원 안내', emoji: '🏫' },
  { value: '명절 인사', emoji: '🎊' },
  { value: '새해 인사', emoji: '🎆' },
  { value: '행사 안내', emoji: '📋' },
  { value: '개강 안내', emoji: '📚' },
  { value: '기타 공지', emoji: '📢' },
]

export default function NoticePage() {
  const supabase = createClient()
  const [students, setStudents] = useState<Student[]>([])
  const [noticeType, setNoticeType] = useState(NOTICE_TYPES[0].value)
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [tone, setTone] = useState<'FRIENDLY' | 'FORMAL'>('FRIENDLY')
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState('')
  const [isEditing, setIsEditing] = useState(false)
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
    setIsEditing(false)
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
    setSaveResult(`${inserts.length}명 학부모 대상으로 Outbox에 저장되었습니다. Outbox에서 전송하세요.`)
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">전체 공지</h1>
        <p className="text-sm text-gray-400 mt-1">AI가 공지 문자를 생성하고 전체 학부모에게 발송합니다. ({students.length}명 등록됨)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽: 설정 */}
        <div className="space-y-5">
          {/* 공지 유형 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">공지 유형 선택</h2>
            <div className="grid grid-cols-3 gap-2">
              {NOTICE_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setNoticeType(t.value)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition text-sm font-medium ${
                    noticeType === t.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl">{t.emoji}</span>
                  <span>{t.value}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 추가 정보 + 어조 */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">추가 정보 (선택)</label>
              <textarea
                value={additionalInfo}
                onChange={e => setAdditionalInfo(e.target.value)}
                rows={3}
                placeholder={'예: 2월 9~12일 설 연휴 휴원\n2월 13일(목) 정상 수업 재개'}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none leading-relaxed"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">어조</label>
              <div className="flex gap-2">
                {[{ value: 'FRIENDLY', label: '친근하게' }, { value: 'FORMAL', label: '공식적으로' }].map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTone(t.value as 'FRIENDLY' | 'FORMAL')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition ${
                      tone === t.value
                        ? 'border-gray-800 bg-gray-800 text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {generating ? 'AI 생성 중...' : '✨ AI 공지 문자 생성'}
          </button>
        </div>

        {/* 오른쪽: 미리보기 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">생성된 문자 미리보기</h2>
            {preview && (
              <button
                onClick={() => setIsEditing(e => !e)}
                className="text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 px-3 py-1 rounded-lg transition"
              >
                {isEditing ? '미리보기' : '직접 수정'}
              </button>
            )}
          </div>

          {preview ? (
            <>
              {isEditing ? (
                <textarea
                  value={preview}
                  onChange={e => setPreview(e.target.value)}
                  rows={8}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 leading-relaxed"
                />
              ) : (
                <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-5 py-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed min-h-[12rem]">
                  {preview}
                </div>
              )}
              <p className="text-xs text-gray-400 text-right mt-1">{preview.length}자</p>

              <div className="mt-4 space-y-3">
                <button
                  onClick={handleSaveToOutbox}
                  disabled={saving || students.length === 0}
                  className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
                >
                  {saving ? '저장 중...' : `전체 ${students.length}명 Outbox에 저장 →`}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
                >
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
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 text-gray-300">
              <span className="text-5xl mb-3">✉️</span>
              <p className="text-sm">공지 유형을 선택하고<br/>AI 문자를 생성해보세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
