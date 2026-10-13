/**
 * Signed-in users with saved services never see this step — they change
 * services in Settings. Guests skip it for the rest of the visit after
 * picking, until Start over or Back reopens it.
 */
export function shouldSkipServicesStep(
  selectedServiceCount: number,
  servicesStepReopened: boolean,
  signedIn = false,
): boolean {
  if (selectedServiceCount === 0) return false
  if (signedIn) return true
  return !servicesStepReopened
}
