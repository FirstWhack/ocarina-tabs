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

export type MidiSimplificationLevel = 0 | 1 | 2 | 3 | 4 | 5

export type SimplifiedMidiLine = MonophonicMidiLine & {
  simplificationLevel: MidiSimplificationLevel
  droppedSimplifiedNotes: number
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

export function simplifyMonophonicMidiLine(
  monophonicLine: MonophonicMidiLine,
  ticksPerQuarter: number,
  simplificationLevel: MidiSimplificationLevel,
): SimplifiedMidiLine {
  if (simplificationLevel === 0 || monophonicLine.notes.length < 2) {
    return {
      ...monophonicLine,
      simplificationLevel,
      droppedSimplifiedNotes: 0,
    }
  }

  const settings = getSimplificationSettings(simplificationLevel)
  const minimumSpacingTicks = ticksPerQuarter * settings.minimumSpacingBeats
  const shortNoteTicks = ticksPerQuarter * settings.shortNoteBeats
  const keptNotes: MidiNoteEvent[] = [{ ...monophonicLine.notes[0] }]
  let droppedSimplifiedNotes = 0

  for (let index = 1; index < monophonicLine.notes.length; index += 1) {
    const note = monophonicLine.notes[index]
    const previousKeptNote = keptNotes[keptNotes.length - 1]
    const nextNote = monophonicLine.notes[index + 1]
    const startsCloseToPrevious =
      note.startTick - previousKeptNote.startTick <= minimumSpacingTicks
    const isShort = note.durationTicks <= shortNoteTicks
    const returnsToPrevious =
      nextNote?.midiNote === previousKeptNote.midiNote &&
      Math.abs(note.midiNote - previousKeptNote.midiNote) <=
        settings.neighborSemitones
    const isNeighborOrnament =
      Math.abs(note.midiNote - previousKeptNote.midiNote) <=
      settings.neighborSemitones
    const shouldDrop =
      (startsCloseToPrevious && (isShort || isNeighborOrnament)) ||
      (isShort && returnsToPrevious)

    if (shouldDrop) {
      droppedSimplifiedNotes += 1
      stretchNoteToCover(previousKeptNote, note)
      continue
    }

    if (
      previousKeptNote.startTick + previousKeptNote.durationTicks >
      note.startTick
    ) {
      previousKeptNote.durationTicks = Math.max(
        0,
        note.startTick - previousKeptNote.startTick,
      )
      previousKeptNote.durationMs = Math.max(
        0,
        note.startMs - previousKeptNote.startMs,
      )
    }

    keptNotes.push({ ...note })
  }

  return {
    ...monophonicLine,
    notes: keptNotes,
    simplificationLevel,
    droppedSimplifiedNotes,
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

function getSimplificationSettings(
  simplificationLevel: Exclude<MidiSimplificationLevel, 0>,
) {
  switch (simplificationLevel) {
    case 1:
      return {
        minimumSpacingBeats: 0.125,
        shortNoteBeats: 0.125,
        neighborSemitones: 1,
      }
    case 2:
      return {
        minimumSpacingBeats: 0.167,
        shortNoteBeats: 0.167,
        neighborSemitones: 2,
      }
    case 3:
      return {
        minimumSpacingBeats: 0.25,
        shortNoteBeats: 0.25,
        neighborSemitones: 2,
      }
    case 4:
      return {
        minimumSpacingBeats: 0.375,
        shortNoteBeats: 0.333,
        neighborSemitones: 3,
      }
    case 5:
      return {
        minimumSpacingBeats: 0.5,
        shortNoteBeats: 0.5,
        neighborSemitones: 4,
      }
  }
}

function stretchNoteToCover(noteToStretch: MidiNoteEvent, noteToCover: MidiNoteEvent) {
  const stretchedEndTick = Math.max(
    noteToStretch.startTick + noteToStretch.durationTicks,
    noteToCover.startTick + noteToCover.durationTicks,
  )
  const stretchedEndMs = Math.max(
    noteToStretch.startMs + noteToStretch.durationMs,
    noteToCover.startMs + noteToCover.durationMs,
  )

  noteToStretch.durationTicks = Math.max(0, stretchedEndTick - noteToStretch.startTick)
  noteToStretch.durationMs = Math.max(0, stretchedEndMs - noteToStretch.startMs)
}
