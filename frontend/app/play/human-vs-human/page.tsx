'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://www.checkonchess.com'
const WS_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.checkonchess.com')
  .replace('https://', 'wss://')
  .replace('http://', 'ws://')

export default function HumanVsHumanPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'searching' | 'matched'>('idle')
  const [timeControl, setTimeControl] = useState(600)
  const [error, setError] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('coc_token') : null

  const joinQueue = async () => {
    const token = getToken()
    if (!token) {
      router.push('/login?redirect=/play/human-vs-human')
      return
    }
    setError('')
    setStatus('searching')

    try {
      const res = await fetch(`${API}/api/v1/play/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ time_control: timeControl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.matched) {
        router.push(`/play/game/${data.gameId}`)
        return
      }

      // Connect WS and poll for match
      const ws = new WebSocket(`${WS_URL}/ws?token=${token}&game=queue`)
      wsRef.current = ws

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'matched') {
            const myId = JSON.parse(localStorage.getItem('coc_user') || '{}').id
            if (msg.whiteId === myId || msg.blackId === myId) {
              setStatus('matched')
              router.push(`/play/game/${msg.gameId}`)
            }
          }
        } catch {}
      }

      // Also poll every 3s as fallback
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`${API}/api/v1/play/queue/status`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const d = await r.json()
          if (d.activeGame) {
            clearInterval(pollRef.current!)
            router.push(`/play/game/${d.activeGame}`)
          }
        } catch {}
      }, 3000)

    } catch (err: unknown) {
      setStatus('idle')
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const leaveQueue = async () => {
    const token = getToken()
    if (token) {
      await fetch(`${API}/api/v1/play/queue`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    }
    wsRef.current?.close()
    if (pollRef.current) clearInterval(pollRef.current)
    setStatus('idle')
  }

  useEffect(() => {
    return () => {
      wsRef.current?.close()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const timeOptions = [
    { label: 'Bullet · 1 min', value: 60 },
    { label: 'Blitz · 3 min', value: 180 },
    { label: 'Blitz · 5 min', value: 300 },
    { label: 'Rapid · 10 min', value: 600 },
    { label: 'Rapid · 15 min', value: 900 },
  ]

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', padding: '0 24px' }}>
      <Link href="/play" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: '0.9rem' }}>
        ← Back
      </Link>

      <div style={{ textAlign: 'center', margin: '32px 0' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>👤 vs 👤</div>
        <h1 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: 8 }}>Human vs Human</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Find a random opponent and play in real-time.</p>
      </div>

      {status === 'idle' && (
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 16, fontSize: '0.95rem' }}>Time Control</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {timeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTimeControl(opt.value)}
                style={{
                  padding: '10px 16px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                  background: timeControl === opt.value ? 'rgba(240,192,64,0.15)' : 'transparent',
                  border: timeControl === opt.value ? '1px solid #f0c040' : '1px solid var(--border)',
                  color: timeControl === opt.value ? '#f0c040' : 'var(--foreground)',
                  fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: '0.875rem', marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button onClick={joinQueue} style={{
            width: '100%', padding: '12px', borderRadius: 8, background: 'white', color: 'black',
            fontWeight: 700, fontSize: '0.95rem', border: 'none', cursor: 'pointer',
          }}>
            Find Opponent
          </button>
        </div>
      )}

      {status === 'searching' && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: '2rem', marginBottom: 16 }}>🔍</div>
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Searching for opponent...</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 8, fontSize: '0.9rem' }}>
            {timeOptions.find(t => t.value === timeControl)?.label}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, margin: '24px 0' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: '50%', background: '#f0c040',
                animation: `pulse-green 1.4s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
          <button onClick={leaveQueue} style={{
            padding: '10px 20px', borderRadius: 8, background: 'transparent',
            border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer',
          }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
