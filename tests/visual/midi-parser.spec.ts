import { expect, test } from '@playwright/test'
import { parseMidiFile } from '../../src/midi/midiParser'
import { createTwinkleOcarinaMidiFile } from '../../src/midi/sampleMidi'
import { createOcarinaTab } from '../../src/ocarina/ocarinaTab'
import {
  analyzeMidiRangeFit,
  standard12HoleCOcarinaProfile,
} from '../../src/ocarina/ocarinaProfile'

const profile = standard12HoleCOcarinaProfile

test('sample MIDI parses into a playable ocarina tab', () => {
  const parsedMidi = parseMidiFile(createTwinkleOcarinaMidiFile())
  const midiNotes = parsedMidi.noteEvents.map((note) => note.midiNote)
  const rangeFit = analyzeMidiRangeFit(profile, midiNotes)
  const tab = createOcarinaTab(profile, parsedMidi.noteEvents)

  expect(parsedMidi.format).toBe(0)
  expect(parsedMidi.trackCount).toBe(1)
  expect(parsedMidi.ticksPerQuarter).toBe(480)
  expect(parsedMidi.noteEvents).toHaveLength(14)
  expect(rangeFit.status).toBe('direct')
  expect(tab.every((step) => step.fingering)).toBe(true)
  expect(tab.map((step) => step.fingering?.noteName)).toEqual([
    'C5',
    'C5',
    'G5',
    'G5',
    'A5',
    'A5',
    'G5',
    'F5',
    'F5',
    'E5',
    'E5',
    'D5',
    'D5',
    'C5',
  ])
})
