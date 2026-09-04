import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GENRES, MOODS, STREAMING_SERVICES } from '../data/constants'
import { formatRuntime } from '../lib/storage'
import type { GenreId, MoodId, ScoredMovie } from '../types'
import { ServiceMark } from './ServiceMark'

export const RESULTS_STRIP_SKELETON_COUNT = 6

function PosterThumb({
  movie,
  className = '',
}: {
  movie: ScoredMovie['movie']
  className?: string
}) {
  const [posterFailed, setPosterFailed] = useState(false)

  useEffect(() => {
    setPosterFailed(false)
  }, [movie.id, movie.posterUrl])

  const showPoster = Boolean(movie.posterUrl) && !posterFailed

  return (
    <div
      className={`movie-poster ${className}`.trim()}
      style={{
        background: `linear-gradient(145deg, ${movie.accent}, #0f0f14)`,
      }}
    >
      {showPoster && movie.posterUrl ? (
        <img
          className="poster-image"
          src={movie.posterUrl}
          alt=""
          loading="lazy"
          onError={() => setPosterFailed(true)}
        />
      ) : (
        <span className="poster-initial">{movie.title.charAt(0)}</span>
      )}
    </div>
  )
}

interface MovieCardProps {
  pick: ScoredMovie
  selected: boolean
  onSelect: (pick: ScoredMovie) => void
}

function MovieCard({ pick, selected, onSelect }: MovieCardProps) {
  const { movie } = pick
  const rating = movie.contentRating?.trim() || ''
  const runtime =
    movie.runtimeMinutes > 0 ? formatRuntime(movie.runtimeMinutes) : ''
  const meta = [rating, runtime].filter(Boolean).join(' · ')

  return (
    <button
      type="button"
      role="listitem"
      className={`result-card${selected ? ' selected' : ''}`}
      onClick={() => onSelect(pick)}
      aria-pressed={selected}
    >
      <div className="result-card-poster-wrap">
        <PosterThumb movie={movie} className="result-card-poster" />
        <div className="result-card-overlay">
          <h3 className="result-card-title">{movie.title}</h3>
          {meta ? <p className="result-card-meta">{meta}</p> : null}
        </div>
      </div>
    </button>
  )
}

interface DetailPanelProps {
  result: ScoredMovie
  moods: MoodId[]
  genres: GenreId[]
  loading?: boolean
  onClose: () => void
}

function DetailPanel({
  result,
  moods,
  genres,
  loading = false,
  onClose,
}: DetailPanelProps) {
  const { movie, reasons } = result

  const watchServices = movie.streamingServices.map((id) => {
    const service = STREAMING_SERVICES.find((s) => s.id === id)
    return { id, service, label: service?.label ?? id }
  })
  const serviceLabels = watchServices.map((entry) => entry.label).join(' · ')

  const watchHref =
    movie.watchUrl ||
    `https://www.justwatch.com/us/search?q=${encodeURIComponent(movie.title)}`

  const meta = [
    movie.year > 0 ? String(movie.year) : null,
    movie.contentRating?.trim() || null,
    movie.runtimeMinutes > 0 ? formatRuntime(movie.runtimeMinutes) : null,
    `★ ${movie.rating.toFixed(1)}`,
  ].filter(Boolean)

  return (
    <aside
      className="results-panel open"
      aria-label="Movie details"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="results-panel-close"
        onClick={onClose}
        aria-label="Close details"
      >
        ×
      </button>

      <article className="ticket ticket-panel" aria-busy={loading}>
        <div className="ticket-top">
          <div className="ticket-eyebrow">Streamly · Admit one</div>

          <section className="your-picks" aria-label="Your picks">
            <h4 className="your-picks-heading">You chose</h4>
            <div className="your-picks-group">
              <p className="your-picks-label">Your mood</p>
              <div className="chiprow">
                {moods.map((id) => {
                  const mood = MOODS.find((m) => m.id === id)
                  return (
                    <span key={`mood-${id}`} className="chip pick">
                      {mood ? mood.label : id}
                    </span>
                  )
                })}
              </div>
            </div>
            {genres.length > 0 && (
              <div className="your-picks-group">
                <p className="your-picks-label">Your genres</p>
                <div className="chiprow">
                  {genres.map((id) => (
                    <span key={`genre-${id}`} className="chip pick">
                      {GENRES.find((g) => g.id === id)?.label ?? id}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div className="ticket-main">
            <PosterThumb movie={movie} />

            <div className="movie-details">
              <h3 className="movie-title">{movie.title}</h3>
              <p className="movie-meta">{meta.join(' · ')}</p>
              <p className="movie-overview">{movie.overview}</p>

              <div className="chiprow">
                {movie.genres.map((genre) => (
                  <span key={genre} className="chip">
                    {GENRES.find((g) => g.id === genre)?.label ?? genre}
                  </span>
                ))}
              </div>

              {movie.starring && movie.starring.length > 0 && (
                <section className="starring" aria-label="Starring">
                  <h4 className="starring-heading">Starring</h4>
                  <p className="starring-list">
                    {movie.starring.map((star) => star.name).join(' · ')}
                  </p>
                </section>
              )}

              <h4 className="reasons-heading">Why this one?</h4>
              <ul className="reasons">
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="perf" aria-hidden="true" />

        <div className="ticket-bottom">
          <div className="showtime">
            <div className="k">Showtime</div>
            <div className="v">Tonight</div>
          </div>
          {serviceLabels && (
            <a
              className="watch-btn"
              href={watchHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              {watchServices.some((entry) => entry.service) && (
                <span className="watch-marks">
                  {watchServices.map(
                    (entry) =>
                      entry.service && (
                        <ServiceMark
                          key={entry.id}
                          service={entry.service}
                          className="watch-logo"
                        />
                      ),
                  )}
                </span>
              )}
              Watch on {serviceLabels}
            </a>
          )}
        </div>
      </article>
    </aside>
  )
}

interface StripScrollState {
  focusIndex: number
  canPrev: boolean
  canNext: boolean
  scrollable: boolean
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function animateStripScroll(
  strip: HTMLDivElement,
  target: number,
  onDone?: () => void,
): () => void {
  const start = strip.scrollLeft
  const distance = target - start
  if (Math.abs(distance) < 1) {
    onDone?.()
    return () => {}
  }

  const duration = 280
  let startTime: number | null = null
  let frameId = 0

  const step = (now: number) => {
    if (startTime === null) startTime = now
    const progress = Math.min((now - startTime) / duration, 1)
    strip.scrollLeft = start + distance * easeInOutCubic(progress)
    if (progress < 1) {
      frameId = requestAnimationFrame(step)
    } else {
      onDone?.()
    }
  }

  frameId = requestAnimationFrame(step)
  return () => cancelAnimationFrame(frameId)
}

function readStripScrollState(
  strip: HTMLDivElement,
  movieCount: number,
): StripScrollState {
  const cards = strip.querySelectorAll('.result-card')
  const firstCard = cards[0] as HTMLElement | undefined
  const maxScroll = strip.scrollWidth - strip.clientWidth
  const scrollable = maxScroll > 2

  if (!firstCard || movieCount === 0) {
    return {
      focusIndex: 0,
      canPrev: false,
      canNext: false,
      scrollable: false,
    }
  }

  const gap = Number.parseFloat(getComputedStyle(strip).columnGap) || 12
  const step = firstCard.offsetWidth + gap
  const focusIndex = Math.min(
    Math.max(0, Math.round(strip.scrollLeft / step)),
    movieCount - 1,
  )

  return {
    focusIndex,
    canPrev: strip.scrollLeft > 2,
    canNext: strip.scrollLeft < maxScroll - 2,
    scrollable,
  }
}

function StripArrow({
  direction,
  disabled,
  onClick,
  className = '',
}: {
  direction: 'prev' | 'next'
  disabled: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      className={`pick-arrow ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === 'prev' ? 'Previous movie' : 'Next movie'}
    >
      {direction === 'prev' ? '←' : '→'}
    </button>
  )
}

export interface ResultsViewProps {
  movies: ScoredMovie[]
  selected: ScoredMovie | null
  detailLoading?: boolean
  moods: MoodId[]
  genres: GenreId[]
  onSelect: (pick: ScoredMovie) => void
  onCloseDetail: () => void
  onFocusIndexChange?: (index: number) => void
  onBack: () => void
}

export function ResultsView({
  movies,
  selected,
  detailLoading = false,
  moods,
  genres,
  onSelect,
  onCloseDetail,
  onFocusIndexChange,
  onBack,
}: ResultsViewProps) {
  const panelOpen = selected !== null
  const stripRef = useRef<HTMLDivElement>(null)
  const isAnimatingRef = useRef(false)
  const cancelScrollRef = useRef<(() => void) | null>(null)
  const lastFocusIndexRef = useRef(-1)
  const scrollRafRef = useRef<number | null>(null)
  const onFocusIndexChangeRef = useRef(onFocusIndexChange)
  onFocusIndexChangeRef.current = onFocusIndexChange

  const movieListKey = useMemo(
    () => movies.map((pick) => pick.movie.id).join('\0'),
    [movies],
  )

  const [scrollState, setScrollState] = useState<StripScrollState>({
    focusIndex: 0,
    canPrev: false,
    canNext: false,
    scrollable: false,
  })

  const syncScrollState = useCallback(() => {
    const strip = stripRef.current
    if (!strip) return
    const next = readStripScrollState(strip, movies.length)
    setScrollState((prev) => {
      if (
        prev.focusIndex === next.focusIndex &&
        prev.canPrev === next.canPrev &&
        prev.canNext === next.canNext &&
        prev.scrollable === next.scrollable
      ) {
        return prev
      }
      return next
    })
    if (next.focusIndex !== lastFocusIndexRef.current) {
      lastFocusIndexRef.current = next.focusIndex
      onFocusIndexChangeRef.current?.(next.focusIndex)
    }
  }, [movies.length])

  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return

    const onScroll = () => {
      if (scrollRafRef.current !== null) return
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null
        syncScrollState()
      })
    }

    syncScrollState()
    strip.addEventListener('scroll', onScroll, { passive: true })

    const observer = new ResizeObserver(() => syncScrollState())
    observer.observe(strip)

    return () => {
      strip.removeEventListener('scroll', onScroll)
      observer.disconnect()
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current)
      }
    }
  }, [movieListKey, movies.length, syncScrollState])

  useEffect(() => {
    lastFocusIndexRef.current = -1
    cancelScrollRef.current?.()
    cancelScrollRef.current = null
    isAnimatingRef.current = false
    stripRef.current?.scrollTo({ left: 0, behavior: 'auto' })
    requestAnimationFrame(() => syncScrollState())
  }, [movieListKey, syncScrollState])

  const scrollByOne = useCallback((direction: 'prev' | 'next') => {
    const strip = stripRef.current
    if (!strip || isAnimatingRef.current) return

    const firstCard = strip.querySelector('.result-card') as HTMLElement | null
    if (!firstCard) return

    const gap = Number.parseFloat(getComputedStyle(strip).columnGap) || 12
    const step = firstCard.offsetWidth + gap
    const maxScroll = strip.scrollWidth - strip.clientWidth
    const delta = step * (direction === 'next' ? 1 : -1)
    const target = Math.min(Math.max(0, strip.scrollLeft + delta), maxScroll)

    isAnimatingRef.current = true
    cancelScrollRef.current?.()
    cancelScrollRef.current = animateStripScroll(strip, target, () => {
      isAnimatingRef.current = false
      syncScrollState()
    })
  }, [syncScrollState])

  useEffect(
    () => () => {
      cancelScrollRef.current?.()
    },
    [],
  )

  useEffect(() => {
    if (!scrollState.scrollable) return

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.key === 'Escape' && panelOpen) {
        event.preventDefault()
        onCloseDetail()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        scrollByOne('prev')
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        scrollByOne('next')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCloseDetail, panelOpen, scrollByOne, scrollState.scrollable])

  const focusNumber = scrollState.focusIndex + 1

  return (
    <div className="results-screen fade">
      <div className={`results-layout${panelOpen ? ' has-panel' : ''}`}>
        <div className="results-main">
          <div className="results-lineup">
            <p className="results-hint">
              Use the arrows to browse one movie at a time — click a poster for
              details.
            </p>

            <div className="result-strip-shell">
              {scrollState.scrollable && (
                <StripArrow
                  direction="prev"
                  disabled={!scrollState.canPrev}
                  onClick={() => scrollByOne('prev')}
                  className="pick-arrow-side pick-arrow-side-prev"
                />
              )}

              <div
                ref={stripRef}
                className="result-strip"
                role="list"
                aria-label="Movie picks"
              >
                {movies.map((pick) => (
                  <MovieCard
                    key={pick.movie.id}
                    pick={pick}
                    selected={selected?.movie.id === pick.movie.id}
                    onSelect={onSelect}
                  />
                ))}
                <span className="result-strip-spacer" aria-hidden="true" />
              </div>

              {scrollState.scrollable && (
                <StripArrow
                  direction="next"
                  disabled={!scrollState.canNext}
                  onClick={() => scrollByOne('next')}
                  className="pick-arrow-side pick-arrow-side-next"
                />
              )}
            </div>

            {scrollState.scrollable && (
              <div
                className="pick-nav"
                role="navigation"
                aria-label="Browse movies"
              >
                <StripArrow
                  direction="prev"
                  disabled={!scrollState.canPrev}
                  onClick={() => scrollByOne('prev')}
                />
                <div className="pick-position">
                  <span className="pick-position-label">Showing</span>
                  <span className="pick-position-value">
                    {focusNumber}
                    <span className="pick-position-sep">/</span>
                    {movies.length}
                  </span>
                </div>
                <StripArrow
                  direction="next"
                  disabled={!scrollState.canNext}
                  onClick={() => scrollByOne('next')}
                />
              </div>
            )}
          </div>

          <div className="navrow">
            <button type="button" className="btn btn-back" onClick={onBack}>
              Back
            </button>
          </div>
        </div>

        {panelOpen && selected && (
          <>
            <button
              type="button"
              className="results-panel-backdrop"
              onClick={onCloseDetail}
              aria-label="Close details"
            />
            <DetailPanel
              result={selected}
              moods={moods}
              genres={genres}
              loading={detailLoading}
              onClose={onCloseDetail}
            />
          </>
        )}
      </div>
    </div>
  )
}

interface EmptyResultProps {
  onReset: () => void
}

export function EmptyResult({ onReset }: EmptyResultProps) {
  return (
    <div className="results-screen fade empty-state">
      <div className="empty-icon" aria-hidden="true">
        🎬
      </div>
      <h2 className="step-title">No matches tonight</h2>
      <p className="step-hint">
        Try selecting more streaming services, loosening your genre picks,
        turning off Family friendly, or choosing a different mood.
      </p>
      <div className="navrow">
        <button type="button" className="btn btn-back" onClick={onReset}>
          Back
        </button>
        <button type="button" className="btn btn-next" onClick={onReset}>
          Adjust filters
        </button>
      </div>
    </div>
  )
}

export function LoadingResult() {
  return (
    <div className="results-screen fade" aria-busy="true" aria-live="polite">
      <div className="results-lineup">
        <p className="results-hint">Loading your lineup…</p>
        <div className="result-strip" aria-hidden="true">
          {Array.from({ length: RESULTS_STRIP_SKELETON_COUNT }, (_, index) => (
            <div key={index} className="result-card result-card-skeleton">
              <div className="result-card-poster-wrap">
                <div className="movie-poster poster-skeleton result-card-poster" />
                <div className="result-card-overlay">
                  <div className="text-skeleton title-skeleton" />
                  <div className="text-skeleton meta-skeleton" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
