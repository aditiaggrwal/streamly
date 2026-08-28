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

  function getSubmitLabel(): string {
    if (moods.length === 0) return 'Pick a mood to continue'
    if (streamingServices.length === 0) return 'Select a streaming service'
    return 'Find my movie'
  }

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
    <div className={`app${view === 'form' ? ' app--form' : ''}`}>
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

      {view === 'form' && (
        <div className="submit-bar">
          <div className="submit-bar-inner">
            {canSubmit && matchCount > 0 && (
              <p className="submit-bar-status success">
                {matchCount} possible {matchCount === 1 ? 'match' : 'matches'}
              </p>
            )}
            {canSubmit && matchCount === 0 && (
              <p className="submit-bar-status warn">
                No matches — try more services or fewer genres
              </p>
            )}
            <button
              type="button"
              className="btn primary submit-bar-btn"
              disabled={!canSubmit}
              onClick={handleFindMovie}
            >
              {getSubmitLabel()}
            </button>
          </div>
        </div>
      )}

      <footer className="footer">
        <p>Curated picks for now — a bigger catalog is on the way.</p>
      </footer>
    </div>
  )
}

export default App
