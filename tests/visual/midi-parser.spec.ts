import { expect, test } from '@playwright/test'
import { parseMidiFile } from '../../src/midi/midiParser'
import { createTwinkleOcarinaMidiFile } from '../../src/midi/sampleMidi'
import {
  createMonophonicMidiLine,
  createOcarinaTab,
} from '../../src/ocarina/ocarinaTab'
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
  expect(parsedMidi.tracks).toHaveLength(1)
  expect(parsedMidi.tracks[0].name).toBe('Twinkle C5 phrase')
  expect(parsedMidi.tracks[0].noteCount).toBe(14)
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

test('monophonic conversion drops chord notes and clips overlaps', () => {
  const sourceNotes = [
    createNote({ midiNote: 72, startTick: 0, durationTicks: 960 }),
    createNote({ midiNote: 76, startTick: 0, durationTicks: 960 }),
    createNote({ midiNote: 79, startTick: 480, durationTicks: 480 }),
  ]

  const monophonicLine = createMonophonicMidiLine(sourceNotes)

  expect(monophonicLine.sourceNoteCount).toBe(3)
  expect(monophonicLine.droppedChordNotes).toBe(1)
  expect(monophonicLine.clippedOverlapNotes).toBe(1)
  expect(monophonicLine.notes.map((note) => note.midiNote)).toEqual([76, 79])
  expect(monophonicLine.notes[0].durationTicks).toBe(480)
})

test('ocarina tabs retain unsupported notes for visual feedback', () => {
  const tab = createOcarinaTab(profile, [
    createNote({ midiNote: 72, startTick: 0, durationTicks: 480 }),
    createNote({ midiNote: 96, startTick: 480, durationTicks: 480 }),
  ])

  expect(tab).toHaveLength(2)
  expect(tab[0].fingering?.noteName).toBe('C5')
  expect(tab[1].midiNote).toBe(96)
  expect(tab[1].fingering).toBeUndefined()
})

function createNote(options: {
  midiNote: number
  startTick: number
  durationTicks: number
}) {
  return {
    midiNote: options.midiNote,
    velocity: 80,
    track: 0,
    channel: 0,
    startTick: options.startTick,
    durationTicks: options.durationTicks,
    startMs: options.startTick,
    durationMs: options.durationTicks,
  }
}
