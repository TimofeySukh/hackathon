// Board canvas engine: the spatial index (cell-hash + queries), pointer hit-testing,
// and the entire Canvas 2D rendering layer. Pure functions over a BoardIndex /
// GraphState — no React, no component state. App.tsx calls createBoardIndex,
// hitTestBoard, readAnimFrame and drawBoardLayer; everything else is internal.

import type {
  AnimFrame,
  BoardAnim,
  BoardHit,
  CircleMorph,
  BoardIndex,
  Camera,
  CircleFillMode,
  CircleNode,
  CircleShapeMode,
  Connection,
  DragConnector,
  MarqueeState,
  PersonNode,
  SelectedItem,
  ShapeType,
  WorldRect,
} from './types'
import {
  BOARD_GRID_SIZE,
  CIRCLE_LINK_CONNECTION_PREFIX,
  CIRCLE_CENTER_RADIUS,
  EDGE_RESIZE_HIT_SIZE,
  EMPTY_ANIM_FRAME,
  HANDLE_HIT_RADIUS,
  MEMBERSHIP_CONNECTION_PREFIX,
  MATERIAL_TONES,
  PERSON_VISUAL_RADIUS,
  ZONE_ONLY_SCALE,
} from './constants'
import { colorMix, getCircleColors } from './colors'
import {
  distanceToCurvePath,
  drawCurvePath,
  ellipsize,
  getNodePath,
  outlinePath,
  roundedRect,
  sampleCircleOutline,
} from './geometry'
import { makeInitials } from './text'

const personSpriteCache = new Map<string, HTMLCanvasElement>()
const imageCache = new Map<string, HTMLImageElement>()
const SPRITE_TIERS = [64, 128, 256]
const MAX_CIRCLE_PATH_CACHE_SIZE = 20000
const circlePathCache = new Map<string, Path2D>()
const customConnCandidates = new Map<string, Connection>()
const stressBatch: { source: { x: number; y: number }; target: { x: number; y: number } }[] = []
const normalBatch: { source: { x: number; y: number }; target: { x: number; y: number } }[] = []
const hoveredBatch: { source: { x: number; y: number }; target: { x: number; y: number } }[] = []
const selectedBatch: { source: { x: number; y: number }; target: { x: number; y: number } }[] = []
const drawnCircleEdges = new Set<string>()
const drawnPersonEdges = new Set<string>()

function pickSpriteTier(screenPx: number): number {
  for (const tier of SPRITE_TIERS) {
    if (tier >= screenPx) return tier
  }
  return SPRITE_TIERS[SPRITE_TIERS.length - 1]
}

function cellRange(min: number, max: number) {
  return {
    from: Math.floor(min / BOARD_GRID_SIZE),
    to: Math.floor(max / BOARD_GRID_SIZE),
  }
}

function cellKey(x: number, y: number) {
  return `${x},${y}`
}

function pushCell<T>(map: Map<string, T[]>, x: number, y: number, item: T) {
  const key = cellKey(x, y)
  const existing = map.get(key)
  if (existing) existing.push(item)
  else map.set(key, [item])
}

export function createBoardIndex(circles: CircleNode[], people: PersonNode[], connections: Connection[]): BoardIndex {
  const peopleByCell = new Map<string, PersonNode[]>()
  const circlesByCell = new Map<string, CircleNode[]>()
  const connectionsByEndpoint = new Map<string, Connection[]>()
  const circleChildren = new Map<string, CircleNode[]>()

  for (const person of people) {
    const x = Math.floor(person.x / BOARD_GRID_SIZE)
    const y = Math.floor(person.y / BOARD_GRID_SIZE)
    pushCell(peopleByCell, x, y, person)
  }

  for (const circle of circles) {
    const xs = cellRange(circle.x - circle.radius, circle.x + circle.radius)
    const ys = cellRange(circle.y - circle.radius, circle.y + circle.radius)
    for (let x = xs.from; x <= xs.to; x += 1) {
      for (let y = ys.from; y <= ys.to; y += 1) {
        pushCell(circlesByCell, x, y, circle)
      }
    }
    if (circle.connectedTo) {
      const siblings = circleChildren.get(circle.connectedTo)
      if (siblings) siblings.push(circle)
      else circleChildren.set(circle.connectedTo, [circle])
    }
  }

  for (const connection of connections) {
    const a = connectionsByEndpoint.get(connection.fromId)
    if (a) a.push(connection)
    else connectionsByEndpoint.set(connection.fromId, [connection])
    const b = connectionsByEndpoint.get(connection.toId)
    if (b) b.push(connection)
    else connectionsByEndpoint.set(connection.toId, [connection])
  }

  return {
    circles,
    people,
    connections,
    circlesById: new Map(circles.map((circle) => [circle.id, circle])),
    peopleById: new Map(people.map((person) => [person.id, person])),
    peopleByCell,
    circlesByCell,
    connectionsByEndpoint,
    circleChildren,
  }
}

function queryGrid<T extends { id: string }>(map: Map<string, T[]>, rect: WorldRect) {
  const found = new Map<string, T>()
  const xs = cellRange(rect.left, rect.right)
  const ys = cellRange(rect.top, rect.bottom)
  for (let x = xs.from; x <= xs.to; x += 1) {
    for (let y = ys.from; y <= ys.to; y += 1) {
      const bucket = map.get(cellKey(x, y))
      if (!bucket) continue
      for (const item of bucket) found.set(item.id, item)
    }
  }
  return [...found.values()]
}

function queryPeople(index: BoardIndex, rect: WorldRect) {
  return queryGrid(index.peopleByCell, rect).filter(
    (person) => person.x >= rect.left && person.x <= rect.right && person.y >= rect.top && person.y <= rect.bottom,
  )
}

function queryCircles(index: BoardIndex, rect: WorldRect) {
  return queryGrid(index.circlesByCell, rect).filter(
    (circle) =>
      circle.x + circle.radius >= rect.left &&
      circle.x - circle.radius <= rect.right &&
      circle.y + circle.radius >= rect.top &&
      circle.y - circle.radius <= rect.bottom,
  )
}

function cameraWorldRect(surface: HTMLElement, camera: Camera, padPx = 120): WorldRect {
  const width = Math.max(1, surface.clientWidth)
  const height = Math.max(1, surface.clientHeight)
  const pad = padPx / camera.scale
  return {
    left: -camera.x / camera.scale - pad,
    right: (width - camera.x) / camera.scale + pad,
    top: -camera.y / camera.scale - pad,
    bottom: (height - camera.y) / camera.scale + pad,
  }
}

// Set by App via setBoardRepaintCallback so freshly-decoded images can trigger a
// repaint (otherwise an avatar only appears after the next interaction redraw).
let requestBoardRepaint: (() => void) | null = null

export function setBoardRepaintCallback(fn: (() => void) | null) {
  requestBoardRepaint = fn
}

function getCanvasImage(src: string): HTMLImageElement | null {
  const cached = imageCache.get(src)
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null
  const image = new Image()
  image.onload = () => {
    // Cached person sprites were baked without the image; drop them so they redraw.
    personSpriteCache.clear()
    requestBoardRepaint?.()
  }
  image.onerror = () => {
    personSpriteCache.clear()
    requestBoardRepaint?.()
  }
  image.src = src
  imageCache.set(src, image)
  return image.complete && image.naturalWidth > 0 ? image : null
}

function drawPersonInitials(ctx: CanvasRenderingContext2D, avatar: string, size: number, scale: number) {
  ctx.fillStyle = '#ffffff'
  ctx.font = `500 ${(11 * scale).toFixed(1)}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(avatar, size / 2, size / 2 + scale)
}

// Draw `image` filling the dest box while preserving aspect ratio (CSS object-fit:
// cover) — centred crop. Avoids the squashed look of stretching to a square.
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  dx: number,
  dy: number,
  dWidth: number,
  dHeight: number,
) {
  const iw = image.naturalWidth || image.width
  const ih = image.naturalHeight || image.height
  if (!iw || !ih) return
  const scale = Math.max(dWidth / iw, dHeight / ih)
  const sw = dWidth / scale
  const sh = dHeight / scale
  const sx = (iw - sw) / 2
  const sy = (ih - sh) / 2
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dWidth, dHeight)
}

function getPersonSprite(person: PersonNode, fillColor: string, size: number, stroke: string, strokeWidth: number): HTMLCanvasElement {
  // Always derive the letters from the current name so they stay in sync with any rename.
  const avatar = makeInitials(person.name)
  const imageKey = person.imageUrl ? `img:${person.imageUrl}` : avatar
  const key = `${fillColor}|${imageKey}|${person.shapeType ?? 'wavy'}|${person.sides ?? 8}|${person.amplitude ?? 1}|${stroke}|${strokeWidth}|${size}`
  const cached = personSpriteCache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const scale = size / 40
  const path = new Path2D(getNodePath(20 * scale, 20 * scale, 18 * scale, person.shapeType ?? 'wavy', person.sides ?? 8, (person.amplitude ?? 1) * scale))
  ctx.save()
  ctx.fillStyle = fillColor
  ctx.strokeStyle = stroke
  ctx.lineWidth = strokeWidth * scale
  ctx.stroke(path)
  ctx.fill(path)

  if (person.imageUrl) {
    const image = getCanvasImage(person.imageUrl)
    if (image) {
      ctx.clip(path)
      drawImageCover(ctx, image, 0, 0, size, size)
    } else {
      drawPersonInitials(ctx, avatar, size, scale)
    }
  } else {
    drawPersonInitials(ctx, avatar, size, scale)
  }
  ctx.restore()

  personSpriteCache.set(key, canvas)
  return canvas
}

function drawFavoritePersonOutline(ctx: CanvasRenderingContext2D, person: PersonNode, color: string, scale: number) {
  const radius = PERSON_VISUAL_RADIUS + 7 / scale
  const dotCount = 18
  const haloRadius = Math.max(2.5 / scale, 1.6)
  ctx.save()
  for (let i = 0; i < dotCount; i += 1) {
    const angle = (Math.PI * 2 * i) / dotCount - Math.PI / 2
    const x = person.x + Math.cos(angle) * radius
    const y = person.y + Math.sin(angle) * radius
    ctx.beginPath()
    ctx.arc(x, y, haloRadius, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }
  ctx.restore()
}

function resizeCanvas(canvas: HTMLCanvasElement, surface: HTMLElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
  const width = Math.max(1, surface.clientWidth)
  const height = Math.max(1, surface.clientHeight)
  const nextWidth = Math.round(width * dpr)
  const nextHeight = Math.round(height * dpr)
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth
    canvas.height = nextHeight
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }
  return { dpr, width, height }
}

// ---- Board animation frame -------------------------------------------------
// The board normally repaints only when state changes. While a pulse/pop is in
// flight a transient rAF loop drives extra repaints and hands each draw an
// AnimFrame describing the current progress of every effect. An empty frame
// means fully settled (EMPTY_ANIM_FRAME) — that's the default for ordinary static
// repaints, so the gesture/drag paths can keep calling drawBoardLayer with nothing.
// BoardAnim / AnimFrame / EMPTY_ANIM_FRAME live in lib/board/{types,constants}.

// Slight overshoot so a freshly created node grows past full size then settles.
const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

// Decelerating ease for shape morphs: fast start, soft settle.
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export function readAnimFrame(anims: Map<string, BoardAnim>, now: number): AnimFrame {
  if (anims.size === 0) return EMPTY_ANIM_FRAME
  const scales = new Map<string, number>()
  const morphs = new Map<string, CircleMorph & { t: number }>()
  for (const [key, a] of anims) {
    // start < 0 means "not yet anchored to the rAF clock" → treat as just begun.
    const t = a.start < 0 ? 0 : Math.min(1, Math.max(0, (now - a.start) / a.duration))
    if (key.startsWith('pop:')) {
      // Grow-in for freshly created nodes: 0 -> slight overshoot -> 1.
      scales.set(key.slice(4), Math.max(0, easeOutBack(t)))
    } else if (key.startsWith('morph:') && a.morph) {
      // Smoothly morph a circle's shape (sides and/or amplitude).
      morphs.set(key.slice(6), { ...a.morph, t: easeOutCubic(t) })
    }
  }
  return { scales, morphs }
}

export function drawBoardLayer(
  canvas: HTMLCanvasElement,
  surface: HTMLElement,
  camera: Camera,
  index: BoardIndex,
  selectedItem: SelectedItem,
  hoveredPersonId: string | null,
  hoveredConnId: string | null,
  connector: DragConnector | null,
  showCircleLabels: boolean,
  showPersonLabels: boolean,
  circleShapeMode: CircleShapeMode,
  circleFillMode: CircleFillMode,
  selectedPeopleIds: string[] = [],
  marquee: MarqueeState | null = null,
  selectedCircleIds: string[] = [],
  hoveredCircleEdgeId: string | null = null,
  anim: AnimFrame = EMPTY_ANIM_FRAME,
) {
  const { dpr, width, height } = resizeCanvas(canvas, surface)
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)

  const worldRect = cameraWorldRect(surface, camera)
  const visibleCircles = queryCircles(index, worldRect)
  const visiblePeople = queryPeople(index, worldRect)
  const visibleCircleIds = new Set(visibleCircles.map((circle) => circle.id))
  const visiblePeopleIds = new Set(visiblePeople.map((person) => person.id))

  ctx.save()
  ctx.translate(camera.x, camera.y)
  ctx.scale(camera.scale, camera.scale)

  drawCircleFills(ctx, visibleCircles, selectedItem, camera.scale, circleShapeMode, circleFillMode, selectedCircleIds, hoveredCircleEdgeId, anim.morphs)

  if (camera.scale < ZONE_ONLY_SCALE) {
    // Far-zoom simplified view: only the colored zones and the labels of the
    // ones still large enough on screen to read. Everything else is hidden.
    if (showCircleLabels) {
      for (const circle of visibleCircles) {
        if (circle.radius * camera.scale >= 26) drawCircleLabel(ctx, circle, camera.scale, true)
      }
    }
  } else {
    drawCircleEdges(ctx, visibleCircles, index, camera.scale, selectedItem, hoveredConnId)
    drawPersonEdges(ctx, visiblePeople, index, camera.scale, selectedItem, hoveredConnId)
    drawCustomConnections(ctx, visiblePeopleIds, visibleCircleIds, index, selectedItem, hoveredConnId, camera.scale)
    drawCircleDetails(ctx, visibleCircles, camera.scale, circleFillMode, showCircleLabels, anim.scales)
    drawPeople(ctx, visiblePeople, index, selectedItem, hoveredPersonId, camera.scale, dpr, showPersonLabels, selectedPeopleIds, anim.scales)
    if (connector) drawConnector(ctx, connector, camera.scale)
    drawSelectionHandles(ctx, selectedItem, index, camera.scale)
  }

  ctx.restore()

  if (marquee) {
    ctx.save()
    ctx.strokeStyle = '#00629d'
    ctx.lineWidth = 1.5
    ctx.fillStyle = 'rgba(0, 98, 157, 0.08)'
    const rect = canvas.getBoundingClientRect()
    const x = Math.min(marquee.startX, marquee.currentX) - rect.left
    const y = Math.min(marquee.startY, marquee.currentY) - rect.top
    const w = Math.abs(marquee.startX - marquee.currentX)
    const h = Math.abs(marquee.startY - marquee.currentY)
    ctx.strokeRect(x, y, w, h)
    ctx.fillRect(x, y, w, h)
    ctx.restore()
  }
}

function drawCircleEdges(
  ctx: CanvasRenderingContext2D,
  circles: CircleNode[],
  index: BoardIndex,
  scale: number,
  selectedItem: SelectedItem,
  hoveredConnId: string | null,
) {
  ctx.beginPath()
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.24)'
  ctx.lineWidth = Math.max(1.6 / scale, 0.8)
  // An edge is drawn if EITHER endpoint is on-screen: walk each visible circle
  // both as the child (its connectedTo source may be off-screen) and as the
  // parent (its children may be off-screen). The `drawn` set dedupes edges
  // whose two endpoints are both visible. Edge identity == the child circle id.
  const drawn = drawnCircleEdges
  drawn.clear()
  const addEdge = (child: CircleNode) => {
    if (drawn.has(child.id)) return
    const source = child.connectedTo ? index.circlesById.get(child.connectedTo) : null
    if (!source) return
    if (source.id === 'you') return
    drawn.add(child.id)
    const virtualId = `${CIRCLE_LINK_CONNECTION_PREFIX}${child.id}`
    if (selectedItem?.type === 'connection' && selectedItem.id === virtualId) return
    if (hoveredConnId === virtualId) return
    drawCurvePath(ctx, source, child)
  }
  for (const circle of circles) {
    addEdge(circle)
    const children = index.circleChildren.get(circle.id)
    if (children) for (const child of children) addEdge(child)
  }
  ctx.stroke()

  for (const circle of circles) {
    drawHighlightedCircleLink(ctx, circle, index, scale, selectedItem, hoveredConnId)
    const children = index.circleChildren.get(circle.id)
    if (children) for (const child of children) drawHighlightedCircleLink(ctx, child, index, scale, selectedItem, hoveredConnId)
  }
}

function drawHighlightedCircleLink(
  ctx: CanvasRenderingContext2D,
  child: CircleNode,
  index: BoardIndex,
  scale: number,
  selectedItem: SelectedItem,
  hoveredConnId: string | null,
) {
  const virtualId = `${CIRCLE_LINK_CONNECTION_PREFIX}${child.id}`
  const isSelected = selectedItem?.type === 'connection' && selectedItem.id === virtualId
  const isHovered = hoveredConnId === virtualId
  if (!isSelected && !isHovered) return
  const source = child.connectedTo ? index.circlesById.get(child.connectedTo) : null
  if (!source || source.id === 'you') return
  ctx.save()
  ctx.beginPath()
  ctx.strokeStyle = isSelected ? '#00629d' : '#64748b'
  ctx.lineWidth = Math.max((isSelected ? 4 : 3) / scale, isSelected ? 2 : 1.5)
  drawCurvePath(ctx, source, child)
  ctx.stroke()
  ctx.restore()
}

function drawPersonEdges(
  ctx: CanvasRenderingContext2D,
  people: PersonNode[],
  index: BoardIndex,
  scale: number,
  selectedItem: SelectedItem,
  hoveredConnId: string | null,
) {
  ctx.beginPath()
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.16)'
  ctx.lineWidth = Math.max(1.15 / scale, 0.7)
  // Draw membership edges only for people in the viewport. A visible imported
  // company circle can otherwise fan out to thousands of offscreen contacts on
  // every repaint.
  const drawn = drawnPersonEdges
  drawn.clear()
  const addEdge = (person: PersonNode) => {
    if (drawn.has(person.id)) return
    const circle = index.circlesById.get(person.circleId)
    if (!circle) return
    drawn.add(person.id)
    const virtualId = `${MEMBERSHIP_CONNECTION_PREFIX}${person.id}`
    if (selectedItem?.type === 'connection' && selectedItem.id === virtualId) return
    if (hoveredConnId === virtualId) return
    ctx.moveTo(circle.x, circle.y)
    ctx.lineTo(person.x, person.y)
  }
  for (const person of people) addEdge(person)
  ctx.stroke()

  for (const person of people) {
    const virtualId = `${MEMBERSHIP_CONNECTION_PREFIX}${person.id}`
    const isSelected = selectedItem?.type === 'connection' && selectedItem.id === virtualId
    const isHovered = hoveredConnId === virtualId
    if (!isSelected && !isHovered) continue
    const circle = index.circlesById.get(person.circleId)
    if (!circle) continue
    ctx.save()
    ctx.beginPath()
    ctx.strokeStyle = isSelected ? '#00629d' : '#64748b'
    ctx.lineWidth = Math.max((isSelected ? 4 : 3) / scale, isSelected ? 2 : 1.5)
    ctx.moveTo(circle.x, circle.y)
    ctx.lineTo(person.x, person.y)
    ctx.stroke()
    ctx.restore()
  }
}

function drawCustomConnections(
  ctx: CanvasRenderingContext2D,
  visiblePeopleIds: Set<string>,
  visibleCircleIds: Set<string>,
  index: BoardIndex,
  selectedItem: SelectedItem,
  hoveredConnId: string | null,
  scale: number,
) {
  const candidates = customConnCandidates
  candidates.clear()
  for (const id of visiblePeopleIds) {
    const bucket = index.connectionsByEndpoint.get(id)
    if (bucket) for (const conn of bucket) candidates.set(conn.id, conn)
  }
  for (const id of visibleCircleIds) {
    const bucket = index.connectionsByEndpoint.get(id)
    if (bucket) for (const conn of bucket) candidates.set(conn.id, conn)
  }

  stressBatch.length = 0
  normalBatch.length = 0
  hoveredBatch.length = 0
  selectedBatch.length = 0

  for (const conn of candidates.values()) {
    const source = index.peopleById.get(conn.fromId) || index.circlesById.get(conn.fromId)
    const target = index.peopleById.get(conn.toId) || index.circlesById.get(conn.toId)
    if (!source || !target) continue
    const isSelected = selectedItem?.type === 'connection' && selectedItem.id === conn.id
    const isHovered = hoveredConnId === conn.id
    if (isSelected) {
      selectedBatch.push({ source, target })
    } else if (isHovered) {
      hoveredBatch.push({ source, target })
    } else if (conn.id.startsWith('stress-link-')) {
      stressBatch.push({ source, target })
    } else {
      normalBatch.push({ source, target })
    }
  }

  if (stressBatch.length > 0) {
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.30)'
    ctx.lineWidth = Math.max(1.6 / scale, 0.55)
    for (const pair of stressBatch) drawCurvePath(ctx, pair.source, pair.target)
    ctx.stroke()
  }

  if (normalBatch.length > 0) {
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)'
    ctx.lineWidth = Math.max(1.6 / scale, 0.55)
    for (const pair of normalBatch) drawCurvePath(ctx, pair.source, pair.target)
    ctx.stroke()
  }

  if (hoveredBatch.length > 0) {
    ctx.beginPath()
    ctx.strokeStyle = '#64748b'
    ctx.lineWidth = Math.max(3 / scale, 1.5)
    for (const pair of hoveredBatch) drawCurvePath(ctx, pair.source, pair.target)
    ctx.stroke()
  }

  if (selectedBatch.length > 0) {
    ctx.beginPath()
    ctx.strokeStyle = '#00629d'
    ctx.lineWidth = Math.max(4 / scale, 2)
    for (const pair of selectedBatch) drawCurvePath(ctx, pair.source, pair.target)
    ctx.stroke()
  }
}

function drawCircleFills(
  ctx: CanvasRenderingContext2D,
  circles: CircleNode[],
  selectedItem: SelectedItem,
  scale: number,
  circleShapeMode: CircleShapeMode,
  circleFillMode: CircleFillMode,
  selectedCircleIds: string[] = [],
  hoveredCircleEdgeId: string | null = null,
  morphs: Map<string, CircleMorph & { t: number }> = EMPTY_ANIM_FRAME.morphs,
) {
  for (const circle of circles) {
    const tone = getCircleColors(circle)
    const isTransparent = (circle.fillMode ?? circleFillMode) === 'transparent'
    const path = getCirclePath(circle, circleShapeMode, morphs.get(circle.id))
    ctx.save()
    ctx.globalAlpha = isTransparent ? 0.34 : 1
    ctx.fillStyle = tone.fill
    ctx.fill(path)
    ctx.restore()

    const isSelected = (selectedItem?.type === 'circle' && selectedItem.id === circle.id) || selectedCircleIds.includes(circle.id)
    const isEdgeHovered = hoveredCircleEdgeId === circle.id

    if (isEdgeHovered) {
      ctx.save()
      ctx.strokeStyle = isSelected ? tone.border : '#64748b'
      ctx.globalAlpha = isSelected ? 0.24 : 0.18
      ctx.lineWidth = isSelected ? Math.max(9 / scale, 6) : Math.max(8 / scale, 5)
      if (isTransparent && !isSelected) ctx.setLineDash([8 / scale, 7 / scale])
      ctx.stroke(path)
      ctx.restore()
    }

    if (isTransparent || isSelected || isEdgeHovered) {
      ctx.save()
      ctx.strokeStyle = isSelected ? tone.border : isEdgeHovered ? '#64748b' : tone.border
      ctx.lineWidth =
        isSelected
          ? (isEdgeHovered ? Math.max(4.5 / scale, 3) : Math.max(3.5 / scale, 2))
          : isEdgeHovered
            ? Math.max(2.8 / scale, 1.8)
            : Math.max((isTransparent ? 2.2 : 1.4) / scale, isTransparent ? 1.4 : 0.9)
      if (isTransparent && !isSelected) ctx.setLineDash([8 / scale, 7 / scale])
      ctx.stroke(path)
      ctx.restore()
    }
  }
}

function getCirclePath(
  circle: CircleNode,
  circleShapeMode: CircleShapeMode,
  morph?: CircleMorph & { t: number },
): Path2D {
  if (morph) {
    return new Path2D(getCircleRenderPath(circle, circleShapeMode, morph))
  }
  const amplitude = circle.amplitude ?? 0
  const sides = circle.sides ?? 25
  const shapeType: ShapeType = circle.shapeType ?? (amplitude > 0 ? 'wavy' : sides >= 25 ? 'circle' : 'polygon')
  const isCustomShape = circle.shapeCustom === true && (shapeType !== 'circle' || amplitude > 0 || sides < 25)
  const shapeModeVal = circleShapeMode === 'circles' && !isCustomShape ? 'circles' : 'custom'
  
  const key = `${circle.id}|${circle.x}|${circle.y}|${circle.radius}|${sides}|${amplitude}|${shapeType}|${shapeModeVal}`
  let cached = circlePathCache.get(key)
  if (!cached) {
    if (circlePathCache.size > MAX_CIRCLE_PATH_CACHE_SIZE) {
      circlePathCache.clear()
    }
    cached = getCircleRenderPath(circle, circleShapeMode, undefined)
    circlePathCache.set(key, cached)
  }
  return cached
}

function drawCircleDetails(
  ctx: CanvasRenderingContext2D,
  circles: CircleNode[],
  scale: number,
  circleFillMode: CircleFillMode,
  showCircleLabels: boolean,
  scales: Map<string, number> = EMPTY_ANIM_FRAME.scales,
) {
  for (const circle of circles) {
    if (showCircleLabels) drawCircleLabel(ctx, circle, scale)
    drawCircleCenter(ctx, circle, scale, circleFillMode, scales.get(circle.id) ?? 1)
  }
}

function getCircleRenderPath(
  circle: CircleNode,
  circleShapeMode: CircleShapeMode,
  morph?: CircleMorph & { t: number },
): Path2D {
  // Smooth-enough point count; from/to use the same count so points correspond.
  const n = Math.max(120, Math.round(circle.radius * 2))

  // Mid-morph: lerp between the from-shape and to-shape sampled at matching
  // points (works across different side counts without a seam).
  if (morph) {
    const from = sampleCircleOutline(circle.x, circle.y, circle.radius, morph.fromSides, morph.fromAmp, n, morph.fromShapeType)
    const to = sampleCircleOutline(circle.x, circle.y, circle.radius, morph.toSides, morph.toAmp, n, morph.toShapeType)
    for (let i = 0; i < n; i++) {
      from[i].x += (to[i].x - from[i].x) * morph.t
      from[i].y += (to[i].y - from[i].y) * morph.t
    }
    return new Path2D(outlinePath(from))
  }

  const amplitude = circle.amplitude ?? 0
  const sides = circle.sides ?? 25
  const shapeType: ShapeType = circle.shapeType ?? (amplitude > 0 ? 'wavy' : sides >= 25 ? 'circle' : 'polygon')
  const isCustomShape = circle.shapeCustom === true && (shapeType !== 'circle' || amplitude > 0 || sides < 25)
  // "circles" mode keeps *untouched* circles as clean circles (so a fresh board
  // never shows stray shapes), but always honors a shape the user explicitly set.
  if ((circleShapeMode === 'circles' && !isCustomShape) || (shapeType === 'circle' && amplitude === 0 && sides >= 25)) {
    const path = new Path2D()
    path.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2)
    return path
  }
  return new Path2D(outlinePath(sampleCircleOutline(circle.x, circle.y, circle.radius, sides, amplitude, n, shapeType)))
}

function drawCircleCenter(ctx: CanvasRenderingContext2D, circle: CircleNode, _scale: number, circleFillMode: CircleFillMode, nodeScale = 1) {
  const tone = getCircleColors(circle)
  const radius = CIRCLE_CENTER_RADIUS * nodeScale
  ctx.save()
  ctx.beginPath()
  ctx.arc(circle.x, circle.y, radius, 0, Math.PI * 2)
  ctx.fillStyle = tone.centerBg
  ctx.globalAlpha = (circle.fillMode ?? circleFillMode) === 'transparent' ? 0.92 : 1
  ctx.fill()

  const image = circle.imageUrl ? getCanvasImage(circle.imageUrl) : null
  if (image) {
    ctx.globalAlpha = 1
    ctx.clip()
    drawImageCover(ctx, image, circle.x - radius, circle.y - radius, radius * 2, radius * 2)
  } else {
    ctx.fillStyle = '#ffffff'
    // Keep a deliberately-set emoji icon (e.g. flags), otherwise derive letters from the current name.
    const hasEmojiIcon = Array.from(circle.icon).some((char) => (char.codePointAt(0) ?? 0) > 127)
    const icon = hasEmojiIcon ? circle.icon : makeInitials(circle.name)
    ctx.font = hasEmojiIcon
      ? '18px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
      : '500 10px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(icon, circle.x, circle.y + (hasEmojiIcon ? 1.5 : 0.5))
  }
  ctx.restore()
}

function drawCircleLabel(ctx: CanvasRenderingContext2D, circle: CircleNode, scale: number, force = false) {
  if (!force && scale < 0.50) return
  const fontSize = 13 / scale
  ctx.save()
  ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`
  const maxWidth = 170 / scale
  const text = ellipsize(ctx, circle.name, maxWidth)
  const metrics = ctx.measureText(text)
  const width = Math.min(maxWidth, metrics.width) + 18 / scale
  const height = 24 / scale
  const x = circle.x - width / 2
  const y = circle.y + circle.radius - 41 / scale
  roundedRect(ctx, x, y, width, height, 7 / scale)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.86)'
  ctx.fill()
  ctx.strokeStyle = '#d7dcde'
  ctx.lineWidth = 1 / scale
  ctx.stroke()
  ctx.fillStyle = '#1c2528'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, circle.x, y + height / 2 + 0.5 / scale)
  ctx.restore()
}

function drawPeople(
  ctx: CanvasRenderingContext2D,
  people: PersonNode[],
  index: BoardIndex,
  selectedItem: SelectedItem,
  hoveredPersonId: string | null,
  scale: number,
  dpr: number,
  showPersonLabels: boolean,
  selectedPeopleIds: string[] = [],
  scales: Map<string, number> = EMPTY_ANIM_FRAME.scales,
) {
  const spriteRes = pickSpriteTier(PERSON_VISUAL_RADIUS * 2 * scale * dpr)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  for (const person of people) {
    const circle = index.circlesById.get(person.circleId)
    const circleColor = circle ? getCircleColors(circle).centerBg : MATERIAL_TONES.blue.centerBg
    const isSingleSelected = selectedItem?.type === 'person' && selectedItem.id === person.id
    const isMarqueeSelected = selectedPeopleIds.includes(person.id)
    const isSelected = isSingleSelected || isMarqueeSelected
    const isHovered = hoveredPersonId === person.id
    const stroke = isSingleSelected ? '#00629d' : isHovered ? '#64748b' : circleColor
    const strokeWidth = isSelected || isHovered ? 2.5 : 1.5
    // Press bounce on selection + grow-in pop for new people (1 = at rest).
    const drawRadius = PERSON_VISUAL_RADIUS * (scales.get(person.id) ?? 1)
    ctx.drawImage(
      getPersonSprite(person, circleColor, spriteRes, stroke, strokeWidth),
      person.x - drawRadius,
      person.y - drawRadius,
      drawRadius * 2,
      drawRadius * 2,
    )
    // Marquee (right-click) selection: a clear ring just outside the disc, in a
    // darker shade of the person's zone color so it reads on same-color fills.
    if (isMarqueeSelected) {
      // Small clear gap between the disc edge and the ring's *inner* edge, so the
      // ring reads as a separate selection halo rather than a border on the disc.
      const ringWidth = 2.5 / scale
      const ringGap = 1.5 / scale
      ctx.save()
      ctx.beginPath()
      ctx.arc(person.x, person.y, drawRadius + ringGap + ringWidth / 2, 0, Math.PI * 2)
      ctx.strokeStyle = colorMix(circleColor, '#000000', 0.5)
      ctx.lineWidth = ringWidth
      ctx.stroke()
      ctx.restore()
    }
    if (person.isFavorite) drawFavoritePersonOutline(ctx, person, '#ffd600', scale)
    if (showPersonLabels && (scale >= 0.70 || isSelected || isHovered)) drawPersonLabel(ctx, person, scale)
  }
}

function drawPersonLabel(ctx: CanvasRenderingContext2D, person: PersonNode, scale: number) {
  const fontSize = 11 / scale
  ctx.save()
  ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`
  const maxWidth = 90 / scale
  const text = ellipsize(ctx, person.name, maxWidth)
  const metrics = ctx.measureText(text)
  const width = Math.min(maxWidth, metrics.width) + 14 / scale
  const height = 20 / scale
  const x = person.x - width / 2
  const y = person.y + 26 / scale
  roundedRect(ctx, x, y, width, height, 6 / scale)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
  ctx.fill()
  ctx.strokeStyle = '#d7dcde'
  ctx.lineWidth = 1 / scale
  ctx.stroke()
  ctx.fillStyle = '#1c2528'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, person.x, y + height / 2 + 0.5 / scale)
  ctx.restore()
}

function drawSelectionHandles(ctx: CanvasRenderingContext2D, selectedItem: SelectedItem, index: BoardIndex, scale: number) {
  const selected = selectedItem?.type === 'person'
    ? index.peopleById.get(selectedItem.id)
    : selectedItem?.type === 'circle'
      ? index.circlesById.get(selectedItem.id)
      : null
  if (!selected) return

  let color = MATERIAL_TONES.blue.centerBg
  if (selectedItem?.type === 'circle') {
    color = getCircleColors(selected as CircleNode).centerBg
  } else if (selectedItem?.type === 'person') {
    const person = selected as PersonNode
    const circle = person.circleId ? index.circlesById.get(person.circleId) : null
    color = circle ? getCircleColors(circle).centerBg : MATERIAL_TONES.blue.centerBg
  }

  const screenRadius = 3.5 + 2.5 * Math.sqrt(scale)
  const worldRadius = screenRadius / scale

  for (const handle of connectorHandlesFor(selected)) {
    ctx.beginPath()
    ctx.arc(handle.x, handle.y, worldRadius, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.lineWidth = 2 / scale
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
  }
}

function drawConnector(ctx: CanvasRenderingContext2D, connector: DragConnector, scale: number) {
  ctx.save()
  ctx.beginPath()
  ctx.strokeStyle = '#00629d'
  ctx.lineWidth = Math.max(2 / scale, 1)
  ctx.setLineDash([7 / scale, 7 / scale])
  drawCurvePath(ctx, { x: connector.startX, y: connector.startY }, { x: connector.endX, y: connector.endY })
  ctx.stroke()
  ctx.restore()
}

function connectorHandlesFor(node: CircleNode | PersonNode) {
  const isCircle = 'radius' in node
  const radius = isCircle ? CIRCLE_CENTER_RADIUS : PERSON_VISUAL_RADIUS
  return [
    { x: node.x, y: node.y - radius - 14 },
    { x: node.x, y: node.y + radius + 14 },
    { x: node.x - radius - 14, y: node.y },
    { x: node.x + radius + 14, y: node.y },
  ]
}

export function hitTestBoard(index: BoardIndex, camera: Camera, selectedItem: SelectedItem, screen: { x: number; y: number }): BoardHit {
  const point = {
    x: (screen.x - camera.x) / camera.scale,
    y: (screen.y - camera.y) / camera.scale,
  }
  const scale = camera.scale
  const handleHit = HANDLE_HIT_RADIUS / scale

  if (scale >= ZONE_ONLY_SCALE) {
    if (selectedItem?.type === 'person') {
      const person = index.peopleById.get(selectedItem.id)
      if (person) {
        for (const handle of connectorHandlesFor(person)) {
          if (Math.hypot(point.x - handle.x, point.y - handle.y) <= handleHit) {
            return { type: 'connector-handle', sourceId: person.id, sourceType: 'person', x: person.x, y: person.y }
          }
        }
      }
    } else if (selectedItem?.type === 'circle') {
      const circle = index.circlesById.get(selectedItem.id)
      if (circle) {
        for (const handle of connectorHandlesFor(circle)) {
          if (Math.hypot(point.x - handle.x, point.y - handle.y) <= handleHit) {
            return { type: 'connector-handle', sourceId: circle.id, sourceType: 'circle', x: circle.x, y: circle.y }
          }
        }
      }
    }
  }

  const hitRect = {
    left: point.x - 28 / scale,
    right: point.x + 28 / scale,
    top: point.y - 28 / scale,
    bottom: point.y + 28 / scale,
  }

  if (scale >= ZONE_ONLY_SCALE) {
    const people = queryPeople(index, hitRect)
    let bestPerson: PersonNode | null = null
    let bestDist = (PERSON_VISUAL_RADIUS + 8 / scale) ** 2
    for (const person of people) {
      const d = (person.x - point.x) ** 2 + (person.y - point.y) ** 2
      if (d < bestDist) {
        bestDist = d
        bestPerson = person
      }
    }
    if (bestPerson) return { type: 'person', person: bestPerson }

    const connection = findConnectionNearPoint(index, point, 10 / scale)
    if (connection) return { type: 'connection', connection }
  }

  const circles = queryCircles(index, hitRect).reverse()
  for (const circle of circles) {
    const d = Math.hypot(point.x - circle.x, point.y - circle.y)
    if (scale >= ZONE_ONLY_SCALE && d <= CIRCLE_CENTER_RADIUS + 6 / scale) return { type: 'circle-center', circle }
    if (scale >= ZONE_ONLY_SCALE && Math.abs(d - circle.radius) <= EDGE_RESIZE_HIT_SIZE / scale) {
      return { type: 'circle-edge', circle }
    }
    if (d <= circle.radius) return { type: 'circle-body', circle }
  }

  return null
}

function findConnectionNearPoint(index: BoardIndex, point: { x: number; y: number }, tolerance: number) {
  let best: Connection | null = null
  let bestDist = tolerance
  const consider = (connection: Connection, source: { x: number; y: number }, target: { x: number; y: number }) => {
    const dist = distanceToCurvePath(point, source, target)
    if (dist < bestDist) {
      bestDist = dist
      best = connection
    }
  }

  for (const conn of index.connections) {
    if (conn.id.startsWith('stress-link-')) continue
    const source = index.peopleById.get(conn.fromId) || index.circlesById.get(conn.fromId)
    const target = index.peopleById.get(conn.toId) || index.circlesById.get(conn.toId)
    if (!source || !target) continue
    consider(conn, source, target)
  }

  for (const person of index.people) {
    const circle = index.circlesById.get(person.circleId)
    if (!circle) continue
    consider(
      { id: `${MEMBERSHIP_CONNECTION_PREFIX}${person.id}`, fromId: circle.id, toId: person.id },
      circle,
      person,
    )
  }

  for (const circle of index.circles) {
    if (!circle.connectedTo) continue
    const source = index.circlesById.get(circle.connectedTo)
    if (!source || source.id === 'you') continue
    consider(
      { id: `${CIRCLE_LINK_CONNECTION_PREFIX}${circle.id}`, fromId: source.id, toId: circle.id },
      source,
      circle,
    )
  }
  return best
}
