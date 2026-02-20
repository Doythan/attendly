'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Student, AttendanceRecord, AttendanceStatus, Profile } from '@/lib/types'

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: '출석',
  ABSENT:  '결석',
  LATE:    '지각',
}
const STATUS_COLOR: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-100 text-green-700',
  ABSENT:  'bg-red-100 text-red-700',
  LATE:    'bg-yellow-100 text-yellow-700',
}

type TemplateKey = 'default' | 'friendly' | 'short'
const TEMPLATE_META: Record<TemplateKey, string> = {
  default:  '기본',
  friendly: '친근',
  short:    '간결',
}

function buildTemplate(key: TemplateKey, academy: string, name: string, date: string, status: 'ABSENT' | 'LATE'): string {
  const s = status === 'ABSENT' ? '결석' : '지각'
  const a = academy || '학원'
  switch (key) {
    case 'friendly':
      return status === 'ABSENT'
        ? `[${a}] 안녕하세요! ${name} 학생이 오늘 결석했어요. 별일 없으신가요?`
        : `[${a}] ${name} 학생이 오늘 지각했어요! 앞으로 좀 더 일찍 출발해 주세요 🙏`
    case 'short':
      return `[${a}] ${name} 학생 ${date} ${s} 처리.`
    default:
      return `[${a}] ${date} ${name} 학생이 오늘 ${s}했습니다. 확인 부탁드립니다.`
  }
}

export default function AttendancePage() {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [date, setDate] = useState(today)
  const [students, setStudents] = useState<Student[]>([])
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({})
  const [profile, setProfile] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>('default')
  const [saving2, setSaving2] = useState(false)
  const [saveResult, setSaveResult] = useState('')

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: s }, { data: r }, { data: p }] = await Promise.all([
      supabase.from('students').select('*').order('name'),
      supabase.from('attendance_records').select('*').eq('date', date),
      supabase.from('profiles').select('*').eq('id', user!.id).single(),
    ])
    setStudents(s ?? [])
    setProfile(p)
    const map: Record<string, AttendanceStatus> = {}
    ;(r ?? []).forEach((rec: AttendanceRecord) => { map[rec.student_id] = rec.status })
    setRecords(map)
  }

  useEffect(() => { fetchData() }, [date])

  function setStatus(studentId: string, status: AttendanceStatus) {
    setRecords(prev => ({ ...prev, [studentId]: status }))
  }

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const upserts = students.map(s => ({
      owner_id: user!.id,
      student_id: s.id,
      date,
      status: records[s.id] ?? 'PRESENT',
    }))
    await supabase.from('attendance_records').upsert(upserts, {
      onConflict: 'owner_id,student_id,date',
    })
    setSaving(false)
    alert('저장되었습니다.')
  }

  async function handleSaveToOutbox() {
    const absentLate = students.filter(s => {
      const st = records[s.id] ?? 'PRESENT'
      return st === 'ABSENT' || st === 'LATE'
    })
    if (absentLate.length === 0) {
      alert('결석/지각 학생이 없습니다.')
      return
    }
    setSaving2(true)
    setSaveResult('')
    const { data: { user } } = await supabase.auth.getUser()
    const academyName = profile?.academy_name || ''

    const inserts = absentLate.map(s => ({
      owner_id: user!.id,
      student_id: s.id,
      type: 'ATTENDANCE' as const,
      tone: 'FRIENDLY' as const,
      content: buildTemplate(selectedTemplate, academyName, s.name, date, records[s.id] as 'ABSENT' | 'LATE'),
      status: 'DRAFT' as const,
    }))
    await supabase.from('messages').insert(inserts)
    setSaving2(false)
    setSaveResult(`${inserts.length}건의 메시지가 Outbox에 저장되었습니다.`)
  }

  const absentLateStudents = students.filter(s => {
    const st = records[s.id] ?? 'PRESENT'
    return st === 'ABSENT' || st === 'LATE'
  })
  const academyName = profile?.academy_name || '학원'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">출결 관리</h1>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm"
        />
      </div>

      <div className="bg-white border rounded-xl overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">학생</th>
              <th className="px-4 py-3 text-left">반</th>
              <th className="px-4 py-3 text-left">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {students.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-gray-400">{s.class_name}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {(['PRESENT', 'ABSENT', 'LATE'] as AttendanceStatus[]).map(st => (
                      <button
                        key={st}
                        onClick={() => setStatus(s.id, st)}
                        className={`text-xs px-3 py-1 rounded-full font-medium transition ${
                          (records[s.id] ?? 'PRESENT') === st
                            ? STATUS_COLOR[st]
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {STATUS_LABEL[st]}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">학생을 먼저 등록하세요.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-gray-800 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '출결 저장'}
        </button>
      </div>

      {/* 템플릿 선택 섹션 */}
      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">안내문 템플릿 선택</h2>
          {absentLateStudents.length > 0 && (
            <span className="text-xs text-gray-400">결석/지각 {absentLateStudents.length}명 대상</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {(Object.keys(TEMPLATE_META) as TemplateKey[]).map(key => {
            const preview = absentLateStudents.length > 0
              ? buildTemplate(key, academyName, absentLateStudents[0].name, date, records[absentLateStudents[0].id] as 'ABSENT' | 'LATE')
              : buildTemplate(key, academyName, '홍길동', date, 'ABSENT')
            return (
              <button
                key={key}
                onClick={() => setSelectedTemplate(key)}
                className={`text-left p-3 rounded-xl border-2 transition ${
                  selectedTemplate === key
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className={`text-xs font-semibold mb-1 ${selectedTemplate === key ? 'text-indigo-600' : 'text-gray-500'}`}>
                  {TEMPLATE_META[key]}
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">{preview}</p>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveToOutbox}
            disabled={saving2 || absentLateStudents.length === 0}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving2 ? '저장 중...' : 'Outbox에 저장'}
          </button>
          {saveResult && <p className="text-sm text-green-600 font-medium">{saveResult}</p>}
        </div>
      </div>
    </div>
  )
}
