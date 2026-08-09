import type { Genre, Mood, StreamingService } from '../types'

export const MOODS: Mood[] = [
  {
    id: 'happy',
    label: 'Happy',
    emoji: '😄',
    description: 'Light, fun, and feel-good',
    preferredGenres: ['comedy', 'animation', 'musical', 'family', 'rom-com'],
  },
  {
    id: 'cozy',
    label: 'Cozy',
    emoji: '🛋️',
    description: 'Warm, comforting, low stakes',
    preferredGenres: ['romance', 'rom-com', 'comedy', 'drama', 'family'],
  },
  {
    id: 'adventurous',
    label: 'Adventurous',
    emoji: '🗺️',
    description: 'Big worlds and bold journeys',
    preferredGenres: ['adventure', 'action', 'fantasy', 'sci-fi'],
  },
  {
    id: 'romantic',
    label: 'Romantic',
    emoji: '💕',
    description: 'Love stories and emotional beats',
    preferredGenres: ['romance', 'rom-com', 'drama', 'comedy'],
  },
  {
    id: 'thoughtful',
    label: 'Thoughtful',
    emoji: '🤔',
    description: 'Slow burns and ideas to chew on',
    preferredGenres: ['drama', 'documentary', 'mystery', 'sci-fi'],
  },
  {
    id: 'spooky',
    label: 'Spooky',
    emoji: '👻',
    description: 'Chills, suspense, and shadows',
    preferredGenres: ['horror', 'thriller', 'mystery'],
  },
  {
    id: 'intense',
    label: 'Intense',
    emoji: '⚡',
    description: 'High stakes and edge-of-seat energy',
    preferredGenres: ['thriller', 'action', 'crime', 'sci-fi'],
  },
  {
    id: 'nostalgic',
    label: 'Nostalgic',
    emoji: '📼',
    description: 'Classics and comfort rewatches',
    preferredGenres: ['family', 'animation', 'comedy', 'adventure'],
  },
]

export const GENRES: Genre[] = [
  { id: 'action', label: 'Action' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'animation', label: 'Animation' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'crime', label: 'Crime' },
  { id: 'drama', label: 'Drama' },
  { id: 'family', label: 'Family' },
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'horror', label: 'Horror' },
  { id: 'mystery', label: 'Mystery' },
  { id: 'romance', label: 'Romance' },
  { id: 'rom-com', label: 'Rom Com' },
  { id: 'sci-fi', label: 'Sci-Fi' },
  { id: 'thriller', label: 'Thriller' },
  { id: 'documentary', label: 'Documentary' },
  { id: 'musical', label: 'Musical' },
]

export const STREAMING_SERVICES: StreamingService[] = [
  { id: 'netflix', label: 'Netflix', shortLabel: 'N' },
  { id: 'disney-plus', label: 'Disney+', shortLabel: 'D+' },
  { id: 'hulu', label: 'Hulu', shortLabel: 'H' },
  { id: 'max', label: 'Max', shortLabel: 'M' },
  { id: 'prime-video', label: 'Prime Video', shortLabel: 'PV' },
  { id: 'apple-tv', label: 'Apple TV+', shortLabel: 'ATV' },
  { id: 'peacock', label: 'Peacock', shortLabel: 'P' },
  { id: 'paramount-plus', label: 'Paramount+', shortLabel: 'P+' },
]

export const STORAGE_KEY = 'streamly-streaming-services'
