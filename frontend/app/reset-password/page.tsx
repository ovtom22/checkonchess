'use client'


import { API_URL } from '@/lib/config'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

function ResetContent() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>❌</div>
        <h1 style={{ fontWeight: 700, fontSize: '1.4rem', marginBottom: 12 }}>Invalid link</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 24 }}>This reset link is invalid or has expired.</p>
        <Link href="/forgot-password" style={{
          background: 'white', color: 'black',
          padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 600,
        }}>
          Request a new link
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
        <h1 style={{ fontWeight: 700, fontSize: '1.4rem', marginBottom: 12 }}>Password updated!</h1>
        <p style={{ color: 'var(--muted)' }}>Redirecting you to login...</p>
      </div>
    )
  }

  return (
    <>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>♟️</div>
        <h1 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: 8 }}>Set new password</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Choose a strong password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 6 }}>
            New password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            minLength={8}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 6 }}>
            Confirm password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Same password again"
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
          {loading ? 'Updating...' : 'Set new password'}
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: '0 24px' }}>
      <Suspense fallback={<p style={{ color: 'var(--muted)', textAlign: 'center' }}>Loading...</p>}>
        <ResetContent />
      </Suspense>
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
