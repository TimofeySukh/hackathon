import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'

type CircleTone = 'blue' | 'red' | 'green' | 'amber' | 'violet'

type ShapeType = 'circle' | 'wavy' | 'polygon'

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
  shapeType?: ShapeType
  sides?: number
  amplitude?: number
  imageUrl?: string
}

type PersonNode = {
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
}

type Connection = {
  id: string
  fromId: string
  toId: string
}

type GraphState = {
  circles: CircleNode[]
  people: PersonNode[]
  connections: Connection[]
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
  connections: [],
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
  const [graph, setGraph] = useState(createInitialGraph)
  const [camera, setCamera] = useState<Camera>({ x: window.innerWidth / 2, y: window.innerHeight / 2, scale: 0.82 })
  const cameraRef = useRef(camera)

  const [connector, setConnector] = useState<DragConnector | null>(null)
  const [createMenu, setCreateMenu] = useState<CreateMenu | null>(null)
  const [selectedItem, setSelectedItem] = useState<SelectedItem>({ type: 'circle', id: 'you' })
  const [stress, setStress] = useState<StressSettings>({ count: 0, showLabels: false, showEdges: true })
  const fps = useFrameRate()

  const [showSettings, setShowSettings] = useState(false)
  const [centerBehavior, setCenterBehavior] = useState<'connect' | 'move'>('connect')
  const [hoveredConnId, setHoveredConnId] = useState<string | null>(null)

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
  const selectedCircle = selectedItem?.type === 'circle' ? circlesById.get(selectedItem.id) ?? null : null
  const selectedPerson = selectedItem?.type === 'person' ? graph.people.find((person) => person.id === selectedItem.id) ?? null : null
  const selectedConnection = selectedItem?.type === 'connection' ? (graph.connections || []).find((conn) => conn.id === selectedItem.id) ?? null : null

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
        setCamera({
          scale: nextScale,
          x: pointer.x - before.x * nextScale,
          y: pointer.y - before.y * nextScale,
        })
      } else {
        setCamera((current) => ({
          ...current,
          x: current.x - event.deltaX,
          y: current.y - event.deltaY,
        }))
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
            shapeType: 'polygon',
            sides,
            amplitude: 2,
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
        shapeType: 'polygon' as ShapeType,
        sides,
        amplitude: 2,
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
              background: showSettings ? 'rgba(28, 37, 40, 0.07)' : 'transparent',
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
          style={{
            position: 'absolute',
            zIndex: 10,
            top: '72px',
            right: '16px',
            width: '280px',
            padding: '16px',
            borderRadius: '12px',
            border: '1.5px solid #c4c7c8',
            background: '#ffffff',
            boxShadow: 'var(--panel-shadow)',
          }}
        >
          <strong style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Settings
          </strong>
          <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(28, 37, 40, 0.64)' }}>
              Circle Center Drag Behavior
            </label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setCenterBehavior('connect')}
                style={{
                  flex: 1,
                  padding: '8px',
                  fontSize: '12px',
                  fontWeight: 800,
                  borderRadius: '6px',
                  border: '1px solid #c4c7c8',
                  background: centerBehavior === 'connect' ? '#1c2528' : '#ffffff',
                  color: centerBehavior === 'connect' ? '#ffffff' : '#1c2528',
                  cursor: 'pointer',
                }}
              >
                Draw Connection
              </button>
              <button
                type="button"
                onClick={() => setCenterBehavior('move')}
                style={{
                  flex: 1,
                  padding: '8px',
                  fontSize: '12px',
                  fontWeight: 800,
                  borderRadius: '6px',
                  border: '1px solid #c4c7c8',
                  background: centerBehavior === 'move' ? '#1c2528' : '#ffffff',
                  color: centerBehavior === 'move' ? '#ffffff' : '#1c2528',
                  cursor: 'pointer',
                }}
              >
                Move Circle
              </button>
            </div>
          </div>
        </div>
      )}

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
            {(graph.connections || []).map((conn) => {
              const sourceNode = graph.people.find((p) => p.id === conn.fromId) || circlesById.get(conn.fromId)
              const targetNode = graph.people.find((p) => p.id === conn.toId) || circlesById.get(conn.toId)
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
                    stroke={isSelected ? '#2563eb' : isHovered ? '#64748b' : '#94a3b8'}
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
          {sortedCircles.map((circle) => (
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
                    <span style={{ color: '#ffffff', fontSize: 10, fontWeight: 900 }}>{circle.icon}</span>
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
          {graph.people.map((person) => {
            const isSelected = selectedItem?.type === 'person' && selectedItem?.id === person.id;
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
                          stroke={isSelected ? '#2563eb' : '#ffffff'}
                          strokeWidth={isSelected ? 2.5 : 1.5}
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
                          stroke={isSelected ? '#2563eb' : '#ffffff'}
                          strokeWidth={isSelected ? 2.5 : 1.5}
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
                            background: '#2563eb',
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
                            background: '#2563eb',
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
                            background: '#2563eb',
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
                            background: '#2563eb',
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
        {selectedItem ? (
          <>
            <span className="inspector__eyebrow">
              {selectedItem.type === 'circle' ? 'Circle center' : selectedItem.type === 'person' ? 'Person' : 'Connection'}
            </span>
            {selectedItem.type !== 'connection' ? (
              <input
                value={selectedCircle?.name ?? selectedPerson?.name ?? ''}
                onChange={(event) => renameSelected(event.target.value)}
                aria-label="Selected item name"
              />
            ) : (
              <div style={{ fontSize: '15px', fontWeight: 600, padding: '4px 0 12px 0', borderBottom: '1px solid rgba(28, 37, 40, 0.08)' }}>
                Relationship Link
              </div>
            )}
            {selectedCircle && (
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

                <button type="button" className="primary-action" onClick={addDemoCluster} style={{ marginTop: '8px' }}>
                  Add 3 demo people
                </button>

                {selectedCircle.id !== 'you' && (
                  <button
                    type="button"
                    className="primary-action"
                    style={{ marginTop: '16px', background: '#dc2626' }}
                    onClick={() => deleteCircle(selectedCircle.id)}
                  >
                    Delete Circle
                  </button>
                )}
              </>
            )}
            {selectedPerson && (
              <>
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

                <button
                  type="button"
                  className="primary-action"
                  style={{ marginTop: '16px', background: '#dc2626' }}
                  onClick={() => deletePerson(selectedPerson.id)}
                >
                  Delete Person
                </button>
              </>
            )}
            {selectedConnection && (() => {
              const fromNode = graph.people.find((p) => p.id === selectedConnection.fromId) || circlesById.get(selectedConnection.fromId)
              const toNode = graph.people.find((p) => p.id === selectedConnection.toId) || circlesById.get(selectedConnection.toId)
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
                    style={{ marginTop: '16px', background: '#dc2626' }}
                    onClick={() => deleteConnection(selectedConnection.id)}
                  >
                    Delete Connection
                  </button>
                </>
              )
            })()}
          </>
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', height: '100px', color: 'rgba(28, 37, 40, 0.52)' }}>
            <span style={{ fontSize: '13px', fontWeight: 650 }}>Select an item to view details</span>
          </div>
        )}
        <p style={{ marginTop: '14px' }}>Drag objects directly. Right-click a circle for creation actions. Parent circles auto-fit as contained objects move.</p>
      </aside>
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

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export default App
