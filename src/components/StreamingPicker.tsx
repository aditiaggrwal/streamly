import type { StreamingServiceId } from '../types'
import { STREAMING_SERVICES } from '../data/constants'

interface StreamingPickerProps {
  selected: StreamingServiceId[]
  onChange: (services: StreamingServiceId[]) => void
}

export function StreamingPicker({ selected, onChange }: StreamingPickerProps) {
  function toggle(service: StreamingServiceId) {
    if (selected.includes(service)) {
      onChange(selected.filter((s) => s !== service))
    } else {
      onChange([...selected, service])
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <span className="step">3</span>
        <div>
          <h2>What do you already pay for?</h2>
          <p>Select all the services you have access to.</p>
        </div>
      </div>
      <div className="chip-grid compact">
        {STREAMING_SERVICES.map((service) => (
          <button
            key={service.id}
            type="button"
            className={`chip service-chip ${selected.includes(service.id) ? 'selected' : ''}`}
            onClick={() => toggle(service.id)}
            aria-pressed={selected.includes(service.id)}
          >
            {service.label}
          </button>
        ))}
      </div>
    </section>
  )
}
