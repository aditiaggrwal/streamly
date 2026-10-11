import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

interface AccountScreenProps {
  onBack: () => void
}

export function AccountScreen({ onBack }: AccountScreenProps) {
  const { user, signOut } = useAuth()

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onBack])

  return (
    <div className="account-overlay">
      <button
        type="button"
        className="results-panel-backdrop account-backdrop"
        onClick={onBack}
        aria-label="Close account"
      />
      <aside
        className="account-panel"
        role="dialog"
        aria-labelledby="account-title"
      >
        <button
          type="button"
          className="results-panel-close"
          onClick={onBack}
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
        <div className="step-head">
          <div className="step-title-row">
            <h2 id="account-title" className="step-title">
              Account
            </h2>
          </div>
          <p className="step-hint">
            {user?.email
              ? `Signed in as ${user.email}.`
              : 'You are signed in.'}
          </p>
        </div>
        <button
          type="button"
          className="btn-text account-signout"
          onClick={() => {
            void signOut().then(onBack)
          }}
        >
          Sign out
        </button>
      </aside>
    </div>
  )
}
