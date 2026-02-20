'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Student, AttendanceRecord, AttendanceStatus, MessageTone } from '@/lib/types'

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: '출석',
  ABSENT: '결석',
  LATE: '지각',
}
const STATUS_COLOR: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-100 text-green-700',
  ABSENT:  'bg-red-100 text-red-700',
  LATE:    'bg-yellow-100 text-yellow-700',
}

export default function AttendancePage() {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [date, setDate] = useState(today)
  const [students, setStudents] = useState<Student[]>([])
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({})
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [tone, setTone] = useState<MessageTone>('FRIENDLY')
  const [genResult, setGenResult] = useState('')

  async function fetchData() {
    const { data: s } = await supabase.from('students').select('*').order('name')
    setStudents(s ?? [])

    const { data: r } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('date', date)

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

  async function handleGenerate() {
    const absentStudents = students.filter(
      s => (records[s.id] ?? 'PRESENT') !== 'PRESENT'
    )
    if (absentStudents.length === 0) {
      alert('결석/지각 학생이 없습니다.')
      return
    }
    setGenerating(true)
    setGenResult('')

    const { data: { session } } = await supabase.auth.getSession()

    let saved = 0
    for (const student of absentStudents) {
      const res = await fetch('/api/generate-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session!.access_token}`,
        },
        body: JSON.stringify({
          studentName: student.name,
          date,
          status: records[student.id],
          tone,
          type: 'ATTENDANCE',
          studentId: student.id,
        }),
      })
      if (res.ok) saved++
    }

    setGenResult(`${saved}건의 메시지가 Outbox에 저장되었습니다.`)
    setGenerating(false)
  }

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

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-gray-800 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '출결 저장'}
        </button>

        <select
          value={tone}
          onChange={e => setTone(e.target.value as MessageTone)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="FRIENDLY">친근하게</option>
          <option value="FORMAL">공식적으로</option>
          <option value="FIRM">단호하게</option>
        </select>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {generating ? 'AI 생성 중...' : 'AI 안내문 생성 → Outbox 저장'}
        </button>

        {genResult && <p className="text-sm text-green-600 font-medium">{genResult}</p>}
      </div>
    </div>
  )
}
