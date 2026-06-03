import { expect, test } from '@playwright/test'
import {
  composerReducer,
  createInitialComposerState,
  quantizeDurationTicks,
} from '../../src/features/composer/composerReducer'
import { createTabDocumentFromComposer } from '../../src/features/composer/composerDocument'
import {
  composerMillisecondsPerQuarter,
  composerTicksPerQuarter,
} from '../../src/features/composer/composerTypes'
import { parseComposerNoteInput } from '../../src/features/composer/noteParser'
import { standard12HoleCOcarinaProfile } from '../../src/ocarina/ocarinaProfile'
import {
  parseSerializedTabDocument,
  serializeTabDocument,
} from '../../src/tabs/tabSerialization'

const profile = standard12HoleCOcarinaProfile

test('composer note parser accepts simple notes and aliases', () => {
  expect(parseComposerNoteInput('C5 D5, Bb4', profile)).toEqual({
    valid: true,
    midiNotes: [72, 74, 70],
  })

  expect(parseComposerNoteInput('C4', profile)).toEqual({
    valid: false,
    error: '"C4" is not a note in the current ocarina profile.',
  })
})

test('composer reducer appends, inserts, edits, deletes, and resequences notes', () => {
  let state = createInitialComposerState()

  state = composerReducer(state, { type: 'append-note', midiNote: 72 })
  state = composerReducer(state, { type: 'append-note', midiNote: 76 })
  state = composerReducer(state, {
    type: 'select-note',
    noteId: state.notes[0].id,
  })
  state = composerReducer(state, {
    type: 'insert-note',
    midiNote: 74,
    position: 'after-selected',
    durationTicks: 480,
  })

  expect(state.notes.map((note) => note.midiNote)).toEqual([72, 74, 76])
  expect(state.selectedNoteId).toBe(state.notes[1].id)

  state = composerReducer(state, { type: 'change-selected-note', midiNote: 79 })
  state = composerReducer(state, {
    type: 'change-selected-duration',
    durationTicks: 960,
  })

  expect(state.notes[1]).toMatchObject({ midiNote: 79, durationTicks: 960 })

  state = composerReducer(state, { type: 'delete-selected-note' })

  expect(state.notes.map((note) => note.midiNote)).toEqual([72, 76])
  expect(state.selectedNoteId).toBe(state.notes[1].id)
})

test('composer timing quantizes recorded durations and exports canonical tabs', () => {
  const durationTicks = quantizeDurationTicks(
    620,
    composerTicksPerQuarter / 2,
    composerTicksPerQuarter,
    composerMillisecondsPerQuarter,
  )
  let state = createInitialComposerState()

  expect(durationTicks).toBe(480)

  state = composerReducer(state, {
    type: 'append-note',
    midiNote: 72,
    durationTicks,
  })
  state = composerReducer(state, {
    type: 'append-text-notes',
    input: 'D5 E5',
    profile,
  })

  const document = createTabDocumentFromComposer(state, profile)
  const imported = parseSerializedTabDocument(serializeTabDocument(document), profile)

  expect(document.source.type).toBe('editor')
  expect(document.steps.map((step) => step.index)).toEqual([0, 1, 2])
  expect(document.steps.map((step) => step.startTick)).toEqual([0, 480, 720])
  expect(imported.steps.map((step) => step.midiNote)).toEqual([72, 74, 76])
})
