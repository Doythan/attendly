'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Message, MessageStatus } from '@/lib/types'

const STATUS_COLOR: Record<MessageStatus, string> = {
  DRAFT:  'bg-gray-100 text-gray-600',
  SENT:   'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
}

export default function OutboxPage() {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ type: 'single' | 'bulk'; ids: string[] } | null>(null)

  // 미리보기/수정 모달 상태
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
    const drafts = messages.filter(m => m.status === 'DRAFT').map(m => m.id)
    if (selected.size === drafts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(drafts))
    }
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Outbox</h1>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button
              onClick={deleteSelected}
              className="border border-red-200 text-red-500 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-50"
            >
              선택 삭제 ({selected.size}건)
            </button>
          )}
          {selectedDrafts.length > 0 && (
            <button
              onClick={() => setConfirmModal({ type: 'bulk', ids: selectedDrafts })}
              disabled={!!sending}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {sending === 'bulk' ? '전송 중...' : `선택 전송 (${selectedDrafts.length}건)`}
            </button>
          )}
          <button onClick={fetchMessages} className="border rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
            새로고침
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">로딩 중...</p>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left w-8">
                  <input
                    type="checkbox"
                    checked={draftIds.length > 0 && selected.size === draftIds.length}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-4 py-3 text-left">학생</th>
                <th className="px-4 py-3 text-left">내용 미리보기</th>
                <th className="px-4 py-3 text-left">상태</th>
                <th className="px-4 py-3 text-left">생성일</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {messages.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {m.status !== 'SENT' && (
                      <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} />
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {(m.student as { name?: string; parent_phone?: string } | null)?.name ?? '알 수 없음'}
                    <div className="text-xs text-gray-400">{(m.student as { name?: string; parent_phone?: string } | null)?.parent_phone}</div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <button onClick={() => openPreview(m)} className="text-left w-full group">
                      <p className="text-gray-700 truncate group-hover:text-indigo-600 transition-colors">{m.content}</p>
                      <p className="text-xs text-indigo-400 mt-0.5">
                        {m.status === 'DRAFT' ? '전체보기 · 수정 가능' : '전체보기'}
                      </p>
                    </button>
                    {m.error && <p className="text-red-500 text-xs truncate mt-1">{m.error}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[m.status]}`}>
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
                          className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg hover:bg-indigo-100 disabled:opacity-50"
                        >
                          {sending === m.id ? '전송 중...' : '전송'}
                        </button>
                      )}
                      {m.status === 'FAILED' && (
                        <button onClick={() => resetFailed(m.id)} className="text-xs bg-yellow-50 text-yellow-700 px-3 py-1 rounded-lg hover:bg-yellow-100">
                          재시도
                        </button>
                      )}
                      {m.status !== 'SENT' && (
                        <button onClick={() => deleteMessage(m.id)} className="text-xs bg-red-50 text-red-500 px-3 py-1 rounded-lg hover:bg-red-100">
                          삭제
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {messages.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Outbox가 비어있습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 미리보기 / 수정 모달 */}
      {previewOpen && previewMessage && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
              <div>
                <h2 className="text-lg font-bold">
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

            {/* 본문 */}
            <div className="px-6 py-4 flex-1">
              {isDraft ? (
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={7}
                  className="w-full border rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 leading-relaxed"
                  placeholder="메시지 내용을 입력하세요"
                />
              ) : (
                <div className="w-full border rounded-xl px-4 py-3 text-sm text-gray-700 bg-gray-50 whitespace-pre-wrap leading-relaxed min-h-[10rem]">
                  {previewMessage.content}
                </div>
              )}
              {isDraft && (
                <p className="text-xs text-gray-400 mt-1 text-right">{editContent.length}자</p>
              )}
              {previewMessage.error && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-600">{previewMessage.error}</p>
                </div>
              )}
            </div>

            {/* 푸터 버튼 */}
            <div className="flex gap-2 justify-end px-6 pb-5">
              <button onClick={closePreview} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border rounded-lg">
                닫기
              </button>
              {isDraft && (
                <>
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="px-5 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 font-medium"
                  >
                    {saving ? '저장 중...' : '저장'}
                  </button>
                  <button
                    onClick={sendFromPreview}
                    disabled={!!sending}
                    className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                  >
                    전송
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SMS 전송 확인 모달 */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-xl">
            <h2 className="text-lg font-bold mb-3">SMS 전송 확인</h2>
            <p className="text-gray-600 mb-6">
              {confirmModal.type === 'bulk'
                ? `총 ${confirmModal.ids.length}건을 선택 전송합니다. 실제 SMS가 발송됩니다.`
                : '1건을 전송합니다. 실제 SMS가 발송됩니다.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmModal(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">취소</button>
              <button onClick={() => sendMessages(confirmModal.ids)} className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
                전송하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
