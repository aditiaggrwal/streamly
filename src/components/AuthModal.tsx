import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'

interface AuthModalProps {
  onClose: () => void
}

export function AuthModal({ onClose }: AuthModalProps) {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, authError } =
    useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.85"
              strokeLinecap="round"
              d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"
            />
          </svg>
        </button>
        <h2 id="auth-title" className="step-title">
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </h2>
        <p className="step-hint">
          Save your services once. Skip that step next time.
        </p>

        <button
          type="button"
          className="auth-google-btn"
          disabled={busy}
          onClick={() => {
            setError('')
            setBusy(true)
            void signInWithGoogle()
              .then(() => onClose())
              .catch((err) => {
                setError(
                  err instanceof Error ? err.message : 'Something went wrong.',
                )
              })
              .finally(() => setBusy(false))
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.2 2.8-2.5 3.7v3h4c2.4-2.2 3.5-5.5 3.5-8.8Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-4-3c-1.1.8-2.5 1.2-3.9 1.2-3 0-5.6-2-6.5-4.8H1.4v3.1C3.4 21.3 7.4 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.5 14.5c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7.2H1.4C.5 8.9 0 10.4 0 12.4c0 2 .5 3.5 1.4 5.2l4.1-3.1Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 7.2l4.1 3.1C6.4 6.8 9 4.8 12 4.8Z"
            />
          </svg>
          Continue with Google
        </button>

        <p className="auth-divider">or</p>

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
            <span className="auth-password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M3.3 2.3a1 1 0 0 0-1.4 1.4l3 3C3 8.3 1.8 10 1.1 11.2a1.4 1.4 0 0 0 0 1.6C3 16.2 7.1 20 12 20c2 0 3.8-.6 5.4-1.6l3.3 3.3a1 1 0 0 0 1.4-1.4l-19-19ZM12 18c-3.8 0-7.1-2.9-8.9-6 .8-1.3 2-2.8 3.6-4l2 2A4.5 4.5 0 0 0 12 16.5c.5 0 1-.1 1.4-.2l1.6 1.6A9 9 0 0 1 12 18Zm8.9-5.2A15 15 0 0 0 16.7 8.7l1.4-1.4c1.3 1 2.4 2.2 3.2 3.5a1.4 1.4 0 0 1 0 1.6c-.4.7-1 1.6-1.8 2.4l-1.4-1.4c.6-.6 1.1-1.3 1.5-2ZM12 7.5c.4 0 .7 0 1.1.1l-1.7 1.7A2.5 2.5 0 0 0 9.5 12c0 .3 0 .5.1.8L7.9 14.5A4.5 4.5 0 0 1 12 7.5Z"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M12 5c-4.9 0-9 3.8-10.9 7.2a1.4 1.4 0 0 0 0 1.6C3 17.2 7.1 21 12 21s9-3.8 10.9-7.2a1.4 1.4 0 0 0 0-1.6C21 8.8 16.9 5 12 5Zm0 13c-3.8 0-7.1-2.9-8.9-6C4.9 8.9 8.2 6 12 6s7.1 2.9 8.9 6c-1.8 3.1-5.1 6-8.9 6Zm0-9.5A3.5 3.5 0 1 0 15.5 12 3.5 3.5 0 0 0 12 8.5Zm0 5A1.5 1.5 0 1 1 13.5 12 1.5 1.5 0 0 1 12 13.5Z"
                    />
                  </svg>
                )}
              </button>
            </span>
          </label>
          {error || authError ? (
            <p className="auth-error">{error || authError}</p>
          ) : null}
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
            ? 'Create an account'
            : 'Sign in instead'}
        </button>
      </div>
    </div>
  )
}
