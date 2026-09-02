import assert from 'node:assert/strict'
import test from 'node:test'
import { CURATED_MOVIES } from '../data/movies'
import { applyCardFacts, movieNeedsCardFacts } from './catalog'
import { usContentRating } from './tmdb'

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
