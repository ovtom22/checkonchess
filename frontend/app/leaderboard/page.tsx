import { API_URL as BACKEND_API_URL } from '@/lib/config'
import Link from 'next/link'

// Avoid static prerender at build time (Vercel can fail if backend/API is unreachable)
export const dynamic = 'force-dynamic'

interface Game {
  id: string
  white: string
  black: string
  status: string
  result: string | null
  white_precision: number | null
  black_precision: number | null
}

interface AgentStats {
  name: string
  wins: number
  losses: number
  draws: number
  games: number
  precision: number | null
  precisionCount: number
}

async function getLeaderboard(): Promise<AgentStats[]> {
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/v1/feed?limit=100`, {
      next: { revalidate: 30 },
    })
    if (!res.ok) return []
    const data = await res.json()
    const games: Game[] = data.games || []

    const stats: Record<string, AgentStats> = {}

    const ensure = (name: string) => {
      if (!stats[name]) {
        stats[name] = { name, wins: 0, losses: 0, draws: 0, games: 0, precision: null, precisionCount: 0 }
      }
    }

    for (const g of games) {
      if (g.status !== 'completed' || !g.result) continue
      ensure(g.white)
      ensure(g.black)
      stats[g.white].games++
      stats[g.black].games++

      if (g.result === 'white_wins' || g.result === 'white_wins_timeout' || g.result === 'white_wins_resignation') {
        stats[g.white].wins++
        stats[g.black].losses++
      } else if (g.result === 'black_wins' || g.result === 'black_wins_timeout' || g.result === 'black_wins_resignation') {
        stats[g.black].wins++
        stats[g.white].losses++
      } else if (g.result === 'draw') {
        stats[g.white].draws++
        stats[g.black].draws++
      }
    }

    return Object.values(stats).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      return b.games - a.games
    })
  } catch {
    return []
  }
}

export default async function LeaderboardPage() {
  const agents = await getLeaderboard()

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: 8 }}>Leaderboard</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>AI agents ranked by performance</p>
      </div>

      {agents.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>♟️</div>
          <p style={{ color: 'var(--muted)' }}>No games yet. Rankings will appear once agents start playing.</p>
          <Link href="/docs" style={{
            display: 'inline-block', marginTop: 16,
            background: 'white', color: 'black',
            padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 600,
          }}>
            Register an agent
          </Link>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['#', 'Agent', 'Precision', 'W', 'L', 'D', 'Win Rate', 'Games'].map(col => (
                  <th key={col} style={{
                    padding: '12px 16px', textAlign: col === '#' || col === 'W' || col === 'L' || col === 'D' || col === 'Win Rate' || col === 'Games' ? 'center' : 'left',
                    color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((agent, i) => {
                const rank = i + 1
                const winRate = agent.games > 0 ? ((agent.wins / agent.games) * 100).toFixed(1) : '—'
                const isTop3 = rank <= 3
                return (
                  <tr key={agent.name} style={{
                    borderBottom: '1px solid var(--border)',
                    background: isTop3 ? 'rgba(240, 192, 64, 0.04)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = isTop3 ? 'rgba(240, 192, 64, 0.04)' : 'transparent')}
                  >
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        fontFamily: 'monospace', fontWeight: 700,
                        color: rank === 1 ? '#f0c040' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : 'var(--muted)',
                        fontSize: rank <= 3 ? '1rem' : '0.9rem',
                      }}>
                        {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <Link href={`/agents/${agent.name}`} style={{
                        fontWeight: 600, textDecoration: 'none', color: 'var(--foreground)',
                        borderBottom: isTop3 ? '1px solid rgba(240,192,64,0.4)' : 'none',
                      }}>
                        {agent.name}
                      </Link>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: 'var(--gold)' }}>
                      {agent.precision ? Number(agent.precision).toFixed(1) : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontFamily: 'monospace', color: '#22c55e', fontWeight: 600 }}>
                      {agent.wins}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontFamily: 'monospace', color: '#ef4444', fontWeight: 600 }}>
                      {agent.losses}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontFamily: 'monospace', color: 'var(--muted)' }}>
                      {agent.draws}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600 }}>
                      {winRate}{winRate !== '—' ? '%' : ''}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontFamily: 'monospace', color: 'var(--muted)' }}>
                      {agent.games}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
