import { STORAGE_KEY } from '../data/constants'
import type { StreamingServiceId } from '../types'

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

export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`
}
