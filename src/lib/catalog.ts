import { CURATED_MOVIES } from '../data/movies'
import type { Movie, ScoredMovie, UserPreferences } from '../types'
import { pickMovie, scoreMovie } from './recommend'
import {
  discoverMovies,
  enrichMovieDetails,
  isTmdbConfigured,
} from './tmdb'

export type CatalogSource = 'tmdb' | 'curated' | 'curated-fallback'

export interface CatalogResult {
  movies: Movie[]
  source: CatalogSource
}

export async function loadCatalog(
  prefs: UserPreferences,
  signal?: AbortSignal,
): Promise<CatalogResult> {
  if (!isTmdbConfigured()) {
    return { movies: CURATED_MOVIES, source: 'curated' }
  }

  try {
    const movies = await discoverMovies(prefs, signal)
    return { movies, source: 'tmdb' }
  } catch (error) {
    if (signal?.aborted) throw error
    return { movies: CURATED_MOVIES, source: 'curated-fallback' }
  }
}

export async function enrichPick(
  pick: ScoredMovie,
  prefs: UserPreferences,
): Promise<ScoredMovie | null> {
  if (!isTmdbConfigured()) return pick

  try {
    const enriched = await enrichMovieDetails(
      pick.movie,
      prefs.streamingServices,
    )
    if (enriched === 'unavailable') return null
    const rescored = scoreMovie(enriched, prefs)
    return rescored ?? { ...pick, movie: enriched }
  } catch {
    return pick
  }
}

export async function confirmPick(
  pick: ScoredMovie,
  prefs: UserPreferences,
  catalog: Movie[],
  excludeIds: string[] = [],
): Promise<ScoredMovie | null> {
  if (!isTmdbConfigured()) return pick

  const skipped = new Set(excludeIds)
  let current: ScoredMovie | null = pick

  for (let attempt = 0; attempt < 8 && current; attempt += 1) {
    try {
      const enriched = await enrichMovieDetails(
        current.movie,
        prefs.streamingServices,
      )
      if (enriched === 'unavailable') {
        skipped.add(current.movie.id)
        current = pickMovie(prefs, [...skipped], catalog)
        continue
      }
      const rescored = scoreMovie(enriched, prefs)
      return rescored ?? { ...current, movie: enriched }
    } catch {
      return current
    }
  }

  return current
}
