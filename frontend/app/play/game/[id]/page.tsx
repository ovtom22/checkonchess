'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://www.checkonchess.com'
const WS_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.checkonchess.com')
  .replace('https://', 'wss://')
  .replace('http://', 'ws://')

interface GameState {
  id: string
  status: string
  result: string | null
  fen: string
  current_turn: string
  white_user_id: string | null
  black_user_id: string | null
  white_username: string | null
  black_username: string | null
  white_time_ms: number
  black_time_ms: number
  mode: string
  ai_agent_name: string | null
}

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const THEMES = [
  { id: 'classic', label: 'Classic', dark: '#4a4a4a', light: '#d4d4d4', preview: ['#4a4a4a', '#d4d4d4'] },
  { id: 'gold-silver', label: 'Gold/Silver', dark: '#b8960c', light: '#e8e0c0', preview: ['#f0c040', '#c0c0c0'] },
  { id: 'red-blue', label: 'Red/Blue', dark: '#1e3a6e', light: '#6e1e1e', preview: ['#ef4444', '#3b82f6'] },
  { id: 'pink-teal', label: 'Pink/Teal', dark: '#0d4f4f', light: '#4f0d3a', preview: ['#ec4899', '#14b8a6'] },
]

export default function PlayGamePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [game, setGame] = useState<GameState | null>(null)
  const [chess, setChess] = useState(new Chess())
  const [moves, setMoves] = useState<{san: string, color: string}[]>([])
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [themeId, setThemeId] = useState('classic')
  const [whiteTime, setWhiteTime] = useState(600000)
  const [blackTime, setBlackTime] = useState(600000)
  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('coc_token') : null

  useEffect(() => {
    const saved = localStorage.getItem('chess-theme')
    if (saved && THEMES.find(t => t.id === saved)) setThemeId(saved)
    const user = JSON.parse(localStorage.getItem('coc_user') || 'null')
    if (user) setMyUserId(user.id)
  }, [])

  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/play/games/${id}`)
      const data = await res.json()
      if (!data.success) return
      setGame(data.game)
      setWhiteTime(data.game.white_time_ms)
      setBlackTime(data.game.black_time_ms)
      const c = new Chess(data.game.fen)
      setChess(c)
      setMoves(data.moves.map((m: {san: string, color: string}) => ({ san: m.san, color: m.color })))
    } catch {}
  }, [id])

  useEffect(() => {
    fetchGame()

    // WebSocket
    const ws = new WebSocket(`${WS_URL}/ws?${token ? `token=${token}&` : ''}game=${id}`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'move' || msg.type === 'resigned') {
          fetchGame()
        }
      } catch {}
    }

    return () => { ws.close(); if (timerRef.current) clearInterval(timerRef.current) }
  }, [id, token, fetchGame])

  // Live timer
  useEffect(() => {
    if (!game || game.status !== 'active') return
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      if (game.current_turn === 'white') {
        setWhiteTime(t => Math.max(0, t - 100))
      } else {
        setBlackTime(t => Math.max(0, t - 100))
      }
    }, 100)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [game?.current_turn, game?.status])

  const onDrop = ({ sourceSquare, targetSquare }: { piece: unknown; sourceSquare: string; targetSquare: string | null }): boolean => {
    if (!targetSquare || !game || game.status !== 'active' || !myUserId) return false
    const isWhite = game.white_user_id === myUserId
    const isBlack = game.black_user_id === myUserId
    if (!isWhite && !isBlack) return false
    if (game.current_turn === 'white' && !isWhite) return false
    if (game.current_turn === 'black' && !isBlack) return false

    const move = chess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })
    if (!move) return false

    setChess(new Chess(chess.fen()))

    // Send to server async
    fetch(`${API}/api/v1/play/games/${id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ san: move.san }),
    }).then(r => r.json()).then(data => {
      if (!data.success) fetchGame()
      else if (data.status === 'completed') fetchGame()
    }).catch(() => fetchGame())

    return true
  }

  const resign = async () => {
    if (!confirm('Are you sure you want to resign?')) return
    await fetch(`${API}/api/v1/play/games/${id}/resign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    fetchGame()
  }

  const theme = THEMES.find(t => t.id === themeId) || THEMES[0]
  const isMyGame = game && (game.white_user_id === myUserId || game.black_user_id === myUserId)
  const myColor = game?.white_user_id === myUserId ? 'white' : 'black'
  const boardOrientation = isMyGame ? myColor : 'white'

  if (!game) return (
    <div style={{ textAlign: 'center', padding: 80 }}>
      <p style={{ color: 'var(--muted)' }}>Loading game...</p>
    </div>
  )

  const resultLabels: Record<string, string> = {
    white_wins: '⬜ White wins by checkmate',
    black_wins: '⬛ Black wins by checkmate',
    draw: '½ Draw',
    white_wins_resignation: '⬜ White wins — Black resigned',
    black_wins_resignation: '⬛ Black wins — White resigned',
    white_wins_timeout: '⬜ White wins on time',
    black_wins_timeout: '⬛ Black wins on time',
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px' }}>
      <Link href="/play" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: '0.9rem' }}>← Play</Link>

      <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
        <div>
          {/* Black player */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#1a1a1a', border: '2px solid #555', display: 'inline-block' }} />
              <span style={{ fontWeight: 600 }}>{game.black_username || game.ai_agent_name || 'Black'}</span>
              {game.current_turn === 'black' && game.status === 'active' && (
                <span className="live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              )}
            </div>
            <span style={{
              fontFamily: 'monospace', fontWeight: 700, fontSize: '1.2rem',
              padding: '4px 12px', borderRadius: 6,
              background: game.current_turn === 'black' && game.status === 'active' ? '#166534' : 'var(--card)',
              border: '1px solid var(--border)',
              color: blackTime < 30000 ? '#ef4444' : 'var(--foreground)',
            }}>
              {formatTime(blackTime)}
            </span>
          </div>

          {/* Game over banner */}
          {game.status === 'completed' && game.result && (
            <div style={{
              background: '#166534', borderRadius: 8, padding: '12px 16px',
              fontWeight: 600, marginBottom: 12, textAlign: 'center',
            }}>
              {resultLabels[game.result] || game.result}
            </div>
          )}

          {/* Theme selector */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {THEMES.map(t => (
              <button key={t.id} onClick={() => { setThemeId(t.id); localStorage.setItem('chess-theme', t.id) }} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6,
                background: themeId === t.id ? 'rgba(240,192,64,0.15)' : 'var(--card)',
                border: themeId === t.id ? '1px solid #f0c040' : '1px solid var(--border)',
                color: themeId === t.id ? '#f0c040' : 'var(--muted)',
                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 1, background: t.preview[0], display: 'inline-block' }} />
                <span style={{ width: 8, height: 8, borderRadius: 1, background: t.preview[1], display: 'inline-block' }} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Board */}
          <div style={{ maxWidth: 520 }}>
            <Chessboard
              options={{
                position: chess.fen(),
                allowDragging: (isMyGame && game.status === 'active') ?? false,
                boardOrientation,
                onPieceDrop: onDrop,
                darkSquareStyle: { backgroundColor: theme.dark },
                lightSquareStyle: { backgroundColor: theme.light },
                boardStyle: { borderRadius: '8px', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' },
              }}
            />
          </div>

          {/* White player */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#f5f5f5', border: '2px solid #555', display: 'inline-block' }} />
              <span style={{ fontWeight: 600 }}>{game.white_username || 'White'}</span>
              {game.current_turn === 'white' && game.status === 'active' && (
                <span className="live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              )}
            </div>
            <span style={{
              fontFamily: 'monospace', fontWeight: 700, fontSize: '1.2rem',
              padding: '4px 12px', borderRadius: 6,
              background: game.current_turn === 'white' && game.status === 'active' ? '#166534' : 'var(--card)',
              border: '1px solid var(--border)',
              color: whiteTime < 30000 ? '#ef4444' : 'var(--foreground)',
            }}>
              {formatTime(whiteTime)}
            </span>
          </div>

          {/* Resign button */}
          {isMyGame && game.status === 'active' && (
            <button onClick={resign} style={{
              marginTop: 16, padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem',
            }}>
              Resign
            </button>
          )}
        </div>

        {/* Right panel: moves */}
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 12, fontSize: '0.9rem' }}>Moves</h3>
          {moves.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No moves yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr', gap: '4px 8px', fontFamily: 'monospace', fontSize: '0.85rem', maxHeight: 400, overflowY: 'auto' }}>
              {Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => {
                const w = moves[i * 2]
                const b = moves[i * 2 + 1]
                return (
                  <>
                    <span key={`n${i}`} style={{ color: 'var(--muted)' }}>{i + 1}.</span>
                    <span key={`w${i}`}>{w?.san}</span>
                    <span key={`b${i}`} style={{ color: '#aaa' }}>{b?.san || ''}</span>
                  </>
                )
              })}
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12, color: '#ef4444', fontSize: '0.85rem' }}>{error}</div>
          )}
        </div>
      </div>
    </div>
  )
}
