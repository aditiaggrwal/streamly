import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { resolveWatchLinks, normalizeTitle } = require('../functions/watchLinks.js')

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
  file.byId[String(movie.id)] = usable
  if (movie.tmdbId) file.byId[String(movie.tmdbId)] = usable
  const titleKey = watchTitleKey(movie.title, movie.year)
  if (titleKey && !titleKey.startsWith('|')) file.byTitle[titleKey] = usable
  return true
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

  const file = emptyFile()
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
