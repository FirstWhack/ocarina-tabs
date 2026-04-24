import type { OcarinaHoleId } from '../components/OcarinaDiagram/OcarinaDiagram'

export type OcarinaFingering = {
  midiNote: number
  noteName: string
  aliases: readonly string[]
  filledHoles: readonly OcarinaHoleId[]
}

export type OcarinaProfile = {
  id: string
  name: string
  tuning: string
  fingerings: readonly OcarinaFingering[]
}

export type PlayableRange = {
  lowest: OcarinaFingering
  highest: OcarinaFingering
}

export type MidiNoteAnalysis = {
  playable: boolean
  playableRange: PlayableRange
  notes: readonly {
    midiNote: number
    fingering: OcarinaFingering | undefined
  }[]
  unsupportedMidiNotes: readonly number[]
}

export type PlayableTransposition = {
  semitones: number
  analysis: MidiNoteAnalysis
}

const thumbHoles = [
  'left-thumb',
  'right-thumb',
] as const satisfies readonly OcarinaHoleId[]

const leftFingerHoles = [
  'left-index',
  'left-middle',
  'left-ring',
  'left-pinky',
] as const satisfies readonly OcarinaHoleId[]

const rightFingerHoles = [
  'right-index',
  'right-middle',
  'right-ring',
  'right-pinky',
] as const satisfies readonly OcarinaHoleId[]

const regularHoles = [
  ...thumbHoles,
  ...leftFingerHoles,
  ...rightFingerHoles,
] as const satisfies readonly OcarinaHoleId[]

const filledHoles = (
  ...holeGroups: readonly (readonly OcarinaHoleId[])[]
): readonly OcarinaHoleId[] => [...new Set(holeGroups.flat())]

const c5 = filledHoles(thumbHoles, leftFingerHoles, rightFingerHoles)
const d5 = filledHoles(thumbHoles, leftFingerHoles, [
  'right-index',
  'right-middle',
  'right-ring',
])
const e5 = filledHoles(thumbHoles, leftFingerHoles, [
  'right-index',
  'right-middle',
])
const f5 = filledHoles(thumbHoles, leftFingerHoles, ['right-index'])
const g5 = filledHoles(thumbHoles, leftFingerHoles)
const a5 = filledHoles(thumbHoles, [
  'left-index',
  'left-middle',
  'left-pinky',
])
const b5 = filledHoles(thumbHoles, ['left-index', 'left-pinky'])
const c6 = filledHoles(thumbHoles, ['left-pinky'])
const d6 = filledHoles(['left-thumb', 'left-pinky'])
const e6 = filledHoles(['left-pinky'])
const f6 = filledHoles()

export const standard12HoleCOcarinaProfile: OcarinaProfile = {
  id: 'standard-12-hole-c',
  name: 'Standard 12-hole C ocarina',
  tuning: 'C',
  fingerings: [
    {
      midiNote: 69,
      noteName: 'A4',
      aliases: [],
      filledHoles: filledHoles(regularHoles, ['subhole-1', 'subhole-2']),
    },
    {
      midiNote: 70,
      noteName: 'A#4',
      aliases: ['Bb4'],
      filledHoles: filledHoles(regularHoles, ['subhole-1']),
    },
    {
      midiNote: 71,
      noteName: 'B4',
      aliases: [],
      filledHoles: filledHoles(regularHoles, ['subhole-2']),
    },
    {
      midiNote: 72,
      noteName: 'C5',
      aliases: [],
      filledHoles: c5,
    },
    {
      midiNote: 73,
      noteName: 'C#5',
      aliases: ['Db5'],
      filledHoles: filledHoles(d5, ['subhole-2']),
    },
    {
      midiNote: 74,
      noteName: 'D5',
      aliases: [],
      filledHoles: d5,
    },
    {
      midiNote: 75,
      noteName: 'D#5',
      aliases: ['Eb5'],
      filledHoles: filledHoles(e5, ['subhole-2']),
    },
    {
      midiNote: 76,
      noteName: 'E5',
      aliases: [],
      filledHoles: e5,
    },
    {
      midiNote: 77,
      noteName: 'F5',
      aliases: [],
      filledHoles: f5,
    },
    {
      midiNote: 78,
      noteName: 'F#5',
      aliases: ['Gb5'],
      filledHoles: filledHoles(g5, ['right-ring']),
    },
    {
      midiNote: 79,
      noteName: 'G5',
      aliases: [],
      filledHoles: g5,
    },
    {
      midiNote: 80,
      noteName: 'G#5',
      aliases: ['Ab5'],
      filledHoles: filledHoles(a5, ['right-ring']),
    },
    {
      midiNote: 81,
      noteName: 'A5',
      aliases: [],
      filledHoles: a5,
    },
    {
      midiNote: 82,
      noteName: 'A#5',
      aliases: ['Bb5'],
      filledHoles: filledHoles(b5, ['right-ring']),
    },
    {
      midiNote: 83,
      noteName: 'B5',
      aliases: [],
      filledHoles: b5,
    },
    {
      midiNote: 84,
      noteName: 'C6',
      aliases: [],
      filledHoles: c6,
    },
    {
      midiNote: 85,
      noteName: 'C#6',
      aliases: ['Db6'],
      filledHoles: filledHoles(d6, ['right-ring']),
    },
    {
      midiNote: 86,
      noteName: 'D6',
      aliases: [],
      filledHoles: d6,
    },
    {
      midiNote: 87,
      noteName: 'D#6',
      aliases: ['Eb6'],
      filledHoles: filledHoles(e6, ['right-ring']),
    },
    {
      midiNote: 88,
      noteName: 'E6',
      aliases: [],
      filledHoles: e6,
    },
    {
      midiNote: 89,
      noteName: 'F6',
      aliases: [],
      filledHoles: f6,
    },
  ],
}

export function getFingeringForMidiNote(
  profile: OcarinaProfile,
  midiNote: number,
): OcarinaFingering | undefined {
  return profile.fingerings.find((fingering) => fingering.midiNote === midiNote)
}

export function getPlayableRange(profile: OcarinaProfile): PlayableRange {
  const sortedFingerings = [...profile.fingerings].sort(
    (a, b) => a.midiNote - b.midiNote,
  )
  const lowest = sortedFingerings[0]
  const highest = sortedFingerings.at(-1)

  if (!lowest || !highest) {
    throw new Error(`Ocarina profile "${profile.id}" has no fingerings.`)
  }

  return { lowest, highest }
}

export function analyzeMidiNotes(
  profile: OcarinaProfile,
  midiNotes: readonly number[],
): MidiNoteAnalysis {
  const notes = midiNotes.map((midiNote) => ({
    midiNote,
    fingering: getFingeringForMidiNote(profile, midiNote),
  }))
  const unsupportedMidiNotes = [
    ...new Set(
      notes
        .filter((note) => !note.fingering)
        .map((note) => note.midiNote),
    ),
  ].sort((a, b) => a - b)

  return {
    playable: unsupportedMidiNotes.length === 0,
    playableRange: getPlayableRange(profile),
    notes,
    unsupportedMidiNotes,
  }
}

export function findPlayableTranspositions(
  profile: OcarinaProfile,
  midiNotes: readonly number[],
  options: {
    minSemitones?: number
    maxSemitones?: number
  } = {},
): readonly PlayableTransposition[] {
  const minSemitones = options.minSemitones ?? -24
  const maxSemitones = options.maxSemitones ?? 24
  const candidates = getTranspositionCandidates(minSemitones, maxSemitones)

  return candidates.flatMap((semitones) => {
    const transposedNotes = midiNotes.map((midiNote) => midiNote + semitones)
    const analysis = analyzeMidiNotes(profile, transposedNotes)

    return analysis.playable ? [{ semitones, analysis }] : []
  })
}

function getTranspositionCandidates(
  minSemitones: number,
  maxSemitones: number,
): readonly number[] {
  const largestDistance = Math.max(
    Math.abs(minSemitones),
    Math.abs(maxSemitones),
  )
  const candidates: number[] = []

  for (let distance = 0; distance <= largestDistance; distance += 1) {
    if (distance === 0) {
      if (minSemitones <= 0 && maxSemitones >= 0) {
        candidates.push(0)
      }

      continue
    }

    if (distance <= maxSemitones) {
      candidates.push(distance)
    }

    if (-distance >= minSemitones) {
      candidates.push(-distance)
    }
  }

  return candidates
}
