import { STREAMING_SERVICES } from '../data/constants'
import type { Movie, StreamingServiceId } from '../types'
import {
  cleanProviderUrl,
  getServiceWatchUrl,
  isAllowedServiceUrl,
  isJustWatchUrl,
} from './watchLinks'

const watchUrlCache = new Map<string, Partial<Record<StreamingServiceId, string>>>()
const watchUrlInflight = new Map<
  string,
  Promise<Partial<Record<StreamingServiceId, string>> | undefined>
>()

const KNOWN_SERVICES = new Set<StreamingServiceId>(
  STREAMING_SERVICES.map((service) => service.id),
)

function isStreamingServiceId(value: string): value is StreamingServiceId {
  return KNOWN_SERVICES.has(value as StreamingServiceId)
}

function watchLinksEndpoint(movie: Movie): string | null {
  const title = movie.title.trim()
  if (!title || title.length > 200) return null
  const params = new URLSearchParams()
  if (/^\d{1,10}$/.test(movie.id) && movie.id !== '0') params.set('tmdbId', movie.id)
  params.set('title', title)
  const year = Number.isInteger(movie.year) && movie.year > 0 ? movie.year : 0
  params.set('year', String(year))
  params.set('country', 'US')
  if (movie.streamingServices.length > 0) {
    params.set('services', [...new Set(movie.streamingServices)].join(','))
  }
  return `/api/watch-links?${params.toString()}`
}

function sanitizeLinks(
  movie: Movie,
  raw: unknown,
): Partial<Record<StreamingServiceId, string>> {
  if (!raw || typeof raw !== 'object') return {}
  const allowed = new Set(movie.streamingServices)
  const links: Partial<Record<StreamingServiceId, string>> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!isStreamingServiceId(key)) continue
    if (allowed.size > 0 && !allowed.has(key)) continue
    if (typeof value !== 'string') continue
    const cleaned = cleanProviderUrl(value)
    if (!cleaned || isJustWatchUrl(cleaned) || !isAllowedServiceUrl(cleaned, key)) continue
    links[key] = cleaned
  }
  return links
}

function cacheKey(movie: Movie): string {
  const services = [...movie.streamingServices].sort().join(',')
  return `${movie.id}:${movie.title}:${movie.year}:${services}`
}

async function loadProviderWatchUrls(
  movie: Movie,
  key: string,
): Promise<Partial<Record<StreamingServiceId, string>> | undefined> {
  const endpoint = watchLinksEndpoint(movie)
  if (!endpoint) return undefined
  try {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return undefined
    const body = (await response.json()) as { links?: unknown }
    const links = sanitizeLinks(movie, body.links)
    if (Object.keys(links).length > 0) watchUrlCache.set(key, links)
    return Object.keys(links).length > 0 ? links : undefined
  } catch {
    return undefined
  }
}

export async function fetchProviderWatchUrls(
  movie: Movie,
  signal?: AbortSignal,
): Promise<Partial<Record<StreamingServiceId, string>> | undefined> {
  if (signal?.aborted) return undefined
  const key = cacheKey(movie)
  if (watchUrlCache.has(key)) {
    const cached = watchUrlCache.get(key) ?? {}
    return Object.keys(cached).length > 0 ? cached : undefined
  }

  let pending = watchUrlInflight.get(key)
  if (!pending) {
    pending = loadProviderWatchUrls(movie, key).finally(() => {
      watchUrlInflight.delete(key)
    })
    watchUrlInflight.set(key, pending)
  }

  const links = await pending
  if (signal?.aborted) return undefined
  return links
}

export async function movieWithWatchUrls(
  movie: Movie,
  signal?: AbortSignal,
): Promise<Movie> {
  const watchUrls = await fetchProviderWatchUrls(movie, signal)
  if (!watchUrls) return movie
  return { ...movie, watchUrls: { ...movie.watchUrls, ...watchUrls } }
}

export async function resolveServiceWatchUrl(
  movie: Movie,
  serviceId: StreamingServiceId,
  signal?: AbortSignal,
): Promise<string> {
  const resolved = await movieWithWatchUrls(movie, signal)
  return getServiceWatchUrl(resolved, serviceId)
}
