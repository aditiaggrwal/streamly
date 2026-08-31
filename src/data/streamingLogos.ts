import type { StreamingServiceId } from '../types'

/**
 * Simple identification marks (Simple Icons / wordless brand shapes).
 * Not official trademark lockups. Missing files fall back to shortLabel.
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
