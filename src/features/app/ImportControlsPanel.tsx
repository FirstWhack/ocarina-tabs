import type { ChangeEvent, RefObject } from 'react'
import type { ParsedMidiFile } from '../../midi/midiParser'
import type { TabDocument } from '../../tabs/tabTypes'
import { formatSemitoneShift } from '../../tabs/tabFormatters'
import type {
  SuggestionDifficulty,
  TrackSelection,
} from '../midiImport/midiImportTypes'
import {
  areTrackSelectionsEqual,
  formatTrackDetail,
  formatTrackName,
  formatTrackSelectionCount,
} from '../midiImport/midiTrackSelection'

type ImportControlsPanelProps = {
  activeTabDocument: TabDocument
  parsedMidi: ParsedMidiFile
  selectedTracks: TrackSelection
  transpositionSemitones: number
  midiFileName: string
  midiError: string | undefined
  tabFileMessage: string | undefined
  importedTabDocument: TabDocument | undefined
  isImportedTabActive: boolean
  suggestionDifficulty: SuggestionDifficulty
  suggestedTracks: TrackSelection
  suggestedTransposition: number | undefined
  exportLinkRef: RefObject<HTMLAnchorElement | null>
  onMidiUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onTabImport: (event: ChangeEvent<HTMLInputElement>) => void
  onLoadSample: () => void
  onExportTab: () => void
  onTrackSelectionChange: (trackIndex: number, isSelected: boolean) => void
  onSelectAllTracks: () => void
  onClearTracks: () => void
  onSuggestionDifficultyChange: (difficulty: SuggestionDifficulty) => void
  onUseSuggestedTrack: () => void
  onTranspose: (semitones: number) => void
  onTranspositionInputChange: (event: ChangeEvent<HTMLInputElement>) => void
  onUseSuggestedTransposition: () => void
}

export function ImportControlsPanel({
  activeTabDocument,
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
  exportLinkRef,
  onMidiUpload,
  onTabImport,
  onLoadSample,
  onExportTab,
  onTrackSelectionChange,
  onSelectAllTracks,
  onClearTracks,
  onSuggestionDifficultyChange,
  onUseSuggestedTrack,
  onTranspose,
  onTranspositionInputChange,
  onUseSuggestedTransposition,
}: ImportControlsPanelProps) {
  return (
    <>
      <section className="midi-card" aria-label="MIDI source">
        <div className="midi-card__header">
          <span>Source</span>
          <strong>
            {importedTabDocument ? importedTabDocument.title : midiFileName}
          </strong>
        </div>

        <div className="midi-card__actions">
          <label className="upload-control">
            Import MIDI
            <input accept=".mid,.midi" onChange={onMidiUpload} type="file" />
          </label>
          <button className="action-button" onClick={onLoadSample} type="button">
            Load sample
          </button>
          <button className="action-button" onClick={onExportTab} type="button">
            Export tab
          </button>
          <label className="upload-control">
            Import tab
            <input
              accept=".json,.ocarina-tab.json,application/json"
              onChange={onTabImport}
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
                onClick={onSelectAllTracks}
                type="button"
              >
                All
              </button>
              <button
                className="action-button"
                disabled={isImportedTabActive}
                onClick={onClearTracks}
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
                  onClick={() => onSuggestionDifficultyChange(difficulty)}
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
                          onTrackSelectionChange(
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
            onClick={onUseSuggestedTrack}
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
                aria-label="Transpose semitones"
                max={24}
                min={-24}
                onChange={onTranspositionInputChange}
                type="number"
                value={activeTabDocument.transpositionSemitones}
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

            <div className="midi-card__suggestion">
              <button
                className="action-button"
                disabled={
                  suggestedTransposition === undefined ||
                  isImportedTabActive ||
                  suggestedTransposition === transpositionSemitones
                }
                onClick={onUseSuggestedTransposition}
                type="button"
              >
                Use suggested
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
