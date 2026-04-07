'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface User {
  id: string
  username: string
  email: string
  avatar_url: string | null
  email_verified: boolean
  created_at: string
}

interface Stats {
  games_played: number
  wins: number
  draws: number
  losses: number
}

interface Game {
  id: string
  mode: string
  status: string
  result: string | null
  time_control: number
  created_at: string
  white_username: string | null
  black_username: string | null
  ai_agent_name: string | null
  white_user_id: string
  black_user_id: string
}

function formatResult(game: Game, userId: string): { label: string; color: string } {
  if (game.status !== 'completed' || !game.result) {
    return { label: game.status === 'active' ? 'In progress' : 'Ongoing', color: 'var(--muted)' }
  }
  const isWhite = game.white_user_id === userId
  const r = game.result
  const won =
    (isWhite && (r === 'white_wins' || r === 'white_wins_resignation')) ||
    (!isWhite && (r === 'black_wins' || r === 'black_wins_resignation'))
  const draw = r === 'draw'
  if (won) return { label: 'Win', color: '#22c55e' }
  if (draw) return { label: 'Draw', color: '#eab308' }
  return { label: 'Loss', color: '#ef4444' }
}

function formatTime(seconds: number): string {
  if (seconds >= 60) return `${seconds / 60}min`
  return `${seconds}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getOpponent(game: Game, userId: string): string {
  if (game.mode === 'human-vs-ai') return game.ai_agent_name || 'AI Agent'
  const isWhite = game.white_user_id === userId
  return isWhite ? (game.black_username || '?') : (game.white_username || '?')
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('coc_token')
    if (!token) {
      router.push('/login')
      return
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (!data.success) throw new Error(data.error || 'Failed to load profile')
        setUser(data.user)
        setStats(data.stats)
        setGames(data.recent_games)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('coc_token')
    localStorage.removeItem('coc_user')
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80, color: 'var(--muted)' }}>
        Loading profile...
      </div>
    )
  }

  if (error || !user || !stats) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <p style={{ color: '#ef4444', marginBottom: 16 }}>{error || 'Could not load profile'}</p>
        <Link href="/login" style={{ color: 'var(--muted)', textDecoration: 'none' }}>← Back to login</Link>
      </div>
    )
  }

  const winRate = stats.games_played > 0
    ? Math.round((stats.wins / stats.games_played) * 100)
    : 0

  return (
    <div style={{ maxWidth: 680, margin: '60px auto', padding: '0 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'var(--card)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', flexShrink: 0, overflow: 'hidden',
        }}>
          {user.avatar_url
            ? <img src={user.avatar_url} alt={user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : '♟️'
          }
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontWeight: 700, fontSize: '1.5rem', margin: 0, marginBottom: 4 }}>
            {user.username}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: 0 }}>
            {user.email}
            {!user.email_verified && (
              <span style={{
                marginLeft: 8, fontSize: '0.75rem',
                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                padding: '2px 8px', borderRadius: 4,
              }}>
                unverified
              </span>
            )}
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem', margin: '4px 0 0' }}>
            Member since {formatDate(user.created_at)}
          </p>
        </div>
        <button onClick={handleLogout} style={logoutStyle}>
          Sign out
        </button>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 40,
      }}>
        {[
          { label: 'Games', value: stats.games_played },
          { label: 'Wins', value: stats.wins, color: '#22c55e' },
          { label: 'Draws', value: stats.draws, color: '#eab308' },
          { label: 'Win rate', value: `${winRate}%`, color: winRate >= 50 ? '#22c55e' : 'var(--foreground)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '16px 12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: color || 'var(--foreground)' }}>
              {value}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 40 }}>
        <Link href="/play" style={actionButtonStyle}>
          Play now
        </Link>
        <Link href="/feed" style={{ ...actionButtonStyle, background: 'var(--card)', color: 'var(--foreground)' }}>
          View feed
        </Link>
      </div>

      {/* Recent games */}
      <div>
        <h2 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 16, color: 'var(--muted)' }}>
          RECENT GAMES
        </h2>

        {games.length === 0 ? (
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 10, padding: 32, textAlign: 'center', color: 'var(--muted)',
          }}>
            No games yet. <Link href="/play" style={{ color: 'var(--foreground)' }}>Start playing →</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {games.map(game => {
              const result = formatResult(game, user.id)
              const opponent = getOpponent(game, user.id)
              const playedAs = game.white_user_id === user.id ? 'White' : 'Black'
              return (
                <Link key={game.id} href={`/play/${game.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 16,
                    transition: 'border-color 0.15s',
                  }}>
                    {/* Result badge */}
                    <div style={{
                      width: 48, textAlign: 'center', fontWeight: 700,
                      fontSize: '0.85rem', color: result.color, flexShrink: 0,
                    }}>
                      {result.label}
                    </div>

                    {/* Game info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--foreground)' }}>
                        vs {opponent}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 2 }}>
                        {playedAs} · {formatTime(game.time_control)} · {game.mode === 'human-vs-ai' ? 'vs AI' : 'vs Human'}
                      </div>
                    </div>

                    {/* Date */}
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', flexShrink: 0 }}>
                      {formatDate(game.created_at)}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const logoutStyle: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8,
  background: 'transparent', border: '1px solid var(--border)',
  color: 'var(--muted)', fontSize: '0.85rem', cursor: 'pointer',
  flexShrink: 0,
}

const actionButtonStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8,
  background: 'white', color: 'black',
  fontWeight: 700, fontSize: '0.9rem',
  textDecoration: 'none', display: 'inline-block',
}
