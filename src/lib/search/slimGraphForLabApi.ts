/**
 * Strip layout coordinates before sending a synthetic graph to the discovery API.
 */

import type { GraphState } from '../board/types'

export function slimGraphForLabApi(graph: GraphState): GraphState {
  return {
    circles: graph.circles.map((circle) => ({
      id: circle.id,
      name: circle.name,
      icon: circle.icon ?? circle.name.slice(0, 2).toUpperCase(),
      x: 0,
      y: 0,
      radius: circle.radius ?? 72,
      minRadius: circle.minRadius ?? 48,
      parentId: circle.parentId ?? null,
      connectedTo: circle.connectedTo ?? null,
      tone: circle.tone ?? 'blue',
      fillMode: circle.fillMode ?? 'transparent',
    })),
    people: graph.people.map((person) => ({
      id: person.id,
      name: person.name,
      x: 0,
      y: 0,
      circleId: person.circleId,
      avatar: person.avatar ?? person.name.slice(0, 2).toUpperCase(),
      notes: person.notes ?? [],
      searchSummary: person.searchSummary,
    })),
    connections: [],
  }
}
