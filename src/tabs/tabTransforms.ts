import type { TabLine, TabSection, TabStep } from './tabTypes'

export const beatsPerTabLine = 8

export function transposeTabSteps(
  tabSteps: readonly TabStep[],
  transpositionSemitones: number,
): readonly TabStep[] {
  return tabSteps.map((step) => ({
    ...step,
    midiNote: step.sourceMidiNote + transpositionSemitones,
  }))
}

export function trimTabStepsStart(tabSteps: readonly TabStep[]): readonly TabStep[] {
  const firstStep = tabSteps[0]

  if (!firstStep || (firstStep.startTick === 0 && firstStep.startMs === 0)) {
    return tabSteps
  }

  return tabSteps.map((step) => ({
    ...step,
    startTick: Math.max(0, step.startTick - firstStep.startTick),
    startMs: Math.max(0, step.startMs - firstStep.startMs),
  }))
}

export function getVisibleTabSteps(
  tabSteps: readonly TabStep[],
  hideUnsupportedNotes: boolean,
): readonly TabStep[] {
  return hideUnsupportedNotes
    ? trimTabStepsStart(tabSteps.filter((step) => step.fingering))
    : tabSteps
}

export function getPlayableTabSteps(tabSteps: readonly TabStep[]) {
  return tabSteps.filter((step) => step.fingering)
}

export function getTabDurationMs(tabSteps: readonly TabStep[]) {
  return tabSteps.reduce(
    (durationMs, step) =>
      Math.max(durationMs, step.startMs + Math.max(0, step.durationMs)),
    0,
  )
}

export function getActiveStepAtPosition(
  tabSteps: readonly TabStep[],
  positionMs: number,
) {
  return (
    tabSteps.find(
      (step) =>
        positionMs >= step.startMs && positionMs < step.startMs + step.durationMs,
    ) ??
    [...tabSteps].filter((step) => step.startMs <= positionMs).at(-1) ??
    tabSteps[0]
  )
}

export function createTabLines(
  tabSteps: readonly TabStep[],
  ticksPerQuarter: number,
): readonly TabLine[] {
  const ticksPerLine = ticksPerQuarter * beatsPerTabLine
  const linesByIndex = new Map<number, TabStep[]>()

  for (const step of tabSteps) {
    const lineIndex = Math.floor(step.startTick / ticksPerLine)
    const line = linesByIndex.get(lineIndex) ?? []
    line.push(step)
    linesByIndex.set(lineIndex, line)
  }

  return [...linesByIndex.entries()].map(([index, steps]) => ({
    index,
    startBeat: index * beatsPerTabLine,
    steps,
  }))
}

export function createTabSections(
  tabSteps: readonly TabStep[],
  ticksPerQuarter: number,
): readonly TabSection[] {
  const minimumBreakBeats = 2
  const fallbackSectionBeats = 32
  const sections: TabSection[] = []
  let currentSteps: TabStep[] = []
  let sectionStartTick = tabSteps[0]?.startTick ?? 0

  for (const step of tabSteps) {
    const previousStep = currentSteps.at(-1)

    if (previousStep) {
      const previousEndTick = previousStep.startTick + previousStep.durationTicks
      const restBeats = (step.startTick - previousEndTick) / ticksPerQuarter
      const sectionBeats = (step.startTick - sectionStartTick) / ticksPerQuarter
      const shouldBreak =
        restBeats >= minimumBreakBeats || sectionBeats >= fallbackSectionBeats

      if (shouldBreak) {
        sections.push({
          index: sections.length,
          startBeat: sectionStartTick / ticksPerQuarter,
          steps: currentSteps,
        })
        currentSteps = []
        sectionStartTick = step.startTick
      }
    }

    currentSteps.push(step)
  }

  if (currentSteps.length > 0) {
    sections.push({
      index: sections.length,
      startBeat: sectionStartTick / ticksPerQuarter,
      steps: currentSteps,
    })
  }

  return sections
}

export function getTabSheetSeparatorMetrics(
  step: TabStep,
  nextStep: TabStep | undefined,
  ticksPerQuarter: number,
) {
  const restTicks = Math.max(
    0,
    nextStep ? nextStep.startTick - (step.startTick + step.durationTicks) : 0,
  )
  const durationBeats = step.durationTicks / ticksPerQuarter
  const restBeats = restTicks / ticksPerQuarter

  return {
    widthPx: Math.min(76, Math.max(14, 10 + durationBeats * 22)),
    marginRightPx: 8 + Math.min(36, restBeats * 18),
    opacity: durationBeats >= 1 ? 1 : 0.62,
  }
}
