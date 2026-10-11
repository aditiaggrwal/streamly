import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { getFirebase, isFirebaseConfigured } from '../lib/firebase'
import { loadUserProfile, saveUserServices, saveUserTonight } from '../lib/profile'
import type { StreamingServiceId, TonightSession } from '../types'

interface AuthContextValue {
  configured: boolean
  ready: boolean
  user: User | null
  cloudServices: StreamingServiceId[] | null
  cloudTonight: TonightSession | null
  authError: string
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  persistServices: (services: StreamingServiceId[]) => Promise<void>
  persistTonight: (session: TonightSession | null) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function authErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code: string }).code)
      : ''

  if (code.includes('popup-closed')) return 'Sign-in was cancelled.'
  if (code.includes('email-already-in-use')) {
    return 'That email already has an account. Sign in instead.'
  }
  if (code.includes('invalid-credential') || code.includes('wrong-password')) {
    return 'Email or password is incorrect.'
  }
  if (code.includes('user-not-found')) return 'No account with that email.'
  if (code.includes('weak-password')) {
    return 'Use a password with at least 6 characters.'
  }
  if (code.includes('invalid-email')) return 'Enter a valid email address.'
  if (code.includes('too-many-requests')) {
    return 'Too many attempts. Try again in a few minutes.'
  }
  if (code.includes('unauthorized-domain')) {
    const host =
      typeof window !== 'undefined' ? window.location.hostname : 'this site'
    return `Add ${host} under Firebase Authentication → Settings → Authorized domains.`
  }
  if (code.includes('operation-not-allowed')) {
    return 'Google sign-in is not enabled yet.'
  }
  if (code.includes('popup-blocked')) {
    return 'Allow popups to continue with Google.'
  }
  if (code.includes('account-exists-with-different-credential')) {
    return 'This email is already used with another sign-in method.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'Could not complete that request. Try again.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured()
  const [ready, setReady] = useState(!configured)
  const [user, setUser] = useState<User | null>(null)
  const [cloudServices, setCloudServices] = useState<StreamingServiceId[] | null>(
    null,
  )
  const [cloudTonight, setCloudTonight] = useState<TonightSession | null>(null)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    const firebase = getFirebase()
    if (!firebase) {
      setReady(true)
      return
    }

    void getRedirectResult(firebase.auth).catch((error) => {
      setAuthError(authErrorMessage(error))
    })

    return onAuthStateChanged(firebase.auth, (next) => {
      setUser(next)
      if (next) setAuthError('')
    })
  }, [])

  useEffect(() => {
    if (!configured) return

    if (!user) {
      setCloudServices(null)
      setCloudTonight(null)
      setReady(true)
      return
    }

    let cancelled = false
    setReady(false)
    void loadUserProfile(user.uid)
      .then((profile) => {
        if (cancelled) return
        setCloudServices(profile?.streamingServices ?? [])
        setCloudTonight(profile?.tonight ?? null)
      })
      .catch(() => {
        if (cancelled) return
        setCloudServices([])
        setCloudTonight(null)
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [configured, user])

  const persistServices = useCallback(
    async (services: StreamingServiceId[]) => {
      if (!user) return
      setCloudServices(services)
      try {
        await saveUserServices(user.uid, user.email, services)
      } catch {
        // Keep local/cloud cache; next change or visit can retry.
      }
    },
    [user],
  )

  const persistTonight = useCallback(
    async (session: TonightSession | null) => {
      if (!user) return
      setCloudTonight(session)
      try {
        await saveUserTonight(user.uid, user.email, session)
      } catch {
        // Keep local/cloud cache; next change or visit can retry.
      }
    },
    [user],
  )

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const firebase = getFirebase()
    if (!firebase) throw new Error('Accounts are not configured.')
    try {
      await signInWithEmailAndPassword(firebase.auth, email.trim(), password)
    } catch (error) {
      throw new Error(authErrorMessage(error))
    }
  }, [])

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const firebase = getFirebase()
    if (!firebase) throw new Error('Accounts are not configured.')
    try {
      await createUserWithEmailAndPassword(firebase.auth, email.trim(), password)
    } catch (error) {
      throw new Error(authErrorMessage(error))
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const firebase = getFirebase()
    if (!firebase) throw new Error('Accounts are not configured.')
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try {
      await signInWithPopup(firebase.auth, provider, browserPopupRedirectResolver)
    } catch (error) {
      const code =
        typeof error === 'object' && error && 'code' in error
          ? String((error as { code: string }).code)
          : ''
      if (code.includes('popup-blocked')) {
        await signInWithRedirect(firebase.auth, provider)
        return
      }
      throw new Error(authErrorMessage(error))
    }
  }, [])

  const signOut = useCallback(async () => {
    const firebase = getFirebase()
    if (!firebase) return
    await firebaseSignOut(firebase.auth)
    setCloudServices(null)
    setCloudTonight(null)
  }, [])

  const value = useMemo(
    () => ({
      configured,
      ready,
      user,
      cloudServices,
      cloudTonight,
      authError,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      persistServices,
      persistTonight,
    }),
    [
      configured,
      ready,
      user,
      cloudServices,
      cloudTonight,
      authError,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signOut,
      persistServices,
      persistTonight,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return value
}
