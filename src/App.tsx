import { useEffect, useMemo, useState } from 'react'
import { GenrePicker } from './components/GenrePicker'
import { EmptyResult, MovieResult } from './components/MovieResult'
import { MoodPicker } from './components/MoodPicker'
import { StreamingPicker } from './components/StreamingPicker'
import { getMatchCount, pickMovie } from './lib/recommend'
import {
  clearStreamingServices,
  loadStreamingServices,
  saveStreamingServices,
} from './lib/storage'
import type { GenreId, MoodId, ScoredMovie, StreamingServiceId } from './types'

type AppView = 'form' | 'result'

function App() {
  const [view, setView] = useState<AppView>('form')
  const [moods, setMoods] = useState<MoodId[]>([])
  const [genres, setGenres] = useState<GenreId[]>([])
  const [streamingServices, setStreamingServices] = useState<
    StreamingServiceId[]
  >([])
  const [result, setResult] = useState<ScoredMovie | null>(null)
  const [seenIds, setSeenIds] = useState<string[]>([])

  useEffect(() => {
    setStreamingServices(loadStreamingServices())
  }, [])

  useEffect(() => {
    saveStreamingServices(streamingServices)
  }, [streamingServices])

  const preferences = useMemo(
    () => ({ moods, genres, streamingServices }),
    [moods, genres, streamingServices],
  )

  const matchCount = useMemo(
    () => getMatchCount(preferences),
    [preferences],
  )

  const canSubmit = moods.length > 0 && streamingServices.length > 0

  function handleFindMovie() {
    if (!canSubmit) return
    const pick = pickMovie(preferences)
    setResult(pick)
    setSeenIds(pick ? [pick.movie.id] : [])
    setView('result')
  }

  function handleShuffle() {
    const pick = pickMovie(preferences, seenIds)
    if (pick) {
      setResult(pick)
      setSeenIds((prev) => [...prev, pick.movie.id])
    }
  }

  function handleReset() {
    setView('form')
    setResult(null)
    setSeenIds([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleFullReset() {
    setMoods([])
    setGenres([])
    setStreamingServices([])
    clearStreamingServices()
    setView('form')
    setResult(null)
    setSeenIds([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasSelections =
    moods.length > 0 || genres.length > 0 || streamingServices.length > 0

  const showResetAll = hasSelections || view === 'result'

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-badge">Streamly</div>
        <h1>What should you watch tonight?</h1>
        <p>
          Tell us your mood, genre, and streaming subscriptions — we&apos;ll
          pick a movie you can actually start right now.
        </p>
      </header>

      {showResetAll && (
        <div className="toolbar">
          <button
            type="button"
            className="btn ghost btn-sm"
            onClick={handleFullReset}
          >
            Reset all filters
          </button>
        </div>
      )}

      <main>
        {view === 'form' ? (
          <>
            <MoodPicker selected={moods} onChange={setMoods} />
            <GenrePicker selected={genres} onChange={setGenres} />
            <StreamingPicker
              selected={streamingServices}
              onChange={setStreamingServices}
            />

            <div className="submit-row">
              <button
                type="button"
                className="btn primary"
                disabled={!canSubmit}
                onClick={handleFindMovie}
              >
                Find my movie
              </button>
              {moods.length === 0 && (
                <p className="hint">Select at least one mood to continue.</p>
              )}
              {moods.length > 0 && streamingServices.length === 0 && (
                <p className="hint">Select at least one streaming service.</p>
              )}
              {canSubmit && matchCount > 0 && (
                <p className="hint success">
                  {matchCount} possible {matchCount === 1 ? 'match' : 'matches'}{' '}
                  with your filters
                </p>
              )}
              {canSubmit && matchCount === 0 && (
                <p className="hint warn">
                  No matches yet — try more services or fewer genres.
                </p>
              )}
            </div>
          </>
        ) : result ? (
          <MovieResult
            result={result}
            matchCount={matchCount}
            onShuffle={handleShuffle}
            onReset={handleReset}
          />
        ) : (
          <EmptyResult onReset={handleReset} />
        )}
      </main>

      <footer className="footer">
        <p>
          Curated catalog for now — TMDB live search can plug in later via{' '}
          <code>VITE_TMDB_API_KEY</code>.
        </p>
      </footer>
    </div>
  )
}

export default App
