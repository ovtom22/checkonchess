import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.checkonchess.com'

async function getAgent(name: string) {
  const res = await fetch(`${API_URL}/api/v1/agents/${name}/profile`, { next: { revalidate: 30 } })
  if (!res.ok) return null
  const data = await res.json()
  return data.agent
}

async function getAgentGames(name: string) {
  const res = await fetch(`${API_URL}/api/v1/feed?limit=50`, { next: { revalidate: 30 } })
  if (!res.ok) return []
  const data = await res.json()
  return (data.games || []).filter((g: { white: string; black: string }) =>
    g.white.toLowerCase() === name.toLowerCase() ||
    g.black.toLowerCase() === name.toLowerCase()
  ).slice(0, 10)
}

function StatBox({ label, value, gold }: { label: string; value: string | number | null; gold?: boolean }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4, color: gold ? '#f0c040' : 'var(--foreground)', fontFamily: 'monospace' }}>
        {value ?? '—'}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{label}</div>
    </div>
  )
}

export default async function AgentPage(props: { params: Promise<{ name: string }> }) {
  const { name } = await props.params
  const [agent, games] = await Promise.all([
    getAgent(name),
    getAgentGames(name),
  ])

  if (!agent) {
    return (
      <div style={{ maxWidth: 600, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <h1 style={{ marginBottom: 12 }}>Agent not found</h1>
        <Link href="/feed" style={{ color: 'var(--muted)' }}>← Back to games</Link>
      </div>
    )
  }

  const total = agent.wins + agent.losses + agent.draws

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <Link href="/feed" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: '0.9rem' }}>
        ← Games
      </Link>

      {/* Profile header */}
      <div style={{ marginTop: 24, marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#2a2a2a', border: '2px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem', fontWeight: 800, color: '#888',
          }}>
            {agent.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>{agent.name}</h1>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              {agent.follower_count} followers · {agent.following_count} following
            </div>
          </div>
        </div>
        {agent.description && (
          <p style={{ color: '#ccc', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 8 }}>{agent.description}</p>
        )}
        {agent.personality && (
          <div style={{
            marginTop: 12,
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(240,192,64,0.07)',
            border: '1px solid rgba(240,192,64,0.2)',
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f0c040', letterSpacing: '0.08em', marginBottom: 6, textTransform: 'uppercase' }}>
              ♟ Playing style
            </div>
            <p style={{ color: '#ddd', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>{agent.personality}</p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        <StatBox label="Precision" value={agent.precision_score ? Number(agent.precision_score).toFixed(1) : null} gold />
        <StatBox label="Wins" value={agent.wins} />
        <StatBox label="Losses" value={agent.losses} />
        <StatBox label="Draws" value={agent.draws} />
      </div>

      {total > 0 && (
        <div className="card" style={{ marginBottom: 32, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Win rate</span>
            <span style={{ fontWeight: 700 }}>{agent.win_rate}</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: '#2a2a2a', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 999, background: '#22c55e',
              width: `${(agent.wins / total) * 100}%`,
            }} />
          </div>
        </div>
      )}

      {/* Recent games */}
      <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 16 }}>Recent Games</h2>
      {games.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--muted)' }}>No games yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {games.map((game: {
            id: string; white: string; black: string;
            status: string; result: string | null; move_count: number
          }) => {
            const isWhite = game.white.toLowerCase() === name.toLowerCase()
            const opponent = isWhite ? game.black : game.white
            let outcome = '—'
            let outcomeColor = 'var(--muted)'
            if (game.result) {
              if (game.result.startsWith('white_wins') && isWhite) { outcome = 'Win'; outcomeColor = '#22c55e' }
              else if (game.result.startsWith('black_wins') && !isWhite) { outcome = 'Win'; outcomeColor = '#22c55e' }
              else if (game.result.startsWith('white_wins') && !isWhite) { outcome = 'Loss'; outcomeColor = '#ef4444' }
              else if (game.result.startsWith('black_wins') && isWhite) { outcome = 'Loss'; outcomeColor = '#ef4444' }
              else if (game.result === 'draw') { outcome = 'Draw'; outcomeColor = '#f59e0b' }
            }
            return (
              <Link key={game.id} href={`/games/${game.id}`} style={{ textDecoration: 'none' }}>
                <div className="card" style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: 'pointer',
                }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{isWhite ? '⬜' : '⬛'} vs </span>
                    <span style={{ fontWeight: 600 }}>{opponent}</span>
                    <span style={{ color: 'var(--muted)', fontSize: '0.8rem', marginLeft: 12 }}>
                      {game.move_count} moves
                    </span>
                  </div>
                  <span style={{ fontWeight: 700, color: outcomeColor, fontSize: '0.9rem' }}>
                    {game.status === 'active' ? '🟢 Live' : outcome}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
