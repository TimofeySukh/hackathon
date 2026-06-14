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
  PERSON_CIRCLE_COLLISION_GAP,
  PERSON_COLLISION_GAP,
  PERSON_COLLISION_RADIUS,
  PERSON_CONTAINMENT_RADIUS,
} from './constants'
import { clamp, getSeparation } from './geometry'

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
    shapeType: 'wavy',
    sides: Math.max(8, Math.round(radius / 10)),
    amplitude: Math.max(4, Math.round(radius * 0.055)),
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

export function resizeCircleFromPoint(state: GraphState, circleId: string, point: { x: number; y: number }): GraphState {
  const circle = state.circles.find((candidate) => candidate.id === circleId)
  if (!circle) return state

  const requestedRadius = Math.max(MIN_CIRCLE_RADIUS, Math.hypot(point.x - circle.x, point.y - circle.y))
  const radiusRatio = requestedRadius < circle.radius ? requestedRadius / circle.radius : 1
  const resizedState = radiusRatio < 1 ? pullCircleContentsTowardCenter(state, circleId, circle, radiusRatio) : state

  return ensureContainment({
    ...resizedState,
    circles: resizedState.circles.map((candidate) =>
      candidate.id === circleId ? { ...candidate, minRadius: requestedRadius, radius: requestedRadius } : candidate,
    ),
  }, { activeCircleId: circleId })
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
  const descendantCircleIds = getDescendantCircleIds(state.circles, circleId)
  const containedCircleIds = new Set(descendantCircleIds)
  containedCircleIds.add(circleId)
  const scale = clamp(radiusRatio, 0.12, 1)

  function pullPoint(point: { x: number; y: number }) {
    return {
      x: circle.x + (point.x - circle.x) * scale,
      y: circle.y + (point.y - circle.y) * scale,
    }
  }

  return {
    ...state,
    circles: state.circles.map((candidate) =>
      descendantCircleIds.has(candidate.id)
        ? {
            ...candidate,
            ...pullPoint(candidate),
            radius: Math.max(MIN_CIRCLE_RADIUS, candidate.radius * scale),
            minRadius: Math.max(MIN_CIRCLE_RADIUS, candidate.minRadius * scale),
          }
        : candidate,
    ),
    people: state.people.map((person) =>
      containedCircleIds.has(person.circleId) ? { ...person, ...pullPoint(person) } : person,
    ),
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
