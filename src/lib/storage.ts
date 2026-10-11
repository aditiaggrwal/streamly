import {
  GENRES,
  MOODS,
  STORAGE_KEY,
  TIME_BUDGET_OPTIONS,
  TONIGHT_STORAGE_KEY,
} from '../data/constants'
import type {
  GenreId,
  MoodId,
  TonightSession,
  WizardStep,
} from '../types'
import type { StreamingServiceId } from '../types'

const VALID_MOODS = new Set(MOODS.map((mood) => mood.id))
const VALID_GENRES = new Set(GENRES.map((genre) => genre.id))
const VALID_STEPS = new Set<WizardStep>([
  'mood',
  'genre',
  'time',
  'services',
  'result',
])
const VALID_RUNTIMES = new Set<number | null>(
  TIME_BUDGET_OPTIONS.map((option) => option.maxRuntimeMinutes),
)

export function emptyTonightSession(): TonightSession {
  return {
    moods: [],
    genres: [],
    familyFriendly: false,
    maxRuntimeMinutes: null,
    step: 'mood',
    farthestIndex: 0,
  }
}

function sanitizeMoods(value: unknown): MoodId[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (id): id is MoodId => typeof id === 'string' && VALID_MOODS.has(id as MoodId),
  )
}

function sanitizeGenres(value: unknown): GenreId[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (id): id is GenreId =>
      typeof id === 'string' && VALID_GENRES.has(id as GenreId),
  )
}

function sanitizeRuntime(value: unknown): number | null {
  if (value === null) return null
  if (typeof value === 'number' && VALID_RUNTIMES.has(value)) return value
  return null
}

function sanitizeStep(value: unknown): WizardStep {
  if (typeof value === 'string' && VALID_STEPS.has(value as WizardStep)) {
    return value as WizardStep
  }
  return 'mood'
}

export function sanitizeTonightSession(value: unknown): TonightSession | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<TonightSession>
  const moods = sanitizeMoods(raw.moods)
  const step = sanitizeStep(raw.step)
  return {
    moods,
    genres: sanitizeGenres(raw.genres),
    familyFriendly: Boolean(raw.familyFriendly),
    maxRuntimeMinutes: sanitizeRuntime(raw.maxRuntimeMinutes),
    step: moods.length === 0 ? 'mood' : step,
    farthestIndex:
      typeof raw.farthestIndex === 'number' && raw.farthestIndex >= 0
        ? Math.floor(raw.farthestIndex)
        : 0,
  }
}

export function loadStreamingServices(): StreamingServiceId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStreamingServices(services: StreamingServiceId[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(services))
}

export function clearStreamingServices(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function loadTonightSession(): TonightSession {
  try {
    const raw = localStorage.getItem(TONIGHT_STORAGE_KEY)
    if (!raw) return emptyTonightSession()
    return sanitizeTonightSession(JSON.parse(raw)) ?? emptyTonightSession()
  } catch {
    return emptyTonightSession()
  }
}

export function saveTonightSession(session: TonightSession): void {
  localStorage.setItem(TONIGHT_STORAGE_KEY, JSON.stringify(session))
}

export function clearTonightSession(): void {
  localStorage.removeItem(TONIGHT_STORAGE_KEY)
}

export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`
}
