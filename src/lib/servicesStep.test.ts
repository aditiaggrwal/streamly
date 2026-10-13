import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldSkipServicesStep } from './servicesStep.ts'

test('selected services skip the services step for the rest of the visit', () => {
  assert.equal(shouldSkipServicesStep(2, false), true)
})

test('Start over or Back reopens the services step for guests', () => {
  assert.equal(shouldSkipServicesStep(2, true), false)
})

test('signed-in users with saved services never see the services step', () => {
  assert.equal(shouldSkipServicesStep(2, true, true), true)
  assert.equal(shouldSkipServicesStep(2, false, true), true)
})

test('no selected services still shows the services step', () => {
  assert.equal(shouldSkipServicesStep(0, false), false)
  assert.equal(shouldSkipServicesStep(0, true), false)
  assert.equal(shouldSkipServicesStep(0, false, true), false)
})
