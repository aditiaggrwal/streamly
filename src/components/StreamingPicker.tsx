import type { StreamingServiceId } from '../types'
import { STREAMING_SERVICES } from '../data/constants'
import { ServiceMark } from './ServiceMark'

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

  const count = selected.length

  return (
    <div className="step-body fade">
      <div className="step-head">
        <div className="step-title-row">
          <h2 className="step-title">What do you already pay for?</h2>
          <span className="tag required">Required</span>
        </div>
        <p className="step-hint">
          This is how we make sure your pick is actually watchable tonight.
        </p>
        <p className="counter">
          {count === 0
            ? 'Select at least one service.'
            : `${count} service${count > 1 ? 's' : ''} selected.`}
        </p>
      </div>

      <div className="grid services">
        {STREAMING_SERVICES.map((service) => (
          <button
            key={service.id}
            type="button"
            className={`card-btn svc-btn${selected.includes(service.id) ? ' selected' : ''}`}
            onClick={() => toggle(service.id)}
            aria-pressed={selected.includes(service.id)}
          >
            <span className="check" aria-hidden="true">
              ✓
            </span>
            <ServiceMark service={service} />
            <span className="svc-name">{service.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
