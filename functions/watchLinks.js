'use strict'

/**
 * Resolve direct streaming title URLs from JustWatch.
 *
 * The browser must not call JustWatch (CORS) or a third-party reader.
 * This module only sends a fixed GraphQL query to apis.justwatch.com and
 * only returns https URLs on known streaming hosts. It does not fetch
 * any URL supplied by the caller.
 */

const JUSTWATCH_GRAPHQL = 'https://apis.justwatch.com/graphql'
const JUSTWATCH_TIMEOUT_MS = 8000
const HIT_TTL_MS = 10 * 60 * 1000
const MISS_TTL_MS = 60 * 1000
const MAX_CACHE_ENTRIES = 500
const RATE_WINDOW_MS = 60 * 1000
const RATE_MAX = 60
const MAX_URL_LENGTH = 2048
const MAX_TITLE_LENGTH = 200

const SERVICES = [
  'netflix',
  'disney-plus',
  'hulu',
  'max',
  'prime-video',
  'apple-tv',
  'peacock',
  'paramount-plus',
]

/** Keep in sync with SERVICE_HOSTS in src/lib/watchLinks.ts. */
const SERVICE_HOSTS = {
  netflix: ['netflix.com'],
  'disney-plus': ['disneyplus.com'],
  hulu: ['hulu.com'],
  max: ['max.com', 'hbomax.com'],
  'prime-video': ['primevideo.com', 'watch.amazon.com'],
  'apple-tv': ['tv.apple.com'],
  peacock: ['peacocktv.com'],
  'paramount-plus': ['paramountplus.com'],
}

/** JustWatch package ids, plus the TMDB provider ids the app already maps. */
const PACKAGE_TO_SERVICE = {
  8: 'netflix',
  1796: 'netflix',
  337: 'disney-plus',
  15: 'hulu',
  9: 'prime-video',
  10: 'prime-video',
  119: 'prime-video',
  2: 'apple-tv',
  350: 'apple-tv',
  384: 'max',
  1899: 'max',
  386: 'peacock',
  387: 'peacock',
  531: 'paramount-plus',
  1770: 'paramount-plus',
}

const MONETIZATION_RANK = {
  FLATRATE: 0,
  ADS: 1,
  FREE: 2,
  RENT: 3,
  BUY: 4,
}

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
  'irmp',
  'irad',
])

const ENTITY_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

const SEARCH_QUERY = `
query ($country: Country!, $language: Language!, $first: Int!, $filter: TitleFilter) {
  popularTitles(country: $country, first: $first, filter: $filter) {
    edges {
      node {
        objectType
        content(country: $country, language: $language) {
          title
          originalReleaseYear
        }
        offers(country: $country, platform: WEB) {
          monetizationType
          standardWebURL
          package { packageId }
        }
      }
    }
  }
}
`

const cache = new Map()
const inflight = new Map()
const rates = new Map()

function resetWatchLinksState() {
  cache.clear()
  inflight.clear()
  rates.clear()
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
}

function hostMatches(hostname, allowed) {
  const host = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '')
  return host === allowed || host.endsWith(`.${allowed}`)
}

function hostAllowed(service, hostname) {
  const allowed = SERVICE_HOSTS[service]
  if (!allowed) return false
  return allowed.some((entry) => hostMatches(hostname, entry))
}

function isJustWatchHost(hostname) {
  return /(^|\.)justwatch\.com$/i.test(hostname)
}

function cleanProviderUrl(raw, depth = 0) {
  const url = String(raw || '').trim()
  if (!url || depth > 2) return ''
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return ''
    if (parsed.username || parsed.password) return ''
    const redirect = parsed.searchParams.get('r')
    if (redirect && isJustWatchHost(parsed.hostname)) {
      return cleanProviderUrl(redirect, depth + 1)
    }
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) parsed.searchParams.delete(key)
    }
    parsed.hash = ''
    if (parsed.protocol !== 'https:') return ''
    return parsed.toString()
  } catch {
    return ''
  }
}

/** Real title pages rank ahead of Disney+ /browse/entity links. */
function isLikelyTitlePage(href) {
  try {
    const path = new URL(href).pathname.toLowerCase()
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

function isDisneyEntityUrl(href) {
  return new RegExp(
    `disneyplus\\.com\\/(?:[a-z]{2}(?:-[a-z]{2})?\\/)?(?:browse|whats-on)\\/entity-${ENTITY_ID.source}`,
    'i',
  ).test(href)
}

function isSearchOrHome(url) {
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const lower = path.toLowerCase()
  if (
    lower === '/' ||
    lower === '/home' ||
    lower === '/welcome' ||
    lower === '/login' ||
    lower === '/signup' ||
    lower === '/browse'
  ) {
    return true
  }
  return /\/search(\/|$)/i.test(lower)
}

function isDirectTitlePath(pathname) {
  const path = pathname.toLowerCase()
  return (
    /\/title\/\d+/.test(path) ||
    /\/movies\/[^/]+/.test(path) ||
    /\/movie\/[^/]+/.test(path) ||
    /\/whats-on\/[^/]+/.test(path) ||
    /\/play\/[^/]+/.test(path) ||
    /\/watch\/[^/]+/.test(path) ||
    /\/video\/[^/]+/.test(path) ||
    /\/show\/[^/]+/.test(path) ||
    /\/detail(?:\/|$)/.test(path) ||
    /\/gp\/video\/detail\/[^/]+/.test(path) ||
    /\/feature\/[^/]+/.test(path) ||
    /\/series\/[^/]+/.test(path) ||
    /\/program\/[^/]+/.test(path)
  )
}

function hrefRank(href, base) {
  if (isLikelyTitlePage(href)) return base - 2
  if (isDisneyEntityUrl(href)) return base + 1
  return base
}

function isAcceptableWatchUrl(href, service) {
  let parsed
  try {
    parsed = new URL(href)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  if (parsed.username || parsed.password) return false
  if (isJustWatchHost(parsed.hostname)) return false
  if (!hostAllowed(service, parsed.hostname)) return false
  if (isSearchOrHome(parsed)) return false
  if (isDirectTitlePath(parsed.pathname)) return true
  return service === 'disney-plus' && isDisneyEntityUrl(href)
}

function serviceForOffer(packageId, href) {
  if (packageId != null && PACKAGE_TO_SERVICE[packageId]) {
    return PACKAGE_TO_SERVICE[packageId]
  }
  let hostname = ''
  try {
    hostname = new URL(href).hostname
  } catch {
    return null
  }
  if (/primevideo\.com$/i.test(hostname)) return 'prime-video'
  for (const service of SERVICES) {
    if (service === 'prime-video') continue
    if (hostAllowed(service, hostname)) return service
  }
  return null
}

function takeBest(into, ranks, service, href, rank) {
  const cleaned = cleanProviderUrl(href)
  if (!cleaned || !isAcceptableWatchUrl(cleaned, service)) return
  const nextRank = hrefRank(cleaned, rank)
  const current = ranks[service]
  if (current !== undefined && current <= nextRank) return
  into[service] = cleaned
  ranks[service] = nextRank
}

function pickNode(nodes, title, year) {
  const wanted = normalizeTitle(title)
  if (!wanted) return undefined
  const titled = nodes.filter(
    (node) => normalizeTitle(node.content?.title) === wanted,
  )
  if (titled.length === 0) return undefined
  if (year > 0) {
    const exact = titled.find(
      (node) => node.content?.originalReleaseYear === year,
    )
    if (exact) return exact
    const close = titled.find((node) => {
      const release = node.content?.originalReleaseYear
      return typeof release === 'number' && Math.abs(release - year) <= 1
    })
    return close
  }
  return titled[0]
}

function linksFromOffers(node, services) {
  const allowed = services.length > 0 ? new Set(services) : null
  const links = {}
  const ranks = {}
  for (const offer of node.offers || []) {
    const href = offer?.standardWebURL
    if (!href) continue
    const service = serviceForOffer(offer.package?.packageId, href)
    if (!service) continue
    if (allowed && !allowed.has(service)) continue
    const rank = MONETIZATION_RANK[offer.monetizationType] ?? 9
    takeBest(links, ranks, service, href, rank)
  }
  return links
}

async function queryJustWatch(title, fetchImpl) {
  let response
  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetchImpl(JUSTWATCH_GRAPHQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Streamly/1.0 (watch-links)',
      },
      body: JSON.stringify({
        query: SEARCH_QUERY,
        variables: {
          country: 'US',
          language: 'en',
          first: 8,
          filter: { searchQuery: title, objectTypes: ['MOVIE'] },
        },
      }),
      signal: AbortSignal.timeout(JUSTWATCH_TIMEOUT_MS),
    })
    if (response.status !== 429 || attempt === 3) break
    await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)))
  }
  if (!response.ok) throw new Error(`JustWatch HTTP ${response.status}`)
  const json = await response.json()
  const edges = json?.data?.popularTitles?.edges
  if (!Array.isArray(edges)) return []
  return edges
    .map((edge) => edge?.node)
    .filter((node) => node && node.objectType === 'MOVIE')
}

function cacheGet(key) {
  const hit = cache.get(key)
  if (!hit) return undefined
  if (hit.expires <= Date.now()) {
    cache.delete(key)
    return undefined
  }
  cache.delete(key)
  cache.set(key, hit)
  return hit.value
}

function cacheSet(key, value, ttl) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value
    cache.delete(oldest)
  }
  cache.set(key, { value, expires: Date.now() + ttl })
}

function lookupKey(input) {
  return [
    input.country,
    input.tmdbId || '',
    input.year,
    normalizeTitle(input.title),
    [...input.services].sort().join(','),
  ].join('|')
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function disneyPageTitle(html) {
  const raw = String(html || '').match(/<title[^>]*>([^<]*)/i)?.[1] || ''
  return decodeHtml(raw).replace(/\s*\|\s*Watch on Disney\+.*$/i, '').trim()
}

function disneyTitlesMatch(movieTitle, pageTitle) {
  const movie = normalizeTitle(movieTitle)
  const page = normalizeTitle(pageTitle)
  if (!movie || !page) return false
  if (page.includes('singalong') && !movie.includes('singalong')) return false
  return page === movie
}

function disneyAlternates(html) {
  const found = []
  const seen = new Set()
  const add = (title, path) => {
    const cleanTitle = decodeHtml(title).trim()
    if (!cleanTitle || !path || seen.has(`${path}|${cleanTitle}`)) return
    seen.add(`${path}|${cleanTitle}`)
    found.push({
      title: cleanTitle,
      url: `https://www.disneyplus.com${path}`,
    })
  }
  for (const match of String(html).matchAll(
    /aria-label="([^"]+)" href="(\/browse\/entity-[0-9a-f-]{36})"/gi,
  )) {
    add(match[1], match[2])
  }
  for (const match of String(html).matchAll(
    /"title":"([^"\\]{1,160})","url":"(\/browse\/entity-[0-9a-f-]{36})"/gi,
  )) {
    add(match[1], match[2])
  }
  return found
}

async function readDisneyHtml(url, fetchImpl, stop) {
  const parsed = new URL(url)
  if (!hostAllowed('disney-plus', parsed.hostname)) return ''
  const response = await fetchImpl(parsed.toString(), {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'Mozilla/5.0 (compatible; Streamly/1.0)',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(6000),
  })
  if (!response.ok) return ''
  if (response.url) {
    try {
      if (!hostAllowed('disney-plus', new URL(response.url).hostname)) return ''
    } catch {
      return ''
    }
  }
  const limit = 500000
  if (!response.body || typeof response.body.getReader !== 'function') {
    const text = typeof response.text === 'function' ? await response.text() : ''
    return String(text).slice(0, limit)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let html = ''
  try {
    while (html.length < limit) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
      if (stop && stop(html)) break
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      // The body may already be finished.
    }
  }
  return html
}

/**
 * JustWatch sometimes links the sing-along (or another cut) instead of the
 * movie. Disney+ entity pages list the original title beside it; use that
 * when the page title is not the movie.
 */
async function refineDisneyLink(movieTitle, url, fetchImpl = globalThis.fetch) {
  if (!isDisneyEntityUrl(url)) return url
  let html = ''
  try {
    html = await readDisneyHtml(url, fetchImpl, (chunk) => {
      const title = disneyPageTitle(chunk)
      if (!title || !/<\/title>/i.test(chunk)) return false
      if (disneyTitlesMatch(movieTitle, title)) return true
      return disneyAlternates(chunk).some((entry) =>
        disneyTitlesMatch(movieTitle, entry.title),
      )
    })
  } catch {
    return url
  }
  const pageTitle = disneyPageTitle(html)
  if (pageTitle && disneyTitlesMatch(movieTitle, pageTitle)) return url
  const alternate = disneyAlternates(html).find((entry) =>
    disneyTitlesMatch(movieTitle, entry.title),
  )
  if (!alternate) {
    if (pageTitle && !disneyTitlesMatch(movieTitle, pageTitle)) return ''
    return url
  }
  try {
    const confirmed = await readDisneyHtml(alternate.url, fetchImpl, (chunk) =>
      /<\/title>/i.test(chunk),
    )
    const confirmedTitle = disneyPageTitle(confirmed)
    if (confirmedTitle && disneyTitlesMatch(movieTitle, confirmedTitle)) {
      return alternate.url
    }
    if (confirmedTitle) return ''
  } catch {
    return alternate.url
  }
  return alternate.url
}

async function resolveWatchLinks(input, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch
  const key = lookupKey(input)
  const cached = cacheGet(key)
  if (cached) return cached

  const pending = inflight.get(key)
  if (pending) return pending

  const job = (async () => {
    let links = {}
    try {
      const nodes = await queryJustWatch(input.title.trim(), fetchImpl)
      const node = pickNode(nodes, input.title, input.year)
      if (node) links = linksFromOffers(node, input.services)
      if (links['disney-plus']) {
        const refined = await refineDisneyLink(
          input.title,
          links['disney-plus'],
          fetchImpl,
        )
        if (refined && isAcceptableWatchUrl(refined, 'disney-plus')) {
          links['disney-plus'] = refined
        } else {
          delete links['disney-plus']
        }
      }
    } catch (error) {
      console.warn(
        'JustWatch watch-link lookup failed:',
        error instanceof Error ? error.message : 'unknown',
      )
      links = {}
    }
    const value = { links }
    cacheSet(key, value, Object.keys(links).length > 0 ? HIT_TTL_MS : MISS_TTL_MS)
    return value
  })().finally(() => {
    inflight.delete(key)
  })

  inflight.set(key, job)
  return job
}

function hasControlChar(value) {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) <= 31) return true
  }
  return false
}

function parseWatchLinksQuery(params) {
  const title = String(params.get('title') || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!title) return { ok: false, error: 'Title is required' }
  if (title.length > MAX_TITLE_LENGTH || hasControlChar(title)) {
    return { ok: false, error: 'Invalid title' }
  }

  const tmdbRaw = params.get('tmdbId')
  let tmdbId = ''
  if (tmdbRaw != null && tmdbRaw !== '') {
    if (!/^\d{1,10}$/.test(tmdbRaw) || tmdbRaw === '0') {
      return { ok: false, error: 'Invalid tmdb id' }
    }
    tmdbId = tmdbRaw
  }

  const yearRaw = params.get('year')
  let year = 0
  if (yearRaw != null && yearRaw !== '') {
    if (!/^\d{1,4}$/.test(yearRaw)) return { ok: false, error: 'Invalid year' }
    year = Number(yearRaw)
    if (year !== 0 && (year < 1880 || year > 2100)) {
      return { ok: false, error: 'Invalid year' }
    }
  }

  const countryRaw = params.get('country')
  if (countryRaw != null && countryRaw !== '' && countryRaw.toUpperCase() !== 'US') {
    return { ok: false, error: 'Invalid country' }
  }

  const servicesRaw = params.get('services')
  let services = []
  if (servicesRaw != null && servicesRaw !== '') {
    const parts = servicesRaw.split(',').map((part) => part.trim()).filter(Boolean)
    if (parts.length === 0 || parts.length > SERVICES.length) {
      return { ok: false, error: 'Invalid services' }
    }
    const seen = new Set()
    for (const part of parts) {
      if (!SERVICES.includes(part) || seen.has(part)) {
        return { ok: false, error: 'Invalid services' }
      }
      seen.add(part)
    }
    services = [...seen]
  }

  return {
    ok: true,
    value: { title, year, tmdbId, country: 'US', services },
  }
}

function clientIp(req) {
  if (typeof req.ip === 'string' && req.ip) return req.ip.slice(0, 80)
  const address = req.socket?.remoteAddress
  return typeof address === 'string' && address ? address : 'local'
}

function allowRequest(req) {
  const ip = clientIp(req)
  const now = Date.now()
  if (rates.size > 2000) {
    for (const [key, entry] of rates) {
      if (entry.reset <= now) rates.delete(key)
    }
  }
  const entry = rates.get(ip)
  if (!entry || entry.reset <= now) {
    rates.set(ip, { count: 1, reset: now + RATE_WINDOW_MS })
    return true
  }
  entry.count += 1
  return entry.count <= RATE_MAX
}

function sendJson(res, status, body, cacheControl) {
  if (res.headersSent) return
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Cache-Control', cacheControl)
  res.end(payload)
}

async function handleWatchLinks(req, res) {
  try {
    const method = String(req.method || 'GET').toUpperCase()
    if (method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' }, 'no-store')
      return
    }
    const rawUrl = String(req.originalUrl || req.url || '')
    if (rawUrl.length > MAX_URL_LENGTH) {
      sendJson(res, 400, { error: 'Invalid request' }, 'no-store')
      return
    }
    if (!allowRequest(req)) {
      sendJson(res, 429, { error: 'Too many requests' }, 'no-store')
      return
    }

    const params = new URL(rawUrl, 'https://watchstreamly.web.app').searchParams
    const parsed = parseWatchLinksQuery(params)
    if (!parsed.ok) {
      sendJson(res, 400, { error: parsed.error }, 'no-store')
      return
    }

    const result = await resolveWatchLinks(parsed.value)
    const hasLinks = Object.keys(result.links).length > 0
    sendJson(
      res,
      200,
      result,
      hasLinks ? 'public, max-age=120, s-maxage=600' : 'public, max-age=60',
    )
  } catch {
    sendJson(res, 500, { error: 'Watch links unavailable' }, 'no-store')
  }
}

module.exports = {
  JUSTWATCH_GRAPHQL,
  SERVICES,
  handleWatchLinks,
  resetWatchLinksState,
  resolveWatchLinks,
  parseWatchLinksQuery,
  isAcceptableWatchUrl,
  cleanProviderUrl,
  normalizeTitle,
  refineDisneyLink,
}
