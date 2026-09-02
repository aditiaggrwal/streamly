import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GenrePicker } from './components/GenrePicker'
import {
  EmptyResult,
  LoadingResult,
  RESULTS_PAGE_SIZE,
  ResultsView,
} from './components/MovieResult'
import { MoodPicker } from './components/MoodPicker'
import { StreamingPicker } from './components/StreamingPicker'
import { CURATED_MOVIES } from './data/movies'
import {
  enrichPick,
  loadCatalog,
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
  const [resultPage, setResultPage] = useState(0)
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
    setResultPage(0)
    setDetailPick(null)
    setDetailLoading(false)
  }

  const pageCount = Math.max(
    1,
    Math.ceil(resultMovies.length / RESULTS_PAGE_SIZE),
  )
  const pageMovies = resultMovies.slice(
    resultPage * RESULTS_PAGE_SIZE,
    (resultPage + 1) * RESULTS_PAGE_SIZE,
  )

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
    setResultPage(0)
    setDetailPick(null)
  }, [catalog, preferences])

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

  function handlePrevPage() {
    setDetailPick(null)
    setResultPage((page) => Math.max(0, page - 1))
  }

  function handleNextPage() {
    setDetailPick(null)
    setResultPage((page) => Math.min(pageCount - 1, page + 1))
  }

  async function handleSelectMovie(pick: ScoredMovie) {
    setDetailPick(pick)
    if (catalogSource !== 'tmdb') return

    setDetailLoading(true)
    try {
      const enriched = await enrichPick(pick, preferences)
      if (enriched) setDetailPick(enriched)
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
    <div className={`app${step === 'result' ? ' app-wide' : ''}`}>
      <header className="hero">
        <div className="eyebrow">
          <span>Streamly</span>
        </div>
        <h1>What should you watch tonight?</h1>
        <p className="sub">
          Tell us your mood, genre, and streaming subscriptions — we&apos;ll
          pick a movie you can actually start right now.
        </p>
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

      <div className="progress" aria-hidden="true">
        {STEPS.map((name, index) => {
          let cls = 'sprocket'
          if (index < stepIndex) cls += ' done'
          if (index === stepIndex) cls += ' active'
          return <div key={name} className={cls} />
        })}
      </div>

      <main className="stage">
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
              movies={pageMovies}
              matchCount={resultMovies.length}
              page={resultPage}
              pageCount={pageCount}
              selected={detailPick}
              detailLoading={detailLoading}
              moods={moods}
              genres={genres}
              onSelect={handleSelectMovie}
              onCloseDetail={handleCloseDetail}
              onPrev={handlePrevPage}
              onNext={handleNextPage}
              onBack={handleBackFromResult}
            />
          ) : showResultLoading ? (
            <LoadingResult />
          ) : (
            <EmptyResult onReset={handleBackFromResult} />
          ))}

        {step !== 'result' && (
          <div className="navrow">
            <button
              type="button"
              className="btn btn-back"
              onClick={handleBack}
              disabled={step === 'mood'}
            >
              Back
            </button>
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
