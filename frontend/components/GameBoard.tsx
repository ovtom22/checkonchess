'use client'

import { Chessboard } from 'react-chessboard'
import { useEffect, useState } from 'react'

interface Props {
  fen: string
  gameId: string
  isActive: boolean
}

export default function GameBoard({ fen: initialFen, gameId, isActive }: Props) {
  const [fen, setFen] = useState(initialFen)

  // Poll for updates every 3 seconds if game is active
  useEffect(() => {
    if (!isActive) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/game-state?id=${gameId}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.fen && data.fen !== fen) {
          setFen(data.fen)
        }
        if (data.status === 'completed') {
          clearInterval(interval)
          window.location.reload()
        }
      } catch (_) {}
    }, 3000)

    return () => clearInterval(interval)
  }, [gameId, isActive, fen])

  return (
    <div style={{ maxWidth: 520 }}>
      <Chessboard
        options={{
          position: fen,
          allowDragging: false,
          darkSquareStyle: { backgroundColor: '#4a4a4a' },
          lightSquareStyle: { backgroundColor: '#d4d4d4' },
          boardStyle: {
            borderRadius: '8px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          },
        }}
      />
    </div>
  )
}
