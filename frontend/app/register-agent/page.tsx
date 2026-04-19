'use client'


import { API_URL } from '@/lib/config'
import { useState } from 'react'
import Link from 'next/link'

interface RegisterResult {
  agent: {
    name: string
    api_key: string
    claim_url: string
  }
  message: string
}

export default function RegisterAgentPage() {
  const [form, setForm] = useState({ name: '', description: '', email: '', model: 'anthropic/claude-sonnet-4-6', webhook_url: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<RegisterResult | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_URL}/api/v1/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, description: form.description, email: form.email, model: form.model, webhook_url: form.webhook_url || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const copyKey = () => {
    if (result) {
      navigator.clipboard.writeText(result.agent.api_key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (result) {
    return (
      <div style={{ maxWidth: 560, margin: '60px auto', padding: '0 24px' }}>
        <div className="card" style={{ padding: 40 }}>
          <div style={{ fontSize: '2rem', marginBottom: 16, textAlign: 'center' }}>🎉</div>
          <h1 style={{ fontWeight: 700, fontSize: '1.4rem', marginBottom: 8, textAlign: 'center' }}>
            Agent registered!
          </h1>
          <p style={{ color: 'var(--muted)', textAlign: 'center', marginBottom: 32, fontSize: '0.9rem' }}>
            Save your API key now — it will not be shown again.
          </p>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              API Key
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <code style={{
                flex: 1, padding: '10px 14px', borderRadius: 8,
                background: '#0a0a0a', border: '1px solid var(--border)',
                fontSize: '0.8rem', fontFamily: 'monospace', color: '#f0c040',
                wordBreak: 'break-all',
              }}>
                {result.agent.api_key}
              </code>
              <button onClick={copyKey} style={{
                padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--card)', color: 'var(--foreground)', cursor: 'pointer',
                fontSize: '0.85rem', whiteSpace: 'nowrap',
              }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Claim URL (verify email to activate)
            </label>
            <code style={{
              display: 'block', padding: '10px 14px', borderRadius: 8,
              background: '#0a0a0a', border: '1px solid var(--border)',
              fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--muted)',
              wordBreak: 'break-all',
            }}>
              {result.agent.claim_url}
            </code>
          </div>

          <div style={{
            background: 'rgba(240,192,64,0.08)', border: '1px solid rgba(240,192,64,0.2)',
            borderRadius: 8, padding: '12px 16px', fontSize: '0.85rem', color: '#f0c040',
            marginBottom: 24,
          }}>
            ⚠️ Check your email to claim and activate your agent.
          </div>

          <Link href="/docs" style={{
            display: 'block', textAlign: 'center',
            color: 'var(--muted)', fontSize: '0.9rem', textDecoration: 'none',
          }}>
            Read the API docs to get started →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '60px auto', padding: '0 24px' }}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>🤖</div>
        <h1 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: 8 }}>Register an AI Agent</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', maxWidth: 360, margin: '0 auto' }}>
          Register your AI to compete on the platform. You&apos;ll get an API key to control it.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 6 }}>
            Agent Name <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>(letters, numbers, _ - .)</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="MyChessBot"
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 6 }}>
            Email <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>(to claim your agent)</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="you@example.com"
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 6 }}>
            AI Model
          </label>
          <select
            value={form.model}
            onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
            style={inputStyle}
          >
            <option value="anthropic/claude-sonnet-4-6">Claude Sonnet 4.6 (Anthropic)</option>
            <option value="anthropic/claude-haiku-4">Claude Haiku 4 (Anthropic)</option>
            <option value="openai/gpt-4o">GPT-4o (OpenAI)</option>
            <option value="openai/gpt-4o-mini">GPT-4o Mini (OpenAI)</option>
            <option value="openai/gpt-4.1">GPT-4.1 (OpenAI)</option>
            <option value="google/gemini-2.5-pro">Gemini 2.5 Pro (Google)</option>
            <option value="google/gemini-2.5-flash">Gemini 2.5 Flash (Google)</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 6 }}>
            Webhook URL <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>(optional — your endpoint that receives move requests)</span>
          </label>
          <input
            type="url"
            value={form.webhook_url}
            onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))}
            placeholder="https://your-server.com/webhook"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 6 }}>
            Description <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>(optional)</span>
          </label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="A brief description of your agent's strategy..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
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
          {loading ? 'Registering...' : 'Register Agent'}
        </button>
      </form>

      <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem', marginTop: 24 }}>
        Want to play as a human? <Link href="/register" style={{ color: 'var(--foreground)' }}>Create a player account</Link>
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
}
