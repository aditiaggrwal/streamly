import type { Genre, Mood, StreamingService } from '../types'

export const MOODS: Mood[] = [
  {
    id: 'happy',
    label: 'Happy',
    description: 'Light, fun, and feel-good',
    preferredGenres: ['comedy', 'animation', 'musical', 'family', 'rom-com'],
    thumbnail:
      'linear-gradient(145deg, #ffd166 0%, #f4a261 38%, #e76f51 72%, #264653 100%)',
    accent: '#f4a261',
  },
  {
    id: 'cozy',
    label: 'Cozy',
    description: 'Warm, comforting, low stakes',
    preferredGenres: ['romance', 'rom-com', 'comedy', 'drama', 'family'],
    thumbnail:
      'linear-gradient(160deg, #6d4c41 0%, #a1887f 42%, #d7ccc8 78%, #3e2723 100%)',
    accent: '#bcaaa4',
  },
  {
    id: 'adventurous',
    label: 'Adventurous',
    description: 'Big worlds and bold journeys',
    preferredGenres: ['adventure', 'action', 'fantasy', 'sci-fi'],
    thumbnail:
      'linear-gradient(155deg, #0b132b 0%, #1c2541 35%, #3a506b 68%, #5bc0be 100%)',
    accent: '#5bc0be',
  },
  {
    id: 'romantic',
    label: 'Romantic',
    description: 'Love stories and emotional beats',
    preferredGenres: ['romance', 'rom-com', 'drama', 'comedy'],
    thumbnail:
      'linear-gradient(150deg, #4a1942 0%, #893168 45%, #c44569 72%, #ffd6e0 100%)',
    accent: '#e5989b',
  },
  {
    id: 'thoughtful',
    label: 'Thoughtful',
    description: 'Slow burns and ideas to chew on',
    preferredGenres: ['drama', 'documentary', 'mystery', 'sci-fi'],
    thumbnail:
      'linear-gradient(160deg, #1b263b 0%, #415a77 48%, #778da9 82%, #0d1b2a 100%)',
    accent: '#778da9',
  },
  {
    id: 'spooky',
    label: 'Spooky',
    description: 'Chills, suspense, and shadows',
    preferredGenres: ['horror', 'thriller', 'mystery'],
    thumbnail:
      'linear-gradient(155deg, #0a0a0a 0%, #1a1a2e 40%, #4a0e4e 72%, #240046 100%)',
    accent: '#9d4edd',
  },
  {
    id: 'intense',
    label: 'Intense',
    description: 'High stakes and edge-of-seat energy',
    preferredGenres: ['thriller', 'action', 'crime', 'sci-fi'],
    thumbnail:
      'linear-gradient(150deg, #0d0d0d 0%, #3d0000 42%, #8b0000 68%, #ff4d4d 100%)',
    accent: '#ff4d4d',
  },
  {
    id: 'nostalgic',
    label: 'Nostalgic',
    description: 'Classics and comfort rewatches',
    preferredGenres: ['family', 'animation', 'comedy', 'adventure'],
    thumbnail:
      'linear-gradient(160deg, #3e2723 0%, #8d6e63 38%, #d7ccc8 70%, #5d4037 100%)',
    accent: '#a1887f',
  },
  {
    id: 'emotional',
    label: 'Emotional',
    description: 'Heartfelt stories that hit deep',
    preferredGenres: ['drama', 'romance', 'documentary', 'family'],
    thumbnail:
      'linear-gradient(155deg, #1a1a2e 0%, #3d4f6f 42%, #6b7c9e 72%, #2d3748 100%)',
    accent: '#8fa4c4',
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
  { id: 'netflix', label: 'Netflix', shortLabel: 'N', brandColor: '#E50914' },
  {
    id: 'disney-plus',
    label: 'Disney+',
    shortLabel: 'D+',
    brandColor: '#113CCF',
  },
  { id: 'hulu', label: 'Hulu', shortLabel: 'H', brandColor: '#1CE783' },
  { id: 'max', label: 'Max', shortLabel: 'M', brandColor: '#7B2FF7' },
  {
    id: 'prime-video',
    label: 'Prime Video',
    shortLabel: 'PV',
    brandColor: '#00A8E1',
  },
  {
    id: 'apple-tv',
    label: 'Apple TV+',
    shortLabel: 'TV',
    brandColor: '#3A3A3C',
  },
  { id: 'peacock', label: 'Peacock', shortLabel: 'P', brandColor: '#111111' },
  {
    id: 'paramount-plus',
    label: 'Paramount+',
    shortLabel: 'P+',
    brandColor: '#0064FF',
  },
]

export const STORAGE_KEY = 'streamly-streaming-services'
