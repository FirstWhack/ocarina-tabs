import type { OcarinaFingering } from '../ocarina/ocarinaProfile'

export const tabDocumentSchemaVersion = 1

export type TabDocumentSchemaVersion = typeof tabDocumentSchemaVersion

export type TabDocumentSource =
  | {
      type: 'midi'
      fileName: string
      selectedTracks: readonly number[]
      simplificationLevel: number
    }
  | {
      type: 'imported'
      fileName?: string
    }
  | {
      type: 'editor'
    }

export type TabStep = {
  id: string
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

export type TabDocument = {
  schemaVersion: TabDocumentSchemaVersion
  id: string
  title: string
  profileId: string
  profileName: string
  tuning: string
  ticksPerQuarter: number
  transpositionSemitones: number
  source: TabDocumentSource
  steps: readonly TabStep[]
}

export type TabLine = {
  index: number
  startBeat: number
  steps: readonly TabStep[]
}

export type TabSection = {
  index: number
  startBeat: number
  steps: readonly TabStep[]
}
