import { TMDB_PROVIDER_TO_STREAMLY } from '../data/tmdb'
import type { Movie, StreamingServiceId } from '../types'
import { cleanProviderUrl, getServiceWatchUrl, isJustWatchUrl } from './watchLinks'

const JUSTWATCH_GRAPHQL = import.meta.env.DEV
  ? '/__justwatch'
  : 'https://apis.justwatch.com/graphql'

const SEARCH_QUERY = `
query ($country: Country!, $language: Language!, $first: Int!, $filter: TitleFilter) {
  popularTitles(country: $country, first: $first, filter: $filter) {
    edges {
      node {
        objectType
        content(country: $country, language: $language) {
          title
          originalReleaseYear
          fullPath
        }
        offers(country: $country, platform: WEB) {
          monetizationType
          standardWebURL
          package { packageId }
        }
      }
    }
  }
}
`

interface JwOffer {
  monetizationType?: string
  standardWebURL?: string
  package?: { packageId?: number }
}

interface JwNode {
  objectType?: string
  content?: { title?: string; originalReleaseYear?: number; fullPath?: string }
  offers?: JwOffer[]
}

interface JwResponse {
  data?: {
    popularTitles?: { edges?: { node?: JwNode }[] }
  }
}

const HOST_TO_SERVICE: Array<[RegExp, StreamingServiceId]> = [
  [/disneyplus\.com$/i, 'disney-plus'],
  [/netflix\.com$/i, 'netflix'],
  [/hulu\.com$/i, 'hulu'],
  [/(^|\.)max\.com$/i, 'max'],
  [/hbomax\.com$/i, 'max'],
  [/primevideo\.com$/i, 'prime-video'],
  [/amazon\./i, 'prime-video'],
  [/tv\.apple\.com$/i, 'apple-tv'],
  [/peacocktv\.com$/i, 'peacock'],
  [/paramountplus\.com$/i, 'paramount-plus'],
]

/** JustWatch package ids (not always the same as TMDB provider ids). */
const JW_PACKAGE_TO_STREAMLY: Record<number, StreamingServiceId> = {
  8: 'netflix',
  15: 'hulu',
  337: 'disney-plus',
  9: 'prime-video',
  10: 'prime-video',
  2: 'apple-tv',
  384: 'max',
  1899: 'max',
  386: 'peacock',
  387: 'peacock',
  531: 'paramount-plus',
  1770: 'paramount-plus',
}

const RANK: Record<string, number> = {
  FLATRATE: 0,
  ADS: 1,
  FREE: 2,
  RENT: 3,
  BUY: 4,
}

const ENTITY_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

const watchUrlCache = new Map<string, Partial<Record<StreamingServiceId, string>>>()
const watchUrlInflight = new Map<
  string,
  Promise<Partial<Record<StreamingServiceId, string>> | undefined>
>()

function serviceFromHost(url: string): StreamingServiceId | null {
  try {
    const host = new URL(url).hostname
    const match = HOST_TO_SERVICE.find(([pattern]) => pattern.test(host))
    return match?.[1] ?? null
  } catch {
    return null
  }
}

function takeBest(
  into: Partial<Record<StreamingServiceId, string>>,
  service: StreamingServiceId,
  href: string,
  rank: number,
  ranks: Partial<Record<StreamingServiceId, number>>,
) {
  const cleaned = cleanProviderUrl(href)
  if (!cleaned || isJustWatchUrl(cleaned)) return
  const current = ranks[service]
  if (current !== undefined && current <= rank) return
  into[service] = cleaned
  ranks[service] = rank
}

function applyDisneyHuluEntity(
  links: Partial<Record<StreamingServiceId, string>>,
  entityId: string,
  allowed?: StreamingServiceId[],
) {
  const disney = `https://www.disneyplus.com/browse/entity-${entityId}`
  const hulu = `https://www.hulu.com/watch/${entityId}`
  if (!allowed || allowed.includes('disney-plus')) links['disney-plus'] ??= disney
  if (!allowed || allowed.includes('hulu')) links.hulu ??= hulu
}

function justWatchSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function pickNode(nodes: JwNode[], movie: Movie): JwNode | undefined {
  const title = movie.title.trim().toLowerCase()
  const exactYear = nodes.find(
    (entry) =>
      entry.content?.title?.trim().toLowerCase() === title &&
      entry.content.originalReleaseYear === movie.year,
  )
  if (exactYear) return exactYear
  if (movie.year > 0) {
    const byYear = nodes.find(
      (entry) => entry.content?.originalReleaseYear === movie.year,
    )
    if (byYear) return byYear
  }
  return nodes.find((entry) => entry.content?.title?.trim().toLowerCase() === title) ?? nodes[0]
}

async function fetchGraphqlOffers(
  movie: Movie,
  signal?: AbortSignal,
): Promise<Partial<Record<StreamingServiceId, string>>> {
  const response = await fetch(JUSTWATCH_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: {
        country: 'US',
        language: 'en',
        first: 8,
        filter: { searchQuery: movie.title.trim() },
      },
    }),
    signal: signal ?? AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error('JustWatch request failed')

  const json = (await response.json()) as JwResponse
  const nodes = (json.data?.popularTitles?.edges ?? [])
    .map((edge) => edge.node)
    .filter((node): node is JwNode => node?.objectType === 'MOVIE')

  const node = pickNode(nodes, movie)
  if (!node?.offers?.length) return {}

  const links: Partial<Record<StreamingServiceId, string>> = {}
  const ranks: Partial<Record<StreamingServiceId, number>> = {}
  for (const offer of node.offers) {
    const href = offer.standardWebURL?.trim()
    const packageId = offer.package?.packageId
    if (!href || packageId == null) continue
    const service =
      JW_PACKAGE_TO_STREAMLY[packageId] ??
      TMDB_PROVIDER_TO_STREAMLY[packageId] ??
      serviceFromHost(href)
    if (!service) continue
    takeBest(links, service, href, RANK[offer.monetizationType ?? ''] ?? 9, ranks)
  }

  const entity = links['disney-plus']?.match(ENTITY_ID)?.[0]
  if (entity) applyDisneyHuluEntity(links, entity, movie.streamingServices)
  return links
}

function extractProviderLinks(
  text: string,
  movie: Movie,
): Partial<Record<StreamingServiceId, string>> {
  const links: Partial<Record<StreamingServiceId, string>> = {}
  const ranks: Partial<Record<StreamingServiceId, number>> = {}
  const encoded = [
    ...text.matchAll(/deeplinkFallback":"(https:\\\/\\\/[^"]+)"/g),
    ...text.matchAll(/r=(https?%3A%2F%2F[^&"']+)/gi),
    ...text.matchAll(/https:\/\/www\.disneyplus\.com\/browse\/entity-[0-9a-f-]+/gi),
    ...text.matchAll(/https:\/\/www\.hulu\.com\/watch\/[0-9a-f-]+/gi),
  ]

  for (const match of encoded) {
    let href = match[1] ?? match[0]
    href = href.replace(/\\\//g, '/')
    try {
      href = decodeURIComponent(href)
    } catch {
      // Keep the raw href.
    }
    const service = serviceFromHost(href)
    if (!service) continue
    takeBest(links, service, href, 0, ranks)
  }

  const entity = text.match(new RegExp(`entity-(${ENTITY_ID.source})`, 'i'))?.[1]
  if (entity) applyDisneyHuluEntity(links, entity, movie.streamingServices)

  return links
}

async function readJustWatchPage(
  path: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(`https://r.jina.ai/https://www.justwatch.com${path}`, {
    signal: signal ?? AbortSignal.timeout(10000),
  })
  if (!response.ok) return ''
  return response.text()
}

function mergeLinks(
  ...groups: Partial<Record<StreamingServiceId, string>>[]
): Partial<Record<StreamingServiceId, string>> {
  const links: Partial<Record<StreamingServiceId, string>> = {}
  for (const group of groups) {
    for (const [service, href] of Object.entries(group) as [
      StreamingServiceId,
      string,
    ][]) {
      if (href && !isJustWatchUrl(href)) links[service] ??= href
    }
  }
  return links
}

async function fetchPageOffers(
  movie: Movie,
  signal?: AbortSignal,
): Promise<Partial<Record<StreamingServiceId, string>>> {
  const slug = justWatchSlug(movie.title)
  const paths: string[] = []
  if (slug) paths.push(`/us/movie/${slug}`)
  if (movie.year > 0 && slug) paths.push(`/us/movie/${slug}-${movie.year}`)

  let merged: Partial<Record<StreamingServiceId, string>> = {}
  const needed = movie.streamingServices

  for (const path of paths) {
    const text = await readJustWatchPage(path, signal)
    if (!text) continue
    merged = mergeLinks(merged, extractProviderLinks(text, movie))
    if (needed.length === 0 || needed.every((id) => merged[id])) return merged
  }

  const query = movie.year > 0 ? `${movie.title} ${movie.year}` : movie.title
  const search = await readJustWatchPage(
    `/us/search?q=${encodeURIComponent(query)}`,
    signal,
  )
  if (search) {
    merged = mergeLinks(merged, extractProviderLinks(search, movie))
    const searchPaths = [...search.matchAll(/\/us\/movie\/[a-z0-9-]+/gi)].map(
      (match) => match[0],
    )
    for (const path of searchPaths.slice(0, 3)) {
      if (paths.includes(path)) continue
      const text = await readJustWatchPage(path, signal)
      if (!text) continue
      merged = mergeLinks(merged, extractProviderLinks(text, movie))
      if (needed.length === 0 || needed.every((id) => merged[id])) return merged
    }
  }

  return merged
}

export async function fetchProviderWatchUrls(
  movie: Movie,
  signal?: AbortSignal,
): Promise<Partial<Record<StreamingServiceId, string>> | undefined> {
  const cacheKey = `${movie.id}:${movie.title}:${movie.year}`
  const cached = watchUrlCache.get(cacheKey)
  if (cached) return cached

  const inflight = watchUrlInflight.get(cacheKey)
  if (inflight) return inflight

  const pending = (async () => {
    let links: Partial<Record<StreamingServiceId, string>> = {}
    try {
      links = mergeLinks(links, await fetchGraphqlOffers(movie, signal))
    } catch {
      // Browser CORS blocks JustWatch GraphQL on the live site.
    }

    const missing = movie.streamingServices.filter((id) => !links[id])
    if (missing.length > 0 || Object.keys(links).length === 0) {
      try {
        links = mergeLinks(links, await fetchPageOffers(movie, signal))
      } catch {
        // Keep whatever GraphQL already found.
      }
    }

    if (Object.keys(links).length > 0) {
      watchUrlCache.set(cacheKey, links)
      return links
    }
    return undefined
  })().finally(() => {
    watchUrlInflight.delete(cacheKey)
  })

  watchUrlInflight.set(cacheKey, pending)
  return pending
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
