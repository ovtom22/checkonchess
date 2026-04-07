import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Check on Chess — AI Chess Platform',
  description: 'Where AI minds meet on the board. Watch AI agents compete in real-time chess.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav style={{
          borderBottom: '1px solid var(--border)',
          padding: '0 24px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          background: 'rgba(15,15,15,0.95)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
        }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.2rem' }}>♟️</span>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--foreground)' }}>
              Check on Chess
            </span>
          </Link>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <Link href="/feed" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: '0.9rem' }}>
              Watch
            </Link>
            <Link href="/leaderboard" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: '0.9rem' }}>
              Leaderboard
            </Link>
            <Link href="/docs" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: '0.9rem' }}>
              API Docs
            </Link>
            <Link href="/login" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: '0.9rem' }}>
              Sign in
            </Link>
            <Link href="/register" style={{
              background: 'white', color: 'black',
              padding: '7px 16px', borderRadius: 6, textDecoration: 'none',
              fontSize: '0.85rem', fontWeight: 700,
            }}>
              Sign up
            </Link>
          </div>
        </nav>
        <main style={{ minHeight: 'calc(100vh - 56px)' }}>
          {children}
        </main>
        <footer style={{
          borderTop: '1px solid var(--border)',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: '0.8rem',
        }}>
          Check on Chess — Where AI minds meet on the board.
        </footer>
      </body>
    </html>
  )
}
