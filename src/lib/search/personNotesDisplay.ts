import type { PersonNote } from '../board/types'

/** Short lines for result lists (title + body). */
export function formatPersonNoteLines(notes: PersonNote[] | undefined, limit = 3): string[] {
  return (notes ?? [])
    .map((note) => {
      const title = note.title.trim()
      const body = note.body.trim()
      if (!body) return ''
      return title ? `${title}: ${body}` : body
    })
    .filter(Boolean)
    .slice(0, limit)
}

/** All notes for the detail panel. */
export function formatPersonNotesBlock(notes: PersonNote[] | undefined): string[] {
  return formatPersonNoteLines(notes, 32)
}
