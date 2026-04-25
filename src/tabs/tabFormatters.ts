import type { MidiRangeFitAnalysis } from '../ocarina/ocarinaProfile'
import type { MonophonicMidiLine } from '../ocarina/ocarinaTab'
import type { TabStep } from './tabTypes'

export function formatMidiRangeFit(midiRangeFit: MidiRangeFitAnalysis) {
  const sourceRange = midiRangeFit.sourceRange

  if (!sourceRange) {
    return 'No notes found'
  }

  return `MIDI ${sourceRange.lowestMidiNote}-${sourceRange.highestMidiNote}, ${sourceRange.spanSemitones} semitones`
}

export function formatTabGenerationPath(
  tabSteps: readonly TabStep[],
  transpositionSemitones: number,
) {
  const unsupportedMidiNotes = [
    ...new Set(
      tabSteps
        .filter((step) => !step.fingering)
        .map((step) => step.midiNote),
    ),
  ].sort((left, right) => left - right)

  if (unsupportedMidiNotes.length === 0) {
    return transpositionSemitones === 0
      ? 'Playable without transposition'
      : `Playable at ${formatSemitoneShift(transpositionSemitones)}`
  }

  return `Unsupported: ${unsupportedMidiNotes
    .map((midiNote) => `MIDI ${midiNote}`)
    .join(', ')}`
}

export function formatSemitoneShift(semitones: number) {
  if (semitones === 0) {
    return '0 semitones'
  }

  return `${semitones > 0 ? '+' : ''}${semitones} semitones`
}

export function formatStepCount(tabSteps: readonly TabStep[]) {
  const playableSteps = tabSteps.filter((step) => step.fingering).length

  return `${playableSteps}/${tabSteps.length} playable`
}

export function formatMonophonicLine(monophonicLine: MonophonicMidiLine) {
  if (monophonicLine.sourceNoteCount === monophonicLine.notes.length) {
    return 'No polyphony found'
  }

  return `${monophonicLine.droppedChordNotes} chord notes removed, ${monophonicLine.clippedOverlapNotes} overlaps clipped`
}

export function formatTransposition(semitones: number) {
  return semitones === 0
    ? 'Original pitch'
    : `Transposed ${formatSemitoneShift(semitones)}`
}

export function formatPlaybackTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function formatPlaybackSpeed(speed: number) {
  return `${formatDecimal(speed)}x`
}

export function formatContinuousTabStepLabel(
  step: TabStep,
  ticksPerQuarter: number,
) {
  const noteName = step.fingering?.noteName ?? `Unsupported MIDI ${step.midiNote}`

  return `${noteName}, starts at ${formatBeat(step.startTick, ticksPerQuarter)}`
}

export function formatBeat(ticks: number, ticksPerQuarter: number) {
  return `${formatDecimal(ticks / ticksPerQuarter)} beats`
}

export function formatDecimal(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2)
}
