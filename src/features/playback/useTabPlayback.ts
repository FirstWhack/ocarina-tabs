import { useEffect, useRef, useState } from 'react'
import type { TabStep } from '../../tabs/tabTypes'
import { clampPlaybackPosition, clampPlaybackSpeed, defaultPlaybackSpeed, playbackProgressIntervalMs } from '../../tabs/tabLimits'
import { getActiveStepAtPosition, getPlayableTabSteps, getTabDurationMs } from '../../tabs/tabTransforms'
import { midiNoteToFrequency } from './playbackMath'

type UseTabPlaybackOptions = {
  onActiveStepChange: (step: TabStep | undefined) => void
}

export type UseTabPlaybackResult = ReturnType<typeof useTabPlayback>

export function useTabPlayback({ onActiveStepChange }: UseTabPlaybackOptions) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeedState] = useState(defaultPlaybackSpeed)
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0)
  const playbackTimeoutsRef = useRef<number[]>([])
  const playbackProgressIntervalRef = useRef<number | undefined>(undefined)
  const playbackPositionMsRef = useRef(0)
  const oscillatorsRef = useRef<OscillatorNode[]>([])
  const audioContextRef = useRef<AudioContext | undefined>(undefined)
  const isPlayingRef = useRef(false)
  const speedRef = useRef(defaultPlaybackSpeed)

  function updatePlaybackPosition(positionMs: number) {
    playbackPositionMsRef.current = positionMs
    setPlaybackPositionMs(positionMs)
  }

  function stopPlayback(options: { preserveActiveStep?: boolean } = {}) {
    clearScheduledPlayback()
    isPlayingRef.current = false
    setIsPlaying(false)

    if (!options.preserveActiveStep) {
      onActiveStepChange(undefined)
    }
  }

  function clearScheduledPlayback() {
    for (const timeoutId of playbackTimeoutsRef.current) {
      window.clearTimeout(timeoutId)
    }

    playbackTimeoutsRef.current = []

    if (playbackProgressIntervalRef.current !== undefined) {
      window.clearInterval(playbackProgressIntervalRef.current)
      playbackProgressIntervalRef.current = undefined
    }

    for (const oscillator of oscillatorsRef.current) {
      try {
        oscillator.stop()
      } catch {
        continue
      }
    }

    oscillatorsRef.current = []
    void audioContextRef.current?.close()
    audioContextRef.current = undefined
  }

  useEffect(() => {
    return () => {
      clearScheduledPlayback()
    }
  }, [])

  function play(
    tabSteps: readonly TabStep[],
    startPositionMs = 0,
    speed = speedRef.current,
  ) {
    const stepsWithFingerings = getPlayableTabSteps(tabSteps)
    const durationMs = getTabDurationMs(stepsWithFingerings)
    const previewStartMs = clampPlaybackPosition(startPositionMs, durationMs)
    const remainingSteps = stepsWithFingerings.filter(
      (step) => step.startMs + step.durationMs > previewStartMs,
    )

    if (remainingSteps.length === 0) {
      updatePlaybackPosition(durationMs)
      return
    }

    stopPlayback({ preserveActiveStep: true })
    isPlayingRef.current = true
    setIsPlaying(true)
    updatePlaybackPosition(previewStartMs)
    onActiveStepChange(getActiveStepAtPosition(stepsWithFingerings, previewStartMs))
    startPlaybackProgress(previewStartMs, durationMs, speed)

    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    const audioContext = AudioContextConstructor
      ? new AudioContextConstructor()
      : undefined

    if (audioContext) {
      audioContextRef.current = audioContext
      void audioContext.resume()
      scheduleAudioPreview(audioContext, remainingSteps, previewStartMs, speed)
    }

    for (const step of remainingSteps) {
      if (step.startMs < previewStartMs) {
        continue
      }

      const timeoutId = window.setTimeout(() => {
        onActiveStepChange(step)
      }, Math.max(0, (step.startMs - previewStartMs) / speed))
      playbackTimeoutsRef.current.push(timeoutId)
    }

    const finalTimeoutId = window.setTimeout(
      () => {
        updatePlaybackPosition(durationMs)
        stopPlayback({ preserveActiveStep: true })
      },
      Math.max(0, (durationMs - previewStartMs) / speed) + 120,
    )
    playbackTimeoutsRef.current.push(finalTimeoutId)
  }

  function toggle(tabSteps: readonly TabStep[], durationMs: number) {
    if (isPlayingRef.current) {
      const nextPosition = getCurrentPlaybackPositionMs(durationMs)

      stopPlayback({ preserveActiveStep: true })
      updatePlaybackPosition(nextPosition)
      onActiveStepChange(
        getActiveStepAtPosition(getPlayableTabSteps(tabSteps), nextPosition),
      )
      return
    }

    play(
      tabSteps,
      playbackPositionMsRef.current >= durationMs ? 0 : playbackPositionMsRef.current,
    )
  }

  function seek(tabSteps: readonly TabStep[], positionMs: number, durationMs: number) {
    const nextPosition = clampPlaybackPosition(positionMs, durationMs)
    const shouldResume = isPlayingRef.current

    stopPlayback({ preserveActiveStep: true })
    updatePlaybackPosition(nextPosition)
    onActiveStepChange(
      getActiveStepAtPosition(getPlayableTabSteps(tabSteps), nextPosition),
    )

    if (shouldResume) {
      play(tabSteps, nextPosition)
    }
  }

  function setPlaybackSpeed(tabSteps: readonly TabStep[], speed: number, durationMs: number) {
    const nextSpeed = clampPlaybackSpeed(speed)

    speedRef.current = nextSpeed
    setPlaybackSpeedState(nextSpeed)

    if (isPlayingRef.current) {
      const nextPosition = getCurrentPlaybackPositionMs(durationMs)
      stopPlayback({ preserveActiveStep: true })
      updatePlaybackPosition(nextPosition)
      play(tabSteps, nextPosition, nextSpeed)
    }
  }

  function getCurrentPlaybackPositionMs(durationMs: number) {
    return clampPlaybackPosition(playbackPositionMsRef.current, durationMs)
  }

  function startPlaybackProgress(
    startPositionMs: number,
    durationMs: number,
    speed: number,
  ) {
    if (playbackProgressIntervalRef.current !== undefined) {
      window.clearInterval(playbackProgressIntervalRef.current)
    }

    playbackPositionMsRef.current = startPositionMs
    playbackProgressIntervalRef.current = window.setInterval(() => {
      updatePlaybackPosition(
        clampPlaybackPosition(
          playbackPositionMsRef.current + playbackProgressIntervalMs * speed,
          durationMs,
        ),
      )
    }, playbackProgressIntervalMs)
  }

  function scheduleAudioPreview(
    audioContext: AudioContext,
    tabSteps: readonly TabStep[],
    previewStartMs: number,
    speed: number,
  ) {
    const previewStartTime = audioContext.currentTime + 0.05

    for (const step of tabSteps) {
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      const stepEndMs = step.startMs + step.durationMs
      const startOffsetMs = Math.max(0, step.startMs - previewStartMs)
      const remainingDurationMs = Math.max(0, stepEndMs - previewStartMs)
      const audibleDurationMs = Math.min(step.durationMs, remainingDurationMs)
      const startTime = previewStartTime + startOffsetMs / speed / 1000
      const endTime = startTime + Math.max(audibleDurationMs / speed / 1000, 0.08)

      oscillator.type = 'sine'
      oscillator.frequency.value = midiNoteToFrequency(step.midiNote)
      gain.gain.setValueAtTime(0.0001, startTime)
      gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.02)
      gain.gain.setValueAtTime(0.18, Math.max(startTime + 0.03, endTime - 0.04))
      gain.gain.exponentialRampToValueAtTime(0.0001, endTime)
      oscillator.connect(gain).connect(audioContext.destination)
      oscillator.start(startTime)
      oscillator.stop(endTime + 0.02)
      oscillator.onended = () => {
        oscillatorsRef.current = oscillatorsRef.current.filter(
          (storedOscillator) => storedOscillator !== oscillator,
        )
      }
      oscillatorsRef.current.push(oscillator)
    }
  }

  return {
    isPlaying,
    playbackPositionMs,
    playbackSpeed,
    play,
    toggle,
    seek,
    setPlaybackSpeed,
    stopPlayback,
    updatePlaybackPosition,
  }
}
