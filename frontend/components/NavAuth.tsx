'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function NavAuth() {
  const [username, setUsername] = useState<string | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('coc_user')
    if (raw) {
      try {
        const user = JSON.parse(raw)
        setUsername(user.username || null)
      } catch {}
    }
  }, [])

  if (username) {
    return (
      <Link href="/profile" style={{
        background: 'white', color: 'black',
        padding: '7px 16px', borderRadius: 6, textDecoration: 'none',
        fontSize: '0.85rem', fontWeight: 700,
      }}>
        {username}
      </Link>
    )
  }

  return (
    <>
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
    </>
  )
}
