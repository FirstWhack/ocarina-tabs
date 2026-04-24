export type SampleMidiNote = {
  midiNote: number
  beats: number
}

export const twinkleOcarinaSampleNotes: readonly SampleMidiNote[] = [
  { midiNote: 72, beats: 1 },
  { midiNote: 72, beats: 1 },
  { midiNote: 79, beats: 1 },
  { midiNote: 79, beats: 1 },
  { midiNote: 81, beats: 1 },
  { midiNote: 81, beats: 1 },
  { midiNote: 79, beats: 2 },
  { midiNote: 77, beats: 1 },
  { midiNote: 77, beats: 1 },
  { midiNote: 76, beats: 1 },
  { midiNote: 76, beats: 1 },
  { midiNote: 74, beats: 1 },
  { midiNote: 74, beats: 1 },
  { midiNote: 72, beats: 2 },
] as const

const ticksPerQuarter = 480
const beatsPerMinute = 96
const sampleVelocity = 88

export function createTwinkleOcarinaMidiFile(): Uint8Array {
  const tempoMicrosecondsPerQuarter = Math.round(60_000_000 / beatsPerMinute)
  const trackData: number[] = [
    ...variableLengthBytes(0),
    0xff,
    0x03,
    ...variableLengthBytes('Twinkle C5 phrase'.length),
    ...asciiBytes('Twinkle C5 phrase'),
    ...variableLengthBytes(0),
    0xff,
    0x51,
    0x03,
    (tempoMicrosecondsPerQuarter >> 16) & 0xff,
    (tempoMicrosecondsPerQuarter >> 8) & 0xff,
    tempoMicrosecondsPerQuarter & 0xff,
  ]

  for (const note of twinkleOcarinaSampleNotes) {
    trackData.push(
      ...variableLengthBytes(0),
      0x90,
      note.midiNote,
      sampleVelocity,
      ...variableLengthBytes(note.beats * ticksPerQuarter),
      0x80,
      note.midiNote,
      0,
    )
  }

  trackData.push(...variableLengthBytes(0), 0xff, 0x2f, 0)

  return new Uint8Array([
    ...asciiBytes('MThd'),
    0,
    0,
    0,
    6,
    0,
    0,
    0,
    1,
    (ticksPerQuarter >> 8) & 0xff,
    ticksPerQuarter & 0xff,
    ...asciiBytes('MTrk'),
    (trackData.length >> 24) & 0xff,
    (trackData.length >> 16) & 0xff,
    (trackData.length >> 8) & 0xff,
    trackData.length & 0xff,
    ...trackData,
  ])
}

function asciiBytes(value: string) {
  return [...value].map((character) => character.charCodeAt(0))
}

function variableLengthBytes(value: number) {
  const bytes = [value & 0x7f]
  let remainingValue = value >> 7

  while (remainingValue > 0) {
    bytes.unshift((remainingValue & 0x7f) | 0x80)
    remainingValue >>= 7
  }

  return bytes
}
