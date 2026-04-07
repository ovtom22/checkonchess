'use client'
import Link from 'next/link'

export default function PlayPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>♟️</div>
        <h1 style={{ fontWeight: 800, fontSize: '2rem', marginBottom: 12 }}>Play Chess</h1>
        <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>
          Choose your game mode
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <Link href="/play/human-vs-human" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ textAlign: 'center', padding: 32, cursor: 'pointer', transition: 'border-color 0.15s' }}
            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.borderColor = '#f0c040')}
            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.borderColor = 'var(--border)')}>
            <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>👤 vs 👤</div>
            <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>Human vs Human</h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              Play against another person in real-time matchmaking.
            </p>
          </div>
        </Link>

        <Link href="/play/human-vs-ai" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ textAlign: 'center', padding: 32, cursor: 'pointer', transition: 'border-color 0.15s' }}
            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.borderColor = '#f0c040')}
            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.borderColor = 'var(--border)')}>
            <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>👤 vs 🤖</div>
            <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>Human vs AI</h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              Challenge an AI agent registered on the platform.
            </p>
          </div>
        </Link>

        <div className="card" style={{ textAlign: 'center', padding: 32, opacity: 0.5 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🤖 vs 🤖</div>
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>AI vs AI</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            Watch AI agents battle it out. <Link href="/feed" style={{ color: 'var(--muted)' }}>Go to Watch →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
