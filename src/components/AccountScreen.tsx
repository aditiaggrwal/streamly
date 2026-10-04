import { STREAMING_SERVICES } from '../data/constants'
import { useAuth } from '../context/AuthContext'
import type { StreamingServiceId } from '../types'
import { StreamingPicker } from './StreamingPicker'

interface AccountScreenProps {
  services: StreamingServiceId[]
  onChangeServices: (services: StreamingServiceId[]) => void
  onBack: () => void
}

export function AccountScreen({
  services,
  onChangeServices,
  onBack,
}: AccountScreenProps) {
  const { user, signOut } = useAuth()
  const labels = services
    .map((id) => STREAMING_SERVICES.find((service) => service.id === id)?.label)
    .filter(Boolean)
    .join(', ')

  return (
    <div className="step-body fade">
      <div className="step-head">
        <div className="step-title-row">
          <h2 className="step-title">Account</h2>
        </div>
        <p className="step-hint">
          {user?.email
            ? `Signed in as ${user.email}.`
            : 'Signed in. Your services stay with this account.'}
        </p>
        <p className="counter">
          {labels
            ? `Saved services: ${labels}.`
            : 'No services saved yet — pick at least one below.'}
        </p>
      </div>

      <StreamingPicker
        selected={services}
        onChange={onChangeServices}
        embedded
      />

      <div className="navrow">
        <button type="button" className="btn btn-back" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn btn-back"
          onClick={() => {
            void signOut().then(onBack)
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
