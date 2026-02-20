'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Message, MessageStatus } from '@/lib/types'

const STATUS_COLOR: Record<MessageStatus, string> = {
  DRAFT:  'bg-gray-100 text-gray-600',
  SENT:   'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
}

const PAGE_SIZE = 15

export default function OutboxPage() {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ type: 'single' | 'bulk'; ids: string[] } | null>(null)

  // 필터/페이징
  const [filterStatus, setFilterStatus] = useState<MessageStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)

  // 미리보기/수정 모달
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewMessage, setPreviewMessage] = useState<Message | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, student:students(name, parent_phone)')
      .order('created_at', { ascending: false })
    setMessages((data as Message[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchMessages() }, [fetchMessages])
  useEffect(() => { setPage(1) }, [filterStatus])

  const filtered = useMemo(() => {
    if (filterStatus === 'ALL') return messages
    return messages.filter(m => m.status === filterStatus)
  }, [messages, filterStatus])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function openPreview(m: Message) {
    setPreviewMessage(m)
    setEditContent(m.content)
    setPreviewOpen(true)
  }

  function closePreview() {
    setPreviewOpen(false)
    setPreviewMessage(null)
    setEditContent('')
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleAll() {
    const pageIds = paginated.map(m => m.id)
    const allSelected = pageIds.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) { pageIds.forEach(id => next.delete(id)) }
      else { pageIds.forEach(id => next.add(id)) }
      return next
    })
  }

  async function deleteMessage(id: string) {
    await supabase.from('messages').delete().eq('id', id)
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next })
    fetchMessages()
  }

  async function deleteSelected() {
    await supabase.from('messages').delete().in('id', Array.from(selected))
    setSelected(new Set())
    fetchMessages()
  }

  async function resetFailed(id: string) {
    await supabase.from('messages').update({ status: 'DRAFT', error: null }).eq('id', id)
    fetchMessages()
  }

  async function saveEdit() {
    if (!previewMessage) return
    setSaving(true)
    await supabase.from('messages').update({ content: editContent }).eq('id', previewMessage.id)
    setSaving(false)
    closePreview()
    fetchMessages()
  }

  async function sendMessages(ids: string[]) {
    const { data: { session } } = await supabase.auth.getSession()
    setConfirmModal(null)

    if (ids.length === 1) {
      setSending(ids[0])
      await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({ messageId: ids[0] }),
      })
      setSending(null)
    } else {
      setSending('bulk')
      await fetch('/api/send-sms-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({ messageIds: ids }),
      })
      setSending(null)
    }

    setSelected(new Set())
    fetchMessages()
  }

  function sendFromPreview() {
    if (!previewMessage) return
    const id = previewMessage.id
    closePreview()
    setConfirmModal({ type: 'single', ids: [id] })
  }

  const draftIds = messages.filter(m => m.status === 'DRAFT').map(m => m.id)
  const selectedDrafts = Array.from(selected).filter(id => draftIds.includes(id))
  const isDraft = previewMessage?.status === 'DRAFT'
  const pageIds = paginated.map(m => m.id)
  const pageAllSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id))

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: messages.length, DRAFT: 0, SENT: 0, FAILED: 0 }
    messages.forEach(m => { counts[m.status] = (counts[m.status] ?? 0) + 1 })
    return counts
  }, [messages])

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Outbox</h1>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button
              onClick={deleteSelected}
              className="border border-red-200 text-red-500 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50 transition"
            >
              선택 삭제 ({selected.size}건)
            </button>
          )}
          {selectedDrafts.length > 0 && (
            <button
              onClick={() => setConfirmModal({ type: 'bulk', ids: selectedDrafts })}
              disabled={!!sending}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {sending === 'bulk' ? '전송 중...' : `선택 전송 (${selectedDrafts.length}건)`}
            </button>
          )}
          <button onClick={fetchMessages} className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
            새로고침
          </button>
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['ALL', 'DRAFT', 'SENT', 'FAILED'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              filterStatus === s
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s === 'ALL' ? '전체' : s}
            <span className={`ml-1.5 text-xs ${filterStatus === s ? 'text-gray-400' : 'text-gray-400'}`}>
              {statusCounts[s] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* 테이블 */}
      {loading ? (
        <p className="text-gray-400 text-sm py-8 text-center">로딩 중...</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left w-8">
                  <input type="checkbox" checked={pageAllSelected} onChange={toggleAll} className="w-4 h-4 rounded" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">학생</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">내용 미리보기</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">상태</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">생성일</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map(m => (
                <tr key={m.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} className="w-4 h-4 rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{(m.student as { name?: string } | null)?.name ?? '알 수 없음'}</p>
                    <p className="text-xs text-gray-400">{(m.student as { parent_phone?: string } | null)?.parent_phone}</p>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <button onClick={() => openPreview(m)} className="text-left w-full group">
                      <p className="text-gray-700 truncate group-hover:text-indigo-600 transition">{m.content}</p>
                      <p className="text-xs text-indigo-400 mt-0.5">
                        {m.status === 'DRAFT' ? '전체보기 · 수정 가능' : '전체보기'}
                      </p>
                    </button>
                    {m.error && <p className="text-red-500 text-xs truncate mt-1">{m.error}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[m.status]}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(m.created_at).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      {m.status === 'DRAFT' && (
                        <button
                          onClick={() => setConfirmModal({ type: 'single', ids: [m.id] })}
                          disabled={!!sending}
                          className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg hover:bg-indigo-100 transition disabled:opacity-50"
                        >
                          {sending === m.id ? '전송 중...' : '전송'}
                        </button>
                      )}
                      {m.status === 'FAILED' && (
                        <button onClick={() => resetFailed(m.id)} className="text-xs bg-yellow-50 text-yellow-700 px-3 py-1 rounded-lg hover:bg-yellow-100 transition">
                          재시도
                        </button>
                      )}
                      <button onClick={() => deleteMessage(m.id)} className="text-xs bg-red-50 text-red-500 px-3 py-1 rounded-lg hover:bg-red-100 transition">
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">메시지가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">이전</button>
          <span className="text-sm text-gray-500">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">다음</button>
        </div>
      )}

      {/* 미리보기/수정 모달 */}
      {previewOpen && previewMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {isDraft ? '내용 수정' : '내용 보기'}
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {(previewMessage.student as { name?: string } | null)?.name ?? '알 수 없음'} ·{' '}
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLOR[previewMessage.status]}`}>
                    {previewMessage.status}
                  </span>
                </p>
              </div>
              <button onClick={closePreview} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="px-6 py-4 flex-1">
              {isDraft ? (
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={7}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 leading-relaxed"
                />
              ) : (
                <div className="w-full border border-gray-100 rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 whitespace-pre-wrap leading-relaxed min-h-[10rem]">
                  {previewMessage.content}
                </div>
              )}
              {isDraft && <p className="text-xs text-gray-400 mt-1 text-right">{editContent.length}자</p>}
              {previewMessage.error && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-600">{previewMessage.error}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end px-6 pb-5">
              <button onClick={closePreview} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg transition">닫기</button>
              {isDraft && (
                <>
                  <button onClick={saveEdit} disabled={saving}
                    className="px-5 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 font-medium transition">
                    {saving ? '저장 중...' : '저장'}
                  </button>
                  <button onClick={sendFromPreview} disabled={!!sending}
                    className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition">
                    전송
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 전송 확인 모달 */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900 mb-3">SMS 전송 확인</h2>
            <p className="text-gray-600 mb-6">
              {confirmModal.type === 'bulk'
                ? `총 ${confirmModal.ids.length}건을 선택 전송합니다. 실제 SMS가 발송됩니다.`
                : '1건을 전송합니다. 실제 SMS가 발송됩니다.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmModal(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg transition">취소</button>
              <button onClick={() => sendMessages(confirmModal.ids)} className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition">
                전송하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
