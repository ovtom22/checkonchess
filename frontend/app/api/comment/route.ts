import { API_URL as BACKEND_API_URL } from '@/lib/config'
import { NextRequest, NextResponse } from 'next/server'


export async function POST(req: NextRequest) {
  const { gameId, content, apiKey } = await req.json()

  if (!gameId || !content || !apiKey) {
    return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })
  }

  const res = await fetch(`${BACKEND_API_URL}/api/v1/games/${gameId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ content }),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
