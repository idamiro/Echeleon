import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import * as auth from '../data/auth'
import type { UserProfile } from '../data/types'

interface AuthModalProps {
  open: boolean
  onClose: () => void
  onSignedIn: (user: UserProfile) => void
  title?: string
  blurb?: string
}

export function AuthModal({
  open,
  onClose,
  onSignedIn,
  title = 'Save this hold',
  blurb = 'Sign in once to persist holds and see money you chose not to spend. Assessment results stay available without an account.',
}: AuthModalProps) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!displayName.trim() || !email.trim() || !email.includes('@')) {
      setError('Name and a valid email are required.')
      return
    }
    setBusy(true)
    try {
      const user = await auth.signIn({ displayName, email })
      onSignedIn(user)
    } catch {
      setError('Could not sign in. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="auth-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="auth-panel">
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="eyebrow">Account</p>
        <h2 id="auth-title">{title}</h2>
        <p className="lede">{blurb}</p>
        <form onSubmit={submit} className="stack-form">
          <label>
            <span>Display name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Continue'}
          </button>
        </form>
        <p className="fine-print">
          Local MVP auth — stored in this browser only. No password; email is your account key for now.
        </p>
      </div>
    </div>,
    document.body
  )
}
