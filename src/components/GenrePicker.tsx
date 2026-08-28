import type { GenreId } from '../types'
import { GENRES } from '../data/constants'

interface GenrePickerProps {
  selected: GenreId[]
  onChange: (genres: GenreId[]) => void
  familyFriendly: boolean
  onFamilyFriendlyChange: (value: boolean) => void
}

export function GenrePicker({
  selected,
  onChange,
  familyFriendly,
  onFamilyFriendlyChange,
}: GenrePickerProps) {
  function toggle(genre: GenreId) {
    if (selected.includes(genre)) {
      onChange(selected.filter((g) => g !== genre))
    } else {
      onChange([...selected, genre])
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <span className="step">2</span>
        <div>
          <h2>Any genre in mind?</h2>
          <p>Select any that sound good — or skip for more variety.</p>
        </div>
      </div>

      <button
        type="button"
        className={`family-toggle${familyFriendly ? ' selected' : ''}`}
        onClick={() => onFamilyFriendlyChange(!familyFriendly)}
        aria-pressed={familyFriendly}
      >
        <span className="family-toggle-emoji" aria-hidden="true">
          👨‍👩‍👧‍👦
        </span>
        <span className="family-toggle-copy">
          <span className="family-toggle-label">Family friendly</span>
          <span className="family-toggle-hint">
            Skip scary and adult-heavy picks
          </span>
        </span>
        <span
          className={`toggle-switch${familyFriendly ? ' on' : ''}`}
          aria-hidden="true"
        >
          <span className="toggle-knob" />
        </span>
      </button>

      <div className="chip-grid compact">
        {GENRES.map((genre) => (
          <button
            key={genre.id}
            type="button"
            className={`chip genre-chip ${selected.includes(genre.id) ? 'selected' : ''}`}
            onClick={() => toggle(genre.id)}
            aria-pressed={selected.includes(genre.id)}
          >
            {genre.label}
          </button>
        ))}
      </div>
    </section>
  )
}
