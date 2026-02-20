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

  const { studentName, date, status, tone, type, studentId } = await req.json()

  let prompt: string
  if (type === 'ATTENDANCE') {
    const statusKor = status === 'ABSENT' ? '결석' : '지각'
    prompt = `학원 학부모에게 보내는 출결 안내 문자를 작성해줘. 학생 이름: ${studentName}, 날짜: ${date ?? '오늘'}, 상태: ${statusKor}. 어조: ${tone === 'FRIENDLY' ? '친근하게' : tone === 'FORMAL' ? '공식적으로' : '단호하게'}. 120자 이내의 자연스러운 한국어 문자 본문만 출력해. JSON이나 설명 없이 문자 텍스트만.`
  } else {
    prompt = `학원 학부모에게 보내는 미납 안내 문자를 작성해줘. 학생 이름: ${studentName}. 어조: ${tone === 'FRIENDLY' ? '친근하게' : tone === 'FORMAL' ? '공식적으로' : '단호하게'}. 120자 이내의 자연스러운 한국어 문자 본문만 출력해. JSON이나 설명 없이 문자 텍스트만.`
  }

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.7,
    }),
  })

  if (!openaiRes.ok) {
    const errText = await openaiRes.text()
    return NextResponse.json({ error: `OpenAI error: ${errText}` }, { status: 502 })
  }

  const openaiData = await openaiRes.json()
  const content: string = openaiData.choices[0]?.message?.content?.trim() ?? ''

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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
