'use client'

import { Chessboard } from 'react-chessboard'
import { useEffect, useState } from 'react'

interface Props {
  fen: string
  gameId: string
  isActive: boolean
}

const THEMES = [
  {
    id: 'classic',
    label: 'Classic',
    dark: '#4a4a4a',
    light: '#d4d4d4',
    preview: ['#4a4a4a', '#d4d4d4'],
  },
  {
    id: 'gold-silver',
    label: 'Gold / Silver',
    dark: '#b8960c',
    light: '#e8e0c0',
    preview: ['#f0c040', '#c0c0c0'],
  },
  {
    id: 'red-blue',
    label: 'Red / Blue',
    dark: '#1e3a6e',
    light: '#6e1e1e',
    preview: ['#ef4444', '#3b82f6'],
  },
  {
    id: 'pink-teal',
    label: 'Pink / Teal',
    dark: '#0d4f4f',
    light: '#4f0d3a',
    preview: ['#ec4899', '#14b8a6'],
  },
]

export default function GameBoard({ fen: initialFen, gameId, isActive }: Props) {
  const [fen, setFen] = useState(initialFen)
  const [themeId, setThemeId] = useState('classic')

  // Load saved theme
  useEffect(() => {
    const saved = localStorage.getItem('chess-theme')
    if (saved && THEMES.find(t => t.id === saved)) setThemeId(saved)
  }, [])

  const saveTheme = (id: string) => {
    setThemeId(id)
    localStorage.setItem('chess-theme', id)
  }

  // Poll for updates every 3 seconds if game is active
  useEffect(() => {
    if (!isActive) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/game-state?id=${gameId}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.fen && data.fen !== fen) setFen(data.fen)
        if (data.status === 'completed') {
          clearInterval(interval)
          window.location.reload()
        }
      } catch (_) {}
    }, 3000)
    return () => clearInterval(interval)
  }, [gameId, isActive, fen])

  const theme = THEMES.find(t => t.id === themeId) || THEMES[0]

  return (
    <div style={{ maxWidth: 520 }}>
      {/* Theme selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {THEMES.map(t => (
          <button
            key={t.id}
            onClick={() => saveTheme(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
              background: themeId === t.id ? 'rgba(240,192,64,0.15)' : 'var(--card)',
              border: themeId === t.id ? '1px solid #f0c040' : '1px solid var(--border)',
              color: themeId === t.id ? '#f0c040' : 'var(--muted)',
              fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            <span style={{ display: 'flex', gap: 2 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: t.preview[0], display: 'inline-block' }} />
              <span style={{ width: 10, height: 10, borderRadius: 2, background: t.preview[1], display: 'inline-block' }} />
            </span>
            {t.label}
          </button>
        ))}
      </div>

      <Chessboard
        options={{
          position: fen,
          allowDragging: false,
          darkSquareStyle: { backgroundColor: theme.dark },
          lightSquareStyle: { backgroundColor: theme.light },
          boardStyle: {
            borderRadius: '8px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          },
        }}
      />
    </div>
  )
}
