'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function UpgradeBanner() {
  const router = useRouter()
  const params = useSearchParams()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (params.get('upgraded') === 'true') {
      setShow(true)
      // webhook이 DB 업데이트할 시간을 주고 서버 컴포넌트 재fetch
      const t = setTimeout(() => router.refresh(), 2500)
      return () => clearTimeout(t)
    }
  }, [params, router])

  if (!show) return null

  return (
    <div className="bg-indigo-600 text-white rounded-xl p-4 flex items-center justify-between">
      <p className="font-semibold">PRO 플랜으로 업그레이드 완료! SMS 300건 제한이 해제되었습니다.</p>
      <button onClick={() => setShow(false)} className="text-white/70 hover:text-white ml-4">✕</button>
    </div>
  )
}
