/**
 * Pack synthetic Search Lab graphs on the board canvas (same layout as LinkedIn import).
 */

import { CIRCLE_COLLISION_GAP } from '../board/constants'
import { packCirclesInRings, packedCircleRadius, personPackOffset } from '../board/layout'
import type { CircleNode, CircleTone, GraphState, PersonNode } from '../board/types'

const PACK_GAP = CIRCLE_COLLISION_GAP + 24

function cloneGraph(graph: GraphState): GraphState {
  return structuredClone(graph)
}

function memberCircles(graph: GraphState) {
  const membersByCircle = new Map<string, PersonNode[]>()
  for (const person of graph.people) {
    const list = membersByCircle.get(person.circleId) ?? []
    list.push(person)
    membersByCircle.set(person.circleId, list)
  }
  return { membersByCircle, memberCircleIds: new Set(membersByCircle.keys()) }
}

/** Lay out every circle that holds people (flat, like LinkedIn import). */
export function layoutSyntheticGraphOnBoard(graph: GraphState): GraphState {
  const g = cloneGraph(graph)
  const you = g.circles.find((circle) => circle.id === 'you')
  if (!you) return g

  const { membersByCircle, memberCircleIds } = memberCircles(g)
  const circlesToPack = g.circles.filter((circle) => memberCircleIds.has(circle.id))

  const planned = circlesToPack.map((circle) => ({
    id: circle.id,
    radius: packedCircleRadius(membersByCircle.get(circle.id)?.length ?? 0),
  }))

  const positions = packCirclesInRings(planned, you.x, you.y, PACK_GAP, you.radius + 80)

  const circles: CircleNode[] = [
    you,
    ...circlesToPack.map((circle) => {
      const pos = positions.get(circle.id) ?? { x: you.x, y: you.y }
      const count = membersByCircle.get(circle.id)?.length ?? 0
      const radius = packedCircleRadius(count)
      return {
        ...circle,
        parentId: null,
        connectedTo: null,
        x: pos.x,
        y: pos.y,
        radius,
        minRadius: radius,
      }
    }),
  ]

  const slotByCircle = new Map<string, number>()
  const people = g.people.map((person) => {
    const circle = circles.find((entry) => entry.id === person.circleId)
    if (!circle) return person
    const slot = slotByCircle.get(person.circleId) ?? 0
    slotByCircle.set(person.circleId, slot + 1)
    const offset = personPackOffset(slot)
    return { ...person, x: circle.x + offset.x, y: circle.y + offset.y, isFavorite: false }
  })

  return { ...g, circles, people, connections: g.connections ?? [] }
}

export type DiscoveryOrganizeInput = {
  id: string
  label: string
  tone: CircleTone
  personIds: string[]
}

/** Agent-organized board: discovery group circles + matched people reparented from companies. */
export function applyDiscoveryOrganization(
  graph: GraphState,
  groups: DiscoveryOrganizeInput[],
): GraphState {
  const activeGroups = groups.filter((group) => group.personIds.length > 0)
  if (activeGroups.length === 0) return graph

  const g = cloneGraph(graph)
  const you = g.circles.find((circle) => circle.id === 'you')
  if (!you) return graph

  const matchIds = new Set(activeGroups.flatMap((group) => group.personIds))

  let maxX = you.x
  for (const circle of g.circles) {
    maxX = Math.max(maxX, circle.x + circle.radius)
  }

  const discoveryBaseX = maxX + 320
  const discoveryBaseY = you.y

  const discoveryPlanned = activeGroups.map((group) => ({
    id: `discovery-${group.id}`,
    radius: packedCircleRadius(group.personIds.length),
  }))

  const discoveryPositions = packCirclesInRings(
    discoveryPlanned,
    discoveryBaseX,
    discoveryBaseY,
    PACK_GAP,
    120,
  )

  const newCircles: CircleNode[] = [...g.circles]
  for (const group of activeGroups) {
    const circleId = `discovery-${group.id}`
    const pos = discoveryPositions.get(circleId)!
    const radius = packedCircleRadius(group.personIds.length)
    const countSuffix = group.personIds.length > 12 ? ` (${group.personIds.length})` : ''
    const shortLabel = group.label.length > 24 - countSuffix.length
      ? `${group.label.slice(0, 22 - countSuffix.length)}…`
      : group.label
    newCircles.push({
      id: circleId,
      name: `${shortLabel}${countSuffix}`,
      icon: group.label.slice(0, 2).toUpperCase(),
      x: pos.x,
      y: pos.y,
      radius,
      minRadius: radius,
      parentId: null,
      connectedTo: 'you',
      tone: group.tone,
      fillMode: 'solid',
      shapeType: 'circle',
      shapeCustom: false,
      sides: 25,
      amplitude: 0,
    })
  }

  const personToGroup = new Map<string, string>()
  for (const group of activeGroups) {
    for (const personId of group.personIds) {
      personToGroup.set(personId, `discovery-${group.id}`)
    }
  }

  const slotByDiscovery = new Map<string, number>()
  const slotRemain = new Map<string, number>()
  const finalPeople: PersonNode[] = []

  for (const person of g.people) {
    const discoveryCircleId = personToGroup.get(person.id)
    if (discoveryCircleId) {
      const circle = newCircles.find((entry) => entry.id === discoveryCircleId)!
      const slot = slotByDiscovery.get(discoveryCircleId) ?? 0
      slotByDiscovery.set(discoveryCircleId, slot + 1)
      const offset = personPackOffset(slot)
      finalPeople.push({
        ...person,
        circleId: discoveryCircleId,
        x: circle.x + offset.x,
        y: circle.y + offset.y,
      })
    } else if (!matchIds.has(person.id)) {
      const circleId = person.circleId
      const slot = slotRemain.get(circleId) ?? 0
      slotRemain.set(circleId, slot + 1)
      const circle = newCircles.find((entry) => entry.id === circleId)!
      const offset = personPackOffset(slot)
      finalPeople.push({
        ...person,
        x: circle.x + offset.x,
        y: circle.y + offset.y,
        isFavorite: false,
      })
    }
  }

  const finalCircles = newCircles.map((circle) => {
    if (circle.id.startsWith('discovery-') || circle.id === 'you') return circle
    const count = finalPeople.filter((person) => person.circleId === circle.id).length
    if (count === 0) return circle
    const radius = packedCircleRadius(count)
    return { ...circle, radius, minRadius: radius }
  })

  return { ...g, circles: finalCircles, people: finalPeople }
}

/** After search: show only You + discovery circles + matches (readable result view). */
export function buildResultsFocusGraph(
  graph: GraphState,
  groups: DiscoveryOrganizeInput[],
): GraphState {
  const organized = applyDiscoveryOrganization(graph, groups)
  const matchIds = new Set(groups.flatMap((group) => group.personIds))
  if (matchIds.size === 0) return organized

  const discoveryCircleIds = new Set(
    groups.filter((group) => group.personIds.length > 0).map((group) => `discovery-${group.id}`),
  )

  return {
    ...organized,
    circles: organized.circles.filter(
      (circle) => circle.id === 'you' || discoveryCircleIds.has(circle.id),
    ),
    people: organized.people.filter((person) => matchIds.has(person.id)),
    connections: [],
  }
}

/** Full-network view: graph unchanged; pass match ids to the canvas for outline highlighting. */
export function highlightSearchMatches(graph: GraphState, _matchIds: string[]): GraphState {
  void _matchIds
  return graph
}

/** All match ids for search-result highlighting (passed to the canvas, not isFavorite). */
export function discoveryMatchIds(groups: DiscoveryOrganizeInput[]): string[] {
  return groups.flatMap((group) => group.personIds)
}

export function discoveryGroupsFromResponse(
  groups: Array<{ id: string; label: string; tone: CircleTone; people: Array<{ id: string }> }>,
): DiscoveryOrganizeInput[] {
  return groups.map((group) => ({
    id: group.id,
    label: group.label,
    tone: group.tone,
    personIds: group.people.map((person) => person.id),
  }))
}

export function boundsForCircleIds(graph: GraphState, circleIds: string[]) {
  const ids = new Set(circleIds)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const circle of graph.circles) {
    if (!ids.has(circle.id)) continue
    minX = Math.min(minX, circle.x - circle.radius)
    minY = Math.min(minY, circle.y - circle.radius)
    maxX = Math.max(maxX, circle.x + circle.radius)
    maxY = Math.max(maxY, circle.y + circle.radius)
  }

  for (const person of graph.people) {
    if (!ids.has(person.circleId)) continue
    minX = Math.min(minX, person.x - 32)
    minY = Math.min(minY, person.y - 32)
    maxX = Math.max(maxX, person.x + 32)
    maxY = Math.max(maxY, person.y + 32)
  }

  if (!Number.isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}
