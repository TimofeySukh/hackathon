// Pure geometry + canvas-path helpers shared by the renderer, hit-testing and the
// layout/collision passes.

import type { ShapeType } from './types'

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

// Build an SVG/Canvas path string for a node shape (clean circle, wavy blob or
// rounded polygon). Used for both circle bodies and person sprites.
export function getNodePath(
  cx: number,
  cy: number,
  r: number,
  shapeType: ShapeType,
  sides: number,
  amplitude: number,
) {
  if (shapeType === 'circle') {
    let path = ''
    const points = Math.max(120, Math.round(r * 2))
    for (let i = 0; i <= points; i++) {
      const angle = (i * 2 * Math.PI) / points
      const x = cx + r * Math.cos(angle)
      const y = cy + r * Math.sin(angle)
      if (i === 0) {
        path += `M ${x.toFixed(2)} ${y.toFixed(2)}`
      } else {
        path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`
      }
    }
    path += ' Z'
    return path
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
      if (i === 0) {
        path += `M ${x.toFixed(2)} ${y.toFixed(2)}`
      } else {
        path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`
      }
    }
    path += ' Z'
    return path
  }

  // shapeType === 'polygon'
  const softness = amplitude === 0 ? 0.42 : Math.min(1.0, Math.max(0.0, amplitude / 20.0))
  const vertices: { x: number; y: number }[] = []
  const angleStep = (2 * Math.PI) / sides
  for (let i = 0; i < sides; i++) {
    const angle = i * angleStep - Math.PI / 2
    vertices.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    })
  }

  const midpoints: { x: number; y: number }[] = []
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides
    midpoints.push({
      x: (vertices[i].x + vertices[next].x) / 2,
      y: (vertices[i].y + vertices[next].y) / 2,
    })
  }

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

    if (i === 0) {
      path += `M ${startX.toFixed(2)} ${startY.toFixed(2)}`
    } else {
      path += ` L ${startX.toFixed(2)} ${startY.toFixed(2)}`
    }
    path += ` Q ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${endX.toFixed(2)} ${endY.toFixed(2)}`
  }
  path += ' Z'
  return path
}

// Radius of a circle node's outline at a given angle, as a single radial
// function. Used to sample any shape (circle / rounded polygon / wavy) into
// angle-parameterised points so two shapes can be morphed by lerping
// corresponding points — even when their side counts differ.
function circleRadiusAtAngle(
  R: number,
  sides: number,
  amplitude: number,
  theta: number,
  shapeType?: ShapeType,
) {
  // If shapeType is explicitly provided, follow its specific rules.
  if (shapeType === 'circle') {
    return R
  }
  if (shapeType === 'wavy') {
    if (amplitude > 0) {
      const baseR = R - amplitude - 4
      return baseR + amplitude * Math.cos(sides * theta)
    }
    return R
  }
  if (shapeType === 'polygon') {
    if (sides >= 25) return R
    const a = (2 * Math.PI) / sides
    const phi = (((theta + Math.PI / 2) % a) + a) % a
    const sharp = (R * Math.cos(a / 2)) / Math.cos(phi - a / 2)
    const apothem = R * Math.cos(a / 2)
    const round = 0.34
    return sharp * (1 - round) + apothem * round
  }

  // Fallback for when shapeType is not provided (backwards compatibility)
  if (amplitude > 0) {
    // Wavy blob: matches the 'wavy' branch of getNodePath.
    const baseR = R - amplitude - 4
    return baseR + amplitude * Math.cos(sides * theta)
  }
  if (sides >= 25) return R // clean circle
  // Rounded polygon: sharp n-gon radius blended toward the apothem so corners
  // round in while edges stay flat. A vertex sits at the top (-π/2).
  const a = (2 * Math.PI) / sides
  const phi = (((theta + Math.PI / 2) % a) + a) % a
  const sharp = (R * Math.cos(a / 2)) / Math.cos(phi - a / 2)
  const apothem = R * Math.cos(a / 2)
  const round = 0.34
  return sharp * (1 - round) + apothem * round
}

export type OutlinePoint = { x: number; y: number }

// Sample a circle node's outline as `n` points around the angle, all closed
// (integer `sides`), so point i of one shape corresponds to point i of another.
export function sampleCircleOutline(
  cx: number,
  cy: number,
  R: number,
  sides: number,
  amplitude: number,
  n: number,
  shapeType?: ShapeType,
): OutlinePoint[] {
  const pts: OutlinePoint[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const theta = (i / n) * 2 * Math.PI
    const rad = circleRadiusAtAngle(R, sides, amplitude, theta, shapeType)
    pts[i] = { x: cx + rad * Math.cos(theta), y: cy + rad * Math.sin(theta) }
  }
  return pts
}

export function outlinePath(points: OutlinePoint[]) {
  let d = ''
  for (let i = 0; i < points.length; i++) {
    d += (i === 0 ? 'M ' : ' L ') + points[i].x.toFixed(2) + ' ' + points[i].y.toFixed(2)
  }
  return d + ' Z'
}

export function drawCurvePath(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2 - 40
  ctx.moveTo(from.x, from.y)
  ctx.quadraticCurveTo(mx, my, to.x, to.y)
}

export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
}

export function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (ctx.measureText(`${text.slice(0, mid)}...`).width <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return `${text.slice(0, lo)}...`
}

export function distanceToSegment(
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const wx = point.x - a.x
  const wy = point.y - a.y
  const len = vx * vx + vy * vy
  const t = len === 0 ? 0 : clamp((wx * vx + wy * vy) / len, 0, 1)
  const x = a.x + vx * t
  const y = a.y + vy * t
  return Math.hypot(point.x - x, point.y - y)
}

// Push vector to separate two points so they sit at least minDistance apart.
// Returns null when they're already far enough.
export function getSeparation(
  a: { x: number; y: number },
  b: { x: number; y: number },
  minDistance: number,
) {
  let dx = b.x - a.x
  let dy = b.y - a.y
  let distance = Math.hypot(dx, dy)

  if (distance >= minDistance) return null
  if (distance < 0.0001) {
    dx = 1
    dy = 0
    distance = 1
  }

  const overlap = minDistance - distance
  return {
    x: (dx / distance) * overlap,
    y: (dy / distance) * overlap,
  }
}
