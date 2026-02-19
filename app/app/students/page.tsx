'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Student } from '@/lib/types'

const DUMMY_CLASSES = ['A반', 'B반', 'C반']
const DUMMY_NAMES = [
  '김민준', '이서연', '박지호', '최예린', '정현우',
  '강지민', '윤서준', '임나연', '한도현', '오세은',
  '신유진', '배준혁', '류하린', '송민서', '전태양',
]

export default function StudentsPage() {
  const supabase = createClient()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', parent_phone: '', class_name: '', memo: '', is_unpaid: false })
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)

  async function fetchStudents() {
    const { data } = await supabase.from('students').select('*').order('created_at', { ascending: false })
    setStudents(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchStudents() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('students').insert({ ...form, owner_id: user!.id })
    setForm({ name: '', parent_phone: '', class_name: '', memo: '', is_unpaid: false })
    setShowForm(false)
    setSaving(false)
    fetchStudents()
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('students').delete().eq('id', id)
    fetchStudents()
  }

  async function handleSeed() {
    setSeeding(true)
    const { data: { user } } = await supabase.auth.getUser()
    const rows = DUMMY_NAMES.map((name, i) => ({
      owner_id: user!.id,
      name,
      parent_phone: `010${String(10000000 + i * 111111).slice(0, 8)}`,
      class_name: DUMMY_CLASSES[i % 3],
      memo: '',
      is_unpaid: i % 4 === 0,
    }))
    await supabase.from('students').insert(rows)
    setSeeding(false)
    fetchStudents()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">학생 관리</h1>
        <div className="flex gap-2">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="text-sm border rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {seeding ? '생성 중...' : '더미 데이터 생성 (15명)'}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700"
          >
            + 학생 추가
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border rounded-xl p-5 mb-6 grid grid-cols-2 gap-3">
          <input required placeholder="학생 이름" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          <input required placeholder="학부모 전화 (010xxxxxxxx)" value={form.parent_phone}
            onChange={e => setForm({ ...form, parent_phone: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          <input placeholder="반 이름 (예: A반)" value={form.class_name}
            onChange={e => setForm({ ...form, class_name: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          <input placeholder="메모" value={form.memo}
            onChange={e => setForm({ ...form, memo: e.target.value })}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          <label className="flex items-center gap-2 text-sm text-gray-600 col-span-2">
            <input type="checkbox" checked={form.is_unpaid} onChange={e => setForm({ ...form, is_unpaid: e.target.checked })} />
            미납 여부
          </label>
          <div className="col-span-2 flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-3 py-1.5">취소</button>
            <button type="submit" disabled={saving} className="text-sm bg-indigo-600 text-white px-4 py-1.5 rounded-lg disabled:opacity-50">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">로딩 중...</p>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">이름</th>
                <th className="px-4 py-3 text-left">반</th>
                <th className="px-4 py-3 text-left">학부모 전화</th>
                <th className="px-4 py-3 text-left">미납</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {students.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.class_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.parent_phone}</td>
                  <td className="px-4 py-3">
                    {s.is_unpaid && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">미납</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(s.id)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">학생이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
