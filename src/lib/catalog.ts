import { CURATED_MOVIES } from '../data/movies'
import type { Movie, ScoredMovie, UserPreferences } from '../types'
import { exceedsRuntimeBudget, pickMovie, scoreMovie } from './recommend'
import {
  discoverMovies,
  enrichMovieDetails,
  fetchMovieDetails,
  isTmdbConfigured,
} from './tmdb'

export type CardFacts = Pick<Movie, 'contentRating' | 'runtimeMinutes'>

export function movieNeedsCardFacts(movie: Movie): boolean {
  const hasRating = Boolean(movie.contentRating?.trim())
  const hasRuntime = movie.runtimeMinutes > 0
  return !hasRating || !hasRuntime
}

export function applyCardFacts(movie: Movie, facts: CardFacts): Movie {
  const contentRating = facts.contentRating?.trim() || movie.contentRating
  const runtimeMinutes =
    Number.isFinite(facts.runtimeMinutes) && facts.runtimeMinutes > 0
      ? facts.runtimeMinutes
      : movie.runtimeMinutes
  if (
    contentRating === movie.contentRating &&
    runtimeMinutes === movie.runtimeMinutes
  ) {
    return movie
  }
  return { ...movie, contentRating, runtimeMinutes }
}

/** Apply fetched chips, then drop titles whose known runtime exceeds the budget. */
export function mergeCardFacts(
  results: ScoredMovie[],
  facts: Map<string, CardFacts>,
  maxRuntimeMinutes: number | null = null,
): ScoredMovie[] {
  if (facts.size === 0 && maxRuntimeMinutes == null) return results

  let changed = false
  const next: ScoredMovie[] = []
  for (const entry of results) {
    const update = facts.get(entry.movie.id)
    const movie = update ? applyCardFacts(entry.movie, update) : entry.movie
    if (exceedsRuntimeBudget(movie, maxRuntimeMinutes)) {
      changed = true
      continue
    }
    if (movie === entry.movie) {
      next.push(entry)
      continue
    }
    changed = true
    next.push({ ...entry, movie })
  }
  return changed ? next : results
}

export function mergeCardFactsForPick(
  pick: ScoredMovie,
  facts: Map<string, CardFacts>,
  maxRuntimeMinutes: number | null = null,
): ScoredMovie | null {
  const update = facts.get(pick.movie.id)
  const movie = update ? applyCardFacts(pick.movie, update) : pick.movie
  if (exceedsRuntimeBudget(movie, maxRuntimeMinutes)) return null
  if (movie === pick.movie) return pick
  return { ...pick, movie }
}

/** Fetch US rating + runtime for visible cards. Callers apply / drop after. */
export async function enrichMoviesForCards(
  movies: Movie[],
  signal?: AbortSignal,
): Promise<Map<string, CardFacts>> {
  const facts = new Map<string, CardFacts>()
  const pending = movies.filter(movieNeedsCardFacts)
  if (pending.length === 0) return facts

  await Promise.all(
    pending.map(async (movie) => {
      try {
        const enriched = await fetchMovieDetails(movie, signal)
        facts.set(movie.id, {
          contentRating: enriched.contentRating,
          runtimeMinutes: enriched.runtimeMinutes,
        })
      } catch {
        // Leave chips hidden when details are unavailable.
      }
    }),
  )
  return facts
}

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
    if (exceedsRuntimeBudget(enriched, prefs.maxRuntimeMinutes)) return null
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
      if (
        enriched === 'unavailable' ||
        exceedsRuntimeBudget(enriched, prefs.maxRuntimeMinutes)
      ) {
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
