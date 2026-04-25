import type { OcarinaProfile } from '../ocarina/ocarinaProfile'
import { getFingeringForMidiNote } from '../ocarina/ocarinaProfile'
import { tabDocumentSchemaVersion } from './tabTypes'
import type { TabDocument, TabStep } from './tabTypes'

export type TabValidationResult =
  | {
      valid: true
      document: TabDocument
    }
  | {
      valid: false
      errors: readonly string[]
    }

type UnsafeRecord = Record<string, unknown>

export function validateTabDocument(
  value: unknown,
  profile: OcarinaProfile,
): TabValidationResult {
  const errors: string[] = []

  if (!isRecord(value)) {
    return { valid: false, errors: ['Tab file must contain a JSON object.'] }
  }

  if (value.schemaVersion !== tabDocumentSchemaVersion) {
    errors.push(`Unsupported tab schema version "${String(value.schemaVersion)}".`)
  }

  if (value.profileId !== profile.id) {
    errors.push('This tab was created for a different ocarina profile.')
  }

  const id = readRequiredString(value.id, 'id', errors)
  const title = readRequiredString(value.title, 'title', errors)
  const ticksPerQuarter = readPositiveNumber(
    value.ticksPerQuarter,
    'ticksPerQuarter',
    errors,
  )
  const transpositionSemitones = readFiniteNumber(
    value.transpositionSemitones,
    'transpositionSemitones',
    errors,
  )
  const source = isRecord(value.source) ? value.source : undefined
  const rawSteps = Array.isArray(value.steps) ? value.steps : undefined

  if (transpositionSemitones !== 0) {
    errors.push('Tab files must be saved as a standalone baseline with 0 semitones.')
  }

  if (source?.type !== 'editor') {
    errors.push('Tab files must use the canonical editor source.')
  }

  if (!rawSteps) {
    errors.push('Tab steps must be an array.')
  }

  const steps =
    rawSteps?.flatMap((rawStep, index) =>
      validateStep(rawStep, index, profile, errors),
    ) ?? []

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    document: {
      schemaVersion: tabDocumentSchemaVersion,
      id,
      title,
      profileId: profile.id,
      profileName: profile.name,
      tuning: profile.tuning,
      ticksPerQuarter,
      transpositionSemitones: 0,
      source: { type: 'imported' },
      steps,
    },
  }
}

function validateStep(
  value: unknown,
  fallbackIndex: number,
  profile: OcarinaProfile,
  errors: string[],
): readonly TabStep[] {
  if (!isRecord(value)) {
    errors.push(`Step ${fallbackIndex + 1} must be an object.`)
    return []
  }

  const index = readNonNegativeInteger(value.index, `steps[${fallbackIndex}].index`, errors)
  const sourceMidiNote = readFiniteNumber(
    value.sourceMidiNote,
    `steps[${fallbackIndex}].sourceMidiNote`,
    errors,
  )
  const midiNote = readFiniteNumber(
    value.midiNote,
    `steps[${fallbackIndex}].midiNote`,
    errors,
  )
  const velocity = readFiniteNumber(value.velocity, `steps[${fallbackIndex}].velocity`, errors)
  const startTick = readNonNegativeNumber(
    value.startTick,
    `steps[${fallbackIndex}].startTick`,
    errors,
  )
  const durationTicks = readNonNegativeNumber(
    value.durationTicks,
    `steps[${fallbackIndex}].durationTicks`,
    errors,
  )
  const startMs = readNonNegativeNumber(value.startMs, `steps[${fallbackIndex}].startMs`, errors)
  const durationMs = readNonNegativeNumber(
    value.durationMs,
    `steps[${fallbackIndex}].durationMs`,
    errors,
  )
  const id = readRequiredString(value.id, `steps[${fallbackIndex}].id`, errors)

  if (sourceMidiNote !== midiNote) {
    errors.push(
      `steps[${fallbackIndex}].sourceMidiNote must match midiNote in canonical tab files.`,
    )
  }

  if (errors.length > 0) {
    return []
  }

  return [
    {
      id,
      index,
      sourceMidiNote,
      midiNote,
      velocity,
      startTick,
      durationTicks,
      startMs,
      durationMs,
      fingering: getFingeringForMidiNote(profile, midiNote),
    },
  ]
}

function isRecord(value: unknown): value is UnsafeRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRequiredString(value: unknown, label: string, errors: string[]) {
  if (typeof value === 'string' && value.trim()) {
    return value
  }

  errors.push(`${label} must be a non-empty string.`)
  return ''
}

function readFiniteNumber(value: unknown, label: string, errors: string[]) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  errors.push(`${label} must be a finite number.`)
  return 0
}

function readPositiveNumber(value: unknown, label: string, errors: string[]) {
  const numberValue = readFiniteNumber(value, label, errors)

  if (numberValue <= 0) {
    errors.push(`${label} must be greater than zero.`)
  }

  return numberValue
}

function readNonNegativeNumber(value: unknown, label: string, errors: string[]) {
  const numberValue = readFiniteNumber(value, label, errors)

  if (numberValue < 0) {
    errors.push(`${label} must be zero or greater.`)
  }

  return numberValue
}

function readNonNegativeInteger(value: unknown, label: string, errors: string[]) {
  const numberValue = readNonNegativeNumber(value, label, errors)

  if (!Number.isInteger(numberValue)) {
    errors.push(`${label} must be an integer.`)
  }

  return numberValue
}
