import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('010')) return '+82' + digits.slice(1)
  if (digits.startsWith('82')) return '+' + digits
  return '+' + digits
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
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

  const toNumber = normalizePhone(student.parent_phone)
  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        From: process.env.TWILIO_FROM_NUMBER!,
        To: toNumber,
        Body: message.content,
      }),
    }
  )

  const twilioData = await twilioRes.json() as { sid?: string; message?: string }

  if (!twilioRes.ok || !twilioData.sid) {
    await supabase
      .from('messages')
      .update({ status: 'FAILED', error: twilioData.message ?? 'Twilio error' })
      .eq('id', messageId)
    return NextResponse.json({ error: twilioData.message ?? 'Twilio error' }, { status: 502 })
  }

  await supabase
    .from('messages')
    .update({ status: 'SENT', provider_message_id: twilioData.sid, error: null })
    .eq('id', messageId)

  return NextResponse.json({ sid: twilioData.sid })
}
