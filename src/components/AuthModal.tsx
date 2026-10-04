import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'

interface AuthModalProps {
  onClose: () => void
}

export function AuthModal({ onClose }: AuthModalProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleEmail(event: FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password)
      } else {
        await signInWithEmail(email, password)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setBusy(true)
    try {
      await signInWithGoogle()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-modal-root">
      <button
        type="button"
        className="results-panel-backdrop"
        onClick={onClose}
        aria-label="Close sign in"
      />
      <div className="auth-modal" role="dialog" aria-labelledby="auth-title">
        <button
          type="button"
          className="results-panel-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2 id="auth-title" className="step-title">
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </h2>
        <p className="step-hint">
          Save your streaming services once. Next time, skip that step.
        </p>

        <button
          type="button"
          className="btn btn-back auth-google"
          onClick={() => void handleGoogle()}
          disabled={busy}
        >
          Continue with Google
        </button>

        <p className="auth-divider">or email</p>

        <form className="auth-form" onSubmit={(event) => void handleEmail(event)}>
          <label className="auth-field">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="auth-field">
            Password
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>
          {error ? <p className="auth-error">{error}</p> : null}
          <button type="submit" className="btn btn-next" disabled={busy}>
            {busy
              ? 'Working…'
              : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          className="btn-text"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError('')
          }}
        >
          {mode === 'signin'
            ? 'Need an account? Create one'
            : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
