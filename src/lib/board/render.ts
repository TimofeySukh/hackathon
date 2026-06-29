// Board canvas engine: the spatial index (cell-hash + queries), pointer hit-testing,
// and the entire Canvas 2D rendering layer. Pure functions over a BoardIndex /
// GraphState — no React, no component state. App.tsx calls createBoardIndex,
// hitTestBoard, readAnimFrame and drawBoardLayer; everything else is internal.

import type {
  AnimFrame,
  BoardAnim,
  BoardHit,
  CircleMorph,
  ColorMorph,
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
  CONNECTOR_HANDLE_GAP,
  CONNECTOR_HANDLE_GAP_FAVORITE,
  EDGE_RESIZE_HIT_SIZE,
  EDGE_RESIZE_HIT_LEAVE_SIZE,
  EMPTY_ANIM_FRAME,
  FAVORITE_HALO_INSET,
  HANDLE_HIT_RADIUS,
  MEMBERSHIP_CONNECTION_PREFIX,
  MATERIAL_TONES,
  PERSON_VISUAL_RADIUS,
  RING_VERTEX_SPREAD_END,
  ZONE_ONLY_SCALE,
} from './constants'
import { colorMix, getCircleColors, lerpCircleColors } from './colors'
import {
  distanceToCurvePath,
  drawCurvePath,
  ellipsize,
  getNodePath,
  outlinePath,
  roundedRect,
  sampleCircleOutline,
  sampleCircleOutlineMorph,
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

// Slight overshoot so a freshly created node grows past full size then settles.
const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function drawFavoritePersonOutline(
  ctx: CanvasRenderingContext2D,
  person: PersonNode,
  color: string,
  drawRadius: number,
  reveal = 1,
) {
  const radius = drawRadius + FAVORITE_HALO_INSET
  const dotCount = 18
  const haloRadius = 2.5
  ctx.save()
  for (let i = 0; i < dotCount; i += 1) {
    const dotStart = i / dotCount
    const dotSpan = 1 / dotCount
    if (reveal <= dotStart) continue
    const dotT = Math.min(1, (reveal - dotStart) / dotSpan)
    const scale = Math.max(0, easeOutBack(dotT))
    const angle = (Math.PI * 2 * i) / dotCount - Math.PI / 2 + Math.PI / dotCount
    const x = person.x + Math.cos(angle) * radius
    const y = person.y + Math.sin(angle) * radius
    ctx.beginPath()
    ctx.arc(x, y, haloRadius * scale, 0, Math.PI * 2)
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

// Decelerating ease for shape morphs: fast start, soft settle.
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInCubic = (t: number) => t * t * t
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function selectionShowsHandles(selectedItem: SelectedItem | null) {
  if (!selectedItem) return false
  if (selectedItem.type === 'person') return true
  if (selectedItem.type === 'circle') return selectedItem.showHandles === true
  return false
}

export function readAnimFrame(anims: Map<string, BoardAnim>, now: number): AnimFrame {
  if (anims.size === 0) return EMPTY_ANIM_FRAME
  const scales = new Map<string, number>()
  const morphs = new Map<string, CircleMorph & { t: number }>()
  const handleReveal = new Map<string, number>()
  const favoriteReveal = new Map<string, number>()
  const favoriteTilt = new Map<string, number>()
  const ringReveal = new Map<string, number>()
  const edgeHoverReveal = new Map<string, number>()
  const colorReveal = new Map<string, ColorMorph & { t: number }>()

  for (const [key, a] of anims) {
    const t = a.start < 0 ? 0 : Math.min(1, Math.max(0, (now - a.start) / a.duration))
    if (key.startsWith('pop:')) {
      scales.set(key.slice(4), Math.max(0, easeOutBack(t)))
    } else if (key.startsWith('morph:') && a.morph) {
      morphs.set(key.slice(6), { ...a.morph, t: easeInOutCubic(t) })
    } else if (key.startsWith('handles-out:')) {
      handleReveal.set(key.slice(12), Math.max(0, 1 - easeInCubic(t)))
    } else if (key.startsWith('handles:')) {
      handleReveal.set(key.slice(8), Math.max(0, easeOutBack(t)))
    } else if (key.startsWith('favorite-out:')) {
      favoriteReveal.set(key.slice(13), Math.max(0, 1 - easeInCubic(t)))
    } else if (key.startsWith('favorite-in:')) {
      favoriteReveal.set(key.slice(12), easeOutCubic(t))
    } else if (key.startsWith('ring-out:')) {
      ringReveal.set(key.slice(9), Math.max(0, 1 - easeInCubic(t)))
    } else if (key.startsWith('ring:')) {
      ringReveal.set(key.slice(5), easeOutCubic(t))
    } else if (key.startsWith('edge-hover:')) {
      const id = key.slice(11)
      if (a.fromValue !== undefined && a.toValue !== undefined) {
        const eased = easeInOutCubic(t)
        edgeHoverReveal.set(id, a.fromValue + (a.toValue - a.fromValue) * eased)
      } else {
        edgeHoverReveal.set(id, easeOutCubic(t))
      }
    } else if (key.startsWith('color:') && a.colorMorph) {
      colorReveal.set(key.slice(6), { ...a.colorMorph, t: easeInOutCubic(t) })
    }
  }

  return { scales, morphs, handleReveal, favoriteReveal, favoriteTilt, ringReveal, edgeHoverReveal, colorReveal }
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
  anim: AnimFrame = EMPTY_ANIM_FRAME,
  handleExitNodes: Map<string, CircleNode | PersonNode> = new Map(),
  activeEdgeHoverId: string | null = null,
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

  drawCircleFills(ctx, visibleCircles, selectedItem, camera.scale, circleShapeMode, circleFillMode, selectedCircleIds, anim, activeEdgeHoverId)

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
    drawCircleDetails(ctx, visibleCircles, camera.scale, circleFillMode, showCircleLabels, anim)
    drawPeople(ctx, visiblePeople, index, selectedItem, hoveredPersonId, camera.scale, dpr, showPersonLabels, selectedPeopleIds, anim)
    if (connector) drawConnector(ctx, connector, camera.scale)
    drawSelectionHandles(ctx, selectedItem, index, anim, handleExitNodes, visiblePeople)
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
    drawCurvePath(ctx, circle, person)
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
    drawCurvePath(ctx, circle, person)
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

function resolveCircleColors(circle: CircleNode, anim: AnimFrame) {
  const blend = anim.colorReveal.get(circle.id)
  if (blend) return lerpCircleColors(blend.from, blend.to, blend.t)
  return getCircleColors(circle)
}

function drawCircleFills(
  ctx: CanvasRenderingContext2D,
  circles: CircleNode[],
  selectedItem: SelectedItem,
  scale: number,
  circleShapeMode: CircleShapeMode,
  circleFillMode: CircleFillMode,
  selectedCircleIds: string[] = [],
  anim: AnimFrame = EMPTY_ANIM_FRAME,
  activeEdgeHoverId: string | null = null,
) {
  for (const circle of circles) {
    const tone = resolveCircleColors(circle, anim)
    const isTransparent = (circle.fillMode ?? circleFillMode) === 'transparent'
    const path = getCirclePath(circle, circleShapeMode, anim.morphs.get(circle.id))
    ctx.save()
    ctx.globalAlpha = isTransparent ? 0.34 : 1
    ctx.fillStyle = tone.fill
    ctx.fill(path)
    ctx.restore()

    const isSelected = (selectedItem?.type === 'circle' && selectedItem.id === circle.id) || selectedCircleIds.includes(circle.id)
    const animHoverT = anim.edgeHoverReveal.get(circle.id)
    const edgeHoverT = animHoverT !== undefined ? animHoverT : (activeEdgeHoverId === circle.id ? 1 : 0)
    const ringAnim = anim.ringReveal.get(circle.id)
    const ringT = ringAnim !== undefined ? ringAnim : (isSelected ? 1 : 0)
    const showSelectionRing = ringT > 0.001 && (isSelected || ringAnim !== undefined)
    const isRound = isSimpleCircleShape(circle, circleShapeMode)

    // Idle transparent outline (resting dashed border) — keep visible during edge hover too.
    if (isTransparent && !showSelectionRing) {
      ctx.save()
      ctx.strokeStyle = tone.border
      ctx.lineWidth = Math.max(2.2 / scale, 1.4)
      ctx.setLineDash([8 / scale, 7 / scale])
      ctx.stroke(path)
      ctx.restore()
    }

    // Resize-edge hover — logical circle only; does not thicken the shape outline.
    if (edgeHoverT > 0.001) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2)
      ctx.strokeStyle = showSelectionRing ? tone.border : '#64748b'
      ctx.globalAlpha = 0.18 + 0.42 * edgeHoverT
      ctx.lineWidth = Math.max(2 / scale, 1.2) + edgeHoverT * Math.max(1 / scale, 0.5)
      if (isTransparent && !showSelectionRing) ctx.setLineDash([6 / scale, 5 / scale])
      ctx.stroke()
      ctx.restore()
    }

    // Selection ring — animates in and out (independent of resize hover).
    if (showSelectionRing) {
      const lineWidth = Math.max(3.5 / scale, 2)

      if (isTransparent) {
        const dashUnit = 8 / scale
        const gapUnit = dashUnit * 0.875
        const gapLen = gapUnit * (1 - ringT)
        ctx.save()
        ctx.strokeStyle = tone.border
        ctx.lineWidth = lineWidth * (0.88 + 0.12 * ringT)
        if (gapLen > 0.4 / scale) {
          ctx.setLineDash([dashUnit, gapLen])
          ctx.lineDashOffset = (1 - ringT) * dashUnit * 2
        }
        ctx.globalAlpha = 0.55 + 0.45 * ringT
        ctx.stroke(path)
        ctx.restore()
      } else if (isRound) {
        ctx.save()
        ctx.strokeStyle = tone.border
        ctx.lineWidth = lineWidth
        ctx.globalAlpha = ringT
        ctx.stroke(path)
        ctx.restore()
      } else if (ringAnim !== undefined && ringT < RING_VERTEX_SPREAD_END) {
        strokeOutlineWithVertexSpread(ctx, circle, ringT / RING_VERTEX_SPREAD_END, tone.border, lineWidth)
      } else {
        ctx.save()
        ctx.strokeStyle = tone.border
        ctx.lineWidth = lineWidth
        ctx.globalAlpha = ringAnim !== undefined ? 0.55 + 0.45 * ringT : 1
        ctx.stroke(path)
        ctx.restore()
      }
    }
  }
}

function isSimpleCircleShape(circle: CircleNode, circleShapeMode: CircleShapeMode) {
  const amplitude = circle.amplitude ?? 0
  const sides = circle.sides ?? 25
  const shapeType: ShapeType = circle.shapeType ?? (amplitude > 0 ? 'wavy' : sides >= 25 ? 'circle' : 'polygon')
  const isCustomShape = circle.shapeCustom === true && (shapeType !== 'circle' || amplitude > 0 || sides < 25)
  if (circleShapeMode === 'circles' && !isCustomShape) return true
  return shapeType === 'circle' && amplitude === 0 && sides >= 25
}

function strokeOutlineWithVertexSpread(
  ctx: CanvasRenderingContext2D,
  circle: CircleNode,
  t: number,
  strokeStyle: string,
  lineWidth: number,
) {
  if (t <= 0.001) return

  const n = Math.max(120, Math.round(circle.radius * 2))
  const amplitude = circle.amplitude ?? 0
  const sides = circle.sides ?? 8
  const shapeType: ShapeType = circle.shapeType ?? (amplitude > 0 ? 'wavy' : sides >= 25 ? 'circle' : 'polygon')
  const points = sampleCircleOutline(circle.x, circle.y, circle.radius, sides, amplitude, n, shapeType)
  const vertexCount = Math.max(3, Math.min(sides, 60))

  const arcLens: number[] = []
  let total = 0
  for (let i = 0; i < points.length; i++) {
    arcLens.push(total)
    const next = points[(i + 1) % points.length]
    total += Math.hypot(next.x - points[i].x, next.y - points[i].y)
  }

  const vertexArcs: number[] = []
  for (let v = 0; v < vertexCount; v++) {
    const idx = Math.round((v / vertexCount) * points.length) % points.length
    vertexArcs.push(arcLens[idx] ?? 0)
  }

  const spread = t * total / (2 * vertexCount)
  const covered = (dist: number) => {
    for (const v of vertexArcs) {
      const diff = Math.abs(dist - v)
      if (Math.min(diff, total - diff) <= spread + 0.001) return true
    }
    return false
  }

  ctx.save()
  ctx.beginPath()
  let drawing = false
  for (let i = 0; i < points.length; i++) {
    const segStart = arcLens[i] ?? 0
    const segEnd = i + 1 < points.length ? (arcLens[i + 1] ?? total) : total
    const mid = (segStart + segEnd) / 2
    const p = points[i]
    const next = points[(i + 1) % points.length]
    if (covered(mid)) {
      if (!drawing) {
        ctx.moveTo(p.x, p.y)
        drawing = true
      }
      ctx.lineTo(next.x, next.y)
    } else {
      drawing = false
    }
  }
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.globalAlpha = 0.55 + 0.45 * t
  ctx.stroke()
  ctx.restore()
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
  anim: AnimFrame = EMPTY_ANIM_FRAME,
) {
  for (const circle of circles) {
    if (showCircleLabels) drawCircleLabel(ctx, circle, scale)
    drawCircleCenter(ctx, circle, scale, circleFillMode, anim.scales.get(circle.id) ?? 1, anim)
  }
}

function getCircleRenderPath(
  circle: CircleNode,
  circleShapeMode: CircleShapeMode,
  morph?: CircleMorph & { t: number },
): Path2D {
  // Smooth-enough point count; from/to use the same count so points correspond.
  const n = Math.max(120, Math.round(circle.radius * 2))

  // Mid-morph: anchor-aligned spin lerp between from/to outlines.
  if (morph) {
    return new Path2D(outlinePath(sampleCircleOutlineMorph(circle.x, circle.y, circle.radius, morph, n)))
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

function drawCircleCenter(
  ctx: CanvasRenderingContext2D,
  circle: CircleNode,
  _scale: number,
  circleFillMode: CircleFillMode,
  nodeScale = 1,
  anim: AnimFrame = EMPTY_ANIM_FRAME,
) {
  const tone = resolveCircleColors(circle, anim)
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
  anim: AnimFrame = EMPTY_ANIM_FRAME,
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
    const drawRadius = PERSON_VISUAL_RADIUS * (anim.scales.get(person.id) ?? 1)
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
    const favoriteAnimReveal = anim.favoriteReveal.get(person.id)
    if (favoriteAnimReveal !== undefined) {
      if (favoriteAnimReveal > 0) {
        drawFavoritePersonOutline(ctx, person, '#ffd600', drawRadius, favoriteAnimReveal)
      }
    } else if (person.isFavorite) {
      drawFavoritePersonOutline(ctx, person, '#ffd600', drawRadius, 1)
    }
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

function drawSelectionHandles(
  ctx: CanvasRenderingContext2D,
  selectedItem: SelectedItem,
  index: BoardIndex,
  anim: AnimFrame,
  handleExitNodes: Map<string, CircleNode | PersonNode>,
  visiblePeople: PersonNode[],
) {
  const peopleById = new Map(visiblePeople.map((person) => [person.id, person]))

  const drawForNode = (
    node: CircleNode | PersonNode,
    itemType: 'circle' | 'person',
    reveal: number,
  ) => {
    if (reveal <= 0) return

    let color = MATERIAL_TONES.blue.centerBg
    if (itemType === 'circle') {
      color = getCircleColors(node as CircleNode).centerBg
    } else {
      const person = node as PersonNode
      const circle = person.circleId ? index.circlesById.get(person.circleId) : null
      color = circle ? getCircleColors(circle).centerBg : MATERIAL_TONES.blue.centerBg
    }

    const nodeScale = anim.scales.get(node.id) ?? 1
    const worldRadius = 6 * reveal
    const hasFavorite = itemType === 'person' && (node as PersonNode).isFavorite === true

    for (const handle of connectorHandlesFor(node, nodeScale, hasFavorite)) {
      const x = node.x + (handle.x - node.x) * reveal
      const y = node.y + (handle.y - node.y) * reveal
      ctx.beginPath()
      ctx.arc(x, y, worldRadius, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    }
  }

  if (selectionShowsHandles(selectedItem)) {
    const node = selectedItem!.type === 'person'
      ? index.peopleById.get(selectedItem!.id) ?? peopleById.get(selectedItem!.id)
      : index.circlesById.get(selectedItem!.id)
    if (node) {
      const reveal = anim.handleReveal.get(node.id) ?? 1
      drawForNode(node, selectedItem!.type as 'circle' | 'person', reveal)
    }
  }

  for (const [nodeId, node] of handleExitNodes) {
    if (selectedItem?.id === nodeId && selectionShowsHandles(selectedItem)) continue
    const reveal = anim.handleReveal.get(nodeId)
    if (reveal !== undefined) {
      drawForNode(node, 'radius' in node ? 'circle' : 'person', reveal)
    }
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

function connectorHandlesFor(node: CircleNode | PersonNode, nodeScale = 1, hasFavorite = false) {
  const isCircle = 'radius' in node
  const baseRadius = isCircle ? CIRCLE_CENTER_RADIUS : PERSON_VISUAL_RADIUS
  const radius = baseRadius * nodeScale
  const gap = (hasFavorite ? CONNECTOR_HANDLE_GAP_FAVORITE : CONNECTOR_HANDLE_GAP) * nodeScale
  return [
    { x: node.x, y: node.y - radius - gap },
    { x: node.x, y: node.y + radius + gap },
    { x: node.x - radius - gap, y: node.y },
    { x: node.x + radius + gap, y: node.y },
  ]
}

function findBestCircleEdge(
  circles: CircleNode[],
  point: { x: number; y: number },
  scale: number,
  hitSize = EDGE_RESIZE_HIT_SIZE / scale,
) {
  let best: CircleNode | null = null
  let bestDist = Infinity
  for (const circle of circles) {
    const d = Math.hypot(point.x - circle.x, point.y - circle.y)
    const edgeDist = Math.abs(d - circle.radius)
    if (edgeDist <= hitSize && edgeDist < bestDist) {
      bestDist = edgeDist
      best = circle
    }
  }
  return best
}

export function resolveCircleEdgeHover(
  index: BoardIndex,
  point: { x: number; y: number },
  scale: number,
  stickyEdgeId: string | null,
): string | null {
  if (scale < ZONE_ONLY_SCALE) return null

  const leaveSize = EDGE_RESIZE_HIT_LEAVE_SIZE / scale
  if (stickyEdgeId) {
    const sticky = index.circlesById.get(stickyEdgeId)
    if (sticky) {
      const d = Math.hypot(point.x - sticky.x, point.y - sticky.y)
      if (Math.abs(d - sticky.radius) <= leaveSize) return stickyEdgeId
    }
  }

  const hitRect = {
    left: point.x - 32 / scale,
    right: point.x + 32 / scale,
    top: point.y - 32 / scale,
    bottom: point.y + 32 / scale,
  }
  const edge = findBestCircleEdge(queryCircles(index, hitRect), point, scale)
  return edge?.id ?? null
}

export function hitTestBoard(
  index: BoardIndex,
  camera: Camera,
  selectedItem: SelectedItem,
  screen: { x: number; y: number },
  stickyEdgeId: string | null = null,
): BoardHit {
  const point = {
    x: (screen.x - camera.x) / camera.scale,
    y: (screen.y - camera.y) / camera.scale,
  }
  const scale = camera.scale
  const handleHit = HANDLE_HIT_RADIUS / scale

  if (scale >= ZONE_ONLY_SCALE && selectionShowsHandles(selectedItem)) {
    if (selectedItem?.type === 'person') {
      const person = index.peopleById.get(selectedItem.id)
      if (person) {
        const hasFavorite = person.isFavorite === true
        for (const handle of connectorHandlesFor(person, 1, hasFavorite)) {
          if (Math.hypot(point.x - handle.x, point.y - handle.y) <= handleHit) {
            return { type: 'connector-handle', sourceId: person.id, sourceType: 'person', x: person.x, y: person.y }
          }
        }
      }
    } else if (selectedItem?.type === 'circle' && selectedItem.showHandles) {
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

    const centerCircle = findCircleCenterAtPoint(index, hitRect, point, scale)
    if (centerCircle) return { type: 'circle-center', circle: centerCircle }

    const connection = findConnectionNearPoint(index, point, 10 / scale)
    if (connection) return { type: 'connection', connection }
  }

  const circles = queryCircles(index, hitRect).reverse()
  const edgeId = resolveCircleEdgeHover(index, point, scale, stickyEdgeId)
  if (scale >= ZONE_ONLY_SCALE && edgeId) {
    const edgeCircle = index.circlesById.get(edgeId)
    if (edgeCircle) return { type: 'circle-edge', circle: edgeCircle }
  }

  for (const circle of circles) {
    const d = Math.hypot(point.x - circle.x, point.y - circle.y)
    if (scale >= ZONE_ONLY_SCALE && d <= CIRCLE_CENTER_RADIUS + 6 / scale) return { type: 'circle-center', circle }
    if (d <= circle.radius) return { type: 'circle-body', circle }
  }

  return null
}

function findCircleCenterAtPoint(
  index: BoardIndex,
  hitRect: WorldRect,
  point: { x: number; y: number },
  scale: number,
) {
  const circles = queryCircles(index, hitRect).reverse()
  for (const circle of circles) {
    const d = Math.hypot(point.x - circle.x, point.y - circle.y)
    if (d <= CIRCLE_CENTER_RADIUS + 6 / scale) return circle
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
