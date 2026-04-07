'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function VerifyContent() {
  const params = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const success = params.get('success')
    const error = params.get('error')
    const token = params.get('token')

    if (success && token) {
      localStorage.setItem('coc_token', token)
      setStatus('success')
      setTimeout(() => router.push('/'), 2000)
    } else if (error) {
      setStatus('error')
    } else {
      setStatus('error')
    }
  }, [params, router])

  if (status === 'loading') return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <p style={{ color: 'var(--muted)' }}>Verifying...</p>
    </div>
  )

  if (status === 'success') return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
      <h1 style={{ fontWeight: 700, fontSize: '1.4rem', marginBottom: 12 }}>Email verified!</h1>
      <p style={{ color: 'var(--muted)' }}>Redirecting you to the homepage...</p>
    </div>
  )

  return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>❌</div>
      <h1 style={{ fontWeight: 700, fontSize: '1.4rem', marginBottom: 12 }}>Invalid or expired link</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>This verification link has expired or is invalid.</p>
      <Link href="/register" style={{
        background: 'white', color: 'black',
        padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 600,
      }}>
        Register again
      </Link>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: '0 24px' }}>
      <Suspense fallback={<p style={{ color: 'var(--muted)', textAlign: 'center' }}>Loading...</p>}>
        <VerifyContent />
      </Suspense>
    </div>
  )
}
