import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccountScreen } from './components/AccountScreen'
import { AuthModal } from './components/AuthModal'
import { GenrePicker } from './components/GenrePicker'
import {
  EmptyResult,
  LoadingResult,
  ResultsView,
} from './components/MovieResult'
import { MoodPicker } from './components/MoodPicker'
import { StreamingPicker } from './components/StreamingPicker'
import { TimeBudgetPicker } from './components/TimeBudgetPicker'
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
  loadStreamingServices,
  saveStreamingServices,
} from './lib/storage'
import { useAuth } from './context/AuthContext'
import { isTmdbConfigured } from './lib/tmdb'
import type {
  GenreId,
  MoodId,
  Movie,
  ScoredMovie,
  StreamingServiceId,
} from './types'

type WizardStep = 'mood' | 'genre' | 'time' | 'services' | 'result'

const WIZARD_STEPS = ['mood', 'genre', 'time', 'services'] as const
const CATALOG_DEBOUNCE_MS = 350

function App() {
  const {
    configured: authConfigured,
    ready: authReady,
    user,
    cloudServices,
    persistServices,
  } = useAuth()
  const [step, setStep] = useState<WizardStep>('mood')
  const [screen, setScreen] = useState<'wizard' | 'account'>('wizard')
  const [authOpen, setAuthOpen] = useState(false)
  const hydratedUid = useRef<string | null>(null)
  const skipNextPersist = useRef(false)
  const [moods, setMoods] = useState<MoodId[]>([])
  const [genres, setGenres] = useState<GenreId[]>([])
  const [familyFriendly, setFamilyFriendly] = useState(false)
  const [maxRuntimeMinutes, setMaxRuntimeMinutes] = useState<number | null>(
    null,
  )
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
  const resultMoviesRef = useRef(resultMovies)
  resultMoviesRef.current = resultMovies

  function clearResults() {
    setResultMovies([])
    setStripFocusIndex(0)
    setDetailPick(null)
    setDetailLoading(false)
  }

  useEffect(() => {
    if (!authReady) return
    if (!user) {
      hydratedUid.current = null
      return
    }
    if (cloudServices === null) return
    if (hydratedUid.current === user.uid) return

    hydratedUid.current = user.uid
    if (cloudServices.length > 0) {
      skipNextPersist.current = true
      setStreamingServices(cloudServices)
      return
    }
    if (streamingServices.length > 0) {
      void persistServices(streamingServices)
    }
  }, [authReady, cloudServices, persistServices, streamingServices, user])

  useEffect(() => {
    saveStreamingServices(streamingServices)
  }, [streamingServices])

  useEffect(() => {
    if (!user || !authReady) return
    if (hydratedUid.current !== user.uid) return
    if (skipNextPersist.current) {
      skipNextPersist.current = false
      return
    }
    void persistServices(streamingServices)
  }, [authReady, persistServices, streamingServices, user])

  const preferences = useMemo(
    () => ({
      moods,
      genres,
      streamingServices,
      familyFriendly,
      maxRuntimeMinutes,
    }),
    [moods, genres, streamingServices, familyFriendly, maxRuntimeMinutes],
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

    const movies = resultMoviesRef.current
    if (movies.length === 0) return

    const windowStart = Math.max(0, stripFocusIndex - 2)
    const windowEnd = Math.min(movies.length, stripFocusIndex + 10)
    const visible = movies.slice(windowStart, windowEnd)
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
  }, [catalogSource, step, stripFocusIndex])

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

  const hasSavedServices = streamingServices.length > 0

  function handleBackFromResult() {
    pendingFind.current = false
    clearResults()
    setStep(hasSavedServices ? 'time' : 'services')
  }

  function handleFullReset() {
    pendingFind.current = false
    setMoods([])
    setGenres([])
    setFamilyFriendly(false)
    setMaxRuntimeMinutes(null)
    setStep('mood')
    setScreen('wizard')
    clearResults()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const visibleWizardSteps = hasSavedServices
    ? (['mood', 'genre', 'time'] as const)
    : WIZARD_STEPS
  const wizardStepIndex = (visibleWizardSteps as readonly string[]).indexOf(
    step,
  )
  const showReset =
    moods.length > 0 ||
    genres.length > 0 ||
    familyFriendly ||
    maxRuntimeMinutes !== null ||
    step === 'result'

  const showResultLoading =
    step === 'result' &&
    resultMovies.length === 0 &&
    (catalogStatus !== 'ready' || pendingFind.current)

  function nextLabel(): string {
    if (step === 'mood') {
      return moods.length === 0
        ? 'Pick a mood to continue'
        : 'Next: pick a genre →'
    }
    if (step === 'genre') {
      return genres.length === 0 && !familyFriendly
        ? 'Skip — any genre works →'
        : 'Next: your time →'
    }
    if (step === 'time') {
      return hasSavedServices
        ? nextFindLabel()
        : 'Next: your services →'
    }
    return nextFindLabel()
  }

  function nextFindLabel(): string {
    if (catalogStatus === 'loading') return 'Searching the catalog…'
    if (streamingServices.length === 0) return 'Select a service to continue'
    if (canSubmit && catalogStatus === 'ready' && matchCount === 0) {
      return 'No matches — adjust filters'
    }
    return "Find tonight's movie"
  }

  const nextDisabled =
    (step === 'mood' && moods.length === 0) ||
    ((step === 'services' || (step === 'time' && hasSavedServices)) &&
      (streamingServices.length === 0 ||
        (catalogStatus === 'ready' && matchCount === 0)))

  function handleNext() {
    if (step === 'mood' && moods.length > 0) setStep('genre')
    else if (step === 'genre') setStep('time')
    else if (step === 'time') {
      if (hasSavedServices) handleFindMovie()
      else setStep('services')
    } else if (step === 'services') handleFindMovie()
  }

  function handleBack() {
    if (step === 'genre') setStep('mood')
    else if (step === 'time') setStep('genre')
    else if (step === 'services') setStep('time')
    else if (step === 'result') handleBackFromResult()
  }

  return (
    <div className="app">
      <header className="hero">
        {step === 'result' ? (
          <>
            <div className="eyebrow">
              <span>Your lineup</span>
            </div>
            <h1>Tonight&apos;s picks</h1>
            <p className="sub">
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
              {hasSavedServices
                ? 'Tell us your mood, genre, and how much time you have — we will pick something on the services you already saved.'
                : 'Tell us your mood, genre, how much time you have, and your streaming subscriptions — we will pick a movie you can start now.'}
            </p>
          </>
        )}
      </header>

      {(authConfigured || showReset) && (
        <div className="toolbar">
          {authConfigured && (
            user ? (
              <button
                type="button"
                className="btn-text"
                onClick={() => setScreen('account')}
              >
                {user.email ?? 'Account'}
              </button>
            ) : (
              <button
                type="button"
                className="btn-text"
                onClick={() => setAuthOpen(true)}
              >
                Sign in
              </button>
            )
          )}
          {showReset && screen === 'wizard' && (
            <button
              type="button"
              className="btn-text"
              onClick={handleFullReset}
            >
              Reset tonight
            </button>
          )}
        </div>
      )}

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

      {screen === 'wizard' && step !== 'result' && (
        <div className="progress" aria-hidden="true">
          {visibleWizardSteps.map((name, index) => {
            let cls = 'sprocket'
            if (index < wizardStepIndex) cls += ' done'
            if (index === wizardStepIndex) cls += ' active'
            return <div key={name} className={cls} />
          })}
        </div>
      )}

      <main
        className="stage stage-wizard"
      >
        {screen === 'account' && (
          <AccountScreen
            services={streamingServices}
            onChangeServices={setStreamingServices}
            onBack={() => setScreen('wizard')}
          />
        )}
        {screen === 'wizard' && step === 'mood' && (
          <MoodPicker selected={moods} onChange={setMoods} />
        )}
        {screen === 'wizard' && step === 'genre' && (
          <GenrePicker
            selected={genres}
            onChange={setGenres}
            familyFriendly={familyFriendly}
            onFamilyFriendlyChange={setFamilyFriendly}
          />
        )}
        {screen === 'wizard' && step === 'time' && (
          <TimeBudgetPicker
            maxRuntimeMinutes={maxRuntimeMinutes}
            onChange={setMaxRuntimeMinutes}
          />
        )}
        {screen === 'wizard' && step === 'services' && (
          <>
            {user && (
              <p className="counter">Changes save to your account.</p>
            )}
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
                  ? 'No matches — try more services, fewer genres, a longer time window, or turn off Family friendly.'
                  : 'No matches — try more services, fewer genres, or a longer time window.'}
              </p>
            )}
            {canSubmit && catalogStatus === 'loading' && (
              <p className="counter">Searching the catalog…</p>
            )}
          </>
        )}
        {screen === 'wizard' && step === 'result' &&
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

        {screen === 'wizard' && step !== 'result' && (
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
        <p className="attribution">
          Movie data from{' '}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            TMDB
          </a>
          . Not endorsed by TMDB.
          {catalogSource === 'curated-fallback' ? ' Showing curated picks.' : null}
        </p>
      </footer>
    </div>
  )
}

export default App
