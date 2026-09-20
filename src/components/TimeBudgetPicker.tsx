import type { CSSProperties, SyntheticEvent } from 'react'
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

function fillPercent(selectedIndex: number): number {
  if (TIME_BUDGET_OPTIONS.length <= 1) return 100
  return (selectedIndex / (TIME_BUDGET_OPTIONS.length - 1)) * 100
}

export function TimeBudgetPicker({
  maxRuntimeMinutes,
  onChange,
}: TimeBudgetPickerProps) {
  const selectedIndex = indexForValue(maxRuntimeMinutes)
  const selected = TIME_BUDGET_OPTIONS[selectedIndex]
  const sliderStyle = {
    '--time-fill': `${fillPercent(selectedIndex)}%`,
  } as CSSProperties

  function handleSliderInput(event: SyntheticEvent<HTMLInputElement>) {
    const index = Number(event.currentTarget.value)
    const option = TIME_BUDGET_OPTIONS[index]
    if (option) onChange(option.maxRuntimeMinutes)
  }

  function selectStop(index: number) {
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

        <div className="time-budget-slider-wrap" style={sliderStyle}>
          <input
            type="range"
            className="time-budget-slider"
            min={0}
            max={TIME_BUDGET_OPTIONS.length - 1}
            step={1}
            value={selectedIndex}
            onInput={handleSliderInput}
            onChange={handleSliderInput}
            aria-valuemin={0}
            aria-valuemax={TIME_BUDGET_OPTIONS.length - 1}
            aria-valuenow={selectedIndex}
            aria-valuetext={selected.label}
          />
          <div className="time-budget-stops">
            {TIME_BUDGET_OPTIONS.map((option, index) => (
              <button
                key={option.shortLabel}
                type="button"
                className={`time-budget-stop${index === selectedIndex ? ' active' : ''}`}
                onClick={() => selectStop(index)}
                aria-pressed={index === selectedIndex}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
