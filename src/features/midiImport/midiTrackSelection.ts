import { analyzeMidiRangeFit } from '../../ocarina/ocarinaProfile'
import type { OcarinaProfile } from '../../ocarina/ocarinaProfile'
import { createMonophonicMidiLine } from '../../ocarina/ocarinaTab'
import type { MonophonicMidiLine } from '../../ocarina/ocarinaTab'
import type { MidiNoteEvent, ParsedMidiFile } from '../../midi/midiParser'
import type { SuggestionDifficulty, TrackSelection } from './midiImportTypes'

export function getDefaultTrackSelection(
  parsedMidi: ParsedMidiFile,
  profile: OcarinaProfile,
): TrackSelection {
  const suggestedTracks = getSuggestedTrackSelection(parsedMidi, profile, 'easy')

  if (suggestedTracks.length > 0) {
    return suggestedTracks
  }

  return parsedMidi.tracks
    .filter((track) => track.noteCount > 0)
    .slice(0, 1)
    .map((track) => track.index)
}

export function getSelectedTrackNotes(
  parsedMidi: ParsedMidiFile,
  selectedTracks: TrackSelection,
): readonly MidiNoteEvent[] {
  if (selectedTracks.length === 0) {
    return []
  }

  const selectedTrackSet = new Set(selectedTracks)

  return parsedMidi.tracks
    .filter((track) => selectedTrackSet.has(track.index))
    .flatMap((track) => track.noteEvents)
    .sort(
      (left, right) =>
        left.startMs - right.startMs ||
        left.midiNote - right.midiNote ||
        left.track - right.track,
    )
}

export function getFirstMonophonicNote(
  parsedMidi: ParsedMidiFile,
  selectedTracks: TrackSelection,
) {
  return createMonophonicMidiLine(
    getSelectedTrackNotes(parsedMidi, selectedTracks),
  ).notes[0]
}

export function trimMonophonicLineStart(
  monophonicLine: MonophonicMidiLine,
): MonophonicMidiLine {
  const firstNote = monophonicLine.notes[0]

  if (!firstNote || (firstNote.startTick === 0 && firstNote.startMs === 0)) {
    return monophonicLine
  }

  return {
    ...monophonicLine,
    notes: monophonicLine.notes.map((note) => ({
      ...note,
      startTick: Math.max(0, note.startTick - firstNote.startTick),
      startMs: Math.max(0, note.startMs - firstNote.startMs),
    })),
  }
}

export function getSuggestedTrackSelection(
  parsedMidi: ParsedMidiFile,
  profile: OcarinaProfile,
  difficulty: SuggestionDifficulty,
): TrackSelection {
  const suggestions = parsedMidi.tracks
    .filter((track) => track.noteCount > 0)
    .map((track) => {
      const monophonicLine = trimMonophonicLineStart(
        createMonophonicMidiLine(track.noteEvents),
      )
      const analysis = analyzeMidiRangeFit(
        profile,
        monophonicLine.notes.map((note) => note.midiNote),
      )
      const compatibleTransposition =
        analysis.bestTransposition ?? analysis.bestCompatibleTransposition
      const playableRatio = compatibleTransposition?.playableRatio ?? 0
      const cleanupRatio =
        monophonicLine.sourceNoteCount === 0
          ? 0
          : (monophonicLine.droppedChordNotes +
              monophonicLine.clippedOverlapNotes) /
            monophonicLine.sourceNoteCount

      return {
        track,
        playableRatio,
        playableNoteCount: compatibleTransposition?.playableNoteCount ?? 0,
        cleanupRatio,
        score:
          playableRatio * 700 +
          Math.min(monophonicLine.notes.length, 96) * 3 -
          cleanupRatio * 80,
      }
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.playableRatio - left.playableRatio ||
        right.playableNoteCount - left.playableNoteCount ||
        left.track.index - right.track.index,
    )

  if (suggestions.length === 0) {
    return []
  }

  if (difficulty === 'easy') {
    return [suggestions[0].track.index]
  }

  const strongestScore = suggestions[0]?.score ?? 0
  const minimumScore =
    strongestScore > 0
      ? strongestScore * (difficulty === 'medium' ? 0.82 : 0.62)
      : strongestScore
  const minimumPlayableRatio = difficulty === 'medium' ? 0.7 : 0.45
  const maximumCleanupRatio = difficulty === 'medium' ? 0.35 : 0.7
  const maximumTracks = difficulty === 'medium' ? 2 : 6
  const suggestedTracks = suggestions.filter(
    (suggestion) =>
      suggestion.playableNoteCount > 0 &&
      suggestion.playableRatio >= minimumPlayableRatio &&
      suggestion.cleanupRatio <= maximumCleanupRatio &&
      suggestion.score >= minimumScore,
  )

  return (suggestedTracks.length > 0 ? suggestedTracks : suggestions.slice(0, 1))
    .slice(0, maximumTracks)
    .map((suggestion) => suggestion.track.index)
    .sort((left, right) => left - right)
}

export function formatTrackName(track: ParsedMidiFile['tracks'][number]) {
  return track.name
    ? `Track ${track.index + 1}: ${track.name}`
    : `Track ${track.index + 1}`
}

export function formatTrackDetail(track: ParsedMidiFile['tracks'][number]) {
  const channels =
    track.channels.length > 0
      ? `, channels ${track.channels.map((channel) => channel + 1).join('/')}`
      : ''

  return `${track.noteCount} notes${channels}`
}

export function formatTrackSelectionCount(selectedTracks: TrackSelection) {
  if (selectedTracks.length === 0) {
    return 'None'
  }

  return `${selectedTracks.length} selected`
}

export function areTrackSelectionsEqual(
  leftSelection: TrackSelection,
  rightSelection: TrackSelection,
) {
  if (leftSelection.length !== rightSelection.length) {
    return false
  }

  return leftSelection.every(
    (selectedTrack, index) => selectedTrack === rightSelection[index],
  )
}
