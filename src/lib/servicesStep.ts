import type { WizardStep } from '../types'

/**
 * Saved services skip the services step on a normal visit, including after
 * refresh. Start over and Back reopen that step without clearing the list.
 */
export function shouldSkipServicesStep(
  savedServiceCount: number,
  servicesStepReopened: boolean,
): boolean {
  return savedServiceCount > 0 && !servicesStepReopened
}

/** A restored services step should not stick when those services are already saved. */
export function stepAfterSkippingSavedServices(
  step: WizardStep,
  savedServiceCount: number,
  servicesStepReopened: boolean,
): WizardStep {
  if (
    step === 'services' &&
    shouldSkipServicesStep(savedServiceCount, servicesStepReopened)
  ) {
    return 'time'
  }
  return step
}
