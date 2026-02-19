/**
 * Attendly Cloudflare Worker
 * Handles: generate-message, send-sms, send-sms-bulk, polar/create-checkout, polar/webhook
 */

export interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  OPENAI_API_KEY: string
  OPENAI_MODEL: string
  TWILIO_ACCOUNT_SID: string
  TWILIO_AUTH_TOKEN: string
  TWILIO_FROM_NUMBER: string
  POLAR_ACCESS_TOKEN: string
  POLAR_PRODUCT_ID: string
  POLAR_WEBHOOK_SECRET: string  // base64-encoded (Standard Webhooks spec)
  APP_BASE_URL: string
}

const FREE_MONTHLY_LIMIT = 20
const PRO_MONTHLY_LIMIT = 300
const RATE_LIMIT_PER_MIN = 5

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

// ─── Helpers ────────────────────────────────────────────────────────────────

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

function err(message: string, status = 400) {
  return json({ error: message }, status)
}

async function verifyToken(env: Env, authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY },
  })
  if (!res.ok) return null
  const data = await res.json<{ id: string }>()
  return data.id ?? null
}

function supa(env: Env) {
  const base = `${env.SUPABASE_URL}/rest/v1`
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }

  return {
    async get<T>(table: string, query: string): Promise<T[]> {
      const res = await fetch(`${base}/${table}?${query}`, { headers })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    async single<T>(table: string, query: string): Promise<T | null> {
      const rows = await this.get<T>(table, query + '&limit=1')
      return rows[0] ?? null
    },
    async insert<T>(table: string, body: unknown): Promise<T> {
      const res = await fetch(`${base}/${table}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      const rows = await res.json<T[]>()
      return rows[0]
    },
    async update(table: string, query: string, body: unknown): Promise<void> {
      const res = await fetch(`${base}/${table}?${query}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
    },
  }
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('010')) return '+82' + digits.slice(1)
  if (digits.startsWith('82')) return '+' + digits
  return '+' + digits
}

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

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

async function consumeSmsQuota(env: Env, ownerId: string, count = 1): Promise<string | null> {
  const db = supa(env)
  const profile = await db.single<{
    plan: string
    sms_sent_count: number
    sms_sent_count_month: string
  }>('profiles', `id=eq.${ownerId}&select=plan,sms_sent_count,sms_sent_count_month`)

  if (!profile) return 'Profile not found'

  const month = currentMonth()
  let currentCount = profile.sms_sent_count
  if (profile.sms_sent_count_month !== month) currentCount = 0

  const limit = profile.plan === 'PRO' ? PRO_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT
  if (currentCount + count > limit) {
    return `월 ${limit}건 한도를 초과했습니다. (현재 ${currentCount}건 사용) Upgrade required.`
  }

  await db.update('profiles', `id=eq.${ownerId}`, {
    sms_sent_count: currentCount + count,
    sms_sent_count_month: month,
  })
  return null
}

// ─── Handlers ───────────────────────────────────────────────────────────────

async function handleGenerateMessage(req: Request, env: Env, ownerId: string): Promise<Response> {
  const body = await req.json<{
    studentName: string
    date?: string
    status?: string
    tone: string
    type: 'ATTENDANCE' | 'PAYMENT'
    studentId: string
  }>()

  const { studentName, date, status, tone, type, studentId } = body

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
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL ?? 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.7,
    }),
  })

  if (!openaiRes.ok) {
    return err(`OpenAI error: ${await openaiRes.text()}`, 502)
  }

  const openaiData = await openaiRes.json<{
    choices: { message: { content: string } }[]
  }>()
  const content = openaiData.choices[0]?.message?.content?.trim() ?? ''

  const db = supa(env)
  await db.insert('messages', {
    owner_id: ownerId,
    student_id: studentId,
    type,
    tone,
    content,
    status: 'DRAFT',
  })

  return json({ content })
}

async function handleSendSms(req: Request, env: Env, ownerId: string): Promise<Response> {
  if (!checkRateLimit(ownerId)) return err('Rate limit exceeded. 분당 최대 5회', 429)

  const { messageId } = await req.json<{ messageId: string }>()
  const db = supa(env)

  const message = await db.single<{
    id: string; content: string; status: string; student_id: string
  }>('messages', `id=eq.${messageId}&owner_id=eq.${ownerId}&select=id,content,status,student_id`)

  if (!message) return err('Message not found', 404)
  if (message.status !== 'DRAFT') return err('Only DRAFT messages can be sent', 400)

  const student = await db.single<{ parent_phone: string }>(
    'students', `id=eq.${message.student_id}&select=parent_phone`
  )
  if (!student) return err('Student not found', 404)

  const quotaErr = await consumeSmsQuota(env, ownerId)
  if (quotaErr) return err(quotaErr, 402)

  const toNumber = normalizePhone(student.parent_phone)
  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`,
      },
      body: new URLSearchParams({
        From: env.TWILIO_FROM_NUMBER,
        To: toNumber,
        Body: message.content,
      }),
    }
  )

  const twilioData = await twilioRes.json<{ sid?: string; message?: string }>()

  if (!twilioRes.ok || !twilioData.sid) {
    await db.update('messages', `id=eq.${messageId}`, {
      status: 'FAILED',
      error: twilioData.message ?? 'Twilio error',
    })
    return err(twilioData.message ?? 'Twilio error', 502)
  }

  await db.update('messages', `id=eq.${messageId}`, {
    status: 'SENT',
    provider_message_id: twilioData.sid,
    error: null,
  })

  return json({ sid: twilioData.sid })
}

async function handleSendSmsBulk(req: Request, env: Env, ownerId: string): Promise<Response> {
  if (!checkRateLimit(ownerId)) return err('Rate limit exceeded. 분당 최대 5회', 429)

  const { messageIds } = await req.json<{ messageIds: string[] }>()
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return err('messageIds must be a non-empty array')
  }

  const quotaErr = await consumeSmsQuota(env, ownerId, messageIds.length)
  if (quotaErr) return err(quotaErr, 402)

  const db = supa(env)
  const results: { id: string; status: 'SENT' | 'FAILED'; sid?: string; error?: string }[] = []

  for (const messageId of messageIds) {
    const message = await db.single<{
      id: string; content: string; status: string; student_id: string
    }>('messages', `id=eq.${messageId}&owner_id=eq.${ownerId}&select=id,content,status,student_id`)

    if (!message || message.status !== 'DRAFT') {
      results.push({ id: messageId, status: 'FAILED', error: 'Not found or not DRAFT' })
      continue
    }

    const student = await db.single<{ parent_phone: string }>(
      'students', `id=eq.${message.student_id}&select=parent_phone`
    )
    if (!student) {
      await db.update('messages', `id=eq.${messageId}`, { status: 'FAILED', error: 'Student not found' })
      results.push({ id: messageId, status: 'FAILED', error: 'Student not found' })
      continue
    }

    const toNumber = normalizePhone(student.parent_phone)
    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`,
        },
        body: new URLSearchParams({
          From: env.TWILIO_FROM_NUMBER,
          To: toNumber,
          Body: message.content,
        }),
      }
    )

    const twilioData = await twilioRes.json<{ sid?: string; message?: string }>()

    if (!twilioRes.ok || !twilioData.sid) {
      await db.update('messages', `id=eq.${messageId}`, {
        status: 'FAILED',
        error: twilioData.message ?? 'Twilio error',
      })
      results.push({ id: messageId, status: 'FAILED', error: twilioData.message })
    } else {
      await db.update('messages', `id=eq.${messageId}`, {
        status: 'SENT',
        provider_message_id: twilioData.sid,
        error: null,
      })
      results.push({ id: messageId, status: 'SENT', sid: twilioData.sid })
    }
  }

  return json({ results })
}

// ─── Polar ──────────────────────────────────────────────────────────────────

async function handleCreateCheckout(req: Request, env: Env, ownerId: string): Promise<Response> {
  const polarRes = await fetch('https://api.polar.sh/v1/checkouts/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      products: [env.POLAR_PRODUCT_ID],
      success_url: `${env.APP_BASE_URL}/app/dashboard?upgraded=true`,
      metadata: { owner_id: ownerId },
    }),
  })

  const session = await polarRes.json<{ url?: string; detail?: string }>()
  if (!polarRes.ok || !session.url) {
    return err(session.detail ?? 'Polar checkout error', 502)
  }

  return json({ url: session.url })
}

/**
 * Standard Webhooks signature verification
 * Spec: https://github.com/standard-webhooks/standard-webhooks
 * Secret is base64-encoded.
 */
async function verifyPolarWebhook(body: string, headers: Headers, secret: string): Promise<boolean> {
  const msgId = headers.get('webhook-id')
  const msgTimestamp = headers.get('webhook-timestamp')
  const msgSignature = headers.get('webhook-signature')

  if (!msgId || !msgTimestamp || !msgSignature) return false

  // Reject if timestamp is >5 min old
  const ts = parseInt(msgTimestamp, 10)
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false

  const signedContent = `${msgId}.${msgTimestamp}.${body}`

  // Polar secret format: "polar_whs_<base64>" — strip prefix before decoding
  const b64 = secret.startsWith('polar_whs_') ? secret.slice('polar_whs_'.length) : secret
  const secretBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent))
  const expectedSig = btoa(String.fromCharCode(...new Uint8Array(sig)))

  // Header may contain multiple space-separated signatures
  return msgSignature.split(' ').some(s => {
    const [version, sigValue] = s.split(',')
    return version === 'v1' && sigValue === expectedSig
  })
}

async function handlePolarWebhook(req: Request, env: Env): Promise<Response> {
  const body = await req.text()

  const valid = await verifyPolarWebhook(body, req.headers, env.POLAR_WEBHOOK_SECRET)
  if (!valid) return err('Invalid webhook signature', 400)

  const event = JSON.parse(body) as {
    type: string
    data: {
      status?: string
      metadata?: Record<string, string>
    }
  }

  // checkout.updated with status=succeeded → upgrade to PRO
  if (
    event.type === 'checkout.updated' &&
    event.data.status === 'succeeded'
  ) {
    const ownerId = event.data.metadata?.owner_id
    if (ownerId) {
      const db = supa(env)
      await db.update('profiles', `id=eq.${ownerId}`, { plan: 'PRO' })
    }
  }

  return json({ received: true })
}

// ─── Main fetch handler ──────────────────────────────────────────────────────

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() })
    }

    const url = new URL(req.url)
    const path = url.pathname

    // Polar webhook — no JWT, verified by signature
    if (req.method === 'POST' && path === '/api/polar/webhook') {
      return handlePolarWebhook(req, env)
    }

    // All other routes require JWT
    const ownerId = await verifyToken(env, req.headers.get('Authorization'))
    if (!ownerId) return err('Unauthorized', 401)

    if (req.method === 'POST') {
      if (path === '/api/generate-message')       return handleGenerateMessage(req, env, ownerId)
      if (path === '/api/send-sms')               return handleSendSms(req, env, ownerId)
      if (path === '/api/send-sms-bulk')          return handleSendSmsBulk(req, env, ownerId)
      if (path === '/api/polar/create-checkout')  return handleCreateCheckout(req, env, ownerId)
    }

    return err('Not found', 404)
  },
}
