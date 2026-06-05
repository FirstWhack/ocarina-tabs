import { parseComposerNoteInput } from './noteParser'
import {
  defaultComposerDurationTicks,
  defaultComposerQuantizeTicks,
} from './composerTypes'
import type {
  ComposerAction,
  ComposerDraftNote,
  ComposerState,
} from './composerTypes'

export function createInitialComposerState(): ComposerState {
  return {
    title: 'Untitled ocarina tab',
    notes: [],
    selectedNoteId: undefined,
    defaultDurationTicks: defaultComposerDurationTicks,
    quantizeTicks: defaultComposerQuantizeTicks,
    nextNoteNumber: 1,
    noteInputMessage: undefined,
  }
}

export function composerReducer(
  state: ComposerState,
  action: ComposerAction,
): ComposerState {
  switch (action.type) {
    case 'set-title':
      return { ...state, title: action.title }

    case 'set-default-duration':
      return {
        ...state,
        defaultDurationTicks: normalizeDuration(action.durationTicks, state),
      }

    case 'set-quantize-grid':
      return {
        ...state,
        quantizeTicks: normalizeDuration(action.quantizeTicks, state),
      }

    case 'select-note':
      return { ...state, selectedNoteId: action.noteId }

    case 'append-note':
      return addNotes(state, [
        action.midiNote,
      ], 'end', action.durationTicks)

    case 'insert-note':
      return addNotes(
        state,
        [action.midiNote],
        action.position,
        action.durationTicks,
      )

    case 'delete-selected-note':
      return deleteSelectedNote(state)

    case 'change-selected-note':
      return updateSelectedNote(state, { midiNote: action.midiNote })

    case 'change-selected-duration':
      return updateSelectedNote(state, {
        durationTicks: normalizeDuration(action.durationTicks, state),
      })

    case 'append-text-notes': {
      const parsed = parseComposerNoteInput(action.input, action.profile)

      if (!parsed.valid) {
        return {
          ...state,
          noteInputMessage: { severity: 'error', text: parsed.error },
        }
      }

      return addNotes(
        state,
        parsed.midiNotes,
        'end',
        state.defaultDurationTicks,
        parsed.warning
          ? { severity: 'warning', text: parsed.warning }
          : undefined,
      )
    }

    case 'clear':
      return createInitialComposerState()

    case 'set-parse-error':
      return {
        ...state,
        noteInputMessage: action.parseError
          ? { severity: 'error', text: action.parseError }
          : undefined,
      }

    case 'set-note-input-message':
      return { ...state, noteInputMessage: action.message }
  }
}

export function quantizeDurationTicks(
  durationMs: number,
  quantizeTicks: number,
  ticksPerQuarter: number,
  millisecondsPerQuarter: number,
) {
  const rawTicks = (Math.max(0, durationMs) / millisecondsPerQuarter) * ticksPerQuarter
  const quantizedTicks = Math.round(rawTicks / quantizeTicks) * quantizeTicks

  return Math.max(quantizeTicks, quantizedTicks)
}

function addNotes(
  state: ComposerState,
  midiNotes: readonly number[],
  position: 'end' | 'before-selected' | 'after-selected',
  durationTicks = state.defaultDurationTicks,
  noteInputMessage: ComposerState['noteInputMessage'] = undefined,
): ComposerState {
  const insertIndex = getInsertIndex(state, position)
  const safeDurationTicks = normalizeDuration(durationTicks, state)
  const newNotes = midiNotes.map((midiNote, index) =>
    createDraftNote(
      midiNote,
      safeDurationTicks,
      state.nextNoteNumber + index,
    ),
  )
  const notes = [
    ...state.notes.slice(0, insertIndex),
    ...newNotes,
    ...state.notes.slice(insertIndex),
  ]
  const selectedNoteId = newNotes.at(-1)?.id ?? state.selectedNoteId

  return {
    ...state,
    notes,
    selectedNoteId,
    nextNoteNumber: state.nextNoteNumber + newNotes.length,
    noteInputMessage,
  }
}

function deleteSelectedNote(state: ComposerState): ComposerState {
  if (!state.selectedNoteId) {
    return state
  }

  const selectedIndex = state.notes.findIndex(
    (note) => note.id === state.selectedNoteId,
  )

  if (selectedIndex === -1) {
    return { ...state, selectedNoteId: undefined }
  }

  const notes = state.notes.filter((note) => note.id !== state.selectedNoteId)
  const nextSelectedNote =
    notes[Math.min(selectedIndex, notes.length - 1)] ?? notes.at(-1)

  return {
    ...state,
    notes,
    selectedNoteId: nextSelectedNote?.id,
    noteInputMessage: undefined,
  }
}

function updateSelectedNote(
  state: ComposerState,
  patch: Partial<Pick<ComposerDraftNote, 'midiNote' | 'durationTicks'>>,
): ComposerState {
  if (!state.selectedNoteId) {
    return state
  }

  return {
    ...state,
    notes: state.notes.map((note) =>
      note.id === state.selectedNoteId ? { ...note, ...patch } : note,
    ),
    noteInputMessage: undefined,
  }
}

function getInsertIndex(
  state: ComposerState,
  position: 'end' | 'before-selected' | 'after-selected',
) {
  if (position === 'end' || !state.selectedNoteId) {
    return state.notes.length
  }

  const selectedIndex = state.notes.findIndex(
    (note) => note.id === state.selectedNoteId,
  )

  if (selectedIndex === -1) {
    return state.notes.length
  }

  return position === 'before-selected' ? selectedIndex : selectedIndex + 1
}

function createDraftNote(
  midiNote: number,
  durationTicks: number,
  noteNumber: number,
): ComposerDraftNote {
  return {
    id: `composer-note-${noteNumber}`,
    midiNote,
    durationTicks,
  }
}

function normalizeDuration(durationTicks: number, state: ComposerState) {
  return Number.isFinite(durationTicks) && durationTicks > 0
    ? durationTicks
    : state.defaultDurationTicks
}
