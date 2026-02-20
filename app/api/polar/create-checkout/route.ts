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

  const polarRes = await fetch('https://api.polar.sh/v1/checkouts/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      products: [process.env.POLAR_PRODUCT_ID],
      success_url: `${process.env.APP_BASE_URL}/app/dashboard?upgraded=true`,
      metadata: { owner_id: ownerId },
    }),
  })

  const session = await polarRes.json() as { url?: string; detail?: string }
  if (!polarRes.ok || !session.url) {
    return NextResponse.json({ error: session.detail ?? 'Polar checkout error' }, { status: 502 })
  }

  return NextResponse.json({ url: session.url })
}
