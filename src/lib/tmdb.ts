import type { Movie, UserPreferences } from '../types'

/**
 * TMDB integration stub — wire this up when you have an API key.
 *
 * 1. Add VITE_TMDB_API_KEY to a .env file
 * 2. Call searchMovies() or discoverMovies() from the UI
 * 3. Map TMDB results into the Movie shape used by recommend.ts
 */

const TMDB_BASE = 'https://api.themoviedb.org/3'

function getApiKey(): string | undefined {
  return import.meta.env.VITE_TMDB_API_KEY
}

export function isTmdbConfigured(): boolean {
  return Boolean(getApiKey())
}

export interface TmdbSearchParams {
  query: string
  page?: number
}

export async function searchMovies(
  params: TmdbSearchParams,
): Promise<Movie[]> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error(
      'TMDB API key missing. Add VITE_TMDB_API_KEY to your .env file.',
    )
  }

  const url = new URL(`${TMDB_BASE}/search/movie`)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('query', params.query)
  url.searchParams.set('page', String(params.page ?? 1))

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status}`)
  }

  // TODO: map TMDB JSON → Movie[] and merge with streaming availability
  void params
  return []
}

export async function discoverMovies(
  _prefs: UserPreferences,
): Promise<Movie[]> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error(
      'TMDB API key missing. Add VITE_TMDB_API_KEY to your .env file.',
    )
  }

  // TODO: use /discover/movie with genre + keyword filters from prefs
  return []
}
