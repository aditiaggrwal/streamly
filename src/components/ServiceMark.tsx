import { useState } from 'react'
import { getStreamingLogoSrc } from '../data/streamingLogos'
import type { StreamingService } from '../types'

interface ServiceMarkProps {
  service: StreamingService
  className?: string
}

export function ServiceMark({
  service,
  className = 'logo',
}: ServiceMarkProps) {
  const src = getStreamingLogoSrc(service.id)
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <span
        className={className}
        style={{ background: service.brandColor }}
        aria-hidden="true"
      >
        {service.shortLabel}
      </span>
    )
  }

  return (
    <span
      className={className}
      style={{ background: service.brandColor }}
      aria-hidden="true"
    >
      <img
        className="svc-mark"
        src={src}
        alt=""
        onError={() => setFailed(true)}
      />
    </span>
  )
}
