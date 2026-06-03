import type { Dispatch, RefObject, SetStateAction } from 'react'
import type {
  OcarinaProfile,
} from '../../ocarina/ocarinaProfile'
import type { TabDocument } from '../../tabs/tabTypes'
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
  isComposerRecording: boolean
  activeMidiNote: number
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
}

export function ComposerControlsPanel({
  profile,
  composerState,
  composerTextInput,
  composerTabDocument,
  isComposerRecording,
  activeMidiNote,
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
}: ComposerControlsPanelProps) {
  const selectedNote = composerState.notes.find(
    (note) => note.id === composerState.selectedNoteId,
  )

  return (
    <section className="midi-card composer-card" aria-label="Composer controls">
      <div className="composer-card__header">
        <div className="midi-card__header">
          <span>Composer</span>
          <strong>{composerTabDocument.title}</strong>
        </div>

        <div className="composer-recording">
          <button
            aria-pressed={isComposerRecording}
            className="record-button"
            onClick={onComposerRecordingToggle}
            type="button"
          >
            {isComposerRecording ? 'Stop recording' : 'Record'}
          </button>
          <span>
            {isComposerRecording
              ? 'Piano input is recording'
              : 'Piano input is preview only'}
          </span>
        </div>
      </div>

      <div className="composer-card__body">
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

        <div className="composer-grid">
          <label className="composer-field">
            <span>Text notes</span>
            <textarea
              aria-label="Composer notes"
              onChange={(event) => setComposerTextInput(event.target.value)}
              placeholder="C5 D5 E5"
              rows={3}
              value={composerTextInput}
            />
          </label>
          <button
            className="action-button action-button--primary"
            onClick={onComposerTextSubmit}
            type="button"
          >
            Add notes
          </button>
          {composerState.parseError ? (
            <p className="form-error">{composerState.parseError}</p>
          ) : null}
        </div>

        <div className="composer-options">
          <label className="composer-field">
            <span>Note length</span>
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

          <label className="composer-field">
            <span>Record grid</span>
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
        </div>
      </div>

      <div className="composer-edit-bar">
        <label className="composer-field composer-field--inline">
          <span>Selected note</span>
          <select
            disabled={!composerState.selectedNoteId}
            onChange={(event) =>
              onComposerSelectedNoteChange(Number(event.target.value))
            }
            value={selectedNote?.midiNote ?? activeMidiNote}
          >
            {profile.fingerings.map((fingering) => (
              <option key={fingering.midiNote} value={fingering.midiNote}>
                {fingering.noteName}
              </option>
            ))}
          </select>
        </label>

        <label className="composer-field composer-field--inline">
          <span>Selected duration</span>
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

        <div className="composer-edit-actions" aria-label="Composer edit actions">
          <button
            className="action-button"
            disabled={!composerState.selectedNoteId}
            onClick={() => onComposerInsert('before-selected')}
            type="button"
          >
            Insert before
          </button>
          <button
            className="action-button"
            disabled={!composerState.selectedNoteId}
            onClick={() => onComposerInsert('after-selected')}
            type="button"
          >
            Insert after
          </button>
          <button
            className="action-button"
            disabled={!composerState.selectedNoteId}
            onClick={onComposerChangeSelectedNote}
            type="button"
          >
            Use preview note
          </button>
          <button
            className="action-button"
            disabled={!composerState.selectedNoteId}
            onClick={onComposerDeleteSelected}
            type="button"
          >
            Delete selected
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
            Export tab
          </button>
        </div>
      </div>

      <a aria-hidden="true" className="export-link" ref={exportLinkRef}>
        Export
      </a>
    </section>
  )
}
