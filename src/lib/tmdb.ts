import {
  accentForId,
  inferMoods,
  mapTmdbGenreIds,
  MOOD_DISCOVER,
  STREAMLY_GENRE_TO_TMDB,
  STREAMLY_TO_TMDB_PROVIDERS,
  TMDB_IMAGE_BASE,
  TMDB_PROVIDER_TO_STREAMLY,
  TMDB_WATCH_REGION,
} from '../data/tmdb'
import { STREAMING_SERVICES } from '../data/constants'
import type {
  Movie,
  MovieStar,
  MoodId,
  StreamingServiceId,
  UserPreferences,
} from '../types'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const DISCOVER_PAGES_FEW_SERVICES = 2
const DISCOVER_PAGES_MANY_SERVICES = 1
const PROVIDER_CONCURRENCY = 6

function getApiKey(): string | undefined {
  const key = import.meta.env.VITE_TMDB_API_KEY
  return typeof key === 'string' && key.trim() ? key.trim() : undefined
}

export function isTmdbConfigured(): boolean {
  return Boolean(getApiKey())
}

export interface TmdbSearchParams {
  query: string
  page?: number
}

interface TmdbMovieListItem {
  id: number
  title?: string
  overview?: string
  release_date?: string
  genre_ids?: number[]
  poster_path?: string | null
  vote_average?: number
  vote_count?: number
  adult?: boolean
}

interface TmdbListResponse {
  page: number
  results: TmdbMovieListItem[]
  total_pages: number
  total_results: number
}

interface TmdbProvider {
  provider_id: number
  provider_name?: string
}

interface TmdbRegionProviders {
  link?: string
  flatrate?: TmdbProvider[]
  ads?: TmdbProvider[]
  rent?: TmdbProvider[]
  buy?: TmdbProvider[]
  free?: TmdbProvider[]
}

interface TmdbWatchProvidersResponse {
  results?: Record<string, TmdbRegionProviders>
}

interface TmdbCastMember {
  name?: string
  character?: string
  order?: number
}

interface TmdbCredits {
  cast?: TmdbCastMember[]
}

interface TmdbReleaseDate {
  certification?: string
  type?: number
}

interface TmdbReleaseDatesCountry {
  iso_3166_1?: string
  release_dates?: TmdbReleaseDate[]
}

interface TmdbReleaseDatesResponse {
  results?: TmdbReleaseDatesCountry[]
}

interface TmdbMovieDetails {
  id: number
  title?: string
  overview?: string
  release_date?: string
  runtime?: number
  poster_path?: string | null
  vote_average?: number
  genres?: { id: number }[]
  'watch/providers'?: TmdbWatchProvidersResponse
  credits?: TmdbCredits
  release_dates?: TmdbReleaseDatesResponse
}

/** Default top-billed names shown on the ticket. Never more than MAX. */
export const TOP_BILLED_STARS = 5
const TOP_BILLED_STARS_MAX = 8

/** Prefer US theatrical certification; falls back to any US entry. */
export function usContentRating(
  releaseDates: TmdbReleaseDatesResponse | undefined,
): string | undefined {
  const us = releaseDates?.results?.find((entry) => entry.iso_3166_1 === 'US')
  if (!us?.release_dates?.length) return undefined

  const theatrical = us.release_dates.find(
    (entry) => entry.type === 3 && entry.certification?.trim(),
  )
  if (theatrical?.certification?.trim()) {
    return theatrical.certification.trim()
  }

  const rated = us.release_dates.find((entry) => entry.certification?.trim())
  return rated?.certification?.trim() || undefined
}

export function mapTopBilledCast(
  cast: TmdbCastMember[] | undefined,
  limit = TOP_BILLED_STARS,
): MovieStar[] | undefined {
  if (!Array.isArray(cast) || cast.length === 0) return undefined
  const cap = Math.min(Math.max(limit, 0), TOP_BILLED_STARS_MAX)
  const named = cast.flatMap((member) => {
    const name = member.name?.trim()
    if (!name) return []
    const character = member.character?.trim()
    const order =
      typeof member.order === 'number' && Number.isFinite(member.order)
        ? member.order
        : Number.MAX_SAFE_INTEGER
    return [{ name, character: character || undefined, order }]
  })
  named.sort((a, b) => a.order - b.order)
  const stars: MovieStar[] = named.slice(0, cap).map(({ name, character }) =>
    character ? { name, character } : { name },
  )
  return stars.length > 0 ? stars : undefined
}

const discoverCache = new Map<string, Movie[]>()
const providerCache = new Map<number, StreamingServiceId[]>()
const detailsCache = new Map<number, Movie>()

function prefsCacheKey(prefs: UserPreferences): string {
  return [
    [...prefs.moods].sort().join(','),
    [...prefs.genres].sort().join(','),
    [...prefs.streamingServices].sort().join(','),
    prefs.familyFriendly ? 'family' : 'any',
  ].join('|')
}

function uniqueNumbers(ids: number[]): number[] {
  return [...new Set(ids)]
}

function posterUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  return `${TMDB_IMAGE_BASE}/w342${path}`
}

function yearFromDate(releaseDate: string | undefined): number {
  if (!releaseDate || releaseDate.length < 4) return 0
  const year = Number(releaseDate.slice(0, 4))
  return Number.isFinite(year) ? year : 0
}

function orderedServices(ids: Iterable<StreamingServiceId>): StreamingServiceId[] {
  const set = new Set(ids)
  return STREAMING_SERVICES.map((service) => service.id).filter((id) =>
    set.has(id),
  )
}

export function mapWatchProviderIds(
  providers: TmdbProvider[] | undefined,
): StreamingServiceId[] {
  if (!providers?.length) return []
  const mapped: StreamingServiceId[] = []
  for (const provider of providers) {
    const service = TMDB_PROVIDER_TO_STREAMLY[provider.provider_id]
    if (service && !mapped.includes(service)) mapped.push(service)
  }
  return orderedServices(mapped)
}

export function servicesFromUsProviders(
  region: TmdbRegionProviders | undefined,
): StreamingServiceId[] {
  if (!region) return []
  return orderedServices([
    ...mapWatchProviderIds(region.flatrate),
    ...mapWatchProviderIds(region.ads),
  ])
}

export function mapTmdbListItem(
  item: TmdbMovieListItem,
  services: StreamingServiceId[],
): Movie | null {
  if (!item.id || !item.title || item.adult) return null
  const genres = mapTmdbGenreIds(item.genre_ids ?? [])
  const year = yearFromDate(item.release_date)
  return {
    id: String(item.id),
    title: item.title,
    year,
    overview: item.overview?.trim() || 'No synopsis available.',
    genres,
    moods: inferMoods(genres, year),
    streamingServices: orderedServices(services),
    runtimeMinutes: 0,
    rating: item.vote_average ?? 0,
    accent: accentForId(item.id),
    posterUrl: posterUrl(item.poster_path),
  }
}

async function tmdbGet<T>(
  path: string,
  params: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<T> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error(
      'TMDB API key missing. Add VITE_TMDB_API_KEY to your .env file.',
    )
  }

  const url = new URL(`${TMDB_BASE}${path}`)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('language', 'en-US')
  for (const [key, value] of Object.entries(params)) {
    if (value !== '') url.searchParams.set(key, value)
  }

  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status}`)
  }
  return (await response.json()) as T
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await mapper(items[index])
    }
  }
  const workers = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}

function moodGenreIds(moods: MoodId[]): number[] {
  return uniqueNumbers(moods.flatMap((mood) => MOOD_DISCOVER[mood].genreIds))
}

function moodKeywordIds(moods: MoodId[]): number[] {
  return uniqueNumbers(
    moods.flatMap((mood) => MOOD_DISCOVER[mood].keywordIds ?? []),
  )
}

function wantedTmdbGenreIds(prefs: UserPreferences): Set<number> {
  const ids = new Set<number>()
  for (const genre of prefs.genres) {
    for (const id of STREAMLY_GENRE_TO_TMDB[genre]) ids.add(id)
  }
  for (const id of moodGenreIds(prefs.moods)) ids.add(id)
  return ids
}

function withoutGenreIds(prefs: UserPreferences): number[] {
  const wanted = wantedTmdbGenreIds(prefs)
  const excluded = new Set<number>()
  for (const mood of prefs.moods) {
    for (const id of MOOD_DISCOVER[mood].withoutGenreIds ?? []) {
      if (!wanted.has(id)) excluded.add(id)
    }
  }
  // Horror (27) — keep family-friendly catalogs clear of scary titles
  if (prefs.familyFriendly && !wanted.has(27)) {
    excluded.add(27)
  }
  return [...excluded]
}

function userGenreQuery(prefs: UserPreferences): {
  orIds: number[]
  romComAnd: boolean
} {
  if (prefs.genres.length === 0) {
    return { orIds: moodGenreIds(prefs.moods), romComAnd: false }
  }

  const orIds: number[] = []
  let romComAnd = false
  for (const genre of prefs.genres) {
    if (genre === 'rom-com') {
      romComAnd = true
    } else {
      orIds.push(...STREAMLY_GENRE_TO_TMDB[genre])
    }
  }
  return { orIds: uniqueNumbers(orIds), romComAnd }
}

function discoverBaseParams(prefs: UserPreferences): Record<string, string> {
  const params: Record<string, string> = {
    include_adult: 'false',
    include_video: 'false',
    sort_by: 'popularity.desc',
    watch_region: TMDB_WATCH_REGION,
    with_watch_monetization_types: 'flatrate',
    'vote_count.gte': '40',
  }
  const without = withoutGenreIds(prefs)
  if (without.length > 0) params.without_genres = without.join(',')
  if (prefs.familyFriendly) {
    // US theatrical rating ceiling — skips R / NC-17 while keeping most PG-13 family fare
    params.certification_country = 'US'
    params['certification.lte'] = 'PG-13'
  }
  return params
}

async function fetchDiscoverPage(
  extra: Record<string, string>,
  signal?: AbortSignal,
): Promise<TmdbMovieListItem[]> {
  const data = await tmdbGet<TmdbListResponse>('/discover/movie', extra, signal)
  return data.results ?? []
}

function mergeMovie(
  byId: Map<string, Movie>,
  item: TmdbMovieListItem,
  service: StreamingServiceId,
) {
  const mapped = mapTmdbListItem(item, [service])
  if (!mapped) return
  const existing = byId.get(mapped.id)
  if (!existing) {
    byId.set(mapped.id, mapped)
    return
  }
  existing.streamingServices = orderedServices([
    ...existing.streamingServices,
    service,
  ])
}

async function discoverPagesForQuery(
  params: Record<string, string>,
  pageCount: number,
  signal?: AbortSignal,
): Promise<TmdbMovieListItem[]> {
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, index) =>
      fetchDiscoverPage(
        { ...params, page: String(index + 1) },
        signal,
      ),
    ),
  )
  return pages.flat()
}

async function discoverForService(
  service: StreamingServiceId,
  prefs: UserPreferences,
  pageCount: number,
  signal?: AbortSignal,
): Promise<TmdbMovieListItem[]> {
  const providerIds = STREAMLY_TO_TMDB_PROVIDERS[service].join('|')
  const base = {
    ...discoverBaseParams(prefs),
    with_watch_providers: providerIds,
  }
  const { orIds, romComAnd } = userGenreQuery(prefs)
  const queries: Promise<TmdbMovieListItem[]>[] = []

  if (orIds.length > 0) {
    queries.push(
      discoverPagesForQuery(
        { ...base, with_genres: orIds.join('|') },
        pageCount,
        signal,
      ),
    )
  }

  if (romComAnd) {
    queries.push(
      discoverPagesForQuery(
        {
          ...base,
          with_genres: STREAMLY_GENRE_TO_TMDB['rom-com'].join(','),
        },
        pageCount,
        signal,
      ),
    )
  }

  if (
    prefs.genres.length === 0 &&
    orIds.length > 0 &&
    moodKeywordIds(prefs.moods).length > 0
  ) {
    const keywords = moodKeywordIds(prefs.moods)
    queries.push(
      discoverPagesForQuery(
        {
          ...base,
          with_keywords: keywords.join('|'),
        },
        1,
        signal,
      ),
    )
  }

  if (queries.length === 0) {
    queries.push(discoverPagesForQuery(base, pageCount, signal))
  }

  const chunks = await Promise.all(queries)
  return chunks.flat()
}

export async function searchMovies(
  params: TmdbSearchParams,
  signal?: AbortSignal,
): Promise<Movie[]> {
  const data = await tmdbGet<TmdbListResponse>(
    '/search/movie',
    {
      query: params.query,
      page: String(params.page ?? 1),
      include_adult: 'false',
    },
    signal,
  )

  const movies = (data.results ?? [])
    .map((item) => mapTmdbListItem(item, []))
    .filter((movie): movie is Movie => movie !== null)

  const withProviders = await mapPool(
    movies,
    PROVIDER_CONCURRENCY,
    async (movie) => {
      const services = await fetchWatchServices(Number(movie.id), signal)
      return {
        ...movie,
        streamingServices: services,
      }
    },
  )

  return withProviders
}

export async function discoverMovies(
  prefs: UserPreferences,
  signal?: AbortSignal,
): Promise<Movie[]> {
  if (!isTmdbConfigured()) {
    throw new Error(
      'TMDB API key missing. Add VITE_TMDB_API_KEY to your .env file.',
    )
  }

  const key = prefsCacheKey(prefs)
  const cached = discoverCache.get(key)
  if (cached) return cached

  const services = prefs.streamingServices
  if (services.length === 0) return []

  const pageCount =
    services.length <= 2
      ? DISCOVER_PAGES_FEW_SERVICES
      : DISCOVER_PAGES_MANY_SERVICES

  const settled = await Promise.allSettled(
    services.map((service) =>
      discoverForService(service, prefs, pageCount, signal),
    ),
  )

  const byId = new Map<string, Movie>()
  let anySuccess = false
  let lastError: unknown

  settled.forEach((result, index) => {
    if (result.status === 'rejected') {
      lastError = result.reason
      return
    }
    anySuccess = true
    const service = services[index]
    for (const item of result.value) mergeMovie(byId, item, service)
  })

  if (!anySuccess) {
    throw lastError instanceof Error
      ? lastError
      : new Error('TMDB request failed')
  }

  if (signal?.aborted) {
    throw lastError instanceof Error
      ? lastError
      : new DOMException('Aborted', 'AbortError')
  }

  const movies = [...byId.values()]
  discoverCache.set(key, movies)
  return movies
}

async function fetchWatchServices(
  tmdbId: number,
  signal?: AbortSignal,
): Promise<StreamingServiceId[]> {
  const cached = providerCache.get(tmdbId)
  if (cached) return cached

  const data = await tmdbGet<TmdbWatchProvidersResponse>(
    `/movie/${tmdbId}/watch/providers`,
    {},
    signal,
  )
  const services = servicesFromUsProviders(data.results?.[TMDB_WATCH_REGION])
  providerCache.set(tmdbId, services)
  return services
}

export async function enrichMovieDetails(
  movie: Movie,
  allowedServices: StreamingServiceId[],
  signal?: AbortSignal,
): Promise<Movie | 'unavailable'> {
  const tmdbId = Number(movie.id)
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) return movie

  const cached = detailsCache.get(tmdbId)
  if (cached) {
    const live = cached.streamingServices.filter((service) =>
      allowedServices.includes(service),
    )
    if (live.length === 0) return 'unavailable'
    return { ...cached, streamingServices: live }
  }

  const details = await tmdbGet<TmdbMovieDetails>(
    `/movie/${tmdbId}`,
    { append_to_response: 'watch/providers,credits,release_dates' },
    signal,
  )

  const regionProviders =
    details['watch/providers']?.results?.[TMDB_WATCH_REGION]
  const liveServices = servicesFromUsProviders(regionProviders)
  providerCache.set(tmdbId, liveServices)

  const genres = mapTmdbGenreIds(
    details.genres?.map((genre) => genre.id) ?? [],
  )
  const resolvedGenres = genres.length > 0 ? genres : movie.genres
  const year = yearFromDate(details.release_date) || movie.year
  let starring: MovieStar[] | undefined
  try {
    starring = mapTopBilledCast(details.credits?.cast)
  } catch {
    starring = undefined
  }
  const enriched: Movie = {
    ...movie,
    title: details.title || movie.title,
    year,
    overview: details.overview?.trim() || movie.overview,
    genres: resolvedGenres,
    moods: inferMoods(resolvedGenres, year),
    runtimeMinutes: details.runtime ?? movie.runtimeMinutes,
    rating: details.vote_average ?? movie.rating,
    contentRating:
      usContentRating(details.release_dates) ?? movie.contentRating,
    posterUrl: posterUrl(details.poster_path) ?? movie.posterUrl,
    streamingServices: liveServices,
    accent: movie.accent,
    watchUrl: regionProviders?.link || movie.watchUrl,
    starring,
  }
  detailsCache.set(tmdbId, enriched)

  const allowed = liveServices.filter((service) =>
    allowedServices.includes(service),
  )
  if (allowed.length === 0) return 'unavailable'
  return { ...enriched, streamingServices: allowed }
}
