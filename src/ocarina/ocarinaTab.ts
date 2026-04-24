import type {
  OcarinaFingering,
  OcarinaProfile,
} from './ocarinaProfile'
import { getFingeringForMidiNote } from './ocarinaProfile'
import type { MidiNoteEvent } from '../midi/midiParser'

export type OcarinaTabStep = {
  index: number
  sourceMidiNote: number
  midiNote: number
  startMs: number
  durationMs: number
  fingering: OcarinaFingering | undefined
}

export function createOcarinaTab(
  profile: OcarinaProfile,
  notes: readonly MidiNoteEvent[],
  options: {
    transpositionSemitones?: number
  } = {},
): readonly OcarinaTabStep[] {
  const transpositionSemitones = options.transpositionSemitones ?? 0

  return notes.map((note, index) => {
    const midiNote = note.midiNote + transpositionSemitones

    return {
      index,
      sourceMidiNote: note.midiNote,
      midiNote,
      startMs: note.startMs,
      durationMs: note.durationMs,
      fingering: getFingeringForMidiNote(profile, midiNote),
    }
  })
}
