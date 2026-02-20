import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac, randomUUID } from 'crypto'

export const preferredRegion = 'iad1'

const FREE_MONTHLY_LIMIT = 20
const PRO_MONTHLY_LIMIT = 300
const RATE_LIMIT_PER_MIN = 5
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= RATE_LIMIT_PER_MIN) return false
  entry.count++
  return true
}

// Solapi는 한국 포맷(010XXXXXXXX)으로 전송
function normalizePhoneForSolapi(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('82')) return '0' + digits.slice(2)
  return digits
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function getSolapiAuthHeader(): string {
  const apiKey = process.env.SOLAPI_API_KEY!
  const apiSecret = process.env.SOLAPI_API_SECRET!
  const date = new Date().toISOString()
  const salt = randomUUID()
  const signature = createHmac('sha256', apiSecret).update(date + salt).digest('hex')
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

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

async function consumeSmsQuota(
  supabase: ReturnType<typeof createClient>,
  ownerId: string,
  count = 1
): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, sms_sent_count, sms_sent_count_month')
    .eq('id', ownerId)
    .single()

  if (!profile) return 'Profile not found'

  const month = currentMonth()
  let currentCount = profile.sms_sent_count
  if (profile.sms_sent_count_month !== month) currentCount = 0

  const limit = profile.plan === 'PRO' ? PRO_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT
  if (currentCount + count > limit) {
    return `월 ${limit}건 한도를 초과했습니다. (현재 ${currentCount}건 사용) Upgrade required.`
  }

  await supabase
    .from('profiles')
    .update({ sms_sent_count: currentCount + count, sms_sent_count_month: month })
    .eq('id', ownerId)

  return null
}

export async function POST(req: NextRequest) {
  const ownerId = await verifyToken(req.headers.get('Authorization'))
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!checkRateLimit(ownerId))
    return NextResponse.json({ error: 'Rate limit exceeded. 분당 최대 5회' }, { status: 429 })

  const { messageId } = await req.json()
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: message } = await supabase
    .from('messages')
    .select('id, content, status, student_id')
    .eq('id', messageId)
    .eq('owner_id', ownerId)
    .single()

  if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  if (message.status !== 'DRAFT')
    return NextResponse.json({ error: 'Only DRAFT messages can be sent' }, { status: 400 })

  const { data: student } = await supabase
    .from('students')
    .select('parent_phone')
    .eq('id', message.student_id)
    .single()

  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  const quotaErr = await consumeSmsQuota(supabase, ownerId)
  if (quotaErr) return NextResponse.json({ error: quotaErr }, { status: 402 })

  const toNumber = normalizePhoneForSolapi(student.parent_phone)
  const solapiRes = await fetch('https://api.solapi.com/messages/v4/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getSolapiAuthHeader(),
    },
    body: JSON.stringify({
      message: {
        to: toNumber,
        from: process.env.SOLAPI_SENDER_NUMBER,
        text: message.content,
        type: 'LMS',
      },
    }),
  })

  const solapiData = await solapiRes.json() as { messageId?: string; errorCode?: string; errorMessage?: string }

  if (!solapiRes.ok || !solapiData.messageId) {
    const errMsg = solapiData.errorMessage ?? 'Solapi error'
    await supabase
      .from('messages')
      .update({ status: 'FAILED', error: errMsg })
      .eq('id', messageId)
    return NextResponse.json({ error: errMsg }, { status: 502 })
  }

  await supabase
    .from('messages')
    .update({ status: 'SENT', provider_message_id: solapiData.messageId, error: null })
    .eq('id', messageId)

  return NextResponse.json({ messageId: solapiData.messageId })
}
