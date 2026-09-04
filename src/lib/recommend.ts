import { GENRES, MOODS, STREAMING_SERVICES } from '../data/constants'
import { CURATED_MOVIES } from '../data/movies'
import type {
  GenreId,
  MoodId,
  Movie,
  ScoredMovie,
  UserPreferences,
} from '../types'

export interface RecommendOptions {
  excludeIds?: string[]
  shuffleTieBreak?: number
  movies?: Movie[]
}

function getMood(moodId: MoodId) {
  return MOODS.find((m) => m.id === moodId)
}

function moodGenreOverlap(moodId: MoodId, genres: GenreId[]): number {
  const mood = getMood(moodId)
  if (!mood) return 0
  return mood.preferredGenres.filter((g) => genres.includes(g)).length
}

function bestMoodGenreOverlap(moods: MoodId[], genres: GenreId[]): number {
  if (moods.length === 0) return 0
  return Math.max(...moods.map((m) => moodGenreOverlap(m, genres)))
}

function formatServiceList(labels: string[]): string {
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`
}

function buildReasons(
  movie: Movie,
  prefs: UserPreferences,
  moodGenreMatches: number,
): string[] {
  const reasons: string[] = []

  const moodMatches = prefs.moods.filter((m) => movie.moods.includes(m))
  if (moodMatches.length === 1) {
    const mood = getMood(moodMatches[0])
    reasons.push(`Fits your ${mood?.label.toLowerCase()} mood`)
  } else if (moodMatches.length > 1) {
    reasons.push(`Fits ${moodMatches.length} of your moods`)
  } else if (prefs.moods.length > 0 && moodGenreMatches > 0) {
    reasons.push('Matches the vibe of your moods')
  }

  const genreMatches = movie.genres.filter((g) => prefs.genres.includes(g))
  if (genreMatches.length > 0) {
    const label =
      GENRES.find((g) => g.id === genreMatches[0])?.label ?? genreMatches[0]
    reasons.push(
      genreMatches.length === 1
        ? `Includes ${label}`
        : `Hits ${genreMatches.length} genres you picked`,
    )
  }

  const serviceMatches = movie.streamingServices.filter((s) =>
    prefs.streamingServices.includes(s),
  )
  if (serviceMatches.length > 0) {
    const serviceLabels = serviceMatches.map(
      (id) => STREAMING_SERVICES.find((service) => service.id === id)?.label ?? id,
    )
    reasons.push(`Available on ${formatServiceList(serviceLabels)}`)
  }

  if (prefs.familyFriendly) {
    reasons.push('Keeps things family friendly')
  }

  if (
    prefs.moods.includes('nostalgic') &&
    movie.year > 0 &&
    movie.year <= 2005
  ) {
    reasons.push(`A classic from ${movie.year}`)
  }

  if (reasons.length === 0) {
    reasons.push('A strong all-around pick for tonight')
  }

  return reasons
}

export function scoreMovie(
  movie: Movie,
  prefs: UserPreferences,
): ScoredMovie | null {
  const { moods, genres, streamingServices } = prefs

  if (streamingServices.length > 0) {
    const available = movie.streamingServices.some((s) =>
      streamingServices.includes(s),
    )
    if (!available) return null
  }

  if (prefs.familyFriendly) {
    if (movie.genres.includes('horror') || movie.moods.includes('spooky')) {
      return null
    }
  }

  if (genres.length > 0) {
    const genreHits = movie.genres.filter((g) => genres.includes(g)).length
    if (genreHits === 0) return null
  }

  let score = 0
  let moodGenreMatches = 0

  if (moods.length > 0) {
    const directMatches = moods.filter((m) => movie.moods.includes(m))
    if (directMatches.length > 0) {
      score += directMatches.length * 35
    } else {
      moodGenreMatches = bestMoodGenreOverlap(moods, movie.genres)
      score += moodGenreMatches * 12
    }
  }

  if (genres.length > 0) {
    const matches = movie.genres.filter((g) => genres.includes(g)).length
    score += matches * 22
  } else if (moods.length > 0) {
    moodGenreMatches = Math.max(
      moodGenreMatches,
      bestMoodGenreOverlap(moods, movie.genres),
    )
    score += moodGenreMatches * 8
  }

  score += movie.rating * 1.5

  if (moods.includes('nostalgic') && movie.year > 0 && movie.year <= 2010) {
    score += movie.year <= 1995 ? 12 : 8
  }

  const reasons = buildReasons(movie, prefs, moodGenreMatches)

  return { movie, score, reasons }
}

export function recommendMovies(
  prefs: UserPreferences,
  options: RecommendOptions = {},
): ScoredMovie[] {
  const { excludeIds = [], shuffleTieBreak = 0, movies = CURATED_MOVIES } =
    options

  const scored = movies.map((movie) => scoreMovie(movie, prefs))
    .filter((result): result is ScoredMovie => result !== null)
    .filter((result) => !excludeIds.includes(result.movie.id))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return (
        a.movie.title.localeCompare(b.movie.title) + shuffleTieBreak * 0.001
      )
    })

  return scored
}

export function pickMovie(
  prefs: UserPreferences,
  excludeIds: string[] = [],
  movies: Movie[] = CURATED_MOVIES,
): ScoredMovie | null {
  const matches = recommendMovies(prefs, { excludeIds, movies })
  if (matches.length === 0) return null

  const topScore = matches[0].score
  const topTier = matches.filter((m) => m.score >= topScore - 8)
  const index = Math.floor(Math.random() * topTier.length)
  return topTier[index]
}

export function getMatchCount(
  prefs: UserPreferences,
  movies: Movie[] = CURATED_MOVIES,
): number {
  return recommendMovies(prefs, { movies }).length
}
