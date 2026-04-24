import { expect, test } from '@playwright/test'
import {
  analyzeMidiRangeFit,
  analyzeMidiNotes,
  findPlayableTranspositions,
  findCompatibleTranspositions,
  getFingeringForMidiNote,
  getPlayableRange,
  standard12HoleCOcarinaProfile,
} from '../../src/ocarina/ocarinaProfile'

const profile = standard12HoleCOcarinaProfile

test('playable notes return mapped fingerings', () => {
  const lowA = getFingeringForMidiNote(profile, 69)
  const middleC = getFingeringForMidiNote(profile, 72)
  const fSharp = getFingeringForMidiNote(profile, 78)

  expect(lowA?.noteName).toBe('A4')
  expect(lowA?.filledHoles).toContain('subhole-1')
  expect(lowA?.filledHoles).toContain('subhole-2')
  expect(middleC?.noteName).toBe('C5')
  expect(middleC?.filledHoles).toContain('left-index')
  expect(middleC?.filledHoles).not.toContain('subhole-1')
  expect(middleC?.filledHoles).not.toContain('subhole-2')
  expect(fSharp?.noteName).toBe('F#5')
  expectHoleSet(fSharp?.filledHoles, [
    'left-thumb',
    'right-thumb',
    'left-index',
    'left-middle',
    'left-ring',
    'left-pinky',
    'right-ring',
  ])
})

test('notes outside the profile range are unsupported', () => {
  const range = getPlayableRange(profile)
  const analysis = analyzeMidiNotes(profile, [68, 69, 89, 90])

  expect(range.lowest.midiNote).toBe(69)
  expect(range.highest.midiNote).toBe(89)
  expect(getFingeringForMidiNote(profile, 68)).toBeUndefined()
  expect(getFingeringForMidiNote(profile, 90)).toBeUndefined()
  expect(analysis.playable).toBe(false)
  expect(analysis.unsupportedMidiNotes).toEqual([68, 90])
})

test('transposition suggestions prefer the smallest playable shift', () => {
  const lowMelodySuggestions = findPlayableTranspositions(profile, [68, 70])
  const highMelodySuggestions = findPlayableTranspositions(profile, [88, 90])
  const alreadyPlayableSuggestions = findPlayableTranspositions(profile, [69, 72])

  expect(lowMelodySuggestions[0]?.semitones).toBe(1)
  expect(highMelodySuggestions[0]?.semitones).toBe(-1)
  expect(alreadyPlayableSuggestions[0]?.semitones).toBe(0)
})

test('range fit treats transposable notes as playable for tab generation', () => {
  const analysis = analyzeMidiRangeFit(profile, [67, 69, 72])

  expect(analysis.status).toBe('transposable')
  expect(analysis.bestTransposition?.semitones).toBe(2)
  expect(analysis.unsupportedMidiNotes).toEqual([])
  expect(analysis.sourceRange).toEqual({
    lowestMidiNote: 67,
    highestMidiNote: 72,
    spanSemitones: 5,
  })
})

test('range fit reports unsupported notes when no transposition can fit', () => {
  const analysis = analyzeMidiRangeFit(profile, [48, 72, 96])

  expect(analysis.status).toBe('unplayable')
  expect(analysis.bestTransposition).toBeUndefined()
  expect(analysis.bestCompatibleTransposition?.semitones).toBe(0)
  expect(analysis.bestCompatibleTransposition?.playableNoteCount).toBe(1)
  expect(analysis.unsupportedMidiNotes).toEqual([48, 96])
})

test('compatible transpositions return the best partial fit', () => {
  const suggestions = findCompatibleTranspositions(profile, [60, 72, 84, 96])

  expect(suggestions[0]?.semitones).toBe(0)
  expect(suggestions[0]?.playableNoteCount).toBe(2)
  expect(suggestions[0]?.unsupportedNoteCount).toBe(2)
})

test('upper natural notes keep the left pinky anchor until high F', () => {
  expectHoleSet(getFingeringForMidiNote(profile, 81)?.filledHoles, [
    'left-thumb',
    'right-thumb',
    'left-index',
    'left-middle',
    'left-pinky',
  ])
  expectHoleSet(getFingeringForMidiNote(profile, 84)?.filledHoles, [
    'left-thumb',
    'right-thumb',
    'left-pinky',
  ])
  expectHoleSet(getFingeringForMidiNote(profile, 89)?.filledHoles, [])
})

function expectHoleSet(
  actual: readonly string[] | undefined,
  expected: readonly string[],
) {
  expect([...(actual ?? [])].sort()).toEqual([...expected].sort())
}
