import { NextRequest, NextResponse } from 'next/server'

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

  const polarApiBase = (process.env.POLAR_API_URL ?? 'https://api.polar.sh').trim()
  const polarRes = await fetch(`${polarApiBase}/v1/checkouts/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      products: [(process.env.POLAR_PRODUCT_ID ?? '').trim()],
      success_url: `${(process.env.APP_BASE_URL ?? '').trim()}/app/dashboard?upgraded=true`,
      metadata: { owner_id: ownerId },
    }),
  })

  const session = await polarRes.json() as { url?: string; detail?: unknown }
  if (!polarRes.ok || !session.url) {
    const errDetail = typeof session.detail === 'string'
      ? session.detail
      : JSON.stringify(session.detail)
    console.error('[Polar checkout error]', polarRes.status, errDetail)
    return NextResponse.json({ error: errDetail ?? 'Polar checkout error', status: polarRes.status }, { status: 502 })
  }

  return NextResponse.json({ url: session.url })
}
