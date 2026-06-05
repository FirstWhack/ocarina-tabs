import { useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { OcarinaDiagram } from '../../components/OcarinaDiagram/OcarinaDiagram'
import type {
  OcarinaFingering,
  OcarinaProfile,
  PlayableRange,
} from '../../ocarina/ocarinaProfile'
import type { TabDocument } from '../../tabs/tabTypes'
import {
  formatPlaybackSpeed,
  formatPlaybackTime,
} from '../../tabs/tabFormatters'
import type { UseTabPlaybackResult } from '../playback/useTabPlayback'
import {
  cssVariables,
  getKeyboardKeyStyle,
  getKeyboardLayoutMetrics,
  isAccidentalNote,
} from '../keyboard/noteKeyboardLayout'
import { getPhysicalKeyboardKeyLabel } from '../keyboard/physicalKeyboardMapping'

type NotePreviewPanelProps = {
  profile: OcarinaProfile
  activeMidiNote: number
  activeFingering: OcarinaFingering | undefined
  playableRange: PlayableRange
  activeTabDocument: TabDocument
  compactMode?: boolean
  defaultCollapsed?: boolean
  playableDurationMs: number
  playback: UseTabPlaybackResult
  auditionNotes: boolean
  onPreviewSample: () => void
  onAuditionToggle: () => void
  onKeyboardNoteSelect: (midiNote: number) => void
  onKeyboardPointerDown: (
    event: PointerEvent<HTMLButtonElement>,
    midiNote: number,
  ) => void
  onKeyboardKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    midiNote: number,
  ) => void
  onKeyboardKeyUp: (
    event: KeyboardEvent<HTMLButtonElement>,
    midiNote: number,
  ) => void
  onKeyboardPointerCancel: () => void
  onKeyboardPointerLeave: () => void
  onKeyboardPointerUp: (midiNote: number) => void
}

export function NotePreviewPanel({
  profile,
  activeMidiNote,
  activeFingering,
  playableRange,
  activeTabDocument,
  compactMode = false,
  defaultCollapsed = false,
  playableDurationMs,
  playback,
  auditionNotes,
  onPreviewSample,
  onAuditionToggle,
  onKeyboardNoteSelect,
  onKeyboardPointerDown,
  onKeyboardKeyDown,
  onKeyboardKeyUp,
  onKeyboardPointerCancel,
  onKeyboardPointerLeave,
  onKeyboardPointerUp,
}: NotePreviewPanelProps) {
  const keyboardLayout = getKeyboardLayoutMetrics(profile)
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(defaultCollapsed)

  return (
    <div
      className="note-lab__diagram-panel"
      data-compact={compactMode}
      data-collapsed={isPreviewCollapsed}
    >
      <div className="note-lab__selected">
        <span>Preview note</span>
        <strong data-testid="active-note">
          {activeFingering
            ? `${activeFingering.noteName} / MIDI ${activeFingering.midiNote}`
            : `MIDI ${activeMidiNote} unsupported`}
        </strong>
      </div>

      {isPreviewCollapsed ? null : (
        <div className="note-lab__diagram" data-testid="active-ocarina-diagram">
          <OcarinaDiagram
            filledHoles={activeFingering?.filledHoles ?? []}
            title={
              activeFingering
                ? `${activeFingering.noteName} fingering`
                : `Unsupported MIDI ${activeMidiNote}`
            }
          />
        </div>
      )}

      <div className="preview-actions">
        <button
          className="action-button"
          onClick={() => setIsPreviewCollapsed((isCollapsed) => !isCollapsed)}
          type="button"
        >
          {isPreviewCollapsed ? 'Show diagram' : 'Hide diagram'}
        </button>
        {compactMode && isPreviewCollapsed ? null : (
          <>
            <button
              className="action-button action-button--primary"
              onClick={() =>
                playback.toggle(activeTabDocument.steps, playableDurationMs)
              }
              type="button"
            >
              {playback.isPlaying ? 'Pause tab' : 'Play tab'}
            </button>
            <button
              className="action-button"
              onClick={onPreviewSample}
              type="button"
            >
              Preview sample
            </button>
          </>
        )}
      </div>

      {compactMode && isPreviewCollapsed ? null : (
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
      )}

      <section className="profile-strip" aria-label="Ocarina profile">
        <div className="note-lab__range">
          <span>{profile.name}</span>
          <strong>
            {playableRange.lowest.noteName} to {playableRange.highest.noteName}
          </strong>
          <button
            aria-pressed={auditionNotes}
            className="note-keyboard-toggle"
            onClick={onAuditionToggle}
            type="button"
          >
            Audition
          </button>
        </div>

        <div
          className="note-grid"
          aria-label="Playable notes"
          style={cssVariables({
            '--white-key-count': keyboardLayout.playableWhiteKeyCount,
          })}
        >
          {profile.fingerings.map((fingering) => {
            const isAccidental = isAccidentalNote(fingering.noteName)
            const physicalKeyLabel = getPhysicalKeyboardKeyLabel(
              fingering.midiNote,
            )

            return (
              <button
                aria-pressed={fingering.midiNote === activeMidiNote}
                className="note-button"
                data-accidental={isAccidental}
                data-testid={`note-button-${fingering.noteName}`}
                key={fingering.midiNote}
                onClick={() => onKeyboardNoteSelect(fingering.midiNote)}
                onKeyDown={(event) =>
                  onKeyboardKeyDown(event, fingering.midiNote)
                }
                onKeyUp={(event) => onKeyboardKeyUp(event, fingering.midiNote)}
                onPointerCancel={onKeyboardPointerCancel}
                onPointerDown={(event) =>
                  onKeyboardPointerDown(event, fingering.midiNote)
                }
                onPointerLeave={onKeyboardPointerLeave}
                onPointerUp={() => onKeyboardPointerUp(fingering.midiNote)}
                style={getKeyboardKeyStyle(
                  fingering.midiNote,
                  keyboardLayout.lowestWhiteKeyIndex,
                )}
                title={
                  fingering.aliases.length > 0
                    ? `${fingering.noteName} / ${fingering.aliases.join(', ')}${
                        physicalKeyLabel ? ` / Key ${physicalKeyLabel}` : ''
                      }`
                    : `${fingering.noteName}${
                        physicalKeyLabel ? ` / Key ${physicalKeyLabel}` : ''
                      }`
                }
                type="button"
              >
                <span>{fingering.noteName}</span>
                <small>
                  {physicalKeyLabel ? `${physicalKeyLabel} / ` : null}
                  MIDI {fingering.midiNote}
                </small>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
