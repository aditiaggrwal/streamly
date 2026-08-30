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
      ? 'Pick 1–3 for the sharpest match.'
      : count <= 3
        ? `${count} selected — nice range.`
        : `${count} selected — that's a lot of moods, results may get broad.`

  return (
    <div className="step-body fade">
      <div className="step-head">
        <div className="step-title-row">
          <h2 className="step-title">How are you feeling?</h2>
          <span className="tag required">Required</span>
        </div>
        <p className="step-hint">
          Select one or more — mix and match if you&apos;re torn.
        </p>
        <p className="counter">{counterHint}</p>
      </div>

      <div className="grid moods">
        {MOODS.map((mood) => (
          <button
            key={mood.id}
            type="button"
            className={`card-btn${selected.includes(mood.id) ? ' selected' : ''}`}
            onClick={() => toggle(mood.id)}
            aria-pressed={selected.includes(mood.id)}
          >
            <span className="check" aria-hidden="true">
              ✓
            </span>
            <span className="emoji" aria-hidden="true">
              {mood.emoji}
            </span>
            <span className="label">{mood.label}</span>
            <span className="desc">{mood.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
