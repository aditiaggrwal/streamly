import assert from 'node:assert/strict'
import test from 'node:test'
import type { Movie, UserPreferences } from '../types'
import {
  advanceTonightLineup,
  fitsRuntimeBudget,
  recommendMovies,
  scoreMovie,
  TONIGHT_LINEUP_SIZE,
} from './recommend'

function movie(
  overrides: Partial<Movie> & Pick<Movie, 'title' | 'runtimeMinutes'>,
): Movie {
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

test('fitsRuntimeBudget is a no-op when Any length is selected', () => {
  assert.equal(
    fitsRuntimeBudget(movie({ title: 'Scarface', runtimeMinutes: 170 }), null),
    true,
  )
})

test('fitsRuntimeBudget keeps unknown runtimes', () => {
  assert.equal(
    fitsRuntimeBudget(movie({ title: 'Unknown', runtimeMinutes: 0 }), 90),
    true,
  )
})

test('90 minute stop keeps movies at or under 90 and drops longer known runtimes', () => {
  assert.equal(fitsRuntimeBudget(movie({ title: 'Short', runtimeMinutes: 90 }), 90), true)
  assert.equal(fitsRuntimeBudget(movie({ title: 'Long', runtimeMinutes: 91 }), 90), false)
  assert.equal(
    fitsRuntimeBudget(movie({ title: 'Green Book', runtimeMinutes: 130 }), 90),
    false,
  )
})

test('2 hour stop keeps movies at or under 120 and drops longer known runtimes', () => {
  assert.equal(fitsRuntimeBudget(movie({ title: 'Exact', runtimeMinutes: 120 }), 120), true)
  assert.equal(fitsRuntimeBudget(movie({ title: 'Over', runtimeMinutes: 121 }), 120), false)
  assert.equal(
    fitsRuntimeBudget(movie({ title: 'Frankenstein', runtimeMinutes: 150 }), 120),
    false,
  )
})

test('scoreMovie drops known over-budget titles and keeps unknown or in-budget ones', () => {
  const budget90 = prefs({ maxRuntimeMinutes: 90 })
  assert.equal(
    scoreMovie(movie({ title: 'Quiet Place', runtimeMinutes: 90 }), budget90)?.movie
      .title,
    'Quiet Place',
  )
  assert.equal(
    scoreMovie(movie({ title: 'Voicemails', runtimeMinutes: 119 }), budget90),
    null,
  )
  assert.equal(
    scoreMovie(movie({ title: 'Mystery', runtimeMinutes: 0 }), budget90)?.movie.title,
    'Mystery',
  )

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

  const twoHours = recommendMovies(prefs({ maxRuntimeMinutes: 120 }), {
    movies: catalog,
  })
  const twoHourTitles = twoHours.map((entry) => entry.movie.title)
  assert.ok(twoHourTitles.includes('Puss in Boots'))
  assert.ok(twoHourTitles.includes('Voicemails'))
  assert.ok(!twoHourTitles.includes('Green Book'))
  assert.ok(!twoHourTitles.includes('Scarface'))
  assert.ok(
    twoHours.every(
      (entry) =>
        entry.movie.runtimeMinutes <= 120 || entry.movie.runtimeMinutes === 0,
    ),
  )

  const anyLength = recommendMovies(prefs({ maxRuntimeMinutes: null }), {
    movies: catalog,
  })
  assert.equal(anyLength.length, catalog.length)
  assert.ok(anyLength.some((entry) => entry.movie.title === 'Scarface'))
})

test('Happy-only ranks live-action comedy ahead of animation', () => {
  const happyOnly = prefs()
  const comedy = scoreMovie(
    movie({
      title: 'The Intern',
      genres: ['comedy'],
      moods: ['happy'],
      rating: 7.4,
    }),
    happyOnly,
  )
  const pixar = scoreMovie(
    movie({
      title: 'Coco',
      genres: ['animation', 'family', 'comedy'],
      moods: ['happy'],
      rating: 8.4,
    }),
    happyOnly,
  )
  assert.ok(comedy && pixar)
  assert.ok(
    comedy.score > pixar.score,
    `expected live-action ${comedy.score} > animation ${pixar.score}`,
  )

  const withFamily = prefs({ genres: ['family'] })
  const pixarHappyOnly = pixar.score
  const pixarForFamily = scoreMovie(
    movie({
      title: 'Coco',
      genres: ['animation', 'family', 'comedy'],
      moods: ['happy'],
      rating: 8.4,
    }),
    withFamily,
  )
  assert.ok(pixarForFamily)
  assert.ok(
    pixarForFamily.score > pixarHappyOnly,
    'Family pick should stop down-ranking animation',
  )
})

test('Emotional + Nostalgic ranks live-action drama ahead of animation', () => {
  const combo = prefs({ moods: ['emotional', 'nostalgic'] })
  const drama = scoreMovie(
    movie({
      title: 'Good Will Hunting',
      year: 1997,
      genres: ['drama'],
      moods: ['emotional', 'nostalgic'],
      rating: 8.3,
    }),
    combo,
  )
  const pixar = scoreMovie(
    movie({
      title: 'Toy Story',
      year: 1995,
      genres: ['animation', 'family', 'comedy', 'adventure'],
      moods: ['nostalgic', 'happy'],
      rating: 8.3,
    }),
    combo,
  )
  assert.ok(drama && pixar)
  assert.ok(
    drama.score > pixar.score,
    `expected live-action ${drama.score} > animation ${pixar.score}`,
  )
})

test('New lineup deals 16 unseen titles before repeating', () => {
  const catalog = Array.from({ length: 40 }, (_, index) => ({
    movie: movie({
      id: `m-${index}`,
      title: `Title ${index}`,
      runtimeMinutes: 100,
      rating: 8 - index * 0.01,
    }),
    score: 80 - index,
    reasons: [],
  }))

  const first = catalog.slice(0, TONIGHT_LINEUP_SIZE).map((entry) => entry.movie.id)
  const second = advanceTonightLineup(catalog, first)
  const secondIds = second.movies.slice(0, TONIGHT_LINEUP_SIZE).map((entry) => entry.movie.id)

  assert.equal(secondIds.length, TONIGHT_LINEUP_SIZE)
  assert.equal(new Set(secondIds).size, TONIGHT_LINEUP_SIZE)
  assert.ok(secondIds.every((id) => !first.includes(id)))

  const third = advanceTonightLineup(second.movies, second.seenIds)
  const thirdIds = third.movies.slice(0, TONIGHT_LINEUP_SIZE).map((entry) => entry.movie.id)
  assert.ok(thirdIds.every((id) => !secondIds.includes(id)))
})
