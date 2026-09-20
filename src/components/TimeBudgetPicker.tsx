import type { ChangeEvent } from 'react'
import { TIME_BUDGET_OPTIONS } from '../data/constants'

interface TimeBudgetPickerProps {
  maxRuntimeMinutes: number | null
  onChange: (maxRuntimeMinutes: number | null) => void
}

function indexForValue(maxRuntimeMinutes: number | null): number {
  const index = TIME_BUDGET_OPTIONS.findIndex(
    (option) => option.maxRuntimeMinutes === maxRuntimeMinutes,
  )
  return index === -1 ? TIME_BUDGET_OPTIONS.length - 1 : index
}

export function TimeBudgetPicker({
  maxRuntimeMinutes,
  onChange,
}: TimeBudgetPickerProps) {
  const selectedIndex = indexForValue(maxRuntimeMinutes)
  const selected = TIME_BUDGET_OPTIONS[selectedIndex]

  function handleSliderChange(event: ChangeEvent<HTMLInputElement>) {
    const index = Number(event.target.value)
    const option = TIME_BUDGET_OPTIONS[index]
    if (option) onChange(option.maxRuntimeMinutes)
  }

  return (
    <div className="step-body fade">
      <div className="step-head">
        <div className="step-title-row">
          <h2 className="step-title">How long do you have?</h2>
        </div>
        <p className="step-hint">
          We&apos;ll skip movies that run longer than your window.
        </p>
      </div>

      <div className="time-budget">
        <p className="time-budget-value" aria-live="polite">
          {selected.label}
        </p>

        <div className="time-budget-slider-wrap">
          <input
            type="range"
            className="time-budget-slider"
            min={0}
            max={TIME_BUDGET_OPTIONS.length - 1}
            step={1}
            value={selectedIndex}
            onChange={handleSliderChange}
            aria-valuemin={0}
            aria-valuemax={TIME_BUDGET_OPTIONS.length - 1}
            aria-valuenow={selectedIndex}
            aria-valuetext={selected.label}
          />
          <div className="time-budget-stops" aria-hidden="true">
            {TIME_BUDGET_OPTIONS.map((option, index) => (
              <span
                key={option.shortLabel}
                className={`time-budget-stop${index === selectedIndex ? ' active' : ''}`}
              >
                {option.shortLabel}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
