export const minimumPlaybackSpeed = 0.5
export const maximumPlaybackSpeed = 1.5
export const defaultPlaybackSpeed = 1
export const playbackProgressIntervalMs = 80

export function clampSemitones(semitones: number) {
  return Math.max(-24, Math.min(24, Number.isFinite(semitones) ? semitones : 0))
}

export function clampPlaybackSpeed(speed: number) {
  return Math.max(
    minimumPlaybackSpeed,
    Math.min(maximumPlaybackSpeed, Number.isFinite(speed) ? speed : 1),
  )
}

export function clampPlaybackPosition(positionMs: number, durationMs: number) {
  return Math.max(
    0,
    Math.min(
      Math.max(0, durationMs),
      Number.isFinite(positionMs) ? positionMs : 0,
    ),
  )
}
