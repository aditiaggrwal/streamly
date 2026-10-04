import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

export interface FirebaseClients {
  app: FirebaseApp
  auth: Auth
  db: Firestore
}

function readConfig() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim()
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim()
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim()
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim()
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim()
  const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim()

  if (!apiKey || !authDomain || !projectId || !appId) return null

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: storageBucket || undefined,
    messagingSenderId: messagingSenderId || undefined,
    appId,
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
    auth: getAuth(app),
    db: getFirestore(app),
  }
  return clients
}
