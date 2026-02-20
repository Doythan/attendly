'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Student } from '@/lib/types'

const PAGE_SIZE = 10

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
  const [form, setForm] = useState({ name: '', parent_phone: '', class_name: '', memo: '', is_unpaid: false, monthly_fee: '' })
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)

  // 필터 상태
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterUnpaid, setFilterUnpaid] = useState(false)
  const [page, setPage] = useState(1)

  async function fetchStudents() {
    const { data } = await supabase.from('students').select('*').order('name')
    setStudents(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchStudents() }, [])

  // 고유 반 목록
  const classNames = useMemo(() => {
    const set = new Set(students.map(s => s.class_name).filter(Boolean))
    return Array.from(set).sort()
  }, [students])

  // 필터 적용
  const filtered = useMemo(() => {
    return students.filter(s => {
      if (search && !s.name.includes(search)) return false
      if (filterClass && s.class_name !== filterClass) return false
      if (filterUnpaid && !s.is_unpaid) return false
      return true
    })
  }, [students, search, filterClass, filterUnpaid])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // 필터 바뀔 때 1페이지로 리셋
  useEffect(() => { setPage(1) }, [search, filterClass, filterUnpaid])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('students').insert({
      ...form,
      monthly_fee: form.monthly_fee ? parseInt(form.monthly_fee) : 0,
      owner_id: user!.id,
    })
    setForm({ name: '', parent_phone: '', class_name: '', memo: '', is_unpaid: false, monthly_fee: '' })
    setShowForm(false)
    setSaving(false)
    fetchStudents()
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('students').delete().eq('id', id)
    fetchStudents()
  }

  async function toggleUnpaid(s: Student) {
    await supabase.from('students').update({ is_unpaid: !s.is_unpaid }).eq('id', s.id)
    setStudents(prev => prev.map(st => st.id === s.id ? { ...st, is_unpaid: !st.is_unpaid } : st))
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
      monthly_fee: 300000,
      unpaid_months: i % 4 === 0 ? 2 : 0,
    }))
    await supabase.from('students').insert(rows)
    setSeeding(false)
    fetchStudents()
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">학생 관리</h1>
        <div className="flex gap-2">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="text-sm border border-gray-200 rounded-lg px-4 py-2 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            {seeding ? '생성 중...' : '더미 데이터 (15명)'}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition font-medium"
          >
            + 학생 추가
          </button>
        </div>
      </div>

      {/* 추가 폼 */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-xl p-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">학생 이름 *</label>
            <input required placeholder="홍길동" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">학부모 전화 *</label>
            <input required placeholder="01012345678" value={form.parent_phone}
              onChange={e => setForm({ ...form, parent_phone: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">반</label>
            <input placeholder="A반" value={form.class_name}
              onChange={e => setForm({ ...form, class_name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">월 수강료 (원)</label>
            <input type="number" placeholder="300000" value={form.monthly_fee}
              onChange={e => setForm({ ...form, monthly_fee: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">메모</label>
            <input placeholder="기타 메모" value={form.memo}
              onChange={e => setForm({ ...form, memo: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={form.is_unpaid}
                onChange={e => setForm({ ...form, is_unpaid: e.target.checked })}
                className="w-4 h-4 rounded" />
              미납 상태로 등록
            </label>
          </div>
          <div className="col-span-2 flex gap-2 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setShowForm(false)}
              className="text-sm text-gray-500 px-4 py-2 hover:text-gray-700">취소</button>
            <button type="submit" disabled={saving}
              className="text-sm bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 font-medium">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      )}

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="이름 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-36"
        />
        <select
          value={filterClass}
          onChange={e => setFilterClass(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">전체 반</option>
          {classNames.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={filterUnpaid} onChange={e => setFilterUnpaid(e.target.checked)} className="w-4 h-4 rounded" />
          미납자만
        </label>
        <span className="text-sm text-gray-400 ml-auto">총 {filtered.length}명</span>
      </div>

      {/* 테이블 */}
      {loading ? (
        <p className="text-gray-400 text-sm py-8 text-center">로딩 중...</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">이름</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">반</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">학부모 전화</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">월 수강료</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">미납</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.class_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.parent_phone}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {s.monthly_fee ? `₩${s.monthly_fee.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleUnpaid(s)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
                        s.is_unpaid
                          ? 'bg-red-100 text-red-600 hover:bg-red-200'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {s.is_unpaid ? '미납' : '정상'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(s.id)} className="text-xs text-gray-400 hover:text-red-500 transition">삭제</button>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">학생이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
          >이전</button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
          >다음</button>
        </div>
      )}
    </div>
  )
}
