import type {
  ChangeEvent,
  Dispatch,
  RefObject,
  SetStateAction,
} from 'react'
import type {
  OcarinaProfile,
} from '../../ocarina/ocarinaProfile'
import type { TabDocument } from '../../tabs/tabTypes'
import {
  formatPlaybackTime,
  formatSemitoneShift,
} from '../../tabs/tabFormatters'
import type { UseTabPlaybackResult } from '../playback/useTabPlayback'
import {
  composerDurationOptions,
} from '../composer/composerTypes'
import type {
  ComposerAction,
  ComposerInsertPosition,
  ComposerState,
} from '../composer/composerTypes'

type ComposerControlsPanelProps = {
  profile: OcarinaProfile
  composerState: ComposerState
  composerTextInput: string
  composerTabDocument: TabDocument
  composerTranspositionSemitones: number
  suggestedComposerTransposition: number | undefined
  isComposerRecording: boolean
  activeMidiNote: number
  playableDurationMs: number
  playback: UseTabPlaybackResult
  exportLinkRef: RefObject<HTMLAnchorElement | null>
  dispatchComposer: Dispatch<ComposerAction>
  setComposerTextInput: Dispatch<SetStateAction<string>>
  onComposerTextSubmit: () => void
  onComposerInsert: (
    position: Exclude<ComposerInsertPosition, 'end'>,
  ) => void
  onComposerDeleteSelected: () => void
  onComposerChangeSelectedNote: () => void
  onComposerSelectedNoteChange: (midiNote: number) => void
  onComposerChangeSelectedDuration: (durationTicks: number) => void
  onComposerClear: () => void
  onComposerRecordingToggle: () => void
  onExportTab: () => void
  onTranspose: (semitones: number) => void
  onTranspositionInputChange: (event: ChangeEvent<HTMLInputElement>) => void
  onUseSuggestedTransposition: () => void
}

export function ComposerControlsPanel({
  profile,
  composerState,
  composerTextInput,
  composerTabDocument,
  composerTranspositionSemitones,
  suggestedComposerTransposition,
  isComposerRecording,
  activeMidiNote,
  playableDurationMs,
  playback,
  exportLinkRef,
  dispatchComposer,
  setComposerTextInput,
  onComposerTextSubmit,
  onComposerInsert,
  onComposerDeleteSelected,
  onComposerChangeSelectedNote,
  onComposerSelectedNoteChange,
  onComposerChangeSelectedDuration,
  onComposerClear,
  onComposerRecordingToggle,
  onExportTab,
  onTranspose,
  onTranspositionInputChange,
  onUseSuggestedTransposition,
}: ComposerControlsPanelProps) {
  const selectedNote = composerState.notes.find(
    (note) => note.id === composerState.selectedNoteId,
  )
  const selectedNoteHasProfileOption = profile.fingerings.some(
    (fingering) => fingering.midiNote === selectedNote?.midiNote,
  )

  return (
    <section className="midi-card composer-card" aria-label="Composer controls">
      <div className="composer-toolbar">
        <div className="midi-card__header">
          <span>Composer</span>
          <strong>{composerTabDocument.title}</strong>
        </div>

        <label className="composer-field composer-title-field">
          <span>Title</span>
          <input
            onChange={(event) =>
              dispatchComposer({
                type: 'set-title',
                title: event.target.value,
              })
            }
            type="text"
            value={composerState.title}
          />
        </label>

        <div className="composer-notes-entry">
          <label className="composer-field">
            <span>Text notes</span>
            <input
              aria-label="Composer notes"
              onChange={(event) => setComposerTextInput(event.target.value)}
              placeholder="C5 D5 E5"
              type="text"
              value={composerTextInput}
            />
          </label>
        </div>
        <button
          className="action-button action-button--primary composer-add-button"
          onClick={onComposerTextSubmit}
          type="button"
        >
          Add
        </button>

        <label className="composer-toggle">
          <input
            checked={isComposerRecording}
            onChange={(event) =>
              event.target.checked !== isComposerRecording
                ? onComposerRecordingToggle()
                : undefined
            }
            type="checkbox"
          />
          <span>Record</span>
        </label>

        <label className="composer-field composer-field--inline composer-selected-note-field">
          <span>Note</span>
          <select
            disabled={!composerState.selectedNoteId}
            onChange={(event) =>
              onComposerSelectedNoteChange(Number(event.target.value))
            }
            value={selectedNote?.midiNote ?? activeMidiNote}
          >
            {selectedNote && !selectedNoteHasProfileOption ? (
              <option value={selectedNote.midiNote}>
                MIDI {selectedNote.midiNote}
              </option>
            ) : null}
            {profile.fingerings.map((fingering) => (
              <option key={fingering.midiNote} value={fingering.midiNote}>
                {fingering.noteName}
              </option>
            ))}
          </select>
        </label>

        <label className="composer-field composer-field--inline composer-selected-duration-field">
          <span>Duration</span>
          <select
            disabled={!composerState.selectedNoteId}
            onChange={(event) =>
              onComposerChangeSelectedDuration(Number(event.target.value))
            }
            value={selectedNote?.durationTicks ?? composerState.defaultDurationTicks}
          >
            {composerDurationOptions.map((option) => (
              <option key={option.ticks} value={option.ticks}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="composer-field composer-default-length-field">
          <span>Length</span>
          <select
            onChange={(event) =>
              dispatchComposer({
                type: 'set-default-duration',
                durationTicks: Number(event.target.value),
              })
            }
            value={composerState.defaultDurationTicks}
          >
            {composerDurationOptions.map((option) => (
              <option key={option.ticks} value={option.ticks}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="composer-field composer-record-grid-field">
          <span>Grid</span>
          <select
            onChange={(event) =>
              dispatchComposer({
                type: 'set-quantize-grid',
                quantizeTicks: Number(event.target.value),
              })
            }
            value={composerState.quantizeTicks}
          >
            {composerDurationOptions.map((option) => (
              <option key={option.ticks} value={option.ticks}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div
          className="composer-transpose-panel"
          aria-label="Composer transposition controls"
        >
          <span data-testid="composer-transpose-value">
            {formatSemitoneShift(composerTabDocument.transpositionSemitones)}
          </span>
          <div className="composer-transpose-buttons">
            <button
              className="action-button"
              onClick={() => onTranspose(-12)}
              type="button"
            >
              -12
            </button>
            <button
              className="action-button"
              onClick={() => onTranspose(-1)}
              type="button"
            >
              -1
            </button>
            <input
              aria-label="Composer transpose semitones"
              max={24}
              min={-24}
              onChange={onTranspositionInputChange}
              type="number"
              value={composerTabDocument.transpositionSemitones}
            />
            <button
              className="action-button"
              onClick={() => onTranspose(1)}
              type="button"
            >
              +1
            </button>
            <button
              className="action-button"
              onClick={() => onTranspose(12)}
              type="button"
            >
              +12
            </button>
          </div>
          <button
            className="action-button"
            disabled={
              suggestedComposerTransposition === undefined ||
              suggestedComposerTransposition === composerTranspositionSemitones
            }
            onClick={onUseSuggestedTransposition}
            type="button"
          >
            Suggested
          </button>
        </div>

        <div className="composer-edit-actions" aria-label="Composer edit actions">
          <button
            className="action-button"
            disabled={!composerState.selectedNoteId}
            onClick={() => onComposerInsert('before-selected')}
            type="button"
          >
            Before
          </button>
          <button
            className="action-button"
            disabled={!composerState.selectedNoteId}
            onClick={() => onComposerInsert('after-selected')}
            type="button"
          >
            After
          </button>
          <button
            className="action-button"
            disabled={!composerState.selectedNoteId}
            onClick={onComposerChangeSelectedNote}
            type="button"
          >
            Preview
          </button>
          <button
            className="action-button"
            disabled={!composerState.selectedNoteId}
            onClick={onComposerDeleteSelected}
            type="button"
          >
            Delete
          </button>
          <button
            className="action-button"
            disabled={composerState.notes.length === 0}
            onClick={onComposerClear}
            type="button"
          >
            Clear
          </button>
          <button className="action-button" onClick={onExportTab} type="button">
            Export
          </button>
        </div>
      </div>

      {composerState.noteInputMessage ? (
        <p
          className={
            composerState.noteInputMessage.severity === 'warning'
              ? 'form-warning'
              : 'form-error'
          }
        >
          {composerState.noteInputMessage.text}
        </p>
      ) : null}

      <div className="composer-scan-bar" aria-label="Composer scan controls">
        <button
          className="action-button action-button--primary"
          onClick={() =>
            playback.toggle(composerTabDocument.steps, playableDurationMs)
          }
          type="button"
        >
          {playback.isPlaying ? 'Pause' : 'Play'}
        </button>

        <label className="composer-scan-slider">
          <span>Position</span>
          <input
            aria-label="Composer playback position"
            max={Math.max(playableDurationMs, 0)}
            min={0}
            onChange={(event) =>
              playback.seek(
                composerTabDocument.steps,
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
      </div>

      <a aria-hidden="true" className="export-link" ref={exportLinkRef}>
        Export
      </a>
    </section>
  )
}
