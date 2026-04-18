export type Offset = {
  x: number
  y: number
}

export type GraphNodeKind = 'root' | 'default'

export type GraphNode = {
  id: string
  boardId?: string
  label: string
  x: number
  y: number
  kind: GraphNodeKind
  note: string | null
  tag: string | null
}

export type GraphEdge = {
  id: string
  boardId?: string
  from: string
  to: string
}

export type BoardGraph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export const ROOT_NODE_LABEL = 'You'

export const createAnonymousGraph = (): BoardGraph => ({
  nodes: [
    {
      id: 'root',
      label: ROOT_NODE_LABEL,
      x: 0,
      y: 0,
      kind: 'root',
      note: null,
      tag: null,
    },
  ],
  edges: [],
})
