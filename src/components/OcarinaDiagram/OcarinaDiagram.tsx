import { useId } from 'react'
import type { OcarinaHoleId } from './OcarinaDiagram.constants'
import './OcarinaDiagram.css'

export type { OcarinaHoleId } from './OcarinaDiagram.constants'

type OcarinaHole = {
  id: OcarinaHoleId
  label: string
  cx: number
  cy: number
  r?: number
  rx?: number
  ry?: number
}

type OcarinaDiagramProps = {
  filledHoles?: readonly OcarinaHoleId[]
  className?: string
  title?: string
}

const holes: readonly OcarinaHole[] = [
  { id: 'left-index', label: 'Left index finger', cx: 86, cy: 136, r: 18 },
  { id: 'left-middle', label: 'Left middle finger', cx: 138, cy: 105, r: 18 },
  { id: 'left-ring', label: 'Left ring finger', cx: 184, cy: 83, r: 16 },
  { id: 'left-pinky', label: 'Left pinky finger', cx: 229, cy: 70, r: 14 },
  { id: 'right-index', label: 'Right index finger', cx: 281, cy: 136, r: 18 },
  { id: 'right-middle', label: 'Right middle finger', cx: 331, cy: 107, r: 18 },
  { id: 'right-ring', label: 'Right ring finger', cx: 379, cy: 91, r: 18 },
  { id: 'right-pinky', label: 'Right pinky finger', cx: 424, cy: 81, r: 14 },
  { id: 'subhole-1', label: 'Subhole 1', cx: 159, cy: 140, r: 12 },
  { id: 'subhole-2', label: 'Subhole 2', cx: 318, cy: 74, r: 12 },
  { id: 'right-thumb', label: 'Right thumb, back', cx: 198, cy: 252, r: 21 },
  { id: 'left-thumb', label: 'Left thumb, back', cx: 404, cy: 252, r: 21 },
]

export function OcarinaDiagram({
  filledHoles = [],
  className,
  title = '12-hole ocarina fingering diagram',
}: OcarinaDiagramProps) {
  const componentId = useId().replaceAll(':', '')
  const titleId = `${componentId}-title`
  const filledHoleSet = new Set(filledHoles)
  const classNames = ['ocarina-diagram', className].filter(Boolean).join(' ')

  return (
    <svg
      className={classNames}
      viewBox="0 0 520 285"
      role="img"
      aria-labelledby={titleId}
    >
      <title id={titleId}>{title}</title>

      <g className="ocarina-diagram__instrument">
        <path
          className="ocarina-diagram__body"
          d="M61 151C43 113 72 73 136 51C205 28 279 34 360 47C406 55 451 51 488 65C517 76 519 94 493 114C472 130 441 141 407 154C377 167 361 187 353 215C347 240 326 267 291 267C260 267 243 246 233 215C223 184 202 170 164 167C126 164 93 184 60 181C35 179 22 165 24 144C27 121 39 102 54 85C38 111 41 136 61 151Z"
        />

        <g className="ocarina-diagram__subhole-wells" aria-hidden="true">
          <ellipse cx="148" cy="122" rx="31" ry="55" transform="rotate(-18 148 122)" />
          <ellipse cx="321" cy="91" rx="29" ry="51" transform="rotate(-17 321 91)" />
        </g>

        <g className="ocarina-diagram__holes">
          {holes.map((hole) => {
            const isFilled = filledHoleSet.has(hole.id)

            return (
              <g
                key={hole.id}
                className="ocarina-diagram__hole-group"
                data-filled={isFilled}
                data-hole-id={hole.id}
              >
                <title>{`${hole.label}: ${isFilled ? 'covered' : 'open'}`}</title>
                {'r' in hole && hole.r ? (
                  <circle
                    className="ocarina-diagram__hole"
                    cx={hole.cx}
                    cy={hole.cy}
                    r={hole.r}
                  />
                ) : (
                  <ellipse
                    className="ocarina-diagram__hole"
                    cx={hole.cx}
                    cy={hole.cy}
                    rx={hole.rx}
                    ry={hole.ry}
                  />
                )}
              </g>
            )
          })}
        </g>
      </g>
    </svg>
  )
}
