import { useEffect, useRef } from 'react'
import { midiNoteToFrequency } from '../playback/playbackMath'

type StopKeyboardNoteOptions = {
  immediate?: boolean
}

export function useKeyboardAudition() {
  const keyboardAudioContextRef = useRef<AudioContext | undefined>(undefined)
  const keyboardOscillatorRef = useRef<OscillatorNode | undefined>(undefined)
  const keyboardGainRef = useRef<GainNode | undefined>(undefined)

  function startKeyboardNote(midiNote: number) {
    const audioContext = getKeyboardAudioContext()

    if (!audioContext) {
      return
    }

    stopKeyboardNote({ immediate: true })

    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const startTime = audioContext.currentTime

    oscillator.type = 'sine'
    oscillator.frequency.value = midiNoteToFrequency(midiNote)
    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(0.16, startTime + 0.025)
    oscillator.connect(gain).connect(audioContext.destination)
    oscillator.start(startTime)
    oscillator.onended = () => {
      if (keyboardOscillatorRef.current === oscillator) {
        keyboardOscillatorRef.current = undefined
        keyboardGainRef.current = undefined
      }
    }

    keyboardOscillatorRef.current = oscillator
    keyboardGainRef.current = gain
  }

  function getKeyboardAudioContext() {
    if (keyboardAudioContextRef.current) {
      void keyboardAudioContextRef.current.resume()
      return keyboardAudioContextRef.current
    }

    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext

    if (!AudioContextConstructor) {
      return undefined
    }

    const audioContext = new AudioContextConstructor()

    keyboardAudioContextRef.current = audioContext
    void audioContext.resume()

    return audioContext
  }

  function stopKeyboardNote(options: StopKeyboardNoteOptions = {}) {
    const oscillator = keyboardOscillatorRef.current
    const gain = keyboardGainRef.current

    if (!oscillator) {
      return
    }

    try {
      if (options.immediate || !gain || !keyboardAudioContextRef.current) {
        oscillator.stop()
      } else {
        const audioContext = keyboardAudioContextRef.current
        const stopTime = audioContext.currentTime + 0.06

        gain.gain.cancelScheduledValues(audioContext.currentTime)
        gain.gain.setValueAtTime(
          Math.max(gain.gain.value, 0.0001),
          audioContext.currentTime,
        )
        gain.gain.exponentialRampToValueAtTime(0.0001, stopTime)
        oscillator.stop(stopTime + 0.02)
      }
    } catch {
      // The oscillator may have already ended between rapid key presses.
    }

    keyboardOscillatorRef.current = undefined
    keyboardGainRef.current = undefined
  }

  useEffect(() => {
    return () => {
      stopKeyboardNote()
      void keyboardAudioContextRef.current?.close()
      keyboardAudioContextRef.current = undefined
    }
  }, [])

  return {
    startKeyboardNote,
    stopKeyboardNote,
  }
}
