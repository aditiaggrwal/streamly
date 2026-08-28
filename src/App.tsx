import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GenrePicker } from './components/GenrePicker'
import {
  EmptyResult,
  LoadingResult,
  MovieResult,
} from './components/MovieResult'
import { MoodPicker } from './components/MoodPicker'
import { StreamingPicker } from './components/StreamingPicker'
import { CURATED_MOVIES } from './data/movies'
import {
  confirmPick,
  loadCatalog,
  type CatalogSource,
} from './lib/catalog'
import { getMatchCount, pickMovie } from './lib/recommend'
import {
  clearStreamingServices,
  loadStreamingServices,
  saveStreamingServices,
} from './lib/storage'
import { isTmdbConfigured } from './lib/tmdb'
import type {
  GenreId,
  MoodId,
  Movie,
  ScoredMovie,
  StreamingServiceId,
} from './types'

type AppView = 'form' | 'result'

const CATALOG_DEBOUNCE_MS = 350

function App() {
  const [view, setView] = useState<AppView>('form')
  const [moods, setMoods] = useState<MoodId[]>([])
  const [genres, setGenres] = useState<GenreId[]>([])
  const [familyFriendly, setFamilyFriendly] = useState(false)
  const [streamingServices, setStreamingServices] = useState<
    StreamingServiceId[]
  >([])
  const [result, setResult] = useState<ScoredMovie | null>(null)
  const [seenIds, setSeenIds] = useState<string[]>([])
  const [catalog, setCatalog] = useState<Movie[]>(CURATED_MOVIES)
  const [catalogSource, setCatalogSource] = useState<CatalogSource>('curated')
  const [catalogStatus, setCatalogStatus] = useState<
    'idle' | 'loading' | 'ready'
  >('idle')
  const [finding, setFinding] = useState(false)

  const pendingFind = useRef(false)
  const pickRequest = useRef(0)

  useEffect(() => {
    setStreamingServices(loadStreamingServices())
  }, [])

  useEffect(() => {
    saveStreamingServices(streamingServices)
  }, [streamingServices])

  const preferences = useMemo(
    () => ({ moods, genres, streamingServices, familyFriendly }),
    [moods, genres, streamingServices, familyFriendly],
  )

  const canSubmit = moods.length > 0 && streamingServices.length > 0

  useEffect(() => {
    if (!canSubmit) {
      setCatalog(CURATED_MOVIES)
      setCatalogSource('curated')
      setCatalogStatus('idle')
      return
    }

    if (!isTmdbConfigured()) {
      setCatalog(CURATED_MOVIES)
      setCatalogSource('curated')
      setCatalogStatus('ready')
      return
    }

    const controller = new AbortController()
    setCatalogStatus('loading')
    const timer = window.setTimeout(() => {
      void loadCatalog(preferences, controller.signal)
        .then((loaded) => {
          if (controller.signal.aborted) return
          setCatalog(loaded.movies)
          setCatalogSource(loaded.source)
          setCatalogStatus('ready')
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setCatalog(CURATED_MOVIES)
          setCatalogSource('curated-fallback')
          setCatalogStatus('ready')
        })
    }, CATALOG_DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [preferences, canSubmit])

  const matchCount = useMemo(
    () => getMatchCount(preferences, catalog),
    [preferences, catalog],
  )

  function getSubmitLabel(): string {
    if (moods.length === 0) return 'Pick a mood to continue'
    if (streamingServices.length === 0) return 'Select a streaming service'
    if (catalogStatus === 'loading') return 'Searching the catalog…'
    return 'Find my movie'
  }

  const applyPick = useCallback(
    async (excludeIds: string[], resetSeen: boolean) => {
      const requestId = pickRequest.current + 1
      pickRequest.current = requestId
      setFinding(true)
      try {
        let skip = excludeIds
        let pick = pickMovie(preferences, skip, catalog)
        if (!pick && skip.length > 0) {
          skip = []
          pick = pickMovie(preferences, skip, catalog)
          resetSeen = true
        }
        if (!pick) {
          if (pickRequest.current !== requestId) return
          setResult(null)
          if (resetSeen) setSeenIds([])
          return
        }

        const confirmed =
          catalogSource === 'tmdb'
            ? await confirmPick(pick, preferences, catalog, skip)
            : pick

        if (pickRequest.current !== requestId) return

        setResult(confirmed)
        if (confirmed) {
          setSeenIds(
            resetSeen
              ? [confirmed.movie.id]
              : [...skip, confirmed.movie.id].filter(
                  (id, index, ids) => ids.indexOf(id) === index,
                ),
          )
        } else if (resetSeen) {
          setSeenIds([])
        }
      } finally {
        if (pickRequest.current === requestId) setFinding(false)
      }
    },
    [catalog, catalogSource, preferences],
  )

  useEffect(() => {
    if (!pendingFind.current) return
    if (catalogStatus !== 'ready' || view !== 'result') return
    pendingFind.current = false
    void applyPick([], true)
  }, [applyPick, catalogStatus, view])

  function handleFindMovie() {
    if (!canSubmit) return
    setResult(null)
    setSeenIds([])
    setView('result')
    if (catalogStatus !== 'ready') {
      pendingFind.current = true
      return
    }
    void applyPick([], true)
  }

  function handleShuffle() {
    if (finding) return
    void applyPick(seenIds, false)
  }

  function handleReset() {
    pendingFind.current = false
    pickRequest.current += 1
    setFinding(false)
    setView('form')
    setResult(null)
    setSeenIds([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleFullReset() {
    pendingFind.current = false
    pickRequest.current += 1
    setFinding(false)
    setMoods([])
    setGenres([])
    setFamilyFriendly(false)
    setStreamingServices([])
    clearStreamingServices()
    setView('form')
    setResult(null)
    setSeenIds([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasSelections =
    moods.length > 0 ||
    genres.length > 0 ||
    familyFriendly ||
    streamingServices.length > 0

  const showResetAll = hasSelections || view === 'result'
  const showResultLoading =
    view === 'result' && !result && (catalogStatus !== 'ready' || finding)

  function footerCopy(): string {
    if (catalogSource === 'tmdb') {
      return 'Catalog and posters from TMDB. Watch data from JustWatch. This product uses the TMDB API but is not endorsed or certified by TMDB.'
    }
    if (catalogSource === 'curated-fallback') {
      return 'TMDB is unavailable — showing curated picks. This product uses the TMDB API but is not endorsed or certified by TMDB.'
    }
    if (isTmdbConfigured()) {
      return 'Live catalog via TMDB. Watch data from JustWatch. This product uses the TMDB API but is not endorsed or certified by TMDB.'
    }
    return 'Showing curated picks — add a TMDB API key for a live catalog.'
  }

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
            <GenrePicker
              selected={genres}
              onChange={setGenres}
              familyFriendly={familyFriendly}
              onFamilyFriendlyChange={setFamilyFriendly}
            />
            <StreamingPicker
              selected={streamingServices}
              onChange={setStreamingServices}
            />
          </>
        ) : result ? (
          <MovieResult
            result={result}
            matchCount={matchCount}
            busy={finding}
            onShuffle={handleShuffle}
            onReset={handleReset}
          />
        ) : showResultLoading ? (
          <LoadingResult />
        ) : (
          <EmptyResult onReset={handleReset} />
        )}
      </main>

      {view === 'form' && (
        <div className="submit-bar">
          <div className="submit-bar-inner">
            {canSubmit && catalogStatus === 'loading' && (
              <p className="submit-bar-status">Searching the catalog…</p>
            )}
            {canSubmit && catalogStatus === 'ready' && matchCount > 0 && (
              <p className="submit-bar-status success">
                {matchCount} possible {matchCount === 1 ? 'match' : 'matches'}
              </p>
            )}
            {canSubmit && catalogStatus === 'ready' && matchCount === 0 && (
              <p className="submit-bar-status warn">
                {familyFriendly
                  ? 'No matches — try more services, fewer genres, or turn off Family friendly'
                  : 'No matches — try more services or fewer genres'}
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
        <p>{footerCopy()}</p>
      </footer>
    </div>
  )
}

export default App
