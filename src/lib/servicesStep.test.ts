import assert from 'node:assert/strict'
import test from 'node:test'
import {
  shouldSkipServicesStep,
  stepAfterSkippingSavedServices,
} from './servicesStep.ts'

test('returning guest with saved services skips the services step', () => {
  assert.equal(shouldSkipServicesStep(2, false), true)
})

test('Start over or Back reopens the services step without dropping saved services', () => {
  assert.equal(shouldSkipServicesStep(2, true), false)
})

test('a guest with no saved services still sees the services step', () => {
  assert.equal(shouldSkipServicesStep(0, false), false)
  assert.equal(shouldSkipServicesStep(0, true), false)
})

test('a reload that restored the services step skips it when services are saved', () => {
  assert.equal(stepAfterSkippingSavedServices('services', 1, false), 'time')
  assert.equal(stepAfterSkippingSavedServices('services', 1, true), 'services')
  assert.equal(stepAfterSkippingSavedServices('result', 1, false), 'result')
  assert.equal(stepAfterSkippingSavedServices('mood', 0, false), 'mood')
})
