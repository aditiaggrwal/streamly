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

export function getServiceWatchUrl(
  movie: Movie,
  serviceId: StreamingServiceId,
): string {
  const override = cleanProviderUrl(movie.watchUrls?.[serviceId] ?? '')
  if (override && !isJustWatchUrl(override)) return override
  return SERVICE_HOMEPAGES[serviceId]
}
