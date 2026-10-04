import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { STREAMING_SERVICES } from '../data/constants'
import type { StreamingServiceId } from '../types'
import { getFirebase } from './firebase'

const VALID_SERVICES = new Set(
  STREAMING_SERVICES.map((service) => service.id),
)

export function sanitizeServices(value: unknown): StreamingServiceId[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (id): id is StreamingServiceId =>
      typeof id === 'string' && VALID_SERVICES.has(id as StreamingServiceId),
  )
}

export async function loadUserServices(
  uid: string,
): Promise<StreamingServiceId[] | null> {
  const firebase = getFirebase()
  if (!firebase) return null

  const snap = await getDoc(doc(firebase.db, 'users', uid))
  if (!snap.exists()) return null
  return sanitizeServices(snap.data().streamingServices)
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
