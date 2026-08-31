import { useEffect, useState } from 'react'
import { GENRES, MOODS, STREAMING_SERVICES } from '../data/constants'
import { formatRuntime } from '../lib/storage'
import type { GenreId, MoodId, ScoredMovie } from '../types'
import { ServiceMark } from './ServiceMark'

interface MovieResultProps {
  result: ScoredMovie
  matchCount: number
  moods: MoodId[]
  genres: GenreId[]
  busy?: boolean
  historyIndex: number
  historyLength: number
  onPrev: () => void
  onNext: () => void
  onReset: () => void
}

export function MovieResult({
  result,
  matchCount,
  moods,
  genres,
  busy = false,
  historyIndex,
  historyLength,
  onPrev,
  onNext,
  onReset,
}: MovieResultProps) {
  const { movie, reasons } = result
  const [posterFailed, setPosterFailed] = useState(false)

  useEffect(() => {
    setPosterFailed(false)
  }, [movie.id, movie.posterUrl])

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
    movie.runtimeMinutes > 0 ? formatRuntime(movie.runtimeMinutes) : null,
    `★ ${movie.rating.toFixed(1)}`,
  ].filter(Boolean)

  const showPoster = Boolean(movie.posterUrl) && !posterFailed
  const canBrowse = matchCount > 1 || historyLength > 1
  const canPrev = historyIndex > 0
  const canNext = canBrowse
  const positionTotal = Math.max(matchCount, historyLength, 1)

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
          <h2 className="step-title">Tonight&apos;s pick</h2>
          {matchCount > 1 && (
            <span className="tag optional">{matchCount} matches</span>
          )}
        </div>
        <p className="step-hint">
          Based on your mood, genre, and what you already pay for.
        </p>
      </div>

      <article className="ticket">
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
            <div
              className="movie-poster"
              style={{
                background: `linear-gradient(145deg, ${movie.accent}, #0f0f14)`,
              }}
            >
              {showPoster && movie.posterUrl ? (
                <img
                  className="poster-image"
                  src={movie.posterUrl}
                  alt={`${movie.title} poster`}
                  onError={() => setPosterFailed(true)}
                />
              ) : (
                <span className="poster-initial">{movie.title.charAt(0)}</span>
              )}
            </div>

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

      {canBrowse && (
        <div className="pick-nav" role="navigation" aria-label="Browse picks">
          <button
            type="button"
            className="pick-arrow"
            onClick={onPrev}
            disabled={!canPrev || busy}
            aria-label="Previous pick"
          >
            ←
          </button>
          <div className="pick-position">
            <span className="pick-position-label">
              {busy ? 'Finding…' : 'Pick'}
            </span>
            <span className="pick-position-value">
              {historyIndex + 1}
              <span className="pick-position-sep">/</span>
              {positionTotal}
            </span>
          </div>
          <button
            type="button"
            className="pick-arrow"
            onClick={onNext}
            disabled={!canNext || busy}
            aria-label="Next pick"
          >
            →
          </button>
        </div>
      )}

      <div className="navrow">
        <button type="button" className="btn btn-back" onClick={onReset}>
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
          <h2 className="step-title">Finding tonight&apos;s pick</h2>
        </div>
        <p className="step-hint">Searching the catalog…</p>
      </div>
      <article className="ticket">
        <div className="ticket-top">
          <div className="ticket-main">
            <div className="movie-poster poster-skeleton" />
            <div className="movie-details">
              <div className="text-skeleton title-skeleton" />
              <div className="text-skeleton meta-skeleton" />
              <div className="text-skeleton" />
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}
