import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b">
        <span className="text-xl font-bold text-indigo-600">Attendly</span>
        <Link href="/login" className="text-sm text-gray-600 hover:text-indigo-600">
          로그인 →
        </Link>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
          학원 출결 관리 &amp; 학부모 SMS 자동화
        </h1>
        <p className="text-lg text-gray-500 mb-8">
          결석·미납 학생을 클릭 한 번으로 파악하고, AI가 안내문을 써주고,
          <br />Solapi로 실제 문자가 날아갑니다.
        </p>
        <Link
          href="/login"
          className="inline-block bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
        >
          무료로 시작하기
        </Link>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-4xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold text-center mb-10">요금제</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free */}
          <div className="border rounded-2xl p-8">
            <h3 className="text-lg font-semibold mb-1">FREE</h3>
            <p className="text-3xl font-bold mb-4">
              ₩0<span className="text-base font-normal text-gray-500">/월</span>
            </p>
            <ul className="text-sm text-gray-600 space-y-2 mb-8">
              <li>✔ 학생 무제한 등록</li>
              <li>✔ 출결 관리</li>
              <li>✔ AI 안내문 생성</li>
              <li>✔ 월 SMS 20건 발송</li>
            </ul>
            <Link
              href="/login"
              className="block text-center border border-indigo-600 text-indigo-600 py-2 rounded-lg hover:bg-indigo-50 transition"
            >
              시작하기
            </Link>
          </div>

          {/* Pro */}
          <div className="border-2 border-indigo-600 rounded-2xl p-8 relative">
            <span className="absolute -top-3 left-6 bg-indigo-600 text-white text-xs px-3 py-1 rounded-full">
              추천
            </span>
            <h3 className="text-lg font-semibold mb-1">PRO</h3>
            <p className="text-3xl font-bold mb-4">
              ₩29,000<span className="text-base font-normal text-gray-500">/월</span>
            </p>
            <ul className="text-sm text-gray-600 space-y-2 mb-8">
              <li>✔ FREE 모든 기능</li>
              <li>✔ 월 SMS 300건 발송</li>
              <li>✔ 미납 리마인드 자동화</li>
              <li>✔ 우선 지원</li>
            </ul>
            <Link
              href="/app/billing"
              className="block text-center bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition"
            >
              업그레이드
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
