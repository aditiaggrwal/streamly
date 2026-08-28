import { GENRES, STREAMING_SERVICES } from '../data/constants'
import { formatRuntime } from '../lib/storage'
import type { ScoredMovie } from '../types'

interface MovieResultProps {
  result: ScoredMovie
  matchCount: number
  onShuffle: () => void
  onReset: () => void
}

export function MovieResult({
  result,
  matchCount,
  onShuffle,
  onReset,
}: MovieResultProps) {
  const { movie, reasons } = result

  const serviceLabels = movie.streamingServices
    .map(
      (id) => STREAMING_SERVICES.find((s) => s.id === id)?.label ?? id,
    )
    .join(' · ')

  return (
    <section className="result-panel">
      <p className="result-kicker">
        Tonight&apos;s pick
        {matchCount > 1 && (
          <span className="match-count">
            {' '}
            · {matchCount} matches found
          </span>
        )}
      </p>

      <article className="movie-card">
        <div
          className="movie-poster"
          style={{ background: `linear-gradient(145deg, ${movie.accent}, #0f0f14)` }}
        >
          <span className="poster-initial">{movie.title.charAt(0)}</span>
        </div>

        <div className="movie-details">
          <h2>{movie.title}</h2>
          <p className="movie-meta">
            {movie.year} · {formatRuntime(movie.runtimeMinutes)} · ★{' '}
            {movie.rating.toFixed(1)}
          </p>
          <p className="movie-overview">{movie.overview}</p>

          <div className="tag-row">
            {movie.genres.map((genre) => (
              <span key={genre} className="tag">
                {GENRES.find((g) => g.id === genre)?.label ?? genre}
              </span>
            ))}
          </div>

          <p className="streaming-line">
            <span className="streaming-label">Watch on</span> {serviceLabels}
          </p>

          <h3 className="reasons-heading">Why this one?</h3>
          <ul className="reasons">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      </article>

      <div className="result-actions">
        {matchCount > 1 && (
          <button type="button" className="btn secondary" onClick={onShuffle}>
            Pick another
          </button>
        )}
        <button type="button" className="btn ghost" onClick={onReset}>
          Adjust filters
        </button>
      </div>
    </section>
  )
}

interface EmptyResultProps {
  onReset: () => void
}

export function EmptyResult({ onReset }: EmptyResultProps) {
  return (
    <section className="result-panel empty">
      <div className="empty-icon" aria-hidden="true">
        🎬
      </div>
      <h2>No matches tonight</h2>
      <p>
        Try selecting more streaming services, loosening your genre picks, or
        choosing a different mood.
      </p>
      <button type="button" className="btn primary" onClick={onReset}>
        Adjust filters
      </button>
    </section>
  )
}
