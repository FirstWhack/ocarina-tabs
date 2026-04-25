import { expect, test } from '@playwright/test'
import { createTabDocumentFromMidi } from '../../src/features/midiImport/midiToTabDocument'
import {
  getDefaultTrackSelection,
  getSelectedTrackNotes,
  trimMonophonicLineStart,
} from '../../src/features/midiImport/midiTrackSelection'
import { parseMidiFile } from '../../src/midi/midiParser'
import { createTwinkleOcarinaMidiFile } from '../../src/midi/sampleMidi'
import {
  createMonophonicMidiLine,
} from '../../src/ocarina/ocarinaTab'
import { standard12HoleCOcarinaProfile } from '../../src/ocarina/ocarinaProfile'
import {
  parseSerializedTabDocument,
  serializeTabDocument,
} from '../../src/tabs/tabSerialization'
import {
  createTabLines,
  createTabSections,
  getActiveStepAtPosition,
  getTabDurationMs,
  getVisibleTabSteps,
  transposeTabDocument,
} from '../../src/tabs/tabTransforms'

const profile = standard12HoleCOcarinaProfile

test('MIDI adapter creates the same playable tab as the generated sample', () => {
  const parsedMidi = parseMidiFile(createTwinkleOcarinaMidiFile())
  const selectedTracks = getDefaultTrackSelection(parsedMidi, profile)
  const monophonicLine = trimMonophonicLineStart(
    createMonophonicMidiLine(getSelectedTrackNotes(parsedMidi, selectedTracks)),
  )
  const document = createTabDocumentFromMidi({
    parsedMidi,
    profile,
    fileName: 'Twinkle C5 phrase.mid',
    selectedTracks,
    monophonicLine,
    transpositionSemitones: 0,
  })

  expect(document.schemaVersion).toBe(1)
  expect(document.profileId).toBe(profile.id)
  expect(document.steps).toHaveLength(14)
  expect(document.steps.every((step) => step.fingering)).toBe(true)
  expect(document.steps.map((step) => step.fingering?.noteName)).toEqual([
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

test('canonical tab transforms group, trim, time, and select steps', () => {
  const parsedMidi = parseMidiFile(createTwinkleOcarinaMidiFile())
  const selectedTracks = getDefaultTrackSelection(parsedMidi, profile)
  const monophonicLine = trimMonophonicLineStart(
    createMonophonicMidiLine(getSelectedTrackNotes(parsedMidi, selectedTracks)),
  )
  const document = createTabDocumentFromMidi({
    parsedMidi,
    profile,
    fileName: 'Twinkle C5 phrase.mid',
    selectedTracks,
    monophonicLine,
    transpositionSemitones: 0,
  })

  expect(getVisibleTabSteps(document.steps, true)).toHaveLength(14)
  expect(getTabDurationMs(document.steps)).toBeGreaterThan(0)
  expect(getActiveStepAtPosition(document.steps, 1)?.fingering?.noteName).toBe('C5')
  expect(createTabLines(document.steps, document.ticksPerQuarter)).toHaveLength(2)
  expect(createTabSections(document.steps, document.ticksPerQuarter)).toHaveLength(1)
})

test('tab JSON export and import round-trips a canonical document', () => {
  const parsedMidi = parseMidiFile(createTwinkleOcarinaMidiFile())
  const selectedTracks = getDefaultTrackSelection(parsedMidi, profile)
  const monophonicLine = trimMonophonicLineStart(
    createMonophonicMidiLine(getSelectedTrackNotes(parsedMidi, selectedTracks)),
  )
  const document = createTabDocumentFromMidi({
    parsedMidi,
    profile,
    fileName: 'Twinkle C5 phrase.mid',
    selectedTracks,
    monophonicLine,
    transpositionSemitones: 1,
  })
  const imported = parseSerializedTabDocument(
    serializeTabDocument(document),
    profile,
  )

  expect(imported.schemaVersion).toBe(1)
  expect(imported.profileId).toBe(document.profileId)
  expect(imported.transpositionSemitones).toBe(0)
  expect(imported.steps.map((step) => step.midiNote)).toEqual(
    document.steps.map((step) => step.midiNote),
  )
  expect(imported.steps.map((step) => step.sourceMidiNote)).toEqual(
    document.steps.map((step) => step.midiNote),
  )
  expect(imported.steps.map((step) => step.fingering?.noteName)).toEqual(
    document.steps.map((step) => step.fingering?.noteName),
  )
  expect(serializeTabDocument(imported)).not.toContain('simplificationLevel')
  expect(serializeTabDocument(imported)).not.toContain('"type": "midi"')
})

test('canonical tab document transposition preserves ids and recomputes fingerings', () => {
  const parsedMidi = parseMidiFile(createTwinkleOcarinaMidiFile())
  const selectedTracks = getDefaultTrackSelection(parsedMidi, profile)
  const monophonicLine = trimMonophonicLineStart(
    createMonophonicMidiLine(getSelectedTrackNotes(parsedMidi, selectedTracks)),
  )
  const document = createTabDocumentFromMidi({
    parsedMidi,
    profile,
    fileName: 'Twinkle C5 phrase.mid',
    selectedTracks,
    monophonicLine,
    transpositionSemitones: 1,
  })
  const transposed = transposeTabDocument(profile, document, 2)

  expect(transposed.transpositionSemitones).toBe(2)
  expect(transposed.steps.map((step) => step.id)).toEqual(
    document.steps.map((step) => step.id),
  )
  expect(transposed.steps[0].midiNote).toBe(document.steps[0].sourceMidiNote + 2)
  expect(transposed.steps[0].fingering?.noteName).toBe('D5')

  const unsupported = transposeTabDocument(profile, document, 24)
  expect(unsupported.steps.some((step) => !step.fingering)).toBe(true)
})

test('tab JSON import rejects unsupported schema and malformed timing', () => {
  expect(() =>
    parseSerializedTabDocument(
      JSON.stringify({
        schemaVersion: 999,
        profileId: profile.id,
        ticksPerQuarter: 480,
        transpositionSemitones: 0,
        steps: [],
      }),
      profile,
    ),
  ).toThrow(/Unsupported tab schema version/)

  expect(() =>
    parseSerializedTabDocument(
      JSON.stringify({
        schemaVersion: 1,
        profileId: profile.id,
        ticksPerQuarter: 480,
        transpositionSemitones: 0,
        steps: [
          {
            id: 'bad-step',
            index: 0,
            sourceMidiNote: 72,
            midiNote: 72,
            velocity: 80,
            startTick: 0,
            durationTicks: -1,
            startMs: 0,
            durationMs: 500,
          },
        ],
      }),
      profile,
    ),
  ).toThrow(/durationTicks/)
})

test('old v1 tab JSON with simplifier metadata still imports', () => {
  const parsedMidi = parseMidiFile(createTwinkleOcarinaMidiFile())
  const selectedTracks = getDefaultTrackSelection(parsedMidi, profile)
  const monophonicLine = trimMonophonicLineStart(
    createMonophonicMidiLine(getSelectedTrackNotes(parsedMidi, selectedTracks)),
  )
  const document = createTabDocumentFromMidi({
    parsedMidi,
    profile,
    fileName: 'Twinkle C5 phrase.mid',
    selectedTracks,
    monophonicLine,
    transpositionSemitones: 0,
  })
  const legacyJson = JSON.stringify({
    ...JSON.parse(serializeTabDocument(document)),
    source: {
      type: 'midi',
      fileName: 'Twinkle C5 phrase.mid',
      selectedTracks: [0],
      simplificationLevel: 2,
    },
  })

  expect(parseSerializedTabDocument(legacyJson, profile).steps).toHaveLength(14)
})
