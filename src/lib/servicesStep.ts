/**
 * Once services are selected, the rest of this visit skips that step.
 * Start over and Back reopen it without clearing the current picks.
 * Guests still lose the list on refresh; that stays the same as main.
 */
export function shouldSkipServicesStep(
  selectedServiceCount: number,
  servicesStepReopened: boolean,
): boolean {
  return selectedServiceCount > 0 && !servicesStepReopened
}
