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

  return (
    <section className="panel">
      <div className="panel-header">
        <span className="step">1</span>
        <div>
          <h2>How are you feeling?</h2>
          <p>Select one or more — mix and match if you&apos;re torn.</p>
        </div>
      </div>
      <div className="chip-grid">
        {MOODS.map((mood) => (
          <button
            key={mood.id}
            type="button"
            className={`chip mood-chip ${selected.includes(mood.id) ? 'selected' : ''}`}
            onClick={() => toggle(mood.id)}
            aria-pressed={selected.includes(mood.id)}
          >
            <span className="chip-emoji" aria-hidden="true">
              {mood.emoji}
            </span>
            <span className="chip-label">{mood.label}</span>
            <span className="chip-hint">{mood.description}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
