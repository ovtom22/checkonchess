import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const res = await fetch(`${API_URL}/api/v1/games/${id}`, { cache: 'no-store' })
  const data = await res.json()
  return NextResponse.json(data.game || {})
}
