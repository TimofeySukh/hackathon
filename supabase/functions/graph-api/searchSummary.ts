// Keep in sync with src/lib/search/searchSummary.ts

type CircleNode = { id: string; name: string; parentId: string | null }
type PersonNote = { id: string; title: string; body: string }
type PersonLink = { id: string; label: string; url: string }
type PersonNode = {
  id: string
  name: string
  circleId: string
  notes?: PersonNote[]
  links?: PersonLink[]
  searchSummary?: string
}
type GraphState = { circles: CircleNode[]; people: PersonNode[]; connections: unknown[] }

const POSITION_NOTE_TITLES = new Set(['position', 'headline', 'title', 'role'])
const MAX_SUMMARY_LENGTH = 320

function formatCirclePath(path: Array<{ name: string }>) {
  return path.map((item) => item.name).filter(Boolean).join(' › ')
}

function getCirclePath(graph: GraphState, circleId: string | null): CircleNode[] {
  const circlesById = new Map(graph.circles.map((circle) => [circle.id, circle]))
  const path: CircleNode[] = []
  let current = circleId ? circlesById.get(circleId) : undefined
  const seen = new Set<string>()
  while (current && !seen.has(current.id)) {
    path.unshift(current)
    seen.add(current.id)
    current = current.parentId ? circlesById.get(current.parentId) : undefined
  }
  return path
}

function getPersonPosition(person: PersonNode) {
  for (const note of person.notes ?? []) {
    if (POSITION_NOTE_TITLES.has(note.title.trim().toLowerCase())) {
      return note.body.trim()
    }
  }
  return undefined
}

export function buildPersonSearchSummary(graph: GraphState, person: PersonNode): string {
  const circlePath = getCirclePath(graph, person.circleId)
  const pathLabel = formatCirclePath(circlePath)
  const position = getPersonPosition(person)
  const noteLines = (person.notes ?? [])
    .map((note) => `${note.title}: ${note.body}`.trim())
    .filter(Boolean)
    .slice(0, 8)
  const linkLabels = (person.links ?? [])
    .map((link) => `${link.label} ${link.url}`.trim())
    .filter(Boolean)
    .slice(0, 3)

  const parts = [
    person.name.trim(),
    pathLabel ? `circle ${pathLabel}` : '',
    position ? `role ${position}` : '',
    ...noteLines,
    ...linkLabels,
  ].filter(Boolean)

  return parts.join(' | ').slice(0, MAX_SUMMARY_LENGTH)
}

export function refreshPersonSearchSummary(graph: GraphState, person: PersonNode) {
  person.searchSummary = buildPersonSearchSummary(graph, person)
}

export function ensurePersonSearchSummaries(graph: GraphState) {
  for (const person of graph.people) {
    if (!person.searchSummary?.trim()) {
      refreshPersonSearchSummary(graph, person)
    }
  }
}

export function personSearchHaystack(graph: GraphState, person: PersonNode): string {
  if (person.searchSummary?.trim()) {
    return person.searchSummary.trim().toLowerCase()
  }
  const circlePath = getCirclePath(graph, person.circleId)
  const pathLabel = formatCirclePath(circlePath)
  const noteText = (person.notes ?? []).map((note) => `${note.title} ${note.body}`).join(' ')
  const linkText = (person.links ?? []).map((link) => `${link.label} ${link.url}`).join(' ')
  return [person.name, pathLabel, noteText, linkText].filter(Boolean).join(' ').toLowerCase()
}
