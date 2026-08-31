import type { StreamingServiceId } from '../types'

/**
 * Original Streamly geometric marks (not official trademark lockups).
 * Missing files fall back to the service shortLabel in the UI.
 */
const logoModules = import.meta.glob('../assets/streaming/*.svg', {
  eager: true,
  import: 'default',
}) as Record<string, string>

export function getStreamingLogoSrc(
  id: StreamingServiceId,
): string | undefined {
  return logoModules[`../assets/streaming/${id}.svg`]
}
