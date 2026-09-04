import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GenrePicker } from './components/GenrePicker'
import {
  EmptyResult,
  LoadingResult,
  ResultsView,
} from './components/MovieResult'
import { MoodPicker } from './components/MoodPicker'
import { StreamingPicker } from './components/StreamingPicker'
import { CURATED_MOVIES } from './data/movies'
import {
  applyCardFacts,
  enrichMoviesForCards,
  enrichPick,
  loadCatalog,
  movieNeedsCardFacts,
  type CatalogSource,
} from './lib/catalog'
import { getMatchCount, recommendMovies } from './lib/recommend'
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

type WizardStep = 'mood' | 'genre' | 'services' | 'result'

const STEPS: WizardStep[] = ['mood', 'genre', 'services', 'result']
const CATALOG_DEBOUNCE_MS = 350

function App() {
  const [step, setStep] = useState<WizardStep>('mood')
  const [moods, setMoods] = useState<MoodId[]>([])
  const [genres, setGenres] = useState<GenreId[]>([])
  const [familyFriendly, setFamilyFriendly] = useState(false)
  const [streamingServices, setStreamingServices] = useState<
    StreamingServiceId[]
  >(() => loadStreamingServices())
  const [resultMovies, setResultMovies] = useState<ScoredMovie[]>([])
  const [stripFocusIndex, setStripFocusIndex] = useState(0)
  const [detailPick, setDetailPick] = useState<ScoredMovie | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [catalog, setCatalog] = useState<Movie[]>(CURATED_MOVIES)
  const [catalogSource, setCatalogSource] = useState<CatalogSource>('curated')
  const [catalogStatus, setCatalogStatus] = useState<
    'idle' | 'loading' | 'ready'
  >('idle')

  const pendingFind = useRef(false)

  function clearResults() {
    setResultMovies([])
    setStripFocusIndex(0)
    setDetailPick(null)
    setDetailLoading(false)
  }

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

  const loadResults = useCallback(() => {
    const matches = recommendMovies(preferences, { movies: catalog })
    setResultMovies(matches)
    setStripFocusIndex(0)
    setDetailPick(null)
  }, [catalog, preferences])

  useEffect(() => {
    if (step !== 'result' || catalogSource !== 'tmdb') return
    if (resultMovies.length === 0) return

    const windowStart = Math.max(0, stripFocusIndex - 2)
    const windowEnd = Math.min(resultMovies.length, stripFocusIndex + 10)
    const visible = resultMovies.slice(windowStart, windowEnd)
    if (!visible.some((pick) => movieNeedsCardFacts(pick.movie))) return

    let cancelled = false
    void enrichMoviesForCards(visible.map((pick) => pick.movie)).then(
      (facts) => {
        if (cancelled || facts.size === 0) return

        setResultMovies((prev) => {
          let changed = false
          const next = prev.map((entry) => {
            const update = facts.get(entry.movie.id)
            if (!update) return entry
            const movie = applyCardFacts(entry.movie, update)
            if (movie === entry.movie) return entry
            changed = true
            return { ...entry, movie }
          })
          return changed ? next : prev
        })

        setDetailPick((prev) => {
          if (!prev) return prev
          const update = facts.get(prev.movie.id)
          if (!update) return prev
          const movie = applyCardFacts(prev.movie, update)
          if (movie === prev.movie) return prev
          return { ...prev, movie }
        })
      },
    )

    return () => {
      cancelled = true
    }
  }, [catalogSource, resultMovies, step, stripFocusIndex])

  useEffect(() => {
    if (!pendingFind.current) return
    if (catalogStatus !== 'ready' || step !== 'result') return
    pendingFind.current = false
    loadResults()
  }, [catalogStatus, loadResults, step])

  function handleFindMovie() {
    if (!canSubmit) return
    clearResults()
    setStep('result')
    if (catalogStatus !== 'ready') {
      pendingFind.current = true
      return
    }
    loadResults()
  }

  async function handleSelectMovie(pick: ScoredMovie) {
    setDetailPick(pick)
    if (catalogSource !== 'tmdb') return

    setDetailLoading(true)
    try {
      const enriched = await enrichPick(pick, preferences)
      if (enriched) {
        setDetailPick(enriched)
        setResultMovies((prev) => {
          let changed = false
          const next = prev.map((entry) => {
            if (entry.movie.id !== enriched.movie.id) return entry
            const movie = applyCardFacts(entry.movie, enriched.movie)
            if (movie === entry.movie) return entry
            changed = true
            return { ...entry, movie }
          })
          return changed ? next : prev
        })
      }
    } finally {
      setDetailLoading(false)
    }
  }

  function handleCloseDetail() {
    setDetailPick(null)
    setDetailLoading(false)
  }

  function handleBackFromResult() {
    pendingFind.current = false
    clearResults()
    setStep('services')
  }

  function handleFullReset() {
    pendingFind.current = false
    setMoods([])
    setGenres([])
    setFamilyFriendly(false)
    setStreamingServices([])
    clearStreamingServices()
    setStep('mood')
    clearResults()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const stepIndex = STEPS.indexOf(step)
  const showReset =
    moods.length > 0 ||
    genres.length > 0 ||
    familyFriendly ||
    streamingServices.length > 0 ||
    step === 'result'

  const showResultLoading =
    step === 'result' &&
    resultMovies.length === 0 &&
    (catalogStatus !== 'ready' || pendingFind.current)

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

  function nextLabel(): string {
    if (step === 'mood') {
      return moods.length === 0
        ? 'Pick a mood to continue'
        : 'Next: pick a genre →'
    }
    if (step === 'genre') {
      return genres.length === 0 && !familyFriendly
        ? 'Skip — any genre works →'
        : 'Next: your services →'
    }
    if (catalogStatus === 'loading') return 'Searching the catalog…'
    if (streamingServices.length === 0) return 'Select a service to continue'
    if (canSubmit && catalogStatus === 'ready' && matchCount === 0) {
      return 'No matches — adjust filters'
    }
    return "Find tonight's movie 🎬"
  }

  const nextDisabled =
    (step === 'mood' && moods.length === 0) ||
    (step === 'services' &&
      (streamingServices.length === 0 ||
        (catalogStatus === 'ready' && matchCount === 0)))

  function handleNext() {
    if (step === 'mood' && moods.length > 0) setStep('genre')
    else if (step === 'genre') setStep('services')
    else if (step === 'services') handleFindMovie()
  }

  function handleBack() {
    if (step === 'genre') setStep('mood')
    else if (step === 'services') setStep('genre')
    else if (step === 'result') handleBackFromResult()
  }

  return (
    <div
      className={`app${step === 'result' ? ' app-wide app-results' : ''}`}
    >
      <header className="hero">
        {step === 'result' ? (
          <>
            <div className="eyebrow results-eyebrow">
              <span>Your lineup</span>
            </div>
            <h1>Tonight&apos;s picks</h1>
            <p className="sub results-sub">
              {resultMovies.length > 0
                ? `${resultMovies.length} ${resultMovies.length === 1 ? 'movie' : 'movies'} matched your mood — choose one and start watching.`
                : showResultLoading
                  ? 'Searching the catalog for movies you can watch right now…'
                  : 'Adjust your filters to discover more matches.'}
            </p>
          </>
        ) : (
          <>
            <div className="eyebrow">
              <span>Streamly</span>
            </div>
            <h1>What should you watch tonight?</h1>
            <p className="sub">
              Tell us your mood, genre, and streaming subscriptions — we&apos;ll
              pick a movie you can actually start right now.
            </p>
          </>
        )}
      </header>

      {showReset && (
        <div className="toolbar">
          <button
            type="button"
            className="btn-text"
            onClick={handleFullReset}
          >
            Reset all
          </button>
        </div>
      )}

      <div
        className={step === 'result' ? 'results-complete-bar' : 'progress'}
        aria-hidden="true"
      >
        {step === 'result' ? (
          <span className="results-complete-label">Ready to watch</span>
        ) : (
          STEPS.map((name, index) => {
            let cls = 'sprocket'
            if (index < stepIndex) cls += ' done'
            if (index === stepIndex) cls += ' active'
            return <div key={name} className={cls} />
          })
        )}
      </div>

      <main
        className={`stage${step === 'result' ? ' stage-results' : ' stage-wizard'}`}
      >
        {step === 'mood' && (
          <MoodPicker selected={moods} onChange={setMoods} />
        )}
        {step === 'genre' && (
          <GenrePicker
            selected={genres}
            onChange={setGenres}
            familyFriendly={familyFriendly}
            onFamilyFriendlyChange={setFamilyFriendly}
          />
        )}
        {step === 'services' && (
          <>
            <StreamingPicker
              selected={streamingServices}
              onChange={setStreamingServices}
            />
            {canSubmit && catalogStatus === 'ready' && matchCount > 0 && (
              <p className="counter match-ready">
                {matchCount} possible{' '}
                {matchCount === 1 ? 'match' : 'matches'} ready.
              </p>
            )}
            {canSubmit && catalogStatus === 'ready' && matchCount === 0 && (
              <p className="counter match-empty">
                {familyFriendly
                  ? 'No matches — try more services, fewer genres, or turn off Family friendly.'
                  : 'No matches — try more services or fewer genres.'}
              </p>
            )}
            {canSubmit && catalogStatus === 'loading' && (
              <p className="counter">Searching the catalog…</p>
            )}
          </>
        )}
        {step === 'result' &&
          (resultMovies.length > 0 ? (
            <ResultsView
              movies={resultMovies}
              selected={detailPick}
              detailLoading={detailLoading}
              moods={moods}
              genres={genres}
              onSelect={handleSelectMovie}
              onCloseDetail={handleCloseDetail}
              onFocusIndexChange={setStripFocusIndex}
              onBack={handleBackFromResult}
            />
          ) : showResultLoading ? (
            <LoadingResult />
          ) : (
            <EmptyResult onReset={handleBackFromResult} />
          ))}

        {step !== 'result' && (
          <div className={`navrow${step === 'mood' ? ' navrow-full' : ''}`}>
            {step !== 'mood' && (
              <button
                type="button"
                className="btn btn-back"
                onClick={handleBack}
              >
                Back
              </button>
            )}
            <button
              type="button"
              className="btn btn-next"
              onClick={handleNext}
              disabled={nextDisabled}
            >
              {nextLabel()}
            </button>
          </div>
        )}
      </main>

      <footer className="footer">
        <p className="attribution">{footerCopy()}</p>
      </footer>
    </div>
  )
}

export default App
