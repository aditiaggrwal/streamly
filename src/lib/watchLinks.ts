import type { Movie, StreamingServiceId } from '../types'

function watchSearchQuery(movie: Movie): string {
  const title = movie.title.trim()
  if (!title) return ''
  return movie.year > 0 ? `${title} ${movie.year}` : title
}

const SERVICE_WATCH_URL_BUILDERS: Record<
  StreamingServiceId,
  (movie: Movie) => string
> = {
  netflix: (movie) =>
    `https://www.netflix.com/search?q=${encodeURIComponent(watchSearchQuery(movie))}`,
  'disney-plus': (movie) =>
    `https://www.disneyplus.com/search?q=${encodeURIComponent(watchSearchQuery(movie))}`,
  hulu: (movie) =>
    `https://www.hulu.com/search?q=${encodeURIComponent(watchSearchQuery(movie))}`,
  max: (movie) =>
    `https://play.max.com/search?q=${encodeURIComponent(watchSearchQuery(movie))}`,
  'prime-video': (movie) =>
    `https://www.amazon.com/s?k=${encodeURIComponent(watchSearchQuery(movie))}&i=instant-video`,
  'apple-tv': (movie) =>
    `https://tv.apple.com/search?term=${encodeURIComponent(watchSearchQuery(movie))}`,
  peacock: (movie) =>
    `https://www.peacocktv.com/search?q=${encodeURIComponent(watchSearchQuery(movie))}`,
  'paramount-plus': (movie) =>
    `https://www.paramountplus.com/search?q=${encodeURIComponent(watchSearchQuery(movie))}`,
}

export function getServiceWatchUrl(
  movie: Movie,
  serviceId: StreamingServiceId,
): string {
  const override = movie.watchUrls?.[serviceId]?.trim()
  if (override) return override

  const builder = SERVICE_WATCH_URL_BUILDERS[serviceId]
  return builder(movie)
}
