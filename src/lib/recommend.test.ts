import assert from 'node:assert/strict'
import test from 'node:test'
import type { Movie, UserPreferences } from '../types'
import {
  exceedsRuntimeBudget,
  recommendMovies,
  scoreMovie,
} from './recommend'

function movie(overrides: Partial<Movie> & Pick<Movie, 'title' | 'runtimeMinutes'>): Movie {
  return {
    id: overrides.id ?? overrides.title.toLowerCase().replace(/\s+/g, '-'),
    year: 2020,
    overview: 'Test synopsis.',
    genres: ['comedy'],
    moods: ['happy'],
    streamingServices: ['netflix'],
    rating: 7.4,
    accent: '#000',
    ...overrides,
  }
}

function prefs(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    moods: ['happy'],
    genres: [],
    streamingServices: ['netflix'],
    familyFriendly: false,
    maxRuntimeMinutes: null,
    ...overrides,
  }
}

test('exceedsRuntimeBudget is a no-op when Any length is selected', () => {
  assert.equal(exceedsRuntimeBudget(movie({ title: 'Scarface', runtimeMinutes: 170 }), null), false)
})

test('exceedsRuntimeBudget keeps unknown runtimes', () => {
  assert.equal(
    exceedsRuntimeBudget(movie({ title: 'Unknown', runtimeMinutes: 0 }), 90),
    false,
  )
})

test('90 minute stop keeps movies at or under 90 and drops longer known runtimes', () => {
  assert.equal(exceedsRuntimeBudget(movie({ title: 'Short', runtimeMinutes: 90 }), 90), false)
  assert.equal(exceedsRuntimeBudget(movie({ title: 'Long', runtimeMinutes: 91 }), 90), true)
  assert.equal(
    exceedsRuntimeBudget(movie({ title: 'Green Book', runtimeMinutes: 130 }), 90),
    true,
  )
})

test('2 hour stop keeps movies at or under 120 and drops longer known runtimes', () => {
  assert.equal(exceedsRuntimeBudget(movie({ title: 'Exact', runtimeMinutes: 120 }), 120), false)
  assert.equal(exceedsRuntimeBudget(movie({ title: 'Over', runtimeMinutes: 121 }), 120), true)
  assert.equal(
    exceedsRuntimeBudget(movie({ title: 'Frankenstein', runtimeMinutes: 150 }), 120),
    true,
  )
})

test('scoreMovie drops known over-budget titles and keeps unknown or in-budget ones', () => {
  const budget90 = prefs({ maxRuntimeMinutes: 90 })
  assert.equal(scoreMovie(movie({ title: 'Quiet Place', runtimeMinutes: 90 }), budget90)?.movie.title, 'Quiet Place')
  assert.equal(scoreMovie(movie({ title: 'Voicemails', runtimeMinutes: 119 }), budget90), null)
  assert.equal(scoreMovie(movie({ title: 'Mystery', runtimeMinutes: 0 }), budget90)?.movie.title, 'Mystery')

  const anyLength = prefs({ maxRuntimeMinutes: null })
  assert.ok(scoreMovie(movie({ title: 'Scarface', runtimeMinutes: 170 }), anyLength))
})

test('recommendMovies never returns a known runtime over the chosen stop', () => {
  const catalog = [
    movie({ title: 'A Quiet Place', runtimeMinutes: 90 }),
    movie({ title: 'Puss in Boots', runtimeMinutes: 103 }),
    movie({ title: 'Green Book', runtimeMinutes: 130 }),
    movie({ title: 'Voicemails', runtimeMinutes: 119 }),
    movie({ title: 'Untitled', runtimeMinutes: 0 }),
    movie({ title: 'Scarface', runtimeMinutes: 170 }),
    movie({ title: 'The Menu', runtimeMinutes: 107 }),
    movie({ title: 'Coco', runtimeMinutes: 105 }),
  ]

  const ninety = recommendMovies(prefs({ maxRuntimeMinutes: 90 }), { movies: catalog })
  assert.deepEqual(
    ninety.map((entry) => entry.movie.title).sort(),
    ['A Quiet Place', 'Untitled'],
  )
  assert.ok(ninety.every((entry) => entry.movie.runtimeMinutes <= 90 || entry.movie.runtimeMinutes === 0))

  const twoHours = recommendMovies(prefs({ maxRuntimeMinutes: 120 }), { movies: catalog })
  const twoHourTitles = twoHours.map((entry) => entry.movie.title)
  assert.ok(twoHourTitles.includes('A Quiet Place'))
  assert.ok(twoHourTitles.includes('Puss in Boots'))
  assert.ok(twoHourTitles.includes('Voicemails'))
  assert.ok(twoHourTitles.includes('Untitled'))
  assert.ok(!twoHourTitles.includes('Green Book'))
  assert.ok(!twoHourTitles.includes('Scarface'))
  assert.ok(
    twoHours.every(
      (entry) => entry.movie.runtimeMinutes <= 120 || entry.movie.runtimeMinutes === 0,
    ),
  )

  const anyLength = recommendMovies(prefs({ maxRuntimeMinutes: null }), { movies: catalog })
  assert.equal(anyLength.length, catalog.length)
  assert.ok(anyLength.some((entry) => entry.movie.title === 'Scarface'))
})
