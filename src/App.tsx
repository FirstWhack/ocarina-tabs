import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { OcarinaDiagram } from './components/OcarinaDiagram/OcarinaDiagram'
import {
  analyzeMidiRangeFit,
  getFingeringForMidiNote,
  getPlayableRange,
  standard12HoleCOcarinaProfile,
} from './ocarina/ocarinaProfile'
import {
  createMonophonicMidiLine,
  simplifyMonophonicMidiLine,
} from './ocarina/ocarinaTab'
import type { MidiSimplificationLevel } from './ocarina/ocarinaTab'
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
import { GeneratedTabPanel } from './features/tabViewer/GeneratedTabPanel'
import type { TabDisplayMode } from './features/tabViewer/GeneratedTabPanel'
import {
  formatPlaybackSpeed,
  formatPlaybackTime,
  formatSemitoneShift,
  formatSimplificationLevel,
} from './tabs/tabFormatters'
import {
  clampSemitones,
  clampSimplificationLevel,
  maximumSimplificationLevel,
  minimumSimplificationLevel,
} from './tabs/tabLimits'
import {
  createTabLines,
  createTabSections,
  getPlayableTabSteps,
  getTabDurationMs,
  getVisibleTabSteps,
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

function App() {
  const exportLinkRef = useRef<HTMLAnchorElement>(null)
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
  const [simplificationLevel, setSimplificationLevel] =
    useState<MidiSimplificationLevel>(0)
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
  const simplifiedLine = useMemo(
    () =>
      simplifyMonophonicMidiLine(
        monophonicLine,
        parsedMidi.ticksPerQuarter,
        simplificationLevel,
      ),
    [monophonicLine, parsedMidi.ticksPerQuarter, simplificationLevel],
  )
  const midiNotes = useMemo(
    () => simplifiedLine.notes.map((note) => note.midiNote),
    [simplifiedLine],
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
        simplifiedLine,
        simplificationLevel,
        transpositionSemitones,
      }),
    [
      parsedMidi,
      midiFileName,
      selectedTracks,
      monophonicLine,
      simplifiedLine,
      simplificationLevel,
      transpositionSemitones,
    ],
  )
  const activeTabDocument = importedTabDocument ?? midiTabDocument
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
    const nextSimplifiedLine = simplifyMonophonicMidiLine(
      trimMonophonicLineStart(nextLine),
      nextParsedMidi.ticksPerQuarter,
      simplificationLevel,
    )
    const nextDocument = createTabDocumentFromMidi({
      parsedMidi: nextParsedMidi,
      profile,
      fileName: sampleMidiName,
      selectedTracks: nextSelectedTracks,
      monophonicLine: trimMonophonicLineStart(nextLine),
      simplifiedLine: nextSimplifiedLine,
      simplificationLevel,
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
    const nextSemitones = clampSemitones(transpositionSemitones + semitones)
    const firstNote = simplifiedLine.notes[0]

    resetPlaybackForSourceChange()
    setTranspositionSemitones(nextSemitones)
    setImportedTabDocument(undefined)

    if (firstNote) {
      setActiveMidiNote(firstNote.midiNote + nextSemitones)
    }
  }

  function handleTranspositionInputChange(event: ChangeEvent<HTMLInputElement>) {
    const nextSemitones = clampSemitones(Number(event.target.value))
    const firstNote = simplifiedLine.notes[0]

    resetPlaybackForSourceChange()
    setTranspositionSemitones(nextSemitones)
    setImportedTabDocument(undefined)

    if (firstNote) {
      setActiveMidiNote(firstNote.midiNote + nextSemitones)
    }
  }

  function handleUseSuggestedTransposition() {
    if (suggestedTransposition === undefined) {
      return
    }

    const firstNote = simplifiedLine.notes[0]

    resetPlaybackForSourceChange()
    setTranspositionSemitones(suggestedTransposition)
    setImportedTabDocument(undefined)

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

  function handleSimplificationChange(event: ChangeEvent<HTMLInputElement>) {
    const nextLevel = clampSimplificationLevel(Number(event.target.value))
    const firstNote = simplifyMonophonicMidiLine(
      monophonicLine,
      parsedMidi.ticksPerQuarter,
      nextLevel,
    ).notes[0]

    resetPlaybackForSourceChange()
    setSimplificationLevel(nextLevel)
    setImportedTabDocument(undefined)

    if (firstNote) {
      setActiveMidiNote(firstNote.midiNote + transpositionSemitones)
    }
  }

  function handleStepSelect(step: TabStep) {
    setActiveMidiNote(step.midiNote)
    setActiveStepId(step.id)
  }

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
              </div>

              <div className="note-grid" aria-label="Playable notes">
                {profile.fingerings.map((fingering) => (
                  <button
                    aria-pressed={fingering.midiNote === activeMidiNote}
                    className="note-button"
                    data-testid={`note-button-${fingering.noteName}`}
                    key={fingering.midiNote}
                    onClick={() => {
                      setActiveMidiNote(fingering.midiNote)
                      setActiveStepId(undefined)
                    }}
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
                      onClick={handleSelectAllTracks}
                      type="button"
                    >
                      All
                    </button>
                    <button
                      className="action-button"
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
                            data-disabled={isDisabled ? 'true' : 'false'}
                            key={track.index}
                          >
                            <input
                              checked={isSelected}
                              disabled={isDisabled}
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
                  disabled={areTrackSelectionsEqual(selectedTracks, suggestedTracks)}
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
                    {formatSemitoneShift(transpositionSemitones)}
                  </strong>
                </div>

                <div className="transpose-control__actions">
                  <div className="transpose-control__buttons">
                    <button
                      className="action-button"
                      onClick={() => handleTranspose(-1)}
                      type="button"
                    >
                      -1
                    </button>
                    <button
                      className="action-button"
                      onClick={() => handleTranspose(1)}
                      type="button"
                    >
                      +1
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
                      onClick={() => handleTranspose(-12)}
                      type="button"
                    >
                      -12
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
                        suggestedTransposition === transpositionSemitones
                      }
                      onClick={handleUseSuggestedTransposition}
                      type="button"
                    >
                      Use suggested
                    </button>
                  </div>

                  <label className="simplifier-control">
                    <span>Simplifier</span>
                    <input
                      aria-label="Simplifier level"
                      max={maximumSimplificationLevel}
                      min={minimumSimplificationLevel}
                      onChange={handleSimplificationChange}
                      step={1}
                      type="range"
                      value={simplificationLevel}
                    />
                    <strong>{formatSimplificationLevel(simplificationLevel)}</strong>
                  </label>
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
            simplifiedLine={simplifiedLine}
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
