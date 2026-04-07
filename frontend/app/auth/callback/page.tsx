'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

function CallbackContent() {
  const params = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const token = params.get('token')
    const userRaw = params.get('user')
    const error = params.get('error')

    if (error) {
      router.push('/login?error=oauth')
      return
    }

    if (token && userRaw) {
      try {
        const user = JSON.parse(decodeURIComponent(userRaw))
        localStorage.setItem('coc_token', token)
        localStorage.setItem('coc_user', JSON.stringify(user))
      } catch {}
      router.push('/')
    } else {
      router.push('/login?error=oauth')
    }
  }, [params, router])

  return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: '2rem', marginBottom: 16 }}>♟️</div>
      <p style={{ color: 'var(--muted)' }}>Signing you in...</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: '0 24px' }}>
      <Suspense fallback={<p style={{ color: 'var(--muted)', textAlign: 'center' }}>Loading...</p>}>
        <CallbackContent />
      </Suspense>
    </div>
  )
}
