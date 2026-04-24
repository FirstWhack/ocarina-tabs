import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { OcarinaDiagram } from './components/OcarinaDiagram/OcarinaDiagram'
import {
  analyzeMidiRangeFit,
  getFingeringForMidiNote,
  getPlayableRange,
  standard12HoleCOcarinaProfile,
} from './ocarina/ocarinaProfile'
import { createMonophonicMidiLine, createOcarinaTab } from './ocarina/ocarinaTab'
import type { MonophonicMidiLine, OcarinaTabStep } from './ocarina/ocarinaTab'
import { parseMidiFile } from './midi/midiParser'
import type { MidiNoteEvent, ParsedMidiFile } from './midi/midiParser'
import { createTwinkleOcarinaMidiFile } from './midi/sampleMidi'
import './App.css'

const profile = standard12HoleCOcarinaProfile
const initialMidiNote = 72
const sampleMidiName = 'Twinkle C5 phrase.mid'
type TrackSelection = number | 'all'
type TabLine = {
  index: number
  startBeat: number
  steps: readonly OcarinaTabStep[]
}

function App() {
  const [activeMidiNote, setActiveMidiNote] = useState(initialMidiNote)
  const [activeTabIndex, setActiveTabIndex] = useState<number | undefined>()
  const [parsedMidi, setParsedMidi] = useState<ParsedMidiFile>(() =>
    parseMidiFile(createTwinkleOcarinaMidiFile()),
  )
  const [selectedTrack, setSelectedTrack] = useState<TrackSelection>(0)
  const [midiFileName, setMidiFileName] = useState(sampleMidiName)
  const [midiError, setMidiError] = useState<string | undefined>()
  const [isPlaying, setIsPlaying] = useState(false)
  const playbackTimeoutsRef = useRef<number[]>([])
  const oscillatorsRef = useRef<OscillatorNode[]>([])
  const audioContextRef = useRef<AudioContext | undefined>(undefined)

  const activeFingering = getFingeringForMidiNote(profile, activeMidiNote)
  const playableRange = getPlayableRange(profile)
  const selectedTrackNotes = useMemo(
    () => getSelectedTrackNotes(parsedMidi, selectedTrack),
    [parsedMidi, selectedTrack],
  )
  const monophonicLine = useMemo(
    () => createMonophonicMidiLine(selectedTrackNotes),
    [selectedTrackNotes],
  )
  const midiNotes = useMemo(
    () => monophonicLine.notes.map((note) => note.midiNote),
    [monophonicLine],
  )
  const midiRangeFit = useMemo(
    () => analyzeMidiRangeFit(profile, midiNotes),
    [midiNotes],
  )
  const tabTransposition =
    midiRangeFit.status === 'transposable'
      ? midiRangeFit.bestTransposition?.semitones ?? 0
      : 0
  const ocarinaTab = useMemo(
    () =>
      createOcarinaTab(profile, monophonicLine.notes, {
        transpositionSemitones: tabTransposition,
      }),
    [monophonicLine, tabTransposition],
  )
  const playableTabSteps = ocarinaTab.filter((step) => step.fingering)
  const activeTabStep = ocarinaTab.find((step) => step.index === activeTabIndex)
  const tabLines = useMemo(
    () => createTabLines(ocarinaTab, parsedMidi.ticksPerQuarter),
    [ocarinaTab, parsedMidi.ticksPerQuarter],
  )

  useEffect(() => {
    return () => {
      for (const timeoutId of playbackTimeoutsRef.current) {
        window.clearTimeout(timeoutId)
      }

      for (const oscillator of oscillatorsRef.current) {
        try {
          oscillator.stop()
        } catch {
          continue
        }
      }

      void audioContextRef.current?.close()
    }
  }, [])

  async function handleMidiUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    clearPreviewPlayback()

    try {
      const nextParsedMidi = parseMidiFile(await file.arrayBuffer())
      const nextSelectedTrack = getDefaultTrackSelection(nextParsedMidi)
      const firstNote = getFirstMonophonicNote(nextParsedMidi, nextSelectedTrack)

      setParsedMidi(nextParsedMidi)
      setSelectedTrack(nextSelectedTrack)
      setMidiFileName(file.name)
      setMidiError(undefined)
      setActiveTabIndex(undefined)

      if (firstNote) {
        setActiveMidiNote(firstNote.midiNote)
      }
    } catch (error) {
      setMidiError(
        error instanceof Error ? error.message : 'Could not read that MIDI file.',
      )
    } finally {
      event.target.value = ''
    }
  }

  function handleLoadSample() {
    clearPreviewPlayback()
    const nextParsedMidi = parseMidiFile(createTwinkleOcarinaMidiFile())
    const nextSelectedTrack = getDefaultTrackSelection(nextParsedMidi)
    const firstNote = getFirstMonophonicNote(nextParsedMidi, nextSelectedTrack)

    setParsedMidi(nextParsedMidi)
    setSelectedTrack(nextSelectedTrack)
    setMidiFileName(sampleMidiName)
    setMidiError(undefined)
    setActiveTabIndex(undefined)
    setActiveMidiNote(firstNote?.midiNote ?? initialMidiNote)
  }

  function handlePreviewSample() {
    clearPreviewPlayback()
    const nextParsedMidi = parseMidiFile(createTwinkleOcarinaMidiFile())
    const nextSelectedTrack = getDefaultTrackSelection(nextParsedMidi)
    const nextLine = createMonophonicMidiLine(
      getSelectedTrackNotes(nextParsedMidi, nextSelectedTrack),
    )
    const nextTab = createOcarinaTab(profile, nextLine.notes)
    const firstNote = nextLine.notes[0]

    setParsedMidi(nextParsedMidi)
    setSelectedTrack(nextSelectedTrack)
    setMidiFileName(sampleMidiName)
    setMidiError(undefined)
    setActiveTabIndex(undefined)
    setActiveMidiNote(firstNote?.midiNote ?? initialMidiNote)
    playPreview(nextTab)
  }

  function handleTrackSelectionChange(event: ChangeEvent<HTMLSelectElement>) {
    clearPreviewPlayback()
    const nextSelectedTrack =
      event.target.value === 'all' ? 'all' : Number(event.target.value)
    const firstNote = getFirstMonophonicNote(parsedMidi, nextSelectedTrack)

    setSelectedTrack(nextSelectedTrack)
    setActiveTabIndex(undefined)

    if (firstNote) {
      setActiveMidiNote(firstNote.midiNote)
    }
  }

  function handlePlayCurrentTab() {
    if (isPlaying) {
      clearPreviewPlayback()
      return
    }

    playPreview(ocarinaTab)
  }

  function playPreview(tabSteps: readonly OcarinaTabStep[]) {
    const stepsWithFingerings = tabSteps.filter((step) => step.fingering)

    if (stepsWithFingerings.length === 0) {
      return
    }

    clearPreviewPlayback()
    setIsPlaying(true)

    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    const audioContext = AudioContextConstructor
      ? new AudioContextConstructor()
      : undefined

    if (audioContext) {
      audioContextRef.current = audioContext
      void audioContext.resume()
      scheduleAudioPreview(audioContext, stepsWithFingerings)
    }

    for (const step of stepsWithFingerings) {
      const timeoutId = window.setTimeout(() => {
        setActiveMidiNote(step.midiNote)
        setActiveTabIndex(step.index)
      }, Math.max(0, step.startMs))
      playbackTimeoutsRef.current.push(timeoutId)
    }

    const lastStep = stepsWithFingerings.at(-1)
    const finalTimeoutId = window.setTimeout(
      () => {
        clearPreviewPlayback()
      },
      lastStep ? lastStep.startMs + lastStep.durationMs + 120 : 120,
    )
    playbackTimeoutsRef.current.push(finalTimeoutId)
  }

  function scheduleAudioPreview(
    audioContext: AudioContext,
    tabSteps: readonly OcarinaTabStep[],
  ) {
    const previewStartTime = audioContext.currentTime + 0.05

    for (const step of tabSteps) {
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      const startTime = previewStartTime + step.startMs / 1000
      const endTime = startTime + Math.max(step.durationMs / 1000, 0.08)

      oscillator.type = 'sine'
      oscillator.frequency.value = midiNoteToFrequency(step.midiNote)
      gain.gain.setValueAtTime(0.0001, startTime)
      gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.02)
      gain.gain.setValueAtTime(0.18, Math.max(startTime + 0.03, endTime - 0.04))
      gain.gain.exponentialRampToValueAtTime(0.0001, endTime)
      oscillator.connect(gain).connect(audioContext.destination)
      oscillator.start(startTime)
      oscillator.stop(endTime + 0.02)
      oscillator.onended = () => {
        oscillatorsRef.current = oscillatorsRef.current.filter(
          (storedOscillator) => storedOscillator !== oscillator,
        )
      }
      oscillatorsRef.current.push(oscillator)
    }
  }

  function clearPreviewPlayback() {
    for (const timeoutId of playbackTimeoutsRef.current) {
      window.clearTimeout(timeoutId)
    }

    playbackTimeoutsRef.current = []

    for (const oscillator of oscillatorsRef.current) {
      try {
        oscillator.stop()
      } catch {
        continue
      }
    }

    oscillatorsRef.current = []
    void audioContextRef.current?.close()
    audioContextRef.current = undefined
    setIsPlaying(false)
    setActiveTabIndex(undefined)
  }

  return (
    <main className="app-shell">
      <section className="app-workspace" aria-labelledby="page-title">
        <header className="app-header">
          <p className="app-eyebrow">Ocarina tab generator</p>
          <h1 id="page-title">MIDI-to-tab example</h1>
          <p>
            Upload a simple melody MIDI, generate its ocarina fingering
            sequence, and preview each tab step against the 12-hole C profile.
          </p>
        </header>

        <section className="midi-page" aria-label="MIDI tab builder">
          <div className="note-lab__diagram-panel">
            <div className="note-lab__selected">
              <span>Preview note</span>
              <strong data-testid="active-note">
                {activeFingering
                  ? `${activeFingering.noteName} / MIDI ${activeFingering.midiNote}`
                  : `MIDI ${activeMidiNote} unsupported`}
              </strong>
            </div>

            <div
              className="note-lab__diagram"
              data-testid="active-ocarina-diagram"
            >
              <OcarinaDiagram
                filledHoles={activeFingering?.filledHoles ?? []}
                title={
                  activeFingering
                    ? `${activeFingering.noteName} fingering`
                    : 'Unsupported ocarina fingering'
                }
              />
            </div>

            <div className="preview-actions">
              <button
                className="action-button action-button--primary"
                onClick={handlePreviewSample}
                type="button"
              >
                Preview sample
              </button>
              <button
                className="action-button"
                disabled={playableTabSteps.length === 0}
                onClick={handlePlayCurrentTab}
                type="button"
              >
                {isPlaying ? 'Stop' : 'Play tab'}
              </button>
            </div>
          </div>

          <div className="midi-page__side">
            <section className="midi-card" aria-label="MIDI source">
              <div className="midi-card__header">
                <span>MIDI source</span>
                <strong>{midiFileName}</strong>
              </div>

              <label className="upload-control">
                <input
                  accept=".mid,.midi,audio/midi,audio/x-midi"
                  onChange={handleMidiUpload}
                  type="file"
                />
                <span>Upload MIDI</span>
              </label>

              <button className="action-button" onClick={handleLoadSample} type="button">
                Load sample
              </button>

              {midiError ? <p className="form-error">{midiError}</p> : null}
            </section>

            <section className="midi-card" aria-label="MIDI track picker">
              <div className="field-control">
                <label htmlFor="track-select">Track</label>
                <select
                  id="track-select"
                  onChange={handleTrackSelectionChange}
                  value={selectedTrack}
                >
                  <option value="all">
                    All tracks ({parsedMidi.noteEvents.length} notes)
                  </option>
                  {parsedMidi.tracks.map((track) => (
                    <option
                      disabled={track.noteCount === 0}
                      key={track.index}
                      value={track.index}
                    >
                      {formatTrackOption(track)}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="midi-card" aria-label="Ocarina profile">
              <div className="note-lab__range">
                <span>Playable range</span>
                <strong>
                  {playableRange.lowest.noteName}-{playableRange.highest.noteName}
                </strong>
              </div>

              <div className="note-grid" aria-label="Playable notes">
                {profile.fingerings.map((fingering) => (
                  <button
                    aria-pressed={fingering.midiNote === activeMidiNote}
                    className="note-button"
                    data-testid={`note-button-${fingering.noteName}`}
                    key={fingering.midiNote}
                    onClick={() => setActiveMidiNote(fingering.midiNote)}
                    type="button"
                  >
                    <span>{fingering.noteName}</span>
                    <small>MIDI {fingering.midiNote}</small>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="midi-readiness" aria-label="MIDI readiness preview">
          <div className="status-panel">
            <span>Incoming MIDI range</span>
            <strong>{formatMidiRangeFit(midiRangeFit)}</strong>
          </div>

          <div className="status-panel">
            <span>Tab generation path</span>
            <strong>{formatTabGenerationPath(midiRangeFit)}</strong>
          </div>

          <div className="status-panel">
            <span>Tab steps</span>
            <strong>{formatStepCount(ocarinaTab)}</strong>
          </div>

          <div className="status-panel">
            <span>Monophonic cleanup</span>
            <strong>{formatMonophonicLine(monophonicLine)}</strong>
          </div>
        </section>

        <section className="tab-sequence" aria-label="Generated tab sequence">
          <div className="tab-sequence__header">
            <h2>Generated tab</h2>
            <span>{formatTransposition(tabTransposition)}</span>
          </div>

          <div className="tab-score" data-testid="generated-tab">
            {tabLines.map((line) => (
              <div className="tab-line" key={line.index}>
                <div className="tab-line__marker">
                  <span>Beat</span>
                  <strong>{line.startBeat + 1}</strong>
                </div>

                <div className="tab-strip">
                  {line.steps.map((step) => (
                    <article
                      className="tab-step"
                      data-active={step.index === activeTabStep?.index}
                      data-supported={step.fingering ? 'true' : 'false'}
                      data-testid={`tab-step-${step.index}`}
                      key={`${step.index}-${step.startMs}-${step.midiNote}`}
                    >
                      <div className="tab-step__meta">
                        <span>{step.index + 1}</span>
                        <strong>
                          {step.fingering?.noteName ?? `MIDI ${step.midiNote}`}
                        </strong>
                      </div>

                      <div className="tab-step__diagram">
                        <OcarinaDiagram
                          filledHoles={step.fingering?.filledHoles ?? []}
                          title={
                            step.fingering
                              ? `${step.fingering.noteName} tab fingering`
                              : `Unsupported MIDI ${step.midiNote}`
                          }
                        />
                      </div>

                      <small>
                        {formatBeat(step.startTick, parsedMidi.ticksPerQuarter)} /{' '}
                        {formatBeat(step.durationTicks, parsedMidi.ticksPerQuarter)}
                      </small>

                      {step.fingering ? null : (
                        <b aria-label="Unsupported note">Unsupported</b>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}

type MidiRangeFit = ReturnType<typeof analyzeMidiRangeFit>

function formatMidiRangeFit(midiRangeFit: MidiRangeFit) {
  const sourceRange = midiRangeFit.sourceRange

  if (!sourceRange) {
    return 'No notes found'
  }

  return `MIDI ${sourceRange.lowestMidiNote}-${sourceRange.highestMidiNote}, ${sourceRange.spanSemitones} semitones`
}

function formatTabGenerationPath(midiRangeFit: MidiRangeFit) {
  if (midiRangeFit.status === 'direct') {
    return 'Playable without transposition'
  }

  if (midiRangeFit.bestTransposition) {
    return `Playable at ${formatSemitoneShift(
      midiRangeFit.bestTransposition.semitones,
    )}`
  }

  return `Unsupported: ${midiRangeFit.unsupportedMidiNotes
    .map((midiNote) => `MIDI ${midiNote}`)
    .join(', ')}`
}

function formatSemitoneShift(semitones: number) {
  if (semitones === 0) {
    return '0 semitones'
  }

  return `${semitones > 0 ? '+' : ''}${semitones} semitones`
}

function formatStepCount(tab: readonly OcarinaTabStep[]) {
  const playableSteps = tab.filter((step) => step.fingering).length

  return `${playableSteps}/${tab.length} playable`
}

function formatMonophonicLine(monophonicLine: MonophonicMidiLine) {
  if (monophonicLine.sourceNoteCount === monophonicLine.notes.length) {
    return 'No polyphony found'
  }

  return `${monophonicLine.droppedChordNotes} chord notes removed, ${monophonicLine.clippedOverlapNotes} overlaps clipped`
}

function getDefaultTrackSelection(parsedMidi: ParsedMidiFile): TrackSelection {
  return parsedMidi.tracks.find((track) => track.noteCount > 0)?.index ?? 'all'
}

function getSelectedTrackNotes(
  parsedMidi: ParsedMidiFile,
  selectedTrack: TrackSelection,
): readonly MidiNoteEvent[] {
  if (selectedTrack === 'all') {
    return parsedMidi.noteEvents
  }

  return (
    parsedMidi.tracks.find((track) => track.index === selectedTrack)
      ?.noteEvents ?? []
  )
}

function getFirstMonophonicNote(
  parsedMidi: ParsedMidiFile,
  selectedTrack: TrackSelection,
) {
  return createMonophonicMidiLine(
    getSelectedTrackNotes(parsedMidi, selectedTrack),
  ).notes[0]
}

function formatTrackOption(track: ParsedMidiFile['tracks'][number]) {
  const trackName = track.name ? `${track.name} ` : ''
  const channels =
    track.channels.length > 0
      ? `, channels ${track.channels.map((channel) => channel + 1).join('/')}`
      : ''

  return `Track ${track.index + 1}: ${trackName}(${track.noteCount} notes${channels})`
}

function formatTransposition(semitones: number) {
  return semitones === 0
    ? 'Original pitch'
    : `Transposed ${formatSemitoneShift(semitones)}`
}

function midiNoteToFrequency(midiNote: number) {
  return 440 * 2 ** ((midiNote - 69) / 12)
}

function createTabLines(
  tab: readonly OcarinaTabStep[],
  ticksPerQuarter: number,
): readonly TabLine[] {
  const beatsPerLine = 8
  const ticksPerLine = ticksPerQuarter * beatsPerLine
  const linesByIndex = new Map<number, OcarinaTabStep[]>()

  for (const step of tab) {
    const lineIndex = Math.floor(step.startTick / ticksPerLine)
    const line = linesByIndex.get(lineIndex) ?? []
    line.push(step)
    linesByIndex.set(lineIndex, line)
  }

  return [...linesByIndex.entries()].map(([index, steps]) => ({
    index,
    startBeat: index * beatsPerLine,
    steps,
  }))
}

function formatBeat(ticks: number, ticksPerQuarter: number) {
  return `${formatDecimal(ticks / ticksPerQuarter)} beats`
}

function formatDecimal(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2)
}

export default App
