import type { OcarinaProfile } from '../../ocarina/ocarinaProfile'

export const composerTicksPerQuarter = 480
export const composerMillisecondsPerQuarter = 500
export const defaultComposerDurationTicks = composerTicksPerQuarter / 2
export const defaultComposerQuantizeTicks = composerTicksPerQuarter / 2

export const composerDurationOptions = [
  { label: 'Sixteenth', ticks: composerTicksPerQuarter / 4 },
  { label: 'Eighth', ticks: composerTicksPerQuarter / 2 },
  { label: 'Quarter', ticks: composerTicksPerQuarter },
  { label: 'Half', ticks: composerTicksPerQuarter * 2 },
] as const

export type ComposerDraftNote = {
  id: string
  midiNote: number
  durationTicks: number
}

export type ComposerState = {
  title: string
  notes: readonly ComposerDraftNote[]
  selectedNoteId: string | undefined
  defaultDurationTicks: number
  quantizeTicks: number
  nextNoteNumber: number
  noteInputMessage: ComposerMessage | undefined
}

export type ComposerInsertPosition = 'end' | 'before-selected' | 'after-selected'

export type ComposerMessage = {
  severity: 'error' | 'warning'
  text: string
}

export type ComposerAction =
  | {
      type: 'set-title'
      title: string
    }
  | {
      type: 'set-default-duration'
      durationTicks: number
    }
  | {
      type: 'set-quantize-grid'
      quantizeTicks: number
    }
  | {
      type: 'select-note'
      noteId: string | undefined
    }
  | {
      type: 'append-note'
      midiNote: number
      durationTicks?: number
    }
  | {
      type: 'insert-note'
      midiNote: number
      position: ComposerInsertPosition
      durationTicks?: number
    }
  | {
      type: 'delete-selected-note'
    }
  | {
      type: 'change-selected-note'
      midiNote: number
    }
  | {
      type: 'change-selected-duration'
      durationTicks: number
    }
  | {
      type: 'append-text-notes'
      input: string
      profile: OcarinaProfile
    }
  | {
      type: 'clear'
    }
  | {
      type: 'set-parse-error'
      parseError: string | undefined
    }
  | {
      type: 'set-note-input-message'
      message: ComposerMessage | undefined
    }
