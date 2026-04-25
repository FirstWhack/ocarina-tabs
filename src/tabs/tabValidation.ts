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

  const title = readString(value.title, 'Imported tab')
  const ticksPerQuarter = readPositiveNumber(value.ticksPerQuarter, 'ticksPerQuarter', errors)
  const transpositionSemitones = readFiniteNumber(
    value.transpositionSemitones,
    'transpositionSemitones',
    errors,
  )
  const rawSteps = Array.isArray(value.steps) ? value.steps : undefined

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
      id: readString(value.id, createImportedTabId(title)),
      title,
      profileId: profile.id,
      profileName: profile.name,
      tuning: profile.tuning,
      ticksPerQuarter,
      transpositionSemitones,
      source: { type: 'imported' },
      steps,
    },
  }
}

export function getTabDocumentValidationErrors(document: TabDocument) {
  const errors: string[] = []

  if (document.schemaVersion !== tabDocumentSchemaVersion) {
    errors.push('Tab document uses an unsupported schema version.')
  }

  if (document.ticksPerQuarter <= 0) {
    errors.push('Tab document must have a positive ticks-per-quarter value.')
  }

  for (const step of document.steps) {
    if (step.durationTicks < 0 || step.durationMs < 0) {
      errors.push(`Tab step "${step.id}" has a negative duration.`)
    }

    if (step.startTick < 0 || step.startMs < 0) {
      errors.push(`Tab step "${step.id}" starts before the tab begins.`)
    }
  }

  return errors
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

  if (errors.length > 0) {
    return []
  }

  return [
    {
      id: readString(value.id, `step-${index}`),
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

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback
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

function createImportedTabId(title: string) {
  return `imported-${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`
}
