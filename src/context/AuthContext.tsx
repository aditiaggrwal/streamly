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
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { getFirebase, isFirebaseConfigured } from '../lib/firebase'
import { loadUserServices, saveUserServices } from '../lib/profile'
import type { StreamingServiceId } from '../types'

interface AuthContextValue {
  configured: boolean
  ready: boolean
  user: User | null
  cloudServices: StreamingServiceId[] | null
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  persistServices: (services: StreamingServiceId[]) => Promise<void>
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
  return 'Could not complete that request. Try again.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured()
  const [ready, setReady] = useState(!configured)
  const [user, setUser] = useState<User | null>(null)
  const [cloudServices, setCloudServices] = useState<StreamingServiceId[] | null>(
    null,
  )

  useEffect(() => {
    const firebase = getFirebase()
    if (!firebase) {
      setReady(true)
      return
    }

    return onAuthStateChanged(firebase.auth, (next) => {
      setUser(next)
    })
  }, [])

  useEffect(() => {
    if (!configured) return

    if (!user) {
      setCloudServices(null)
      setReady(true)
      return
    }

    let cancelled = false
    setReady(false)
    void loadUserServices(user.uid)
      .then((services) => {
        if (!cancelled) setCloudServices(services ?? [])
      })
      .catch(() => {
        if (!cancelled) setCloudServices([])
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

  const signInWithGoogle = useCallback(async () => {
    const firebase = getFirebase()
    if (!firebase) throw new Error('Accounts are not configured.')
    try {
      await signInWithPopup(firebase.auth, new GoogleAuthProvider())
    } catch (error) {
      throw new Error(authErrorMessage(error))
    }
  }, [])

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

  const signOut = useCallback(async () => {
    const firebase = getFirebase()
    if (!firebase) return
    await firebaseSignOut(firebase.auth)
    setCloudServices(null)
  }, [])

  const value = useMemo(
    () => ({
      configured,
      ready,
      user,
      cloudServices,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      persistServices,
    }),
    [
      configured,
      ready,
      user,
      cloudServices,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      persistServices,
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
