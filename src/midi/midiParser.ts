export type MidiNoteEvent = {
  midiNote: number
  velocity: number
  track: number
  channel: number
  startTick: number
  durationTicks: number
  startMs: number
  durationMs: number
}

export type MidiTrack = {
  index: number
  name: string | undefined
  noteEvents: readonly MidiNoteEvent[]
  noteCount: number
  channels: readonly number[]
}

export type ParsedMidiFile = {
  format: number
  trackCount: number
  ticksPerQuarter: number
  noteEvents: readonly MidiNoteEvent[]
  tracks: readonly MidiTrack[]
}

type RawMidiNoteEvent = Omit<MidiNoteEvent, 'startMs' | 'durationMs'>

type RawMidiTrack = {
  index: number
  name: string | undefined
  notes: RawMidiNoteEvent[]
}

type TempoEvent = {
  tick: number
  microsecondsPerQuarter: number
}

type ActiveNote = {
  startTick: number
  velocity: number
}

const midiHeaderChunkId = 'MThd'
const midiTrackChunkId = 'MTrk'
const defaultMicrosecondsPerQuarter = 500_000

export function parseMidiFile(input: ArrayBuffer | Uint8Array): ParsedMidiFile {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  const reader = createMidiReader(bytes)
  const headerId = reader.readAscii(4)

  if (headerId !== midiHeaderChunkId) {
    throw new Error('This file is not a Standard MIDI file.')
  }

  const headerLength = reader.readUint32()
  const format = reader.readUint16()
  const trackCount = reader.readUint16()
  const division = reader.readUint16()

  if ((division & 0x8000) !== 0) {
    throw new Error('SMPTE-time MIDI files are not supported yet.')
  }

  if (headerLength > 6) {
    reader.skip(headerLength - 6)
  }

  const ticksPerQuarter = division
  const rawTracks: RawMidiTrack[] = []
  const tempoEvents: TempoEvent[] = []

  for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
    const chunkId = reader.readAscii(4)
    const chunkLength = reader.readUint32()
    const trackEndOffset = reader.offset + chunkLength

    if (chunkId !== midiTrackChunkId) {
      reader.seek(trackEndOffset)
      continue
    }

    rawTracks.push(
      parseTrack(bytes, reader.offset, trackEndOffset, trackIndex, tempoEvents),
    )
    reader.seek(trackEndOffset)
  }

  const tracks = rawTracks.map((track) => {
    const noteEvents = track.notes
      .map((noteEvent) => ({
        ...noteEvent,
        startMs: ticksToMilliseconds(
          noteEvent.startTick,
          ticksPerQuarter,
          tempoEvents,
        ),
        durationMs:
          ticksToMilliseconds(
            noteEvent.startTick + noteEvent.durationTicks,
            ticksPerQuarter,
            tempoEvents,
          ) -
          ticksToMilliseconds(
            noteEvent.startTick,
            ticksPerQuarter,
            tempoEvents,
          ),
      }))
      .sort(compareMidiNoteEvents)

    return {
      index: track.index,
      name: track.name,
      noteEvents,
      noteCount: noteEvents.length,
      channels: [
        ...new Set(noteEvents.map((noteEvent) => noteEvent.channel)),
      ].sort((left, right) => left - right),
    }
  })

  const noteEvents = tracks
    .flatMap((track) => track.noteEvents)
    .sort(compareMidiNoteEvents)

  return {
    format,
    trackCount,
    ticksPerQuarter,
    noteEvents,
    tracks,
  }
}

function parseTrack(
  bytes: Uint8Array,
  startOffset: number,
  endOffset: number,
  track: number,
  tempoEvents: TempoEvent[],
): RawMidiTrack {
  const reader = createMidiReader(bytes, startOffset)
  const activeNotes = new Map<string, ActiveNote[]>()
  const notes: RawMidiNoteEvent[] = []
  let name: string | undefined
  let tick = 0
  let runningStatus: number | undefined

  while (reader.offset < endOffset) {
    tick += reader.readVariableLengthQuantity()

    const firstByte = reader.peekUint8()
    const status =
      firstByte >= 0x80 ? reader.readUint8() : runningStatus ?? firstByte

    if (status === 0xff) {
      runningStatus = undefined
      const metaType = reader.readUint8()
      const byteLength = reader.readVariableLengthQuantity()

      if (metaType === 0x51 && byteLength === 3) {
        tempoEvents.push({
          tick,
          microsecondsPerQuarter: reader.readUint24(),
        })
        continue
      }

      if (metaType === 0x03) {
        name = readText(reader, byteLength) || name
        continue
      }

      reader.skip(byteLength)

      if (metaType === 0x2f) {
        break
      }

      continue
    }

    if (status === 0xf0 || status === 0xf7) {
      runningStatus = undefined
      reader.skip(reader.readVariableLengthQuantity())
      continue
    }

    if (status < 0x80 || status > 0xef) {
      throw new Error('Unsupported MIDI event encountered.')
    }

    runningStatus = status
    const eventType = status & 0xf0
    const channel = status & 0x0f
    const firstDataByte = reader.readUint8()

    if (eventType === 0xc0 || eventType === 0xd0) {
      continue
    }

    const secondDataByte = reader.readUint8()

    if (eventType !== 0x80 && eventType !== 0x90) {
      continue
    }

    const midiNote = firstDataByte
    const velocity = secondDataByte
    const noteKey = `${channel}:${midiNote}`

    if (eventType === 0x90 && velocity > 0) {
      const activeNoteSet = activeNotes.get(noteKey) ?? []
      activeNoteSet.push({ startTick: tick, velocity })
      activeNotes.set(noteKey, activeNoteSet)
      continue
    }

    const activeNoteSet = activeNotes.get(noteKey)

    if (!activeNoteSet) {
      continue
    }

    const activeNote = activeNoteSet.shift()

    if (!activeNote) {
      continue
    }

    if (activeNoteSet.length === 0) {
      activeNotes.delete(noteKey)
    }

    notes.push({
      midiNote,
      velocity: activeNote.velocity,
      track,
      channel,
      startTick: activeNote.startTick,
      durationTicks: tick - activeNote.startTick,
    })
  }

  return {
    index: track,
    name,
    notes,
  }
}

function compareMidiNoteEvents(left: MidiNoteEvent, right: MidiNoteEvent) {
  return (
    left.startMs - right.startMs ||
    left.midiNote - right.midiNote ||
    left.track - right.track
  )
}

function ticksToMilliseconds(
  tick: number,
  ticksPerQuarter: number,
  tempoEvents: readonly TempoEvent[],
) {
  const tempos = normalizeTempoEvents(tempoEvents)
  let elapsedMicroseconds = 0
  let previousTick = 0
  let currentTempo = defaultMicrosecondsPerQuarter

  for (const tempoEvent of tempos) {
    if (tempoEvent.tick > tick) {
      break
    }

    elapsedMicroseconds +=
      ((tempoEvent.tick - previousTick) * currentTempo) / ticksPerQuarter
    previousTick = tempoEvent.tick
    currentTempo = tempoEvent.microsecondsPerQuarter
  }

  elapsedMicroseconds += ((tick - previousTick) * currentTempo) / ticksPerQuarter

  return elapsedMicroseconds / 1000
}

function normalizeTempoEvents(tempoEvents: readonly TempoEvent[]) {
  const sortedTempoEvents = [...tempoEvents].sort(
    (left, right) => left.tick - right.tick,
  )
  const normalized: TempoEvent[] = []

  for (const tempoEvent of sortedTempoEvents) {
    const previousTempoEvent = normalized.at(-1)

    if (previousTempoEvent?.tick === tempoEvent.tick) {
      previousTempoEvent.microsecondsPerQuarter =
        tempoEvent.microsecondsPerQuarter
      continue
    }

    normalized.push({ ...tempoEvent })
  }

  if (normalized[0]?.tick !== 0) {
    normalized.unshift({
      tick: 0,
      microsecondsPerQuarter: defaultMicrosecondsPerQuarter,
    })
  }

  return normalized
}

function readText(reader: MidiReader, byteLength: number) {
  return new TextDecoder().decode(reader.readBytes(byteLength)).trim()
}

type MidiReader = ReturnType<typeof createMidiReader>

function createMidiReader(bytes: Uint8Array, initialOffset = 0) {
  let offset = initialOffset

  return {
    get offset() {
      return offset
    },
    seek(nextOffset: number) {
      offset = nextOffset
    },
    skip(byteLength: number) {
      offset += byteLength
    },
    peekUint8() {
      return bytes[offset]
    },
    readUint8() {
      const value = bytes[offset]
      offset += 1
      return value
    },
    readUint16() {
      const value = (bytes[offset] << 8) | bytes[offset + 1]
      offset += 2
      return value
    },
    readUint24() {
      const value =
        (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2]
      offset += 3
      return value
    },
    readUint32() {
      const value =
        ((bytes[offset] << 24) |
          (bytes[offset + 1] << 16) |
          (bytes[offset + 2] << 8) |
          bytes[offset + 3]) >>>
        0
      offset += 4
      return value
    },
    readAscii(byteLength: number) {
      let output = ''

      for (let index = 0; index < byteLength; index += 1) {
        output += String.fromCharCode(bytes[offset + index])
      }

      offset += byteLength
      return output
    },
    readBytes(byteLength: number) {
      const output = bytes.slice(offset, offset + byteLength)
      offset += byteLength
      return output
    },
    readVariableLengthQuantity() {
      let value = 0
      let byte: number

      do {
        byte = this.readUint8()
        value = (value << 7) | (byte & 0x7f)
      } while ((byte & 0x80) !== 0)

      return value
    },
  }
}
