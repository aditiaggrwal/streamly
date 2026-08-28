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
  accent: string
  posterUrl?: string
}

export interface Mood {
  id: MoodId
  label: string
  emoji: string
  description: string
  preferredGenres: GenreId[]
}

export interface Genre {
  id: GenreId
  label: string
}

export interface StreamingService {
  id: StreamingServiceId
  label: string
  shortLabel: string
}

export interface UserPreferences {
  moods: MoodId[]
  genres: GenreId[]
  streamingServices: StreamingServiceId[]
}

export interface ScoredMovie {
  movie: Movie
  score: number
  reasons: string[]
}
