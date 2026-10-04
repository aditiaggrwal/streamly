import assert from 'node:assert/strict'
import test from 'node:test'
import { CURATED_MOVIES } from '../data/movies'
import {
  applyCardFacts,
  mergeCardFacts,
  mergeCardFactsForPick,
  movieNeedsCardFacts,
} from './catalog'
import { tmdbRuntimeFilter, usContentRating } from './tmdb'
import type { Movie, ScoredMovie } from '../types'

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

function scored(movie: Movie): ScoredMovie {
  return { movie, score: 1, reasons: ['test'] }
}

test('mergeCardFacts drops titles once a known runtime exceeds the budget', () => {
  const short = scored({ ...parasite, id: 'short', title: 'Short', runtimeMinutes: 0 })
  const long = scored({ ...parasite, id: 'long', title: 'Long', runtimeMinutes: 0 })
  const unknown = scored({ ...parasite, id: 'unknown', title: 'Unknown', runtimeMinutes: 0 })
  const facts = new Map([
    ['short', { contentRating: 'PG', runtimeMinutes: 90 }],
    ['long', { contentRating: 'R', runtimeMinutes: 130 }],
  ])

  const next = mergeCardFacts([short, long, unknown], facts, 90)
  assert.deepEqual(
    next.map((entry) => entry.movie.title),
    ['Short', 'Unknown'],
  )
  assert.equal(next[0].movie.runtimeMinutes, 90)
  assert.equal(next[1].movie.runtimeMinutes, 0)
})

test('mergeCardFacts keeps every title when Any length is selected', () => {
  const long = scored({ ...parasite, runtimeMinutes: 176 })
  const facts = new Map([
    [parasite.id, { contentRating: 'R', runtimeMinutes: 176 }],
  ])
  const next = mergeCardFacts([long], facts, null)
  assert.equal(next.length, 1)
  assert.equal(next[0].movie.runtimeMinutes, 176)
})

test('mergeCardFactsForPick hides a detail card that overshoots the budget', () => {
  const pick = scored({ ...parasite, runtimeMinutes: 0 })
  const over = mergeCardFactsForPick(
    pick,
    new Map([[parasite.id, { contentRating: 'R', runtimeMinutes: 132 }]]),
    90,
  )
  assert.equal(over, null)

  const unknown = mergeCardFactsForPick(pick, new Map(), 90)
  assert.equal(unknown, pick)
})

test('tmdbRuntimeFilter asks discover for a hard runtime ceiling', () => {
  assert.deepEqual(tmdbRuntimeFilter(90), { 'with_runtime.lte': '90' })
  assert.deepEqual(tmdbRuntimeFilter(120), { 'with_runtime.lte': '120' })
  assert.deepEqual(tmdbRuntimeFilter(null), {})
})
