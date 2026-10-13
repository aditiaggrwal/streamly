import type { MoodId } from '../types'

/** Mood sets that share a vibe so Surprise me does not mix opposites. */
export const SURPRISE_MOOD_COMBOS: readonly MoodId[][] = [
  ['happy', 'cozy'],
  ['happy', 'cozy', 'nostalgic'],
  ['happy', 'romantic'],
  ['happy', 'nostalgic'],
  ['cozy', 'romantic'],
  ['cozy', 'nostalgic'],
  ['cozy', 'romantic', 'nostalgic'],
  ['cozy', 'thoughtful'],
  ['romantic', 'emotional'],
  ['romantic', 'emotional', 'cozy'],
  ['thoughtful', 'emotional'],
  ['thoughtful', 'nostalgic'],
  ['thoughtful', 'emotional', 'nostalgic'],
  ['adventurous', 'intense'],
  ['adventurous', 'nostalgic'],
  ['adventurous', 'happy'],
  ['intense', 'spooky'],
  ['spooky', 'thoughtful'],
  ['emotional', 'nostalgic'],
]

export function pickSurpriseMoods(random = Math.random): MoodId[] {
  const index = Math.min(
    SURPRISE_MOOD_COMBOS.length - 1,
    Math.floor(random() * SURPRISE_MOOD_COMBOS.length),
  )
  const combo = SURPRISE_MOOD_COMBOS[index] ?? SURPRISE_MOOD_COMBOS[0]
  return [...combo]
}
