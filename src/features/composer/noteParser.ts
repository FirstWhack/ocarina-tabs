import type { OcarinaProfile } from '../../ocarina/ocarinaProfile'
import { getFingeringForMidiNote } from '../../ocarina/ocarinaProfile'

export type ParsedComposerNotes =
  | {
      valid: true
      midiNotes: readonly number[]
      warning: string | undefined
    }
  | {
      valid: false
      error: string
    }

const notePitchClasses = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
} as const

export function parseComposerNoteInput(
  input: string,
  profile: OcarinaProfile,
): ParsedComposerNotes {
  const tokens = input
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean)

  if (tokens.length === 0) {
    return { valid: false, error: 'Enter at least one note.' }
  }

  const midiNotes: number[] = []
  const unsupportedTokens: string[] = []

  for (const token of tokens) {
    const midiNote = resolveNoteName(token, profile)

    if (midiNote === undefined) {
      return {
        valid: false,
        error: `"${token}" is not a valid note.`,
      }
    }

    midiNotes.push(midiNote)

    if (!getFingeringForMidiNote(profile, midiNote)) {
      unsupportedTokens.push(token)
    }
  }

  return {
    valid: true,
    midiNotes,
    warning:
      unsupportedTokens.length > 0
        ? `${unsupportedTokens.join(', ')} ${
            unsupportedTokens.length === 1 ? 'is' : 'are'
          } outside this ocarina profile. Try transposition to make ${
            unsupportedTokens.length === 1 ? 'it' : 'them'
          } playable.`
        : undefined,
  }
}

export function resolveNoteName(
  noteName: string,
  profile: OcarinaProfile,
): number | undefined {
  const normalizedNoteName = normalizeNoteName(noteName)

  const profileMidiNote = profile.fingerings.find((fingering) => {
    const names = [fingering.noteName, ...fingering.aliases]
    return names.some((name) => normalizeNoteName(name) === normalizedNoteName)
  })?.midiNote

  return profileMidiNote ?? parseScientificPitchNote(normalizedNoteName)
}

function normalizeNoteName(noteName: string) {
  return noteName.trim().replace('♯', '#').replace('♭', 'b').toUpperCase()
}

function parseScientificPitchNote(noteName: string) {
  const match = /^([A-G])([#B]?)(-?\d+)$/.exec(noteName)

  if (!match) {
    return undefined
  }

  const [, pitchName, accidental, octaveText] = match
  const pitchClass = notePitchClasses[pitchName as keyof typeof notePitchClasses]
  const accidentalOffset = accidental === '#' ? 1 : accidental === 'B' ? -1 : 0
  const octave = Number(octaveText)
  const midiNote = (octave + 1) * 12 + pitchClass + accidentalOffset

  return Number.isInteger(midiNote) && midiNote >= 0 && midiNote <= 127
    ? midiNote
    : undefined
}
