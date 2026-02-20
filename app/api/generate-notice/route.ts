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

  const { noticeType, additionalInfo, tone } = await req.json()

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: profile } = await supabase
    .from('profiles')
    .select('academy_name')
    .eq('id', ownerId)
    .single()
  const academyName = profile?.academy_name?.trim() || '학원'
  const toneKor = tone === 'FORMAL' ? '공식적으로' : '따뜻하고 친근하게'

  const prompt = `학원 전체 학부모에게 보내는 공지 문자를 작성해줘.
학원명: ${academyName}
공지 유형: ${noticeType}
추가 정보: ${additionalInfo?.trim() || '없음'}
어조: ${toneKor}
요청사항: 학원 담당자가 학부모님께 직접 보내는 느낌으로, 핵심 내용을 명확하고 자연스럽게 전달. 불필요한 인삿말 반복 금지.
150자 이내의 자연스러운 한국어 문자 본문만 출력해. JSON이나 설명 없이 문자 텍스트만.`

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
      temperature: 0.8,
    }),
  })

  if (!openaiRes.ok) {
    const errText = await openaiRes.text()
    return NextResponse.json({ error: `OpenAI error: ${errText}` }, { status: 502 })
  }

  const openaiData = await openaiRes.json()
  const content: string = openaiData.choices[0]?.message?.content?.trim() ?? ''

  return NextResponse.json({ content })
}
