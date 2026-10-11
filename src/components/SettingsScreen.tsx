import { useEffect, useState } from 'react'
import { STREAMING_SERVICES } from '../data/constants'
import { useAuth } from '../context/AuthContext'
import type { StreamingServiceId } from '../types'
import { StreamingPicker } from './StreamingPicker'

interface SettingsScreenProps {
  services: StreamingServiceId[]
  onChangeServices: (services: StreamingServiceId[]) => void
  onBack: () => void
}

function sameServices(a: StreamingServiceId[], b: StreamingServiceId[]) {
  if (a.length !== b.length) return false
  const left = [...a].sort()
  const right = [...b].sort()
  return left.every((id, index) => id === right[index])
}

export function SettingsScreen({
  services,
  onChangeServices,
  onBack,
}: SettingsScreenProps) {
  const { persistServices } = useAuth()
  const [draft, setDraft] = useState<StreamingServiceId[]>(services)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const dirty = !sameServices(draft, services)
  const canSave = draft.length > 0 && !saving

  useEffect(() => {
    setDraft(services)
  }, [services])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onBack])

  const labels = draft
    .map((id) => STREAMING_SERVICES.find((service) => service.id === id)?.label)
    .filter(Boolean)
    .join(', ')

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setSaved(false)
    try {
      onChangeServices(draft)
      await persistServices(draft)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="account-overlay">
      <button
        type="button"
        className="results-panel-backdrop account-backdrop"
        onClick={onBack}
        aria-label="Close settings"
      />
      <aside
        className="results-panel settings-panel"
        role="dialog"
        aria-labelledby="settings-title"
      >
        <button
          type="button"
          className="results-panel-close"
          onClick={onBack}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.85"
              strokeLinecap="round"
              d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"
            />
          </svg>
        </button>
        <div className="step-head">
          <div className="step-title-row">
            <h2 id="settings-title" className="step-title">
              Settings
            </h2>
          </div>
          <p className="step-hint">
            Choose the services you already have. We&apos;ll only pick movies
            you can watch there.
          </p>
          <p className="counter">
            {labels
              ? `Selected: ${labels}.`
              : 'Choose at least one, then save.'}
          </p>
        </div>

        <StreamingPicker selected={draft} onChange={setDraft} embedded />

        <div className="navrow navrow-full">
          <button
            type="button"
            className="btn btn-next"
            onClick={() => void handleSave()}
            disabled={!canSave}
          >
            {saving ? 'Saving…' : saved && !dirty ? 'Saved' : 'Save'}
          </button>
        </div>
      </aside>
    </div>
  )
}
