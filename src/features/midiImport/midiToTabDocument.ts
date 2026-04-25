import type { OcarinaProfile } from '../../ocarina/ocarinaProfile'
import { createOcarinaTab } from '../../ocarina/ocarinaTab'
import type { MidiSimplificationLevel, MonophonicMidiLine, SimplifiedMidiLine } from '../../ocarina/ocarinaTab'
import type { ParsedMidiFile } from '../../midi/midiParser'
import type { TabDocument, TabStep } from '../../tabs/tabTypes'
import { tabDocumentSchemaVersion } from '../../tabs/tabTypes'
import type { TrackSelection } from './midiImportTypes'

export type MidiTabBuildInput = {
  parsedMidi: ParsedMidiFile
  profile: OcarinaProfile
  fileName: string
  selectedTracks: TrackSelection
  monophonicLine: MonophonicMidiLine
  simplifiedLine: SimplifiedMidiLine
  simplificationLevel: MidiSimplificationLevel
  transpositionSemitones: number
}

export function createTabDocumentFromMidi(input: MidiTabBuildInput): TabDocument {
  const tabSteps = createOcarinaTab(input.profile, input.simplifiedLine.notes, {
    transpositionSemitones: input.transpositionSemitones,
  })

  return {
    schemaVersion: tabDocumentSchemaVersion,
    id: createMidiTabDocumentId(input.fileName),
    title: input.fileName.replace(/\.midi?$/i, ''),
    profileId: input.profile.id,
    profileName: input.profile.name,
    tuning: input.profile.tuning,
    ticksPerQuarter: input.parsedMidi.ticksPerQuarter,
    transpositionSemitones: input.transpositionSemitones,
    source: {
      type: 'midi',
      fileName: input.fileName,
      selectedTracks: input.selectedTracks,
      simplificationLevel: input.simplificationLevel,
    },
    steps: tabSteps.map(toTabStep),
  }
}

function toTabStep(step: ReturnType<typeof createOcarinaTab>[number]): TabStep {
  return {
    ...step,
    id: `step-${step.index}-${step.startTick}-${step.midiNote}`,
  }
}

function createMidiTabDocumentId(fileName: string) {
  return `midi-${fileName.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`
}
