import { getFingeringForMidiNote } from '../../ocarina/ocarinaProfile'
import type { OcarinaProfile } from '../../ocarina/ocarinaProfile'
import type { TabDocument, TabStep } from '../../tabs/tabTypes'
import { tabDocumentSchemaVersion } from '../../tabs/tabTypes'
import {
  composerMillisecondsPerQuarter,
  composerTicksPerQuarter,
} from './composerTypes'
import type { ComposerDraftNote, ComposerState } from './composerTypes'

export function createTabDocumentFromComposer(
  state: ComposerState,
  profile: OcarinaProfile,
  transpositionSemitones = 0,
): TabDocument {
  return {
    schemaVersion: tabDocumentSchemaVersion,
    id: 'composer-current',
    title: state.title.trim() || 'Untitled ocarina tab',
    profileId: profile.id,
    profileName: profile.name,
    tuning: profile.tuning,
    ticksPerQuarter: composerTicksPerQuarter,
    transpositionSemitones,
    source: { type: 'editor' },
    steps: createTabStepsFromComposerNotes(
      state.notes,
      profile,
      transpositionSemitones,
    ),
  }
}

export function createTabStepsFromComposerNotes(
  notes: readonly ComposerDraftNote[],
  profile: OcarinaProfile,
  transpositionSemitones = 0,
): readonly TabStep[] {
  let startTick = 0

  return notes.map((note, index) => {
    const step = createTabStep(
      note,
      profile,
      index,
      startTick,
      transpositionSemitones,
    )
    startTick += note.durationTicks
    return step
  })
}

function createTabStep(
  note: ComposerDraftNote,
  profile: OcarinaProfile,
  index: number,
  startTick: number,
  transpositionSemitones: number,
): TabStep {
  const startMs = ticksToMilliseconds(startTick)
  const durationMs = ticksToMilliseconds(note.durationTicks)
  const midiNote = note.midiNote + transpositionSemitones

  return {
    id: note.id,
    index,
    sourceMidiNote: note.midiNote,
    midiNote,
    velocity: 88,
    startTick,
    durationTicks: note.durationTicks,
    startMs,
    durationMs,
    fingering: getFingeringForMidiNote(profile, midiNote),
  }
}

function ticksToMilliseconds(ticks: number) {
  return (ticks / composerTicksPerQuarter) * composerMillisecondsPerQuarter
}
