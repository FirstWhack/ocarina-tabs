import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'
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
const beatsPerTabLine = 8
const defaultPlaybackSpeed = 1
const minimumPlaybackSpeed = 0.5
const maximumPlaybackSpeed = 1.5
const playbackProgressIntervalMs = 80
type TrackSelection = readonly number[]
type TabDisplayMode = 'cards' | 'sheet'
type SuggestionDifficulty = 'easy' | 'medium' | 'hard'
type TabLine = {
  index: number
  startBeat: number
  steps: readonly OcarinaTabStep[]
}
type TabSection = {
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
  const [selectedTracks, setSelectedTracks] = useState<TrackSelection>([0])
  const [transpositionSemitones, setTranspositionSemitones] = useState(0)
  const [midiFileName, setMidiFileName] = useState(sampleMidiName)
  const [midiError, setMidiError] = useState<string | undefined>()
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(defaultPlaybackSpeed)
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0)
  const [tabDisplayMode, setTabDisplayMode] = useState<TabDisplayMode>('cards')
  const [hideUnsupportedNotes, setHideUnsupportedNotes] = useState(false)
  const [suggestionDifficulty, setSuggestionDifficulty] =
    useState<SuggestionDifficulty>('easy')
  const playbackTimeoutsRef = useRef<number[]>([])
  const playbackProgressIntervalRef = useRef<number | undefined>(undefined)
  const playbackPositionMsRef = useRef(0)
  const oscillatorsRef = useRef<OscillatorNode[]>([])
  const audioContextRef = useRef<AudioContext | undefined>(undefined)

  const activeFingering = getFingeringForMidiNote(profile, activeMidiNote)
  const playableRange = getPlayableRange(profile)
  const selectedTrackNotes = useMemo(
    () => getSelectedTrackNotes(parsedMidi, selectedTracks),
    [parsedMidi, selectedTracks],
  )
  const rawMonophonicLine = useMemo(
    () => createMonophonicMidiLine(selectedTrackNotes),
    [selectedTrackNotes],
  )
  const monophonicLine = useMemo(
    () => trimMonophonicLineStart(rawMonophonicLine),
    [rawMonophonicLine],
  )
  const midiNotes = useMemo(
    () => monophonicLine.notes.map((note) => note.midiNote),
    [monophonicLine],
  )
  const midiRangeFit = useMemo(
    () => analyzeMidiRangeFit(profile, midiNotes),
    [midiNotes],
  )
  const suggestedTransposition =
    midiNotes.length > 0
      ? (midiRangeFit.bestTransposition ??
          midiRangeFit.bestCompatibleTransposition)?.semitones
      : undefined
  const suggestedTracks = useMemo(
    () => getSuggestedTrackSelection(parsedMidi, suggestionDifficulty),
    [parsedMidi, suggestionDifficulty],
  )
  const ocarinaTab = useMemo(
    () =>
      createOcarinaTab(profile, monophonicLine.notes, {
        transpositionSemitones,
      }),
    [monophonicLine, transpositionSemitones],
  )
  const playableTabSteps = ocarinaTab.filter((step) => step.fingering)
  const playableDurationMs = useMemo(
    () => getTabDurationMs(playableTabSteps),
    [playableTabSteps],
  )
  const activeTabStep = ocarinaTab.find((step) => step.index === activeTabIndex)
  const visibleTabSteps = useMemo(
    () =>
      hideUnsupportedNotes
        ? trimTabStepsStart(ocarinaTab.filter((step) => step.fingering))
        : ocarinaTab,
    [hideUnsupportedNotes, ocarinaTab],
  )
  const tabLines = useMemo(
    () => createTabLines(visibleTabSteps, parsedMidi.ticksPerQuarter),
    [visibleTabSteps, parsedMidi.ticksPerQuarter],
  )
  const tabSections = useMemo(
    () => createTabSections(visibleTabSteps, parsedMidi.ticksPerQuarter),
    [visibleTabSteps, parsedMidi.ticksPerQuarter],
  )

  useEffect(() => {
    return () => {
      for (const timeoutId of playbackTimeoutsRef.current) {
        window.clearTimeout(timeoutId)
      }

      if (playbackProgressIntervalRef.current !== undefined) {
        window.clearInterval(playbackProgressIntervalRef.current)
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
      const nextSelectedTracks = getDefaultTrackSelection(nextParsedMidi)
      const firstNote = getFirstMonophonicNote(nextParsedMidi, nextSelectedTracks)

      setParsedMidi(nextParsedMidi)
      setSelectedTracks(nextSelectedTracks)
      setTranspositionSemitones(0)
      setMidiFileName(file.name)
      setMidiError(undefined)
      setActiveTabIndex(undefined)
      updatePlaybackPosition(0)

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
    const nextSelectedTracks = getDefaultTrackSelection(nextParsedMidi)
    const firstNote = getFirstMonophonicNote(nextParsedMidi, nextSelectedTracks)

    setParsedMidi(nextParsedMidi)
    setSelectedTracks(nextSelectedTracks)
    setTranspositionSemitones(0)
    setMidiFileName(sampleMidiName)
    setMidiError(undefined)
    setActiveTabIndex(undefined)
    updatePlaybackPosition(0)
    setActiveMidiNote(firstNote?.midiNote ?? initialMidiNote)
  }

  function handlePreviewSample() {
    clearPreviewPlayback()
    const nextParsedMidi = parseMidiFile(createTwinkleOcarinaMidiFile())
    const nextSelectedTracks = getDefaultTrackSelection(nextParsedMidi)
    const nextLine = createMonophonicMidiLine(
      getSelectedTrackNotes(nextParsedMidi, nextSelectedTracks),
    )
    const nextTab = createOcarinaTab(profile, nextLine.notes)
    const firstNote = nextLine.notes[0]

    setParsedMidi(nextParsedMidi)
    setSelectedTracks(nextSelectedTracks)
    setTranspositionSemitones(0)
    setMidiFileName(sampleMidiName)
    setMidiError(undefined)
    setActiveTabIndex(undefined)
    updatePlaybackPosition(0)
    setActiveMidiNote(firstNote?.midiNote ?? initialMidiNote)
    playPreview(nextTab, 0)
  }

  function handleTrackSelectionChange(trackIndex: number, isSelected: boolean) {
    clearPreviewPlayback()
    const nextSelectedTracks = isSelected
      ? [...new Set([...selectedTracks, trackIndex])].sort(
          (left, right) => left - right,
        )
      : selectedTracks.filter((selectedTrack) => selectedTrack !== trackIndex)
    const firstNote = getFirstMonophonicNote(parsedMidi, nextSelectedTracks)

    setSelectedTracks(nextSelectedTracks)
    setTranspositionSemitones(0)
    setActiveTabIndex(undefined)
    updatePlaybackPosition(0)

    if (firstNote) {
      setActiveMidiNote(firstNote.midiNote)
    }
  }

  function handleSelectAllTracks() {
    clearPreviewPlayback()
    const nextSelectedTracks = parsedMidi.tracks
      .filter((track) => track.noteCount > 0)
      .map((track) => track.index)
    const firstNote = getFirstMonophonicNote(parsedMidi, nextSelectedTracks)

    setSelectedTracks(nextSelectedTracks)
    setTranspositionSemitones(0)
    setActiveTabIndex(undefined)
    updatePlaybackPosition(0)
    setActiveMidiNote(firstNote?.midiNote ?? initialMidiNote)
  }

  function handleClearTracks() {
    clearPreviewPlayback()
    setSelectedTracks([])
    setTranspositionSemitones(0)
    setActiveTabIndex(undefined)
    updatePlaybackPosition(0)
  }

  function handleTranspose(semitones: number) {
    clearPreviewPlayback()
    const nextSemitones = clampSemitones(transpositionSemitones + semitones)
    const firstNote = monophonicLine.notes[0]

    setTranspositionSemitones(nextSemitones)
    setActiveTabIndex(undefined)
    updatePlaybackPosition(0)

    if (firstNote) {
      setActiveMidiNote(firstNote.midiNote + nextSemitones)
    }
  }

  function handleTranspositionInputChange(event: ChangeEvent<HTMLInputElement>) {
    clearPreviewPlayback()
    const nextSemitones = clampSemitones(Number(event.target.value))
    const firstNote = monophonicLine.notes[0]

    setTranspositionSemitones(nextSemitones)
    setActiveTabIndex(undefined)
    updatePlaybackPosition(0)

    if (firstNote) {
      setActiveMidiNote(firstNote.midiNote + nextSemitones)
    }
  }

  function handleUseSuggestedTransposition() {
    if (suggestedTransposition === undefined) {
      return
    }

    clearPreviewPlayback()
    setTranspositionSemitones(suggestedTransposition)
    setActiveTabIndex(undefined)
    updatePlaybackPosition(0)

    const firstNote = monophonicLine.notes[0]

    if (firstNote) {
      setActiveMidiNote(firstNote.midiNote + suggestedTransposition)
    }
  }

  function handleUseSuggestedTrack() {
    if (suggestedTracks.length === 0) {
      return
    }

    clearPreviewPlayback()
    setSelectedTracks(suggestedTracks)
    setTranspositionSemitones(0)
    setActiveTabIndex(undefined)
    updatePlaybackPosition(0)

    const firstNote = getFirstMonophonicNote(parsedMidi, suggestedTracks)

    setActiveMidiNote(firstNote?.midiNote ?? initialMidiNote)
  }

  function handlePlayCurrentTab() {
    if (isPlaying) {
      const nextPosition = getCurrentPlaybackPositionMs(playableDurationMs)

      clearPreviewPlayback({ preserveActiveStep: true })
      updatePlaybackPosition(nextPosition)
      setActiveStepAtPosition(playableTabSteps, nextPosition)
      return
    }

    playPreview(ocarinaTab, playbackPositionMs >= playableDurationMs ? 0 : playbackPositionMs)
  }

  function handlePlaybackSpeedChange(event: ChangeEvent<HTMLInputElement>) {
    const nextSpeed = clampPlaybackSpeed(Number(event.target.value))

    setPlaybackSpeed(nextSpeed)

    if (isPlaying) {
      const nextPosition = getCurrentPlaybackPositionMs(playableDurationMs)
      clearPreviewPlayback({ preserveActiveStep: true })
      updatePlaybackPosition(nextPosition)
      playPreview(ocarinaTab, nextPosition, nextSpeed)
    }
  }

  function handlePlaybackSeek(event: ChangeEvent<HTMLInputElement>) {
    const nextPosition = clampPlaybackPosition(
      Number(event.target.value),
      playableDurationMs,
    )
    const shouldResume = isPlaying

    clearPreviewPlayback({ preserveActiveStep: true })
    updatePlaybackPosition(nextPosition)
    setActiveStepAtPosition(playableTabSteps, nextPosition)

    if (shouldResume) {
      playPreview(ocarinaTab, nextPosition)
    }
  }

  function playPreview(
    tabSteps: readonly OcarinaTabStep[],
    startPositionMs = 0,
    speed = playbackSpeed,
  ) {
    const stepsWithFingerings = tabSteps.filter((step) => step.fingering)
    const durationMs = getTabDurationMs(stepsWithFingerings)
    const previewStartMs = clampPlaybackPosition(startPositionMs, durationMs)
    const remainingSteps = stepsWithFingerings.filter(
      (step) => step.startMs + step.durationMs > previewStartMs,
    )

    if (remainingSteps.length === 0) {
      updatePlaybackPosition(durationMs)
      return
    }

    clearPreviewPlayback({ preserveActiveStep: true })
    setIsPlaying(true)
    updatePlaybackPosition(previewStartMs)
    setActiveStepAtPosition(stepsWithFingerings, previewStartMs)
    startPlaybackProgress(previewStartMs, durationMs, speed)

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
      scheduleAudioPreview(audioContext, remainingSteps, previewStartMs, speed)
    }

    for (const step of remainingSteps) {
      if (step.startMs < previewStartMs) {
        continue
      }

      const timeoutId = window.setTimeout(() => {
        setActiveMidiNote(step.midiNote)
        setActiveTabIndex(step.index)
      }, Math.max(0, (step.startMs - previewStartMs) / speed))
      playbackTimeoutsRef.current.push(timeoutId)
    }

    const finalTimeoutId = window.setTimeout(
      () => {
        updatePlaybackPosition(durationMs)
        clearPreviewPlayback({ preserveActiveStep: true })
      },
      Math.max(0, (durationMs - previewStartMs) / speed) + 120,
    )
    playbackTimeoutsRef.current.push(finalTimeoutId)
  }

  function scheduleAudioPreview(
    audioContext: AudioContext,
    tabSteps: readonly OcarinaTabStep[],
    previewStartMs: number,
    speed: number,
  ) {
    const previewStartTime = audioContext.currentTime + 0.05

    for (const step of tabSteps) {
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      const stepEndMs = step.startMs + step.durationMs
      const startOffsetMs = Math.max(0, step.startMs - previewStartMs)
      const remainingDurationMs = Math.max(0, stepEndMs - previewStartMs)
      const audibleDurationMs = Math.min(step.durationMs, remainingDurationMs)
      const startTime = previewStartTime + startOffsetMs / speed / 1000
      const endTime = startTime + Math.max(audibleDurationMs / speed / 1000, 0.08)

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

  function startPlaybackProgress(
    startPositionMs: number,
    durationMs: number,
    speed: number,
  ) {
    if (playbackProgressIntervalRef.current !== undefined) {
      window.clearInterval(playbackProgressIntervalRef.current)
    }

    playbackPositionMsRef.current = startPositionMs
    playbackProgressIntervalRef.current = window.setInterval(() => {
      updatePlaybackPosition(
        clampPlaybackPosition(
          playbackPositionMsRef.current + playbackProgressIntervalMs * speed,
          durationMs,
        ),
      )
    }, playbackProgressIntervalMs)
  }

  function getCurrentPlaybackPositionMs(durationMs: number) {
    return clampPlaybackPosition(playbackPositionMsRef.current, durationMs)
  }

  function updatePlaybackPosition(positionMs: number) {
    playbackPositionMsRef.current = positionMs
    setPlaybackPositionMs(positionMs)
  }

  function setActiveStepAtPosition(
    tabSteps: readonly OcarinaTabStep[],
    positionMs: number,
  ) {
    const activeStep =
      tabSteps.find(
        (step) =>
          positionMs >= step.startMs &&
          positionMs < step.startMs + step.durationMs,
      ) ??
      [...tabSteps]
        .filter((step) => step.startMs <= positionMs)
        .at(-1) ??
      tabSteps[0]

    if (!activeStep) {
      setActiveTabIndex(undefined)
      return
    }

    setActiveMidiNote(activeStep.midiNote)
    setActiveTabIndex(activeStep.index)
  }

  function clearPreviewPlayback(
    options: { preserveActiveStep?: boolean } = {},
  ) {
    for (const timeoutId of playbackTimeoutsRef.current) {
      window.clearTimeout(timeoutId)
    }

    playbackTimeoutsRef.current = []

    if (playbackProgressIntervalRef.current !== undefined) {
      window.clearInterval(playbackProgressIntervalRef.current)
      playbackProgressIntervalRef.current = undefined
    }

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

    if (!options.preserveActiveStep) {
      setActiveTabIndex(undefined)
    }
  }

  return (
    <main className="app-shell">
      <section className="app-workspace" aria-labelledby="page-title">
        <header className="app-header">
          <p className="app-eyebrow">Ocarina tab generator</p>
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

            <div className="playback-controls" aria-label="Playback controls">
              <label className="playback-slider">
                <span>Position</span>
                <input
                  aria-label="Playback position"
                  disabled={playableDurationMs === 0}
                  max={Math.max(0, Math.round(playableDurationMs))}
                  min={0}
                  onChange={handlePlaybackSeek}
                  step={50}
                  type="range"
                  value={Math.round(
                    clampPlaybackPosition(playbackPositionMs, playableDurationMs),
                  )}
                />
                <strong>
                  {formatPlaybackTime(playbackPositionMs)} /{' '}
                  {formatPlaybackTime(playableDurationMs)}
                </strong>
              </label>

              <label className="playback-slider playback-slider--speed">
                <span>Speed</span>
                <input
                  aria-label="Playback speed"
                  max={maximumPlaybackSpeed}
                  min={minimumPlaybackSpeed}
                  onChange={handlePlaybackSpeedChange}
                  step={0.05}
                  type="range"
                  value={playbackSpeed}
                />
                <strong>{formatPlaybackSpeed(playbackSpeed)}</strong>
              </label>
            </div>

            <section className="profile-strip" aria-label="Ocarina profile">
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

          <div className="midi-page__side">
            <section className="midi-card" aria-label="MIDI source">
              <div className="midi-card__header">
                <span>MIDI source</span>
                <strong>{midiFileName}</strong>
              </div>

              <div className="midi-card__actions">
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
              </div>

              {midiError ? <p className="form-error">{midiError}</p> : null}
            </section>

            <section className="midi-card" aria-label="MIDI track picker">
              <div className="track-picker">
                <div className="track-picker__header">
                  <span>Tracks</span>
                  <strong>{formatTrackSelectionCount(selectedTracks)}</strong>
                </div>

                <div className="track-picker__controls">
                  <div className="track-picker__actions">
                    <button
                      className="action-button"
                      disabled={parsedMidi.noteEvents.length === 0}
                      onClick={handleSelectAllTracks}
                      type="button"
                    >
                      All
                    </button>
                    <button
                      className="action-button"
                      disabled={selectedTracks.length === 0}
                      onClick={handleClearTracks}
                      type="button"
                    >
                      Clear
                    </button>
                  </div>

                  <div
                    className="difficulty-control"
                    role="group"
                    aria-label="Suggested track difficulty"
                  >
                    <button
                      aria-pressed={suggestionDifficulty === 'easy'}
                      onClick={() => setSuggestionDifficulty('easy')}
                      type="button"
                    >
                      Easy
                    </button>
                    <button
                      aria-pressed={suggestionDifficulty === 'medium'}
                      onClick={() => setSuggestionDifficulty('medium')}
                      type="button"
                    >
                      Medium
                    </button>
                    <button
                      aria-pressed={suggestionDifficulty === 'hard'}
                      onClick={() => setSuggestionDifficulty('hard')}
                      type="button"
                    >
                      Hard
                    </button>
                  </div>

                  <details className="track-list-panel">
                    <summary>Track list</summary>

                    <div className="track-list" aria-label="Tracks">
                      {parsedMidi.tracks.map((track) => (
                        <label
                          className="track-option"
                          data-disabled={track.noteCount === 0}
                          key={track.index}
                        >
                          <input
                            checked={selectedTracks.includes(track.index)}
                            disabled={track.noteCount === 0}
                            onChange={(event) =>
                              handleTrackSelectionChange(
                                track.index,
                                event.target.checked,
                              )
                            }
                            type="checkbox"
                          />
                          <span>
                            <strong>{formatTrackName(track)}</strong>
                            <small>{formatTrackDetail(track)}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </details>
                </div>
              </div>

              <div className="midi-card__suggestion">
                <button
                  className="action-button"
                  disabled={
                    suggestedTracks.length === 0 ||
                    areTrackSelectionsEqual(selectedTracks, suggestedTracks)
                  }
                  onClick={handleUseSuggestedTrack}
                  type="button"
                >
                  {suggestedTracks.length > 1
                    ? 'Use suggested tracks'
                    : 'Use suggested track'}
                </button>
              </div>
            </section>

            <section className="midi-card" aria-label="Transposition controls">
              <div className="transpose-control">
                <div className="transpose-control__header">
                  <span>Transpose</span>
                  <strong data-testid="transpose-value">
                    {formatSemitoneShift(transpositionSemitones)}
                  </strong>
                </div>

                <div className="transpose-control__actions">
                  <div className="transpose-control__buttons">
                    <button
                      className="action-button"
                      onClick={() => handleTranspose(-12)}
                      type="button"
                    >
                      -12
                    </button>
                    <button
                      className="action-button"
                      onClick={() => handleTranspose(-1)}
                      type="button"
                    >
                      -1
                    </button>
                    <input
                      aria-label="Transpose semitones"
                      max={24}
                      min={-24}
                      onChange={handleTranspositionInputChange}
                      type="number"
                      value={transpositionSemitones}
                    />
                    <button
                      className="action-button"
                      onClick={() => handleTranspose(1)}
                      type="button"
                    >
                      +1
                    </button>
                    <button
                      className="action-button"
                      onClick={() => handleTranspose(12)}
                      type="button"
                    >
                      +12
                    </button>
                  </div>

                </div>

                <div className="midi-card__suggestion">
                  <button
                    className="action-button"
                    disabled={
                      suggestedTransposition === undefined ||
                      suggestedTransposition === transpositionSemitones
                    }
                    onClick={handleUseSuggestedTransposition}
                    type="button"
                  >
                    Use suggested
                  </button>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="tab-sequence" aria-label="Generated tab sequence">
          <div className="tab-sequence__header">
            <div>
              <h2>Generated tab</h2>
              <span>{formatTransposition(transpositionSemitones)}</span>
            </div>

            <div className="tab-view-toggle" role="group" aria-label="Tab display mode">
              <button
                aria-pressed={tabDisplayMode === 'cards'}
                onClick={() => setTabDisplayMode('cards')}
                type="button"
              >
                Cards
              </button>
              <button
                aria-pressed={tabDisplayMode === 'sheet'}
                onClick={() => setTabDisplayMode('sheet')}
                type="button"
              >
                Sheet
              </button>
            </div>

            <label className="tab-filter-toggle">
              <input
                checked={hideUnsupportedNotes}
                onChange={(event) => setHideUnsupportedNotes(event.target.checked)}
                type="checkbox"
              />
              <span>Hide unsupported</span>
            </label>
          </div>

          <details className="diagnostics-panel">
            <summary>
              <span>Info</span>
              <strong>{formatStepCount(ocarinaTab)}</strong>
            </summary>

            <div className="midi-readiness" aria-label="MIDI readiness preview">
              <div className="status-panel">
                <span>Incoming MIDI range</span>
                <strong>{formatMidiRangeFit(midiRangeFit)}</strong>
              </div>

              <div className="status-panel">
                <span>Tab generation path</span>
                <strong>
                  {formatTabGenerationPath(ocarinaTab, transpositionSemitones)}
                </strong>
              </div>

              <div className="status-panel">
                <span>Tab steps</span>
                <strong>{formatStepCount(ocarinaTab)}</strong>
              </div>

              <div className="status-panel">
                <span>Monophonic cleanup</span>
                <strong>{formatMonophonicLine(monophonicLine)}</strong>
              </div>
            </div>
          </details>

          {tabDisplayMode === 'sheet' ? (
            <div
              className="tab-sheet-page"
              data-testid="generated-tab"
            >
              {tabSections.map((section) => (
                <section
                  aria-label={`Tab section ${section.index + 1}, starting at beat ${
                    section.startBeat + 1
                  }`}
                  className="tab-sheet-section"
                  key={section.index}
                >
                  <div className="tab-sheet-flow">
                    {section.steps.map((step, index) => {
                      const nextStep = section.steps[index + 1]

                      return (
                        <span
                          className="tab-sheet-token"
                          key={`${step.index}-${step.startMs}-${step.midiNote}`}
                        >
                          <button
                            aria-label={formatContinuousTabStepLabel(
                              step,
                              parsedMidi.ticksPerQuarter,
                            )}
                            className="tab-sheet-note"
                            data-active={step.index === activeTabStep?.index}
                            data-supported={step.fingering ? 'true' : 'false'}
                            data-testid={`tab-step-${step.index}`}
                            onClick={() => {
                              setActiveMidiNote(step.midiNote)
                              setActiveTabIndex(step.index)
                            }}
                            type="button"
                          >
                            <OcarinaDiagram
                              className="tab-sheet-note__diagram"
                              filledHoles={step.fingering?.filledHoles ?? []}
                              title={
                                step.fingering
                                  ? `${step.fingering.noteName} tab fingering`
                                  : `Unsupported MIDI ${step.midiNote}`
                              }
                            />
                          </button>

                          <span
                            aria-hidden="true"
                            className="tab-sheet-duration"
                            style={getTabSheetSeparatorStyle(
                              step,
                              nextStep,
                              parsedMidi.ticksPerQuarter,
                            )}
                          />
                        </span>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
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
                          {formatBeat(
                            step.durationTicks,
                            parsedMidi.ticksPerQuarter,
                          )}
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
          )}
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

function formatTabGenerationPath(
  tab: readonly OcarinaTabStep[],
  transpositionSemitones: number,
) {
  const unsupportedMidiNotes = [
    ...new Set(
      tab
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
  const suggestedTracks = getSuggestedTrackSelection(parsedMidi, 'easy')

  if (suggestedTracks.length > 0) {
    return suggestedTracks
  }

  return parsedMidi.tracks
    .filter((track) => track.noteCount > 0)
    .slice(0, 1)
    .map((track) => track.index)
}

function getSelectedTrackNotes(
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

function getFirstMonophonicNote(
  parsedMidi: ParsedMidiFile,
  selectedTracks: TrackSelection,
) {
  return createMonophonicMidiLine(
    getSelectedTrackNotes(parsedMidi, selectedTracks),
  ).notes[0]
}

function trimMonophonicLineStart(
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

function trimTabStepsStart(
  tabSteps: readonly OcarinaTabStep[],
): readonly OcarinaTabStep[] {
  const firstStep = tabSteps[0]

  if (!firstStep || (firstStep.startTick === 0 && firstStep.startMs === 0)) {
    return tabSteps
  }

  return tabSteps.map((step) => ({
    ...step,
    startTick: Math.max(0, step.startTick - firstStep.startTick),
    startMs: Math.max(0, step.startMs - firstStep.startMs),
  }))
}

function getSuggestedTrackSelection(
  parsedMidi: ParsedMidiFile,
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

function formatTrackName(track: ParsedMidiFile['tracks'][number]) {
  return track.name
    ? `Track ${track.index + 1}: ${track.name}`
    : `Track ${track.index + 1}`
}

function formatTrackDetail(track: ParsedMidiFile['tracks'][number]) {
  const channels =
    track.channels.length > 0
      ? `, channels ${track.channels.map((channel) => channel + 1).join('/')}`
      : ''

  return `${track.noteCount} notes${channels}`
}

function formatTrackSelectionCount(selectedTracks: TrackSelection) {
  if (selectedTracks.length === 0) {
    return 'None'
  }

  return `${selectedTracks.length} selected`
}

function areTrackSelectionsEqual(
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

function formatTransposition(semitones: number) {
  return semitones === 0
    ? 'Original pitch'
    : `Transposed ${formatSemitoneShift(semitones)}`
}

function midiNoteToFrequency(midiNote: number) {
  return 440 * 2 ** ((midiNote - 69) / 12)
}

function getTabDurationMs(tabSteps: readonly OcarinaTabStep[]) {
  return tabSteps.reduce(
    (durationMs, step) =>
      Math.max(durationMs, step.startMs + Math.max(0, step.durationMs)),
    0,
  )
}

function clampSemitones(semitones: number) {
  return Math.max(-24, Math.min(24, Number.isFinite(semitones) ? semitones : 0))
}

function clampPlaybackSpeed(speed: number) {
  return Math.max(
    minimumPlaybackSpeed,
    Math.min(maximumPlaybackSpeed, Number.isFinite(speed) ? speed : 1),
  )
}

function clampPlaybackPosition(positionMs: number, durationMs: number) {
  return Math.max(
    0,
    Math.min(
      Math.max(0, durationMs),
      Number.isFinite(positionMs) ? positionMs : 0,
    ),
  )
}

function formatPlaybackTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatPlaybackSpeed(speed: number) {
  return `${formatDecimal(speed)}x`
}

function createTabLines(
  tab: readonly OcarinaTabStep[],
  ticksPerQuarter: number,
): readonly TabLine[] {
  const ticksPerLine = ticksPerQuarter * beatsPerTabLine
  const linesByIndex = new Map<number, OcarinaTabStep[]>()

  for (const step of tab) {
    const lineIndex = Math.floor(step.startTick / ticksPerLine)
    const line = linesByIndex.get(lineIndex) ?? []
    line.push(step)
    linesByIndex.set(lineIndex, line)
  }

  return [...linesByIndex.entries()].map(([index, steps]) => ({
    index,
    startBeat: index * beatsPerTabLine,
    steps,
  }))
}

function createTabSections(
  tab: readonly OcarinaTabStep[],
  ticksPerQuarter: number,
): readonly TabSection[] {
  const minimumBreakBeats = 2
  const fallbackSectionBeats = 32
  const sections: TabSection[] = []
  let currentSteps: OcarinaTabStep[] = []
  let sectionStartTick = tab[0]?.startTick ?? 0

  for (const step of tab) {
    const previousStep = currentSteps.at(-1)

    if (previousStep) {
      const previousEndTick = previousStep.startTick + previousStep.durationTicks
      const restBeats = (step.startTick - previousEndTick) / ticksPerQuarter
      const sectionBeats = (step.startTick - sectionStartTick) / ticksPerQuarter
      const shouldBreak =
        restBeats >= minimumBreakBeats || sectionBeats >= fallbackSectionBeats

      if (shouldBreak) {
        sections.push({
          index: sections.length,
          startBeat: sectionStartTick / ticksPerQuarter,
          steps: currentSteps,
        })
        currentSteps = []
        sectionStartTick = step.startTick
      }
    }

    currentSteps.push(step)
  }

  if (currentSteps.length > 0) {
    sections.push({
      index: sections.length,
      startBeat: sectionStartTick / ticksPerQuarter,
      steps: currentSteps,
    })
  }

  return sections
}

function getTabSheetSeparatorStyle(
  step: OcarinaTabStep,
  nextStep: OcarinaTabStep | undefined,
  ticksPerQuarter: number,
): CSSProperties {
  const restTicks = Math.max(
    0,
    nextStep ? nextStep.startTick - (step.startTick + step.durationTicks) : 0,
  )
  const durationBeats = step.durationTicks / ticksPerQuarter
  const restBeats = restTicks / ticksPerQuarter
  const dashWidth = Math.min(76, Math.max(14, 10 + durationBeats * 22))
  const restSpacing = Math.min(36, restBeats * 18)

  return {
    width: `${dashWidth}px`,
    marginRight: `${8 + restSpacing}px`,
    opacity: durationBeats >= 1 ? 1 : 0.62,
  }
}

function formatContinuousTabStepLabel(
  step: OcarinaTabStep,
  ticksPerQuarter: number,
) {
  const noteName = step.fingering?.noteName ?? `Unsupported MIDI ${step.midiNote}`

  return `${noteName}, starts at ${formatBeat(
    step.startTick,
    ticksPerQuarter,
  )}`
}

function formatBeat(ticks: number, ticksPerQuarter: number) {
  return `${formatDecimal(ticks / ticksPerQuarter)} beats`
}

function formatDecimal(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2)
}

export default App
