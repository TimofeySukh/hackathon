import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
// STRESS TEST — dev-only performance harness. See src/lib/stressTest.ts.
import {
  STRESS_TEST_ENABLED,
  STRESS_DEFAULT_CONFIG,
  STRESS_LIMITS,
  generateStressGraph,
  type StressConfig,
} from './lib/stressTest'

export type CircleTone = 'blue' | 'red' | 'green' | 'amber' | 'violet'

export type ShapeType = 'circle' | 'wavy' | 'polygon'

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
}

type PersonNote = {
  id: string
  title: string
  body: string
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
}

export type Connection = {
  id: string
  fromId: string
  toId: string
}

type GraphState = {
  circles: CircleNode[]
  people: PersonNode[]
  connections: Connection[]
}

type Camera = {
  x: number
  y: number
  scale: number
}

type DragConnector = {
  sourceId: string
  sourceType: 'circle' | 'person'
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
  dragSourceId?: string
  dragSourceType?: 'circle' | 'person'
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
  | {
      type: 'connection'
      id: string
    }
  | null

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
// Render only nodes inside the viewport, padded by this fraction on each side so
// small pans reveal already-rendered nodes before the gesture settles.
const CULL_OVERSCAN = 0.45
// Below this zoom, individual people are sub-10px and illegible — skip drawing
// them (and their edges) so surveying the whole board stays cheap (LOD).
const PEOPLE_LOD_SCALE = 0.5
const CONNECT_THRESHOLD = 40
const MIN_CIRCLE_RADIUS = 72
const EDGE_RESIZE_HIT_SIZE = 18
const PERSON_CONTAINMENT_RADIUS = 62
const CIRCLE_CONTAINMENT_PADDING = 28

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
      shapeType: 'wavy',
      sides: 12,
      amplitude: 7,
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
      shapeType: 'wavy',
      sides: 25,
      amplitude: 15,
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
      shapeType: 'wavy',
      sides: 27,
      amplitude: 16,
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
      shapeType: 'wavy',
      sides: 8,
      amplitude: 5,
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
      shapeType: 'wavy',
      sides: 23,
      amplitude: 14,
    },
  ],
  people: [
    {
      id: 'p1',
      name: 'Mia',
      role: 'Close friend',
      x: -62,
      y: -54,
      circleId: 'you',
      avatar: 'MI',
      shapeType: 'wavy',
      sides: 8,
      amplitude: 1,
      notes: [
        { id: 'note-1', title: 'Gift ideas', body: 'Likes sci-fi books and matcha latte' },
        { id: 'note-2', title: 'Meeting notes', body: 'Sync up next Tuesday about project timeline' }
      ]
    },
    {
      id: 'p2',
      name: 'Noah',
      role: 'Founder friend',
      x: 58,
      y: -6,
      circleId: 'you',
      avatar: 'NO',
      shapeType: 'wavy',
      sides: 10,
      amplitude: 1,
      notes: [
        { id: 'note-3', title: 'Joint project', body: 'Wants to co-host a demo next month' }
      ]
    },
    { id: 'p3', name: 'Ava', role: 'Design', x: 34, y: 67, circleId: 'you', avatar: 'AV', shapeType: 'wavy', sides: 11, amplitude: 1 },
    { id: 'p4', name: 'Sofia', role: 'Portugal', x: 168, y: -472, circleId: 'eu-network', avatar: 'SO', shapeType: 'wavy', sides: 9, amplitude: 1 },
    { id: 'p5', name: 'Lucas', role: 'Germany', x: 28, y: -610, circleId: 'eu-network', avatar: 'LU', shapeType: 'wavy', sides: 12, amplitude: 1 },
    { id: 'p6', name: 'Emma', role: 'Finland', x: -112, y: -416, circleId: 'eu-network', avatar: 'EM', shapeType: 'wavy', sides: 8, amplitude: 1 },
    { id: 'p7', name: 'Oscar', role: 'Denmark', x: 106, y: -302, circleId: 'eu-network', avatar: 'OC', shapeType: 'wavy', sides: 10, amplitude: 1 },
    { id: 'p8', name: 'Olivia', role: 'Brand', x: -166, y: 335, circleId: 'pandora', avatar: 'OL', shapeType: 'wavy', sides: 11, amplitude: 1 },
    { id: 'p9', name: 'Victor', role: 'Retail', x: 154, y: 360, circleId: 'pandora', avatar: 'VI', shapeType: 'wavy', sides: 9, amplitude: 1 },
    { id: 'p10', name: 'Freja', role: 'Operations', x: -190, y: 575, circleId: 'pandora', avatar: 'FR', shapeType: 'wavy', sides: 12, amplitude: 1 },
    { id: 'p11', name: 'Anton', role: 'PM', x: -92, y: 575, circleId: 'product-team', avatar: 'AN', shapeType: 'wavy', sides: 8, amplitude: 1 },
    { id: 'p12', name: 'Nora', role: 'UX', x: -20, y: 591, circleId: 'product-team', avatar: 'NR', shapeType: 'wavy', sides: 10, amplitude: 1 },
    { id: 'p13', name: 'Eli', role: 'Engineering', x: 50, y: 575, circleId: 'product-team', avatar: 'EL', shapeType: 'wavy', sides: 11, amplitude: 1 },
    { id: 'p14', name: 'Karim', role: 'Investor', x: 645, y: -15, circleId: 'market', avatar: 'KA', shapeType: 'wavy', sides: 9, amplitude: 1 },
    { id: 'p15', name: 'Lina', role: 'Media', x: 423, y: 4, circleId: 'market', avatar: 'LI', shapeType: 'wavy', sides: 12, amplitude: 1 },
    { id: 'p16', name: 'Yara', role: 'Analyst', x: 580, y: 198, circleId: 'market', avatar: 'YA', shapeType: 'wavy', sides: 8, amplitude: 1 },
  ],
  connections: [],
}

const MATERIAL_TONES: Record<CircleTone, { fill: string; border: string; text: string; centerBg: string }> = {
  blue: { fill: '#D2E4FF', border: '#004A77', text: '#001D35', centerBg: '#00629D' },
  red: { fill: '#FFDAD6', border: '#BA1A1A', text: '#410002', centerBg: '#C00015' },
  green: { fill: '#D1E8D2', border: '#0F6D38', text: '#00210B', centerBg: '#1E824A' },
  amber: { fill: '#FFE082', border: '#B06000', text: '#2A1400', centerBg: '#D87A00' },
  violet: { fill: '#EADDFF', border: '#6750A4', text: '#21005D', centerBg: '#7F67BE' },
}

function getNodePath(
  cx: number,
  cy: number,
  r: number,
  shapeType: ShapeType,
  sides: number,
  amplitude: number
) {
  if (shapeType === 'circle' || (shapeType === 'wavy' && amplitude === 0)) {
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

  if (shapeType === 'polygon' && amplitude === 0) {
    let path = ''
    const angleStep = (2 * Math.PI) / sides
    for (let i = 0; i < sides; i++) {
      const angle = i * angleStep - Math.PI / 2
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
  const softness = Math.min(1.0, Math.max(0.0, amplitude / 20.0))
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

function App() {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const panRef = useRef<PanState | null>(null)
  const moveCircleRef = useRef<MoveCircleState | null>(null)
  const movePersonRef = useRef<MovePersonState | null>(null)
  const resizeCircleRef = useRef<ResizeCircleState | null>(null)
  const [graph, setGraph] = useState(createInitialGraph)
  const [camera, setCamera] = useState<Camera>({ x: window.innerWidth / 2, y: window.innerHeight / 2, scale: 0.82 })
  // cameraRef holds the *live* camera during a pan/zoom gesture. `camera` state
  // is only the last *settled* value (committed when the gesture stops moving).
  const cameraRef = useRef(camera)
  const worldLayerRef = useRef<HTMLDivElement | null>(null)
  // Gesture machinery: during a pan/zoom we drive the DOM transform + canvas
  // imperatively (no React re-render), then commit to state once it settles.
  const gestureActiveRef = useRef(false)
  const gestureRafRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const driveCameraRef = useRef<(next: Camera) => void>(() => {})
  const settleGestureRef = useRef<() => void>(() => {})

  const [connector, setConnector] = useState<DragConnector | null>(null)
  const [createMenu, setCreateMenu] = useState<CreateMenu | null>(null)
  const [selectedItem, setSelectedItem] = useState<SelectedItem>({ type: 'circle', id: 'you' })
  // STRESS TEST — synthetic-load config (circles / people / cross-links).
  const [stress, setStress] = useState<StressConfig>(STRESS_DEFAULT_CONFIG)
  // Viewport size in CSS px, used to cull off-screen nodes. Updated on resize.
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })

  const [showSettings, setShowSettings] = useState(false)
  const [centerBehavior, setCenterBehavior] = useState<'connect' | 'move'>('connect')
  const [hoveredConnId, setHoveredConnId] = useState<string | null>(null)
  const [openNotesPersonId, setOpenNotesPersonId] = useState<string | null>(null)
  const [newNoteBody, setNewNoteBody] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)

  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const settingsPanelRef = useRef<HTMLDivElement>(null)

  function deletePerson(personId: string) {
    setGraph((current) => ({
      ...current,
      people: current.people.filter((p) => p.id !== personId),
      connections: (current.connections || []).filter(
        (conn) => conn.fromId !== personId && conn.toId !== personId
      ),
    }))
    setSelectedItem(null)
  }

  function togglePersonFavorite(personId: string) {
    setGraph((current) => ({
      ...current,
      people: current.people.map((p) =>
        p.id === personId ? { ...p, isFavorite: !p.isFavorite } : p
      ),
    }))
  }

  function addPersonNote(personId: string, title: string, body: string) {
    setGraph((current) => ({
      ...current,
      people: current.people.map((p) => {
        if (p.id === personId) {
          const notes = p.notes ? [...p.notes] : []
          notes.push({ id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, title, body })
          return { ...p, notes }
        }
        return p
      }),
    }))
  }

  function updatePersonNote(personId: string, noteId: string, title: string, body: string) {
    setGraph((current) => ({
      ...current,
      people: current.people.map((p) => {
        if (p.id === personId && p.notes) {
          const notes = p.notes.map((n) =>
            n.id === noteId ? { ...n, title, body } : n
          )
          return { ...p, notes }
        }
        return p
      }),
    }))
  }

  function deletePersonNote(personId: string, noteId: string) {
    setGraph((current) => ({
      ...current,
      people: current.people.map((p) => {
        if (p.id === personId && p.notes) {
          const notes = p.notes.filter((n) => n.id !== noteId)
          return { ...p, notes }
        }
        return p
      }),
    }))
  }

  function deleteCircle(circleId: string) {
    if (circleId === 'you') return

    setGraph((current) => {
      // 1. Gather all descendant circle IDs recursively
      const deletedCircleIds = new Set<string>([circleId])
      let expanded = true
      while (expanded) {
        expanded = false
        for (const c of current.circles) {
          if (c.parentId && deletedCircleIds.has(c.parentId) && !deletedCircleIds.has(c.id)) {
            deletedCircleIds.add(c.id)
            expanded = true
          }
        }
      }

      // 2. Identify people inside those circles
      const deletedPeopleIds = new Set<string>()
      for (const p of current.people) {
        if (deletedCircleIds.has(p.circleId)) {
          deletedPeopleIds.add(p.id)
        }
      }

      // 3. Filter circles: remove deleted, update connectedTo if it points to a deleted circle
      const nextCircles = current.circles
        .filter((c) => !deletedCircleIds.has(c.id))
        .map((c) => {
          if (c.connectedTo && deletedCircleIds.has(c.connectedTo)) {
            return { ...c, connectedTo: 'you' }
          }
          return c
        })

      // 4. Filter people: remove deleted
      const nextPeople = current.people.filter((p) => !deletedPeopleIds.has(p.id))

      // 5. Filter connections: remove if fromId or toId is deleted
      const nextConnections = (current.connections || []).filter(
        (conn) =>
          !deletedPeopleIds.has(conn.fromId) &&
          !deletedCircleIds.has(conn.fromId) &&
          !deletedPeopleIds.has(conn.toId) &&
          !deletedCircleIds.has(conn.toId)
      )

      return ensureContainment({
        ...current,
        circles: nextCircles,
        people: nextPeople,
        connections: nextConnections,
      })
    })

    setSelectedItem(null)
  }

  function deleteConnection(connId: string) {
    setGraph((current) => ({
      ...current,
      connections: (current.connections || []).filter((conn) => conn.id !== connId),
    }))
    setSelectedItem(null)
  }

  useEffect(() => {
    cameraRef.current = camera
  }, [camera])

  useEffect(() => {
    function handleOutsideClick(event: PointerEvent) {
      if (
        showSettings &&
        settingsPanelRef.current &&
        !settingsPanelRef.current.contains(event.target as Node) &&
        settingsButtonRef.current &&
        !settingsButtonRef.current.contains(event.target as Node)
      ) {
        setShowSettings(false)
      }
    }
    document.addEventListener('pointerdown', handleOutsideClick)
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick)
    }
  }, [showSettings])

  useEffect(() => {
    function handleOutsideNotesClick(event: PointerEvent) {
      if (openNotesPersonId === null) return
      const target = event.target as HTMLElement
      if (target.closest('.notes-popover') || target.closest('.notes-btn')) {
        return
      }
      setOpenNotesPersonId(null)
    }
    document.addEventListener('pointerdown', handleOutsideNotesClick)
    return () => {
      document.removeEventListener('pointerdown', handleOutsideNotesClick)
    }
  }, [openNotesPersonId])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const activeEl = document.activeElement
        if (
          activeEl &&
          (activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.getAttribute('contenteditable') === 'true')
        ) {
          return
        }

        if (selectedItem?.type === 'person') {
          deletePerson(selectedItem.id)
        } else if (selectedItem?.type === 'circle') {
          deleteCircle(selectedItem.id)
        } else if (selectedItem?.type === 'connection') {
          deleteConnection(selectedItem.id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItem])

  // STRESS TEST — generate real synthetic entities (circles, people, links)
  // and merge them into the arrays that feed the render passes, so they go
  // through the exact same React DOM + SVG path as production data.
  const stressGraph = useMemo(() => generateStressGraph(stress), [stress])
  const displayCircles = useMemo(
    () => (stressGraph.circles.length ? [...graph.circles, ...stressGraph.circles] : graph.circles),
    [graph.circles, stressGraph.circles],
  )
  const displayPeople = useMemo(
    () => (stressGraph.people.length ? [...graph.people, ...stressGraph.people] : graph.people),
    [graph.people, stressGraph.people],
  )
  const displayConnections = useMemo(
    () =>
      stressGraph.connections.length
        ? [...(graph.connections || []), ...stressGraph.connections]
        : graph.connections || [],
    [graph.connections, stressGraph.connections],
  )

  const circlesById = useMemo(() => new Map(displayCircles.map((circle) => [circle.id, circle])), [displayCircles])
  const peopleById = useMemo(() => new Map(displayPeople.map((person) => [person.id, person])), [displayPeople])
  const renderedPeopleCount = displayPeople.length
  const renderedCircleCount = displayCircles.length
  const renderedEdgeCount =
    displayCircles.filter((circle) => circle.connectedTo).length + displayPeople.length + displayConnections.length
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
    return [...displayCircles].sort((a, b) => getDepth(a.parentId) - getDepth(b.parentId))
  }, [displayCircles, circlesById])

  // VIEWPORT CULLING — derive the visible world rectangle from the settled
  // camera, padded by CULL_OVERSCAN. During a gesture `camera` is frozen (only
  // cameraRef moves), so these sets stay stable and the GPU-composited world
  // layer just translates them; on settle they refresh. Keeping the rendered
  // set small makes both React reconciliation and layer rasterization cheap.
  const visibleWorld = useMemo(() => {
    const s = camera.scale
    const left = -camera.x / s
    const top = -camera.y / s
    const right = (viewport.w - camera.x) / s
    const bottom = (viewport.h - camera.y) / s
    const mx = (right - left) * CULL_OVERSCAN
    const my = (bottom - top) * CULL_OVERSCAN
    return { left: left - mx, right: right + mx, top: top - my, bottom: bottom + my }
  }, [camera, viewport])

  const visibleCircles = useMemo(
    () =>
      sortedCircles.filter(
        (c) =>
          c.x + c.radius >= visibleWorld.left &&
          c.x - c.radius <= visibleWorld.right &&
          c.y + c.radius >= visibleWorld.top &&
          c.y - c.radius <= visibleWorld.bottom,
      ),
    [sortedCircles, visibleWorld],
  )

  // LOD — when zoomed far out, individual people would be unreadable specks, so
  // we drop them (and their edges) entirely. At working zoom they're culled.
  const showPeople = camera.scale >= PEOPLE_LOD_SCALE
  const pointVisible = (n: { x: number; y: number }) =>
    n.x >= visibleWorld.left && n.x <= visibleWorld.right && n.y >= visibleWorld.top && n.y <= visibleWorld.bottom
  const visiblePeople = useMemo(
    () => (showPeople ? displayPeople.filter(pointVisible) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayPeople, visibleWorld, showPeople],
  )
  const visibleConnections = useMemo(() => {
    if (!showPeople) return []
    return displayConnections.filter((conn) => {
      const a = peopleById.get(conn.fromId) || circlesById.get(conn.fromId)
      const b = peopleById.get(conn.toId) || circlesById.get(conn.toId)
      if (!a || !b) return false
      return pointVisible(a) || pointVisible(b)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayConnections, peopleById, circlesById, visibleWorld, showPeople])

  const drawnNodeCount = visibleCircles.length + visiblePeople.length

  const selectedCircle = selectedItem?.type === 'circle' ? circlesById.get(selectedItem.id) ?? null : null
  const selectedPerson = selectedItem?.type === 'person' ? graph.people.find((person) => person.id === selectedItem.id) ?? null : null
  const selectedConnection = selectedItem?.type === 'connection' ? (graph.connections || []).find((conn) => conn.id === selectedItem.id) ?? null : null

  // Push the live camera onto the DOM (world transform + dotted grid) without
  // going through React. Cheap: one style write, the browser composites it.
  function applyDomCamera(cam: Camera) {
    const world = worldLayerRef.current
    if (world) world.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})`
    const surface = surfaceRef.current
    if (surface) {
      const minor = 32 * cam.scale
      const major = 160 * cam.scale
      surface.style.backgroundSize = `${major}px ${major}px, ${minor}px ${minor}px`
      surface.style.backgroundPosition = `${cam.x}px ${cam.y}px`
    }
  }

  // One imperative frame of a gesture: move the DOM at the live camera.
  function applyLiveCamera() {
    applyDomCamera(cameraRef.current)
  }

  // Called on every pan/zoom event. Updates the live camera, schedules one
  // imperative repaint per frame, promotes the world to its own GPU layer
  // (so zoom scales the cached bitmap instead of repainting every vector),
  // and (re)arms the settle timer that commits a sharp render once you pause.
  function driveCamera(next: Camera) {
    cameraRef.current = next
    if (!gestureActiveRef.current) {
      gestureActiveRef.current = true
      worldLayerRef.current?.classList.add('is-gesturing')
    }
    if (gestureRafRef.current == null) {
      gestureRafRef.current = window.requestAnimationFrame(() => {
        gestureRafRef.current = null
        applyLiveCamera()
      })
    }
    if (settleTimerRef.current != null) window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = window.setTimeout(() => settleGestureRef.current(), 130)
  }

  // Gesture stopped (pointer up, or no wheel events for a beat): drop the GPU
  // layer and commit the live camera to React state, which repaints everything
  // sharp at the final position.
  function settleGesture() {
    if (!gestureActiveRef.current) return
    if (settleTimerRef.current != null) {
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
    if (gestureRafRef.current != null) {
      window.cancelAnimationFrame(gestureRafRef.current)
      gestureRafRef.current = null
    }
    gestureActiveRef.current = false
    worldLayerRef.current?.classList.remove('is-gesturing')
    setCamera(cameraRef.current)
  }

  // Keep stable refs pointing at the latest gesture closures (so the wheel
  // listener, registered once, always calls the current ones), and — if
  // anything re-renders App mid-gesture (e.g. the FPS meter ticks) — re-assert
  // the live transform before the browser paints so it can't snap back to the
  // stale settled camera.
  useLayoutEffect(() => {
    driveCameraRef.current = driveCamera
    settleGestureRef.current = settleGesture
    if (gestureActiveRef.current) applyDomCamera(cameraRef.current)
  })

  useEffect(() => () => {
    if (gestureRafRef.current != null) window.cancelAnimationFrame(gestureRafRef.current)
    if (settleTimerRef.current != null) window.clearTimeout(settleTimerRef.current)
  }, [])

  // Track viewport size so culling has the current visible rectangle.
  useEffect(() => {
    function handleResize() {
      setViewport({ w: window.innerWidth, h: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return

    function handleWheel(event: WheelEvent) {
      event.preventDefault()
      const activeSurface = surfaceRef.current
      if (!activeSurface) return
      const rect = activeSurface.getBoundingClientRect()
      if (!rect) return

      const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const currentCamera = cameraRef.current
      const before = {
        x: (pointer.x - currentCamera.x) / currentCamera.scale,
        y: (pointer.y - currentCamera.y) / currentCamera.scale,
      }

      if (event.ctrlKey) {
        const zoomIntensity = 0.015
        const nextScale = clamp(currentCamera.scale * Math.exp(-event.deltaY * zoomIntensity), MIN_SCALE, MAX_SCALE)
        driveCameraRef.current({
          scale: nextScale,
          x: pointer.x - before.x * nextScale,
          y: pointer.y - before.y * nextScale,
        })
      } else {
        driveCameraRef.current({
          ...currentCamera,
          x: currentCamera.x - event.deltaX,
          y: currentCamera.y - event.deltaY,
        })
      }
    }

    surface.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      surface.removeEventListener('wheel', handleWheel)
    }
  }, [])

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
    setSelectedItem(null)
    setOpenNotesPersonId(null)
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
      driveCamera({
        ...cameraRef.current,
        x: pan.originX + event.clientX - pan.startX,
        y: pan.originY + event.clientY - pan.startY,
      })
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
      settleGesture()
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
      const targetPerson = graph.people.find(
        (p) => Math.hypot(p.x - connector.endX, p.y - connector.endY) < 30
      )
      const targetCircle = graph.circles.find(
        (c) => Math.hypot(c.x - connector.endX, c.y - connector.endY) < 30
      )

      if (targetPerson && targetPerson.id !== connector.sourceId) {
        setGraph((current) => ({
          ...current,
          connections: [
            ...(current.connections || []),
            {
              id: `conn-${Date.now()}`,
              fromId: connector.sourceId,
              toId: targetPerson.id,
            },
          ],
        }))
      } else if (targetCircle && targetCircle.id !== connector.sourceId) {
        if (connector.sourceType === 'circle') {
          setGraph((current) => {
            const srcCircle = current.circles.find((c) => c.id === connector.sourceId)
            if (srcCircle && !srcCircle.connectedTo) {
              return {
                ...current,
                circles: current.circles.map((c) =>
                  c.id === connector.sourceId ? { ...c, connectedTo: targetCircle.id } : c
                ),
              }
            } else {
              return {
                ...current,
                connections: [
                  ...(current.connections || []),
                  {
                    id: `conn-${Date.now()}`,
                    fromId: connector.sourceId,
                    toId: targetCircle.id,
                  },
                ],
              }
            }
          })
        } else {
          setGraph((current) => ({
            ...current,
            connections: [
              ...(current.connections || []),
              {
                id: `conn-${Date.now()}`,
                fromId: connector.sourceId,
                toId: targetCircle.id,
              },
            ],
          }))
        }
      } else {
        if (connector.sourceType === 'circle') {
          setCreateMenu({
            sourceCircleId: connector.sourceId,
            x: connector.endX,
            y: connector.endY,
            screenX: event.clientX,
            screenY: event.clientY,
            dragSourceId: connector.sourceId,
            dragSourceType: 'circle',
          })
        } else if (connector.sourceType === 'person') {
          const person = graph.people.find((p) => p.id === connector.sourceId)
          const sourceCircleId = person ? person.circleId : 'you'
          setCreateMenu({
            sourceCircleId,
            x: connector.endX,
            y: connector.endY,
            screenX: event.clientX,
            screenY: event.clientY,
            dragSourceId: connector.sourceId,
            dragSourceType: 'person',
          })
        }
      }
    }
    setConnector(null)
  }

  function startConnector(
    event: ReactPointerEvent<HTMLElement>,
    sourceId: string,
    sourceType: 'circle' | 'person',
    startX: number,
    startY: number
  ) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setCreateMenu(null)
    setSelectedItem({ type: sourceType, id: sourceId })
    setConnector({
      sourceId,
      sourceType,
      startX,
      startY,
      endX: startX,
      endY: startY,
    })
  }

  function startCircleMove(event: ReactPointerEvent<Element>, circle: CircleNode) {
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
    if (centerBehavior === 'connect') {
      startConnector(event, circle.id, 'circle', circle.x, circle.y)
    } else {
      startCircleMove(event, circle)
    }
  }

  function startPersonConnection(event: ReactPointerEvent<HTMLElement>, person: PersonNode) {
    startConnector(event, person.id, 'person', person.x, person.y)
  }

  function startCircleSurfaceDrag(event: ReactPointerEvent<Element>, circle: CircleNode) {
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

  function openCircleCreateMenu(event: ReactMouseEvent<Element>, circle: CircleNode) {
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

  function startPersonMove(event: ReactPointerEvent<HTMLElement>, person: PersonNode) {
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

  function startCircleResize(event: ReactPointerEvent<Element>, circle: CircleNode) {
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
    const sides = Math.floor(Math.random() * 5) + 8
    setGraph((current) => {
      const nextGraph = ensureContainment({
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
            shapeType: 'wavy',
            sides,
            amplitude: 1,
          },
        ],
      })
      if (createMenu.dragSourceType === 'person' && createMenu.dragSourceId) {
        return {
          ...nextGraph,
          connections: [
            ...(nextGraph.connections || []),
            {
              id: `conn-${Date.now()}`,
              fromId: createMenu.dragSourceId,
              toId: id,
            },
          ],
        }
      }
      return nextGraph
    })
    setSelectedItem({ type: 'person', id })
    setCreateMenu(null)
  }

  function createCircle(mode: 'nested' | 'external') {
    if (!createMenu) return

    const source = circlesById.get(createMenu.sourceCircleId)
    if (!source) return

    const id = `circle-${Date.now()}`
    const isNested = mode === 'nested'
    setGraph((current) => {
      const nextGraph = ensureContainment({
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
            shapeType: isNested ? 'polygon' : 'wavy',
            sides: isNested ? 6 : 12,
            amplitude: isNested ? 4 : 8,
          },
        ],
      })
      if (createMenu.dragSourceType === 'person' && createMenu.dragSourceId) {
        return {
          ...nextGraph,
          connections: [
            ...(nextGraph.connections || []),
            {
              id: `conn-${Date.now()}`,
              fromId: createMenu.dragSourceId,
              toId: id,
            },
          ],
        }
      }
      return nextGraph
    })
    setSelectedItem({ type: 'circle', id })
    setCreateMenu(null)
  }

  function addDemoCluster() {
    const source = selectedCircle ?? circlesById.get('you')
    if (!source) return

    const nextIndex = graph.people.length + 1
    const points = [-58, 0, 58].map((offset, index) => {
      const sides = Math.floor(Math.random() * 5) + 8
      return {
        id: `person-${Date.now()}-${index}`,
        name: ['Alex', 'Daria', 'Sam'][index],
        role: `Added to ${source.name}`,
        x: source.x + offset,
        y: source.y + source.radius * 0.42 + index * 18,
        circleId: source.id,
        avatar: makeAvatar(nextIndex + index),
        shapeType: 'wavy' as ShapeType,
        sides,
        amplitude: 1,
      }
    })
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
    if (!selectedItem) return
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

  function updateCircleStyle(id: string, updates: Partial<CircleNode>) {
    setGraph((current) => ({
      ...current,
      circles: current.circles.map((circle) =>
        circle.id === id ? { ...circle, ...updates } : circle
      ),
    }))
  }

  function updatePersonStyle(id: string, updates: Partial<PersonNode>) {
    setGraph((current) => ({
      ...current,
      people: current.people.map((person) =>
        person.id === id ? { ...person, ...updates } : person
      ),
    }))
  }

  function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>, onComplete: (base64: string) => void) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        onComplete(reader.result)
      }
    }
    reader.readAsDataURL(file)
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
          <button
            ref={settingsButtonRef}
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            aria-label="Settings"
            style={{
              background: showSettings ? 'var(--md-secondary-container)' : 'transparent',
              color: showSettings ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)',
            }}
          >
            <SettingsIcon />
          </button>
        </div>
      </div>

      {showSettings && (
        <div
          ref={settingsPanelRef}
          className="settings-panel"
        >
          <strong style={{ fontSize: '16px', fontWeight: 500, color: 'var(--md-on-surface)' }}>
            Settings
          </strong>
          <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(28, 37, 40, 0.64)' }}>
              Circle Center Drag Behavior
            </label>
            <div
              style={{
                display: 'flex',
                border: '1px solid var(--md-outline-variant)',
                borderRadius: 'var(--md-r-full)',
                overflow: 'hidden',
                marginTop: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => setCenterBehavior('connect')}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  background: centerBehavior === 'connect' ? 'var(--md-secondary-container)' : 'transparent',
                  color: centerBehavior === 'connect' ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)',
                  cursor: 'pointer',
                }}
              >
                {centerBehavior === 'connect' && <CheckIcon />}
                <span>Draw connection</span>
              </button>
              <button
                type="button"
                onClick={() => setCenterBehavior('move')}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  background: centerBehavior === 'move' ? 'var(--md-secondary-container)' : 'transparent',
                  color: centerBehavior === 'move' ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)',
                  cursor: 'pointer',
                  borderLeft: '1px solid var(--md-outline-variant)',
                }}
              >
                {centerBehavior === 'move' && <CheckIcon />}
                <span>Move circle</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STRESS TEST — dev-only panel. Hidden when STRESS_TEST_ENABLED is false. */}
      {STRESS_TEST_ENABLED && (
        <section className="stress-panel" aria-label="Performance stress test controls">
          <div className="stress-panel__header">
            <strong>Real-node stress</strong>
            <FpsMeter />
          </div>
          <label className="stress-slider">
            <span>{stress.circleCount.toLocaleString('en-US')} circles</span>
            <input
              type="range"
              min="0"
              max={STRESS_LIMITS.circleCount}
              step="5"
              value={stress.circleCount}
              onChange={(event) => setStress((current) => ({ ...current, circleCount: Number(event.target.value) }))}
            />
          </label>
          <label className="stress-slider">
            <span>{stress.peoplePerCircle.toLocaleString('en-US')} people / circle</span>
            <input
              type="range"
              min="0"
              max={STRESS_LIMITS.peoplePerCircle}
              step="1"
              value={stress.peoplePerCircle}
              onChange={(event) => setStress((current) => ({ ...current, peoplePerCircle: Number(event.target.value) }))}
            />
          </label>
          <label className="stress-slider">
            <span>{stress.crossLinks.toLocaleString('en-US')} cross-links</span>
            <input
              type="range"
              min="0"
              max={STRESS_LIMITS.crossLinks}
              step="25"
              value={stress.crossLinks}
              onChange={(event) => setStress((current) => ({ ...current, crossLinks: Number(event.target.value) }))}
            />
          </label>
          <div className="stress-toggles" style={{ gap: '16px' }}>
            <button
              type="button"
              className="m3-text-button"
              onClick={() => setStress(STRESS_DEFAULT_CONFIG)}
            >
              Clear
            </button>
          </div>
          <dl>
            <div>
              <dt>Circles</dt>
              <dd>{renderedCircleCount.toLocaleString('en-US')}</dd>
            </div>
            <div>
              <dt>People</dt>
              <dd>{renderedPeopleCount.toLocaleString('en-US')}</dd>
            </div>
            <div>
              <dt>Edges</dt>
              <dd>{renderedEdgeCount.toLocaleString('en-US')}</dd>
            </div>
            <div>
              <dt>Drawn{!showPeople ? ' (LOD)' : ''}</dt>
              <dd>{drawnNodeCount.toLocaleString('en-US')}</dd>
            </div>
          </dl>
        </section>
      )}

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
        style={{
          backgroundSize: `${160 * camera.scale}px ${160 * camera.scale}px, ${32 * camera.scale}px ${32 * camera.scale}px`,
          backgroundPosition: `${camera.x}px ${camera.y}px`,
        }}
        onPointerDown={handleSurfacePointerDown}
        onPointerMove={handleSurfacePointerMove}
        onPointerUp={handleSurfacePointerUp}
        onPointerCancel={handleSurfacePointerUp}
      >
        <div ref={worldLayerRef} className="world-layer" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}>
          
          {/* PASS 1: Circle Fills and Borders */}
          {visibleCircles.map((circle) => (
            <div
              key={`body-${circle.id}`}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: circle.radius * 2,
                height: circle.radius * 2,
                transform: `translate(${circle.x - circle.radius}px, ${circle.y - circle.radius}px)`,
                pointerEvents: 'none',
              }}
            >
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
                <path
                  d={getNodePath(
                    circle.radius,
                    circle.radius,
                    circle.radius,
                    circle.shapeType ?? 'wavy',
                    circle.sides ?? Math.max(8, Math.round(circle.radius / 10)),
                    circle.amplitude ?? Math.max(4, circle.radius * 0.06)
                  )}
                  fill={MATERIAL_TONES[circle.tone].fill}
                  stroke={selectedItem?.type === 'circle' && selectedItem?.id === circle.id ? MATERIAL_TONES[circle.tone].border : 'none'}
                  strokeWidth={selectedItem?.type === 'circle' && selectedItem?.id === circle.id ? 3.5 : 0}
                  filter="drop-shadow(0px 8px 16px rgba(0,0,0,0.06))"
                  style={{ pointerEvents: 'auto', cursor: 'grab' }}
                  onContextMenu={(event) => openCircleCreateMenu(event, circle)}
                  onPointerDown={(event) => startCircleSurfaceDrag(event, circle)}
                />
              </svg>
            </div>
          ))}

          {/* PASS 2: Connection Edges */}
          <svg className="edge-layer" aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
            {visibleCircles.map((circle) => {
              const source = circle.connectedTo ? circlesById.get(circle.connectedTo) : null
              if (!source) return null
              return <path key={circle.id} className="edge edge--circle" d={makeCurve(source, circle)} />
            })}
            {visiblePeople.map((person) => {
              const circle = circlesById.get(person.circleId)
              if (!circle) return null
              return <path key={person.id} className="edge edge--person" d={makeCurve(circle, person)} />
            })}
            {visibleConnections.map((conn) => {
              const sourceNode = peopleById.get(conn.fromId) || circlesById.get(conn.fromId)
              const targetNode = peopleById.get(conn.toId) || circlesById.get(conn.toId)
              if (!sourceNode || !targetNode) return null
              const isSelected = selectedItem?.type === 'connection' && selectedItem?.id === conn.id
              const isHovered = hoveredConnId === conn.id
              return (
                <g key={conn.id}>
                  {/* Invisible overlay for easier hovering and clicking */}
                  <path
                    d={makeCurve(sourceNode, targetNode)}
                    stroke="transparent"
                    strokeWidth={16}
                    fill="none"
                    style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      setSelectedItem({ type: 'connection', id: conn.id })
                    }}
                    onMouseEnter={() => setHoveredConnId(conn.id)}
                    onMouseLeave={() => setHoveredConnId(null)}
                  />
                  {/* Visible path */}
                  <path
                    className={`edge edge--custom ${isSelected ? 'is-selected' : ''}`}
                    d={makeCurve(sourceNode, targetNode)}
                    stroke={isSelected ? '#00629d' : isHovered ? '#64748b' : '#94a3b8'}
                    strokeWidth={isSelected ? 4 : isHovered ? 3 : 2}
                    fill="none"
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              )
            })}
            {connector ? <path className="edge edge--draft" d={makeCurve({ x: connector.startX, y: connector.startY }, { x: connector.endX, y: connector.endY })} /> : null}
          </svg>

          {/* PASS 3: Circle Interactive Elements (Centers & Labels) */}
          {visibleCircles.map((circle) => (
            <section
              key={circle.id}
              className={`circle circle--${circle.tone} ${selectedItem?.type === 'circle' && selectedItem?.id === circle.id ? 'is-selected' : ''}`}
              style={{
                width: circle.radius * 2,
                height: circle.radius * 2,
                transform: `translate(${circle.x - circle.radius}px, ${circle.y - circle.radius}px)`,
                background: 'transparent',
                border: 'none',
                pointerEvents: 'none',
              }}
            >
              <span className="circle__label">{circle.name}</span>
              <div
                style={{
                  position: 'absolute',
                  left: circle.radius,
                  top: circle.radius,
                  width: 40,
                  height: 40,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                }}
              >
                <button
                  type="button"
                  className={`circle-center ${selectedItem?.type === 'circle' && selectedItem?.id === circle.id ? 'is-selected' : ''}`}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    background: circle.imageUrl ? 'transparent' : MATERIAL_TONES[circle.tone].centerBg,
                    border: 'none',
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: centerBehavior === 'connect' ? 'crosshair' : 'grab',
                    padding: 0,
                    outline: 'none',
                    pointerEvents: 'auto',
                    transform: 'none',
                  }}
                  onPointerDown={(event) => startCircleCenterDrag(event, circle)}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSelectedItem({ type: 'circle', id: circle.id })
                  }}
                  title="Drag to connect. Drag empty space inside circle to move."
                >
                  {circle.imageUrl ? (
                    <svg viewBox="0 0 40 40" style={{ width: 40, height: 40, borderRadius: '50%' }}>
                      <clipPath id={`clip-center-${circle.id}`}>
                        <circle cx="20" cy="20" r="17" />
                      </clipPath>
                      <circle cx="20" cy="20" r="17" fill={MATERIAL_TONES[circle.tone].centerBg} />
                      <image
                        href={circle.imageUrl}
                        x="3"
                        y="3"
                        width="34"
                        height="34"
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={`url(#clip-center-${circle.id})`}
                      />
                      <circle cx="20" cy="20" r="18.5" fill="none" stroke="#ffffff" strokeWidth="3" />
                    </svg>
                  ) : (
                    <span style={{ color: '#ffffff', fontSize: 10, fontWeight: 500 }}>{circle.icon}</span>
                  )}
                </button>

                {selectedItem?.type === 'circle' && selectedItem?.id === circle.id && (
                  <>
                    {/* Top dot */}
                    <div
                      style={{
                        position: 'absolute',
                        top: -20,
                        left: 5,
                        width: 30,
                        height: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        cursor: 'crosshair',
                        zIndex: 10,
                        pointerEvents: 'auto',
                        background: 'transparent',
                      }}
                      onPointerDown={(e) => startConnector(e, circle.id, 'circle', circle.x, circle.y)}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: MATERIAL_TONES[circle.tone].centerBg,
                          border: '2px solid #ffffff',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                          pointerEvents: 'none',
                          marginBottom: '-5px',
                        }}
                      />
                    </div>
                    {/* Bottom dot */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 40,
                        left: 5,
                        width: 30,
                        height: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        cursor: 'crosshair',
                        zIndex: 10,
                        pointerEvents: 'auto',
                        background: 'transparent',
                      }}
                      onPointerDown={(e) => startConnector(e, circle.id, 'circle', circle.x, circle.y)}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: MATERIAL_TONES[circle.tone].centerBg,
                          border: '2px solid #ffffff',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                          pointerEvents: 'none',
                          marginTop: '-5px',
                        }}
                      />
                    </div>
                    {/* Left dot */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 5,
                        left: -20,
                        width: 20,
                        height: 30,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        cursor: 'crosshair',
                        zIndex: 10,
                        pointerEvents: 'auto',
                        background: 'transparent',
                      }}
                      onPointerDown={(e) => startConnector(e, circle.id, 'circle', circle.x, circle.y)}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: MATERIAL_TONES[circle.tone].centerBg,
                          border: '2px solid #ffffff',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                          pointerEvents: 'none',
                          marginRight: '-5px',
                        }}
                      />
                    </div>
                    {/* Right dot */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 5,
                        left: 40,
                        width: 20,
                        height: 30,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        cursor: 'crosshair',
                        zIndex: 10,
                        pointerEvents: 'auto',
                        background: 'transparent',
                      }}
                      onPointerDown={(e) => startConnector(e, circle.id, 'circle', circle.x, circle.y)}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: MATERIAL_TONES[circle.tone].centerBg,
                          border: '2px solid #ffffff',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                          pointerEvents: 'none',
                          marginLeft: '-5px',
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </section>
          ))}

          {/* PASS 4: People Icons and Labels */}
          {visiblePeople.map((person) => {
            const isSelected = selectedItem?.type === 'person' && selectedItem?.id === person.id
            const parentCircle = circlesById.get(person.circleId)
            const personColor = parentCircle ? MATERIAL_TONES[parentCircle.tone].centerBg : '#3F51B5'
            const strokeColor = person.isFavorite
              ? '#ffff00' // Highly vibrant neon yellow
              : isSelected
              ? '#00629d' // Blue
              : personColor // Group tone
            const strokeWidth = person.isFavorite
              ? (isSelected ? 5.5 : 4.5)
              : (isSelected ? 2.5 : 1.5)

            return (
              <div
                key={person.id}
                className={`person-icon-only ${isSelected ? 'is-selected' : ''}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: 100,
                  height: 80,
                  transform: `translate(${person.x - 50}px, ${person.y - 20}px)`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'grab',
                  outline: 'none',
                }}
                onPointerDown={(event) => startPersonMove(event, person)}
                onClick={() => setSelectedItem({ type: 'person', id: person.id })}
                title="Drag to move this person"
              >
                <div
                  className={`person-avatar-shape ${isSelected ? 'is-selected' : ''}`}
                  style={{
                    position: 'relative',
                    width: 40,
                    height: 40,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <svg viewBox="0 0 40 40" style={{ width: 40, height: 40, overflow: 'visible' }}>
                    <defs>
                      <clipPath id={`clip-${person.id}`}>
                        <path d={getNodePath(20, 20, 18, person.shapeType ?? 'wavy', person.sides ?? 8, person.amplitude ?? 1)} />
                      </clipPath>
                    </defs>
                    {person.imageUrl ? (
                      <g>
                        {/* Outer stroke path (drawn first) at double width */}
                        <path
                          d={getNodePath(20, 20, 18, person.shapeType ?? 'wavy', person.sides ?? 8, person.amplitude ?? 1)}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={strokeWidth * 2}
                        />
                        {/* Background cover */}
                        <path
                          d={getNodePath(20, 20, 18, person.shapeType ?? 'wavy', person.sides ?? 8, person.amplitude ?? 1)}
                          fill={personColor}
                        />
                        <image
                          href={person.imageUrl}
                          x="0"
                          y="0"
                          width="40"
                          height="40"
                          preserveAspectRatio="xMidYMid slice"
                          clipPath={`url(#clip-${person.id})`}
                        />
                      </g>
                    ) : (
                      <g>
                        {/* Outer stroke path (drawn first) at double width */}
                        <path
                          d={getNodePath(20, 20, 18, person.shapeType ?? 'wavy', person.sides ?? 8, person.amplitude ?? 1)}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={strokeWidth * 2}
                        />
                        {/* Background cover */}
                        <path
                          d={getNodePath(20, 20, 18, person.shapeType ?? 'wavy', person.sides ?? 8, person.amplitude ?? 1)}
                          fill={personColor}
                        />
                        <text
                          x="20"
                          y="21"
                          fill="#ffffff"
                          fontSize="11"
                          fontWeight="500"
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          {person.avatar}
                        </text>
                      </g>
                    )}
                  </svg>

                  {/* 4 connection dots around selected person's avatar */}
                  {isSelected && (
                    <>
                      {/* Top dot */}
                      <div
                        style={{
                          position: 'absolute',
                          top: -20,
                          left: 5,
                          width: 30,
                          height: 20,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          cursor: 'crosshair',
                          zIndex: 10,
                          pointerEvents: 'auto',
                          background: 'transparent',
                        }}
                        onPointerDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          startPersonConnection(e, person)
                        }}
                      >
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: 'var(--md-primary)',
                            border: '2px solid #ffffff',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                            pointerEvents: 'none',
                            marginBottom: '-5px',
                          }}
                        />
                      </div>
                      {/* Bottom dot */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 40,
                          left: 5,
                          width: 30,
                          height: 20,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          cursor: 'crosshair',
                          zIndex: 10,
                          pointerEvents: 'auto',
                          background: 'transparent',
                        }}
                        onPointerDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          startPersonConnection(e, person)
                        }}
                      >
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: 'var(--md-primary)',
                            border: '2px solid #ffffff',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                            pointerEvents: 'none',
                            marginTop: '-5px',
                          }}
                        />
                      </div>
                      {/* Left dot */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 5,
                          left: -20,
                          width: 20,
                          height: 30,
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          cursor: 'crosshair',
                          zIndex: 10,
                          pointerEvents: 'auto',
                          background: 'transparent',
                        }}
                        onPointerDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          startPersonConnection(e, person)
                        }}
                      >
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: 'var(--md-primary)',
                            border: '2px solid #ffffff',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                            pointerEvents: 'none',
                            marginRight: '-5px',
                          }}
                        />
                      </div>
                      {/* Right dot */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 5,
                          left: 40,
                          width: 20,
                          height: 30,
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          cursor: 'crosshair',
                          zIndex: 10,
                          pointerEvents: 'auto',
                          background: 'transparent',
                        }}
                        onPointerDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          startPersonConnection(e, person)
                        }}
                      >
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: 'var(--md-primary)',
                            border: '2px solid #ffffff',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                            pointerEvents: 'none',
                            marginLeft: '-5px',
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
                <strong className="person-label">{person.name}</strong>
              </div>
            )
          })}

        </div>
      </div>

      {createMenu ? (
        <div className="create-menu" style={menuPosition(createMenu)}>
          {createMenu.dragSourceType === 'person' ? (
            <>
              <button type="button" onClick={createPerson}>
                <PersonIcon />
                <span>Add person</span>
              </button>
              <button type="button" onClick={() => createCircle('external')}>
                <CircleIcon />
                <span>Add circle</span>
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      ) : null}

      <aside className="inspector" aria-label="Selection details" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
        {selectedItem ? (
          <>
            <span className="inspector__eyebrow">
              {selectedItem.type === 'circle' ? 'Circle' : selectedItem.type === 'person' ? 'Person' : 'Connection'}
            </span>
            {selectedItem.type !== 'connection' ? (
              <input
                className="inspector__name-input"
                value={selectedCircle?.name ?? selectedPerson?.name ?? ''}
                onChange={(event) => renameSelected(event.target.value)}
                aria-label="Selected item name"
              />
            ) : (
              <div style={{ fontSize: '15px', fontWeight: 500, padding: '4px 0 12px 0', borderBottom: '1px solid rgba(28, 37, 40, 0.08)', marginBottom: '8px' }}>
                Relationship Link
              </div>
            )}
            
            {selectedCircle && (
              <>
                {/* Visual Settings Row: Color swatches + Avatar Photo Upload */}
                <div className="inspector-visual-row">
                  <div className="m3-color-swatches-container">
                    <label>Color Tone</label>
                    <div className="m3-color-swatches">
                      {(['blue', 'red', 'green', 'amber', 'violet'] as CircleTone[]).map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`m3-color-swatch m3-color-swatch--${t} ${selectedCircle.tone === t ? 'is-selected' : ''}`}
                          onClick={() => updateCircleStyle(selectedCircle.id, { tone: t })}
                          title={`Set tone to ${t}`}
                          aria-label={`Set tone to ${t}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="m3-avatar-picker-container">
                    <label>Photo</label>
                    <label className="m3-avatar-picker" title="Upload circle photo">
                      <input
                        type="file"
                        accept="image/*"
                        className="m3-file-input-hidden"
                        onChange={(e) => handleImageUpload(e, (base64) => updateCircleStyle(selectedCircle.id, { imageUrl: base64 }))}
                      />
                      {selectedCircle.imageUrl ? (
                        <img src={selectedCircle.imageUrl} alt="Circle avatar" />
                      ) : (
                        <svg className="m3-avatar-picker-default-icon" viewBox="0 0 24 24">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                      )}
                      <div className="m3-avatar-picker-overlay">
                        <UploadIcon />
                      </div>
                    </label>
                  </div>
                </div>

                {/* Shape Type Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                  <div className="inspector-field">
                    <label>Shape Type</label>
                    <div className="m3-segmented-button">
                      <button
                        type="button"
                        className={`m3-segmented-button-item ${(!selectedCircle.shapeType || selectedCircle.shapeType === 'wavy') ? 'is-selected' : ''}`}
                        onClick={() => {
                          const updates: Partial<CircleNode> = { shapeType: 'wavy' }
                          if ((selectedCircle.amplitude ?? 5) > 50) {
                            updates.amplitude = 15
                          }
                          updateCircleStyle(selectedCircle.id, updates)
                        }}
                      >
                        Wavy
                      </button>
                      <button
                        type="button"
                        className={`m3-segmented-button-item ${selectedCircle.shapeType === 'polygon' ? 'is-selected' : ''}`}
                        onClick={() => {
                          const updates: Partial<CircleNode> = { shapeType: 'polygon' }
                          if ((selectedCircle.amplitude ?? 5) > 20) {
                            updates.amplitude = 8
                          }
                          updateCircleStyle(selectedCircle.id, updates)
                        }}
                      >
                        Polygon
                      </button>
                      <button
                        type="button"
                        className={`m3-segmented-button-item ${selectedCircle.shapeType === 'circle' ? 'is-selected' : ''}`}
                        onClick={() => {
                          updateCircleStyle(selectedCircle.id, { shapeType: 'circle' })
                        }}
                      >
                        Circle
                      </button>
                    </div>
                  </div>
                  
                  {(selectedCircle.shapeType ?? 'wavy') !== 'circle' && (
                    <>
                      <div className="inspector-field">
                        <label>Sides / Petals ({selectedCircle.sides ?? 8})</label>
                        <input
                          type="range"
                          min="3"
                          max="60"
                          value={selectedCircle.sides ?? 8}
                          onChange={(e) => updateCircleStyle(selectedCircle.id, { sides: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="inspector-field">
                        <label>{selectedCircle.shapeType === 'polygon' ? 'Rounding' : 'Amplitude'} ({selectedCircle.amplitude ?? 5})</label>
                        <input
                          type="range"
                          min="0"
                          max={selectedCircle.shapeType === 'polygon' ? 20 : 50}
                          value={selectedCircle.amplitude ?? 5}
                          onChange={(e) => updateCircleStyle(selectedCircle.id, { amplitude: parseFloat(e.target.value) })}
                        />
                      </div>
                    </>
                  )}

                  <div className="inspector-field">
                    <label>Center Image URL</label>
                    <input
                      type="text"
                      placeholder="https://example.com/image.jpg"
                      value={selectedCircle.imageUrl ?? ''}
                      onChange={(e) => updateCircleStyle(selectedCircle.id, { imageUrl: e.target.value })}
                      className="m3-input-field"
                    />
                  </div>
                </div>

                {/* Sticky Actions at Bottom */}
                <div className="inspector-actions-section">
                  <button type="button" className="primary-action" onClick={addDemoCluster}>
                    Add 3 demo people
                  </button>

                  {selectedCircle.id !== 'you' && (
                    <button
                      type="button"
                      className="primary-action"
                      style={{
                        background: 'var(--md-error-container)',
                        color: 'var(--md-on-error-container)',
                      }}
                      onClick={() => deleteCircle(selectedCircle.id)}
                    >
                      Delete circle
                    </button>
                  )}
                </div>
              </>
            )}

            {selectedPerson && (
              <>
                {/* Favorite Star Button at top-right of inspector */}
                <button
                  type="button"
                  className="star-favorite-btn"
                  onClick={() => togglePersonFavorite(selectedPerson.id)}
                  style={{
                    position: 'absolute',
                    top: 18,
                    right: 18,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                    padding: 4,
                    zIndex: 20,
                    outline: 'none',
                  }}
                  title={selectedPerson.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
                    <path
                      d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                      fill={selectedPerson.isFavorite ? '#ffd600' : 'none'}
                      stroke={selectedPerson.isFavorite ? '#d97706' : '#94a3b8'}
                      strokeWidth={2}
                    />
                  </svg>
                </button>

                {/* Visual Settings Row: Select Circle + Avatar Photo Upload */}
                <div className="inspector-visual-row">
                  <div className="inspector-field" style={{ flex: 1, marginTop: 0 }}>
                    <label>Circle</label>
                    <div className="m3-select-wrapper">
                      <select
                        value={selectedPerson.circleId}
                        onChange={(e) => {
                          const newCircleId = e.target.value
                          setGraph((current) => ({
                            ...current,
                            people: current.people.map((p) =>
                              p.id === selectedPerson.id ? { ...p, circleId: newCircleId } : p
                            ),
                          }))
                        }}
                      >
                        {graph.circles.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="m3-avatar-picker-container">
                    <label>Photo</label>
                    <label className="m3-avatar-picker" title="Upload person photo">
                      <input
                        type="file"
                        accept="image/*"
                        className="m3-file-input-hidden"
                        onChange={(e) => handleImageUpload(e, (base64) => updatePersonStyle(selectedPerson.id, { imageUrl: base64 }))}
                      />
                      {selectedPerson.imageUrl ? (
                        <img src={selectedPerson.imageUrl} alt="Person avatar" />
                      ) : (
                        <svg className="m3-avatar-picker-default-icon" viewBox="0 0 24 24">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      )}
                      <div className="m3-avatar-picker-overlay">
                        <UploadIcon />
                      </div>
                    </label>
                  </div>
                </div>

                <div className="inspector-field" style={{ marginTop: '4px' }}>
                  <label>Role</label>
                  <input
                    type="text"
                    value={selectedPerson.role}
                    onChange={(e) => {
                      const newRole = e.target.value
                      setGraph((current) => ({
                        ...current,
                        people: current.people.map((p) =>
                          p.id === selectedPerson.id ? { ...p, role: newRole } : p
                        ),
                      }))
                    }}
                    placeholder="E.g., Software Developer"
                    className="m3-input-field"
                  />
                </div>

                {/* Notes Section */}
                <div className="inspector-notes-section" style={{ marginTop: '12px', borderTop: '1px solid var(--md-outline-variant)', paddingTop: '12px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 500, color: 'var(--md-on-surface)' }}>Notes</h4>

                  {/* Scrollable list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                    {(!selectedPerson.notes || selectedPerson.notes.length === 0) ? (
                      <span style={{ fontSize: '11px', color: 'var(--md-on-surface-variant)', fontStyle: 'italic' }}>No notes yet.</span>
                    ) : (
                      selectedPerson.notes.map((note) => (
                        <div key={note.id}>
                          {editingNoteId === note.id ? (
                            <div className="note-card__editor">
                              <textarea
                                className="m3-input-field"
                                autoFocus
                                value={note.body}
                                onChange={(e) => updatePersonNote(selectedPerson.id, note.id, e.target.value.split('\n')[0].substr(0, 30) || 'Untitled note', e.target.value)}
                                onBlur={() => setEditingNoteId(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    setEditingNoteId(null)
                                  }
                                }}
                                style={{
                                  fontSize: '11.5px',
                                  resize: 'vertical',
                                  minHeight: '60px',
                                  lineHeight: '1.4',
                                }}
                              />
                            </div>
                          ) : (
                            <div
                              className="note-card"
                              onClick={() => setEditingNoteId(note.id)}
                            >
                              <div className="note-card__body">{note.body}</div>
                              <button
                                type="button"
                                className="note-card__delete-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deletePersonNote(selectedPerson.id, note.id)
                                }}
                                title="Delete note"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add note fields */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      placeholder="Write a note..."
                      value={newNoteBody}
                      onChange={(e) => setNewNoteBody(e.target.value)}
                      rows={2}
                      className="m3-input-field"
                      style={{ resize: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newNoteBody.trim()) return
                        addPersonNote(
                          selectedPerson.id,
                          newNoteBody.trim().split('\n')[0].substr(0, 30) || 'Untitled note',
                          newNoteBody.trim()
                        )
                        setNewNoteBody('')
                      }}
                      className="primary-action"
                      style={{ width: '100%' }}
                    >
                      Add note
                    </button>
                  </div>
                </div>

                {/* Appearance Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px', borderTop: '1px solid var(--md-outline-variant)', paddingTop: '12px' }}>
                  <div className="inspector-field">
                    <label>Shape Type</label>
                    <div className="m3-segmented-button">
                      <button
                        type="button"
                        className={`m3-segmented-button-item ${(!selectedPerson.shapeType || selectedPerson.shapeType === 'wavy') ? 'is-selected' : ''}`}
                        onClick={() => {
                          updatePersonStyle(selectedPerson.id, { shapeType: 'wavy', amplitude: 1 })
                        }}
                      >
                        Wavy
                      </button>
                      <button
                        type="button"
                        className={`m3-segmented-button-item ${selectedPerson.shapeType === 'polygon' ? 'is-selected' : ''}`}
                        onClick={() => {
                          updatePersonStyle(selectedPerson.id, { shapeType: 'polygon', amplitude: 8 })
                        }}
                      >
                        Polygon
                      </button>
                      <button
                        type="button"
                        className={`m3-segmented-button-item ${selectedPerson.shapeType === 'circle' ? 'is-selected' : ''}`}
                        onClick={() => {
                          updatePersonStyle(selectedPerson.id, { shapeType: 'circle', amplitude: 0 })
                        }}
                      >
                        Circle
                      </button>
                    </div>
                  </div>
                  
                  {(selectedPerson.shapeType ?? 'wavy') !== 'circle' && (
                    <>
                      <div className="inspector-field">
                        <label>Sides / Petals ({selectedPerson.sides ?? 8})</label>
                        <input
                          type="range"
                          min="3"
                          max="20"
                          value={selectedPerson.sides ?? 8}
                          onChange={(e) => updatePersonStyle(selectedPerson.id, { sides: parseInt(e.target.value) })}
                        />
                      </div>
                    </>
                  )}

                  <div className="inspector-field">
                    <label>Photo Image URL</label>
                    <input
                      type="text"
                      placeholder="https://example.com/image.jpg"
                      value={selectedPerson.imageUrl ?? ''}
                      onChange={(e) => updatePersonStyle(selectedPerson.id, { imageUrl: e.target.value })}
                      className="m3-input-field"
                    />
                  </div>
                </div>

                {/* Sticky Actions at Bottom */}
                <div className="inspector-actions-section">
                  <button
                    type="button"
                    className="primary-action"
                    style={{
                      background: 'var(--md-error-container)',
                      color: 'var(--md-on-error-container)',
                    }}
                    onClick={() => deletePerson(selectedPerson.id)}
                  >
                    Delete person
                  </button>
                </div>
              </>
            )}

            {selectedConnection && (() => {
              const fromNode = peopleById.get(selectedConnection.fromId) || circlesById.get(selectedConnection.fromId)
              const toNode = peopleById.get(selectedConnection.toId) || circlesById.get(selectedConnection.toId)
              return (
                <>
                  <dl>
                    <div>
                      <dt>From</dt>
                      <dd>{fromNode ? fromNode.name : 'Unknown'}</dd>
                    </div>
                    <div>
                      <dt>To</dt>
                      <dd>{toNode ? toNode.name : 'Unknown'}</dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    className="primary-action"
                    style={{
                      marginTop: '16px',
                      background: 'var(--md-error-container)',
                      color: 'var(--md-on-error-container)',
                    }}
                    onClick={() => deleteConnection(selectedConnection.id)}
                  >
                    Delete connection
                  </button>
                </>
              )
            })()}
          </>
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', height: '100px', color: 'rgba(28, 37, 40, 0.52)' }}>
            <span style={{ fontSize: '13px', fontWeight: 500 }}>Select an item to view details</span>
          </div>
        )}
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

// Isolated so its 2 Hz state tick only re-renders this badge, not the whole
// board tree (which would otherwise reconcile every visible node twice a second).
function FpsMeter() {
  const fps = useFrameRate()
  return <span>{fps} FPS</span>
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function createInitialGraph() {
  return ensureContainment({
    circles: DEFAULT_STATE.circles.map((circle) => ({
      ...circle,
      shapeType: circle.shapeType ?? 'wavy',
      sides: circle.sides ?? Math.max(8, Math.round(circle.radius / 10)),
      amplitude: circle.amplitude ?? Math.max(4, circle.radius * 0.06),
    })),
    people: DEFAULT_STATE.people.map((person) => {
      const sides = Math.floor(Math.random() * 5) + 8
      return {
        ...person,
        shapeType: person.shapeType ?? 'polygon',
        sides: person.sides ?? sides,
        amplitude: person.amplitude ?? 2,
      }
    }),
    connections: [],
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
    ...state,
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

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{
        width: '14px',
        height: '14px',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 3,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        marginRight: '6px',
      }}
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{
        width: '16px',
        height: '16px',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

export default App
