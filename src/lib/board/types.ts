// Shared board domain + interaction types. Kept out of App.tsx so the rendering,
// layout, spatial-index and color helpers can import them without depending on
// the App component (which would create import cycles).

export type CircleTone = 'blue' | 'red' | 'green' | 'amber' | 'violet'

export type ShapeType = 'circle' | 'wavy' | 'polygon'

export type CircleShapeMode = 'circles' | 'figures'
export type CircleFillMode = 'transparent' | 'solid'

export type CircleNode = {
  id: string
  name: string
  icon: string
  x: number
  y: number
  radius: number
  minRadius: number
  parentId: string | null
  connectedTo: string | null
  tone: CircleTone
  shapeType?: ShapeType
  sides?: number
  amplitude?: number
  imageUrl?: string
  customColor?: string
  fillMode?: CircleFillMode
}

export type PersonNote = {
  id: string
  title: string
  body: string
}

export type PersonLinkService =
  | 'linkedin'
  | 'telegram'
  | 'instagram'
  | 'facebook'
  | 'whatsapp'
  | 'x'
  | 'website'

export type PersonLink = {
  id: string
  service: PersonLinkService
  label: string
  url: string
}

export type PersonNode = {
  id: string
  name: string
  role: string
  x: number
  y: number
  circleId: string
  avatar: string
  shapeType?: ShapeType
  sides?: number
  amplitude?: number
  imageUrl?: string
  isFavorite?: boolean
  notes?: PersonNote[]
  links?: PersonLink[]
}

export type Connection = {
  id: string
  fromId: string
  toId: string
}

export type GraphState = {
  circles: CircleNode[]
  people: PersonNode[]
  connections: Connection[]
}

export type Camera = {
  x: number
  y: number
  scale: number
}

export type DragConnector = {
  sourceId: string
  sourceType: 'circle' | 'person'
  startX: number
  startY: number
  endX: number
  endY: number
}

export type MarqueeState = {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export type SelectedItem =
  | { type: 'circle'; id: string }
  | { type: 'person'; id: string }
  | { type: 'connection'; id: string }
  | null

export type HsvColor = {
  h: number
  s: number
  v: number
}

export type BoardHit =
  | { type: 'circle-center'; circle: CircleNode }
  | { type: 'circle-edge'; circle: CircleNode }
  | { type: 'circle-body'; circle: CircleNode }
  | { type: 'person'; person: PersonNode }
  | { type: 'connection'; connection: Connection }
  | { type: 'connector-handle'; sourceId: string; sourceType: 'circle' | 'person'; x: number; y: number }
  | null

export type WorldRect = { left: number; right: number; top: number; bottom: number }

export type BoardIndex = {
  circles: CircleNode[]
  people: PersonNode[]
  connections: Connection[]
  circlesById: Map<string, CircleNode>
  peopleById: Map<string, PersonNode>
  peopleByCell: Map<string, PersonNode[]>
  circlesByCell: Map<string, CircleNode[]>
  connectionsByEndpoint: Map<string, Connection[]>
  // Reverse adjacency: a parent circle -> the circles that hang off it
  // (circle.connectedTo) and the people attached to it (person.circleId). Lets
  // edge rendering find edges whose *other* endpoint is off-screen, so a line
  // stays drawn as long as either endpoint is visible.
  circleChildren: Map<string, CircleNode[]>
  peopleByCircle: Map<string, PersonNode[]>
}

// A circle shape morph: animate from one (sides, amplitude) to another so the
// shape change (corners and/or waviness) eases instead of snapping. Both shapes
// are sampled to matching points and lerped, so side counts can differ.
export type CircleMorph = {
  fromSides: number
  fromAmp: number
  toSides: number
  toAmp: number
  fromShapeType?: ShapeType
  toShapeType?: ShapeType
}

export type BoardAnim = {
  start: number
  duration: number
  // For 'morph:<id>' anims.
  morph?: CircleMorph
}

export type AnimFrame = {
  // nodeId -> current draw-scale multiplier (1 = at rest). Drives the press
  // bounce on selection and the grow-in pop for freshly created nodes.
  scales: Map<string, number>
  // circleId -> in-flight shape morph (with eased progress `t`) that overrides
  // the circle's stored shape while the animation runs.
  morphs: Map<string, CircleMorph & { t: number }>
}

export type LayoutContext = {
  activeCircleId?: string
  activePersonId?: string
}
