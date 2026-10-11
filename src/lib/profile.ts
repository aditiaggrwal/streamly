import {
  deleteField,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { STREAMING_SERVICES } from '../data/constants'
import type { StreamingServiceId, TonightSession } from '../types'
import { getFirebase } from './firebase'
import { sanitizeTonightSession } from './storage'

const VALID_SERVICES = new Set(
  STREAMING_SERVICES.map((service) => service.id),
)

export interface UserProfile {
  streamingServices: StreamingServiceId[]
  tonight: TonightSession | null
}

export function sanitizeServices(value: unknown): StreamingServiceId[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (id): id is StreamingServiceId =>
      typeof id === 'string' && VALID_SERVICES.has(id as StreamingServiceId),
  )
}

export async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  const firebase = getFirebase()
  if (!firebase) return null

  const snap = await getDoc(doc(firebase.db, 'users', uid))
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    streamingServices: sanitizeServices(data.streamingServices),
    tonight: sanitizeTonightSession(data.tonight),
  }
}

export async function saveUserServices(
  uid: string,
  email: string | null,
  streamingServices: StreamingServiceId[],
): Promise<void> {
  const firebase = getFirebase()
  if (!firebase) return

  await setDoc(
    doc(firebase.db, 'users', uid),
    {
      email: email ?? '',
      streamingServices,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function saveUserTonight(
  uid: string,
  email: string | null,
  tonight: TonightSession | null,
): Promise<void> {
  const firebase = getFirebase()
  if (!firebase) return

  await setDoc(
    doc(firebase.db, 'users', uid),
    {
      email: email ?? '',
      tonight: tonight ?? deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
