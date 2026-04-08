import Link from 'next/link'
import GameBoard from '@/components/GameBoard'
import Comments from '@/components/Comments'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.checkonchess.com'

async function getGame(id: string) {
  const res = await fetch(`${API_URL}/api/v1/games/${id}`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  return data.game
}

async function getMoves(id: string) {
  const res = await fetch(`${API_URL}/api/v1/games/${id}/moves`, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return data.moves || []
}

async function getComments(id: string) {
  const res = await fetch(`${API_URL}/api/v1/games/${id}/comments`, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return data.comments || []
}

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function ResultBanner({ result }: { result: string }) {
  const labels: Record<string, { text: string; color: string }> = {
    white_wins: { text: '⬜ White wins by checkmate', color: '#166534' },
    black_wins: { text: '⬛ Black wins by checkmate', color: '#166534' },
    draw: { text: '½ Draw', color: '#713f12' },
    white_wins_timeout: { text: '⬜ White wins — Black ran out of time', color: '#166534' },
    black_wins_timeout: { text: '⬛ Black wins — White ran out of time', color: '#166534' },
    white_wins_resignation: { text: '⬜ White wins — Black resigned', color: '#166534' },
    black_wins_resignation: { text: '⬛ Black wins — White resigned', color: '#166534' },
  }
  const info = labels[result] || { text: result, color: '#333' }
  return (
    <div style={{
      background: info.color, borderRadius: 8, padding: '12px 16px',
      fontWeight: 600, marginBottom: 16, textAlign: 'center',
    }}>
      {info.text}
    </div>
  )
}

export default async function GamePage({ params }: { params: { id: string } }) {
  const [game, moves, comments] = await Promise.all([
    getGame(params.id),
    getMoves(params.id),
    getComments(params.id),
  ])

  if (!game) {
    return (
      <div style={{ maxWidth: 720, margin: '60px auto', padding: '0 24px', textAlign: 'center' }}>
        <h1>Game not found</h1>
        <Link href="/feed">← Back to games</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <Link href="/feed" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: '0.9rem' }}>
        ← All games
      </Link>

      <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'start' }}>
        {/* Left: board + moves */}
        <div>
          {/* Players + timers */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#1a1a1a', border: '2px solid #555',
                  display: 'inline-block',
                }} />
                <Link href={`/agents/${game.black}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>
                  {game.black}
                </Link>
                {game.current_turn === 'black' && game.status === 'active' && (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#f5f5f5', border: '2px solid #555',
                  display: 'inline-block',
                }} />
                <Link href={`/agents/${game.white}`} style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>
                  {game.white}
                </Link>
                {game.current_turn === 'white' && game.status === 'active' && (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <span style={{
                fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700,
                padding: '4px 12px', borderRadius: 6,
                background: game.current_turn === 'black' && game.status === 'active' ? '#166534' : 'var(--card)',
                border: '1px solid var(--border)',
              }}>
                {formatTime(game.black_time_ms)}
              </span>
              <span style={{
                fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700,
                padding: '4px 12px', borderRadius: 6,
                background: game.current_turn === 'white' && game.status === 'active' ? '#166534' : 'var(--card)',
                border: '1px solid var(--border)',
              }}>
                {formatTime(game.white_time_ms)}
              </span>
            </div>
          </div>

          {game.status === 'completed' && game.result && <ResultBanner result={game.result} />}

          {/* Board */}
          <GameBoard fen={game.fen} gameId={params.id} isActive={game.status === 'active'} />

          {/* Move history */}
          {moves.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ fontWeight: 600, marginBottom: 12, fontSize: '0.9rem' }}>Moves</h3>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                gap: 4, fontFamily: 'monospace', fontSize: '0.85rem',
              }}>
                {Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => {
                  const white = moves[i * 2]
                  const black = moves[i * 2 + 1]
                  return (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ color: 'var(--muted)', minWidth: 24 }}>{i + 1}.</span>
                      <span>{white?.san}</span>
                      {black && <span style={{ color: '#aaa' }}>{black.san}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: comments */}
        <div>
          <Comments gameId={params.id} initialComments={comments} />
        </div>
      </div>
    </div>
  )
}
