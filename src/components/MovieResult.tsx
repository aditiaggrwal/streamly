import { useEffect, useState } from 'react'
import { GENRES, MOODS, STREAMING_SERVICES } from '../data/constants'
import { formatRuntime } from '../lib/storage'
import type { GenreId, MoodId, ScoredMovie } from '../types'
import { ServiceMark } from './ServiceMark'

export const RESULTS_PAGE_SIZE = 4

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

function compactMeta(movie: ScoredMovie['movie']): string {
  return [
    movie.contentRating,
    movie.runtimeMinutes > 0 ? formatRuntime(movie.runtimeMinutes) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

interface MovieCardProps {
  pick: ScoredMovie
  onSelect: (pick: ScoredMovie) => void
}

function MovieCard({ pick, onSelect }: MovieCardProps) {
  const { movie } = pick
  const meta = compactMeta(movie)

  return (
    <button
      type="button"
      className="result-card"
      onClick={() => onSelect(pick)}
    >
      <PosterThumb movie={movie} className="result-card-poster" />
      <h3 className="result-card-title">{movie.title}</h3>
      {meta && <p className="result-card-meta">{meta}</p>}
    </button>
  )
}

interface ResultGridProps {
  movies: ScoredMovie[]
  matchCount: number
  page: number
  pageCount: number
  busy?: boolean
  onSelect: (pick: ScoredMovie) => void
  onPrev: () => void
  onNext: () => void
  onBack: () => void
}

export function ResultGrid({
  movies,
  matchCount,
  page,
  pageCount,
  busy = false,
  onSelect,
  onPrev,
  onNext,
  onBack,
}: ResultGridProps) {
  const canBrowse = pageCount > 1
  const rangeStart = page * RESULTS_PAGE_SIZE + 1
  const rangeEnd = Math.min((page + 1) * RESULTS_PAGE_SIZE, matchCount)

  useEffect(() => {
    if (!canBrowse) return
    function onKeyDown(event: KeyboardEvent) {
      if (busy) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onPrev()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        onNext()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, canBrowse, onNext, onPrev])

  return (
    <div className="step-body fade">
      <div className="step-head">
        <div className="step-title-row">
          <h2 className="step-title">Tonight&apos;s picks</h2>
          <span className="tag optional">{matchCount} matches</span>
        </div>
        <p className="step-hint">
          Tap a movie for details — browse {RESULTS_PAGE_SIZE} at a time.
        </p>
      </div>

      <div className="result-grid" aria-busy={busy}>
        {movies.map((pick) => (
          <MovieCard key={pick.movie.id} pick={pick} onSelect={onSelect} />
        ))}
      </div>

      {canBrowse && (
        <div className="pick-nav" role="navigation" aria-label="Browse pages">
          <button
            type="button"
            className="pick-arrow"
            onClick={onPrev}
            disabled={page <= 0 || busy}
            aria-label="Previous page"
          >
            ←
          </button>
          <div className="pick-position">
            <span className="pick-position-label">Showing</span>
            <span className="pick-position-value">
              {rangeStart}–{rangeEnd}
              <span className="pick-position-sep">/</span>
              {matchCount}
            </span>
          </div>
          <button
            type="button"
            className="pick-arrow"
            onClick={onNext}
            disabled={page >= pageCount - 1 || busy}
            aria-label="Next page"
          >
            →
          </button>
        </div>
      )}

      <div className="navrow">
        <button type="button" className="btn btn-back" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  )
}

interface MovieDetailProps {
  result: ScoredMovie
  moods: MoodId[]
  genres: GenreId[]
  loading?: boolean
  onClose: () => void
  onBack: () => void
}

export function MovieDetail({
  result,
  moods,
  genres,
  loading = false,
  onClose,
  onBack,
}: MovieDetailProps) {
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
    movie.contentRating ?? null,
    movie.runtimeMinutes > 0 ? formatRuntime(movie.runtimeMinutes) : null,
    `★ ${movie.rating.toFixed(1)}`,
  ].filter(Boolean)

  return (
    <div className="step-body fade">
      <div className="step-head">
        <div className="step-title-row">
          <h2 className="step-title">Tonight&apos;s pick</h2>
        </div>
        <button type="button" className="btn-text detail-back-link" onClick={onClose}>
          ← Back to all picks
        </button>
      </div>

      <article className="ticket" aria-busy={loading}>
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
                      {mood ? `${mood.emoji} ${mood.label}` : id}
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

      <div className="navrow">
        <button type="button" className="btn btn-back" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  )
}

interface EmptyResultProps {
  onReset: () => void
}

export function EmptyResult({ onReset }: EmptyResultProps) {
  return (
    <div className="step-body fade empty-state">
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
    <div className="step-body fade" aria-busy="true" aria-live="polite">
      <div className="step-head">
        <div className="step-title-row">
          <h2 className="step-title">Finding tonight&apos;s picks</h2>
        </div>
        <p className="step-hint">Searching the catalog…</p>
      </div>
      <div className="result-grid">
        {Array.from({ length: RESULTS_PAGE_SIZE }, (_, index) => (
          <div key={index} className="result-card result-card-skeleton">
            <div className="movie-poster poster-skeleton result-card-poster" />
            <div className="text-skeleton title-skeleton" />
            <div className="text-skeleton meta-skeleton" />
          </div>
        ))}
      </div>
    </div>
  )
}
