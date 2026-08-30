import { MOODS } from './constants'
import type { GenreId, MoodId, StreamingServiceId } from '../types'

export const TMDB_WATCH_REGION = 'US'
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

/** Streamly genre → TMDB genre ids. Rom-com is Comedy AND Romance. */
export const STREAMLY_GENRE_TO_TMDB: Record<GenreId, number[]> = {
  action: [28],
  adventure: [12],
  animation: [16],
  comedy: [35],
  crime: [80],
  drama: [18],
  family: [10751],
  fantasy: [14],
  horror: [27],
  mystery: [9648],
  romance: [10749],
  'rom-com': [35, 10749],
  'sci-fi': [878],
  thriller: [53],
  documentary: [99],
  musical: [10402],
}

export const TMDB_GENRE_TO_STREAMLY: Record<number, GenreId> = {
  28: 'action',
  12: 'adventure',
  16: 'animation',
  35: 'comedy',
  80: 'crime',
  18: 'drama',
  10751: 'family',
  14: 'fantasy',
  27: 'horror',
  9648: 'mystery',
  10749: 'romance',
  878: 'sci-fi',
  53: 'thriller',
  99: 'documentary',
  10402: 'musical',
}

/**
 * Moods map onto TMDB genre bundles (and a few extra discover knobs),
 * not a 1:1 TMDB genre picker. Keywords are OR'd as a secondary query
 * so feel-good dramas can still surface for Happy, etc.
 */
export interface MoodDiscoverHint {
  genreIds: number[]
  withoutGenreIds?: number[]
  keywordIds?: number[]
}

export const MOOD_DISCOVER: Record<MoodId, MoodDiscoverHint> = {
  happy: {
    genreIds: [35, 16, 10751, 10402],
    withoutGenreIds: [27],
    // feel-good, friendship
    keywordIds: [329716, 6054],
  },
  cozy: {
    genreIds: [10749, 35, 18, 10751],
    withoutGenreIds: [27, 53],
    // holiday, christmas
    keywordIds: [65, 207317],
  },
  adventurous: {
    genreIds: [12, 28, 14, 878],
    // superhero, space, time travel
    keywordIds: [9715, 9882, 4379],
  },
  romantic: {
    genreIds: [10749, 35],
    // love
    keywordIds: [9673],
  },
  thoughtful: {
    genreIds: [18, 99, 9648, 878],
    // based on novel or book, based on a true story
    keywordIds: [818, 9672],
  },
  spooky: {
    genreIds: [27, 53, 9648],
    // haunted house, ghost
    keywordIds: [8975, 6152],
  },
  intense: {
    genreIds: [53, 28, 80, 878],
    withoutGenreIds: [10751],
    // revenge, heist
    keywordIds: [9748, 10051],
  },
  nostalgic: {
    genreIds: [10751, 16, 35, 12],
    // coming of age
    keywordIds: [10683],
  },
}

/**
 * TMDB / JustWatch provider ids for US subscription services.
 * Include current and legacy ids so discover + watch/providers both match.
 * Max is 1899 (HBO Max 384 is the pre-rebrand id). Prime Video is 9 in the
 * US catalog; 119 appears in some TMDB dumps as the same service.
 */
export const STREAMLY_TO_TMDB_PROVIDERS: Record<
  StreamingServiceId,
  number[]
> = {
  netflix: [8, 1796],
  'disney-plus': [337],
  hulu: [15],
  max: [1899, 384],
  'prime-video': [9, 119],
  'apple-tv': [350],
  peacock: [386, 387],
  'paramount-plus': [531, 1770],
}

export const TMDB_PROVIDER_TO_STREAMLY: Record<number, StreamingServiceId> =
  Object.fromEntries(
    (
      Object.entries(STREAMLY_TO_TMDB_PROVIDERS) as [
        StreamingServiceId,
        number[],
      ][]
    ).flatMap(([service, ids]) => ids.map((id) => [id, service])),
  ) as Record<number, StreamingServiceId>

const ACCENTS = [
  '#2d5016',
  '#e85d04',
  '#7209b7',
  '#1b4332',
  '#d00000',
  '#ff6b35',
  '#588157',
  '#6a040f',
  '#4895ef',
  '#9d0208',
  '#e09f3e',
  '#f72585',
  '#ff006e',
  '#14213d',
  '#ff7b00',
  '#03045e',
  '#ff1493',
  '#0077b6',
  '#e63946',
  '#212529',
  '#06d6a0',
  '#fca311',
  '#4cc9f0',
  '#023e8a',
  '#9b5de5',
  '#b5179e',
  '#370617',
  '#560bad',
  '#606c38',
  '#2d6a4f',
  '#774936',
  '#ffba08',
]

export function accentForId(id: number): string {
  return ACCENTS[Math.abs(id) % ACCENTS.length]
}

export function mapTmdbGenreIds(genreIds: number[]): GenreId[] {
  const mapped: GenreId[] = []
  const seen = new Set<GenreId>()
  for (const id of genreIds) {
    const genre = TMDB_GENRE_TO_STREAMLY[id]
    if (genre && !seen.has(genre)) {
      seen.add(genre)
      mapped.push(genre)
    }
  }
  if (seen.has('comedy') && seen.has('romance') && !seen.has('rom-com')) {
    mapped.push('rom-com')
  }
  return mapped
}

export function inferMoods(genres: GenreId[], year: number): MoodId[] {
  const moods: MoodId[] = []
  for (const mood of MOODS) {
    if (mood.preferredGenres.some((genre) => genres.includes(genre))) {
      moods.push(mood.id)
    }
  }
  if (year > 0 && year <= 2005 && !moods.includes('nostalgic')) {
    moods.push('nostalgic')
  }
  return moods
}
