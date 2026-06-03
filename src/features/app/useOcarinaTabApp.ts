import {
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import type {
  ChangeEvent,
  KeyboardEvent,
  PointerEvent,
} from 'react'
import {
  analyzeMidiRangeFit,
  getFingeringForMidiNote,
  getPlayableRange,
  standard12HoleCOcarinaProfile,
} from '../../ocarina/ocarinaProfile'
import { createMonophonicMidiLine } from '../../ocarina/ocarinaTab'
import { parseMidiFile } from '../../midi/midiParser'
import type { ParsedMidiFile } from '../../midi/midiParser'
import { createTwinkleOcarinaMidiFile } from '../../midi/sampleMidi'
import { createTabDocumentFromComposer } from '../composer/composerDocument'
import {
  composerReducer,
  createInitialComposerState,
  quantizeDurationTicks,
} from '../composer/composerReducer'
import {
  composerMillisecondsPerQuarter,
  composerTicksPerQuarter,
} from '../composer/composerTypes'
import { createTabDocumentFromMidi } from '../midiImport/midiToTabDocument'
import type {
  SuggestionDifficulty,
  TrackSelection,
} from '../midiImport/midiImportTypes'
import {
  getDefaultTrackSelection,
  getFirstMonophonicNote,
  getSelectedTrackNotes,
  getSuggestedTrackSelection,
  trimMonophonicLineStart,
} from '../midiImport/midiTrackSelection'
import { useKeyboardAudition } from '../keyboard/useKeyboardAudition'
import { useTabPlayback } from '../playback/useTabPlayback'
import type { TabDisplayMode } from '../tabViewer/GeneratedTabPanel'
import { clampSemitones } from '../../tabs/tabLimits'
import {
  createTabLines,
  createTabSections,
  getPlayableTabSteps,
  getTabDurationMs,
  getVisibleTabSteps,
  transposeTabDocument,
} from '../../tabs/tabTransforms'
import type { TabDocument, TabStep } from '../../tabs/tabTypes'
import {
  parseSerializedTabDocument,
  serializeTabDocument,
} from '../../tabs/tabSerialization'
import type { AppMode } from './appTypes'

const profile = standard12HoleCOcarinaProfile
const initialMidiNote = 72
const sampleMidiName = 'Twinkle C5 phrase.mid'

function getCurrentTimeMs() {
  return performance.now()
}

export function useOcarinaTabApp() {
  const exportLinkRef = useRef<HTMLAnchorElement>(null)
  const recordedKeyboardNoteRef = useRef<
    { midiNote: number; startMs: number } | undefined
  >(undefined)
  const keyboardAudition = useKeyboardAudition()
  const [appMode, setAppMode] = useState<AppMode>('import')
  const [activeMidiNote, setActiveMidiNote] = useState(initialMidiNote)
  const [activeStepId, setActiveStepId] = useState<string | undefined>()
  const [isComposerRecording, setIsComposerRecording] = useState(false)
  const [composerState, dispatchComposer] = useReducer(
    composerReducer,
    undefined,
    createInitialComposerState,
  )
  const [composerTextInput, setComposerTextInput] = useState('')
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
  const composerTabDocument = useMemo(
    () => createTabDocumentFromComposer(composerState, profile),
    [composerState],
  )
  const activeTabDocument =
    appMode === 'composer'
      ? composerTabDocument
      : importedTabDocument ?? midiTabDocument
  const isImportedTabActive =
    appMode === 'import' && importedTabDocument !== undefined
  const activeMidiRangeFit = useMemo(
    () =>
      appMode === 'composer'
        ? analyzeMidiRangeFit(
            profile,
            composerTabDocument.steps.map((step) => step.midiNote),
          )
        : midiRangeFit,
    [appMode, composerTabDocument, midiRangeFit],
  )
  const activeMonophonicLine = useMemo(
    () =>
      appMode === 'composer'
        ? {
            notes: [],
            sourceNoteCount: composerTabDocument.steps.length,
            droppedChordNotes: 0,
            clippedOverlapNotes: 0,
          }
        : monophonicLine,
    [appMode, composerTabDocument, monophonicLine],
  )
  const playableTabSteps = useMemo(
    () => getPlayableTabSteps(activeTabDocument.steps),
    [activeTabDocument],
  )
  const playableDurationMs = useMemo(
    () => getTabDurationMs(playableTabSteps),
    [playableTabSteps],
  )
  const selectedTabStepId =
    appMode === 'composer'
      ? activeStepId ?? composerState.selectedNoteId
      : activeStepId
  const activeTabStep = activeTabDocument.steps.find(
    (step) => step.id === selectedTabStepId,
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

  function handleModeChange(nextMode: AppMode) {
    if (nextMode === appMode) {
      return
    }

    resetPlaybackForSourceChange()
    setAppMode(nextMode)
    recordedKeyboardNoteRef.current = undefined
    setIsComposerRecording(false)

    const nextDocument =
      nextMode === 'composer'
        ? composerTabDocument
        : importedTabDocument ?? midiTabDocument
    const firstStep = nextDocument.steps[0]

    setActiveMidiNote(firstStep?.midiNote ?? initialMidiNote)
  }

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
      setAppMode('import')

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

    resetPlaybackForSourceChange()

    try {
      const nextDocument = parseSerializedTabDocument(await file.text(), profile)
      const firstStep = nextDocument.steps[0]

      setImportedTabDocument({
        ...nextDocument,
        source: { type: 'imported', fileName: file.name },
      })
      setTabFileMessage(`Imported ${file.name}`)
      setMidiError(undefined)
      setAppMode('import')
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
    setAppMode('import')
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
    setAppMode('import')
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

    applyTransposition(nextSemitones)
  }

  function handleTranspositionInputChange(event: ChangeEvent<HTMLInputElement>) {
    applyTransposition(clampSemitones(Number(event.target.value)))
  }

  function handleUseSuggestedTransposition() {
    if (suggestedTransposition === undefined) {
      return
    }

    applyTransposition(suggestedTransposition)
  }

  function applyTransposition(nextSemitones: number) {
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

    if (appMode === 'composer') {
      dispatchComposer({ type: 'select-note', noteId: step.id })
    }
  }

  function handleKeyboardNoteSelect(midiNote: number) {
    setActiveMidiNote(midiNote)
  }

  function handleComposerTextSubmit() {
    dispatchComposer({
      type: 'append-text-notes',
      input: composerTextInput,
      profile,
    })

    setComposerTextInput('')
    resetPlaybackForSourceChange()
  }

  function handleComposerInsert(position: 'before-selected' | 'after-selected') {
    dispatchComposer({
      type: 'insert-note',
      midiNote: activeMidiNote,
      position,
    })
    resetPlaybackForSourceChange()
  }

  function handleComposerDeleteSelected() {
    dispatchComposer({ type: 'delete-selected-note' })
    resetPlaybackForSourceChange()
  }

  function handleComposerChangeSelectedNote() {
    dispatchComposer({
      type: 'change-selected-note',
      midiNote: activeMidiNote,
    })
    resetPlaybackForSourceChange()
  }

  function handleComposerSelectedNoteChange(midiNote: number) {
    setActiveMidiNote(midiNote)
    dispatchComposer({
      type: 'change-selected-note',
      midiNote,
    })
    resetPlaybackForSourceChange()
  }

  function handleComposerChangeSelectedDuration(durationTicks: number) {
    dispatchComposer({
      type: 'change-selected-duration',
      durationTicks,
    })
    resetPlaybackForSourceChange()
  }

  function handleComposerClear() {
    dispatchComposer({ type: 'clear' })
    setComposerTextInput('')
    resetPlaybackForSourceChange()
    setActiveMidiNote(initialMidiNote)
  }

  function handleComposerRecordingToggle() {
    setIsComposerRecording((isRecording) => {
      if (isRecording) {
        recordedKeyboardNoteRef.current = undefined
      }

      return !isRecording
    })
  }

  function startComposerRecordedNote(midiNote: number) {
    if (!isComposerRecording) {
      return
    }

    recordedKeyboardNoteRef.current = {
      midiNote,
      startMs: getCurrentTimeMs(),
    }
  }

  function finishComposerRecordedNote(midiNote: number) {
    const recordedNote = recordedKeyboardNoteRef.current

    recordedKeyboardNoteRef.current = undefined

    if (!recordedNote || recordedNote.midiNote !== midiNote) {
      return
    }

    const durationTicks = quantizeDurationTicks(
      getCurrentTimeMs() - recordedNote.startMs,
      composerState.quantizeTicks,
      composerTicksPerQuarter,
      composerMillisecondsPerQuarter,
    )

    dispatchComposer({
      type: 'append-note',
      midiNote,
      durationTicks,
    })
    resetPlaybackForSourceChange()
  }

  function handleKeyboardPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    midiNote: number,
  ) {
    if (event.button !== 0) {
      return
    }

    handleKeyboardNoteSelect(midiNote)

    if (appMode === 'composer' && isComposerRecording) {
      startComposerRecordedNote(midiNote)
    }

    if (auditionNotes) {
      event.currentTarget.setPointerCapture(event.pointerId)
      keyboardAudition.startKeyboardNote(midiNote)
    }
  }

  function handleKeyboardKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    midiNote: number,
  ) {
    if (
      (!auditionNotes && appMode !== 'composer') ||
      event.repeat ||
      !isPlayableKeyPress(event.key)
    ) {
      return
    }

    event.preventDefault()
    handleKeyboardNoteSelect(midiNote)
    if (appMode === 'composer' && isComposerRecording) {
      startComposerRecordedNote(midiNote)
    }
    if (auditionNotes) {
      keyboardAudition.startKeyboardNote(midiNote)
    }
  }

  function handleKeyboardKeyUp(
    event: KeyboardEvent<HTMLButtonElement>,
    midiNote: number,
  ) {
    if (
      (!auditionNotes && appMode !== 'composer') ||
      !isPlayableKeyPress(event.key)
    ) {
      return
    }

    event.preventDefault()
    if (appMode === 'composer' && isComposerRecording) {
      finishComposerRecordedNote(midiNote)
    }
    if (auditionNotes) {
      keyboardAudition.stopKeyboardNote()
    }
  }

  function handleKeyboardPointerCancel() {
    recordedKeyboardNoteRef.current = undefined
    keyboardAudition.stopKeyboardNote()
  }

  function handleKeyboardPointerLeave() {
    keyboardAudition.stopKeyboardNote()
  }

  function handleKeyboardPointerUp(midiNote: number) {
    if (appMode === 'composer' && isComposerRecording) {
      finishComposerRecordedNote(midiNote)
    }
    keyboardAudition.stopKeyboardNote()
  }

  function handleAuditionToggle() {
    setAuditionNotes((isEnabled) => {
      if (isEnabled) {
        keyboardAudition.stopKeyboardNote()
      }

      return !isEnabled
    })
  }

  function isPlayableKeyPress(key: string) {
    return key === 'Enter' || key === ' '
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

  return {
    profile,
    appMode,
    activeMidiNote,
    activeFingering,
    playableRange,
    activeTabDocument,
    activeTabStep,
    activeMidiRangeFit,
    activeMonophonicLine,
    playableDurationMs,
    tabLines,
    tabSections,
    playback,
    importState: {
      parsedMidi,
      selectedTracks,
      transpositionSemitones,
      midiFileName,
      midiError,
      tabFileMessage,
      importedTabDocument,
      isImportedTabActive,
      suggestionDifficulty,
      suggestedTracks,
      suggestedTransposition,
    },
    composerState: {
      composerState,
      composerTextInput,
      composerTabDocument,
      isComposerRecording,
      activeMidiNote,
    },
    tabViewState: {
      tabDisplayMode,
      hideUnsupportedNotes,
    },
    refs: {
      exportLinkRef,
    },
    actions: {
      handleModeChange,
      handleMidiUpload,
      handleTabImport,
      handleLoadSample,
      handlePreviewSample,
      handleTrackSelectionChange,
      handleSelectAllTracks,
      handleClearTracks,
      handleTranspose,
      handleTranspositionInputChange,
      handleUseSuggestedTransposition,
      handleUseSuggestedTrack,
      handleStepSelect,
      handleKeyboardNoteSelect,
      handleKeyboardPointerDown,
      handleKeyboardKeyDown,
      handleKeyboardKeyUp,
      handleKeyboardPointerCancel,
      handleKeyboardPointerLeave,
      handleKeyboardPointerUp,
      handleAuditionToggle,
      handleComposerTextSubmit,
      handleComposerInsert,
      handleComposerDeleteSelected,
      handleComposerChangeSelectedNote,
      handleComposerSelectedNoteChange,
      handleComposerChangeSelectedDuration,
      handleComposerClear,
      handleComposerRecordingToggle,
      handleExportTab,
      setComposerTextInput,
      setSuggestionDifficulty,
      setTabDisplayMode,
      setHideUnsupportedNotes,
      dispatchComposer,
    },
    auditionNotes,
  }
}

export type OcarinaTabAppController = ReturnType<typeof useOcarinaTabApp>
