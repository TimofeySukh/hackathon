// Pure graph-layout logic: containment fitting, collision relaxation, circle
// resizing and the tree helpers they rely on. No React, no DOM — given a
// GraphState it returns a new GraphState.

import type { CircleNode, CircleTone, GraphState, LayoutContext, PersonNode } from './types'
import {
  CIRCLE_CENTER_COLLISION_RADIUS,
  CIRCLE_COLLISION_GAP,
  CIRCLE_CONTAINMENT_PADDING,
  COLLISION_PASSES,
  MIN_CIRCLE_RADIUS,
  IMPORT_CIRCLE_RADIUS_PADDING,
  PERSON_CIRCLE_COLLISION_GAP,
  PERSON_COLLISION_GAP,
  PERSON_COLLISION_RADIUS,
  PERSON_CONTAINMENT_RADIUS,
  PERSON_PACK_SPACING,
} from './constants'
import { getSeparation } from './geometry'

export function makeCircle(
  id: string,
  name: string,
  icon: string,
  x: number,
  y: number,
  radius: number,
  parentId: string | null,
  connectedTo: string | null,
  tone: CircleTone,
): CircleNode {
  return {
    id,
    name,
    icon,
    x,
    y,
    radius,
    minRadius: radius,
    parentId,
    connectedTo,
    tone,
    fillMode: 'transparent',
    shapeType: 'circle',
    shapeCustom: false,
    sides: 25,
    amplitude: 0,
  }
}

// A blank canvas for a brand-new account: just the central "you" circle.
export function createFreshGraph(): GraphState {
  return ensureContainment({
    circles: [makeCircle('you', 'You', 'YOU', 0, 0, 104, null, null, 'blue')],
    people: [],
    connections: [],
  })
}

// ---------------------------------------------------------------------------
// Deterministic non-overlapping packing for bulk import (e.g. a LinkedIn ZIP).
//
// The old import dropped every company onto one 680px ring and every person onto
// a fixed 35px ring, so hundreds of nodes overlapped and the O(n^2) collision
// relaxer had to untangle the pile-up — which froze the tab and left the board at
// ~1 FPS. These helpers instead place everything apart up front, so no collision
// resolution is needed.
// ---------------------------------------------------------------------------

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
// Innermost sunflower point sits at PERSON_PACK_SPACING * sqrt(PERSON_PACK_INNER).
// With spacing 25 that is 50px — clear of the centre handle (24) + person (21) + gap.
const PERSON_PACK_INNER = 4

// Offset of the k-th person from its circle centre in a sunflower/phyllotaxis
// packing. Even areal density; minimum nearest-neighbour distance ~1.657 * spacing.
export function personPackOffset(index: number): { x: number; y: number } {
  const r = PERSON_PACK_SPACING * Math.sqrt(index + PERSON_PACK_INNER)
  const theta = index * GOLDEN_ANGLE
  return { x: Math.cos(theta) * r, y: Math.sin(theta) * r }
}

// Radius a circle needs so `count` sunflower-packed people fit inside with the
// containment margin. Floors at 90 to match the default imported-circle size.
export function packedCircleRadius(count: number): number {
  if (count <= 1) return 90
  const rMax = PERSON_PACK_SPACING * Math.sqrt(count - 1 + PERSON_PACK_INNER)
  return Math.max(90, Math.ceil(rMax + PERSON_CONTAINMENT_RADIUS + IMPORT_CIRCLE_RADIUS_PADDING))
}

// Smallest angular separation on a ring of centre-radius R whose chord spans at
// least `dist`. Returns 2π when two such items can't share the ring (one per ring).
function chordAngle(R: number, dist: number): number {
  if (R <= 0) return 2 * Math.PI
  const s = dist / (2 * R)
  if (s >= 1) return 2 * Math.PI
  return 2 * Math.asin(s)
}

// Pack circles of varying radius into concentric rings around (cx, cy), compactly
// and provably without overlaps:
//  - within a ring, neighbours are spaced by chord >= rA + rB + gap, and the ring
//    reserves the closing step so the last and first item don't overlap either;
//  - the largest remaining circle leads each ring, so the band width covers every
//    member; the next band starts beyond this ring's outer extent + gap, and the
//    worst-case (radially-aligned) centre distance between rings equals that, so
//    cross-ring pairs can't overlap.
// Returns a map of input id -> centre position.
export function packCirclesInRings(
  items: { id: string; radius: number }[],
  cx: number,
  cy: number,
  gap: number,
  startRadius: number,
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>()
  const sorted = [...items].sort((a, b) => b.radius - a.radius)

  let bandInner = startRadius + gap
  let i = 0
  while (i < sorted.length) {
    const ringMaxR = sorted[i].radius // largest remaining leads the ring
    const ringCenterR = bandInner + ringMaxR

    const ringItems: { id: string; angle: number }[] = []
    let firstRadius = sorted[i].radius
    let prevRadius = 0
    let angle = 0

    while (i < sorted.length) {
      const r = sorted[i].radius
      const stepFromPrev = ringItems.length === 0 ? 0 : chordAngle(ringCenterR, prevRadius + r + gap)
      const closeStep = chordAngle(ringCenterR, firstRadius + r + gap)
      // Place the first item unconditionally; otherwise only if it fits before
      // wrapping while still reserving room to close back to the first item.
      if (ringItems.length > 0 && angle + stepFromPrev + closeStep > 2 * Math.PI) break

      angle += stepFromPrev
      if (ringItems.length === 0) firstRadius = r
      ringItems.push({ id: sorted[i].id, angle })
      prevRadius = r
      i += 1
    }

    for (const it of ringItems) {
      result.set(it.id, { x: cx + Math.cos(it.angle) * ringCenterR, y: cy + Math.sin(it.angle) * ringCenterR })
    }

    bandInner = ringCenterR + ringMaxR + gap
  }

  return result
}

export function findFreeSpaceInCircle(
  circles: CircleNode[],
  people: PersonNode[],
  circleId: string,
): { x: number; y: number } {
  const circle = circles.find((c) => c.id === circleId)
  if (!circle) return { x: 0, y: 0 }

  const candidateRadii = [circle.radius * 0.3, circle.radius * 0.6]
  const numAngles = 12
  let bestPoint = { x: circle.x, y: circle.y }
  let maxMinDist = -1

  const elements = [
    ...people.map((p) => ({ x: p.x, y: p.y, r: 24 })),
    ...circles.filter((c) => c.id !== circleId).map((c) => ({ x: c.x, y: c.y, r: c.radius })),
  ]

  for (const r of candidateRadii) {
    for (let i = 0; i < numAngles; i++) {
      const angle = (i * 2 * Math.PI) / numAngles
      const px = circle.x + r * Math.cos(angle)
      const py = circle.y + r * Math.sin(angle)

      let minDist = Infinity
      for (const el of elements) {
        const dist = Math.hypot(px - el.x, py - el.y) - el.r
        if (dist < minDist) {
          minDist = dist
        }
      }

      if (minDist > maxMinDist) {
        maxMinDist = minDist
        bestPoint = { x: px, y: py }
      }
    }
  }

  if (maxMinDist === Infinity || maxMinDist < 5) {
    const randomAngle = Math.random() * 2 * Math.PI
    const randomRadius = circle.radius * 0.4
    return {
      x: circle.x + randomRadius * Math.cos(randomAngle),
      y: circle.y + randomRadius * Math.sin(randomAngle),
    }
  }

  return bestPoint
}

export function resizeCircleFromPoint(
  state: GraphState,
  circleId: string,
  point: { x: number; y: number },
  options: { resolveLayout?: boolean } = {},
): GraphState {
  const circle = state.circles.find((candidate) => candidate.id === circleId)
  if (!circle) return state

  const requestedRadius = Math.max(MIN_CIRCLE_RADIUS, Math.hypot(point.x - circle.x, point.y - circle.y))
  const radiusRatio = requestedRadius < circle.radius ? requestedRadius / circle.radius : 1
  const resizedState = radiusRatio < 1 ? pullCircleContentsTowardCenter(state, circleId, circle, radiusRatio) : state
  const nextState = {
    ...resizedState,
    circles: resizedState.circles.map((candidate) =>
      candidate.id === circleId ? { ...candidate, minRadius: requestedRadius, radius: requestedRadius } : candidate,
    ),
  }

  if (options.resolveLayout === false) return nextState
  return ensureContainment(nextState, { activeCircleId: circleId })
}

export function ensureContainment(state: GraphState, context: LayoutContext = {}): GraphState {
  return fitContainment(resolveCollisions(fitContainment(resolveCollisions(state, context)), context))
}

function fitContainment(state: GraphState): GraphState {
  let circles = state.circles

  for (let pass = 0; pass < circles.length + 2; pass += 1) {
    const circlesById = new Map(circles.map((circle) => [circle.id, circle]))
    let changed = false

    const nextCircles = circles.map((circle) => {
      const requiredRadius = getRequiredCircleRadius(circle, circles, circlesById, state.people)
      if (requiredRadius === circle.radius) return circle

      changed = true
      return { ...circle, radius: requiredRadius }
    })

    circles = nextCircles
    if (!changed) break
  }

  return { ...state, circles }
}

function pullCircleContentsTowardCenter(
  state: GraphState,
  circleId: string,
  circle: CircleNode,
  radiusRatio: number,
): GraphState {
  const requestedRadius = circle.radius * radiusRatio

  const circles = state.circles.map((c) => ({ ...c }))
  const people = state.people.map((p) => ({ ...p }))

  const circlesById = new Map(circles.map((c) => [c.id, c]))
  const descendantCircleIds = getDescendantCircleIds(circles, circleId)

  // Temporarily update root circle's radius for nested containment check
  const rootCircle = circlesById.get(circleId)
  if (rootCircle) {
    rootCircle.radius = requestedRadius
  }

  // Process descendant circles in tree order starting from circleId
  const queue = [circleId]
  while (queue.length > 0) {
    const parentId = queue.shift()!
    const parent = circlesById.get(parentId)!

    const children = circles.filter((c) => c.parentId === parentId)
    for (const child of children) {
      const dx = child.x - parent.x
      const dy = child.y - parent.y
      const d = Math.hypot(dx, dy)

      const maxAllowed = parent.radius - child.radius - CIRCLE_CONTAINMENT_PADDING
      if (d > maxAllowed) {
        if (maxAllowed < 0) {
          const newRadius = Math.max(MIN_CIRCLE_RADIUS, parent.radius - CIRCLE_CONTAINMENT_PADDING)
          child.radius = newRadius
          child.minRadius = Math.max(MIN_CIRCLE_RADIUS, child.minRadius * radiusRatio)
          child.x = parent.x
          child.y = parent.y
        } else {
          if (d > 0.0001) {
            child.x = parent.x + (dx / d) * maxAllowed
            child.y = parent.y + (dy / d) * maxAllowed
          } else {
            child.x = parent.x
            child.y = parent.y
          }
        }
      }
      queue.push(child.id)
    }
  }

  circles.forEach((c) => {
    circlesById.set(c.id, c)
  })

  const containedCircleIds = new Set(descendantCircleIds)
  containedCircleIds.add(circleId)

  const updatedPeople = people.map((person) => {
    if (containedCircleIds.has(person.circleId)) {
      const parent = circlesById.get(person.circleId)
      if (!parent) return person

      const dx = person.x - parent.x
      const dy = person.y - parent.y
      const d = Math.hypot(dx, dy)

      const maxAllowed = parent.radius - PERSON_CONTAINMENT_RADIUS
      if (d > maxAllowed) {
        const targetD = Math.max(0, maxAllowed)
        if (d > 0.0001) {
          return {
            ...person,
            x: parent.x + (dx / d) * targetD,
            y: parent.y + (dy / d) * targetD,
          }
        } else {
          return {
            ...person,
            x: parent.x,
            y: parent.y,
          }
        }
      }
    }
    return person
  })

  return {
    ...state,
    circles: state.circles.map((c) => {
      if (c.id === circleId) return c
      const updated = circlesById.get(c.id)
      return updated ? updated : c
    }),
    people: updatedPeople,
  }
}

function resolveCollisions(state: GraphState, context: LayoutContext): GraphState {
  let circles = state.circles.map((circle) => ({ ...circle }))
  let people = state.people.map((person) => ({ ...person }))

  for (let pass = 0; pass < COLLISION_PASSES; pass += 1) {
    let changed = false
    const circleIndexById = new Map(circles.map((circle, index) => [circle.id, index]))
    const personIndexById = new Map(people.map((person, index) => [person.id, index]))

    for (let i = 0; i < circles.length; i += 1) {
      for (let j = i + 1; j < circles.length; j += 1) {
        const a = circles[i]
        const b = circles[j]
        if (a.parentId !== b.parentId) continue

        const separation = getSeparation(a, b, a.radius + b.radius + CIRCLE_COLLISION_GAP)
        if (!separation) continue

        const activeSide = context.activeCircleId === a.id ? 'a' : context.activeCircleId === b.id ? 'b' : null
        let moveA = activeSide === 'a' ? 0 : activeSide === 'b' ? 1 : 0.5
        let moveB = activeSide === 'b' ? 0 : activeSide === 'a' ? 1 : 0.5

        if (a.id === 'you') {
          moveA = 0
          moveB = 1
        } else if (b.id === 'you') {
          moveA = 1
          moveB = 0
        }

        if (moveA > 0) {
          const translated = translateCircleSubtree(circles, people, a.id, -separation.x * moveA, -separation.y * moveA)
          circles = translated.circles
          people = translated.people
        }
        if (moveB > 0) {
          const translated = translateCircleSubtree(circles, people, b.id, separation.x * moveB, separation.y * moveB)
          circles = translated.circles
          people = translated.people
        }
        changed = true
      }
    }

    for (let i = 0; i < people.length; i += 1) {
      for (let j = i + 1; j < people.length; j += 1) {
        const a = people[i]
        const b = people[j]
        if (a.circleId !== b.circleId) continue

        const separation = getSeparation(a, b, PERSON_COLLISION_RADIUS * 2 + PERSON_COLLISION_GAP)
        if (!separation) continue

        const activeSide = context.activePersonId === a.id ? 'a' : context.activePersonId === b.id ? 'b' : null
        const moveA = activeSide === 'a' ? 0 : activeSide === 'b' ? 1 : 0.5
        const moveB = activeSide === 'b' ? 0 : activeSide === 'a' ? 1 : 0.5

        people[i] = { ...a, x: a.x - separation.x * moveA, y: a.y - separation.y * moveA }
        people[j] = { ...b, x: b.x + separation.x * moveB, y: b.y + separation.y * moveB }
        changed = true
      }
    }

    for (const childCircle of circles) {
      if (!childCircle.parentId) continue
      for (const person of people) {
        if (person.circleId !== childCircle.parentId) continue

        const separation = getSeparation(
          childCircle,
          person,
          childCircle.radius + PERSON_COLLISION_RADIUS + PERSON_CIRCLE_COLLISION_GAP,
        )
        if (!separation) continue

        const personIndex = personIndexById.get(person.id)
        if (personIndex == null) continue
        people[personIndex] = {
          ...people[personIndex],
          x: people[personIndex].x + separation.x,
          y: people[personIndex].y + separation.y,
        }
        changed = true
      }
    }

    for (const person of people) {
      const parentIndex = circleIndexById.get(person.circleId)
      const personIndex = personIndexById.get(person.id)
      if (parentIndex == null || personIndex == null) continue

      const parentCircle = circles[parentIndex]
      const separation = getSeparation(
        parentCircle,
        people[personIndex],
        CIRCLE_CENTER_COLLISION_RADIUS + PERSON_COLLISION_RADIUS + PERSON_COLLISION_GAP,
      )
      if (!separation) continue

      people[personIndex] = {
        ...people[personIndex],
        x: people[personIndex].x + separation.x,
        y: people[personIndex].y + separation.y,
      }
      changed = true
    }

    for (const person of people) {
      const parentIndex = circleIndexById.get(person.circleId)
      const personIndex = personIndexById.get(person.id)
      if (parentIndex == null || personIndex == null) continue
      people[personIndex] = clampPersonInsideCircle(people[personIndex], circles[parentIndex])
    }

    if (!changed) break
  }

  return { ...state, circles, people }
}

function translateCircleSubtree(
  circles: CircleNode[],
  people: PersonNode[],
  circleId: string,
  deltaX: number,
  deltaY: number,
) {
  const subtreeIds = getDescendantCircleIds(circles, circleId)
  subtreeIds.add(circleId)

  return {
    circles: circles.map((circle) =>
      subtreeIds.has(circle.id) ? { ...circle, x: circle.x + deltaX, y: circle.y + deltaY } : circle,
    ),
    people: people.map((person) =>
      subtreeIds.has(person.circleId) ? { ...person, x: person.x + deltaX, y: person.y + deltaY } : person,
    ),
  }
}

function clampPersonInsideCircle(person: PersonNode, circle: CircleNode) {
  const maxDistance = Math.max(0, circle.radius - PERSON_COLLISION_RADIUS)
  const dx = person.x - circle.x
  const dy = person.y - circle.y
  const distance = Math.hypot(dx, dy)
  if (distance <= maxDistance || distance < 0.0001) return person

  return {
    ...person,
    x: circle.x + (dx / distance) * maxDistance,
    y: circle.y + (dy / distance) * maxDistance,
  }
}

function getRequiredCircleRadius(
  circle: CircleNode,
  circles: CircleNode[],
  circlesById: Map<string, CircleNode>,
  people: PersonNode[],
) {
  let requiredRadius = Math.max(MIN_CIRCLE_RADIUS, circle.minRadius)

  for (const person of people) {
    if (person.circleId !== circle.id) continue
    requiredRadius = Math.max(requiredRadius, Math.hypot(person.x - circle.x, person.y - circle.y) + PERSON_CONTAINMENT_RADIUS)
  }

  for (const childCircle of circles) {
    if (childCircle.parentId !== circle.id) continue

    const latestChild = circlesById.get(childCircle.id) ?? childCircle
    requiredRadius = Math.max(
      requiredRadius,
      Math.hypot(latestChild.x - circle.x, latestChild.y - circle.y) + latestChild.radius + CIRCLE_CONTAINMENT_PADDING,
    )
  }

  return Math.ceil(requiredRadius)
}

export function getDescendantCircleIds(circles: CircleNode[], circleId: string) {
  const descendants = new Set<string>()
  const pending = [circleId]

  while (pending.length > 0) {
    const parentId = pending.pop()
    for (const circle of circles) {
      if (circle.parentId !== parentId || descendants.has(circle.id)) continue
      descendants.add(circle.id)
      pending.push(circle.id)
    }
  }

  return descendants
}
