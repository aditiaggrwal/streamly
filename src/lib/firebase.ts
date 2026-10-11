import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

export interface FirebaseClients {
  app: FirebaseApp
  auth: Auth
  db: Firestore
}

function readEnv(name: string): string | undefined {
  const raw = import.meta.env[name]
  if (typeof raw !== 'string') return undefined
  const value = raw.trim().replace(/^['"]|['"]$/g, '')
  return value || undefined
}

function readConfig() {
  const apiKey = readEnv('VITE_FIREBASE_API_KEY')
  const authDomain = readEnv('VITE_FIREBASE_AUTH_DOMAIN')
  const projectId = readEnv('VITE_FIREBASE_PROJECT_ID')
  const storageBucket = readEnv('VITE_FIREBASE_STORAGE_BUCKET')
  const messagingSenderId = readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID')
  const appId = readEnv('VITE_FIREBASE_APP_ID')

  if (!apiKey || !authDomain || !projectId || !appId) return null

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  }
}

function createAuth(app: FirebaseApp): Auth {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  } catch {
    return getAuth(app)
  }
}

let clients: FirebaseClients | null | undefined

export function isFirebaseConfigured(): boolean {
  return readConfig() !== null
}

export function getFirebase(): FirebaseClients | null {
  if (clients !== undefined) return clients

  const config = readConfig()
  if (!config) {
    clients = null
    return null
  }

  const app = initializeApp(config)
  clients = {
    app,
    auth: createAuth(app),
    db: getFirestore(app),
  }
  return clients
}
