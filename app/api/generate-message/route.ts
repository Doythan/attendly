import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const preferredRegion = 'iad1'

async function verifyToken(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.id ?? null
}

export async function POST(req: NextRequest) {
  const ownerId = await verifyToken(req.headers.get('Authorization'))
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { studentName, date, status, tone, type, studentId, unpaidMonths, templateMode } = await req.json()

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // 학원명 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('academy_name')
    .eq('id', ownerId)
    .single()
  const academyName = profile?.academy_name?.trim() || '학원'

  let prompt: string

  if (type === 'ATTENDANCE') {
    const statusKor = status === 'ABSENT' ? '결석' : '지각'
    prompt = `학원 학부모에게 보내는 출결 안내 문자를 작성해줘.
학원명: ${academyName}
학생 이름: ${studentName}
날짜: ${date ?? '오늘'}
상태: ${statusKor}
어조: ${tone === 'FRIENDLY' ? '친근하게' : tone === 'FORMAL' ? '공식적으로' : '단호하게'}
120자 이내의 자연스러운 한국어 문자 본문만 출력해. JSON이나 설명 없이 문자 텍스트만.`
  } else if (templateMode) {
    // PAYMENT 템플릿 모드: 플레이스홀더 포함 1회 생성
    const toneKor = tone === 'FRIENDLY' ? '친근하게' : tone === 'FORMAL' ? '공식적으로' : '단호하게'
    prompt = `학원 수강료 미납 안내 문자 템플릿을 작성해줘.
학원명: ${academyName}
어조: ${toneKor}
조건:
- 문자 본문에 반드시 다음 플레이스홀더를 자연스럽게 포함할 것: {이름}, {미납개월}, {미수금}
- 미납 사실을 명확히 전달하고 납부를 유도하는 실질적인 내용
- 학원 담당자가 직접 연락한다는 느낌
- 150자 이내, JSON/설명 없이 문자 텍스트만 출력`
  } else {
    // PAYMENT 개별 모드 (기존 방식)
    const months = unpaidMonths ?? 1
    const toneKor = tone === 'FRIENDLY' ? '친근하게' : tone === 'FORMAL' ? '공식적으로' : '단호하게'
    prompt = `학원 학부모에게 보내는 수강료 미납 안내 문자를 작성해줘.
학원명: ${academyName}
학생 이름: ${studentName}
미납 현황: ${months}개월 연체
어조: ${toneKor}
요청사항: 미납 사실을 명확히 전달하되, 납부를 유도하는 실질적인 문자로 작성. 학원 담당자가 직접 연락한다는 느낌을 줄 것.
150자 이내의 자연스러운 한국어 문자 본문만 출력해. JSON이나 설명 없이 문자 텍스트만.`
  }

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 250,
      temperature: 0.75,
    }),
  })

  if (!openaiRes.ok) {
    const errText = await openaiRes.text()
    return NextResponse.json({ error: `OpenAI error: ${errText}` }, { status: 502 })
  }

  const openaiData = await openaiRes.json()
  const content: string = openaiData.choices[0]?.message?.content?.trim() ?? ''

  // templateMode는 저장하지 않고 내용만 반환
  if (templateMode) {
    return NextResponse.json({ content })
  }

  await supabase.from('messages').insert({
    owner_id: ownerId,
    student_id: studentId,
    type,
    tone,
    content,
    status: 'DRAFT',
  })

  return NextResponse.json({ content })
}
