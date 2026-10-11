import type { Movie, StreamingServiceId } from '../types'

const TRACKING_PARAMS = new Set([
  'irclickid',
  'campaignid',
  'irgwc',
  'afsrc',
  'cid',
  'sharedid',
  'tgclid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'at',
  'ct',
  'itscg',
  'itsct',
  'tag',
  'linkcode',
])

export function cleanProviderUrl(raw: string): string {
  const url = raw.trim()
  if (!url) return ''

  try {
    const parsed = new URL(url)
    const redirect = parsed.searchParams.get('r')
    if (
      redirect &&
      /justwatch\.com$/i.test(parsed.hostname)
    ) {
      return cleanProviderUrl(redirect)
    }

    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) parsed.searchParams.delete(key)
    }
    return parsed.toString()
  } catch {
    return url
  }
}

export function isJustWatchUrl(url: string): boolean {
  try {
    return /justwatch\.com$/i.test(new URL(url).hostname)
  } catch {
    return /justwatch\.com/i.test(url)
  }
}

const HOST_TO_SERVICE: Array<[RegExp, StreamingServiceId]> = [
  [/disneyplus\.com$/i, 'disney-plus'],
  [/netflix\.com$/i, 'netflix'],
  [/hulu\.com$/i, 'hulu'],
  [/(^|\.)max\.com$/i, 'max'],
  [/hbomax\.com$/i, 'max'],
  [/primevideo\.com$/i, 'prime-video'],
  [/amazon\./i, 'prime-video'],
  [/tv\.apple\.com$/i, 'apple-tv'],
  [/peacocktv\.com$/i, 'peacock'],
  [/paramountplus\.com$/i, 'paramount-plus'],
]

export function serviceFromHost(url: string): StreamingServiceId | null {
  try {
    const host = new URL(url).hostname
    const match = HOST_TO_SERVICE.find(([pattern]) => pattern.test(host))
    return match?.[1] ?? null
  } catch {
    return null
  }
}

const SERVICE_HOMEPAGES: Record<StreamingServiceId, string> = {
  netflix: 'https://www.netflix.com/',
  'disney-plus': 'https://www.disneyplus.com/',
  hulu: 'https://www.hulu.com/',
  max: 'https://www.max.com/',
  'prime-video': 'https://www.primevideo.com/',
  'apple-tv': 'https://tv.apple.com/',
  peacock: 'https://www.peacocktv.com/',
  'paramount-plus': 'https://www.paramountplus.com/',
}

export function isServiceHomepage(url: string, serviceId: StreamingServiceId): boolean {
  try {
    const parsed = new URL(url)
    const home = new URL(SERVICE_HOMEPAGES[serviceId])
    return (
      parsed.hostname === home.hostname &&
      (parsed.pathname === '/' || parsed.pathname === '')
    )
  } catch {
    return false
  }
}

export function serviceSearchUrl(
  serviceId: StreamingServiceId,
  title: string,
  year = 0,
): string {
  const query = year > 0 ? `${title} ${year}` : title
  const q = encodeURIComponent(query.trim())
  switch (serviceId) {
    case 'disney-plus':
      return `https://www.disneyplus.com/search/${encodeURIComponent(title.trim())}`
    case 'netflix':
      return `https://www.netflix.com/search?q=${q}`
    case 'hulu':
      return `https://www.hulu.com/search?q=${q}`
    case 'max':
      return `https://www.max.com/search?q=${q}`
    case 'prime-video':
      return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}`
    case 'apple-tv':
      return `https://tv.apple.com/search?term=${q}`
    case 'peacock':
      return `https://www.peacocktv.com/search/${q}`
    case 'paramount-plus':
      return `https://www.paramountplus.com/search/?q=${q}`
  }
}

/** Prefer a title page. Bare Disney+/etc homepages are not the movie. */
export function getServiceWatchUrl(
  movie: Movie,
  serviceId: StreamingServiceId,
): string {
  const override = cleanProviderUrl(movie.watchUrls?.[serviceId] ?? '')
  if (
    override &&
    !isJustWatchUrl(override) &&
    !isServiceHomepage(override, serviceId)
  ) {
    return override
  }
  return serviceSearchUrl(serviceId, movie.title, movie.year)
}

export function isLikelyTitlePage(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase()
    return (
      /\/movies\//.test(path) ||
      /\/whats-on\//.test(path) ||
      /\/play\//.test(path) ||
      /\/watch\//.test(path) ||
      /\/video\//.test(path)
    )
  } catch {
    return false
  }
}

export function isDisneyEntityUrl(url: string): boolean {
  return /disneyplus\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:browse|whats-on)\/entity-/i.test(
    url,
  )
}
