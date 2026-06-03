import type { OcarinaProfile } from '../../ocarina/ocarinaProfile'

export type ParsedComposerNotes =
  | {
      valid: true
      midiNotes: readonly number[]
    }
  | {
      valid: false
      error: string
    }

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

  for (const token of tokens) {
    const midiNote = resolveNoteName(token, profile)

    if (midiNote === undefined) {
      return {
        valid: false,
        error: `"${token}" is not a note in the current ocarina profile.`,
      }
    }

    midiNotes.push(midiNote)
  }

  return { valid: true, midiNotes }
}

export function resolveNoteName(
  noteName: string,
  profile: OcarinaProfile,
): number | undefined {
  const normalizedNoteName = normalizeNoteName(noteName)

  return profile.fingerings.find((fingering) => {
    const names = [fingering.noteName, ...fingering.aliases]
    return names.some((name) => normalizeNoteName(name) === normalizedNoteName)
  })?.midiNote
}

function normalizeNoteName(noteName: string) {
  return noteName.trim().replace('♯', '#').replace('♭', 'b').toUpperCase()
}
