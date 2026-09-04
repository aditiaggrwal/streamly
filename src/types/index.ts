export type MoodId =
  | 'happy'
  | 'cozy'
  | 'adventurous'
  | 'romantic'
  | 'thoughtful'
  | 'spooky'
  | 'intense'
  | 'nostalgic'

export type GenreId =
  | 'action'
  | 'adventure'
  | 'animation'
  | 'comedy'
  | 'crime'
  | 'drama'
  | 'family'
  | 'fantasy'
  | 'horror'
  | 'mystery'
  | 'romance'
  | 'rom-com'
  | 'sci-fi'
  | 'thriller'
  | 'documentary'
  | 'musical'

export type StreamingServiceId =
  | 'netflix'
  | 'disney-plus'
  | 'hulu'
  | 'max'
  | 'prime-video'
  | 'apple-tv'
  | 'peacock'
  | 'paramount-plus'

export interface MovieStar {
  name: string
  character?: string
}

export interface Movie {
  id: string
  title: string
  year: number
  overview: string
  genres: GenreId[]
  moods: MoodId[]
  streamingServices: StreamingServiceId[]
  runtimeMinutes: number
  rating: number
  /** US content rating when known (e.g. PG, PG-13, R) */
  contentRating?: string
  accent: string
  posterUrl?: string
  /** TMDB / JustWatch "where to watch" URL when available */
  watchUrl?: string
  /** Top-billed TMDB cast; omitted when credits are missing */
  starring?: MovieStar[]
}

export interface Mood {
  id: MoodId
  label: string
  description: string
  preferredGenres: GenreId[]
  /** Cinematic wash used as the mood card thumbnail */
  thumbnail: string
  accent: string
}

export interface Genre {
  id: GenreId
  label: string
}

export interface StreamingService {
  id: StreamingServiceId
  label: string
  shortLabel: string
  brandColor: string
}

export interface UserPreferences {
  moods: MoodId[]
  genres: GenreId[]
  streamingServices: StreamingServiceId[]
  familyFriendly: boolean
}

export interface ScoredMovie {
  movie: Movie
  score: number
  reasons: string[]
}
