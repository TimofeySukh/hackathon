import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'

type CircleTone = 'blue' | 'red' | 'green' | 'amber' | 'violet'

type CircleNode = {
  id: string
  name: string
  icon: string
  x: number
  y: number
  radius: number
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

const MIN_SCALE = 0.35
const MAX_SCALE = 1.8
const CONNECT_THRESHOLD = 40
const DEFAULT_STATE: GraphState = {
  circles: [
    {
      id: 'you',
      name: 'You',
      icon: 'YOU',
      x: 0,
      y: 0,
      radius: 126,
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

function App() {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const panRef = useRef<PanState | null>(null)
  const moveCircleRef = useRef<MoveCircleState | null>(null)
  const [graph, setGraph] = useState(DEFAULT_STATE)
  const [camera, setCamera] = useState<Camera>({ x: window.innerWidth / 2, y: window.innerHeight / 2, scale: 0.82 })
  const [connector, setConnector] = useState<DragConnector | null>(null)
  const [createMenu, setCreateMenu] = useState<CreateMenu | null>(null)
  const [selectedItem, setSelectedItem] = useState<SelectedItem>({ type: 'circle', id: 'you' })

  const circlesById = useMemo(() => new Map(graph.circles.map((circle) => [circle.id, circle])), [graph.circles])
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
      setGraph((current) => ({
        ...current,
        circles: current.circles.map((circle) =>
          circle.id === moving.circleId ? { ...circle, x: moving.originX + deltaX, y: moving.originY + deltaY } : circle,
        ),
      }))
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

  function startConnector(event: ReactPointerEvent<HTMLButtonElement>, circle: CircleNode) {
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

  function startCircleMove(event: ReactPointerEvent<HTMLButtonElement>, circle: CircleNode) {
    if (event.altKey || circle.id === 'you') return
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

  function createPerson() {
    if (!createMenu) return

    const source = circlesById.get(createMenu.sourceCircleId)
    if (!source) return

    const id = `person-${Date.now()}`
    setGraph((current) => ({
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
    }))
    setSelectedItem({ type: 'person', id })
    setCreateMenu(null)
  }

  function createCircle(mode: 'nested' | 'external') {
    if (!createMenu) return

    const source = circlesById.get(createMenu.sourceCircleId)
    if (!source) return

    const id = `circle-${Date.now()}`
    const isNested = mode === 'nested'
    setGraph((current) => ({
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
          parentId: isNested ? source.id : null,
          connectedTo: source.id,
          tone: isNested ? 'violet' : nextTone(current.circles.length),
        },
      ],
    }))
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
    setGraph((current) => ({ ...current, people: [...current.people, ...points] }))
  }

  function resetDemo() {
    setGraph(DEFAULT_STATE)
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
            {connector ? <path className="edge edge--draft" d={makeCurve({ x: connector.startX, y: connector.startY }, { x: connector.endX, y: connector.endY })} /> : null}
          </g>
        </svg>

        <div className="world-layer" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}>
          {graph.circles.map((circle) => (
            <section
              key={circle.id}
              className={`circle circle--${circle.tone} ${selectedItem.type === 'circle' && selectedItem.id === circle.id ? 'is-selected' : ''}`}
              style={{
                width: circle.radius * 2,
                height: circle.radius * 2,
                transform: `translate(${circle.x - circle.radius}px, ${circle.y - circle.radius}px)`,
              }}
              onPointerDown={(event) => {
                event.stopPropagation()
                setSelectedItem({ type: 'circle', id: circle.id })
              }}
            >
              <span className="circle__label">{circle.name}</span>
              <button
                type="button"
                className="circle-center"
                style={{ left: circle.radius, top: circle.radius }}
                onPointerDown={(event) => startCircleMove(event, circle)}
                onClick={(event) => {
                  event.stopPropagation()
                  setSelectedItem({ type: 'circle', id: circle.id })
                }}
                aria-label={`Select ${circle.name}`}
                title={circle.id === 'you' ? 'Central circle' : 'Drag to move this circle'}
              >
                {circle.icon}
              </button>
              <button
                type="button"
                className="connector-handle"
                style={{ left: circle.radius + 34, top: circle.radius - 8 }}
                onPointerDown={(event) => startConnector(event, circle)}
                aria-label={`Drag from ${circle.name} to create a person or circle`}
                title="Drag to create"
              >
                <PlusIcon />
              </button>
            </section>
          ))}

          {graph.people.map((person) => (
            <button
              key={person.id}
              type="button"
              className={`person ${selectedItem.type === 'person' && selectedItem.id === person.id ? 'is-selected' : ''}`}
              style={{ transform: `translate(${person.x}px, ${person.y}px)` }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setSelectedItem({ type: 'person', id: person.id })}
              aria-label={`Select ${person.name}`}
            >
              <span>{person.avatar}</span>
              <strong>{person.name}</strong>
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
        <p>Drag the small plus handle from any circle center. People are endpoints; circle centers can create the next connection.</p>
      </aside>
    </main>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
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
