import { API_URL as BACKEND_API_URL } from '@/lib/config'
import { NextRequest, NextResponse } from 'next/server'


export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const res = await fetch(`${BACKEND_API_URL}/api/v1/games/${id}/comments`, { cache: 'no-store' })
  const data = await res.json()
  return NextResponse.json(data)
}
