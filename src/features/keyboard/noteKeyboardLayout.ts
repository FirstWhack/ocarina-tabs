import type { CSSProperties } from 'react'
import type { OcarinaProfile } from '../../ocarina/ocarinaProfile'

const naturalPitchClasses = [0, 2, 4, 5, 7, 9, 11] as const
const accidentalWidthInWhiteKeys = 0.62

export function isAccidentalNote(noteName: string) {
  return noteName.includes('#') || noteName.includes('b')
}

export function getKeyboardLayoutMetrics(profile: OcarinaProfile) {
  const lowestPlayableMidiNote = profile.fingerings[0].midiNote
  const lowestWhiteKeyIndex = getWhiteKeyIndex(lowestPlayableMidiNote)
  const highestWhiteKeyIndex = getWhiteKeyIndex(
    profile.fingerings.at(-1)?.midiNote ?? lowestPlayableMidiNote,
  )

  return {
    accidentalWidthInWhiteKeys,
    lowestWhiteKeyIndex,
    playableWhiteKeyCount: highestWhiteKeyIndex - lowestWhiteKeyIndex + 1,
  }
}

export function getKeyboardKeyStyle(
  midiNote: number,
  lowestWhiteKeyIndex: number,
): CSSProperties {
  const isAccidental = !isNaturalPitchClass(midiNote % 12)
  const whiteKeyOffset = getWhiteKeyIndex(midiNote) - lowestWhiteKeyIndex
  const keyStart = isAccidental
    ? whiteKeyOffset + 1 - accidentalWidthInWhiteKeys / 2
    : whiteKeyOffset

  return cssVariables({
    '--key-start': keyStart,
    '--key-width': isAccidental ? accidentalWidthInWhiteKeys : 1,
  })
}

export function cssVariables(
  variables: Record<`--${string}`, string | number>,
): CSSProperties {
  return variables as CSSProperties
}

function getWhiteKeyIndex(midiNote: number) {
  const octave = Math.floor(midiNote / 12) - 1
  const pitchClass = midiNote % 12
  const naturalPitchClass = isNaturalPitchClass(pitchClass)
    ? pitchClass
    : pitchClass - 1
  const naturalIndex = naturalPitchClasses.indexOf(
    naturalPitchClass as (typeof naturalPitchClasses)[number],
  )

  return octave * naturalPitchClasses.length + naturalIndex
}

function isNaturalPitchClass(pitchClass: number) {
  return naturalPitchClasses.includes(
    pitchClass as (typeof naturalPitchClasses)[number],
  )
}
