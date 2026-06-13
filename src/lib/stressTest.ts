// ============================================================================
//  PERFORMANCE STRESS-TEST HARNESS
// ----------------------------------------------------------------------------
//  This is a *development-only* tool for measuring real rendering cost.
//
//  It generates REAL board entities — CircleNode / PersonNode / Connection —
//  that are merged into the live graph and flow through the same production
//  state, containment, collision, DOM circle, canvas people, and edge drawing
//  paths as normal data. So the FPS you read off is the FPS users will actually
//  get for the current hybrid renderer.
//
//  It spawns many circles, many people inside each circle, and a configurable
//  number of cross-circle person↔person links so the connection web is as
//  complex as a real, dense board.
//
//  HOW TO DISABLE: flip STRESS_TEST_ENABLED to false (the panel disappears and
//  no synthetic entities are generated).
//
//  HOW TO REMOVE ENTIRELY: delete this file and the small blocks in App.tsx
//  marked with `STRESS TEST` (search the file for that string).
// ============================================================================

import type { CircleNode, PersonNode, Connection, CircleTone } from '../App'

/** Master switch. Set to `false` to hide the panel and disable generation. */
export const STRESS_TEST_ENABLED = false

export type StressConfig = {
  /** How many synthetic circles to spawn (in addition to the real board). */
  circleCount: number
  /** How many synthetic people to place inside each synthetic circle. */
  peoplePerCircle: number
  /** Extra random person↔person links spanning across circles. */
  crossLinks: number
}

/** Generation is off by default — the user opts in via the panel sliders. */
export const STRESS_DEFAULT_CONFIG: StressConfig = {
  circleCount: 0,
  peoplePerCircle: 0,
  crossLinks: 0,
}

/** Upper bounds for the panel sliders. */
export const STRESS_LIMITS = {
  circleCount: 250,
  peoplePerCircle: 120,
  crossLinks: 4000,
}

export type StressGraph = {
  circles: CircleNode[]
  people: PersonNode[]
  connections: Connection[]
}

const EMPTY_GRAPH: StressGraph = { circles: [], people: [], connections: [] }

const TONES: CircleTone[] = ['blue', 'red', 'green', 'amber', 'violet']
const AVATAR_NAMES = ['AL', 'BD', 'CE', 'DK', 'EV', 'FX', 'GN', 'HM', 'IR']

// Deterministic PRNG so a given config always produces the same layout — makes
// repeated measurements comparable run-to-run.
function seeded(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

// Lay the synthetic board out to the side of the real board so the two don't
// overlap. Grid placement keeps circles from colliding with each other.
const FIELD_ORIGIN_X = 1600
const FIELD_ORIGIN_Y = -200

/**
 * Build a self-contained sub-graph of real circles, people and connections.
 * Returns empty arrays when the harness is disabled or nothing is requested,
 * so callers can cheaply skip merging.
 */
export function generateStressGraph(config: StressConfig): StressGraph {
  if (!STRESS_TEST_ENABLED) return EMPTY_GRAPH

  const circleCount = Math.max(0, Math.floor(config.circleCount))
  const peoplePerCircle = Math.max(0, Math.floor(config.peoplePerCircle))
  if (circleCount === 0) return EMPTY_GRAPH

  const circles: CircleNode[] = []
  const people: PersonNode[] = []
  const connections: Connection[] = []

  // Size each circle so its ring of people fits comfortably inside it.
  const peopleRingRadius = 70 + Math.sqrt(Math.max(1, peoplePerCircle)) * 28
  const circleRadius = Math.max(110, peopleRingRadius + 56)
  const cellSize = circleRadius * 2 + 120
  const columns = Math.max(1, Math.ceil(Math.sqrt(circleCount)))

  for (let c = 0; c < circleCount; c += 1) {
    const col = c % columns
    const row = Math.floor(c / columns)
    const cx = FIELD_ORIGIN_X + col * cellSize
    const cy = FIELD_ORIGIN_Y + row * cellSize
    const circleId = `stress-circle-${c}`

    circles.push({
      id: circleId,
      name: `Group ${c + 1}`,
      icon: `G${c + 1}`,
      x: cx,
      y: cy,
      radius: circleRadius,
      minRadius: circleRadius,
      parentId: null,
      // Chain circles together so we also exercise circle↔circle edges.
      connectedTo: c > 0 ? `stress-circle-${c - 1}` : null,
      tone: TONES[c % TONES.length],
      shapeType: 'wavy',
      sides: Math.max(8, Math.round(circleRadius / 10)),
      amplitude: Math.max(4, circleRadius * 0.06),
    })

    // Distribute people on a phyllotaxis spiral inside the circle.
    for (let p = 0; p < peoplePerCircle; p += 1) {
      const angle = p * 2.399963229728653
      const ringStep = peoplePerCircle > 1 ? Math.sqrt(p / (peoplePerCircle - 1)) : 0
      const r = peopleRingRadius * ringStep
      const jitter = (seeded(c * 1000 + p) - 0.5) * 10
      const personId = `stress-person-${c}-${p}`
      people.push({
        id: personId,
        name: `Member ${c + 1}.${p + 1}`,
        role: 'member',
        x: cx + Math.cos(angle) * (r + jitter),
        y: cy + Math.sin(angle) * (r + jitter),
        circleId,
        avatar: AVATAR_NAMES[(c + p) % AVATAR_NAMES.length],
        shapeType: 'polygon',
        sides: 8 + ((c + p) % 5),
        amplitude: 2,
      })
    }
  }

  // Weave a complex web of cross-circle person↔person links. Only meaningful
  // when there are at least two people to connect.
  const crossLinks = Math.max(0, Math.floor(config.crossLinks))
  if (people.length > 1 && crossLinks > 0) {
    for (let i = 0; i < crossLinks; i += 1) {
      const a = Math.floor(seeded(i * 7 + 1) * people.length) % people.length
      let b = Math.floor(seeded(i * 13 + 3) * people.length) % people.length
      if (b === a) b = (b + 1) % people.length
      connections.push({
        id: `stress-link-${i}`,
        fromId: people[a].id,
        toId: people[b].id,
      })
    }
  }

  return { circles, people, connections }
}
