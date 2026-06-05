const physicalKeyboardNotes = [
  { key: 'Tab', label: 'Tab', midiNote: 69 },
  { key: '1', label: '1', midiNote: 70 },
  { key: 'q', label: 'Q', midiNote: 71 },
  { key: 'w', label: 'W', midiNote: 72 },
  { key: '3', label: '3', midiNote: 73 },
  { key: 'e', label: 'E', midiNote: 74 },
  { key: '4', label: '4', midiNote: 75 },
  { key: 'r', label: 'R', midiNote: 76 },
  { key: 't', label: 'T', midiNote: 77 },
  { key: '6', label: '6', midiNote: 78 },
  { key: 'y', label: 'Y', midiNote: 79 },
  { key: '7', label: '7', midiNote: 80 },
  { key: 'u', label: 'U', midiNote: 81 },
  { key: '8', label: '8', midiNote: 82 },
  { key: 'i', label: 'I', midiNote: 83 },
  { key: 'o', label: 'O', midiNote: 84 },
  { key: '0', label: '0', midiNote: 85 },
  { key: 'p', label: 'P', midiNote: 86 },
  { key: '-', label: '-', midiNote: 87 },
  { key: '[', label: '[', midiNote: 88 },
  { key: ']', label: ']', midiNote: 89 },
] as const

const shiftedKeyAliases: Record<string, string> = {
  '!': '1',
  '#': '3',
  '$': '4',
  '^': '6',
  '&': '7',
  '*': '8',
  ')': '0',
  _: '-',
  '{': '[',
  '}': ']',
}

const physicalKeyboardNotesByKey = new Map<
  string,
  (typeof physicalKeyboardNotes)[number]
>(
  physicalKeyboardNotes.map((note) => [note.key, note]),
)

const physicalKeyboardLabelsByMidiNote = new Map<number, string>(
  physicalKeyboardNotes.map((note) => [note.midiNote, note.label]),
)

export function getPhysicalKeyboardMidiNote(key: string) {
  return physicalKeyboardNotesByKey.get(normalizePhysicalKeyboardKey(key))
    ?.midiNote
}

export function getPhysicalKeyboardKeyLabel(midiNote: number) {
  return physicalKeyboardLabelsByMidiNote.get(midiNote)
}

export function normalizePhysicalKeyboardKey(key: string) {
  if (key === 'Tab') {
    return key
  }

  const alias = shiftedKeyAliases[key]

  if (alias) {
    return alias
  }

  return key.length === 1 ? key.toLowerCase() : key
}
