import { useMemo, useState } from 'react'
import { OcarinaDiagram } from './components/OcarinaDiagram/OcarinaDiagram'
import {
  analyzeMidiRangeFit,
  getFingeringForMidiNote,
  getPlayableRange,
  standard12HoleCOcarinaProfile,
} from './ocarina/ocarinaProfile'
import './App.css'

const profile = standard12HoleCOcarinaProfile
const initialMidiNote = 72
const incomingMidiPreviewNotes = [67, 69, 72] as const

function App() {
  const [activeMidiNote, setActiveMidiNote] = useState(initialMidiNote)
  const activeFingering = getFingeringForMidiNote(profile, activeMidiNote)
  const playableRange = getPlayableRange(profile)
  const midiRangeFit = useMemo(
    () => analyzeMidiRangeFit(profile, incomingMidiPreviewNotes),
    [],
  )

  return (
    <main className="app-shell">
      <section className="app-workspace" aria-labelledby="page-title">
        <header className="app-header">
          <p className="app-eyebrow">Ocarina tab generator</p>
          <h1 id="page-title">Note-to-fingering map</h1>
          <p>
            This profile maps absolute MIDI notes to the physical holes used by
            the 12-hole C ocarina diagram.
          </p>
        </header>

        <section className="note-lab" aria-label="Ocarina fingering selector">
          <div className="note-lab__diagram-panel">
            <div className="note-lab__selected">
              <span>Selected note</span>
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
          </div>

          <div className="note-lab__controls">
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

export default App
