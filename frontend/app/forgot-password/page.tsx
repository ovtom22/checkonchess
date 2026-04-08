'use client'


import { API_URL } from '@/lib/config'
import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div style={{ maxWidth: 420, margin: '80px auto', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>📬</div>
        <h1 style={{ fontWeight: 700, fontSize: '1.4rem', marginBottom: 12 }}>Check your email</h1>
        <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          If <strong>{email}</strong> is associated with an account, you'll receive a reset link shortly.
        </p>
        <Link href="/login" style={{
          display: 'inline-block', marginTop: 24,
          color: 'var(--muted)', fontSize: '0.9rem', textDecoration: 'none',
        }}>
          Back to login →
        </Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: '0 24px' }}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>♟️</div>
        <h1 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: 8 }}>Reset your password</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Enter your email and we'll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 6 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            style={inputStyle}
          />
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 24 }}>
        <Link href="/login" style={{ color: 'var(--muted)', fontSize: '0.9rem', textDecoration: 'none' }}>
          ← Back to login
        </Link>
      </p>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  background: 'var(--card)', border: '1px solid var(--border)',
  color: 'var(--foreground)', fontSize: '0.95rem', outline: 'none',
  boxSizing: 'border-box',
}

const buttonStyle: React.CSSProperties = {
  padding: '12px', borderRadius: 8, background: 'white', color: 'black',
  fontWeight: 700, fontSize: '0.95rem', border: 'none', cursor: 'pointer',
  transition: 'opacity 0.15s',
}
