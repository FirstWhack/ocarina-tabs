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
): TabDocument {
  return {
    schemaVersion: tabDocumentSchemaVersion,
    id: 'composer-current',
    title: state.title.trim() || 'Untitled ocarina tab',
    profileId: profile.id,
    profileName: profile.name,
    tuning: profile.tuning,
    ticksPerQuarter: composerTicksPerQuarter,
    transpositionSemitones: 0,
    source: { type: 'editor' },
    steps: createTabStepsFromComposerNotes(state.notes, profile),
  }
}

export function createTabStepsFromComposerNotes(
  notes: readonly ComposerDraftNote[],
  profile: OcarinaProfile,
): readonly TabStep[] {
  let startTick = 0

  return notes.map((note, index) => {
    const step = createTabStep(note, profile, index, startTick)
    startTick += note.durationTicks
    return step
  })
}

function createTabStep(
  note: ComposerDraftNote,
  profile: OcarinaProfile,
  index: number,
  startTick: number,
): TabStep {
  const startMs = ticksToMilliseconds(startTick)
  const durationMs = ticksToMilliseconds(note.durationTicks)

  return {
    id: note.id,
    index,
    sourceMidiNote: note.midiNote,
    midiNote: note.midiNote,
    velocity: 88,
    startTick,
    durationTicks: note.durationTicks,
    startMs,
    durationMs,
    fingering: getFingeringForMidiNote(profile, note.midiNote),
  }
}

function ticksToMilliseconds(ticks: number) {
  return (ticks / composerTicksPerQuarter) * composerMillisecondsPerQuarter
}
