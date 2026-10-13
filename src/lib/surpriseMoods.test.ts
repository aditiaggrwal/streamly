import assert from 'node:assert/strict'
import test from 'node:test'
import { MOODS } from '../data/constants.ts'
import { pickSurpriseMoods, SURPRISE_MOOD_COMBOS } from './surpriseMoods.ts'

const VALID = new Set(MOODS.map((mood) => mood.id))

test('surprise combos are 2-3 valid moods', () => {
  for (const combo of SURPRISE_MOOD_COMBOS) {
    assert.ok(combo.length >= 2 && combo.length <= 3)
    assert.equal(new Set(combo).size, combo.length)
    assert.ok(combo.every((id) => VALID.has(id)))
  }
})

test('pickSurpriseMoods returns a known combo', () => {
  const picked = pickSurpriseMoods(() => 0)
  assert.deepEqual(picked, [...SURPRISE_MOOD_COMBOS[0]])
})
