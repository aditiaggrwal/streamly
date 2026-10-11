import assert from 'node:assert/strict'
import test from 'node:test'
import { CURATED_MOVIES } from '../data/movies'
import { applyCardFacts, movieNeedsCardFacts } from './catalog'
import {
  prefsCacheKey,
  runtimeCacheToken,
  serviceDiscoverKey,
  tmdbRuntimeFilter,
  usContentRating,
} from './tmdb'

const parasite = CURATED_MOVIES[0]

test('curated movies need a US rating chip but already have runtime', () => {
  assert.equal(movieNeedsCardFacts(parasite), true)
  assert.ok(parasite.runtimeMinutes > 0)
})

test('applyCardFacts fills rating and keeps existing runtime', () => {
  const next = applyCardFacts(parasite, {
    contentRating: ' R ',
    runtimeMinutes: 0,
  })
  assert.equal(next.contentRating, 'R')
  assert.equal(next.runtimeMinutes, parasite.runtimeMinutes)
  assert.notEqual(next, parasite)
})

test('applyCardFacts ignores zero runtime and blank rating', () => {
  const movie = { ...parasite, contentRating: 'PG-13' }
  const next = applyCardFacts(movie, { contentRating: '  ', runtimeMinutes: 0 })
  assert.equal(next, movie)
})

test('usContentRating prefers US theatrical certification', () => {
  const rating = usContentRating({
    results: [
      {
        iso_3166_1: 'US',
        release_dates: [
          { certification: 'NR', type: 1 },
          { certification: 'R', type: 3 },
        ],
      },
    ],
  })
  assert.equal(rating, 'R')
})

test('usContentRating hides missing US certs', () => {
  assert.equal(usContentRating({ results: [] }), undefined)
  assert.equal(
    usContentRating({
      results: [{ iso_3166_1: 'US', release_dates: [{ certification: '  ' }] }],
    }),
    undefined,
  )
})

test('tmdbRuntimeFilter asks discover for a hard runtime ceiling', () => {
  assert.deepEqual(tmdbRuntimeFilter(90), { 'with_runtime.lte': '90' })
  assert.deepEqual(tmdbRuntimeFilter(120), { 'with_runtime.lte': '120' })
  assert.deepEqual(tmdbRuntimeFilter(null), {})
})

test('discover and prefetch cache keys include the chosen time stop', () => {
  const base = {
    moods: ['happy' as const],
    genres: [],
    streamingServices: ['netflix' as const],
    familyFriendly: false,
  }
  assert.equal(runtimeCacheToken(90), '90')
  assert.equal(runtimeCacheToken(120), '120')
  assert.equal(runtimeCacheToken(null), 'any-length')

  const ninety = prefsCacheKey({ ...base, maxRuntimeMinutes: 90 })
  const twoHours = prefsCacheKey({ ...base, maxRuntimeMinutes: 120 })
  const anyLength = prefsCacheKey({ ...base, maxRuntimeMinutes: null })
  assert.notEqual(ninety, twoHours)
  assert.notEqual(ninety, anyLength)
  assert.match(ninety, /\|90$/)
  assert.match(twoHours, /\|120$/)
  assert.match(anyLength, /\|any-length$/)

  const serviceNinety = serviceDiscoverKey('netflix', {
    ...base,
    maxRuntimeMinutes: 90,
  })
  const serviceAny = serviceDiscoverKey('netflix', {
    ...base,
    maxRuntimeMinutes: null,
  })
  assert.notEqual(serviceNinety, serviceAny)
  assert.match(serviceNinety, /\|90$/)
  assert.match(serviceAny, /\|any-length$/)
})
