import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import { getFirebase } from './firebase'

interface GoogleIdApi {
  initialize: (config: {
    client_id: string
    callback: (response: { credential?: string }) => void
    auto_select?: boolean
    use_fedcm_for_prompt?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: string
      size?: string
      text?: string
      width?: number
      locale?: string
    },
  ) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleIdApi
      }
    }
  }
}

function readEnv(name: string): string | undefined {
  const raw = import.meta.env[name]
  if (typeof raw !== 'string') return undefined
  const value = raw.trim().replace(/^['"]|['"]$/g, '')
  return value || undefined
}

function loadGsiScript(): Promise<void> {
  if (window.google?.accounts.id) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    )
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener(
        'error',
        () => reject(new Error('Could not load Google sign-in.')),
        { once: true },
      )
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Google sign-in.'))
    document.head.appendChild(script)
  })
}

export function getGoogleClientId(): string | undefined {
  return readEnv('VITE_GOOGLE_CLIENT_ID')
}

export async function mountGoogleButton(
  parent: HTMLElement,
  onSuccess: () => void,
  onError: (message: string) => void,
): Promise<void> {
  const firebase = getFirebase()
  const clientId = getGoogleClientId()
  if (!firebase || !clientId) {
    onError('Google sign-in is not configured.')
    return
  }

  await loadGsiScript()
  if (!window.google?.accounts.id) {
    onError('Could not load Google sign-in.')
    return
  }

  window.google.accounts.id.initialize({
    client_id: clientId,
    auto_select: false,
    use_fedcm_for_prompt: true,
    callback: (response) => {
      if (!response.credential) {
        onError('Google sign-in was cancelled.')
        return
      }
      const credential = GoogleAuthProvider.credential(response.credential)
      void signInWithCredential(firebase.auth, credential)
        .then(() => onSuccess())
        .catch((error: unknown) => {
          onError(
            error instanceof Error
              ? error.message
              : 'Could not complete Google sign-in.',
          )
        })
    },
  })

  parent.replaceChildren()
  window.google.accounts.id.renderButton(parent, {
    theme: 'filled_black',
    size: 'large',
    text: 'continue_with',
    width: 320,
  })
}
