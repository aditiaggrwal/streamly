import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const {
  resolveWatchLinks,
  normalizeTitle,
  refineDisneyLink,
  isAcceptableWatchUrl,
  cleanProviderUrl,
} = require('../functions/watchLinks.js')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outPath = path.join(root, 'public', 'watch-links.json')

const PROVIDERS = {
  netflix: [8, 1796],
  'disney-plus': [337],
  hulu: [15],
  max: [1899, 384],
  'prime-video': [9, 119],
  'apple-tv': [350],
  peacock: [386, 387],
  'paramount-plus': [531, 1770],
}

const MOOD_GENRES = [
  [35, 16, 10751, 10402],
  [10749, 35, 18, 10751],
  [12, 28, 14, 878],
  [10749, 35],
  [18, 99, 9648, 878],
  [27, 53, 9648],
  [53, 28, 80, 878],
  [10751, 16, 35, 12],
  [18, 10749, 10751],
]

const GENRE_FILTERS = [
  '28',
  '12',
  '16',
  '35',
  '80',
  '18',
  '10751',
  '14',
  '27',
  '9648',
  '10749',
  '35,10749',
  '878',
  '53',
  '99',
  '10402',
]

const PINNED = [
  ['Coco', 2017],
  ['Spider-Man: Across the Spider-Verse', 2023],
  ['WALL·E', 2008],
  ['Hoppers', 2026],
  ['Green Book', 2018],
]

const PER_SERVICE = 40
const EXTRA_FOR = new Set(['disney-plus', 'netflix'])

function loadTmdbKey() {
  const text = fs.readFileSync(path.join(root, '.env'), 'utf8')
  const line = text.split('\n').find((entry) => entry.startsWith('VITE_TMDB_API_KEY='))
  const key = line?.slice('VITE_TMDB_API_KEY='.length).trim().replace(/^['"]|['"]$/g, '')
  if (!key) throw new Error('VITE_TMDB_API_KEY missing from .env')
  return key
}

function watchTitleKey(title, year) {
  const safeYear = Number.isInteger(year) && year > 0 ? year : 0
  return `${normalizeTitle(title)}|${safeYear}`
}

function parseCurated() {
  const source = fs.readFileSync(path.join(root, 'src', 'data', 'movies.ts'), 'utf8')
  const movies = []
  for (const chunk of source.split(/\n  \{\n/)) {
    const id = chunk.match(/id:\s*'([^']+)'/)
    const title = chunk.match(/title:\s*'((?:\\'|[^'])*)'/)
    const year = chunk.match(/year:\s*(\d+)/)
    const services = chunk.match(/streamingServices:\s*\[([^\]]*)\]/)
    if (!id || !title || !year || !services) continue
    movies.push({
      id: id[1],
      title: title[1].replace(/\\'/g, "'"),
      year: Number(year[1]),
      services: [...services[1].matchAll(/'([^']+)'/g)].map((match) => match[1]),
      pinned: true,
    })
  }
  return movies
}

function yearOf(item) {
  const year = Number(String(item.release_date || '').slice(0, 4))
  return Number.isInteger(year) && year > 0 ? year : 0
}

async function tmdb(apiKey, pathname, params, attempt = 0) {
  const url = new URL(`https://api.themoviedb.org/3${pathname}`)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('language', 'en-US')
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') url.searchParams.set(key, String(value))
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (response.status === 429 && attempt < 3) {
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
    return tmdb(apiKey, pathname, params, attempt + 1)
  }
  if (!response.ok) throw new Error(`TMDB ${response.status} ${pathname}`)
  return response.json()
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length)
  let cursor = 0
  async function run() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()))
  return results
}

function remember(movies, item, service) {
  if (!item?.id || !item.title) return
  const id = String(item.id)
  let entry = movies.get(id)
  if (!entry) {
    entry = {
      id,
      title: item.title,
      year: yearOf(item),
      services: new Set(),
      pinned: false,
    }
    movies.set(id, entry)
  }
  if (service) entry.services.add(service)
  if (!entry.year) entry.year = yearOf(item)
}

async function findTmdb(apiKey, title, year) {
  const data = await tmdb(apiKey, '/search/movie', {
    query: title,
    page: 1,
    include_adult: 'false',
  })
  const wanted = normalizeTitle(title)
  return (data.results || []).find((item) => {
    if (normalizeTitle(item.title) !== wanted) return false
    if (!year) return true
    const release = yearOf(item)
    return release === 0 || Math.abs(release - year) <= 1
  })
}

function discoverJobs() {
  const jobs = []
  for (const [service, ids] of Object.entries(PROVIDERS)) {
    const providers = ids.join('|')
    const base = { with_watch_providers: providers }
    for (const page of [1, 2]) {
      jobs.push({ service, params: { ...base, page } })
    }
    jobs.push({ service, params: { ...base, page: 1, 'with_runtime.lte': 90 } })
    jobs.push({ service, params: { ...base, page: 1, 'with_runtime.lte': 120 } })
    jobs.push({
      service,
      params: {
        ...base,
        page: 1,
        certification_country: 'US',
        'certification.lte': 'PG-13',
      },
    })
    for (const genres of MOOD_GENRES) {
      jobs.push({
        service,
        params: { ...base, page: 1, with_genres: genres.join('|') },
      })
      if (EXTRA_FOR.has(service)) {
        jobs.push({
          service,
          params: { ...base, page: 2, with_genres: genres.join('|') },
        })
      }
    }
    for (const filter of GENRE_FILTERS) {
      jobs.push({
        service,
        params: { ...base, page: 1, with_genres: filter },
      })
    }
  }
  return jobs
}

function chooseMovies(movies) {
  const chosen = []
  const seen = new Set()
  const buckets = Object.fromEntries(Object.keys(PROVIDERS).map((service) => [service, []]))

  const ranked = [...movies.values()].sort((a, b) => Number(b.pinned) - Number(a.pinned))
  for (const movie of ranked) {
    if (movie.pinned) {
      chosen.push(movie)
      seen.add(movie.id)
      continue
    }
    const services = [...movie.services]
    const home = services[0]
    if (home && buckets[home]) buckets[home].push(movie)
  }

  const limits = Object.fromEntries(
    Object.keys(PROVIDERS).map((service) => [
      service,
      PER_SERVICE + (EXTRA_FOR.has(service) ? 40 : 0),
    ]),
  )
  let added = true
  while (added) {
    added = false
    for (const service of Object.keys(buckets)) {
      if (limits[service] <= 0) continue
      const next = buckets[service].shift()
      if (!next || seen.has(next.id)) continue
      chosen.push(next)
      seen.add(next.id)
      limits[service] -= 1
      added = true
    }
  }
  return chosen
}

function emptyFile() {
  return { byId: {}, byTitle: {} }
}

function storeLinks(file, movie, links) {
  const usable = {}
  for (const [service, url] of Object.entries(links || {})) {
    if (typeof url === 'string' && url.startsWith('https://')) usable[service] = url
  }
  if (Object.keys(usable).length === 0) return false
  const merge = (key, bucket) => {
    bucket[key] = { ...(bucket[key] || {}), ...usable }
  }
  merge(String(movie.id), file.byId)
  if (movie.tmdbId) merge(String(movie.tmdbId), file.byId)
  const titleKey = watchTitleKey(movie.title, movie.year)
  if (titleKey && !titleKey.startsWith('|')) merge(titleKey, file.byTitle)
  return true
}

const CATALOG_QUERY = `
query ($country: Country!, $language: Language!, $first: Int!, $after: String, $filter: TitleFilter) {
  popularTitles(country: $country, first: $first, after: $after, filter: $filter) {
    totalCount
    pageInfo { hasNextPage endCursor }
    edges {
      node {
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

const OFFER_RANK = { FLATRATE: 0, ADS: 1, FREE: 2, RENT: 3, BUY: 4 }
const PACKAGE_SERVICE = { 337: 'disney-plus', 15: 'hulu' }

function titlesCompatible(tmdbTitle, justWatchTitle) {
  const left = normalizeTitle(tmdbTitle)
  const right = normalizeTitle(justWatchTitle)
  if (!left || !right) return false
  if (left === right) return true
  const strip = (value) => value.replace(/[0-9]/g, '')
  const a = strip(left)
  const b = strip(right)
  return a.length >= 8 && a === b
}

function loadExistingFile() {
  if (!fs.existsSync(outPath)) return emptyFile()
  const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'))
  return {
    byId: parsed.byId && typeof parsed.byId === 'object' ? parsed.byId : {},
    byTitle: parsed.byTitle && typeof parsed.byTitle === 'object' ? parsed.byTitle : {},
  }
}

async function justWatchPage(filter, after) {
  let response
  for (let attempt = 0; attempt < 6; attempt += 1) {
    response = await fetch('https://apis.justwatch.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Streamly/1.0 (watch-links)',
      },
      body: JSON.stringify({
        query: CATALOG_QUERY,
        variables: {
          country: 'US',
          language: 'en',
          first: 100,
          after,
          filter,
        },
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (response.status !== 429 || attempt === 5) break
    await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)))
  }
  if (!response.ok) throw new Error(`JustWatch HTTP ${response.status}`)
  const json = await response.json()
  if (json.errors?.length) throw new Error('JustWatch query failed')
  return json.data?.popularTitles
}

function rememberOffer(index, title, year, service, url, monetization) {
  const cleaned = cleanProviderUrl(url)
  if (!cleaned || !isAcceptableWatchUrl(cleaned, service)) return
  const key = watchTitleKey(title, year)
  let entry = index.byExact.get(key)
  if (!entry) {
    entry = { title, year, links: {}, ranks: {} }
    index.byExact.set(key, entry)
    const bucket = index.byYear.get(year) || []
    bucket.push(entry)
    index.byYear.set(year, bucket)
  }
  const rank = OFFER_RANK[monetization] ?? 9
  if (entry.ranks[service] != null && entry.ranks[service] <= rank) return
  entry.links[service] = cleaned
  entry.ranks[service] = rank
}

async function loadJustWatchCatalog() {
  const index = { byExact: new Map(), byYear: new Map() }
  for (const packageName of ['dnp', 'hlu']) {
    let after = null
    let page = 0
    while (page < 80) {
      const block = await justWatchPage(
        { packages: [packageName], objectTypes: ['MOVIE'] },
        after,
      )
      for (const edge of block?.edges || []) {
        const content = edge?.node?.content
        if (!content?.title) continue
        const year = Number(content.originalReleaseYear) || 0
        for (const offer of edge.node.offers || []) {
          const service = PACKAGE_SERVICE[offer?.package?.packageId]
          if (!service || !offer.standardWebURL) continue
          rememberOffer(
            index,
            content.title,
            year,
            service,
            offer.standardWebURL,
            offer.monetizationType,
          )
        }
      }
      page += 1
      console.log(
        `${packageName} page ${page}: ${index.byExact.size} titles / ${block?.totalCount ?? '?'}`,
      )
      if (!block?.pageInfo?.hasNextPage || !block.pageInfo.endCursor) break
      after = block.pageInfo.endCursor
    }
  }
  return index
}

function findCatalogEntry(index, title, year) {
  const exact = index.byExact.get(watchTitleKey(title, year))
  if (exact) return exact
  const candidates = []
  for (const candidateYear of [year, year - 1, year + 1]) {
    if (candidateYear <= 0) continue
    for (const entry of index.byYear.get(candidateYear) || []) {
      if (titlesCompatible(title, entry.title)) candidates.push(entry)
    }
  }
  candidates.sort((a, b) => {
    const yearDelta = Math.abs(a.year - year) - Math.abs(b.year - year)
    if (yearDelta !== 0) return yearDelta
    return normalizeTitle(a.title).length - normalizeTitle(b.title).length
  })
  return candidates[0] || null
}

async function allProviderMovies(apiKey, provider, service) {
  const base = {
    include_adult: 'false',
    include_video: 'false',
    sort_by: 'popularity.desc',
    watch_region: 'US',
    with_watch_monetization_types: 'flatrate',
    with_watch_providers: String(provider),
  }
  const first = await tmdb(apiKey, '/discover/movie', { ...base, page: 1 })
  const movies = []
  const take = (data) => {
    for (const item of data.results || []) {
      if (!item?.id || !item.title) continue
      const year = Number(String(item.release_date || '').slice(0, 4)) || 0
      movies.push({ id: String(item.id), title: item.title, year, service })
    }
  }
  take(first)
  const pages = []
  for (let page = 2; page <= (first.total_pages || 1); page += 1) pages.push(page)
  await mapPool(pages, 4, async (page) => {
    const data = await tmdb(apiKey, '/discover/movie', { ...base, page })
    take(data)
  })
  console.log(`${service} tmdb movies ${movies.length}`)
  return movies
}

async function refineDisneyUrls(pairs) {
  const byUrl = new Map()
  for (const pair of pairs) {
    if (!pair.url) continue
    if (!byUrl.has(pair.url)) byUrl.set(pair.url, pair.title)
  }
  const urls = [...byUrl.keys()]
  const refined = new Map()
  let done = 0
  await mapPool(urls, 6, async (url) => {
    const title = byUrl.get(url)
    try {
      const next = await refineDisneyLink(title, url, globalThis.fetch)
      refined.set(url, next || '')
    } catch {
      refined.set(url, url)
    }
    done += 1
    if (done % 100 === 0 || done === urls.length) {
      console.log(`disney pages ${done}/${urls.length}`)
    }
  })
  return refined
}

async function addDisneyAndHulu(file, apiKey) {
  const index = await loadJustWatchCatalog()
  const movies = [
    ...(await allProviderMovies(apiKey, 337, 'disney-plus')),
    ...(await allProviderMovies(apiKey, 15, 'hulu')),
  ]
  const byId = new Map()
  for (const movie of movies) {
    const existing = byId.get(movie.id)
    if (existing) {
      existing.services.add(movie.service)
      continue
    }
    byId.set(movie.id, { ...movie, services: new Set([movie.service]) })
  }

  const pendingSearch = []
  const disneyPairs = []
  let matched = 0
  for (const movie of byId.values()) {
    const entry = findCatalogEntry(index, movie.title, movie.year)
    const links = {}
    if (entry) {
      for (const service of movie.services) {
        if (entry.links[service]) links[service] = entry.links[service]
      }
    }
    const missing = [...movie.services].filter((service) => !links[service])
    if (missing.length > 0) {
      pendingSearch.push({ movie, links, missing })
      continue
    }
    matched += 1
    if (links['disney-plus']) {
      disneyPairs.push({ title: entry.title, url: links['disney-plus'], movie, links })
    } else if (storeLinks(file, movie, links)) {
      matched += 0
    }
    if (!links['disney-plus']) storeLinks(file, movie, links)
  }

  console.log(
    `catalog match ${matched}/${byId.size}, searching ${pendingSearch.length}`,
  )

  await mapPool(pendingSearch, 2, async (item) => {
    try {
      const result = await resolveWatchLinks({
        title: item.movie.title,
        year: item.movie.year || 0,
        tmdbId: item.movie.id,
        country: 'US',
        services: item.missing,
      })
      const links = { ...item.links, ...(result?.links || {}) }
      if (links['disney-plus']) {
        disneyPairs.push({
          title: item.movie.title,
          url: links['disney-plus'],
          movie: item.movie,
          links,
        })
        return
      }
      storeLinks(file, item.movie, links)
    } catch (error) {
      console.warn(
        `search failed ${item.movie.title}:`,
        error instanceof Error ? error.message : error,
      )
    }
  })

  const refined = await refineDisneyUrls(
    disneyPairs.map((pair) => ({ title: pair.title, url: pair.url })),
  )
  for (const pair of disneyPairs) {
    const next = refined.get(pair.url)
    const links = { ...pair.links }
    if (next) links['disney-plus'] = next
    else delete links['disney-plus']
    storeLinks(file, pair.movie, links)
  }

  const checks = [
    ['1266127', 'Ready or Not: Here I Come', 2026],
    ['88018', 'The Skeleton Dance', 1929],
    ['72640', 'The Old Mill', 1937],
  ]
  for (const [id, title, year] of checks) {
    const links = file.byId[id] || file.byTitle[watchTitleKey(title, year)]
    console.log(title, links ? JSON.stringify(links) : 'MISSING')
  }
}

async function resolveMovie(movie) {
  const result = await resolveWatchLinks(
    {
      title: movie.title,
      year: movie.year || 0,
      tmdbId: /^\d{1,10}$/.test(String(movie.id)) ? String(movie.id) : '',
      country: 'US',
      services: [],
    },
    {
      fetch: (url, options = {}) =>
        fetch(url, { ...options, signal: AbortSignal.timeout(15000) }),
    },
  )
  return result?.links || {}
}

async function main() {
  const apiKey = loadTmdbKey()
  const disneyHuluOnly = process.argv.includes('--disney-hulu')
  if (disneyHuluOnly) {
    const file = loadExistingFile()
    await addDisneyAndHulu(file, apiKey)
    fs.writeFileSync(outPath, `${JSON.stringify(file, null, 2)}\n`)
    console.log(
      `wrote ${outPath} ids ${Object.keys(file.byId).length} titles ${Object.keys(file.byTitle).length}`,
    )
    return
  }
  const movies = new Map()
  const curated = parseCurated()
  console.log(`curated ${curated.length}`)

  for (const movie of curated) {
    try {
      const hit = await findTmdb(apiKey, movie.title, movie.year)
      if (hit) {
        remember(movies, hit, movie.services[0])
        const entry = movies.get(String(hit.id))
        entry.pinned = true
        for (const service of movie.services) entry.services.add(service)
        movie.tmdbId = String(hit.id)
      }
    } catch (error) {
      console.warn(`search failed for ${movie.title}:`, error instanceof Error ? error.message : error)
    }
  }

  for (const [title, year] of PINNED) {
    try {
      const hit = await findTmdb(apiKey, title, year)
      if (!hit) {
        console.warn(`pinned miss ${title}`)
        continue
      }
      remember(movies, hit, null)
      movies.get(String(hit.id)).pinned = true
    } catch (error) {
      console.warn(`pinned search failed for ${title}:`, error instanceof Error ? error.message : error)
    }
  }

  const jobs = discoverJobs()
  console.log(`discover queries ${jobs.length}`)
  let discoverFailures = 0
  await mapPool(jobs, 4, async (job) => {
    try {
      const data = await tmdb(apiKey, '/discover/movie', {
        include_adult: 'false',
        include_video: 'false',
        sort_by: 'popularity.desc',
        watch_region: 'US',
        with_watch_monetization_types: 'flatrate',
        'vote_count.gte': '40',
        ...job.params,
      })
      for (const item of data.results || []) remember(movies, item, job.service)
    } catch (error) {
      discoverFailures += 1
      console.warn('discover failed:', error instanceof Error ? error.message : error)
    }
  })
  console.log(`candidates ${movies.size}, discover failures ${discoverFailures}`)

  const chosen = chooseMovies(movies)
  for (const movie of curated) {
    if (movie.tmdbId && movies.has(movie.tmdbId)) continue
    chosen.unshift(movie)
  }
  console.log(`resolving ${chosen.length}`)

  const file = loadExistingFile()
  let hits = 0
  await mapPool(chosen, 3, async (movie, index) => {
    try {
      const links = await resolveMovie(movie)
      if (storeLinks(file, movie, links)) hits += 1
    } catch (error) {
      console.warn(`resolve failed ${movie.title}:`, error instanceof Error ? error.message : error)
    }
    if ((index + 1) % 25 === 0 || index + 1 === chosen.length) {
      console.log(`progress ${index + 1}/${chosen.length} with links ${hits}`)
    }
  })

  await addDisneyAndHulu(file, apiKey)
  fs.writeFileSync(outPath, `${JSON.stringify(file, null, 2)}\n`)
  console.log(`wrote ${outPath} ids ${Object.keys(file.byId).length} titles ${Object.keys(file.byTitle).length}`)
  for (const [title, year] of PINNED) {
    const links = file.byTitle[watchTitleKey(title, year)]
    console.log(title, links ? JSON.stringify(links) : 'MISSING')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
