export const ocarinaHoleIds = [
  'left-index',
  'left-middle',
  'left-ring',
  'left-pinky',
  'right-index',
  'right-middle',
  'right-ring',
  'right-pinky',
  'subhole-1',
  'subhole-2',
  'left-thumb',
  'right-thumb',
] as const

export type OcarinaHoleId = (typeof ocarinaHoleIds)[number]
