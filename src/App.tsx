import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'

type PersonPoint = {
  id: number
  name: string
  orbit: number
  angle: number
  x: number
  y: number
  radius: number
  color: string
}

type Camera = {
  x: number
  y: number
  scale: number
}

type DragState = {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

type RenderStats = {
  frameMs: number
  visibleCount: number
}

const PEOPLE_COUNT = 5000
const ORBIT_COUNT = 44
const MIN_SCALE = 0.12
const MAX_SCALE = 3.2
const NODE_COLORS = ['#ea6a5e', '#4f8fe8', '#8b68df', '#39a56a', '#d49a28', '#2aa7a0']
const DPR_CAP = 1.75

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const shellRef = useRef<HTMLElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: 0.24 })
  const dragRef = useRef<DragState | null>(null)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const hoverRef = useRef<PersonPoint | null>(null)
  const selectedRef = useRef<PersonPoint | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const statsUpdateRef = useRef(0)
  const [stats, setStats] = useState<RenderStats>({ frameMs: 0, visibleCount: PEOPLE_COUNT })
  const [selectedPerson, setSelectedPerson] = useState<PersonPoint | null>(null)
  const [searchText, setSearchText] = useState('')

  const people = useMemo(() => generateOrbitPeople(PEOPLE_COUNT), [])
  const spatialIndex = useMemo(() => createSpatialIndex(people), [people])
  const worldBounds = useMemo(() => getWorldBounds(people), [people])

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const startedAt = performance.now()
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) return

    const camera = cameraRef.current
    const viewport = getViewportWorldRect(canvas, camera)
    const visiblePeople = people
    const hoverPerson = pointerRef.current ? pickPerson(pointerRef.current.x, pointerRef.current.y, camera, spatialIndex) : null
    hoverRef.current = hoverPerson

    drawScene({
      context,
      canvas,
      camera,
      people: visiblePeople,
      viewport,
      hoverPerson,
      selectedPerson: selectedRef.current,
    })

    const now = performance.now()
    if (now - statsUpdateRef.current > 160) {
      statsUpdateRef.current = now
      setStats({
        frameMs: now - startedAt,
        visibleCount: visiblePeople.length,
      })
    }
  }, [people, spatialIndex])

  const scheduleRender = useCallback(() => {
    if (animationFrameRef.current !== null) return

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null
      renderCanvas()
    })
  }, [renderCanvas])

  useEffect(() => {
    selectedRef.current = selectedPerson
    scheduleRender()
  }, [scheduleRender, selectedPerson])

  useEffect(() => {
    const canvas = canvasRef.current
    const shell = shellRef.current
    if (!canvas || !shell) return

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas(canvas, shell)
      centerCamera(shell, worldBounds, cameraRef.current)
      scheduleRender()
    })

    resizeObserver.observe(shell)
    resizeCanvas(canvas, shell)
    centerCamera(shell, worldBounds, cameraRef.current)
    scheduleRender()

    return () => {
      resizeObserver.disconnect()
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [scheduleRender, worldBounds])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function handleWheel(event: WheelEvent) {
      event.preventDefault()
      const rect = canvas!.getBoundingClientRect()
      const camera = cameraRef.current
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      const before = screenToWorld(pointerX, pointerY, camera)
      const nextScale = clamp(camera.scale * Math.exp(-event.deltaY * 0.001), MIN_SCALE, MAX_SCALE)

      camera.scale = nextScale
      camera.x = pointerX - before.x * nextScale
      camera.y = pointerY - before.y * nextScale
      scheduleRender()
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [scheduleRender])

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerRef.current = getCanvasPoint(event)

    const pickedPerson = pickPerson(pointerRef.current.x, pointerRef.current.y, cameraRef.current, spatialIndex)
    if (pickedPerson) {
      selectedRef.current = pickedPerson
      setSelectedPerson(pickedPerson)
      scheduleRender()
      return
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: cameraRef.current.x,
      originY: cameraRef.current.y,
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    pointerRef.current = getCanvasPoint(event)

    const drag = dragRef.current
    if (drag && drag.pointerId === event.pointerId) {
      cameraRef.current.x = drag.originX + event.clientX - drag.startX
      cameraRef.current.y = drag.originY + event.clientY - drag.startY
    }

    scheduleRender()
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
    }
  }

  function handlePointerLeave() {
    pointerRef.current = null
    hoverRef.current = null
    scheduleRender()
  }

  function zoomBy(factor: number) {
    const canvas = canvasRef.current
    if (!canvas) return

    const centerX = canvas.clientWidth / 2
    const centerY = canvas.clientHeight / 2
    const camera = cameraRef.current
    const before = screenToWorld(centerX, centerY, camera)
    camera.scale = clamp(camera.scale * factor, MIN_SCALE, MAX_SCALE)
    camera.x = centerX - before.x * camera.scale
    camera.y = centerY - before.y * camera.scale
    scheduleRender()
  }

  function resetView() {
    const shell = shellRef.current
    if (!shell) return
    centerCamera(shell, worldBounds, cameraRef.current)
    scheduleRender()
  }

  function selectSearchResult(sourceText = searchText) {
    const query = sourceText.trim().toLowerCase()
    if (!query) return

    const numericId = Number(query.replace(/\D/g, ''))
    const match = people.find((person) => person.name.toLowerCase().includes(query) || person.id === numericId)
    if (!match) return

    selectedRef.current = match
    setSelectedPerson(match)
    focusPerson(match)
  }

  function focusPerson(person: PersonPoint) {
    const canvas = canvasRef.current
    if (!canvas) return

    const camera = cameraRef.current
    camera.scale = clamp(1.05, MIN_SCALE, MAX_SCALE)
    camera.x = canvas.clientWidth / 2 - person.x * camera.scale
    camera.y = canvas.clientHeight / 2 - person.y * camera.scale
    scheduleRender()
  }

  return (
    <main ref={shellRef} className="app-shell">
      <canvas
        ref={canvasRef}
        className="graph-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        aria-label="Five thousand person orbit graph"
      />

      <header className="graph-toolbar">
        <div className="brand-lockup" aria-label="Datanode performance graph">
          <span className="brand-mark">dn</span>
          <span className="brand-text">Orbit graph</span>
        </div>

        <label className="search-box">
          <span className="search-box__icon" aria-hidden="true">
            <SearchIcon />
          </span>
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') selectSearchResult(event.currentTarget.value)
            }}
            ref={searchInputRef}
            placeholder="Search Person 2048"
            aria-label="Search people"
          />
          <button
            type="button"
            className="search-box__submit"
            onClick={() => selectSearchResult(searchInputRef.current?.value ?? searchText)}
            aria-label="Center searched person"
          >
            <ArrowRightIcon />
          </button>
        </label>

        <div className="toolbar-group" aria-label="Zoom controls">
          <button type="button" onClick={() => zoomBy(0.82)} aria-label="Zoom out">
            <MinusIcon />
          </button>
          <button type="button" onClick={resetView} aria-label="Reset view">
            <TargetIcon />
          </button>
          <button type="button" onClick={() => zoomBy(1.22)} aria-label="Zoom in">
            <PlusIcon />
          </button>
        </div>
      </header>

      <aside className="stats-panel" aria-label="Graph render statistics">
        <div>
          <span>People</span>
          <strong>{PEOPLE_COUNT.toLocaleString('en-US')}</strong>
        </div>
        <div>
          <span>Drawn per frame</span>
          <strong>{stats.visibleCount.toLocaleString('en-US')}</strong>
        </div>
        <div>
          <span>Last frame</span>
          <strong>{stats.frameMs.toFixed(1)} ms</strong>
        </div>
        <div>
          <span>Renderer</span>
          <strong>Canvas 2D</strong>
        </div>
      </aside>

      <aside className="person-panel" aria-label="Selected person">
        {selectedPerson ? (
          <>
            <span className="panel-label">Selected</span>
            <h1>{selectedPerson.name}</h1>
            <dl>
              <div>
                <dt>Orbit</dt>
                <dd>{selectedPerson.orbit + 1}</dd>
              </div>
              <div>
                <dt>Angle</dt>
                <dd>{Math.round((selectedPerson.angle * 180) / Math.PI)} deg</dd>
              </div>
              <div>
                <dt>Position</dt>
                <dd>
                  {Math.round(selectedPerson.x)}, {Math.round(selectedPerson.y)}
                </dd>
              </div>
            </dl>
            <button type="button" onClick={() => focusPerson(selectedPerson)}>
              Center person
            </button>
          </>
        ) : (
          <>
            <span className="panel-label">Ready</span>
            <h1>5,000 people at once</h1>
            <p>Pan, zoom, hover, and click. All person points are drawn every frame on one canvas layer.</p>
          </>
        )}
      </aside>
    </main>
  )
}

function drawScene(input: {
  context: CanvasRenderingContext2D
  canvas: HTMLCanvasElement
  camera: Camera
  people: PersonPoint[]
  viewport: { left: number; right: number; top: number; bottom: number }
  hoverPerson: PersonPoint | null
  selectedPerson: PersonPoint | null
}) {
  const { context, canvas, camera, people, viewport, hoverPerson, selectedPerson } = input
  const width = canvas.width
  const height = canvas.height
  const dpr = getCanvasDpr(canvas)
  const screenWidth = width / dpr
  const screenHeight = height / dpr

  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.fillStyle = '#f6f7f2'
  context.fillRect(0, 0, screenWidth, screenHeight)
  drawGrid(context, screenWidth, screenHeight, camera)

  context.save()
  context.translate(camera.x, camera.y)
  context.scale(camera.scale, camera.scale)
  drawOrbitRings(context)

  const lod = getLevelOfDetail(camera.scale)
  const worldPadding = 120 / camera.scale
  const paddedViewport = {
    left: viewport.left - worldPadding,
    right: viewport.right + worldPadding,
    top: viewport.top - worldPadding,
    bottom: viewport.bottom + worldPadding,
  }

  for (const person of people) {
    if (!isInViewport(person, paddedViewport)) continue

    context.beginPath()
    context.fillStyle = person.color
    context.globalAlpha = lod.nodeAlpha
    context.arc(person.x, person.y, lod.nodeRadius + person.radius, 0, Math.PI * 2)
    context.fill()
  }

  context.globalAlpha = 1
  drawFocusNode(context, selectedPerson, '#17231f', camera.scale)
  drawFocusNode(context, hoverPerson, '#ffffff', camera.scale)

  if (camera.scale > 0.78) {
    drawLabels(context, [selectedPerson, hoverPerson].filter(Boolean) as PersonPoint[], camera.scale)
  }

  context.restore()
}

function drawGrid(context: CanvasRenderingContext2D, width: number, height: number, camera: Camera) {
  const gridSize = Math.max(18, 96 * camera.scale)
  const offsetX = positiveModulo(camera.x, gridSize)
  const offsetY = positiveModulo(camera.y, gridSize)

  context.fillStyle = '#edf0e8'
  for (let x = offsetX; x < width; x += gridSize) {
    for (let y = offsetY; y < height; y += gridSize) {
      context.beginPath()
      context.arc(x, y, 1.05, 0, Math.PI * 2)
      context.fill()
    }
  }
}

function drawOrbitRings(context: CanvasRenderingContext2D) {
  context.lineWidth = 1
  for (let orbit = 0; orbit < ORBIT_COUNT; orbit += 1) {
    const radius = getOrbitRadius(orbit)
    context.beginPath()
    context.strokeStyle = orbit % 5 === 0 ? 'rgba(33, 44, 39, 0.13)' : 'rgba(33, 44, 39, 0.045)'
    context.arc(0, 0, radius, 0, Math.PI * 2)
    context.stroke()
  }
}

function drawFocusNode(context: CanvasRenderingContext2D, person: PersonPoint | null, fillStyle: string, scale: number) {
  if (!person) return

  const radius = Math.max(8 / scale, 7)
  context.beginPath()
  context.fillStyle = fillStyle
  context.strokeStyle = person.color
  context.lineWidth = Math.max(2 / scale, 1.25)
  context.arc(person.x, person.y, radius, 0, Math.PI * 2)
  context.fill()
  context.stroke()
}

function drawLabels(context: CanvasRenderingContext2D, people: PersonPoint[], scale: number) {
  const uniquePeople = Array.from(new Map(people.map((person) => [person.id, person])).values())

  for (const person of uniquePeople) {
    const fontSize = Math.max(11 / scale, 8)
    context.font = `${fontSize}px Inter, system-ui, sans-serif`
    const labelWidth = context.measureText(person.name).width + 18 / scale
    const labelHeight = 24 / scale
    const x = person.x + 12 / scale
    const y = person.y - labelHeight / 2

    context.fillStyle = 'rgba(255, 255, 255, 0.92)'
    roundRect(context, x, y, labelWidth, labelHeight, 10 / scale)
    context.fill()
    context.fillStyle = '#17231f'
    context.fillText(person.name, x + 9 / scale, y + 16 / scale)
  }
}

function generateOrbitPeople(count: number) {
  const people: PersonPoint[] = []
  let id = 1

  for (let orbit = 0; orbit < ORBIT_COUNT && id <= count; orbit += 1) {
    const radius = getOrbitRadius(orbit)
    const capacity = Math.max(16, Math.round((Math.PI * 2 * radius) / 32))
    const orbitCount = Math.min(capacity, count - people.length)
    const phase = seededRandom(orbit + 7) * Math.PI * 2

    for (let index = 0; index < orbitCount && id <= count; index += 1) {
      const angle = phase + (Math.PI * 2 * index) / orbitCount
      const jitter = (seededRandom(id * 13) - 0.5) * 18
      const wave = Math.sin(angle * 5 + orbit) * 8
      const finalRadius = radius + jitter + wave

      people.push({
        id,
        name: `Person ${id}`,
        orbit,
        angle,
        x: Math.cos(angle) * finalRadius,
        y: Math.sin(angle) * finalRadius,
        radius: (id % 5) * 0.18,
        color: NODE_COLORS[(orbit + id) % NODE_COLORS.length],
      })
      id += 1
    }
  }

  while (id <= count) {
    const overflowIndex = id - 1
    const orbit = ORBIT_COUNT - 1
    const radius = getOrbitRadius(orbit) + Math.floor((overflowIndex - people.length) / 280) * 72
    const angle = overflowIndex * 2.399963229728653
    people.push({
      id,
      name: `Person ${id}`,
      orbit,
      angle,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      radius: (id % 5) * 0.18,
      color: NODE_COLORS[id % NODE_COLORS.length],
    })
    id += 1
  }

  return people
}

function createSpatialIndex(people: PersonPoint[]) {
  const cellSize = 96
  const cells = new Map<string, PersonPoint[]>()

  for (const person of people) {
    const cellX = Math.floor(person.x / cellSize)
    const cellY = Math.floor(person.y / cellSize)
    const key = `${cellX}:${cellY}`
    const cell = cells.get(key)
    if (cell) {
      cell.push(person)
    } else {
      cells.set(key, [person])
    }
  }

  return { cellSize, cells }
}

function pickPerson(screenX: number, screenY: number, camera: Camera, spatialIndex: ReturnType<typeof createSpatialIndex>) {
  const worldPoint = screenToWorld(screenX, screenY, camera)
  const hitRadius = Math.max(10 / camera.scale, 8)
  const cellX = Math.floor(worldPoint.x / spatialIndex.cellSize)
  const cellY = Math.floor(worldPoint.y / spatialIndex.cellSize)
  let bestPerson: PersonPoint | null = null
  let bestDistance = hitRadius

  for (let x = cellX - 1; x <= cellX + 1; x += 1) {
    for (let y = cellY - 1; y <= cellY + 1; y += 1) {
      const cell = spatialIndex.cells.get(`${x}:${y}`)
      if (!cell) continue

      for (const person of cell) {
        const distance = Math.hypot(person.x - worldPoint.x, person.y - worldPoint.y)
        if (distance < bestDistance) {
          bestPerson = person
          bestDistance = distance
        }
      }
    }
  }

  return bestPerson
}

function resizeCanvas(canvas: HTMLCanvasElement, shell: HTMLElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
  const width = Math.max(1, shell.clientWidth)
  const height = Math.max(1, shell.clientHeight)
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  canvas.dataset.dpr = String(dpr)
}

function centerCamera(shell: HTMLElement, bounds: ReturnType<typeof getWorldBounds>, camera: Camera) {
  const padding = 180
  const scale = Math.min(
    (shell.clientWidth - padding) / Math.max(1, bounds.width),
    (shell.clientHeight - padding) / Math.max(1, bounds.height),
  )
  camera.scale = clamp(scale, MIN_SCALE, 0.42)
  camera.x = shell.clientWidth / 2 - bounds.centerX * camera.scale
  camera.y = shell.clientHeight / 2 - bounds.centerY * camera.scale
}

function getViewportWorldRect(canvas: HTMLCanvasElement, camera: Camera) {
  const topLeft = screenToWorld(0, 0, camera)
  const bottomRight = screenToWorld(canvas.clientWidth, canvas.clientHeight, camera)

  return {
    left: Math.min(topLeft.x, bottomRight.x),
    right: Math.max(topLeft.x, bottomRight.x),
    top: Math.min(topLeft.y, bottomRight.y),
    bottom: Math.max(topLeft.y, bottomRight.y),
  }
}

function getWorldBounds(people: PersonPoint[]) {
  const xs = people.map((person) => person.x)
  const ys = people.map((person) => person.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  }
}

function getOrbitRadius(orbit: number) {
  return 82 + orbit * 54 + Math.pow(orbit, 1.25) * 7
}

function getLevelOfDetail(scale: number) {
  if (scale < 0.22) return { nodeRadius: 2.4 / scale, nodeAlpha: 0.76 }
  if (scale < 0.62) return { nodeRadius: 2.1 / scale, nodeAlpha: 0.84 }
  return { nodeRadius: 3.8 / scale, nodeAlpha: 0.92 }
}

function getCanvasPoint(event: PointerEvent<HTMLCanvasElement>) {
  const rect = event.currentTarget.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function screenToWorld(screenX: number, screenY: number, camera: Camera) {
  return {
    x: (screenX - camera.x) / camera.scale,
    y: (screenY - camera.y) / camera.scale,
  }
}

function isInViewport(person: PersonPoint, viewport: { left: number; right: number; top: number; bottom: number }) {
  return person.x >= viewport.left && person.x <= viewport.right && person.y >= viewport.top && person.y <= viewport.bottom
}

function getCanvasDpr(canvas: HTMLCanvasElement) {
  return Number(canvas.dataset.dpr || '1')
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

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor
}

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="m20 20-4.4-4.4m2.4-5.1a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  )
}

export default App
