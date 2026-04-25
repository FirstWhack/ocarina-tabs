import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent, KeyboardEvent, PointerEvent } from 'react'
import { OcarinaDiagram } from './components/OcarinaDiagram/OcarinaDiagram'
import {
  analyzeMidiRangeFit,
  getFingeringForMidiNote,
  getPlayableRange,
  standard12HoleCOcarinaProfile,
} from './ocarina/ocarinaProfile'
import { createMonophonicMidiLine } from './ocarina/ocarinaTab'
import { parseMidiFile } from './midi/midiParser'
import type { ParsedMidiFile } from './midi/midiParser'
import { createTwinkleOcarinaMidiFile } from './midi/sampleMidi'
import { createTabDocumentFromMidi } from './features/midiImport/midiToTabDocument'
import type {
  SuggestionDifficulty,
  TrackSelection,
} from './features/midiImport/midiImportTypes'
import {
  areTrackSelectionsEqual,
  formatTrackDetail,
  formatTrackName,
  formatTrackSelectionCount,
  getDefaultTrackSelection,
  getFirstMonophonicNote,
  getSelectedTrackNotes,
  getSuggestedTrackSelection,
  trimMonophonicLineStart,
} from './features/midiImport/midiTrackSelection'
import { useTabPlayback } from './features/playback/useTabPlayback'
import { midiNoteToFrequency } from './features/playback/playbackMath'
import { GeneratedTabPanel } from './features/tabViewer/GeneratedTabPanel'
import type { TabDisplayMode } from './features/tabViewer/GeneratedTabPanel'
import {
  formatPlaybackSpeed,
  formatPlaybackTime,
  formatSemitoneShift,
} from './tabs/tabFormatters'
import { clampSemitones } from './tabs/tabLimits'
import {
  createTabLines,
  createTabSections,
  getPlayableTabSteps,
  getTabDurationMs,
  getVisibleTabSteps,
  transposeTabDocument,
} from './tabs/tabTransforms'
import type { TabDocument, TabStep } from './tabs/tabTypes'
import {
  parseSerializedTabDocument,
  serializeTabDocument,
} from './tabs/tabSerialization'
import './App.css'

const profile = standard12HoleCOcarinaProfile
const initialMidiNote = 72
const sampleMidiName = 'Twinkle C5 phrase.mid'
const lowestPlayableMidiNote = profile.fingerings[0].midiNote
const naturalPitchClasses = [0, 2, 4, 5, 7, 9, 11] as const
const accidentalWidthInWhiteKeys = 0.62
const lowestWhiteKeyIndex = getWhiteKeyIndex(lowestPlayableMidiNote)
const highestWhiteKeyIndex = getWhiteKeyIndex(
  profile.fingerings.at(-1)?.midiNote ?? lowestPlayableMidiNote,
)
const playableWhiteKeyCount = highestWhiteKeyIndex - lowestWhiteKeyIndex + 1

function isAccidentalNote(noteName: string) {
  return noteName.includes('#') || noteName.includes('b')
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

function cssVariables(
  variables: Record<`--${string}`, string | number>,
): CSSProperties {
  return variables as CSSProperties
}

function App() {
  const exportLinkRef = useRef<HTMLAnchorElement>(null)
  const keyboardAudioContextRef = useRef<AudioContext | undefined>(undefined)
  const keyboardOscillatorRef = useRef<OscillatorNode | undefined>(undefined)
  const keyboardGainRef = useRef<GainNode | undefined>(undefined)
  const [activeMidiNote, setActiveMidiNote] = useState(initialMidiNote)
  const [activeStepId, setActiveStepId] = useState<string | undefined>()
  const [parsedMidi, setParsedMidi] = useState<ParsedMidiFile>(() =>
    parseMidiFile(createTwinkleOcarinaMidiFile()),
  )
  const [selectedTracks, setSelectedTracks] = useState<TrackSelection>([0])
  const [transpositionSemitones, setTranspositionSemitones] = useState(0)
  const [midiFileName, setMidiFileName] = useState(sampleMidiName)
  const [midiError, setMidiError] = useState<string | undefined>()
  const [tabFileMessage, setTabFileMessage] = useState<string | undefined>()
  const [importedTabDocument, setImportedTabDocument] = useState<
    TabDocument | undefined
  >()
  const [tabDisplayMode, setTabDisplayMode] = useState<TabDisplayMode>('cards')
  const [hideUnsupportedNotes, setHideUnsupportedNotes] = useState(false)
  const [auditionNotes, setAuditionNotes] = useState(false)
  const [suggestionDifficulty, setSuggestionDifficulty] =
    useState<SuggestionDifficulty>('easy')

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
    () => getSuggestedTrackSelection(parsedMidi, profile, suggestionDifficulty),
    [parsedMidi, suggestionDifficulty],
  )
  const midiTabDocument = useMemo(
    () =>
      createTabDocumentFromMidi({
        parsedMidi,
        profile,
        fileName: midiFileName,
        selectedTracks,
        monophonicLine,
        transpositionSemitones,
      }),
    [
      parsedMidi,
      midiFileName,
      selectedTracks,
      monophonicLine,
      transpositionSemitones,
    ],
  )
  const activeTabDocument = importedTabDocument ?? midiTabDocument
  const isImportedTabActive = importedTabDocument !== undefined
  const playableTabSteps = useMemo(
    () => getPlayableTabSteps(activeTabDocument.steps),
    [activeTabDocument],
  )
  const playableDurationMs = useMemo(
    () => getTabDurationMs(playableTabSteps),
    [playableTabSteps],
  )
  const activeTabStep = activeTabDocument.steps.find(
    (step) => step.id === activeStepId,
  )
  const visibleTabSteps = useMemo(
    () => getVisibleTabSteps(activeTabDocument.steps, hideUnsupportedNotes),
    [hideUnsupportedNotes, activeTabDocument],
  )
  const tabLines = useMemo(
    () => createTabLines(visibleTabSteps, activeTabDocument.ticksPerQuarter),
    [visibleTabSteps, activeTabDocument],
  )
  const tabSections = useMemo(
    () => createTabSections(visibleTabSteps, activeTabDocument.ticksPerQuarter),
    [visibleTabSteps, activeTabDocument],
  )
  const playback = useTabPlayback({
    onActiveStepChange: (step) => {
      setActiveStepId(step?.id)

      if (step) {
        setActiveMidiNote(step.midiNote)
      }
    },
  })

  async function handleMidiUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    resetPlaybackForSourceChange()

    try {
      const nextParsedMidi = parseMidiFile(await file.arrayBuffer())
      const nextSelectedTracks = getDefaultTrackSelection(nextParsedMidi, profile)
      const firstNote = getFirstMonophonicNote(nextParsedMidi, nextSelectedTracks)

      setParsedMidi(nextParsedMidi)
      setSelectedTracks(nextSelectedTracks)
      setTranspositionSemitones(0)
      setMidiFileName(file.name)
      setMidiError(undefined)
      setImportedTabDocument(undefined)
      setTabFileMessage(undefined)

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

  async function handleTabImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    playback.stopPlayback()
    playback.updatePlaybackPosition(0)
    setActiveStepId(undefined)

    try {
      const nextDocument = parseSerializedTabDocument(await file.text(), profile)
      const firstStep = nextDocument.steps[0]

      setImportedTabDocument({
        ...nextDocument,
        source: { type: 'imported', fileName: file.name },
      })
      setTabFileMessage(`Imported ${file.name}`)
      setMidiError(undefined)
      setActiveMidiNote(firstStep?.midiNote ?? initialMidiNote)
    } catch (error) {
      setTabFileMessage(
        error instanceof Error ? error.message : 'Could not import that tab file.',
      )
    } finally {
      event.target.value = ''
    }
  }

  function handleLoadSample() {
    const nextParsedMidi = parseMidiFile(createTwinkleOcarinaMidiFile())
    const nextSelectedTracks = getDefaultTrackSelection(nextParsedMidi, profile)
    const firstNote = getFirstMonophonicNote(nextParsedMidi, nextSelectedTracks)

    resetPlaybackForSourceChange()
    setParsedMidi(nextParsedMidi)
    setSelectedTracks(nextSelectedTracks)
    setTranspositionSemitones(0)
    setMidiFileName(sampleMidiName)
    setMidiError(undefined)
    setImportedTabDocument(undefined)
    setTabFileMessage(undefined)
    setActiveMidiNote(firstNote?.midiNote ?? initialMidiNote)
  }

  function handlePreviewSample() {
    const nextParsedMidi = parseMidiFile(createTwinkleOcarinaMidiFile())
    const nextSelectedTracks = getDefaultTrackSelection(nextParsedMidi, profile)
    const nextLine = createMonophonicMidiLine(
      getSelectedTrackNotes(nextParsedMidi, nextSelectedTracks),
    )
    const firstNote = nextLine.notes[0]
    const nextMonophonicLine = trimMonophonicLineStart(nextLine)
    const nextDocument = createTabDocumentFromMidi({
      parsedMidi: nextParsedMidi,
      profile,
      fileName: sampleMidiName,
      selectedTracks: nextSelectedTracks,
      monophonicLine: nextMonophonicLine,
      transpositionSemitones: 0,
    })

    resetPlaybackForSourceChange()
    setParsedMidi(nextParsedMidi)
    setSelectedTracks(nextSelectedTracks)
    setTranspositionSemitones(0)
    setMidiFileName(sampleMidiName)
    setMidiError(undefined)
    setImportedTabDocument(undefined)
    setTabFileMessage(undefined)
    setActiveMidiNote(firstNote?.midiNote ?? initialMidiNote)
    playback.play(nextDocument.steps, 0)
  }

  function handleTrackSelectionChange(trackIndex: number, isSelected: boolean) {
    const nextSelectedTracks = isSelected
      ? [...new Set([...selectedTracks, trackIndex])].sort(
          (left, right) => left - right,
        )
      : selectedTracks.filter((selectedTrack) => selectedTrack !== trackIndex)
    const firstNote = getFirstMonophonicNote(parsedMidi, nextSelectedTracks)

    resetPlaybackForSourceChange()
    setSelectedTracks(nextSelectedTracks)
    setTranspositionSemitones(0)
    setImportedTabDocument(undefined)

    if (firstNote) {
      setActiveMidiNote(firstNote.midiNote)
    }
  }

  function handleSelectAllTracks() {
    const nextSelectedTracks = parsedMidi.tracks
      .filter((track) => track.noteCount > 0)
      .map((track) => track.index)
    const firstNote = getFirstMonophonicNote(parsedMidi, nextSelectedTracks)

    resetPlaybackForSourceChange()
    setSelectedTracks(nextSelectedTracks)
    setTranspositionSemitones(0)
    setImportedTabDocument(undefined)
    setActiveMidiNote(firstNote?.midiNote ?? initialMidiNote)
  }

  function handleClearTracks() {
    resetPlaybackForSourceChange()
    setSelectedTracks([])
    setTranspositionSemitones(0)
    setImportedTabDocument(undefined)
  }

  function handleTranspose(semitones: number) {
    const nextSemitones = clampSemitones(
      activeTabDocument.transpositionSemitones + semitones,
    )

    resetPlaybackForSourceChange()
    if (importedTabDocument) {
      const nextDocument = transposeTabDocument(
        profile,
        importedTabDocument,
        nextSemitones,
      )

      setImportedTabDocument(nextDocument)
      setActiveMidiNote(nextDocument.steps[0]?.midiNote ?? initialMidiNote)
      return
    }

    const firstNote = monophonicLine.notes[0]

    setTranspositionSemitones(nextSemitones)

    if (firstNote) {
      setActiveMidiNote(firstNote.midiNote + nextSemitones)
    }
  }

  function handleTranspositionInputChange(event: ChangeEvent<HTMLInputElement>) {
    const nextSemitones = clampSemitones(Number(event.target.value))

    resetPlaybackForSourceChange()
    if (importedTabDocument) {
      const nextDocument = transposeTabDocument(
        profile,
        importedTabDocument,
        nextSemitones,
      )

      setImportedTabDocument(nextDocument)
      setActiveMidiNote(nextDocument.steps[0]?.midiNote ?? initialMidiNote)
      return
    }

    const firstNote = monophonicLine.notes[0]

    setTranspositionSemitones(nextSemitones)

    if (firstNote) {
      setActiveMidiNote(firstNote.midiNote + nextSemitones)
    }
  }

  function handleUseSuggestedTransposition() {
    if (suggestedTransposition === undefined) {
      return
    }

    const firstNote = monophonicLine.notes[0]

    resetPlaybackForSourceChange()
    setTranspositionSemitones(suggestedTransposition)

    if (firstNote) {
      setActiveMidiNote(firstNote.midiNote + suggestedTransposition)
    }
  }

  function handleUseSuggestedTrack() {
    if (suggestedTracks.length === 0) {
      return
    }

    const firstNote = getFirstMonophonicNote(parsedMidi, suggestedTracks)

    resetPlaybackForSourceChange()
    setSelectedTracks(suggestedTracks)
    setTranspositionSemitones(0)
    setImportedTabDocument(undefined)
    setActiveMidiNote(firstNote?.midiNote ?? initialMidiNote)
  }

  function handleStepSelect(step: TabStep) {
    setActiveMidiNote(step.midiNote)
    setActiveStepId(step.id)
  }

  function handleKeyboardNoteSelect(midiNote: number) {
    setActiveMidiNote(midiNote)
    setActiveStepId(undefined)
  }

  function handleKeyboardPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    midiNote: number,
  ) {
    if (event.button !== 0) {
      return
    }

    handleKeyboardNoteSelect(midiNote)

    if (auditionNotes) {
      event.currentTarget.setPointerCapture(event.pointerId)
      startKeyboardNote(midiNote)
    }
  }

  function handleKeyboardKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    midiNote: number,
  ) {
    if (!auditionNotes || event.repeat || !isPlayableKeyPress(event.key)) {
      return
    }

    event.preventDefault()
    handleKeyboardNoteSelect(midiNote)
    startKeyboardNote(midiNote)
  }

  function handleKeyboardKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (!auditionNotes || !isPlayableKeyPress(event.key)) {
      return
    }

    event.preventDefault()
    stopKeyboardNote()
  }

  function handleAuditionToggle() {
    setAuditionNotes((isEnabled) => {
      if (isEnabled) {
        stopKeyboardNote()
      }

      return !isEnabled
    })
  }

  function isPlayableKeyPress(key: string) {
    return key === 'Enter' || key === ' '
  }

  function startKeyboardNote(midiNote: number) {
    const audioContext = getKeyboardAudioContext()

    if (!audioContext) {
      return
    }

    stopKeyboardNote({ immediate: true })

    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const startTime = audioContext.currentTime

    oscillator.type = 'sine'
    oscillator.frequency.value = midiNoteToFrequency(midiNote)
    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(0.16, startTime + 0.025)
    oscillator.connect(gain).connect(audioContext.destination)
    oscillator.start(startTime)
    oscillator.onended = () => {
      if (keyboardOscillatorRef.current === oscillator) {
        keyboardOscillatorRef.current = undefined
        keyboardGainRef.current = undefined
      }
    }

    keyboardOscillatorRef.current = oscillator
    keyboardGainRef.current = gain
  }

  function getKeyboardAudioContext() {
    if (keyboardAudioContextRef.current) {
      void keyboardAudioContextRef.current.resume()
      return keyboardAudioContextRef.current
    }

    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext

    if (!AudioContextConstructor) {
      return undefined
    }

    const audioContext = new AudioContextConstructor()

    keyboardAudioContextRef.current = audioContext
    void audioContext.resume()

    return audioContext
  }

  function stopKeyboardNote(options: { immediate?: boolean } = {}) {
    const oscillator = keyboardOscillatorRef.current
    const gain = keyboardGainRef.current

    if (!oscillator) {
      return
    }

    try {
      if (options.immediate || !gain || !keyboardAudioContextRef.current) {
        oscillator.stop()
      } else {
        const audioContext = keyboardAudioContextRef.current
        const stopTime = audioContext.currentTime + 0.06

        gain.gain.cancelScheduledValues(audioContext.currentTime)
        gain.gain.setValueAtTime(
          Math.max(gain.gain.value, 0.0001),
          audioContext.currentTime,
        )
        gain.gain.exponentialRampToValueAtTime(0.0001, stopTime)
        oscillator.stop(stopTime + 0.02)
      }
    } catch {
      // The oscillator may have already ended between rapid key presses.
    }

    keyboardOscillatorRef.current = undefined
    keyboardGainRef.current = undefined
  }

  useEffect(() => {
    return () => {
      stopKeyboardNote()
      void keyboardAudioContextRef.current?.close()
      keyboardAudioContextRef.current = undefined
    }
  }, [])

  function handleExportTab() {
    const fileName = `${activeTabDocument.title || 'ocarina-tab'}.ocarina-tab.json`
    const blob = new Blob([serializeTabDocument(activeTabDocument)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)

    if (exportLinkRef.current) {
      exportLinkRef.current.href = url
      exportLinkRef.current.download = fileName
      exportLinkRef.current.click()
    }

    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setTabFileMessage(`Exported ${fileName}`)
  }

  function resetPlaybackForSourceChange() {
    playback.stopPlayback()
    playback.updatePlaybackPosition(0)
    setActiveStepId(undefined)
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
                    : `Unsupported MIDI ${activeMidiNote}`
                }
              />
            </div>

            <div className="preview-actions">
              <button
                className="action-button action-button--primary"
                onClick={() =>
                  playback.toggle(activeTabDocument.steps, playableDurationMs)
                }
                type="button"
              >
                {playback.isPlaying ? 'Pause tab' : 'Play tab'}
              </button>
              <button className="action-button" onClick={handlePreviewSample} type="button">
                Preview sample
              </button>
            </div>

            <div className="playback-controls" aria-label="Playback controls">
              <label className="playback-slider">
                <span>Position</span>
                <input
                  aria-label="Playback position"
                  max={Math.max(playableDurationMs, 0)}
                  min={0}
                  onChange={(event) =>
                    playback.seek(
                      activeTabDocument.steps,
                      Number(event.target.value),
                      playableDurationMs,
                    )
                  }
                  step={50}
                  type="range"
                  value={Math.min(playback.playbackPositionMs, playableDurationMs)}
                />
                <strong>
                  {formatPlaybackTime(playback.playbackPositionMs)} /{' '}
                  {formatPlaybackTime(playableDurationMs)}
                </strong>
              </label>

              <label className="playback-slider playback-slider--speed">
                <span>Speed</span>
                <input
                  aria-label="Playback speed"
                  max={1.5}
                  min={0.5}
                  onChange={(event) =>
                    playback.setPlaybackSpeed(
                      activeTabDocument.steps,
                      Number(event.target.value),
                      playableDurationMs,
                    )
                  }
                  step={0.05}
                  type="range"
                  value={playback.playbackSpeed}
                />
                <strong>{formatPlaybackSpeed(playback.playbackSpeed)}</strong>
              </label>
            </div>

            <section className="profile-strip" aria-label="Ocarina profile">
              <div className="note-lab__range">
                <span>{profile.name}</span>
                <strong>
                  {playableRange.lowest.noteName} to {playableRange.highest.noteName}
                </strong>
                <button
                  aria-pressed={auditionNotes}
                  className="note-keyboard-toggle"
                  onClick={handleAuditionToggle}
                  type="button"
                >
                  Audition
                </button>
              </div>

              <div
                className="note-grid"
                aria-label="Playable notes"
                style={cssVariables({ '--white-key-count': playableWhiteKeyCount })}
              >
                {profile.fingerings.map((fingering) => {
                  const isAccidental = isAccidentalNote(fingering.noteName)
                  const whiteKeyOffset =
                    getWhiteKeyIndex(fingering.midiNote) - lowestWhiteKeyIndex
                  const keyStart = isAccidental
                    ? whiteKeyOffset + 1 - accidentalWidthInWhiteKeys / 2
                    : whiteKeyOffset

                  return (
                    <button
                      aria-pressed={fingering.midiNote === activeMidiNote}
                      className="note-button"
                      data-accidental={isAccidental}
                      data-testid={`note-button-${fingering.noteName}`}
                      key={fingering.midiNote}
                      onClick={() => handleKeyboardNoteSelect(fingering.midiNote)}
                      onKeyDown={(event) =>
                        handleKeyboardKeyDown(event, fingering.midiNote)
                      }
                      onKeyUp={handleKeyboardKeyUp}
                      onPointerCancel={() => stopKeyboardNote()}
                      onPointerDown={(event) =>
                        handleKeyboardPointerDown(event, fingering.midiNote)
                      }
                      onPointerLeave={() => stopKeyboardNote()}
                      onPointerUp={() => stopKeyboardNote()}
                      style={cssVariables({
                        '--key-start': keyStart,
                        '--key-width': isAccidental ? accidentalWidthInWhiteKeys : 1,
                      })}
                      title={
                        fingering.aliases.length > 0
                          ? `${fingering.noteName} / ${fingering.aliases.join(', ')}`
                          : fingering.noteName
                      }
                      type="button"
                    >
                      <span>{fingering.noteName}</span>
                      <small>MIDI {fingering.midiNote}</small>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>

          <div className="midi-page__side">
            <section className="midi-card" aria-label="MIDI source">
              <div className="midi-card__header">
                <span>Source</span>
                <strong>
                  {importedTabDocument
                    ? importedTabDocument.title
                    : midiFileName}
                </strong>
              </div>

              <div className="midi-card__actions">
                <label className="upload-control">
                  Import MIDI
                  <input accept=".mid,.midi" onChange={handleMidiUpload} type="file" />
                </label>
                <button className="action-button" onClick={handleLoadSample} type="button">
                  Load sample
                </button>
                <button className="action-button" onClick={handleExportTab} type="button">
                  Export tab
                </button>
                <label className="upload-control">
                  Import tab
                  <input
                    accept=".json,.ocarina-tab.json,application/json"
                    onChange={handleTabImport}
                    type="file"
                  />
                </label>
                <a aria-hidden="true" className="export-link" ref={exportLinkRef}>
                  Export
                </a>
              </div>

              {midiError ? <p className="form-error">{midiError}</p> : null}
              {tabFileMessage ? <p className="form-error">{tabFileMessage}</p> : null}
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
                      disabled={isImportedTabActive}
                      onClick={handleSelectAllTracks}
                      type="button"
                    >
                      All
                    </button>
                    <button
                      className="action-button"
                      disabled={isImportedTabActive}
                      onClick={handleClearTracks}
                      type="button"
                    >
                      Clear
                    </button>
                  </div>

                  <div
                    className="difficulty-control"
                    aria-label="Suggested track difficulty"
                    role="group"
                  >
                    {(['easy', 'medium', 'hard'] as const).map((difficulty) => (
                      <button
                        aria-pressed={suggestionDifficulty === difficulty}
                        disabled={isImportedTabActive}
                        key={difficulty}
                        onClick={() => setSuggestionDifficulty(difficulty)}
                        type="button"
                      >
                        {difficulty}
                      </button>
                    ))}
                  </div>

                  <details className="track-list-panel">
                    <summary>Choose tracks</summary>
                    <div className="track-list" aria-label="Tracks">
                      {parsedMidi.tracks.map((track) => {
                        const isSelected = selectedTracks.includes(track.index)
                        const isDisabled = track.noteCount === 0

                        return (
                          <label
                            className="track-option"
                            data-disabled={
                              isDisabled || isImportedTabActive ? 'true' : 'false'
                            }
                            key={track.index}
                          >
                            <input
                              checked={isSelected}
                              disabled={isDisabled || isImportedTabActive}
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
                        )
                      })}
                    </div>
                  </details>
                </div>
              </div>

              <div className="midi-card__suggestion">
                <button
                  className="action-button"
                  disabled={
                    isImportedTabActive ||
                    areTrackSelectionsEqual(selectedTracks, suggestedTracks)
                  }
                  onClick={handleUseSuggestedTrack}
                  type="button"
                >
                  Use suggested
                </button>
              </div>
            </section>

            <section className="midi-card" aria-label="Transposition controls">
              <div className="transpose-control">
                <div className="transpose-control__header">
                  <span>Transposition</span>
                  <strong data-testid="transpose-value">
                    {formatSemitoneShift(activeTabDocument.transpositionSemitones)}
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
                      value={activeTabDocument.transpositionSemitones}
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

                  <div className="midi-card__suggestion">
                    <button
                      className="action-button"
                      disabled={
                        suggestedTransposition === undefined ||
                        isImportedTabActive ||
                        suggestedTransposition === transpositionSemitones
                      }
                      onClick={handleUseSuggestedTransposition}
                      type="button"
                    >
                      Use suggested
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <GeneratedTabPanel
            activeStep={activeTabStep}
            displayMode={tabDisplayMode}
            hideUnsupportedNotes={hideUnsupportedNotes}
            midiRangeFit={midiRangeFit}
            monophonicLine={monophonicLine}
            onDisplayModeChange={setTabDisplayMode}
            onHideUnsupportedNotesChange={setHideUnsupportedNotes}
            onStepSelect={handleStepSelect}
            tabDocument={activeTabDocument}
            tabLines={tabLines}
            tabSections={tabSections}
          />
        </section>
      </section>
    </main>
  )
}

export default App
