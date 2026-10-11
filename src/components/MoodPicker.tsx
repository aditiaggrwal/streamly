import type { MoodId } from '../types'
import { MOODS } from '../data/constants'

interface MoodPickerProps {
  selected: MoodId[]
  onChange: (moods: MoodId[]) => void
}

export function MoodPicker({ selected, onChange }: MoodPickerProps) {
  function toggle(mood: MoodId) {
    if (selected.includes(mood)) {
      onChange(selected.filter((m) => m !== mood))
    } else {
      onChange([...selected, mood])
    }
  }

  const count = selected.length
  const counterHint =
    count === 0
      ? 'Up to three moods works best.'
      : count <= 3
        ? `${count} selected.`
        : `${count} selected — matches may get mixed.`

  return (
    <div className="step-body fade">
      <div className="step-head">
        <div className="step-title-row">
          <h2 className="step-title">How are you feeling?</h2>
          <span className="tag required">Required</span>
        </div>
        <p className="step-hint">Pick one or a few.</p>
        <p className="counter">{counterHint}</p>
      </div>

      <div className="grid moods">
        {MOODS.map((mood) => (
          <button
            key={mood.id}
            type="button"
            className={`card-btn mood-card${selected.includes(mood.id) ? ' selected' : ''}`}
            onClick={() => toggle(mood.id)}
            aria-pressed={selected.includes(mood.id)}
          >
            <span className="check" aria-hidden="true">
              ✓
            </span>
            <span
              className="mood-card-thumb"
              style={{ background: mood.thumbnail }}
              aria-hidden="true"
            >
              <span className="mood-card-title">{mood.label}</span>
            </span>
            <span className="mood-card-body">
              <span className="desc">{mood.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
