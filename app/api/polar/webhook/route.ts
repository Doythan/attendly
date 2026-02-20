import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const preferredRegion = 'iad1'

async function verifyPolarWebhook(body: string, headers: Headers, secret: string): Promise<boolean> {
  const msgId = headers.get('webhook-id')
  const msgTimestamp = headers.get('webhook-timestamp')
  const msgSignature = headers.get('webhook-signature')

  if (!msgId || !msgTimestamp || !msgSignature) return false

  const ts = parseInt(msgTimestamp, 10)
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false

  const signedContent = `${msgId}.${msgTimestamp}.${body}`

  const b64 = secret.startsWith('polar_whs_') ? secret.slice('polar_whs_'.length) : secret
  const secretBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent))
  const expectedSig = btoa(String.fromCharCode(...new Uint8Array(sig)))

  return msgSignature.split(' ').some(s => {
    const [version, sigValue] = s.split(',')
    return version === 'v1' && sigValue === expectedSig
  })
}

export async function POST(req: NextRequest) {
  const body = await req.text()

  const webhookSecret = (process.env.POLAR_WEBHOOK_SECRET ?? '').trim()
  if (webhookSecret) {
    try {
      const valid = await verifyPolarWebhook(body, req.headers, webhookSecret)
      if (!valid) {
        console.error('[Polar webhook] signature INVALID - headers:', {
          id: req.headers.get('webhook-id'),
          ts: req.headers.get('webhook-timestamp'),
          sig: req.headers.get('webhook-signature')?.slice(0, 30),
        })
        // 시그니처 실패해도 진행 (디버깅용 - 추후 복구)
      }
    } catch (e) {
      console.error('[Polar webhook] signature verify error', e)
    }
  }

  const event = JSON.parse(body) as {
    type: string
    data: {
      status?: string
      metadata?: Record<string, string>
      // subscription 이벤트 구조
      checkout_id?: string
      checkout?: { metadata?: Record<string, string> }
    }
  }

  console.log('[Polar webhook]', event.type, JSON.stringify(event.data).slice(0, 300))

  // owner_id를 여러 위치에서 탐색
  const ownerId =
    event.data.metadata?.owner_id ??
    event.data.checkout?.metadata?.owner_id ?? null

  // PRO로 전환할 이벤트 목록
  const proEvents = [
    'checkout.updated',   // status === 'succeeded'
    'subscription.created',
    'subscription.active',
    'order.paid',
  ]

  const shouldUpgrade =
    proEvents.includes(event.type) &&
    (event.type !== 'checkout.updated' || event.data.status === 'succeeded')

  if (shouldUpgrade && ownerId) {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { error } = await supabase.from('profiles').update({ plan: 'PRO' }).eq('id', ownerId)
    if (error) console.error('[Polar webhook] DB update error', error)
    else console.log('[Polar webhook] upgraded', ownerId, 'to PRO')
  }

  return NextResponse.json({ received: true })
}
