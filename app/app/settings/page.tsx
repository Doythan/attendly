'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

export default function SettingsPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [academyName, setAcademyName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
      setProfile(data)
      setAcademyName(data?.academy_name ?? '')
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update({ academy_name: academyName.trim() }).eq('id', user!.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">설정</h1>

      <div className="bg-white border rounded-xl p-6 max-w-lg">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">학원 정보</h2>

        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-1.5">학원명</label>
          <input
            type="text"
            value={academyName}
            onChange={e => setAcademyName(e.target.value)}
            placeholder="예: 도경원 영어학원"
            className="w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <p className="text-xs text-gray-400 mt-1.5">문자 발송 시 학원명이 자동으로 포함됩니다.</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm text-gray-600 mb-1.5">현재 플랜</label>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
            profile?.plan === 'PRO' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {profile?.plan ?? '—'} 플랜
          </span>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? '저장 중...' : saved ? '저장됨 ✓' : '저장'}
        </button>
      </div>
    </div>
  )
}
