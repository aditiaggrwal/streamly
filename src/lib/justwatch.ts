import { STREAMING_SERVICES } from '../data/constants'
import type { Movie, StreamingServiceId } from '../types'
import {
  cleanProviderUrl,
  getServiceWatchUrl,
  isAllowedServiceUrl,
  isJustWatchUrl,
  watchTitleKey,
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

interface WatchLinkFile {
  byId?: Record<string, unknown>
  byTitle?: Record<string, unknown>
}

let watchLinkFile: Promise<WatchLinkFile | null> | undefined

function loadWatchLinkFile(): Promise<WatchLinkFile | null> {
  if (!watchLinkFile) {
    const url = `${import.meta.env.BASE_URL}watch-links.json`
    watchLinkFile = fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) return null
        const body = (await response.json()) as WatchLinkFile
        if (!body || typeof body !== 'object') return null
        return body
      })
      .catch(() => null)
  }
  return watchLinkFile
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
  const title = movie.title.trim()
  if (!title || title.length > 200) return undefined
  try {
    const file = await loadWatchLinkFile()
    if (!file) return undefined
    const year = Number.isInteger(movie.year) && movie.year > 0 ? movie.year : 0
    const raw = file.byId?.[movie.id] ?? file.byTitle?.[watchTitleKey(title, year)]
    const links = sanitizeLinks(movie, raw)
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
