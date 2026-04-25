import type { OcarinaProfile } from '../ocarina/ocarinaProfile'
import { validateTabDocument } from './tabValidation'
import type { TabDocument } from './tabTypes'
import { tabDocumentSchemaVersion } from './tabTypes'

export function serializeTabDocument(document: TabDocument) {
  return `${JSON.stringify(toSerializableTabDocument(document), null, 2)}\n`
}

export function parseSerializedTabDocument(
  json: string,
  profile: OcarinaProfile,
): TabDocument {
  let parsed: unknown

  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('That file is not valid tab JSON.')
  }

  const validation = validateTabDocument(parsed, profile)

  if (!validation.valid) {
    throw new Error(validation.errors.join(' '))
  }

  return validation.document
}

function toSerializableTabDocument(document: TabDocument) {
  return {
    schemaVersion: tabDocumentSchemaVersion,
    id: document.id,
    title: document.title,
    profileId: document.profileId,
    profileName: document.profileName,
    tuning: document.tuning,
    ticksPerQuarter: document.ticksPerQuarter,
    transpositionSemitones: document.transpositionSemitones,
    source: document.source,
    steps: document.steps.map((step) => ({
      id: step.id,
      index: step.index,
      sourceMidiNote: step.sourceMidiNote,
      midiNote: step.midiNote,
      velocity: step.velocity,
      startTick: step.startTick,
      durationTicks: step.durationTicks,
      startMs: step.startMs,
      durationMs: step.durationMs,
      fingeringNoteName: step.fingering?.noteName,
      unsupported: !step.fingering,
    })),
  }
}
