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
import { SettingsScreen } from './components/SettingsScreen'
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
import {
  fitsRuntimeBudget,
  getMatchCount,
  recommendMovies,
  reshuffleLineup,
} from './lib/recommend'
import { shouldSkipServicesStep } from './lib/servicesStep'
import {
  clearStreamingServices,
  clearTonightSession,
  loadTonightSession,
  saveStreamingServices,
  saveTonightSession,
} from './lib/storage'
import { useAuth } from './context/AuthContext'
import { isTmdbConfigured } from './lib/tmdb'
import type {
  GenreId,
  MoodId,
  Movie,
  ScoredMovie,
  StreamingServiceId,
  TonightSession,
  WizardStep,
} from './types'

type QuestionnaireStep = Exclude<WizardStep, 'result'>

const WIZARD_STEPS = ['mood', 'genre', 'time', 'services'] as const
const STEP_LABELS: Record<QuestionnaireStep, string> = {
  mood: 'Mood',
  genre: 'Genre',
  time: 'Time',
  services: 'Services',
}
const CATALOG_DEBOUNCE_MS = 350

function App() {
  const {
    configured: authConfigured,
    ready: authReady,
    user,
    cloudServices,
    cloudTonight,
    persistServices,
    persistTonight,
    authError,
  } = useAuth()
  const [tonightBoot] = useState(loadTonightSession)
  const [step, setStep] = useState<WizardStep>(tonightBoot.step)
  const [farthestIndex, setFarthestIndex] = useState(tonightBoot.farthestIndex)
  const [accountOpen, setAccountOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  // Selected services skip that step for the rest of this visit. Start over
  // and Back reopen it with the current picks. Guests still do not keep the
  // list across a refresh.
  const [servicesStepReopened, setServicesStepReopened] = useState(false)
  const hydratedUid = useRef<string | null>(null)
  const skipNextPersist = useRef(false)
  const appliedCloudTonightUid = useRef<string | null>(null)
  const [moods, setMoods] = useState<MoodId[]>(tonightBoot.moods)
  const [genres, setGenres] = useState<GenreId[]>(tonightBoot.genres)
  const [familyFriendly, setFamilyFriendly] = useState(
    tonightBoot.familyFriendly,
  )
  const [maxRuntimeMinutes, setMaxRuntimeMinutes] = useState<number | null>(
    tonightBoot.maxRuntimeMinutes,
  )
  const [streamingServices, setStreamingServices] = useState<
    StreamingServiceId[]
  >([])
  const [resultMovies, setResultMovies] = useState<ScoredMovie[]>([])
  const [stripFocusIndex, setStripFocusIndex] = useState(0)
  const [detailPick, setDetailPick] = useState<ScoredMovie | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [catalog, setCatalog] = useState<Movie[]>(CURATED_MOVIES)
  const [catalogSource, setCatalogSource] = useState<CatalogSource>('curated')
  const [catalogStatus, setCatalogStatus] = useState<
    'idle' | 'loading' | 'ready'
  >('idle')

  const pendingFind = useRef(tonightBoot.step === 'result')
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
      appliedCloudTonightUid.current = null
      setAccountOpen(false)
      setSettingsOpen(false)
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
    if (!authReady || user) return
    clearStreamingServices()
    setStreamingServices([])
    setStep((current) => {
      if (current !== 'result') return current
      pendingFind.current = false
      return 'services'
    })
    clearResults()
  }, [authReady, user])

  useEffect(() => {
    if (!user) return
    saveStreamingServices(streamingServices)
  }, [streamingServices, user])

  useEffect(() => {
    if (!user || !authReady) return
    if (hydratedUid.current !== user.uid) return
    if (skipNextPersist.current) {
      skipNextPersist.current = false
      return
    }
    void persistServices(streamingServices)
  }, [authReady, persistServices, streamingServices, user])

  const tonightSession = useMemo<TonightSession>(
    () => ({
      moods,
      genres,
      familyFriendly,
      maxRuntimeMinutes,
      step,
      farthestIndex,
    }),
    [farthestIndex, familyFriendly, genres, maxRuntimeMinutes, moods, step],
  )

  function applyTonight(session: TonightSession) {
    setMoods(session.moods)
    setGenres(session.genres)
    setFamilyFriendly(session.familyFriendly)
    setMaxRuntimeMinutes(session.maxRuntimeMinutes)
    setStep(session.step)
    setFarthestIndex(session.farthestIndex)
    if (session.step === 'result') pendingFind.current = true
  }

  useEffect(() => {
    saveTonightSession(tonightSession)
  }, [tonightSession])

  useEffect(() => {
    if (!authReady || !user) return
    if (appliedCloudTonightUid.current === user.uid) return
    appliedCloudTonightUid.current = user.uid
    if (moods.length > 0) return
    if (!cloudTonight || cloudTonight.moods.length === 0) return
    applyTonight(cloudTonight)
  }, [authReady, cloudTonight, moods.length, user])

  useEffect(() => {
    if (!user || !authReady) return
    if (appliedCloudTonightUid.current !== user.uid) return
    const timer = window.setTimeout(() => {
      void persistTonight(
        tonightSession.moods.length > 0 ? tonightSession : null,
      )
    }, 450)
    return () => window.clearTimeout(timer)
  }, [authReady, persistTonight, tonightSession, user])

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

  function handleNewLineup() {
    setResultMovies((prev) => {
      const next = reshuffleLineup(prev)
      return next
    })
    setStripFocusIndex(0)
    setDetailPick(null)
  }

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
          const next = prev.flatMap((entry) => {
            const update = facts.get(entry.movie.id)
            if (!update) return [entry]
            const movie = applyCardFacts(entry.movie, update)
            if (!fitsRuntimeBudget(movie, preferences.maxRuntimeMinutes)) {
              changed = true
              return []
            }
            if (movie === entry.movie) return [entry]
            changed = true
            return [{ ...entry, movie }]
          })
          return changed ? next : prev
        })

        setDetailPick((prev) => {
          if (!prev) return prev
          const update = facts.get(prev.movie.id)
          if (!update) return prev
          const movie = applyCardFacts(prev.movie, update)
          if (!fitsRuntimeBudget(movie, preferences.maxRuntimeMinutes)) {
            return null
          }
          if (movie === prev.movie) return prev
          return { ...prev, movie }
        })
      },
    )

    return () => {
      cancelled = true
    }
  }, [catalogSource, preferences.maxRuntimeMinutes, step, stripFocusIndex])

  useEffect(() => {
    if (!pendingFind.current) return
    if (catalogStatus !== 'ready' || step !== 'result') return
    pendingFind.current = false
    loadResults()
  }, [catalogStatus, loadResults, step])

  function handleFindMovie() {
    if (!canSubmit) return
    clearResults()
    setFarthestIndex((prev) => Math.max(prev, lastWizardIndex))
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
      } else {
        setDetailPick(null)
        setResultMovies((prev) =>
          prev.filter((entry) => entry.movie.id !== pick.movie.id),
        )
      }
    } finally {
      setDetailLoading(false)
    }
  }

  function handleCloseDetail() {
    setDetailPick(null)
    setDetailLoading(false)
  }

  const skipServicesStep = shouldSkipServicesStep(
    streamingServices.length,
    servicesStepReopened,
  )

  useEffect(() => {
    if (step === 'services' && skipServicesStep) setStep('time')
  }, [skipServicesStep, step])

  function reopenServicesStep() {
    setServicesStepReopened(true)
  }

  function handleBackFromResult() {
    pendingFind.current = false
    clearResults()
    reopenServicesStep()
    setStep('services')
  }

  function handleFullReset() {
    pendingFind.current = false
    setMoods([])
    setGenres([])
    setFamilyFriendly(false)
    setMaxRuntimeMinutes(null)
    reopenServicesStep()
    setStep('mood')
    setFarthestIndex(0)
    setAccountOpen(false)
    clearResults()
    clearTonightSession()
    void persistTonight(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const visibleWizardSteps = skipServicesStep
    ? (['mood', 'genre', 'time'] as const)
    : WIZARD_STEPS
  const wizardStepIndex = (visibleWizardSteps as readonly string[]).indexOf(
    step,
  )
  const lastWizardIndex = visibleWizardSteps.length - 1
  const canJumpSteps = farthestIndex >= lastWizardIndex && moods.length > 0

  function goToWizardStep(next: QuestionnaireStep) {
    setStep(next)
    const index = (visibleWizardSteps as readonly string[]).indexOf(next)
    if (index >= 0) setFarthestIndex((prev) => Math.max(prev, index))
  }
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
        ? 'Choose a mood'
        : 'Continue'
    }
    if (step === 'genre') {
      return genres.length === 0 && !familyFriendly
        ? 'Skip'
        : 'Continue'
    }
    if (step === 'time') {
      return skipServicesStep
        ? nextFindLabel()
        : 'Continue'
    }
    return nextFindLabel()
  }

  function nextFindLabel(): string {
    if (catalogStatus === 'loading') return 'Searching…'
    if (streamingServices.length === 0) return 'Choose a service'
    if (canSubmit && catalogStatus === 'ready' && matchCount === 0) {
      return 'No matches'
    }
    return 'Find a movie'
  }

  const nextDisabled =
    (step === 'mood' && moods.length === 0) ||
    ((step === 'services' || (step === 'time' && skipServicesStep)) &&
      (streamingServices.length === 0 ||
        (catalogStatus === 'ready' && matchCount === 0)))

  function handleNext() {
    if (step === 'mood' && moods.length > 0) goToWizardStep('genre')
    else if (step === 'genre') goToWizardStep('time')
    else if (step === 'time') {
      if (skipServicesStep) handleFindMovie()
      else goToWizardStep('services')
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
      {authConfigured && (
        <div className="auth-corner">
          {user ? (
            <>
              <button
                type="button"
                className="account-avatar-btn"
                onClick={() => {
                  setAccountOpen(false)
                  setSettingsOpen((open) => !open)
                }}
                aria-label="Settings"
                title="Settings"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="account-avatar-btn"
                onClick={() => {
                  setSettingsOpen(false)
                  setAccountOpen((open) => !open)
                }}
                aria-label={user.email ? `Account, ${user.email}` : 'Account'}
                title={user.email ?? 'Account'}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx="12"
                    cy="10"
                    r="3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M7 20.66V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.66"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-text"
              onClick={() => setAuthOpen(true)}
            >
              Sign in
            </button>
          )}
        </div>
      )}
      <header className="hero">
        {step === 'mood' ? (
          <div className="eyebrow eyebrow-brand">
            <img
              className="brand-lockup"
              src={`${import.meta.env.BASE_URL}logo-lockup-v3.png`}
              alt="Streamly — Stop scrolling. Start streaming."
            />
          </div>
        ) : (
          <div className="eyebrow eyebrow-brand">
            <img
              className="brand-icon"
              src={`${import.meta.env.BASE_URL}logo-icon.png`}
              alt="Streamly"
            />
          </div>
        )}
        {step === 'result' ? (
          <>
            <h1>Tonight&apos;s picks</h1>
            <p className="sub">
              {resultMovies.length > 0
                ? `${resultMovies.length} ${resultMovies.length === 1 ? 'match' : 'matches'}. Pick one and watch.`
                : showResultLoading
                  ? 'Finding movies you can watch now…'
                  : 'Nothing fit. Change a filter and try again.'}
            </p>
          </>
        ) : (
          <>
            {step !== 'mood' ? (
              <h1>What should you watch tonight?</h1>
            ) : (
              <h1 className="sr-only">What should you watch tonight?</h1>
            )}
            <p className="sub">
              {skipServicesStep
                ? "Find tonight's movie based on your mood, genre, and time. We'll pick from the services you saved."
                : 'Mood, genre, time, and where you watch. We\'ll pick something you can start now.'}
            </p>
          </>
        )}
      </header>

      {showReset && !accountOpen && !settingsOpen && (
        <div className="toolbar">
          <button
            type="button"
            className="btn-text"
            onClick={handleFullReset}
          >
            Start over
          </button>
        </div>
      )}

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      {settingsOpen && user && (
        <SettingsScreen
          services={streamingServices}
          onChangeServices={setStreamingServices}
          onBack={() => setSettingsOpen(false)}
        />
      )}
      {accountOpen && user && (
        <AccountScreen onBack={() => setAccountOpen(false)} />
      )}
      {authConfigured && authError && !user ? (
        <p className="auth-error auth-error-inline">{authError}</p>
      ) : null}

      {step !== 'result' && (
        <div className="progress" role="navigation" aria-label="Steps">
          {visibleWizardSteps.map((name, index) => {
            let cls = 'sprocket'
            if (index < wizardStepIndex) cls += ' done'
            if (index === wizardStepIndex) cls += ' active'
            if (canJumpSteps) cls += ' clickable'
            const label = STEP_LABELS[name]
            return (
              <button
                key={name}
                type="button"
                className={cls}
                disabled={!canJumpSteps}
                aria-label={label}
                aria-current={name === step ? 'step' : undefined}
                onClick={() => {
                  if (name !== step) goToWizardStep(name)
                }}
              />
            )
          })}
        </div>
      )}

      <main
        className="stage stage-wizard"
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
        {step === 'time' && (
          <TimeBudgetPicker
            maxRuntimeMinutes={maxRuntimeMinutes}
            onChange={setMaxRuntimeMinutes}
          />
        )}
        {step === 'services' && (
          <>
            {user && (
              <p className="counter">Saved to your account.</p>
            )}
            <StreamingPicker
              selected={streamingServices}
              onChange={setStreamingServices}
            />
            {canSubmit && catalogStatus === 'ready' && matchCount > 0 && (
              <p className="counter match-ready">
                {matchCount} {matchCount === 1 ? 'match' : 'matches'} ready.
              </p>
            )}
            {canSubmit && catalogStatus === 'ready' && matchCount === 0 && (
              <p className="counter match-empty">
                {familyFriendly
                  ? 'No matches. Add a service, drop a genre, give yourself more time, or turn off Family friendly.'
                  : 'No matches. Add a service, drop a genre, or give yourself more time.'}
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
              onNewLineup={handleNewLineup}
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
        <nav className="footer-nav" aria-label="Site">
          <span>Streamly</span>
          <span className="footer-sep" aria-hidden="true">
            ·
          </span>
          <a href="/privacy">Privacy</a>
        </nav>
        <p className="attribution">
          Movie data from{' '}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
          >
            TMDB
          </a>
          . This product uses the TMDB API but is not endorsed or certified by
          TMDB. Streaming availability via{' '}
          <a
            href="https://www.justwatch.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            JustWatch
          </a>
          .
          {catalogSource === 'curated-fallback' ? ' Showing a backup list.' : null}
        </p>
      </footer>
    </div>
  )
}

export default App
