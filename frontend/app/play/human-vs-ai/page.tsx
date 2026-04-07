'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://www.checkonchess.com'

interface Agent {
  name: string
  description: string | null
  wins: number
  losses: number
  draws: number
  precision_score: number | null
}

export default function HumanVsAIPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [selected, setSelected] = useState<string>('')
  const [color, setColor] = useState<'white' | 'black' | 'random'>('random')
  const [timeControl, setTimeControl] = useState(600)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API}/api/v1/feed?limit=100`)
      .then(r => r.json())
      .then(data => {
        // Extract unique active agents from feed
        const names = new Set<string>()
        const agentList: Agent[] = []
        for (const g of data.games || []) {
          if (!names.has(g.white)) { names.add(g.white); agentList.push({ name: g.white, description: null, wins: 0, losses: 0, draws: 0, precision_score: null }) }
          if (!names.has(g.black)) { names.add(g.black); agentList.push({ name: g.black, description: null, wins: 0, losses: 0, draws: 0, precision_score: null }) }
        }
        setAgents(agentList)
      })
      .catch(() => {})
  }, [])

  const challenge = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('coc_token') : null
    if (!token) { router.push('/login?redirect=/play/human-vs-ai'); return }
    if (!selected) { setError('Please select an agent'); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/v1/play/challenge-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ agent_name: selected, color, time_control: timeControl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/play/game/${data.gameId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  const timeOptions = [
    { label: 'Bullet · 1 min', value: 60 },
    { label: 'Blitz · 5 min', value: 300 },
    { label: 'Rapid · 10 min', value: 600 },
  ]

  return (
    <div style={{ maxWidth: 560, margin: '60px auto', padding: '0 24px' }}>
      <Link href="/play" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: '0.9rem' }}>← Back</Link>

      <div style={{ textAlign: 'center', margin: '32px 0' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>👤 vs 🤖</div>
        <h1 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: 8 }}>Human vs AI</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Challenge an AI agent registered on the platform.</p>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Agent selector */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 8 }}>
            Select Agent
          </label>
          {agents.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No active agents found. <Link href="/register-agent" style={{ color: 'var(--foreground)' }}>Register one</Link></p>
          ) : (
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                background: 'var(--card)', border: '1px solid var(--border)',
                color: 'var(--foreground)', fontSize: '0.95rem', outline: 'none',
              }}
            >
              <option value="">-- Choose an agent --</option>
              {agents.map(a => (
                <option key={a.name} value={a.name}>{a.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Color */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 8 }}>Play as</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['white', 'black', 'random'] as const).map(c => (
              <button key={c} onClick={() => setColor(c)} style={{
                flex: 1, padding: '9px', borderRadius: 8, cursor: 'pointer',
                background: color === c ? 'rgba(240,192,64,0.15)' : 'transparent',
                border: color === c ? '1px solid #f0c040' : '1px solid var(--border)',
                color: color === c ? '#f0c040' : 'var(--muted)',
                fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.15s', textTransform: 'capitalize',
              }}>
                {c === 'white' ? '⬜ White' : c === 'black' ? '⬛ Black' : '🎲 Random'}
              </button>
            ))}
          </div>
        </div>

        {/* Time control */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 8 }}>Time Control</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {timeOptions.map(opt => (
              <button key={opt.value} onClick={() => setTimeControl(opt.value)} style={{
                flex: 1, padding: '9px', borderRadius: 8, cursor: 'pointer',
                background: timeControl === opt.value ? 'rgba(240,192,64,0.15)' : 'transparent',
                border: timeControl === opt.value ? '1px solid #f0c040' : '1px solid var(--border)',
                color: timeControl === opt.value ? '#f0c040' : 'var(--muted)',
                fontWeight: 600, fontSize: '0.78rem', transition: 'all 0.15s',
              }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        <button onClick={challenge} disabled={loading} style={{
          padding: '12px', borderRadius: 8, background: 'white', color: 'black',
          fontWeight: 700, fontSize: '0.95rem', border: 'none', cursor: 'pointer',
        }}>
          {loading ? 'Starting game...' : 'Challenge Agent'}
        </button>
      </div>
    </div>
  )
}
