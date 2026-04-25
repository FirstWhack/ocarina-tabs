import type {
  OcarinaFingering,
  OcarinaProfile,
} from './ocarinaProfile'
import { getFingeringForMidiNote } from './ocarinaProfile'
import type { MidiNoteEvent } from '../midi/midiParser'

export type MonophonicMidiLine = {
  notes: readonly MidiNoteEvent[]
  sourceNoteCount: number
  droppedChordNotes: number
  clippedOverlapNotes: number
}

export type OcarinaTabStep = {
  index: number
  sourceMidiNote: number
  midiNote: number
  velocity: number
  startTick: number
  durationTicks: number
  startMs: number
  durationMs: number
  fingering: OcarinaFingering | undefined
}

export function createMonophonicMidiLine(
  notes: readonly MidiNoteEvent[],
): MonophonicMidiLine {
  const notesByStartTick = new Map<number, MidiNoteEvent[]>()

  for (const note of notes) {
    const notesAtTick = notesByStartTick.get(note.startTick) ?? []
    notesAtTick.push(note)
    notesByStartTick.set(note.startTick, notesAtTick)
  }

  const selectedNotes = [...notesByStartTick.entries()]
    .sort(([leftTick], [rightTick]) => leftTick - rightTick)
    .map(([, notesAtTick]) => chooseMelodyNote(notesAtTick))
  let clippedOverlapNotes = 0
  const monophonicNotes = selectedNotes.map((note, index) => {
    const nextNote = selectedNotes[index + 1]
    const noteEndTick = note.startTick + note.durationTicks

    if (!nextNote || noteEndTick <= nextNote.startTick) {
      return note
    }

    clippedOverlapNotes += 1

    return {
      ...note,
      durationTicks: Math.max(0, nextNote.startTick - note.startTick),
      durationMs: Math.max(0, nextNote.startMs - note.startMs),
    }
  })

  return {
    notes: monophonicNotes,
    sourceNoteCount: notes.length,
    droppedChordNotes: notes.length - selectedNotes.length,
    clippedOverlapNotes,
  }
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
      velocity: note.velocity,
      startTick: note.startTick,
      durationTicks: note.durationTicks,
      startMs: note.startMs,
      durationMs: note.durationMs,
      fingering: getFingeringForMidiNote(profile, midiNote),
    }
  })
}

function chooseMelodyNote(notes: readonly MidiNoteEvent[]) {
  return [...notes].sort(
    (left, right) =>
      right.midiNote - left.midiNote ||
      right.velocity - left.velocity ||
      right.durationTicks - left.durationTicks,
  )[0]
}
