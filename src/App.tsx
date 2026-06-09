import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { useAuth } from './lib/useAuth'
import { useBoardGraph } from './lib/useBoardGraph'
import type { CircleNodeUi as CircleNode, PersonNodeUi as PersonNode, CircleTone, ShapeType } from './lib/useBoardGraph'
import { searchPeopleWithAi } from './lib/graphStorage'
import type { AiPeopleSearchResult } from './lib/graphStorage'

import type { PersonNote } from './lib/graphTypes'

type GraphState = {
  circles: CircleNode[]
  people: PersonNode[]
  notes: PersonNote[]
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
    { id: 'p1', name: 'Mia', role: 'Close friend', x: -62, y: -54, circleId: 'you', avatar: 'MI', shapeType: 'polygon', sides: 8, amplitude: 2 },
    { id: 'p2', name: 'Noah', role: 'Founder friend', x: 58, y: -6, circleId: 'you', avatar: 'NO', shapeType: 'polygon', sides: 10, amplitude: 2 },
    { id: 'p3', name: 'Ava', role: 'Design', x: 34, y: 67, circleId: 'you', avatar: 'AV', shapeType: 'polygon', sides: 11, amplitude: 2 },
    { id: 'p4', name: 'Sofia', role: 'Portugal', x: 168, y: -472, circleId: 'eu-network', avatar: 'SO', shapeType: 'polygon', sides: 9, amplitude: 2 },
    { id: 'p5', name: 'Lucas', role: 'Germany', x: 28, y: -610, circleId: 'eu-network', avatar: 'LU', shapeType: 'polygon', sides: 12, amplitude: 2 },
    { id: 'p6', name: 'Emma', role: 'Finland', x: -112, y: -416, circleId: 'eu-network', avatar: 'EM', shapeType: 'polygon', sides: 8, amplitude: 2 },
    { id: 'p7', name: 'Oscar', role: 'Denmark', x: 106, y: -302, circleId: 'eu-network', avatar: 'OC', shapeType: 'polygon', sides: 10, amplitude: 2 },
    { id: 'p8', name: 'Olivia', role: 'Brand', x: -166, y: 335, circleId: 'pandora', avatar: 'OL', shapeType: 'polygon', sides: 11, amplitude: 2 },
    { id: 'p9', name: 'Victor', role: 'Retail', x: 154, y: 360, circleId: 'pandora', avatar: 'VI', shapeType: 'polygon', sides: 9, amplitude: 2 },
    { id: 'p10', name: 'Freja', role: 'Operations', x: -190, y: 575, circleId: 'pandora', avatar: 'FR', shapeType: 'polygon', sides: 12, amplitude: 2 },
    { id: 'p11', name: 'Anton', role: 'PM', x: -92, y: 575, circleId: 'product-team', avatar: 'AN', shapeType: 'polygon', sides: 8, amplitude: 2 },
    { id: 'p12', name: 'Nora', role: 'UX', x: -20, y: 591, circleId: 'product-team', avatar: 'NR', shapeType: 'polygon', sides: 10, amplitude: 2 },
    { id: 'p13', name: 'Eli', role: 'Engineering', x: 50, y: 575, circleId: 'product-team', avatar: 'EL', shapeType: 'polygon', sides: 11, amplitude: 2 },
    { id: 'p14', name: 'Karim', role: 'Investor', x: 645, y: -15, circleId: 'market', avatar: 'KA', shapeType: 'polygon', sides: 9, amplitude: 2 },
    { id: 'p15', name: 'Lina', role: 'Media', x: 423, y: 4, circleId: 'market', avatar: 'LI', shapeType: 'polygon', sides: 12, amplitude: 2 },
    { id: 'p16', name: 'Yara', role: 'Analyst', x: 580, y: 198, circleId: 'market', avatar: 'YA', shapeType: 'polygon', sides: 8, amplitude: 2 },
  ],
  notes: [],
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

function getNodePath(
  cx: number,
  cy: number,
  r: number,
  shapeType: ShapeType,
  sides: number,
  amplitude: number
) {
  if (shapeType === 'circle' || amplitude === 0) {
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
  const stressCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const panRef = useRef<PanState | null>(null)
  const moveCircleRef = useRef<MoveCircleState | null>(null)
  const movePersonRef = useRef<MovePersonState | null>(null)
  const resizeCircleRef = useRef<ResizeCircleState | null>(null)
  const { session, status: authStatus, signInWithGoogle, signOut, error: authError } = useAuth()
  const boardGraph = useBoardGraph(session?.user ?? null)
  const isRemote = authStatus === 'authenticated'
  const isDev = import.meta.env.DEV || new URLSearchParams(window.location.search).get('dev') === 'true'

  function handleSearchChange(query: string) {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current)
    }

    searchTimerRef.current = window.setTimeout(async () => {
      try {
        const results = await searchPeopleWithAi(query)
        setSearchResults(results)
      } catch (err) {
        console.error('AI search failed:', err)
      }
    }, 400)
  }

  function handleSelectSearchResult(person: PersonNode) {
    setSelectedItem({ type: 'person', id: person.id })
    setCamera({
      x: window.innerWidth / 2 - person.x * camera.scale,
      y: window.innerHeight / 2 - person.y * camera.scale,
      scale: camera.scale,
    })
    setSearchQuery('')
    setSearchResults([])
  }

  const [graph, setGraph] = useState(createInitialGraph)
  const [camera, setCamera] = useState<Camera>({ x: window.innerWidth / 2, y: window.innerHeight / 2, scale: 0.82 })
  const [connector, setConnector] = useState<DragConnector | null>(null)
  const [createMenu, setCreateMenu] = useState<CreateMenu | null>(null)
  const [selectedItem, setSelectedItem] = useState<SelectedItem>({ type: 'circle', id: 'you' })
  const [stress, setStress] = useState<StressSettings>({ count: 0, showLabels: false, showEdges: true })
  const [showShapeMenu, setShowShapeMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<AiPeopleSearchResult[]>([])
  const searchTimerRef = useRef<number | null>(null)
  const renameTimersRef = useRef<Record<string, number>>({})
  const fps = useFrameRate()

  // Sync state from Supabase once ready
  useEffect(() => {
    if (isRemote && boardGraph.status === 'ready') {
      Promise.resolve().then(() => {
        setGraph({
          circles: boardGraph.circles,
          people: boardGraph.people,
          notes: boardGraph.notes,
        })
        setSelectedItem((current) => {
          if (current.type === 'circle') {
            const exists = boardGraph.circles.some((c) => c.id === current.id)
            return exists ? current : { type: 'circle', id: 'you' }
          } else {
            const exists = boardGraph.people.some((p) => p.id === current.id)
            return exists ? current : { type: 'circle', id: 'you' }
          }
        })
      })
    }
  }, [isRemote, boardGraph.status, boardGraph.circles, boardGraph.people, boardGraph.notes])

  // Cleanup rename/debounce timers on unmount
  useEffect(() => {
    const renameTimers = renameTimersRef.current
    const searchTimer = searchTimerRef
    return () => {
      for (const timerId of Object.values(renameTimers)) {
        window.clearTimeout(timerId)
      }
      if (searchTimer.current !== null) {
        window.clearTimeout(searchTimer.current)
      }
    }
  }, [])

  const circlesById = useMemo(() => new Map(graph.circles.map((circle) => [circle.id, circle])), [graph.circles])
  const stressPeople = useMemo(() => generateStressPeople(stress.count), [stress.count])
  const stressSprites = useMemo(() => createStressSprites(), [])
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

  useEffect(() => {
    const canvas = stressCanvasRef.current
    const surface = surfaceRef.current
    if (!canvas || !surface) return

    drawStressCanvas(canvas, surface, camera, stress, stressPeople, circlesById, stressSprites)
  }, [camera, circlesById, stress, stressPeople, stressSprites])

  useEffect(() => {
    function handleResize() {
      const canvas = stressCanvasRef.current
      const surface = surfaceRef.current
      if (!canvas || !surface) return
      drawStressCanvas(canvas, surface, camera, stress, stressPeople, circlesById, stressSprites)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [camera, circlesById, stress, stressPeople, stressSprites])

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
      const circleId = moveCircleRef.current.circleId
      moveCircleRef.current = null
      if (isRemote) {
        const target = graph.circles.find((c) => c.id === circleId)
        if (target) {
          boardGraph.moveCircle(circleId, target.x, target.y)
        }
      }
    }

    if (movePersonRef.current?.pointerId === event.pointerId) {
      const personId = movePersonRef.current.personId
      movePersonRef.current = null
      if (isRemote) {
        const target = graph.people.find((p) => p.id === personId)
        if (target) {
          boardGraph.movePerson(personId, target.x, target.y)
        }
      }
    }

    if (resizeCircleRef.current?.pointerId === event.pointerId) {
      const circleId = resizeCircleRef.current.circleId
      resizeCircleRef.current = null
      if (isRemote) {
        const target = graph.circles.find((c) => c.id === circleId)
        if (target) {
          boardGraph.updateCircle(circleId, { radius: target.radius, minRadius: target.minRadius })
        }
      }
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
    const sides = 8
    const newPersonInput = {
      name: `New person ${graph.people.length + 1}`,
      role: `Inside ${source.name}`,
      x: createMenu.x,
      y: createMenu.y,
      circleId: source.id,
      avatar: makeAvatar(graph.people.length + 1),
      shapeType: 'wavy' as ShapeType,
      sides,
      amplitude: 1,
      imageUrl: null as string | null,
    }

    if (isRemote) {
      boardGraph.createPerson(newPersonInput).then((created) => {
        setGraph((current) =>
          ensureContainment({
            ...current,
            people: [...current.people, created],
          }),
        )
        setSelectedItem({ type: 'person', id: created.id })
      })
    } else {
      setGraph((current) =>
        ensureContainment({
          ...current,
          people: [
            ...current.people,
            { id, ...newPersonInput, imageUrl: undefined },
          ],
        }),
      )
      setSelectedItem({ type: 'person', id })
    }
    setCreateMenu(null)
  }

  function createCircle(mode: 'nested' | 'external') {
    if (!createMenu) return

    const source = circlesById.get(createMenu.sourceCircleId)
    if (!source) return

    const id = `circle-${Date.now()}`
    const isNested = mode === 'nested'
    const newCircleInput = {
      name: isNested ? `${source.name} subset` : 'New circle',
      icon: isNested ? 'SUB' : 'C',
      x: createMenu.x,
      y: createMenu.y,
      radius: isNested ? 82 : 190,
      minRadius: isNested ? 82 : 190,
      parentId: isNested ? source.id : null,
      connectedTo: source.id,
      tone: isNested ? 'violet' : nextTone(graph.circles.length),
      shapeType: isNested ? ('polygon' as ShapeType) : ('wavy' as ShapeType),
      sides: isNested ? 6 : 12,
      amplitude: isNested ? 4 : 8,
      imageUrl: null as string | null,
    }

    if (isRemote) {
      boardGraph.createCircle(newCircleInput).then((created) => {
        setGraph((current) =>
          ensureContainment({
            ...current,
            circles: [...current.circles, created],
          }),
        )
        setSelectedItem({ type: 'circle', id: created.id })
      })
    } else {
      setGraph((current) =>
        ensureContainment({
          ...current,
          circles: [
            ...current.circles,
            { id, ...newCircleInput, imageUrl: undefined },
          ],
        }),
      )
      setSelectedItem({ type: 'circle', id })
    }
    setCreateMenu(null)
  }

  function addDemoCluster() {
    const source = selectedCircle ?? circlesById.get('you')
    if (!source) return

    const nextIndex = graph.people.length + 1
    const points = [-58, 0, 58].map((offset, index) => {
      return {
        id: `person-${Date.now()}-${index}`,
        name: ['Alex', 'Daria', 'Sam'][index],
        role: `Added to ${source.name}`,
        x: source.x + offset,
        y: source.y + source.radius * 0.42 + index * 18,
        circleId: source.id,
        avatar: makeAvatar(nextIndex + index),
        shapeType: 'wavy' as ShapeType,
        sides: 6,
        amplitude: 5,
        imageUrl: undefined as string | undefined,
      }
    })

    if (isRemote) {
      Promise.all(
        points.map((p) =>
          boardGraph.createPerson({
            name: p.name,
            x: p.x,
            y: p.y,
            circleId: p.circleId,
            role: p.role,
            avatar: p.avatar,
            shapeType: p.shapeType,
            sides: p.sides,
            amplitude: p.amplitude,
            imageUrl: p.imageUrl ?? null,
          }),
        ),
      ).then((createdPeople) => {
        setGraph((current) =>
          ensureContainment({
            ...current,
            people: [...current.people, ...createdPeople],
          }),
        )
      })
    } else {
      setGraph((current) =>
        ensureContainment({
          ...current,
          people: [...current.people, ...points],
        }),
      )
    }
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
        circles: current.circles.map((circle) =>
          circle.id === selectedItem.id ? { ...circle, name: value } : circle,
        ),
      }))
      if (isRemote) {
        const id = selectedItem.id
        window.clearTimeout(renameTimersRef.current[id])
        renameTimersRef.current[id] = window.setTimeout(() => {
          boardGraph.updateCircle(id, { name: value })
        }, 500)
      }
      return
    }

    setGraph((current) => ({
      ...current,
      people: current.people.map((person) =>
        person.id === selectedItem.id ? { ...person, name: value } : person,
      ),
    }))
    if (isRemote) {
      const id = selectedItem.id
      window.clearTimeout(renameTimersRef.current[id])
      renameTimersRef.current[id] = window.setTimeout(() => {
        boardGraph.updatePerson({ id, name: value })
      }, 500)
    }
  }

  function updateCircleStyle(id: string, updates: Partial<CircleNode>) {
    setGraph((current) => ({
      ...current,
      circles: current.circles.map((circle) =>
        circle.id === id ? { ...circle, ...updates } : circle,
      ),
    }))
    if (isRemote) {
      const timerKey = `circle-style-${id}`
      window.clearTimeout(renameTimersRef.current[timerKey])
      renameTimersRef.current[timerKey] = window.setTimeout(() => {
        boardGraph.updateCircle(id, updates)
      }, 400)
    }
  }

  function updatePersonStyle(id: string, updates: Partial<PersonNode>) {
    setGraph((current) => ({
      ...current,
      people: current.people.map((person) =>
        person.id === id ? { ...person, ...updates } : person,
      ),
    }))
    if (isRemote) {
      const timerKey = `person-style-${id}`
      window.clearTimeout(renameTimersRef.current[timerKey])
      renameTimersRef.current[timerKey] = window.setTimeout(() => {
        boardGraph.updatePerson({ id, ...updates })
      }, 400)
    }
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

  function handleDeleteCircle(id: string) {
    if (id === 'you') {
      alert('Root circle cannot be deleted.')
      return
    }
    if (confirm('Are you sure you want to delete this circle? This will delete all its nested sub-circles.')) {
      if (isRemote) {
        boardGraph.deleteCircle(id).then(() => {
          setSelectedItem({ type: 'circle', id: 'you' })
        })
      } else {
        setGraph((current) => {
          const descendants = getDescendantCircleIds(current.circles, id)
          descendants.add(id)
          return {
            ...current,
            circles: current.circles.filter((c) => !descendants.has(c.id)),
            people: current.people.map((p) => descendants.has(p.circleId) ? { ...p, circleId: 'you' } : p),
          }
        })
        setSelectedItem({ type: 'circle', id: 'you' })
      }
    }
  }

  function handleDeletePerson(id: string) {
    const person = graph.people.find(p => p.id === id)
    // In remote mode or local mode, prevent deleting the root person (which is Mia in legacy default, or is_root flag)
    if (person?.isRoot || person?.id === 'p1' || person?.name === 'Mia' && person?.circleId === 'you') {
      alert('Root person cannot be deleted.')
      return
    }

    if (confirm('Are you sure you want to delete this person?')) {
      if (isRemote) {
        boardGraph.deletePerson(id).then(() => {
          setSelectedItem({ type: 'circle', id: 'you' })
        })
      } else {
        setGraph((current) => ({
          ...current,
          people: current.people.filter((p) => p.id !== id),
          notes: (current.notes ?? []).filter((n) => n.person_id !== id)
        }))
        setSelectedItem({ type: 'circle', id: 'you' })
      }
    }
  }

  function handleCreateNote() {
    if (!selectedPerson) return
    const noteId = `note-${Date.now()}`
    if (isRemote) {
      boardGraph.createNote('New Note', '', selectedPerson.id)
    } else {
      setGraph((current) => ({
        ...current,
        notes: [
          ...(current.notes ?? []),
          {
            id: noteId,
            person_id: selectedPerson.id,
            owner_user_id: 'local',
            title: 'New Note',
            body: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
      }))
    }
  }

  function handleUpdateNote(id: string, updates: Partial<{ title: string; body: string }>) {
    setGraph((current) => ({
      ...current,
      notes: (current.notes ?? []).map((n) => n.id === id ? { ...n, ...updates } : n)
    }))
    if (isRemote) {
      const timerKey = `note-${id}`
      window.clearTimeout(renameTimersRef.current[timerKey])
      renameTimersRef.current[timerKey] = window.setTimeout(() => {
        boardGraph.updateNote({ id, ...updates })
      }, 500)
    }
  }

  function handleDeleteNote(id: string) {
    if (confirm('Are you sure you want to delete this note?')) {
      if (isRemote) {
        boardGraph.deleteNote(id)
      } else {
        setGraph((current) => ({
          ...current,
          notes: (current.notes ?? []).filter((n) => n.id !== id)
        }))
      }
    }
  }

  if (authStatus === 'loading' || (isRemote && boardGraph.status === 'loading')) {
    return (
      <div className="auth-gate-container">
        <div className="spinner"></div>
      </div>
    )
  }

  if (authStatus === 'anonymous') {
    return (
      <div className="auth-gate-container">
        <div className="auth-card">
          <div className="auth-logo">DN</div>
          <h1>Circle Graph</h1>
          <p>Organize your contacts and relationships visually with AI-powered notes.</p>
          <button type="button" onClick={signInWithGoogle} className="google-signin-btn">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Sign in with Google</span>
          </button>
          {authError && <div className="auth-error">{authError}</div>}
        </div>
      </div>
    )
  }

  return (
    <main className="app-shell">
      <div className="toolbar" aria-label="Graph controls">
        <div className="brand">
          <span className="brand__mark">DN</span>
          <span>Circle graph</span>
        </div>

        {isRemote && (
          <div className="ai-search-container" style={{ pointerEvents: 'auto' }}>
            <div className="ai-search-input-wrapper">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search graph with AI..."
                className="ai-search-input"
              />
              {searchQuery && (
                <button type="button" onClick={() => handleSearchChange('')} className="search-clear-btn">&times;</button>
              )}
            </div>
            {searchResults.length > 0 && (
              <div className="ai-search-results">
                {searchResults.map((result) => {
                  const person = graph.people.find(p => p.id === result.person_id)
                  if (!person) return null
                  return (
                    <button
                      key={result.person_id}
                      type="button"
                      onClick={() => handleSelectSearchResult(person)}
                      className="search-result-item"
                    >
                      <div className="search-result-item__main">
                        <strong>{person.name}</strong>
                        <span className="search-result-score">Match: {Math.round(result.score * 100)}%</span>
                      </div>
                      <p className="search-result-reason">{result.reason}</p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="toolbar__group">
          <button type="button" onClick={() => setCamera((current) => ({ ...current, scale: clamp(current.scale * 1.14, MIN_SCALE, MAX_SCALE) }))} aria-label="Zoom in">
            <ZoomInIcon />
          </button>
          <button type="button" onClick={() => setCamera((current) => ({ ...current, scale: clamp(current.scale / 1.14, MIN_SCALE, MAX_SCALE) }))} aria-label="Zoom out">
            <ZoomOutIcon />
          </button>
          {isDev && (
            <button type="button" onClick={resetDemo} aria-label="Reset demo">
              <ResetIcon />
            </button>
          )}
        </div>

        {isRemote && (
          <div className="user-menu" style={{ pointerEvents: 'auto' }}>
            <span className="user-email">{session?.user?.email}</span>
            <button type="button" onClick={signOut} className="signout-btn">
              Sign out
            </button>
          </div>
        )}
      </div>

      {isDev && (
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
      )}

      {isDev && (
        <section className="help-panel" aria-label="How to use the prototype">
          <strong>How it works</strong>
          <span>Drag people or circles to move them.</span>
          <span>Grab a circle edge to resize it.</span>
          <span>Right-click a circle to add a person, subset, or connected circle.</span>
          <span>Shift-drag from a circle center to create from the center.</span>
          <span>Parent circles auto-fit their contents.</span>
        </section>
      )}

      <div
        ref={surfaceRef}
        className="graph-surface"
        onPointerDown={handleSurfacePointerDown}
        onPointerMove={handleSurfacePointerMove}
        onPointerUp={handleSurfacePointerUp}
        onPointerCancel={handleSurfacePointerUp}
        onWheel={handleWheel}
      >
        <canvas ref={stressCanvasRef} className="stress-canvas-layer" aria-hidden="true" />

        <div className="world-layer" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}>
          
          {/* PASS 1: Circle Fills and Borders */}
          {sortedCircles.map((circle) => (
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
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
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
                  stroke={selectedItem.type === 'circle' && selectedItem.id === circle.id ? MATERIAL_TONES[circle.tone].border : 'none'}
                  strokeWidth={selectedItem.type === 'circle' && selectedItem.id === circle.id ? 3.5 : 0}
                  filter="drop-shadow(0px 8px 16px rgba(0,0,0,0.06))"
                />
              </svg>
            </div>
          ))}

          {/* PASS 2: Connection Edges */}
          <svg className="edge-layer" aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
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
          </svg>

          {/* PASS 3: Circle Interactive Elements (Centers & Labels) */}
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
              <span className="circle__label">{circle.name}</span>
              <button
                type="button"
                className={`circle-center ${selectedItem.type === 'circle' && selectedItem.id === circle.id ? 'is-selected' : ''}`}
                style={{
                  position: 'absolute',
                  left: circle.radius,
                  top: circle.radius,
                  width: 40,
                  height: 40,
                  transform: 'translate(-50%, -50%)',
                  background: circle.imageUrl ? 'transparent' : MATERIAL_TONES[circle.tone].centerBg,
                  border: 'none',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'grab',
                  padding: 0,
                  outline: 'none',
                }}
                onPointerDown={(event) => startCircleCenterDrag(event, circle)}
                onClick={(event) => {
                  event.stopPropagation()
                  setSelectedItem({ type: 'circle', id: circle.id })
                }}
                title="Drag to move. Shift-drag to create from this center."
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
                  <span style={{ color: '#ffffff', fontSize: 10, fontWeight: 900 }}>{circle.icon}</span>
                )}
              </button>
            </section>
          ))}

          {/* PASS 4: People Icons and Labels */}
          {graph.people.map((person) => (
            <button
              key={person.id}
              type="button"
              className={`person-icon-only ${selectedItem.type === 'person' && selectedItem.id === person.id ? 'is-selected' : ''}`}
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
              aria-label={`Select ${person.name}`}
              title="Drag to move this person"
            >
              <div
                className={`person-avatar-shape ${selectedItem.type === 'person' && selectedItem.id === person.id ? 'is-selected' : ''}`}
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
                      <path d={getNodePath(20, 20, 18, person.shapeType ?? 'polygon', person.sides ?? 8, person.amplitude ?? 2)} />
                    </clipPath>
                  </defs>
                  {person.imageUrl ? (
                    <g>
                      <path
                        d={getNodePath(20, 20, 18, person.shapeType ?? 'polygon', person.sides ?? 8, person.amplitude ?? 2)}
                        fill={(() => {
                          const parentCircle = circlesById.get(person.circleId)
                          return parentCircle ? MATERIAL_TONES[parentCircle.tone].centerBg : '#3F51B5'
                        })()}
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
                      <path
                        d={getNodePath(20, 20, 18, person.shapeType ?? 'polygon', person.sides ?? 8, person.amplitude ?? 2)}
                        fill="none"
                        stroke={selectedItem.type === 'person' && selectedItem.id === person.id ? '#2563eb' : '#ffffff'}
                        strokeWidth={selectedItem.type === 'person' && selectedItem.id === person.id ? 2.5 : 1.5}
                      />
                    </g>
                  ) : (
                    <g>
                      <path
                        d={getNodePath(20, 20, 18, person.shapeType ?? 'polygon', person.sides ?? 8, person.amplitude ?? 2)}
                        fill={(() => {
                          const parentCircle = circlesById.get(person.circleId)
                          return parentCircle ? MATERIAL_TONES[parentCircle.tone].centerBg : '#3F51B5'
                        })()}
                        stroke={selectedItem.type === 'person' && selectedItem.id === person.id ? '#2563eb' : '#ffffff'}
                        strokeWidth={selectedItem.type === 'person' && selectedItem.id === person.id ? 2.5 : 1.5}
                      />
                      <text
                        x="20"
                        y="21"
                        fill="#ffffff"
                        fontSize="11"
                        fontWeight="900"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {person.avatar}
                      </text>
                    </g>
                  )}
                </svg>
              </div>
              <strong className="person-label">{person.name}</strong>
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

      <aside className="inspector" aria-label="Selection details" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
        <span className="inspector__eyebrow">{selectedItem.type === 'circle' ? 'Circle' : 'Person'}</span>
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

            <button
              type="button"
              className="secondary-action"
              onClick={() => setShowShapeMenu(!showShapeMenu)}
              style={{ marginTop: '8px', width: '100%', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Customize Shape & Photo...
            </button>

            {isDev && (
              <button type="button" className="primary-action" onClick={addDemoCluster} style={{ marginTop: '8px', width: '100%' }}>
                Add 3 demo people
              </button>
            )}

            {selectedCircle.id !== 'you' && !selectedCircle.isRoot && (
              <button
                type="button"
                className="danger-action"
                onClick={() => handleDeleteCircle(selectedCircle.id)}
                style={{ marginTop: '8px', width: '100%', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Delete Circle
              </button>
            )}
          </>
        ) : null}

        {selectedPerson ? (
          <>
            <dl style={{ marginBottom: '14px' }}>
              <div>
                <dt>Role</dt>
                <dd>{selectedPerson.role || 'No role specified'}</dd>
              </div>
              <div>
                <dt>Circle</dt>
                <dd>{circlesById.get(selectedPerson.circleId)?.name || 'None'}</dd>
              </div>
            </dl>

            <div className="inspector-field" style={{ marginTop: '0px', marginBottom: '14px' }}>
              <label>Role</label>
              <input
                type="text"
                value={selectedPerson.role}
                onChange={(e) => updatePersonStyle(selectedPerson.id, { role: e.target.value })}
                placeholder="Enter role (e.g. Designer, Partner)..."
                style={{ fontSize: '14px', padding: '6px 8px', borderBottom: '1px solid rgba(28, 37, 40, 0.12)' }}
              />
            </div>

            <button
              type="button"
              className="secondary-action"
              onClick={() => setShowShapeMenu(!showShapeMenu)}
              style={{ marginBottom: '14px', width: '100%', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Customize Shape & Photo...
            </button>

            <div className="notes-section">
              <h4>Relationship Notes</h4>
              <div className="notes-list">
                {(() => {
                  const personNotes = (graph.notes ?? []).filter((note) => note.person_id === selectedPerson.id)
                  if (personNotes.length === 0) {
                    return <p className="no-notes-msg">No notes captured yet.</p>
                  }
                  return personNotes.map((note) => (
                    <div key={note.id} className="note-card">
                      <div className="note-card-header">
                        <input
                          type="text"
                          value={note.title}
                          onChange={(e) => handleUpdateNote(note.id, { title: e.target.value })}
                          placeholder="Note title..."
                          className="note-title-input"
                        />
                        <button type="button" onClick={() => handleDeleteNote(note.id)} className="delete-note-btn" title="Delete note">
                          &times;
                        </button>
                      </div>
                      <textarea
                        value={note.body}
                        onChange={(e) => handleUpdateNote(note.id, { body: e.target.value })}
                        placeholder="Start typing relationship details..."
                        className="note-body-textarea"
                      />
                    </div>
                  ))
                })()}
              </div>
              <button type="button" onClick={handleCreateNote} className="primary-action add-note-btn" style={{ width: '100%', marginTop: '8px' }}>
                + Add Note
              </button>
            </div>

            {isRemote && (
              <div className="ai-insights-container" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(28, 37, 40, 0.08)' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 10px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#7c3aed' }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#7c3aed' }}>
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  AI Relationship Insights
                </h4>
                {(() => {
                  const aiNote = boardGraph.personAiNotes.find((n) => n.person_id === selectedPerson.id)
                  if (!aiNote) {
                    return (
                      <div className="ai-insights-empty" style={{ fontSize: '12px', color: 'rgba(28, 37, 40, 0.6)' }}>
                        Write some notes to trigger automatic AI summaries.
                      </div>
                    )
                  }
                  if (aiNote.status === 'pending') {
                    return <div className="ai-insights-loading" style={{ fontSize: '12px', color: '#7c3aed', fontStyle: 'italic' }}>AI is summarizing relationship context...</div>
                  }
                  if (aiNote.status === 'error') {
                    return (
                      <div className="ai-insights-error" style={{ fontSize: '12px', color: '#dc2626', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span>Failed to generate summary.</span>
                        <button type="button" onClick={() => boardGraph.syncPersonAiNote(selectedPerson.id)} className="secondary-action" style={{ padding: '4px 8px', fontSize: '11px', alignSelf: 'flex-start' }}>Retry</button>
                      </div>
                    )
                  }
                  return (
                    <div className="ai-insights-content" style={{ display: 'grid', gap: '10px' }}>
                      <p className="ai-summary-text" style={{ margin: 0, fontSize: '12px', lineHeight: '1.45', color: '#1c2528', background: 'rgba(124, 58, 237, 0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(124, 58, 237, 0.12)' }}>{aiNote.summary}</p>
                      {aiNote.structured_summary.traits.length > 0 && (
                        <div className="ai-traits-section">
                          <strong style={{ fontSize: '11px', color: 'rgba(28, 37, 40, 0.6)' }}>Traits:</strong>
                          <div className="ai-tags-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                            {aiNote.structured_summary.traits.map(t => <span key={t} className="ai-tag" style={{ fontSize: '10px', background: '#eaddff', color: '#21005d', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{t}</span>)}
                          </div>
                        </div>
                      )}
                      {aiNote.structured_summary.interests.length > 0 && (
                        <div className="ai-traits-section">
                          <strong style={{ fontSize: '11px', color: 'rgba(28, 37, 40, 0.6)' }}>Interests:</strong>
                          <div className="ai-tags-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                            {aiNote.structured_summary.interests.map(t => <span key={t} className="ai-tag" style={{ fontSize: '10px', background: '#d1e8d2', color: '#00210b', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{t}</span>)}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}

            {selectedPerson.id !== 'p1' && !selectedPerson.isRoot && (
              <button
                type="button"
                className="danger-action"
                onClick={() => handleDeletePerson(selectedPerson.id)}
                style={{ marginTop: '16px', width: '100%', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Delete Person
              </button>
            )}
          </>
        ) : null}
        <p style={{ marginTop: '14px', fontSize: '11px', opacity: 0.6 }}>Drag objects directly. Right-click a circle for creation actions. Parent circles auto-fit as contained objects move.</p>
      </aside>

      {showShapeMenu && (selectedCircle || selectedPerson) && (
        <div className="shape-popover-panel">
          <div className="shape-popover-header">
            <h3>Customize Shape & Photo</h3>
            <button type="button" onClick={() => setShowShapeMenu(false)} className="close-popover-btn">&times;</button>
          </div>
          <div className="shape-popover-content">
            {selectedCircle && (
              <>
                <div className="inspector-field">
                  <label>Shape Type</label>
                  <select
                    value={selectedCircle.shapeType ?? 'wavy'}
                    onChange={(e) => updateCircleStyle(selectedCircle.id, { shapeType: e.target.value as ShapeType })}
                  >
                    <option value="wavy">Wavy (Flower)</option>
                    <option value="polygon">Soft Polygon</option>
                    <option value="circle">Circle</option>
                  </select>
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
                      <label>Amplitude / Rounding ({selectedCircle.amplitude ?? 5})</label>
                      <input
                        type="range"
                        min="0"
                        max="50"
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
                  />
                </div>
                <div className="inspector-field">
                  <label>Upload Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, (base64) => updateCircleStyle(selectedCircle.id, { imageUrl: base64 }))}
                  />
                </div>
              </>
            )}
            {selectedPerson && (
              <>
                <div className="inspector-field">
                  <label>Shape Type</label>
                  <select
                    value={selectedPerson.shapeType ?? 'polygon'}
                    onChange={(e) => updatePersonStyle(selectedPerson.id, { shapeType: e.target.value as ShapeType })}
                  >
                    <option value="polygon">Soft Polygon</option>
                    <option value="wavy">Wavy (Flower)</option>
                    <option value="circle">Circle</option>
                  </select>
                </div>
                
                {(selectedPerson.shapeType ?? 'polygon') !== 'circle' && (
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
                    <div className="inspector-field">
                      <label>Amplitude / Rounding ({selectedPerson.amplitude ?? 2})</label>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        value={selectedPerson.amplitude ?? 2}
                        onChange={(e) => updatePersonStyle(selectedPerson.id, { amplitude: parseFloat(e.target.value) })}
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
                  />
                </div>
                <div className="inspector-field">
                  <label>Upload Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, (base64) => updatePersonStyle(selectedPerson.id, { imageUrl: base64 }))}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

function drawStressCanvas(
  canvas: HTMLCanvasElement,
  surface: HTMLElement,
  camera: Camera,
  stress: StressSettings,
  people: PersonNode[],
  circlesById: Map<string, CircleNode>,
  sprites: HTMLCanvasElement[],
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

  const viewport = {
    left: (0 - camera.x) / camera.scale,
    right: (width - camera.x) / camera.scale,
    top: (0 - camera.y) / camera.scale,
    bottom: (height - camera.y) / camera.scale,
  }
  const padding = stress.showLabels ? 120 / camera.scale : 48 / camera.scale
  const visiblePeople = people.filter(
    (person) =>
      person.x >= viewport.left - padding &&
      person.x <= viewport.right + padding &&
      person.y >= viewport.top - padding &&
      person.y <= viewport.bottom + padding,
  )

  context.save()
  context.translate(camera.x, camera.y)
  context.scale(camera.scale, camera.scale)

  if (stress.showEdges) {
    context.beginPath()
    context.strokeStyle = 'rgba(116, 126, 132, 0.12)'
    context.lineWidth = Math.max(0.7 / camera.scale, 0.45)

    for (const person of visiblePeople) {
      const circle = circlesById.get(person.circleId)
      if (!circle) continue
      context.moveTo(circle.x, circle.y)
      context.lineTo(person.x, person.y)
    }

    context.stroke()
  }

  const iconSize = stress.showLabels ? 30 : 28
  const halfIcon = iconSize / 2
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  for (const person of visiblePeople) {
    const sprite = sprites[getAvatarIndex(person.avatar) % sprites.length]
    context.drawImage(sprite, person.x - halfIcon, person.y - halfIcon, iconSize, iconSize)
  }

  if (stress.showLabels) {
    context.font = `${Math.max(10 / camera.scale, 8)}px Inter, system-ui, sans-serif`
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

function createStressSprites() {
  const colors = ['#00629D', '#C00015', '#1E824A', '#D87A00', '#7F67BE', '#0F766E', '#4F46E5', '#BE185D', '#BE185D']
  return colors.map((color, index) => {
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
    context.fillText(makeAvatar(index), size / 2, size / 2 + 1)

    return canvas
  })
}

function drawFlowerPath(context: CanvasRenderingContext2D, cx: number, cy: number, r: number, petals: number, amplitude: number) {
  const points = 72
  context.beginPath()
  for (let i = 0; i <= points; i += 1) {
    const angle = (i * 2 * Math.PI) / points
    const currentR = r + amplitude * Math.cos(petals * angle)
    const x = cx + currentR * Math.cos(angle)
    const y = cy + currentR * Math.sin(angle)
    if (i === 0) {
      context.moveTo(x, y)
    } else {
      context.lineTo(x, y)
    }
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
    notes: [],
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

function getAvatarIndex(avatar: string) {
  const names = ['AL', 'BD', 'CE', 'DK', 'EV', 'FX', 'GN', 'HM', 'IR']
  return Math.max(0, names.indexOf(avatar))
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
