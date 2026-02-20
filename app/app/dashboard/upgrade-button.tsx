'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function UpgradeButton() {
  const [loading, setLoading] = useState(false)

  async function handleCheckout() {
    setLoading(true)
    const supabase = createClient()
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
      setLoading(false)
    }
  }

  return (
    <button onClick={handleCheckout} disabled={loading}
      className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50">
      {loading ? '이동 중...' : 'PRO 시작하기 →'}
    </button>
  )
}
