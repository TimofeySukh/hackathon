import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'

type CircleTone = 'blue' | 'red' | 'green' | 'amber' | 'violet'

type CircleNode = {
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
}

type PersonNode = {
  id: string
  name: string
  role: string
  x: number
  y: number
  circleId: string
  avatar: string
}

type GraphState = {
  circles: CircleNode[]
  people: PersonNode[]
}

type StressSettings = {
  count: number
  showLabels: boolean
  showEdges: boolean
}

type Camera = {
  x: number
  y: number
  scale: number
}

type DragConnector = {
  sourceCircleId: string
  startX: number
  startY: number
  endX: number
  endY: number
}

type CreateMenu = {
  sourceCircleId: string
  x: number
  y: number
  screenX: number
  screenY: number
}

type SelectedItem =
  | {
      type: 'circle'
      id: string
    }
  | {
      type: 'person'
      id: string
    }

type PanState = {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

type MoveCircleState = {
  pointerId: number
  circleId: string
  startX: number
  startY: number
  originX: number
  originY: number
}

type MovePersonState = {
  pointerId: number
  personId: string
  startX: number
  startY: number
  originX: number
  originY: number
}

type ResizeCircleState = {
  pointerId: number
  circleId: string
}

const MIN_SCALE = 0.35
const MAX_SCALE = 1.8
const CONNECT_THRESHOLD = 40
const MIN_CIRCLE_RADIUS = 72
const EDGE_RESIZE_HIT_SIZE = 18
const PERSON_CONTAINMENT_RADIUS = 62
const CIRCLE_CONTAINMENT_PADDING = 28
const MAX_STRESS_ICONS = 10000
const DEFAULT_STATE: GraphState = {
  circles: [
    {
      id: 'you',
      name: 'You',
      icon: 'YOU',
      x: 0,
      y: 0,
      radius: 126,
      minRadius: 126,
      parentId: null,
      connectedTo: null,
      tone: 'blue',
    },
    {
      id: 'eu-network',
      name: 'EU friends',
      icon: 'EU',
      x: 36,
      y: -430,
      radius: 250,
      minRadius: 250,
      parentId: null,
      connectedTo: 'you',
      tone: 'blue',
    },
    {
      id: 'pandora',
      name: 'Pandora',
      icon: 'P',
      x: -48,
      y: 450,
      radius: 270,
      minRadius: 270,
      parentId: null,
      connectedTo: 'you',
      tone: 'red',
    },
    {
      id: 'product-team',
      name: 'Product team',
      icon: 'PT',
      x: -56,
      y: 535,
      radius: 78,
      minRadius: 78,
      parentId: 'pandora',
      connectedTo: 'pandora',
      tone: 'blue',
    },
    {
      id: 'market',
      name: 'Market circle',
      icon: 'M',
      x: 510,
      y: 72,
      radius: 236,
      minRadius: 236,
      parentId: null,
      connectedTo: 'you',
      tone: 'green',
    },
  ],
  people: [
    { id: 'p1', name: 'Mia', role: 'Close friend', x: -62, y: -54, circleId: 'you', avatar: 'MI' },
    { id: 'p2', name: 'Noah', role: 'Founder friend', x: 58, y: -6, circleId: 'you', avatar: 'NO' },
    { id: 'p3', name: 'Ava', role: 'Design', x: 34, y: 67, circleId: 'you', avatar: 'AV' },
    { id: 'p4', name: 'Sofia', role: 'Portugal', x: 168, y: -472, circleId: 'eu-network', avatar: 'SO' },
    { id: 'p5', name: 'Lucas', role: 'Germany', x: 28, y: -610, circleId: 'eu-network', avatar: 'LU' },
    { id: 'p6', name: 'Emma', role: 'Finland', x: -112, y: -416, circleId: 'eu-network', avatar: 'EM' },
    { id: 'p7', name: 'Oscar', role: 'Denmark', x: 106, y: -302, circleId: 'eu-network', avatar: 'OC' },
    { id: 'p8', name: 'Olivia', role: 'Brand', x: -166, y: 335, circleId: 'pandora', avatar: 'OL' },
    { id: 'p9', name: 'Victor', role: 'Retail', x: 154, y: 360, circleId: 'pandora', avatar: 'VI' },
    { id: 'p10', name: 'Freja', role: 'Operations', x: -190, y: 575, circleId: 'pandora', avatar: 'FR' },
    { id: 'p11', name: 'Anton', role: 'PM', x: -92, y: 575, circleId: 'product-team', avatar: 'AN' },
    { id: 'p12', name: 'Nora', role: 'UX', x: -20, y: 591, circleId: 'product-team', avatar: 'NR' },
    { id: 'p13', name: 'Eli', role: 'Engineering', x: 50, y: 575, circleId: 'product-team', avatar: 'EL' },
    { id: 'p14', name: 'Karim', role: 'Investor', x: 645, y: -15, circleId: 'market', avatar: 'KA' },
    { id: 'p15', name: 'Lina', role: 'Media', x: 423, y: 4, circleId: 'market', avatar: 'LI' },
    { id: 'p16', name: 'Yara', role: 'Analyst', x: 580, y: 198, circleId: 'market', avatar: 'YA' },
  ],
}

const TONE_LABELS: Record<CircleTone, string> = {
  amber: 'Warm',
  blue: 'Blue',
  green: 'Green',
  red: 'Red',
  violet: 'Violet',
}

const MATERIAL_TONES: Record<CircleTone, { fill: string; border: string; text: string; centerBg: string }> = {
  blue: { fill: '#D2E4FF', border: '#004A77', text: '#001D35', centerBg: '#00629D' },
  red: { fill: '#FFDAD6', border: '#BA1A1A', text: '#410002', centerBg: '#C00015' },
  green: { fill: '#D1E8D2', border: '#0F6D38', text: '#00210B', centerBg: '#1E824A' },
  amber: { fill: '#FFE082', border: '#B06000', text: '#2A1400', centerBg: '#D87A00' },
  violet: { fill: '#EADDFF', border: '#6750A4', text: '#21005D', centerBg: '#7F67BE' },
}

function getFlowerPath(cx: number, cy: number, r: number, petals: number, amplitude: number) {
  let path = ''
  const points = 120
  for (let i = 0; i <= points; i++) {
    const angle = (i * 2 * Math.PI) / points
    const currentR = r + amplitude * Math.cos(petals * angle)
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

function App() {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const panRef = useRef<PanState | null>(null)
  const moveCircleRef = useRef<MoveCircleState | null>(null)
  const movePersonRef = useRef<MovePersonState | null>(null)
  const resizeCircleRef = useRef<ResizeCircleState | null>(null)
  const [graph, setGraph] = useState(createInitialGraph)
  const [camera, setCamera] = useState<Camera>({ x: window.innerWidth / 2, y: window.innerHeight / 2, scale: 0.82 })
  const [connector, setConnector] = useState<DragConnector | null>(null)
  const [createMenu, setCreateMenu] = useState<CreateMenu | null>(null)
  const [selectedItem, setSelectedItem] = useState<SelectedItem>({ type: 'circle', id: 'you' })
  const [stress, setStress] = useState<StressSettings>({ count: 0, showLabels: false, showEdges: true })
  const fps = useFrameRate()

  const circlesById = useMemo(() => new Map(graph.circles.map((circle) => [circle.id, circle])), [graph.circles])
  const stressPeople = useMemo(() => generateStressPeople(stress.count), [stress.count])
  const renderedPeopleCount = graph.people.length + stressPeople.length
  const renderedEdgeCount =
    graph.circles.filter((circle) => circle.connectedTo).length + graph.people.length + (stress.showEdges ? stressPeople.length : 0)
  const sortedCircles = useMemo(() => {
    function getDepth(circleId: string | null): number {
      let depth = 0
      let curr = circleId
      while (curr) {
        depth++
        curr = circlesById.get(curr)?.parentId ?? null
      }
      return depth
    }
    return [...graph.circles].sort((a, b) => getDepth(a.parentId) - getDepth(b.parentId))
  }, [graph.circles, circlesById])
  const selectedCircle = selectedItem.type === 'circle' ? circlesById.get(selectedItem.id) ?? null : null
  const selectedPerson = selectedItem.type === 'person' ? graph.people.find((person) => person.id === selectedItem.id) ?? null : null

  function screenToWorld(point: { x: number; y: number }) {
    return {
      x: (point.x - camera.x) / camera.scale,
      y: (point.y - camera.y) / camera.scale,
    }
  }

  function handleSurfacePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.target !== event.currentTarget) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setCreateMenu(null)
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: camera.x,
      originY: camera.y,
    }
  }

  function handleSurfacePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panRef.current
    if (pan?.pointerId === event.pointerId) {
      setCamera((current) => ({
        ...current,
        x: pan.originX + event.clientX - pan.startX,
        y: pan.originY + event.clientY - pan.startY,
      }))
    }

    const moving = moveCircleRef.current
    if (moving?.pointerId === event.pointerId) {
      const deltaX = (event.clientX - moving.startX) / camera.scale
      const deltaY = (event.clientY - moving.startY) / camera.scale
      setGraph((current) => ensureContainment(moveCircleSubtree(current, moving.circleId, moving.originX + deltaX, moving.originY + deltaY)))
    }

    const movingPerson = movePersonRef.current
    if (movingPerson?.pointerId === event.pointerId) {
      const deltaX = (event.clientX - movingPerson.startX) / camera.scale
      const deltaY = (event.clientY - movingPerson.startY) / camera.scale
      setGraph((current) =>
        ensureContainment({
          ...current,
          people: current.people.map((person) =>
            person.id === movingPerson.personId ? { ...person, x: movingPerson.originX + deltaX, y: movingPerson.originY + deltaY } : person,
          ),
        }),
      )
    }

    const resizing = resizeCircleRef.current
    if (resizing?.pointerId === event.pointerId) {
      const world = screenToWorld({ x: event.clientX, y: event.clientY })
      setGraph((current) => resizeCircleFromPoint(current, resizing.circleId, world))
    }

    if (connector) {
      const world = screenToWorld({ x: event.clientX, y: event.clientY })
      setConnector({ ...connector, endX: world.x, endY: world.y })
    }
  }

  function handleSurfacePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null
    }

    if (moveCircleRef.current?.pointerId === event.pointerId) {
      moveCircleRef.current = null
    }

    if (movePersonRef.current?.pointerId === event.pointerId) {
      movePersonRef.current = null
    }

    if (resizeCircleRef.current?.pointerId === event.pointerId) {
      resizeCircleRef.current = null
    }

    if (!connector) return

    const distance = Math.hypot(connector.endX - connector.startX, connector.endY - connector.startY)
    if (distance > CONNECT_THRESHOLD) {
      setCreateMenu({
        sourceCircleId: connector.sourceCircleId,
        x: connector.endX,
        y: connector.endY,
        screenX: event.clientX,
        screenY: event.clientY,
      })
    }
    setConnector(null)
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault()
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (!rect) return

    const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const before = screenToWorld(pointer)
    const nextScale = clamp(camera.scale * Math.exp(-event.deltaY * 0.001), MIN_SCALE, MAX_SCALE)
    setCamera({
      scale: nextScale,
      x: pointer.x - before.x * nextScale,
      y: pointer.y - before.y * nextScale,
    })
  }

  function startConnector(event: ReactPointerEvent<HTMLElement>, circle: CircleNode) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setCreateMenu(null)
    setSelectedItem({ type: 'circle', id: circle.id })
    setConnector({
      sourceCircleId: circle.id,
      startX: circle.x,
      startY: circle.y,
      endX: circle.x,
      endY: circle.y,
    })
  }

  function startCircleMove(event: ReactPointerEvent<HTMLElement>, circle: CircleNode) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    moveCircleRef.current = {
      pointerId: event.pointerId,
      circleId: circle.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: circle.x,
      originY: circle.y,
    }
  }

  function startCircleCenterDrag(event: ReactPointerEvent<HTMLButtonElement>, circle: CircleNode) {
    if (event.shiftKey) {
      startConnector(event, circle)
      return
    }

    startCircleMove(event, circle)
  }

  function startCircleSurfaceDrag(event: ReactPointerEvent<HTMLElement>, circle: CircleNode) {
    if (event.button !== 0) return

    const world = screenToWorld({ x: event.clientX, y: event.clientY })
    const distanceFromCenter = Math.hypot(world.x - circle.x, world.y - circle.y)
    const edgeHitSize = EDGE_RESIZE_HIT_SIZE / camera.scale

    if (Math.abs(distanceFromCenter - circle.radius) <= edgeHitSize) {
      startCircleResize(event, circle)
      return
    }

    setSelectedItem({ type: 'circle', id: circle.id })
    startCircleMove(event, circle)
  }

  function openCircleCreateMenu(event: ReactMouseEvent<HTMLElement>, circle: CircleNode) {
    event.preventDefault()
    event.stopPropagation()
    const world = screenToWorld({ x: event.clientX, y: event.clientY })
    setSelectedItem({ type: 'circle', id: circle.id })
    setCreateMenu({
      sourceCircleId: circle.id,
      x: world.x,
      y: world.y,
      screenX: event.clientX,
      screenY: event.clientY,
    })
  }

  function startPersonMove(event: ReactPointerEvent<HTMLButtonElement>, person: PersonNode) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setCreateMenu(null)
    setSelectedItem({ type: 'person', id: person.id })
    movePersonRef.current = {
      pointerId: event.pointerId,
      personId: person.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: person.x,
      originY: person.y,
    }
  }

  function startCircleResize(event: ReactPointerEvent<HTMLElement>, circle: CircleNode) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setCreateMenu(null)
    setSelectedItem({ type: 'circle', id: circle.id })
    resizeCircleRef.current = {
      pointerId: event.pointerId,
      circleId: circle.id,
    }
  }

  function createPerson() {
    if (!createMenu) return

    const source = circlesById.get(createMenu.sourceCircleId)
    if (!source) return

    const id = `person-${Date.now()}`
    setGraph((current) =>
      ensureContainment({
        ...current,
        people: [
          ...current.people,
          {
            id,
            name: `New person ${current.people.length + 1}`,
            role: `Inside ${source.name}`,
            x: createMenu.x,
            y: createMenu.y,
            circleId: source.id,
            avatar: makeAvatar(current.people.length + 1),
          },
        ],
      }),
    )
    setSelectedItem({ type: 'person', id })
    setCreateMenu(null)
  }

  function createCircle(mode: 'nested' | 'external') {
    if (!createMenu) return

    const source = circlesById.get(createMenu.sourceCircleId)
    if (!source) return

    const id = `circle-${Date.now()}`
    const isNested = mode === 'nested'
    setGraph((current) =>
      ensureContainment({
        ...current,
        circles: [
          ...current.circles,
          {
            id,
            name: isNested ? `${source.name} subset` : 'New circle',
            icon: isNested ? 'SUB' : 'C',
            x: createMenu.x,
            y: createMenu.y,
            radius: isNested ? 82 : 190,
            minRadius: isNested ? 82 : 190,
            parentId: isNested ? source.id : null,
            connectedTo: source.id,
            tone: isNested ? 'violet' : nextTone(current.circles.length),
          },
        ],
      }),
    )
    setSelectedItem({ type: 'circle', id })
    setCreateMenu(null)
  }

  function addDemoCluster() {
    const source = selectedCircle ?? circlesById.get('you')
    if (!source) return

    const nextIndex = graph.people.length + 1
    const points = [-58, 0, 58].map((offset, index) => ({
      id: `person-${Date.now()}-${index}`,
      name: ['Alex', 'Daria', 'Sam'][index],
      role: `Added to ${source.name}`,
      x: source.x + offset,
      y: source.y + source.radius * 0.42 + index * 18,
      circleId: source.id,
      avatar: makeAvatar(nextIndex + index),
    }))
    setGraph((current) => ensureContainment({ ...current, people: [...current.people, ...points] }))
  }

  function resetDemo() {
    setGraph(createInitialGraph())
    setSelectedItem({ type: 'circle', id: 'you' })
    setCreateMenu(null)
    setConnector(null)
    setCamera({ x: window.innerWidth / 2, y: window.innerHeight / 2, scale: 0.82 })
  }

  function renameSelected(value: string) {
    if (selectedItem.type === 'circle') {
      setGraph((current) => ({
        ...current,
        circles: current.circles.map((circle) => (circle.id === selectedItem.id ? { ...circle, name: value } : circle)),
      }))
      return
    }

    setGraph((current) => ({
      ...current,
      people: current.people.map((person) => (person.id === selectedItem.id ? { ...person, name: value } : person)),
    }))
  }

  return (
    <main className="app-shell">
      <div className="toolbar" aria-label="Graph controls">
        <div className="brand">
          <span className="brand__mark">DN</span>
          <span>Circle graph prototype</span>
        </div>
        <div className="toolbar__group">
          <button type="button" onClick={() => setCamera((current) => ({ ...current, scale: clamp(current.scale * 1.14, MIN_SCALE, MAX_SCALE) }))} aria-label="Zoom in">
            <ZoomInIcon />
          </button>
          <button type="button" onClick={() => setCamera((current) => ({ ...current, scale: clamp(current.scale / 1.14, MIN_SCALE, MAX_SCALE) }))} aria-label="Zoom out">
            <ZoomOutIcon />
          </button>
          <button type="button" onClick={resetDemo} aria-label="Reset demo">
            <ResetIcon />
          </button>
        </div>
      </div>

      <section className="stress-panel" aria-label="Icon stress test controls">
        <div className="stress-panel__header">
          <strong>Icon stress</strong>
          <span>{fps} FPS</span>
        </div>
        <label className="stress-slider">
          <span>{stress.count.toLocaleString('en-US')} synthetic icons</span>
          <input
            type="range"
            min="0"
            max={MAX_STRESS_ICONS}
            step="250"
            value={stress.count}
            onChange={(event) => setStress((current) => ({ ...current, count: Number(event.target.value) }))}
          />
        </label>
        <div className="stress-toggles">
          <label>
            <input
              type="checkbox"
              checked={stress.showEdges}
              onChange={(event) => setStress((current) => ({ ...current, showEdges: event.target.checked }))}
            />
            <span>Edges</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={stress.showLabels}
              onChange={(event) => setStress((current) => ({ ...current, showLabels: event.target.checked }))}
            />
            <span>Labels</span>
          </label>
        </div>
        <dl>
          <div>
            <dt>Rendered icons</dt>
            <dd>{renderedPeopleCount.toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt>Rendered edges</dt>
            <dd>{renderedEdgeCount.toLocaleString('en-US')}</dd>
          </div>
        </dl>
      </section>

      <section className="help-panel" aria-label="How to use the prototype">
        <strong>How it works</strong>
        <span>Drag people or circles to move them.</span>
        <span>Grab a circle edge to resize it.</span>
        <span>Right-click a circle to add a person, subset, or connected circle.</span>
        <span>Shift-drag from a circle center to create from the center.</span>
        <span>Parent circles auto-fit their contents.</span>
      </section>

      <div
        ref={surfaceRef}
        className="graph-surface"
        onPointerDown={handleSurfacePointerDown}
        onPointerMove={handleSurfacePointerMove}
        onPointerUp={handleSurfacePointerUp}
        onPointerCancel={handleSurfacePointerUp}
        onWheel={handleWheel}
      >
        <svg className="edge-layer" aria-hidden="true">
          <g transform={`translate(${camera.x} ${camera.y}) scale(${camera.scale})`}>
            {graph.circles.map((circle) => {
              const source = circle.connectedTo ? circlesById.get(circle.connectedTo) : null
              if (!source) return null
              return <path key={circle.id} className="edge edge--circle" d={makeCurve(source, circle)} />
            })}
            {graph.people.map((person) => {
              const circle = circlesById.get(person.circleId)
              if (!circle) return null
              return <path key={person.id} className="edge edge--person" d={makeCurve(circle, person)} />
            })}
            {stress.showEdges
              ? stressPeople.map((person) => {
                  const circle = circlesById.get(person.circleId)
                  if (!circle) return null
                  return <path key={person.id} className="edge edge--stress" d={makeCurve(circle, person)} />
                })
              : null}
            {connector ? <path className="edge edge--draft" d={makeCurve({ x: connector.startX, y: connector.startY }, { x: connector.endX, y: connector.endY })} /> : null}
          </g>
        </svg>

        <div className="world-layer" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}>
          {sortedCircles.map((circle) => (
            <section
              key={circle.id}
              className={`circle circle--${circle.tone} ${selectedItem.type === 'circle' && selectedItem.id === circle.id ? 'is-selected' : ''}`}
              style={{
                width: circle.radius * 2,
                height: circle.radius * 2,
                transform: `translate(${circle.x - circle.radius}px, ${circle.y - circle.radius}px)`,
                background: 'transparent',
                border: 'none',
              }}
              onContextMenu={(event) => openCircleCreateMenu(event, circle)}
              onPointerDown={(event) => startCircleSurfaceDrag(event, circle)}
            >
              <svg
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  overflow: 'visible',
                }}
              >
                <path
                  d={(() => {
                    const R = circle.radius;
                    const amp = Math.max(4, R * 0.08);
                    const baseR = R - amp - 4;
                    return getFlowerPath(R, R, baseR, 8, amp);
                  })()}
                  fill={MATERIAL_TONES[circle.tone].fill}
                  stroke={MATERIAL_TONES[circle.tone].border}
                  strokeWidth={selectedItem.type === 'circle' && selectedItem.id === circle.id ? 3.5 : 2}
                  filter="drop-shadow(0px 8px 16px rgba(0,0,0,0.06))"
                />
              </svg>
              <span className="circle__label">{circle.name}</span>
              <button
                type="button"
                className="circle-center"
                style={{
                  left: circle.radius,
                  top: circle.radius,
                  background: MATERIAL_TONES[circle.tone].centerBg,
                  borderColor: '#ffffff',
                }}
                onPointerDown={(event) => startCircleCenterDrag(event, circle)}
                onClick={(event) => {
                  event.stopPropagation()
                  setSelectedItem({ type: 'circle', id: circle.id })
                }}
                aria-label={`Select ${circle.name}`}
                title="Drag to move. Shift-drag to create from this center."
              >
                {circle.icon}
              </button>
            </section>
          ))}

          {graph.people.map((person) => (
            <button
              key={person.id}
              type="button"
              className={`person ${selectedItem.type === 'person' && selectedItem.id === person.id ? 'is-selected' : ''}`}
              style={{ transform: `translate(${person.x}px, ${person.y}px)` }}
              onPointerDown={(event) => startPersonMove(event, person)}
              onClick={() => setSelectedItem({ type: 'person', id: person.id })}
              aria-label={`Select ${person.name}`}
              title="Drag to move this person"
            >
              <span
                style={{
                  position: 'relative',
                  width: 32,
                  height: 32,
                  background: 'transparent',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <svg
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    overflow: 'visible',
                  }}
                >
                  <path
                    d={getFlowerPath(16, 16, 12.5, 6, 2.5)}
                    fill={(() => {
                      const parentCircle = circlesById.get(person.circleId)
                      return parentCircle ? MATERIAL_TONES[parentCircle.tone].centerBg : '#3F51B5'
                    })()}
                    stroke={(() => {
                      const parentCircle = circlesById.get(person.circleId)
                      return parentCircle ? MATERIAL_TONES[parentCircle.tone].border : '#ffffff'
                    })()}
                    strokeWidth={1.5}
                  />
                </svg>
                <span
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    color: '#ffffff',
                    fontSize: 10,
                    fontWeight: 900,
                  }}
                >
                  {person.avatar}
                </span>
              </span>
              <strong>{person.name}</strong>
            </button>
          ))}

          {stressPeople.map((person) => (
            <button
              key={person.id}
              type="button"
              className={`person person--stress ${stress.showLabels ? '' : 'person--icon-only'}`}
              style={{ transform: `translate(${person.x}px, ${person.y}px)` }}
              aria-label={person.name}
              tabIndex={-1}
            >
              <span
                style={{
                  position: 'relative',
                  width: 32,
                  height: 32,
                  background: 'transparent',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <svg
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    overflow: 'visible',
                  }}
                >
                  <path d={getFlowerPath(16, 16, 12.5, 6, 2.5)} fill={person.role} stroke="#ffffff" strokeWidth={1.5} />
                </svg>
                <span
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    color: '#ffffff',
                    fontSize: 10,
                    fontWeight: 900,
                  }}
                >
                  {person.avatar}
                </span>
              </span>
              {stress.showLabels ? <strong>{person.name}</strong> : null}
            </button>
          ))}
        </div>
      </div>

      {createMenu ? (
        <div className="create-menu" style={menuPosition(createMenu)}>
          <button type="button" onClick={createPerson}>
            <PersonIcon />
            <span>Add person here</span>
          </button>
          <button type="button" onClick={() => createCircle('nested')}>
            <SubsetIcon />
            <span>Add subset inside source circle</span>
          </button>
          <button type="button" onClick={() => createCircle('external')}>
            <CircleIcon />
            <span>Create connected circle outside</span>
          </button>
        </div>
      ) : null}

      <aside className="inspector" aria-label="Selection details">
        <span className="inspector__eyebrow">{selectedItem.type === 'circle' ? 'Circle center' : 'Person'}</span>
        <input
          value={selectedCircle?.name ?? selectedPerson?.name ?? ''}
          onChange={(event) => renameSelected(event.target.value)}
          aria-label="Selected item name"
        />
        {selectedCircle ? (
          <>
            <dl>
              <div>
                <dt>People</dt>
                <dd>{graph.people.filter((person) => person.circleId === selectedCircle.id).length}</dd>
              </div>
              <div>
                <dt>Nested circles</dt>
                <dd>{graph.circles.filter((circle) => circle.parentId === selectedCircle.id).length}</dd>
              </div>
              <div>
                <dt>Tone</dt>
                <dd>{TONE_LABELS[selectedCircle.tone]}</dd>
              </div>
              <div>
                <dt>Radius</dt>
                <dd>{Math.round(selectedCircle.radius)} px</dd>
              </div>
            </dl>
            <button type="button" className="primary-action" onClick={addDemoCluster}>
              Add 3 demo people
            </button>
          </>
        ) : null}
        {selectedPerson ? (
          <dl>
            <div>
              <dt>Role</dt>
              <dd>{selectedPerson.role}</dd>
            </div>
            <div>
              <dt>Circle</dt>
              <dd>{circlesById.get(selectedPerson.circleId)?.name}</dd>
            </div>
          </dl>
        ) : null}
        <p>Drag objects directly. Right-click a circle for creation actions. Parent circles auto-fit as contained objects move.</p>
      </aside>
    </main>
  )
}

function useFrameRate() {
  const [fps, setFps] = useState(0)

  useEffect(() => {
    let frameCount = 0
    let lastMeasuredAt = performance.now()
    let animationFrameId = 0

    function tick(now: number) {
      frameCount += 1
      if (now - lastMeasuredAt >= 500) {
        setFps(Math.round((frameCount * 1000) / (now - lastMeasuredAt)))
        frameCount = 0
        lastMeasuredAt = now
      }

      animationFrameId = window.requestAnimationFrame(tick)
    }

    animationFrameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(animationFrameId)
  }, [])

  return fps
}

function generateStressPeople(count: number): PersonNode[] {
  const colors = ['#00629D', '#C00015', '#1E824A', '#D87A00', '#7F67BE', '#0F766E', '#4F46E5', '#BE185D']
  const people: PersonNode[] = []

  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.399963229728653
    const ring = Math.floor(Math.sqrt(index))
    const radius = 185 + ring * 15
    const jitter = (seededRandom(index + 11) - 0.5) * 18

    people.push({
      id: `stress-${index}`,
      name: `Stress ${index + 1}`,
      role: colors[index % colors.length],
      x: Math.cos(angle) * (radius + jitter),
      y: Math.sin(angle) * (radius + jitter),
      circleId: 'you',
      avatar: makeAvatar(index),
    })
  }

  return people
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function createInitialGraph() {
  return ensureContainment({
    circles: DEFAULT_STATE.circles.map((circle) => ({ ...circle })),
    people: DEFAULT_STATE.people.map((person) => ({ ...person })),
  })
}

function moveCircleSubtree(state: GraphState, circleId: string, nextX: number, nextY: number): GraphState {
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
      subtreeIds.has(person.circleId) ? { ...person, x: person.x + deltaX, y: person.y + deltaY } : person,
    ),
  }
}

function resizeCircleFromPoint(state: GraphState, circleId: string, point: { x: number; y: number }): GraphState {
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

function ensureContainment(state: GraphState): GraphState {
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

function getDescendantCircleIds(circles: CircleNode[], circleId: string) {
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

function makeCurve(from: { x: number; y: number }, to: { x: number; y: number }) {
  const midX = (from.x + to.x) / 2
  const lift = Math.min(100, Math.abs(to.y - from.y) * 0.22 + 38)
  return `M ${from.x} ${from.y} C ${midX} ${from.y - lift}, ${midX} ${to.y + lift}, ${to.x} ${to.y}`
}

function menuPosition(menu: CreateMenu) {
  return {
    left: Math.min(window.innerWidth - 308, Math.max(14, menu.screenX + 12)),
    top: Math.min(window.innerHeight - 190, Math.max(74, menu.screenY + 12)),
  }
}

function makeAvatar(index: number) {
  const names = ['AL', 'BD', 'CE', 'DK', 'EV', 'FX', 'GN', 'HM', 'IR']
  return names[index % names.length]
}

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function nextTone(index: number): CircleTone {
  return (['blue', 'red', 'green', 'amber', 'violet'] as CircleTone[])[index % 5]
}

function ZoomInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M16 16l4 4M10.5 7.5v6M7.5 10.5h6" />
    </svg>
  )
}

function ZoomOutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M16 16l4 4M7.5 10.5h6" />
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12a8 8 0 1 0 2.34-5.66" />
      <path d="M4 5v6h6" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}

function SubsetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function CircleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" />
    </svg>
  )
}

export default App
