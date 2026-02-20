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

  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET ?? ''
  if (webhookSecret) {
    const valid = await verifyPolarWebhook(body, req.headers, webhookSecret)
    if (!valid) return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  const event = JSON.parse(body) as {
    type: string
    data: { status?: string; metadata?: Record<string, string> }
  }

  if (event.type === 'checkout.updated' && event.data.status === 'succeeded') {
    const ownerId = event.data.metadata?.owner_id
    if (ownerId) {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await supabase.from('profiles').update({ plan: 'PRO' }).eq('id', ownerId)
    }
  }

  return NextResponse.json({ received: true })
}
