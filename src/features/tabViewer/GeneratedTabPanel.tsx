import type { CSSProperties } from 'react'
import { OcarinaDiagram } from '../../components/OcarinaDiagram/OcarinaDiagram'
import {
  formatBeat,
  formatContinuousTabStepLabel,
  formatMidiRangeFit,
  formatMonophonicLine,
  formatStepCount,
  formatTabGenerationPath,
  formatTransposition,
} from '../../tabs/tabFormatters'
import { getTabSheetSeparatorMetrics } from '../../tabs/tabTransforms'
import type { TabDocument, TabLine, TabSection, TabStep } from '../../tabs/tabTypes'
import type { MidiRangeFitAnalysis } from '../../ocarina/ocarinaProfile'
import type { MonophonicMidiLine } from '../../ocarina/ocarinaTab'

export type TabDisplayMode = 'cards' | 'sheet'

type GeneratedTabPanelProps = {
  tabDocument: TabDocument
  tabLines: readonly TabLine[]
  tabSections: readonly TabSection[]
  activeStep: TabStep | undefined
  displayMode: TabDisplayMode
  hideUnsupportedNotes: boolean
  midiRangeFit: MidiRangeFitAnalysis
  monophonicLine: MonophonicMidiLine
  onDisplayModeChange: (displayMode: TabDisplayMode) => void
  onHideUnsupportedNotesChange: (hideUnsupportedNotes: boolean) => void
  onStepSelect: (step: TabStep) => void
}

export function GeneratedTabPanel({
  tabDocument,
  tabLines,
  tabSections,
  activeStep,
  displayMode,
  hideUnsupportedNotes,
  midiRangeFit,
  monophonicLine,
  onDisplayModeChange,
  onHideUnsupportedNotesChange,
  onStepSelect,
}: GeneratedTabPanelProps) {
  return (
    <section className="tab-sequence" aria-label="Generated tab sequence">
      <div className="tab-sequence__header">
        <div>
          <h2>Generated tab</h2>
          <span>{formatTransposition(tabDocument.transpositionSemitones)}</span>
        </div>

        <div className="tab-view-toggle" role="group" aria-label="Tab display mode">
          <button
            aria-pressed={displayMode === 'cards'}
            onClick={() => onDisplayModeChange('cards')}
            type="button"
          >
            Cards
          </button>
          <button
            aria-pressed={displayMode === 'sheet'}
            onClick={() => onDisplayModeChange('sheet')}
            type="button"
          >
            Sheet
          </button>
        </div>

        <label className="tab-filter-toggle">
          <input
            checked={hideUnsupportedNotes}
            onChange={(event) => onHideUnsupportedNotesChange(event.target.checked)}
            type="checkbox"
          />
          <span>Hide unsupported</span>
        </label>
      </div>

      <DiagnosticsPanel
        midiRangeFit={midiRangeFit}
        monophonicLine={monophonicLine}
        tabDocument={tabDocument}
      />

      {displayMode === 'sheet' ? (
        <TabSheetView
          activeStep={activeStep}
          onStepSelect={onStepSelect}
          tabDocument={tabDocument}
          tabSections={tabSections}
        />
      ) : (
        <TabCardsView
          activeStep={activeStep}
          onStepSelect={onStepSelect}
          tabDocument={tabDocument}
          tabLines={tabLines}
        />
      )}
    </section>
  )
}

function DiagnosticsPanel({
  tabDocument,
  midiRangeFit,
  monophonicLine,
}: {
  tabDocument: TabDocument
  midiRangeFit: MidiRangeFitAnalysis
  monophonicLine: MonophonicMidiLine
}) {
  const isImported = tabDocument.source.type === 'imported'

  return (
    <details className="diagnostics-panel">
      <summary>
        <span>Info</span>
        <strong>{formatStepCount(tabDocument.steps)}</strong>
      </summary>

      <div className="midi-readiness" aria-label="MIDI readiness preview">
        {isImported ? (
          <div className="status-panel">
            <span>Imported profile</span>
            <strong>{tabDocument.profileName}</strong>
          </div>
        ) : (
          <div className="status-panel">
            <span>Incoming MIDI range</span>
            <strong>{formatMidiRangeFit(midiRangeFit)}</strong>
          </div>
        )}

        <div className="status-panel">
          <span>Tab generation path</span>
          <strong>
            {formatTabGenerationPath(
              tabDocument.steps,
              tabDocument.transpositionSemitones,
            )}
          </strong>
        </div>

        <div className="status-panel">
          <span>Tab steps</span>
          <strong>{formatStepCount(tabDocument.steps)}</strong>
        </div>

        {isImported ? (
          <div className="status-panel">
            <span>Timing</span>
            <strong>{tabDocument.ticksPerQuarter} ticks per beat</strong>
          </div>
        ) : (
          <div className="status-panel">
            <span>Monophonic cleanup</span>
            <strong>{formatMonophonicLine(monophonicLine)}</strong>
          </div>
        )}
      </div>
    </details>
  )
}

function TabSheetView({
  tabDocument,
  tabSections,
  activeStep,
  onStepSelect,
}: {
  tabDocument: TabDocument
  tabSections: readonly TabSection[]
  activeStep: TabStep | undefined
  onStepSelect: (step: TabStep) => void
}) {
  return (
    <div className="tab-sheet-page" data-testid="generated-tab">
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
                  key={`${step.id}-${step.startMs}-${step.midiNote}`}
                >
                  <button
                    aria-label={formatContinuousTabStepLabel(
                      step,
                      tabDocument.ticksPerQuarter,
                    )}
                    className="tab-sheet-note"
                    data-active={step.id === activeStep?.id}
                    data-supported={step.fingering ? 'true' : 'false'}
                    data-testid={`tab-step-${step.index}`}
                    onClick={() => onStepSelect(step)}
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
                      tabDocument.ticksPerQuarter,
                    )}
                  />
                </span>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function TabCardsView({
  tabDocument,
  tabLines,
  activeStep,
  onStepSelect,
}: {
  tabDocument: TabDocument
  tabLines: readonly TabLine[]
  activeStep: TabStep | undefined
  onStepSelect: (step: TabStep) => void
}) {
  return (
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
                data-active={step.id === activeStep?.id}
                data-supported={step.fingering ? 'true' : 'false'}
                data-testid={`tab-step-${step.index}`}
                key={`${step.id}-${step.startMs}-${step.midiNote}`}
                onClick={() => onStepSelect(step)}
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
                  {formatBeat(step.startTick, tabDocument.ticksPerQuarter)} /{' '}
                  {formatBeat(step.durationTicks, tabDocument.ticksPerQuarter)}
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
  )
}

function getTabSheetSeparatorStyle(
  step: TabStep,
  nextStep: TabStep | undefined,
  ticksPerQuarter: number,
): CSSProperties {
  const metrics = getTabSheetSeparatorMetrics(step, nextStep, ticksPerQuarter)

  return {
    width: `${metrics.widthPx}px`,
    marginRight: `${metrics.marginRightPx}px`,
    opacity: metrics.opacity,
  }
}
