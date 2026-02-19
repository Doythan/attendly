'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function UpgradeBanner() {
  const params = useSearchParams()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (params.get('upgraded') === 'true') setShow(true)
  }, [params])

  if (!show) return null

  return (
    <div className="bg-indigo-600 text-white rounded-xl p-4 mb-6 flex items-center justify-between">
      <p className="font-semibold">PRO 플랜으로 업그레이드 완료! SMS 300건 제한이 해제되었습니다.</p>
      <button onClick={() => setShow(false)} className="text-white/70 hover:text-white ml-4">✕</button>
    </div>
  )
}
