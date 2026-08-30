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
    if (catalogStatus !== 'ready' || step !== 'result') return
    pendingFind.current = false
    void applyPick([], true)
  }, [applyPick, catalogStatus, step])

  function handleFindMovie() {
    if (!canSubmit) return
    setResult(null)
    setSeenIds([])
    setStep('result')
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

  function handleBackFromResult() {
    pendingFind.current = false
    pickRequest.current += 1
    setFinding(false)
    setStep('services')
    setResult(null)
    setSeenIds([])
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
    setStep('mood')
    setResult(null)
    setSeenIds([])
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
    step === 'result' && !result && (catalogStatus !== 'ready' || finding)

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
    <div className="app">
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
          (result ? (
            <MovieResult
              result={result}
              matchCount={matchCount}
              moods={moods}
              genres={genres}
              busy={finding}
              onShuffle={handleShuffle}
              onReset={handleBackFromResult}
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
