export function midiNoteToFrequency(midiNote: number) {
  return 440 * 2 ** ((midiNote - 69) / 12)
}
