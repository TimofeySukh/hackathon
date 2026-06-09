// Pure helpers for the circles board: shape geometry, containment math, and the
// canvas sprite renderer that keeps thousands of people smooth. Ported from the
// `codex/circle-flutter-wavy` React prototype and generalized to render real data.

export type CircleTone = 'blue' | 'red' | 'green' | 'amber' | 'violet'
export type ShapeType = 'circle' | 'wavy' | 'polygon'

// View-model shapes (decoupled from the Supabase row types in graphTypes.ts).
export type Circle = {
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
  shapeType: ShapeType
  sides: number
  amplitude: number
  imageUrl?: string | null
}

export type Person = {
  id: string
  name: string
  x: number
  y: number
  circleId: string | null
  avatar: string
  isRoot?: boolean
  shapeType?: ShapeType
  sides?: number
  amplitude?: number
  imageUrl?: string | null
}

export type GraphView = {
  circles: Circle[]
  people: Person[]
}

export type Camera = {
  x: number
  y: number
  scale: number
}

export const MIN_SCALE = 0.05
export const MAX_SCALE = 1.8
export const MIN_CIRCLE_RADIUS = 72
export const PERSON_CONTAINMENT_RADIUS = 62
export const CIRCLE_CONTAINMENT_PADDING = 28
export const PERSON_HIT_RADIUS = 26
export const EDGE_RESIZE_HIT_SIZE = 18

export const CIRCLE_TONES: CircleTone[] = ['blue', 'red', 'green', 'amber', 'violet']

export const TONE_LABELS: Record<CircleTone, string> = {
  amber: 'Warm',
  blue: 'Blue',
  green: 'Green',
  red: 'Red',
  violet: 'Violet',
}

export const MATERIAL_TONES: Record<CircleTone, { fill: string; border: string; text: string; centerBg: string }> = {
  blue: { fill: '#D2E4FF', border: '#004A77', text: '#001D35', centerBg: '#00629D' },
  red: { fill: '#FFDAD6', border: '#BA1A1A', text: '#410002', centerBg: '#C00015' },
  green: { fill: '#D1E8D2', border: '#0F6D38', text: '#00210B', centerBg: '#1E824A' },
  amber: { fill: '#FFE082', border: '#B06000', text: '#2A1400', centerBg: '#D87A00' },
  violet: { fill: '#EADDFF', border: '#6750A4', text: '#21005D', centerBg: '#7F67BE' },
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function nextTone(index: number): CircleTone {
  return CIRCLE_TONES[index % CIRCLE_TONES.length]
}

export function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

export function makeCurve(from: { x: number; y: number }, to: { x: number; y: number }) {
  const midX = (from.x + to.x) / 2
  const lift = Math.min(100, Math.abs(to.y - from.y) * 0.22 + 38)
  return `M ${from.x} ${from.y} C ${midX} ${from.y - lift}, ${midX} ${to.y + lift}, ${to.x} ${to.y}`
}

export function screenToWorld(clientX: number, clientY: number, rect: DOMRect, camera: Camera) {
  return {
    x: (clientX - rect.left - camera.x) / camera.scale,
    y: (clientY - rect.top - camera.y) / camera.scale,
  }
}

// --- Shape geometry ---------------------------------------------------------

export function getNodePath(cx: number, cy: number, r: number, shapeType: ShapeType, sides: number, amplitude: number) {
  if (shapeType === 'circle' || amplitude === 0) {
    let path = ''
    const points = Math.max(120, Math.round(r * 2))
    for (let i = 0; i <= points; i++) {
      const angle = (i * 2 * Math.PI) / points
      const x = cx + r * Math.cos(angle)
      const y = cy + r * Math.sin(angle)
      path += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`
    }
    return `${path} Z`
  }

  if (shapeType === 'wavy') {
    let path = ''
    const points = Math.max(240, Math.round(r * 2 * Math.PI))
    const baseR = r - amplitude - 4
    for (let i = 0; i <= points; i++) {
      const angle = (i * 2 * Math.PI) / points
      const currentR = baseR + amplitude * Math.cos(sides * angle)
      const x = cx + currentR * Math.cos(angle)
      const y = cy + currentR * Math.sin(angle)
      path += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`
    }
    return `${path} Z`
  }

  // polygon (rounded)
  const softness = Math.min(1, Math.max(0, amplitude / 20))
  const vertices: { x: number; y: number }[] = []
  const angleStep = (2 * Math.PI) / sides
  for (let i = 0; i < sides; i++) {
    const angle = i * angleStep - Math.PI / 2
    vertices.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
  }

  const midpoints = vertices.map((vertex, i) => {
    const next = (i + 1) % sides
    return { x: (vertex.x + vertices[next].x) / 2, y: (vertex.y + vertices[next].y) / 2 }
  })

  let path = ''
  for (let i = 0; i < sides; i++) {
    const prevIdx = (i - 1 + sides) % sides
    const p = vertices[i]
    const mPrev = midpoints[prevIdx]
    const mNext = midpoints[i]
    const startX = p.x + (mPrev.x - p.x) * softness
    const startY = p.y + (mPrev.y - p.y) * softness
    const endX = p.x + (mNext.x - p.x) * softness
    const endY = p.y + (mNext.y - p.y) * softness
    path += i === 0 ? `M ${startX.toFixed(2)} ${startY.toFixed(2)}` : ` L ${startX.toFixed(2)} ${startY.toFixed(2)}`
    path += ` Q ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${endX.toFixed(2)} ${endY.toFixed(2)}`
  }
  return `${path} Z`
}

function drawFlowerPath(context: CanvasRenderingContext2D, cx: number, cy: number, r: number, petals: number, amplitude: number) {
  const points = 72
  context.beginPath()
  for (let i = 0; i <= points; i += 1) {
    const angle = (i * 2 * Math.PI) / points
    const currentR = r + amplitude * Math.cos(petals * angle)
    const x = cx + currentR * Math.cos(angle)
    const y = cy + currentR * Math.sin(angle)
    if (i === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  }
  context.closePath()
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.arcTo(x + width, y, x + width, y + height, radius)
  context.arcTo(x + width, y + height, x, y + height, radius)
  context.arcTo(x, y + height, x, y, radius)
  context.arcTo(x, y, x + width, y, radius)
  context.closePath()
}

// --- Containment math -------------------------------------------------------

export function getDescendantCircleIds(circles: Circle[], circleId: string) {
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

function getRequiredCircleRadius(circle: Circle, circles: Circle[], circlesById: Map<string, Circle>, people: Person[]) {
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

export function ensureContainment(state: GraphView): GraphView {
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

export function moveCircleSubtree(state: GraphView, circleId: string, nextX: number, nextY: number): GraphView {
  const circle = state.circles.find((candidate) => candidate.id === circleId)
  if (!circle) return state

  const deltaX = nextX - circle.x
  const deltaY = nextY - circle.y
  const subtreeIds = getDescendantCircleIds(state.circles, circleId)
  subtreeIds.add(circleId)

  return {
    circles: state.circles.map((candidate) =>
      subtreeIds.has(candidate.id) ? { ...candidate, x: candidate.x + deltaX, y: candidate.y + deltaY } : candidate,
    ),
    people: state.people.map((person) =>
      person.circleId && subtreeIds.has(person.circleId) ? { ...person, x: person.x + deltaX, y: person.y + deltaY } : person,
    ),
  }
}

export function resizeCircleFromPoint(state: GraphView, circleId: string, point: { x: number; y: number }): GraphView {
  const circle = state.circles.find((candidate) => candidate.id === circleId)
  if (!circle) return state

  const requestedRadius = Math.max(MIN_CIRCLE_RADIUS, Math.hypot(point.x - circle.x, point.y - circle.y))
  return ensureContainment({
    ...state,
    circles: state.circles.map((candidate) =>
      candidate.id === circleId ? { ...candidate, minRadius: requestedRadius, radius: requestedRadius } : candidate,
    ),
  })
}

// Smallest circle (by radius) that contains the given world point — used to decide
// which zone a dropped person joins.
export function findContainingCircleId(circles: Circle[], point: { x: number; y: number }): string | null {
  let bestId: string | null = null
  let bestRadius = Infinity
  for (const circle of circles) {
    const dist = Math.hypot(point.x - circle.x, point.y - circle.y)
    if (dist <= circle.radius && circle.radius < bestRadius) {
      bestId = circle.id
      bestRadius = circle.radius
    }
  }
  return bestId
}

// --- Canvas sprite renderer -------------------------------------------------

const SPRITE_COLORS = ['#00629D', '#C00015', '#1E824A', '#D87A00', '#7F67BE', '#0F766E', '#4F46E5', '#BE185D', '#0891B2']

export function createSprites() {
  return SPRITE_COLORS.map((color, index) => {
    const canvas = document.createElement('canvas')
    const size = 64
    const context = canvas.getContext('2d')
    canvas.width = size
    canvas.height = size
    if (!context) return canvas

    context.fillStyle = color
    drawFlowerPath(context, size / 2, size / 2, 25, 6, 5)
    context.fill()
    context.strokeStyle = '#ffffff'
    context.lineWidth = 4
    context.stroke()

    context.fillStyle = '#ffffff'
    context.font = '900 18px Inter, system-ui, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(SPRITE_INITIALS[index % SPRITE_INITIALS.length], size / 2, size / 2 + 1)

    return canvas
  })
}

const SPRITE_INITIALS = ['AL', 'BD', 'CE', 'DK', 'EV', 'FX', 'GN', 'HM', 'IR']

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function makeAvatar(index: number) {
  return SPRITE_INITIALS[index % SPRITE_INITIALS.length]
}

export type DrawPeopleOptions = {
  showLabels: boolean
  showEdges: boolean
  highlightedIds?: Set<string> | null
  dimUnhighlighted?: boolean
  selectedId?: string | null
}

// Renders people as cached sprites with viewport culling. Coordinates are world
// space; `camera` maps world → CSS pixels via translate(camera.x,camera.y) scale(camera.scale).
export function drawPeopleCanvas(
  canvas: HTMLCanvasElement,
  surface: HTMLElement,
  camera: Camera,
  people: Person[],
  circlesById: Map<string, Circle>,
  sprites: HTMLCanvasElement[],
  options: DrawPeopleOptions,
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
  const width = Math.max(1, surface.clientWidth)
  const height = Math.max(1, surface.clientHeight)

  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }

  const context = canvas.getContext('2d')
  if (!context) return

  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, width, height)
  if (people.length === 0) return

  const padding = (options.showLabels ? 120 : 48) / camera.scale
  const viewport = {
    left: (0 - camera.x) / camera.scale - padding,
    right: (width - camera.x) / camera.scale + padding,
    top: (0 - camera.y) / camera.scale - padding,
    bottom: (height - camera.y) / camera.scale + padding,
  }
  const visiblePeople = people.filter(
    (person) =>
      person.x >= viewport.left && person.x <= viewport.right && person.y >= viewport.top && person.y <= viewport.bottom,
  )

  context.save()
  context.translate(camera.x, camera.y)
  context.scale(camera.scale, camera.scale)

  if (options.showEdges) {
    context.beginPath()
    context.strokeStyle = 'rgba(116, 126, 132, 0.16)'
    context.lineWidth = Math.max(0.7 / camera.scale, 0.45)
    for (const person of visiblePeople) {
      if (!person.circleId) continue
      const circle = circlesById.get(person.circleId)
      if (!circle) continue
      context.moveTo(circle.x, circle.y)
      context.lineTo(person.x, person.y)
    }
    context.stroke()
  }

  const highlighted = options.highlightedIds
  const dim = options.dimUnhighlighted && highlighted && highlighted.size > 0
  const iconSize = options.showLabels ? 30 : 28
  const halfIcon = iconSize / 2

  for (const person of visiblePeople) {
    const sprite = sprites[hashString(person.id) % sprites.length]
    context.globalAlpha = dim && !highlighted!.has(person.id) ? 0.18 : 1
    context.drawImage(sprite, person.x - halfIcon, person.y - halfIcon, iconSize, iconSize)
  }
  context.globalAlpha = 1

  if (options.selectedId) {
    const selected = visiblePeople.find((person) => person.id === options.selectedId)
    if (selected) {
      context.beginPath()
      context.strokeStyle = '#8affd6'
      context.lineWidth = 3 / camera.scale
      context.arc(selected.x, selected.y, halfIcon + 6, 0, Math.PI * 2)
      context.stroke()
    }
  }

  if (options.showLabels) {
    context.font = `${Math.max(10 / camera.scale, 8)}px Inter, system-ui, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'top'
    for (const person of visiblePeople) {
      const labelWidth = context.measureText(person.name).width + 12 / camera.scale
      const x = person.x - labelWidth / 2
      const y = person.y + 19
      context.fillStyle = 'rgba(255, 255, 255, 0.86)'
      roundRect(context, x, y, labelWidth, 18 / camera.scale, 5 / camera.scale)
      context.fill()
      context.fillStyle = '#1c2528'
      context.fillText(person.name, person.x, y + 4 / camera.scale)
    }
  }

  context.restore()
}

// Nearest person to a world point within the hit radius (scaled to world units).
export function findPersonAtPoint(people: Person[], point: { x: number; y: number }, scale: number): Person | null {
  const hitRadius = PERSON_HIT_RADIUS / scale
  let best: Person | null = null
  let bestDist = hitRadius
  for (const person of people) {
    const dist = Math.hypot(person.x - point.x, person.y - point.y)
    if (dist <= bestDist) {
      best = person
      bestDist = dist
    }
  }
  return best
}

// Synthetic, in-memory people for the local render stress test (never persisted).
export function generateStressPeople(count: number, circleId: string): Person[] {
  const people: Person[] = []
  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.399963229728653
    const ring = Math.floor(Math.sqrt(index))
    const radius = 185 + ring * 15
    const jitter = (seededRandom(index + 11) - 0.5) * 18
    people.push({
      id: `stress-${index}`,
      name: `Stress ${index + 1}`,
      x: Math.cos(angle) * (radius + jitter),
      y: Math.sin(angle) * (radius + jitter),
      circleId,
      avatar: makeAvatar(index),
    })
  }
  return people
}
