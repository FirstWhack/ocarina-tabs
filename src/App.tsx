import { useMemo, useState } from 'react'
import { OcarinaDiagram } from './components/OcarinaDiagram/OcarinaDiagram'
import {
  analyzeMidiNotes,
  findPlayableTranspositions,
  getFingeringForMidiNote,
  getPlayableRange,
  standard12HoleCOcarinaProfile,
} from './ocarina/ocarinaProfile'
import './App.css'

const profile = standard12HoleCOcarinaProfile
const initialMidiNote = 72
const unsupportedDemoMidiNotes = [67, 69, 72, 90] as const
const transpositionDemoMidiNotes = [67, 69, 72] as const

function App() {
  const [activeMidiNote, setActiveMidiNote] = useState(initialMidiNote)
  const activeFingering = getFingeringForMidiNote(profile, activeMidiNote)
  const playableRange = getPlayableRange(profile)
  const unsupportedDemo = useMemo(
    () => analyzeMidiNotes(profile, unsupportedDemoMidiNotes),
    [],
  )
  const transpositionSuggestions = useMemo(
    () => findPlayableTranspositions(profile, transpositionDemoMidiNotes),
    [],
  )
  const bestTransposition = transpositionSuggestions[0]

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
            <span>Unsupported note preview</span>
            <strong>
              {unsupportedDemo.unsupportedMidiNotes
                .map((midiNote) => `MIDI ${midiNote}`)
                .join(', ')}
            </strong>
          </div>

          <div className="status-panel">
            <span>First playable transposition</span>
            <strong>
              {bestTransposition
                ? formatSemitoneShift(bestTransposition.semitones)
                : 'No playable shift'}
            </strong>
          </div>
        </section>
      </section>
    </main>
  )
}

function formatSemitoneShift(semitones: number) {
  if (semitones === 0) {
    return '0 semitones'
  }

  return `${semitones > 0 ? '+' : ''}${semitones} semitones`
}

export default App
