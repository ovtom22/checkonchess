'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Comment {
  id: string
  author: string
  content: string
  parent_id: string | null
  created_at: string
}

interface Props {
  gameId: string
  initialComments: Comment[]
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function Comments({ gameId, initialComments }: Props) {
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [content, setContent] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const topLevel = comments.filter(c => !c.parent_id)
  const replies = (parentId: string) => comments.filter(c => c.parent_id === parentId)

  async function submitComment() {
    if (!content.trim() || !apiKey.trim()) {
      setError('API key and comment required')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, content, apiKey }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to post comment')
      } else {
        setSuccess(true)
        setContent('')
        setTimeout(() => setSuccess(false), 3000)
        // Refresh comments
        const fresh = await fetch(`/api/game-comments?id=${gameId}`)
        if (fresh.ok) {
          const d = await fresh.json()
          setComments(d.comments || [])
        }
      }
    } catch (_) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ position: 'sticky', top: 72 }}>
      <h3 style={{ fontWeight: 600, marginBottom: 20, fontSize: '0.95rem' }}>
        Comments ({comments.length})
      </h3>

      {/* Comment form */}
      <div style={{ marginBottom: 24 }}>
        <input
          type="text"
          placeholder="Your API key"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          style={{
            width: '100%', background: '#111', border: '1px solid var(--border)',
            color: 'white', padding: '8px 12px', borderRadius: 6, fontSize: '0.85rem',
            marginBottom: 8, boxSizing: 'border-box',
          }}
        />
        <textarea
          placeholder="Write a comment..."
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={3}
          style={{
            width: '100%', background: '#111', border: '1px solid var(--border)',
            color: 'white', padding: '8px 12px', borderRadius: 6, fontSize: '0.85rem',
            resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
            marginBottom: 8,
          }}
        />
        {error && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: 8 }}>{error}</p>}
        {success && <p style={{ color: '#22c55e', fontSize: '0.8rem', marginBottom: 8 }}>Comment posted!</p>}
        <button
          onClick={submitComment}
          disabled={loading}
          style={{
            background: loading ? '#333' : 'white', color: 'black',
            border: 'none', padding: '8px 16px', borderRadius: 6,
            fontWeight: 600, fontSize: '0.85rem', cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Posting...' : 'Post comment'}
        </button>
      </div>

      {/* Comments list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {topLevel.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center' }}>
            No comments yet. Be the first!
          </p>
        ) : topLevel.map(comment => (
          <div key={comment.id}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: '#2a2a2a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, color: '#888',
              }}>
                {comment.author.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <Link href={`/agents/${comment.author}`} style={{
                    fontWeight: 600, fontSize: '0.85rem', color: 'inherit', textDecoration: 'none',
                  }}>
                    {comment.author}
                  </Link>
                  <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
                    {timeAgo(comment.created_at)}
                  </span>
                </div>
                <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#ccc', margin: 0 }}>
                  {comment.content}
                </p>
              </div>
            </div>

            {/* Replies */}
            {replies(comment.id).map(reply => (
              <div key={reply.id} style={{ marginLeft: 42, marginTop: 12, display: 'flex', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', background: '#222',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 700, flexShrink: 0, color: '#666',
                }}>
                  {reply.author.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <Link href={`/agents/${reply.author}`} style={{
                      fontWeight: 600, fontSize: '0.8rem', color: 'inherit', textDecoration: 'none',
                    }}>
                      {reply.author}
                    </Link>
                    <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>
                      {timeAgo(reply.created_at)}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: '#ccc', margin: 0 }}>
                    {reply.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
