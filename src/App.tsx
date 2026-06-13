import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import * as zip from '@zip.js/zip.js'

zip.configure({ useWebWorkers: false })
import { useAuth } from './lib/useAuth'
import { loadGraph, saveGraph } from './lib/graphPersistence'
// STRESS TEST — dev-only performance harness. See src/lib/stressTest.ts.

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
  customColor?: string
  fillMode?: CircleFillMode
}

type PersonNote = {
  id: string
  title: string
  body: string
}

type PersonLinkService = 'linkedin' | 'telegram' | 'instagram' | 'facebook' | 'whatsapp' | 'x' | 'website'

type PersonLink = {
  id: string
  service: PersonLinkService
  label: string
  url: string
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
  links?: PersonLink[]
}

export type Connection = {
  id: string
  fromId: string
  toId: string
}

export type GraphState = {
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

type MarqueeState = {
  startX: number
  startY: number
  currentX: number
  currentY: number
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

type CircleShapeMode = 'circles' | 'figures'
type CircleFillMode = 'transparent' | 'solid'

type HsvColor = {
  h: number
  s: number
  v: number
}

type BoardHit =
  | { type: 'circle-center'; circle: CircleNode }
  | { type: 'circle-edge'; circle: CircleNode }
  | { type: 'circle-body'; circle: CircleNode }
  | { type: 'person'; person: PersonNode }
  | { type: 'connection'; connection: Connection }
  | { type: 'connector-handle'; sourceId: string; sourceType: 'circle' | 'person'; x: number; y: number }
  | null

type PanState = {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

type PinchState = {
  initialDist: number
  initialMid: { x: number; y: number }
  initialCamera: Camera
  midWorld: { x: number; y: number }
}

type MoveCircleState = {
  pointerId: number
  circleId: string
  startX: number
  startY: number
  originX: number
  originY: number
  circleOrigins?: Record<string, { x: number; y: number }>
  personOrigins?: Record<string, { x: number; y: number }>
  disconnectedCircleIds?: string[]
}

type MovePersonState = {
  pointerId: number
  personId: string
  startX: number
  startY: number
  originX: number
  originY: number
  selectedOrigins?: Record<string, { x: number; y: number }>
}

type ResizeCircleState = {
  pointerId: number
  circleId: string
}

const MIN_SCALE = 0.35
const MAX_SCALE = 4.0

const CONNECT_THRESHOLD = 40
const MIN_CIRCLE_RADIUS = 72
const EDGE_RESIZE_HIT_SIZE = 18
const PERSON_VISUAL_RADIUS = 20
const CIRCLE_CENTER_RADIUS = 20
const HANDLE_HIT_RADIUS = 16
const PERSON_CONTAINMENT_RADIUS = 28
const CIRCLE_CONTAINMENT_PADDING = 28
const PERSON_COLLISION_RADIUS = 21
const PERSON_COLLISION_GAP = 4
const CIRCLE_CENTER_COLLISION_RADIUS = 24
const PERSON_CIRCLE_COLLISION_GAP = 8
const CIRCLE_COLLISION_GAP = 4
const COLLISION_PASSES = 10

const DEFAULT_STATE: GraphState = createDemoGraphState()

const MATERIAL_TONES: Record<CircleTone, { fill: string; border: string; text: string; centerBg: string }> = {
  blue: { fill: '#D2E4FF', border: '#004A77', text: '#001D35', centerBg: '#00629D' },
  red: { fill: '#FFDAD6', border: '#BA1A1A', text: '#410002', centerBg: '#C00015' },
  green: { fill: '#D1E8D2', border: '#0F6D38', text: '#00210B', centerBg: '#1E824A' },
  amber: { fill: '#FFE082', border: '#B06000', text: '#2A1400', centerBg: '#D87A00' },
  violet: { fill: '#EADDFF', border: '#6750A4', text: '#21005D', centerBg: '#7F67BE' },
}

const CIRCLE_COLOR_PRESETS = [
  '#00629D',
  '#C00015',
  '#1E824A',
  '#D87A00',
  '#7F67BE',
  '#0B57D0',
  '#00897B',
  '#6D4C41',
  '#AD1457',
  '#546E7A',
  '#F57C00',
  '#2E7D32',
  '#5E35B1',
  '#00838F',
  '#8D6E63',
  '#455A64',
  '#F4D35E',
  '#EE964B',
  '#F95738',
  '#A23E48',
  '#6A4C93',
  '#1982C4',
  '#8AC926',
  '#B8C480',
]

const LINK_SERVICE_OPTIONS: { service: PersonLinkService; label: string; placeholder: string }[] = [
  { service: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/name' },
  { service: 'telegram', label: 'Telegram', placeholder: '@username' },
  { service: 'instagram', label: 'Instagram', placeholder: '@username' },
  { service: 'facebook', label: 'Facebook', placeholder: 'facebook.com/name' },
  { service: 'whatsapp', label: 'WhatsApp', placeholder: '+45 12 34 56 78' },
  { service: 'x', label: 'X', placeholder: '@username' },
  { service: 'website', label: 'Custom', placeholder: 'https://example.com/profile' },
]

function getCircleColors(circle: CircleNode) {
  if (!circle.customColor) return MATERIAL_TONES[circle.tone]
  return {
    fill: colorMix(circle.customColor, '#ffffff', 0.78),
    border: colorMix(circle.customColor, '#000000', 0.28),
    text: '#1a1c1e',
    centerBg: circle.customColor,
  }
}

function colorMix(hex: string, target: string, amount: number) {
  const sourceRgb = hexToRgb(hex)
  const targetRgb = hexToRgb(target)
  if (!sourceRgb || !targetRgb) return hex
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount)
  return rgbToHex(mix(sourceRgb.r, targetRgb.r), mix(sourceRgb.g, targetRgb.g), mix(sourceRgb.b, targetRgb.b))
}

function hexToRgb(hex: string) {
  const normalized = hex.trim().replace(/^#/, '')
  if (!/^[\da-fA-F]{6}$/.test(normalized)) return null
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

function hexToHsv(hex: string): HsvColor {
  const rgb = hexToRgb(hex) ?? { r: 0, g: 98, b: 157 }
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6)
    else if (max === g) h = 60 * ((b - r) / delta + 2)
    else h = 60 * ((r - g) / delta + 4)
  }
  if (h < 0) h += 360
  return {
    h,
    s: max === 0 ? 0 : delta / max,
    v: max,
  }
}

function hsvToHex({ h, s, v }: HsvColor) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return rgbToHex(
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  )
}

function getReadableColor(background: string) {
  const rgb = hexToRgb(background)
  if (!rgb) return '#ffffff'
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
  return luminance > 0.58 ? '#1a1c1e' : '#ffffff'
}

function inferLinkService(rawValue: string): PersonLinkService {
  const value = rawValue.trim().toLowerCase()
  if (value.includes('linkedin.com')) return 'linkedin'
  if (value.includes('t.me') || value.includes('telegram.me')) return 'telegram'
  if (value.includes('instagram.com')) return 'instagram'
  if (value.includes('facebook.com') || value.includes('fb.com')) return 'facebook'
  if (value.includes('wa.me') || value.includes('whatsapp.com')) return 'whatsapp'
  if (value.includes('x.com') || value.includes('twitter.com')) return 'x'
  if (value.startsWith('@')) return 'telegram'
  if (/^\+?[\d\s().-]{7,}$/.test(value)) return 'whatsapp'
  return 'website'
}

function normalizeLinkInput(rawValue: string, service: PersonLinkService): { label: string; url: string } {
  const value = rawValue.trim()
  const cleanHandle = value.replace(/^@/, '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
  if (service === 'telegram') {
    const handle = cleanHandle.replace(/^t\.me\//, '').replace(/^telegram\.me\//, '')
    return { label: `@${handle}`, url: `https://t.me/${handle}` }
  }
  if (service === 'instagram') {
    const handle = cleanHandle.replace(/^instagram\.com\//, '')
    return { label: `@${handle}`, url: `https://instagram.com/${handle}` }
  }
  if (service === 'x') {
    const handle = cleanHandle.replace(/^x\.com\//, '').replace(/^twitter\.com\//, '')
    return { label: `@${handle}`, url: `https://x.com/${handle}` }
  }
  if (service === 'whatsapp') {
    const digits = value.replace(/[^\d+]/g, '')
    return { label: digits || value, url: digits ? `https://wa.me/${digits.replace(/^\+/, '')}` : value }
  }
  if (service === 'linkedin') {
    const url = /^https?:\/\//i.test(value) ? value : `https://${cleanHandle}`
    return { label: cleanHandle.replace(/^linkedin\.com\/in\//, ''), url }
  }
  if (service === 'facebook') {
    const url = /^https?:\/\//i.test(value) ? value : `https://${cleanHandle}`
    return { label: cleanHandle.replace(/^facebook\.com\//, '').replace(/^fb\.com\//, ''), url }
  }
  return {
    label: cleanHandle || value,
    url: /^https?:\/\//i.test(value) ? value : `https://${value}`,
  }
}

function getNodePath(
  cx: number,
  cy: number,
  r: number,
  shapeType: ShapeType,
  sides: number,
  amplitude: number
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

const authOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--md-surface-container-low, #eef1f3)',
}

const authCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '16px',
  padding: '32px',
  borderRadius: '24px',
  background: 'var(--md-surface, #fff)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
  maxWidth: '320px',
}

function App() {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  // Canvas 2D board renderer: circles, edges, people, labels, and interaction chrome.
  const peopleCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const panRef = useRef<PanState | null>(null)
  const moveCircleRef = useRef<MoveCircleState | null>(null)
  const movePersonRef = useRef<MovePersonState | null>(null)
  const resizeCircleRef = useRef<ResizeCircleState | null>(null)
  const activePointersRef = useRef<PointerEvent[]>([])
  const pinchRef = useRef<PinchState | null>(null)
  const marqueeRef = useRef<MarqueeState | null>(null)
  const isRightClickDragRef = useRef(false)
  // Drag updates are coalesced to one React commit per animation frame (like the
  // pan/zoom gesture) so a move event flood doesn't trigger a re-render storm.
  const dragRafRef = useRef<number | null>(null)
  const pendingGraphRef = useRef<((current: GraphState) => GraphState) | null>(null)
  const pendingConnectorRef = useRef<DragConnector | null>(null)
  const [graph, setGraph] = useState(createInitialGraph)
  const auth = useAuth()
  const userId = auth.session?.user?.id ?? null
  // True once we've pulled this user's saved graph (or confirmed they have none).
  // The board stays hidden until then so the demo seed never flashes or gets saved.
  const [graphLoaded, setGraphLoaded] = useState(false)
  // Bumped when an avatar image finishes decoding, to force a board repaint.
  const [imageEpoch, setImageEpoch] = useState(0)

  useEffect(() => {
    requestBoardRepaint = () => setImageEpoch((epoch) => epoch + 1)
    return () => {
      requestBoardRepaint = null
    }
  }, [])

  // Load the signed-in user's graph; a brand-new account starts from a blank
  // canvas with only their "you" circle — the local demo data is never persisted.
  useEffect(() => {
    if (auth.status !== 'authenticated' || !userId || !auth.session) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGraphLoaded(false)
    loadGraph(userId)
      .then((saved) => {
        if (cancelled) return
        const base = saved ?? createFreshGraph()
        setGraph(stampYouIdentity(base, auth.session!.user))
        setGraphLoaded(true)
      })
      .catch((error) => {
        console.error('Failed to load graph', error)
        if (!cancelled) {
          setGraph(stampYouIdentity(createFreshGraph(), auth.session!.user))
          setGraphLoaded(true)
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, userId])

  // Debounced autosave: a flood of drags or a bulk import collapses into one write.
  useEffect(() => {
    if (!graphLoaded || auth.status !== 'authenticated' || !userId) return
    const timer = window.setTimeout(() => {
      void saveGraph(userId, graph).catch((error) => console.error('Failed to save graph', error))
    }, 800)
    return () => window.clearTimeout(timer)
  }, [graph, graphLoaded, auth.status, userId])

  const [camera, setCamera] = useState<Camera>({ x: window.innerWidth / 2, y: window.innerHeight / 2, scale: 0.82 })
  // cameraRef holds the *live* camera during a pan/zoom gesture. `camera` state
  // is only the last *settled* value (committed when the gesture stops moving).
  const cameraRef = useRef(camera)
  // Gesture machinery: during a pan/zoom we drive the DOM transform + canvas
  // imperatively (no React re-render), then commit to state once it settles.
  const gestureActiveRef = useRef(false)
  const gestureRafRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const driveCameraRef = useRef<(next: Camera) => void>(() => {})
  const settleGestureRef = useRef<() => void>(() => {})

  const [connector, setConnector] = useState<DragConnector | null>(null)
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [createMenu, setCreateMenu] = useState<CreateMenu | null>(null)
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null)
  const [showCircleDropdown, setShowCircleDropdown] = useState(false)
  const [showCircleStylePanel, setShowCircleStylePanel] = useState(false)
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([])
  const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>([])
  // Person currently under the cursor — promoted to an interactive DOM node so it
  // can be clicked/dragged even inside a dense circle that's otherwise canvas-only.
  const [hoveredPersonId, setHoveredPersonId] = useState<string | null>(null)

  // Viewport size in CSS px, used to cull off-screen nodes. Updated on resize.
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })

  const [showSettings, setShowSettings] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [showCircleLabels, setShowCircleLabels] = useState(true)
  const [showPersonLabels, setShowPersonLabels] = useState(true)
  const [circleShapeMode, setCircleShapeMode] = useState<CircleShapeMode>('circles')
  const [circleFillMode, setCircleFillMode] = useState<CircleFillMode>('transparent')
  const [centerBehavior, setCenterBehavior] = useState<'connect' | 'move'>('connect')
  const [hoveredConnId, setHoveredConnId] = useState<string | null>(null)
  const [openNotesPersonId, setOpenNotesPersonId] = useState<string | null>(null)
  const [newNoteBody, setNewNoteBody] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [newLinkValue, setNewLinkValue] = useState('')
  const [newLinkService, setNewLinkService] = useState<PersonLinkService>('website')
  const [showLinkServicePicker, setShowLinkServicePicker] = useState(false)
  const noteInputRef = useRef<HTMLTextAreaElement>(null)

  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const settingsPanelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function selectItem(item: SelectedItem) {
    setShowCircleStylePanel(false)
    setSelectedItem(item)
  }

  async function handleLinkedInImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const zipReader = new zip.ZipReader(new zip.BlobReader(file))
      const entries = await zipReader.getEntries()

      const connectionsEntry = entries.find(
        (e) => e.filename === 'Connections.csv' || e.filename.endsWith('/Connections.csv')
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!connectionsEntry || typeof (connectionsEntry as any).getData !== 'function') {
        alert('Could not find Connections.csv inside the ZIP file.')
        await zipReader.close()
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const csvText = await (connectionsEntry as any).getData(new zip.TextWriter())
      await zipReader.close()

      const rows = parseCSV(csvText)
      if (rows.length === 0) {
        alert('Connections.csv is empty or invalid.')
        return
      }

      let headerIdx = -1
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const lowerRow = row.map(cell => cell.toLowerCase().replace(/\s+/g, ''))
        if (lowerRow.includes('firstname') && lowerRow.includes('lastname') && lowerRow.includes('company')) {
          headerIdx = i
          break
        }
      }

      if (headerIdx === -1) {
        alert('Could not find standard headers in Connections.csv.')
        return
      }

      const headers = rows[headerIdx].map(cell => cell.toLowerCase().replace(/\s+/g, ''))
      const firstNameIdx = headers.indexOf('firstname')
      const lastNameIdx = headers.indexOf('lastname')
      const companyIdx = headers.indexOf('company')
      const positionIdx = headers.indexOf('position')
      const urlIdx = headers.indexOf('url')
      const emailIdx = headers.indexOf('emailaddress')
      const connectedOnIdx = headers.indexOf('connectedon')

      const dataRows = rows.slice(headerIdx + 1)

      const companyGroups: Record<string, typeof dataRows> = {}
      for (const row of dataRows) {
        if (row.length <= Math.max(firstNameIdx, lastNameIdx, companyIdx)) continue
        const company = row[companyIdx]?.trim() || ''
        if (!companyGroups[company]) {
          companyGroups[company] = []
        }
        companyGroups[company].push(row)
      }

      setGraph((current) => {
        const nextCircles = [...current.circles]
        const nextPeople = [...current.people]

        const youCircle = nextCircles.find((c) => c.id === 'you')
        const youX = youCircle ? youCircle.x : 0
        const youY = youCircle ? youCircle.y : 0

        let companyIndex = 0
        const totalCompanies = Object.keys(companyGroups).length

        for (const [companyName, members] of Object.entries(companyGroups)) {
          const cleanCompName = companyName ? companyName : 'No Company'
          const companyId = `linkedin-company-${cleanCompName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`

          let companyCircle = nextCircles.find((c) => c.id === companyId)
          if (!companyCircle) {
            const angle = (companyIndex / totalCompanies) * 2 * Math.PI
            const placementRadius = 680
            const x = youX + Math.cos(angle) * placementRadius
            const y = youY + Math.sin(angle) * placementRadius
            const icon = cleanCompName.slice(0, 2).toUpperCase()

            companyCircle = {
              id: companyId,
              name: cleanCompName,
              icon,
              x,
              y,
              radius: 90,
              minRadius: 90,
              parentId: null,
              connectedTo: 'you',
              tone: nextTone(nextCircles.length),
              shapeType: 'wavy',
              sides: 12,
              amplitude: 8
            }
            nextCircles.push(companyCircle)
            companyIndex++
          }

          let personIndex = 0
          for (const memberRow of members) {
            const firstName = memberRow[firstNameIdx] || ''
            const lastName = memberRow[lastNameIdx] || ''
            const name = `${firstName} ${lastName}`.trim()
            if (!name) continue

            const personId = `linkedin-person-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`

            if (nextPeople.some(p => p.id === personId)) {
              continue
            }

            const position = positionIdx !== -1 ? memberRow[positionIdx] || '' : ''
            const url = urlIdx !== -1 ? memberRow[urlIdx] || '' : ''
            const email = emailIdx !== -1 ? memberRow[emailIdx] || '' : ''
            const connectedOn = connectedOnIdx !== -1 ? memberRow[connectedOnIdx] || '' : ''

            const avatar = (firstName.slice(0, 1) + lastName.slice(0, 1)).toUpperCase() || 'IN'

            const pAngle = (personIndex / members.length) * 2 * Math.PI
            const px = companyCircle.x + Math.cos(pAngle) * 35
            const py = companyCircle.y + Math.sin(pAngle) * 35

            const notesList: PersonNote[] = []
            if (position) {
              notesList.push({
                id: `note-pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: 'Position',
                body: position
              })
            }
            if (connectedOn) {
              notesList.push({
                id: `note-conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: 'Connected On',
                body: connectedOn
              })
            }
            if (email) {
              notesList.push({
                id: `note-email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: 'Email',
                body: email
              })
            }
            const linksList: PersonLink[] = url
              ? [{
                  id: `link-linkedin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  service: 'linkedin',
                  label: 'LinkedIn',
                  url,
                }]
              : []

            nextPeople.push({
              id: personId,
              name,
              role: position || 'Connection',
              x: px,
              y: py,
              circleId: companyCircle.id,
              avatar,
              shapeType: 'circle',
              sides: 10,
              amplitude: 0,
              notes: notesList,
              links: linksList,
            })
            personIndex++
          }
        }

        return ensureContainment({
          ...current,
          circles: nextCircles,
          people: nextPeople
        })
      })

      alert('LinkedIn data imported successfully!')
    } catch (err) {
      console.error(err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      alert(`Failed to import LinkedIn ZIP: ${errorMessage}`)
    }
  }

  function deletePerson(personId: string) {
    setGraph((current) => ({
      ...current,
      people: current.people.filter((p) => p.id !== personId),
      connections: (current.connections || []).filter(
        (conn) => conn.fromId !== personId && conn.toId !== personId
      ),
    }))
    selectItem(null)
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

  function handleSaveNewNote(personId: string) {
    const trimmed = newNoteBody.trim()
    if (trimmed) {
      addPersonNote(
        personId,
        trimmed.split('\n')[0].substring(0, 30) || 'Untitled note',
        trimmed
      )
      setNewNoteBody('')
      if (noteInputRef.current) {
        noteInputRef.current.style.height = 'auto'
      }
      requestAnimationFrame(() => {
        noteInputRef.current?.focus()
      })
    }
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

  function addPersonLink(personId: string, rawValue: string, service: PersonLinkService) {
    const trimmed = rawValue.trim()
    if (!trimmed) return
    const normalized = normalizeLinkInput(trimmed, service)
    setGraph((current) => ({
      ...current,
      people: current.people.map((p) => {
        if (p.id !== personId) return p
        const links = p.links ? [...p.links] : []
        links.push({
          id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          service,
          label: normalized.label,
          url: normalized.url,
        })
        return { ...p, links }
      }),
    }))
  }

  function deletePersonLink(personId: string, linkId: string) {
    setGraph((current) => ({
      ...current,
      people: current.people.map((p) => {
        if (p.id !== personId || !p.links) return p
        return { ...p, links: p.links.filter((link) => link.id !== linkId) }
      }),
    }))
  }

  function handleSaveNewLink(personId: string) {
    const trimmed = newLinkValue.trim()
    if (!trimmed) return
    const inferredService = inferLinkService(trimmed)
    const needsChoice = trimmed.startsWith('@') || /^\+?[\d\s().-]{7,}$/.test(trimmed)
    if (needsChoice && !showLinkServicePicker) {
      setNewLinkService(inferredService)
      setShowLinkServicePicker(true)
      return
    }
    addPersonLink(personId, trimmed, showLinkServicePicker ? newLinkService : inferredService)
    setNewLinkValue('')
    setShowLinkServicePicker(false)
    setNewLinkService('website')
  }

  function setCircleColorFromHsv(circleId: string, hsv: HsvColor) {
    updateCircleStyle(circleId, { customColor: hsvToHex(hsv) })
  }

  function handleColorWheelPointer(event: ReactPointerEvent<HTMLButtonElement>, circle: CircleNode) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = event.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const dx = event.clientX - centerX
    const dy = event.clientY - centerY
    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2)
    const distance = Math.min(radius, Math.hypot(dx, dy))
    const current = hexToHsv(getCircleColors(circle).centerBg)
    const angle = Math.atan2(dy, dx)
    const hue = (angle * 180) / Math.PI + 180
    setCircleColorFromHsv(circle.id, {
      h: hue,
      s: distance / radius,
      v: current.v,
    })
  }

  function handleBrightnessPointer(event: ReactPointerEvent<HTMLButtonElement>, circle: CircleNode) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = event.currentTarget.getBoundingClientRect()
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    const current = hexToHsv(getCircleColors(circle).centerBg)
    setCircleColorFromHsv(circle.id, {
      ...current,
      v: x,
    })
  }

  function updateCircleCorners(circle: CircleNode, sides: number) {
    const currentAmplitude = circle.amplitude ?? 0
    updateCircleStyle(circle.id, {
      shapeType: currentAmplitude > 0 ? 'wavy' : sides >= 25 ? 'circle' : 'polygon',
      sides,
      amplitude: currentAmplitude,
    })
  }

  function updateCircleAmplitude(circle: CircleNode, amplitude: number) {
    const sides = circle.sides ?? 25
    updateCircleStyle(circle.id, {
      shapeType: amplitude > 0 ? 'wavy' : sides >= 25 ? 'circle' : 'polygon',
      sides,
      amplitude,
    })
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

    selectItem(null)
  }

  function deleteConnection(connId: string) {
    setGraph((current) => ({
      ...current,
      connections: (current.connections || []).filter((conn) => conn.id !== connId),
    }))
    selectItem(null)
  }

  function deleteSelectedItem() {
    if (selectedPeopleIds.length > 0 || selectedCircleIds.length > 0) {
      setGraph((current) => {
        const deletedCircleIds = new Set<string>(selectedCircleIds)
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

        const deletedPeopleIds = new Set<string>(selectedPeopleIds)
        for (const p of current.people) {
          if (deletedCircleIds.has(p.circleId)) {
            deletedPeopleIds.add(p.id)
          }
        }

        const nextCircles = current.circles
          .filter((c) => !deletedCircleIds.has(c.id))
          .map((c) => {
            if (c.connectedTo && deletedCircleIds.has(c.connectedTo)) {
              return { ...c, connectedTo: 'you' }
            }
            return c
          })

        const nextPeople = current.people.filter((p) => !deletedPeopleIds.has(p.id))

        const nextConnections = (current.connections || []).filter(
          (conn) =>
            !deletedPeopleIds.has(conn.fromId) &&
            !deletedPeopleIds.has(conn.toId) &&
            !deletedCircleIds.has(conn.fromId) &&
            !deletedCircleIds.has(conn.toId)
        )

        return ensureContainment({
          ...current,
          circles: nextCircles,
          people: nextPeople,
          connections: nextConnections,
        })
      })
      setSelectedPeopleIds([])
      setSelectedCircleIds([])
      selectItem(null)
    } else if (selectedItem?.type === 'person') {
      deletePerson(selectedItem.id)
    } else if (selectedItem?.type === 'circle') {
      deleteCircle(selectedItem.id)
    } else if (selectedItem?.type === 'connection') {
      deleteConnection(selectedItem.id)
    }
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
    if (!showCircleStylePanel) return
    function handleOutsideCircleStyleClick(event: PointerEvent) {
      const target = event.target as HTMLElement
      if (target.closest('.circle-style-popover') || target.closest('.circle-style-button')) return
      setShowCircleStylePanel(false)
    }
    document.addEventListener('pointerdown', handleOutsideCircleStyleClick)
    return () => {
      document.removeEventListener('pointerdown', handleOutsideCircleStyleClick)
    }
  }, [showCircleStylePanel])

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

        deleteSelectedItem()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem, selectedPeopleIds, selectedCircleIds])

  useEffect(() => {
    if (!showCircleDropdown) return
    function handleOutsideClick() {
      setShowCircleDropdown(false)
    }
    const timeout = setTimeout(() => {
      window.addEventListener('click', handleOutsideClick)
    }, 0)
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('click', handleOutsideClick)
    }
  }, [showCircleDropdown])

  const displayCircles = graph.circles
  const displayPeople = graph.people
  const displayConnections = useMemo(() => graph.connections || [], [graph.connections])

  const circlesById = useMemo(() => new Map(displayCircles.map((circle) => [circle.id, circle])), [displayCircles])
  const peopleById = useMemo(() => new Map(displayPeople.map((person) => [person.id, person])), [displayPeople])
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
  const boardIndex = useMemo(
    () => createBoardIndex(sortedCircles, displayPeople, displayConnections),
    [sortedCircles, displayPeople, displayConnections],
  )





  const selectedCircle = selectedItem?.type === 'circle' ? circlesById.get(selectedItem.id) ?? null : null
  const selectedPerson = selectedItem?.type === 'person' ? graph.people.find((person) => person.id === selectedItem.id) ?? null : null
  const selectedConnection = selectedItem?.type === 'connection' ? (graph.connections || []).find((conn) => conn.id === selectedItem.id) ?? null : null



  // Push the live camera onto the dotted grid without going through React.
  function applyDomCamera(cam: Camera) {
    const surface = surfaceRef.current
    if (surface) {
      const minor = 32 * cam.scale
      const major = 160 * cam.scale
      surface.style.backgroundSize = `${major}px ${major}px, ${minor}px ${minor}px`
      surface.style.backgroundPosition = `${cam.x}px ${cam.y}px`
    }
  }

  // One imperative frame of a gesture: move the DOM and repaint the (culled)
  // people canvas at the live camera, so newly revealed people fill in mid-pan.
  function applyLiveCamera() {
    const cam = cameraRef.current
    applyDomCamera(cam)
    const canvas = peopleCanvasRef.current
    const surface = surfaceRef.current
    if (canvas && surface) {
      drawBoardLayer(
        canvas,
        surface,
        cam,
        boardIndex,
        selectedItem,
        hoveredPersonId,
        hoveredConnId,
        connector,
        showCircleLabels,
        showPersonLabels,
        circleShapeMode,
        circleFillMode,
        selectedPeopleIds,
        marqueeRef.current,
        selectedCircleIds,
      )
    }
  }

  // Called on every pan/zoom event. Updates the live camera, schedules one
  // imperative repaint per frame, promotes the world to its own GPU layer
  // (so zoom scales the cached bitmap instead of repainting every vector),
  // and (re)arms the settle timer that commits a sharp render once you pause.
  function driveCamera(next: Camera) {
    cameraRef.current = next
    if (!gestureActiveRef.current) {
      gestureActiveRef.current = true
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
    if (dragRafRef.current != null) window.cancelAnimationFrame(dragRafRef.current)
  }, [])

  // Track viewport size so culling has the current visible rectangle.
  useEffect(() => {
    function handleResize() {
      setViewport({ w: window.innerWidth, h: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Repaint the people canvas whenever the settled camera, people, viewport or
  // interactive set changes. (Gesture frames are handled imperatively above.)
  useEffect(() => {
    const canvas = peopleCanvasRef.current
    const surface = surfaceRef.current
    if (!canvas || !surface) return
    drawBoardLayer(
      canvas,
      surface,
      camera,
      boardIndex,
      selectedItem,
      hoveredPersonId,
      hoveredConnId,
      connector,
      showCircleLabels,
      showPersonLabels,
      circleShapeMode,
      circleFillMode,
      selectedPeopleIds,
      marquee,
      selectedCircleIds,
    )
  }, [
    camera,
    viewport,
    boardIndex,
    selectedItem,
    hoveredPersonId,
    hoveredConnId,
    connector,
    showCircleLabels,
    showPersonLabels,
    circleShapeMode,
    circleFillMode,
    selectedPeopleIds,
    imageEpoch,
    marquee,
    selectedCircleIds,
  ])

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
    const liveCamera = cameraRef.current
    return {
      x: (point.x - liveCamera.x) / liveCamera.scale,
      y: (point.y - liveCamera.y) / liveCamera.scale,
    }
  }

  // Coalesce drag-driven state updates to one commit per frame. Each move stores
  // the latest absolute target (updaters/connector are not cumulative), and a
  // single rAF flushes it — so a 120 Hz move stream becomes <=60 re-renders/s.
  function scheduleDrag() {
    if (dragRafRef.current != null) return
    dragRafRef.current = window.requestAnimationFrame(() => {
      dragRafRef.current = null
      const update = pendingGraphRef.current
      pendingGraphRef.current = null
      if (update) setGraph(update)
      const conn = pendingConnectorRef.current
      pendingConnectorRef.current = null
      if (conn) setConnector(conn)
    })
  }

  // Cancel the pending frame and return the last pending graph updater (if any),
  // so pointer-up can apply the final position immediately (plus containment).
  function takePendingGraphUpdate() {
    if (dragRafRef.current != null) {
      window.cancelAnimationFrame(dragRafRef.current)
      dragRafRef.current = null
    }
    const update = pendingGraphRef.current
    pendingGraphRef.current = null
    return update
  }

  function handleSurfacePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch' && event.button !== 0 && event.button !== 2) return
    const isRightClick = event.pointerType !== 'touch' && event.button === 2
    isRightClickDragRef.current = isRightClick

    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)

    activePointersRef.current = [
      ...activePointersRef.current.filter((p) => p.pointerId !== event.pointerId),
      event.nativeEvent,
    ]

    if (activePointersRef.current.length >= 2) {
      panRef.current = null
      moveCircleRef.current = null
      movePersonRef.current = null
      resizeCircleRef.current = null
      setConnector(null)
      pendingConnectorRef.current = null
      pendingGraphRef.current = null
      if (dragRafRef.current != null) {
        window.cancelAnimationFrame(dragRafRef.current)
        dragRafRef.current = null
      }

      const p1 = activePointersRef.current[0]
      const p2 = activePointersRef.current[1]
      const rect = event.currentTarget.getBoundingClientRect()
      const lp1 = { x: p1.clientX - rect.left, y: p1.clientY - rect.top }
      const lp2 = { x: p2.clientX - rect.left, y: p2.clientY - rect.top }
      const initialDist = Math.hypot(lp1.x - lp2.x, lp1.y - lp2.y)
      const initialMid = {
        x: (lp1.x + lp2.x) / 2,
        y: (lp1.y + lp2.y) / 2,
      }
      const initialCamera = { ...cameraRef.current }
      pinchRef.current = {
        initialDist,
        initialMid,
        initialCamera,
        midWorld: {
          x: (initialMid.x - initialCamera.x) / initialCamera.scale,
          y: (initialMid.y - initialCamera.y) / initialCamera.scale,
        },
      }
      return
    }

    if (!demoMode) setCreateMenu(null)
    setOpenNotesPersonId(null)

    const hit = hitTestBoard(boardIndex, cameraRef.current, selectedItem, {
      x: event.clientX,
      y: event.clientY,
    })

    if (hit?.type === 'connector-handle') {
      if (isRightClick) return
      startConnector(event, hit.sourceId, hit.sourceType, hit.x, hit.y)
      return
    }

    if (hit?.type === 'person') {
      if (isRightClick) {
        setGraph((current) => ({
          ...current,
          people: current.people.map((p) => p.id === hit.person.id ? { ...p, circleId: '' } : p),
          connections: (current.connections || []).filter(
            (conn) => conn.fromId !== hit.person.id && conn.toId !== hit.person.id
          ),
        }))
        setSelectedPeopleIds([])
        setSelectedCircleIds([])
        selectItem({ type: 'person', id: hit.person.id })
        startPersonMove(event, hit.person)
      } else {
        if (event.shiftKey) {
          setSelectedPeopleIds((prev) => {
            let next = [...prev]
            if (selectedItem?.type === 'person' && !next.includes(selectedItem.id)) {
              next.push(selectedItem.id)
            }
            if (next.includes(hit.person.id)) {
              next = next.filter((id) => id !== hit.person.id)
            } else {
              next.push(hit.person.id)
            }
            return next
          })
          selectItem(null)
        } else {
          if (!selectedPeopleIds.includes(hit.person.id)) {
            setSelectedPeopleIds([])
            setSelectedCircleIds([])
            selectItem({ type: 'person', id: hit.person.id })
          }
          startPersonMove(event, hit.person)
        }
      }
      return
    }

    if (hit?.type === 'circle-center') {
      if (isRightClick) {
        setGraph((current) => ({
          ...current,
          circles: current.circles.map((c) =>
            c.id === hit.circle.id ? { ...c, parentId: null, connectedTo: null } : c
          ),
          connections: (current.connections || []).filter(
            (conn) => conn.fromId !== hit.circle.id && conn.toId !== hit.circle.id
          ),
        }))
        setSelectedPeopleIds([])
        setSelectedCircleIds([])
        selectItem({ type: 'circle', id: hit.circle.id })
        startCircleMove(event, hit.circle)
      } else {
        if (event.shiftKey) {
          setSelectedCircleIds((prev) => {
            let next = [...prev]
            if (selectedItem?.type === 'circle' && !next.includes(selectedItem.id)) {
              next.push(selectedItem.id)
            }
            if (next.includes(hit.circle.id)) {
              next = next.filter((id) => id !== hit.circle.id)
            } else {
              next.push(hit.circle.id)
            }
            return next
          })
          selectItem(null)
        } else {
          if (!selectedCircleIds.includes(hit.circle.id)) {
            setSelectedPeopleIds([])
            setSelectedCircleIds([])
            selectItem({ type: 'circle', id: hit.circle.id })
          }
          if (centerBehavior === 'connect') {
            startConnector(event, hit.circle.id, 'circle', hit.circle.x, hit.circle.y)
          } else {
            startCircleMove(event, hit.circle)
          }
        }
      }
      return
    }

    if (isRightClick) {
      setSelectedPeopleIds([])
      setSelectedCircleIds([])
      selectItem(null)
      setOpenNotesPersonId(null)
      const marqueeState = {
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
      }
      marqueeRef.current = marqueeState
      setMarquee(marqueeState)
      return
    }

    if (hit?.type === 'circle-edge') {
      setSelectedPeopleIds([])
      setSelectedCircleIds([])
      startCircleResize(event, hit.circle)
      return
    }

    if (hit?.type === 'circle-body') {
      if (event.shiftKey) {
        setSelectedCircleIds((prev) => {
          let next = [...prev]
          if (selectedItem?.type === 'circle' && !next.includes(selectedItem.id)) {
            next.push(selectedItem.id)
          }
          if (next.includes(hit.circle.id)) {
            next = next.filter((id) => id !== hit.circle.id)
          } else {
            next.push(hit.circle.id)
          }
          return next
        })
        selectItem(null)
      } else {
        if (!selectedCircleIds.includes(hit.circle.id)) {
          setSelectedPeopleIds([])
          setSelectedCircleIds([])
          selectItem({ type: 'circle', id: hit.circle.id })
        }
        startCircleMove(event, hit.circle)
      }
      return
    }

    if (hit?.type === 'connection') {
      setSelectedPeopleIds([])
      setSelectedCircleIds([])
      selectItem({ type: 'connection', id: hit.connection.id })
      return
    }

    setSelectedPeopleIds([])
    setSelectedCircleIds([])
    selectItem(null)
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
    activePointersRef.current = activePointersRef.current.map((p) =>
      p.pointerId === event.pointerId ? event.nativeEvent : p
    )

    if (marqueeRef.current) {
      marqueeRef.current.currentX = event.clientX
      marqueeRef.current.currentY = event.clientY
      setMarquee({ ...marqueeRef.current })
      return
    }

    if (activePointersRef.current.length >= 2 && !pinchRef.current) {
      const p1 = activePointersRef.current[0]
      const p2 = activePointersRef.current[1]
      const rect = event.currentTarget.getBoundingClientRect()
      const lp1 = { x: p1.clientX - rect.left, y: p1.clientY - rect.top }
      const lp2 = { x: p2.clientX - rect.left, y: p2.clientY - rect.top }
      const initialDist = Math.hypot(lp1.x - lp2.x, lp1.y - lp2.y)
      const initialMid = {
        x: (lp1.x + lp2.x) / 2,
        y: (lp1.y + lp2.y) / 2,
      }
      const initialCamera = { ...cameraRef.current }
      pinchRef.current = {
        initialDist,
        initialMid,
        initialCamera,
        midWorld: {
          x: (initialMid.x - initialCamera.x) / initialCamera.scale,
          y: (initialMid.y - initialCamera.y) / initialCamera.scale,
        },
      }
    }

    const pinch = pinchRef.current
    if (pinch && activePointersRef.current.length >= 2) {
      const p1 = activePointersRef.current[0]
      const p2 = activePointersRef.current[1]
      const rect = event.currentTarget.getBoundingClientRect()
      const lp1 = { x: p1.clientX - rect.left, y: p1.clientY - rect.top }
      const lp2 = { x: p2.clientX - rect.left, y: p2.clientY - rect.top }
      const newDist = Math.hypot(lp1.x - lp2.x, lp1.y - lp2.y)
      const newMid = {
        x: (lp1.x + lp2.x) / 2,
        y: (lp1.y + lp2.y) / 2,
      }

      const scaleFactor = pinch.initialDist > 5 ? newDist / pinch.initialDist : 1
      const nextScale = clamp(pinch.initialCamera.scale * scaleFactor, MIN_SCALE, MAX_SCALE)

      const nextX = newMid.x - pinch.midWorld.x * nextScale
      const nextY = newMid.y - pinch.midWorld.y * nextScale

      driveCamera({
        scale: nextScale,
        x: nextX,
        y: nextY,
      })
      return
    }

    const pan = panRef.current
    if (pan?.pointerId === event.pointerId) {
      driveCamera({
        ...cameraRef.current,
        x: pan.originX + event.clientX - pan.startX,
        y: pan.originY + event.clientY - pan.startY,
      })
    }

    // During a drag, coalesce graph layout to one animation-frame commit. The
    // active item stays under the pointer while collision layout pushes blockers.
    const moving = moveCircleRef.current
    if (moving?.pointerId === event.pointerId) {
      const deltaX = (event.clientX - moving.startX) / camera.scale
      const deltaY = (event.clientY - moving.startY) / camera.scale
      const { circleOrigins, personOrigins } = moving
      pendingGraphRef.current = (current) =>
        ensureContainment(
          {
            ...current,
            circles: current.circles.map((c) =>
              circleOrigins && c.id in circleOrigins
                ? { ...c, x: circleOrigins[c.id].x + deltaX, y: circleOrigins[c.id].y + deltaY }
                : c
            ),
            people: current.people.map((p) =>
              personOrigins && p.id in personOrigins
                ? { ...p, x: personOrigins[p.id].x + deltaX, y: personOrigins[p.id].y + deltaY }
                : p
            ),
          },
          { activeCircleId: moving.circleId },
        )
      scheduleDrag()
    }

    const movingPerson = movePersonRef.current
    if (movingPerson?.pointerId === event.pointerId) {
      const deltaX = (event.clientX - movingPerson.startX) / camera.scale
      const deltaY = (event.clientY - movingPerson.startY) / camera.scale
      const { selectedOrigins } = movingPerson
      pendingGraphRef.current = (current) =>
        ensureContainment(
          {
            ...current,
            people: current.people.map((person) => {
              if (selectedOrigins && person.id in selectedOrigins) {
                const origin = selectedOrigins[person.id]
                return { ...person, x: origin.x + deltaX, y: origin.y + deltaY }
              } else if (person.id === movingPerson.personId) {
                return { ...person, x: movingPerson.originX + deltaX, y: movingPerson.originY + deltaY }
              }
              return person
            }),
          },
          { activePersonId: movingPerson.personId },
        )
      scheduleDrag()
    }

    const resizing = resizeCircleRef.current
    if (resizing?.pointerId === event.pointerId) {
      const world = screenToWorld({ x: event.clientX, y: event.clientY })
      pendingGraphRef.current = (current) => resizeCircleFromPoint(current, resizing.circleId, world)
      scheduleDrag()
    }

    if (connector) {
      const world = screenToWorld({ x: event.clientX, y: event.clientY })
      pendingConnectorRef.current = { ...connector, endX: world.x, endY: world.y }
      scheduleDrag()
      return
    }

    // Idle hover is canvas hit-testing now; React only stores the hovered ids.
    if (!pan && !moving && !movingPerson && !resizing) {
      const hit = hitTestBoard(boardIndex, cameraRef.current, selectedItem, {
        x: event.clientX,
        y: event.clientY,
      })
      const id = hit?.type === 'person' ? hit.person.id : null
      if (id !== hoveredPersonId) setHoveredPersonId(id)
      const connId = hit?.type === 'connection' ? hit.connection.id : null
      if (connId !== hoveredConnId) setHoveredConnId(connId)
    } else {
      if (hoveredPersonId) setHoveredPersonId(null)
      if (hoveredConnId) setHoveredConnId(null)
    }
  }

  function handleSurfacePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    activePointersRef.current = activePointersRef.current.filter((p) => p.pointerId !== event.pointerId)
    if (activePointersRef.current.length < 2) {
      pinchRef.current = null
    }

    if (marqueeRef.current) {
      const startX = marqueeRef.current.startX
      const startY = marqueeRef.current.startY
      const currentX = event.clientX
      const currentY = event.clientY

      const pStart = screenToWorld({ x: Math.min(startX, currentX), y: Math.min(startY, currentY) })
      const pEnd = screenToWorld({ x: Math.max(startX, currentX), y: Math.max(startY, currentY) })

      const selectedPIds = graph.people
        .filter((p) => p.x >= pStart.x && p.x <= pEnd.x && p.y >= pStart.y && p.y <= pEnd.y)
        .map((p) => p.id)

      const selectedCIds = graph.circles
        .filter((c) => c.id !== 'you' && c.x >= pStart.x && c.x <= pEnd.x && c.y >= pStart.y && c.y <= pEnd.y)
        .map((c) => c.id)

      setSelectedPeopleIds(selectedPIds)
      setSelectedCircleIds(selectedCIds)
      selectItem(null)

      marqueeRef.current = null
      setMarquee(null)
      settleGesture()
      isRightClickDragRef.current = false
      return
    }

    if (activePointersRef.current.length === 0) {
      settleGesture()
    }

    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null
      settleGesture()
    }

    const movingPersonId = movePersonRef.current?.pointerId === event.pointerId ? movePersonRef.current.personId : null
    const movingCircleId = moveCircleRef.current?.pointerId === event.pointerId ? moveCircleRef.current.circleId : null
    const selectedOrigins = movePersonRef.current?.pointerId === event.pointerId ? movePersonRef.current.selectedOrigins : null
    const disconnectedCircleIds = moveCircleRef.current?.pointerId === event.pointerId ? moveCircleRef.current.disconnectedCircleIds : null
    const wasRightClickDrag = isRightClickDragRef.current

    const endingMove =
      moveCircleRef.current?.pointerId === event.pointerId ||
      movePersonRef.current?.pointerId === event.pointerId ||
      resizeCircleRef.current?.pointerId === event.pointerId

    if (moveCircleRef.current?.pointerId === event.pointerId) moveCircleRef.current = null
    if (movePersonRef.current?.pointerId === event.pointerId) movePersonRef.current = null
    if (resizeCircleRef.current?.pointerId === event.pointerId) resizeCircleRef.current = null

    if (endingMove) {
      // Apply the final dragged position immediately, including any queued layout pass.
      const pending = takePendingGraphUpdate()
      setGraph((prev) => {
        let next = pending ? pending(prev) : prev
        if (wasRightClickDrag) {
          if (movingPersonId) {
            const draggedIds = selectedOrigins ? Object.keys(selectedOrigins) : [movingPersonId]
            let nextPeople = next.people
            for (const pid of draggedIds) {
              const person = nextPeople.find((p) => p.id === pid)
              if (person) {
                const innermost = next.circles
                  .filter((c) => Math.hypot(person.x - c.x, person.y - c.y) <= c.radius)
                  .sort((a, b) => a.radius - b.radius)[0]
                const nextCircleId = innermost ? innermost.id : ''
                nextPeople = nextPeople.map((p) => p.id === pid ? { ...p, circleId: nextCircleId } : p)
              }
            }
            next = { ...next, people: nextPeople }
          } else if (movingCircleId) {
            const draggedCircleIds = disconnectedCircleIds || [movingCircleId]
            let nextCircles = next.circles
            for (const cid of draggedCircleIds) {
              const circlesById = new Map(nextCircles.map((c) => [c.id, c]))
              const isDescendant = (childId: string, parentId: string): boolean => {
                let curr: string | null = childId
                while (curr) {
                  if (curr === parentId) return true
                  curr = circlesById.get(curr)?.parentId ?? null
                }
                return false
              }
              const circle = nextCircles.find((c) => c.id === cid)
              if (circle) {
                const innermost = nextCircles
                  .filter((c) => c.id !== cid && !isDescendant(c.id, cid) && Math.hypot(circle.x - c.x, circle.y - c.y) <= c.radius)
                  .sort((a, b) => a.radius - b.radius)[0]
                const nextParentId = innermost ? innermost.id : null
                nextCircles = nextCircles.map((c) => c.id === cid ? { ...c, parentId: nextParentId } : c)
              }
            }
            next = { ...next, circles: nextCircles }
          }
        }
        return ensureContainment(next)
      })
      isRightClickDragRef.current = false
      settleGesture()
    }

    // Resolve the connector against its latest endpoint (which may still be queued
    // in the drag rAF), then clear any pending frame.
    const conn = pendingConnectorRef.current ?? connector
    pendingConnectorRef.current = null
    if (dragRafRef.current != null) {
      window.cancelAnimationFrame(dragRafRef.current)
      dragRafRef.current = null
    }
    if (!conn) return

    const distance = Math.hypot(conn.endX - conn.startX, conn.endY - conn.startY)
    if (distance > CONNECT_THRESHOLD) {
      const targetPerson = graph.people.find((p) => Math.hypot(p.x - conn.endX, p.y - conn.endY) < 30)
      const targetCircle = graph.circles.find((c) => Math.hypot(c.x - conn.endX, c.y - conn.endY) < 30)

      if (targetPerson && targetPerson.id !== conn.sourceId) {
        setGraph((current) => ({
          ...current,
          connections: [
            ...(current.connections || []),
            {
              id: `conn-${Date.now()}`,
              fromId: conn.sourceId,
              toId: targetPerson.id,
            },
          ],
        }))
      } else if (targetCircle && targetCircle.id !== conn.sourceId) {
        if (conn.sourceType === 'circle') {
          setGraph((current) => {
            const srcCircle = current.circles.find((c) => c.id === conn.sourceId)
            if (srcCircle && !srcCircle.connectedTo) {
              return {
                ...current,
                circles: current.circles.map((c) =>
                  c.id === conn.sourceId ? { ...c, connectedTo: targetCircle.id } : c
                ),
              }
            } else {
              return {
                ...current,
                connections: [
                  ...(current.connections || []),
                  {
                    id: `conn-${Date.now()}`,
                    fromId: conn.sourceId,
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
                fromId: conn.sourceId,
                toId: targetCircle.id,
              },
            ],
          }))
        }
      } else {
        if (conn.sourceType === 'circle') {
          setCreateMenu({
            sourceCircleId: conn.sourceId,
            x: conn.endX,
            y: conn.endY,
            screenX: event.clientX,
            screenY: event.clientY,
            dragSourceId: conn.sourceId,
            dragSourceType: 'circle',
          })
        } else if (conn.sourceType === 'person') {
          const person = graph.people.find((p) => p.id === conn.sourceId)
          const sourceCircleId = person ? person.circleId : 'you'
          setCreateMenu({
            sourceCircleId,
            x: conn.endX,
            y: conn.endY,
            screenX: event.clientX,
            screenY: event.clientY,
            dragSourceId: conn.sourceId,
            dragSourceType: 'person',
          })
        }
      }
    }
    setConnector(null)
  }

  function handleSurfaceContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault()
    if (demoMode) return
    const hit = hitTestBoard(boardIndex, cameraRef.current, selectedItem, {
      x: event.clientX,
      y: event.clientY,
    })
    if (hit?.type !== 'circle-body' && hit?.type !== 'circle-edge' && hit?.type !== 'circle-center') return

    selectItem({ type: 'circle', id: hit.circle.id })
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
    selectItem({ type: sourceType, id: sourceId })
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

    const targets = selectedCircleIds.includes(circle.id) ? selectedCircleIds : [circle.id]
    const subtreeIds = new Set<string>()
    for (const cid of targets) {
      subtreeIds.add(cid)
      for (const descId of getDescendantCircleIds(graph.circles, cid)) {
        subtreeIds.add(descId)
      }
    }

    const circleOrigins: Record<string, { x: number; y: number }> = {}
    const personOrigins: Record<string, { x: number; y: number }> = {}
    for (const c of graph.circles) {
      if (subtreeIds.has(c.id)) circleOrigins[c.id] = { x: c.x, y: c.y }
    }
    for (const p of graph.people) {
      if (subtreeIds.has(p.circleId)) personOrigins[p.id] = { x: p.x, y: p.y }
    }

    moveCircleRef.current = {
      pointerId: event.pointerId,
      circleId: circle.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: circle.x,
      originY: circle.y,
      circleOrigins,
      personOrigins,
      disconnectedCircleIds: targets,
    }
  }

  function startPersonMove(event: ReactPointerEvent<HTMLElement>, person: PersonNode) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setCreateMenu(null)
    selectItem({ type: 'person', id: person.id })

    const selectedOrigins: Record<string, { x: number; y: number }> = {}
    const targets = selectedPeopleIds.includes(person.id) ? selectedPeopleIds : [person.id]
    for (const pid of targets) {
      const p = boardIndex.peopleById.get(pid)
      if (p) {
        selectedOrigins[pid] = { x: p.x, y: p.y }
      }
    }

    movePersonRef.current = {
      pointerId: event.pointerId,
      personId: person.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: person.x,
      originY: person.y,
      selectedOrigins,
    }
  }

  function startCircleResize(event: ReactPointerEvent<Element>, circle: CircleNode) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setCreateMenu(null)
    selectItem({ type: 'circle', id: circle.id })
    resizeCircleRef.current = {
      pointerId: event.pointerId,
      circleId: circle.id,
    }
  }

  function handleSurfaceDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const hit = hitTestBoard(boardIndex, cameraRef.current, selectedItem, {
      x: event.clientX,
      y: event.clientY,
    })

    if (hit && (hit.type === 'circle-body' || hit.type === 'circle-center' || hit.type === 'circle-edge')) {
      const circleId = hit.circle.id
      const world = screenToWorld({ x: event.clientX, y: event.clientY })
      const source = circlesById.get(circleId)
      if (!source) return

      const id = `person-${Date.now()}`
      const sides = Math.floor(Math.random() * 5) + 8
      setGraph((current) => {
        return ensureContainment({
          ...current,
          people: [
            ...current.people,
            {
              id,
              name: `New person ${current.people.length + 1}`,
              role: `Inside ${source.name}`,
              x: world.x,
              y: world.y,
              circleId: source.id,
              avatar: makeAvatar(current.people.length + 1),
              shapeType: 'circle',
              sides,
              amplitude: 0,
            },
          ],
        })
      })
      setSelectedPeopleIds([])
      selectItem({ type: 'person', id: id })
    }
  }

  function handleMergeSelected() {
    const totalCount = selectedPeopleIds.length + selectedCircleIds.length
    if (totalCount < 2) return

    const selectedPeople = graph.people.filter((p) => selectedPeopleIds.includes(p.id))
    const selectedCircles = graph.circles.filter((c) => selectedCircleIds.includes(c.id))

    const sumX = selectedPeople.reduce((sum, p) => sum + p.x, 0) + selectedCircles.reduce((sum, c) => sum + c.x, 0)
    const sumY = selectedPeople.reduce((sum, p) => sum + p.y, 0) + selectedCircles.reduce((sum, c) => sum + c.y, 0)
    const avgX = sumX / totalCount
    const avgY = sumY / totalCount

    let parentCircleId = 'you'
    if (selectedPeople.length > 0) {
      parentCircleId = selectedPeople[0].circleId || 'you'
    } else if (selectedCircles.length > 0) {
      parentCircleId = selectedCircles[0].parentId || 'you'
    }
    const parentCircle = circlesById.get(parentCircleId)
    const parentName = parentCircle ? parentCircle.name : 'subset'

    const newCircleId = `circle-${Date.now()}`

    setGraph((current) => {
      const newCircle = {
        id: newCircleId,
        name: `${parentName} subset`,
        icon: 'SUB',
        x: avgX,
        y: avgY,
        radius: 82,
        minRadius: 82,
        parentId: parentCircleId,
        connectedTo: parentCircleId,
        tone: 'violet' as const,
        shapeType: 'polygon' as const,
        sides: 6,
        amplitude: 4,
      }

      const nextCircles = current.circles.map((c) => {
        if (selectedCircleIds.includes(c.id)) {
          return {
            ...c,
            parentId: newCircleId,
          }
        }
        return c
      })

      const nextPeople = current.people.map((person) => {
        if (selectedPeopleIds.includes(person.id)) {
          return {
            ...person,
            circleId: newCircleId,
          }
        }
        return person
      })

      return ensureContainment({
        ...current,
        circles: [...nextCircles, newCircle],
        people: nextPeople,
      })
    })

    selectItem({ type: 'circle', id: newCircleId })
    setSelectedPeopleIds([])
    setSelectedCircleIds([])
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
            shapeType: 'circle',
            sides,
            amplitude: 0,
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
    selectItem({ type: 'person', id })
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
    selectItem({ type: 'circle', id })
    setCreateMenu(null)
  }

  /* Commented out to hide from menu, keeping in code for future use
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
  */



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

  function applyCircleShapeMode(nextMode: CircleShapeMode) {
    setCircleShapeMode(nextMode)
    if (nextMode !== 'figures') return

    setGraph((current) => ({
      ...current,
      circles: current.circles.map((circle) => ({
        ...circle,
        shapeType: 'wavy',
        sides: circle.sides ?? Math.max(8, Math.round(circle.radius / 10)),
        amplitude: Math.max(4, circle.amplitude && circle.amplitude > 0 ? circle.amplitude : Math.round(circle.radius * 0.055)),
      })),
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

  // Auth gate rendered as an OVERLAY (not an early return) so the board JSX always
  // mounts — its mount-time effects (e.g. the native wheel listener for trackpad
  // pinch-zoom / two-finger pan) need surfaceRef to exist on first commit. When
  // Supabase isn't configured we just never show the overlay (local dev mode).
  const isAuthLoading =
    auth.status !== 'unconfigured' &&
    (auth.status === 'loading' || (auth.status === 'authenticated' && !graphLoaded))
  const showAuthOverlay = isAuthLoading || auth.status === 'anonymous'

  // Keep references to unused features so they remain in codebase for future use and satisfy TS/ESLint checks
  if (false as boolean) {
    console.log(setDemoMode, setShowCircleLabels, setShowPersonLabels, setCircleFillMode, setCenterBehavior, applyCircleShapeMode, CheckIcon)
  }

  return (
    <main className={`app-shell ${demoMode ? 'is-demo-mode' : ''}`}>
      <div className="toolbar" aria-label="Graph controls" style={{ justifyContent: 'flex-end' }}>
        <div className={`toolbar__group ${demoMode ? 'toolbar__group--demo' : ''}`}>
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
          <div style={{ marginTop: '12px', display: 'grid', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(28, 37, 40, 0.64)', display: 'block', marginBottom: '8px' }}>
                LinkedIn Data Import
              </label>
              <button
                type="button"
                className="m3-primary-button"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon />
                <span>Import LinkedIn ZIP</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                style={{ display: 'none' }}
                onChange={handleLinkedInImport}
              />
            </div>
            {auth.status === 'authenticated' && (
              <div style={{ borderTop: '1px solid var(--md-outline-variant)', paddingTop: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(28, 37, 40, 0.64)', display: 'block', marginBottom: '8px' }}>
                  Account
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  {typeof auth.session?.user?.user_metadata?.avatar_url === 'string' && (
                    <img
                      src={auth.session.user.user_metadata.avatar_url as string}
                      alt=""
                      style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  )}
                  <span style={{ fontSize: '13px', color: 'var(--md-on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {auth.session?.user?.email}
                  </span>
                </div>
                <button
                  type="button"
                  className="m3-primary-button"
                  onClick={async () => {
                    // Flush the latest graph before the debounced autosave would have
                    // fired, so edits made right before logout aren't lost.
                    if (userId) {
                      try {
                        await saveGraph(userId, graph)
                      } catch (error) {
                        console.error('Failed to save before sign-out', error)
                      }
                    }
                    await auth.signOut()
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      )}



      <div
        ref={surfaceRef}
        className="graph-surface"
        tabIndex={0}
        style={{
          backgroundSize: `${160 * camera.scale}px ${160 * camera.scale}px, ${32 * camera.scale}px ${32 * camera.scale}px`,
          backgroundPosition: `${camera.x}px ${camera.y}px`,
        }}
        onPointerDown={handleSurfacePointerDown}
        onPointerMove={handleSurfacePointerMove}
        onPointerUp={handleSurfacePointerUp}
        onPointerCancel={handleSurfacePointerUp}
        onDoubleClick={handleSurfaceDoubleClick}
        onKeyDown={(event) => {
          if (event.key !== 'Delete' && event.key !== 'Backspace') return
          event.preventDefault()
          deleteSelectedItem()
        }}
        onContextMenu={handleSurfaceContextMenu}
        onPointerLeave={() => {
          if (hoveredPersonId) setHoveredPersonId(null)
          if (hoveredConnId) setHoveredConnId(null)
        }}
      >
        <canvas ref={peopleCanvasRef} className="board-canvas-layer" aria-label="Relationship board" />
      </div>

      {createMenu ? (
        <div className="create-menu" style={menuPosition(createMenu)}>
          {createMenu.dragSourceType === 'person' ? (
            <>
              <button type="button" onClick={createPerson}>
                <PersonIcon />
                <span>Add person</span>
              </button>
              <button type="button" onClick={() => createCircle('nested')}>
                <SubsetIcon />
                <span>Add subset inside source circle</span>
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

      {(selectedPeopleIds.length + selectedCircleIds.length) >= 2 && (
        <div className="merge-prompt-panel">
          <span className="merge-prompt-text">
            Selected{' '}
            <strong>
              {selectedPeopleIds.length > 0 && `${selectedPeopleIds.length} ${selectedPeopleIds.length === 1 ? 'person' : 'people'}`}
              {selectedPeopleIds.length > 0 && selectedCircleIds.length > 0 && ' and '}
              {selectedCircleIds.length > 0 && `${selectedCircleIds.length} ${selectedCircleIds.length === 1 ? 'circle' : 'circles'}`}
            </strong>
          </span>
          <div className="merge-prompt-buttons">
            <button
              type="button"
              className="primary-action"
              onClick={handleMergeSelected}
            >
              Merge into subset
            </button>
            <button
              type="button"
              className="m3-text-button"
              onClick={() => {
                setSelectedPeopleIds([])
                setSelectedCircleIds([])
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!demoMode && selectedItem && (
      <aside className="inspector" aria-label="Selection details" style={{ overflow: 'visible', maxHeight: 'calc(100vh - 120px)' }}>

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
                {(() => {
                  const selectedCircleColors = getCircleColors(selectedCircle)
                  const selectedCircleHsv = hexToHsv(selectedCircleColors.centerBg)
                  const selectedCircleSides = selectedCircle.sides ?? 25
                  const selectedCircleAmplitude = selectedCircle.amplitude ?? 0
                  return (
                <div className="inspector-visual-row">
                  <div className="circle-style-control">
                    <button
                      type="button"
                      className={`circle-style-button ${selectedCircle.customColor ? 'is-custom-color' : ''} ${showCircleStylePanel ? 'is-open' : ''}`}
                      style={{
                        backgroundColor: selectedCircle.customColor ? selectedCircleColors.centerBg : undefined,
                        color: selectedCircle.customColor ? getReadableColor(selectedCircleColors.centerBg) : undefined,
                      }}
                      onClick={() => setShowCircleStylePanel(!showCircleStylePanel)}
                      title="Customize circle"
                      aria-label="Customize circle"
                    >
                      <PaletteIcon />
                    </button>
                  </div>
                  <div className="quick-circle-colors" aria-label="Quick circle colors">
                    {(['blue', 'red', 'green', 'amber', 'violet'] as CircleTone[]).map((tone) => (
                      <button
                        key={tone}
                        type="button"
                        className={`quick-circle-color ${selectedCircle.tone === tone && !selectedCircle.customColor ? 'is-selected' : ''}`}
                        style={{ backgroundColor: MATERIAL_TONES[tone].centerBg }}
                        onClick={() => updateCircleStyle(selectedCircle.id, { tone, customColor: undefined })}
                        aria-label={`Set quick color ${tone}`}
                      />
                    ))}
                  </div>
                    {showCircleStylePanel && (
                      <div className="circle-style-popover">
                        <div className="circle-style-theme-tabs">
                          <button
                            type="button"
                            className={(selectedCircle.fillMode ?? circleFillMode) === 'transparent' ? 'is-selected' : ''}
                            onClick={() => updateCircleStyle(selectedCircle.id, { fillMode: 'transparent' })}
                          >
                            Transparent
                          </button>
                          <button
                            type="button"
                            className={(selectedCircle.fillMode ?? circleFillMode) === 'solid' ? 'is-selected' : ''}
                            onClick={() => updateCircleStyle(selectedCircle.id, { fillMode: 'solid' })}
                          >
                            Solid
                          </button>
                        </div>
                        <button
                          type="button"
                          className="color-wheel"
                          style={{
                            '--wheel-color': selectedCircleColors.centerBg,
                            '--wheel-x': `${50 + Math.cos((selectedCircleHsv.h - 180) * Math.PI / 180) * selectedCircleHsv.s * 50}%`,
                            '--wheel-y': `${50 + Math.sin((selectedCircleHsv.h - 180) * Math.PI / 180) * selectedCircleHsv.s * 50}%`,
                          } as CSSProperties}
                          onPointerDown={(event) => handleColorWheelPointer(event, selectedCircle)}
                          onPointerMove={(event) => {
                            if (event.buttons === 1) handleColorWheelPointer(event, selectedCircle)
                          }}
                          aria-label="Pick circle color"
                        >
                          <span className="color-wheel__thumb" />
                        </button>
                        <button
                          type="button"
                          className="brightness-slider"
                          style={{
                            '--brightness-color': hsvToHex({ ...selectedCircleHsv, v: 1 }),
                            '--brightness-pos': `${selectedCircleHsv.v * 100}%`,
                          } as CSSProperties}
                          onPointerDown={(event) => handleBrightnessPointer(event, selectedCircle)}
                          onPointerMove={(event) => {
                            if (event.buttons === 1) handleBrightnessPointer(event, selectedCircle)
                          }}
                          aria-label="Pick color brightness"
                        >
                          <span className="brightness-slider__thumb" />
                        </button>
                        <div className="circle-style-presets">
                          {CIRCLE_COLOR_PRESETS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className={`circle-style-preset ${selectedCircleColors.centerBg.toLowerCase() === color.toLowerCase() ? 'is-selected' : ''}`}
                              style={{ backgroundColor: color }}
                              onClick={() => updateCircleStyle(selectedCircle.id, { customColor: color })}
                              aria-label={`Set circle color ${color}`}
                            />
                          ))}
                        </div>
                        <div className="circle-style-shape-controls" aria-hidden="true">
                        <label className="circle-style-control-row">
                          <span>{`Amplitude ${Math.round(selectedCircleAmplitude)}`}</span>
                          <input
                            className="wave-slider"
                            type="range"
                            min="0"
                            max="28"
                            value={selectedCircleAmplitude}
                            onChange={(event) => updateCircleAmplitude(selectedCircle, Number(event.target.value))}
                          />
                        </label>
                        <label className="circle-style-control-row">
                          <span>{selectedCircleSides >= 25 ? 'Corners circle' : `Corners ${selectedCircleSides}`}</span>
                          <input
                            className="corner-slider"
                            type="range"
                            min="5"
                            max="25"
                            value={selectedCircleSides}
                            onChange={(event) => updateCircleCorners(selectedCircle, Number(event.target.value))}
                          />
                        </label>
                        </div>
                      </div>
                    )}

                  <div className="m3-avatar-picker-container">
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
                  )
                })()}

                {/* Commented out Shape settings and Center Image URL to hide from menu, keeping in code for future use
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
                */}

                {/* Sticky Actions at Bottom */}
                <div className="inspector-actions-section" style={{ borderTop: 'none', paddingTop: 0 }}>
                  {/* Commented out Add 3 demo people to hide from menu, keeping in code for future use
                  <button type="button" className="primary-action" onClick={addDemoCluster}>
                    Add 3 demo people
                  </button>
                  */}

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
                      fill={selectedPerson.isFavorite ? 'var(--md-favorite-fill)' : 'none'}
                      stroke={selectedPerson.isFavorite ? 'var(--md-favorite-stroke)' : 'var(--md-outline-variant)'}
                      strokeWidth={2}
                    />
                  </svg>
                </button>

                 {/* Visual Settings Row: Select Circle + Avatar Photo Upload */}
                 {(() => {
                   const personCircle = circlesById.get(selectedPerson.circleId)
                   const toneColors = personCircle ? getCircleColors(personCircle) : null
                   return (
                     <div className="inspector-visual-row">
                       <div className="inspector-field" style={{ flex: 1, marginTop: 0 }}>
                         <div style={{ position: 'relative', width: '100%' }}>
                           <button
                             type="button"
                             onClick={() => setShowCircleDropdown(!showCircleDropdown)}
                             className="custom-select-trigger"
                           >
                             <span
                               className="circle-color-dot"
                               style={{ backgroundColor: toneColors ? toneColors.centerBg : 'var(--md-outline-variant)' }}
                             />
                             <span>{personCircle?.name || 'Select circle'}</span>
                             <svg
                               viewBox="0 0 24 24"
                               style={{
                                 width: 16,
                                 height: 16,
                                 fill: 'none',
                                 stroke: 'var(--md-on-surface-variant, #43474e)',
                                 strokeWidth: 2,
                                 strokeLinecap: 'round',
                                 strokeLinejoin: 'round',
                                 transform: showCircleDropdown ? 'rotate(180deg)' : 'none',
                                 transition: 'transform 0.2s',
                               }}
                             >
                               <polyline points="6 9 12 15 18 9" />
                             </svg>
                           </button>

                           {showCircleDropdown && (
                             <div className="custom-select-dropdown">
                               {graph.circles.map((c) => {
                                 const optionColors = getCircleColors(c)
                                 return (
                                   <button
                                     key={c.id}
                                     type="button"
                                     onClick={() => {
                                       setGraph((current) => {
                                         const freePos = findFreeSpaceInCircle(current.circles, current.people, c.id)
                                         return ensureContainment({
                                           ...current,
                                           people: current.people.map((p) =>
                                             p.id === selectedPerson.id ? { ...p, circleId: c.id, x: freePos.x, y: freePos.y } : p
                                           ),
                                         })
                                       })
                                       setShowCircleDropdown(false)
                                     }}
                                     className="custom-select-option"
                                   >
                                     <span
                                       className="circle-color-dot"
                                       style={{ backgroundColor: optionColors.centerBg }}
                                     />
                                     <span>{c.name}</span>
                                     {selectedPerson.circleId === c.id && (
                                       <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'var(--md-primary)', strokeWidth: 3, fill: 'none' }}>
                                         <polyline points="20 6 9 17 4 12" />
                                       </svg>
                                     )}
                                   </button>
                                 )
                               })}
                             </div>
                           )}
                         </div>
                       </div>

                      <div className="m3-avatar-picker-container">
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
                  );
                })()}

                {/* Commented out Role to hide from menu, keeping in code for future use
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
                */}

                {/* Notes Section (Trello-Style) */}
                <div className="trello-list">
                  <div className="trello-list__header">
                    <h4 className="trello-list__title">Notes</h4>
                  </div>
 
                  {/* Scrollable list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedPerson.notes?.map((note) => (
                      <div key={note.id}>
                        {editingNoteId === note.id ? (
                          <div className="trello-card__editor">
                            <textarea
                              className="trello-card__editor-textarea"
                              autoFocus
                              value={note.body}
                              onChange={(e) => {
                                updatePersonNote(
                                  selectedPerson.id,
                                  note.id,
                                  e.target.value.split('\n')[0].substring(0, 30) || 'Untitled note',
                                  e.target.value
                                )
                              }}
                              onBlur={() => setEditingNoteId(null)}
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    setEditingNoteId(null)
                                  } else if (e.key === 'Escape') {
                                    setEditingNoteId(null)
                                  }
                              }}
                              style={{
                                minHeight: '40px',
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            className="trello-card"
                            onClick={() => setEditingNoteId(note.id)}
                          >
                            <div className="trello-card__body">{note.body}</div>
                            <button
                              type="button"
                              className="trello-card__delete-btn"
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
                    ))}
                  </div>
 
                  {/* Trello Card Composer */}
                  {isAddingNote ? (
                    <div className="trello-list__composer">
                      <div className="trello-list__composer-card">
                        <textarea
                          ref={noteInputRef}
                          placeholder="Write a note..."
                          value={newNoteBody}
                          onChange={(e) => {
                            setNewNoteBody(e.target.value)
                            e.target.style.height = 'auto'
                            e.target.style.height = `${e.target.scrollHeight}px`
                          }}
                          className="trello-list__composer-textarea"
                          autoFocus
                          rows={1}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              handleSaveNewNote(selectedPerson.id)
                            } else if (e.key === 'Escape') {
                              setIsAddingNote(false)
                              setNewNoteBody('')
                            }
                          }}
                          style={{
                            minHeight: '20px',
                            height: 'auto',
                            resize: 'none',
                            overflowY: 'hidden',
                          }}
                        />
                      </div>
                      <div className="trello-list__composer-controls">
                        <button
                          type="button"
                          className="trello-list__composer-add-btn"
                          onClick={() => handleSaveNewNote(selectedPerson.id)}
                        >
                          Save note
                        </button>
                        <button
                          type="button"
                          className="trello-list__composer-cancel-btn"
                          onClick={() => {
                            setIsAddingNote(false)
                            setNewNoteBody('')
                          }}
                          title="Discard"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="trello-list__add-btn"
                      onClick={() => setIsAddingNote(true)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 14, height: 14 }}>
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span>Add a card</span>
                    </button>
                  )}
                </div>

                <div className="connections-list">
                  <div className="connections-list__header">
                    <h4 className="connections-list__title">Connections</h4>
                  </div>
                  <div className="connections-list__items">
                    {selectedPerson.links?.map((link) => (
                      <div key={link.id} className="connection-item">
                        <button
                          type="button"
                          className={`connection-item__main connection-item__main--${link.service}`}
                          onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                          title={link.url}
                        >
                          <ConnectionServiceIcon service={link.service} />
                          <span>{link.label}</span>
                          <ExternalLinkIcon />
                        </button>
                        <button
                          type="button"
                          className="connection-item__delete"
                          onClick={() => deletePersonLink(selectedPerson.id, link.id)}
                          title="Delete connection"
                        >
                          <CloseIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="connection-composer">
                    <input
                      type="text"
                      value={newLinkValue}
                      placeholder="Add link, @handle, or phone"
                      onChange={(event) => {
                        setNewLinkValue(event.target.value)
                        setShowLinkServicePicker(false)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          handleSaveNewLink(selectedPerson.id)
                        } else if (event.key === 'Escape') {
                          setNewLinkValue('')
                          setShowLinkServicePicker(false)
                        }
                      }}
                    />
                    <button type="button" onClick={() => handleSaveNewLink(selectedPerson.id)}>
                      Save
                    </button>
                  </div>
                  {showLinkServicePicker && (
                    <div className="connection-service-picker">
                      {LINK_SERVICE_OPTIONS.filter((option) =>
                        newLinkValue.trim().startsWith('@')
                          ? ['telegram', 'instagram', 'x'].includes(option.service)
                          : ['whatsapp', 'telegram', 'website'].includes(option.service)
                      ).map((option) => (
                        <button
                          key={option.service}
                          type="button"
                          className={newLinkService === option.service ? 'is-selected' : ''}
                          onClick={() => {
                            setNewLinkService(option.service)
                            addPersonLink(selectedPerson.id, newLinkValue, option.service)
                            setNewLinkValue('')
                            setShowLinkServicePicker(false)
                            setNewLinkService('website')
                          }}
                        >
                          <ConnectionServiceIcon service={option.service} />
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Commented out Appearance Options to hide from menu, keeping in code for future use
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
                */}

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
      </aside>
      )}

      {showAuthOverlay && (
        <div style={authOverlayStyle}>
          <div style={authCardStyle}>
            <span className="brand__mark">DN</span>
            {auth.status === 'anonymous' ? (
              <>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 500, color: 'var(--md-on-surface)' }}>
                  Circle graph
                </h1>
                <p style={{ margin: 0, color: 'var(--md-on-surface-variant)', textAlign: 'center' }}>
                  Sign in to save your connections across sessions.
                </p>
                <button type="button" className="m3-primary-button" onClick={() => void auth.signInWithGoogle()}>
                  Continue with Google
                </button>
                {auth.error && (
                  <p style={{ margin: 0, color: 'var(--md-error, #b3261e)', fontSize: '13px' }}>{auth.error}</p>
                )}
              </>
            ) : (
              <p style={{ margin: 0, color: 'var(--md-on-surface-variant)' }}>Loading your board…</p>
            )}
          </div>
        </div>
      )}
    </main>
  )
}



// ---- Canvas board renderer ---------------------------------------------------
// The relationship board is canvas-first: React owns chrome/inspector/menu UI,
// while this renderer owns every hot-path board pixel and hit target.

type WorldRect = { left: number; right: number; top: number; bottom: number }

type BoardIndex = {
  circles: CircleNode[]
  people: PersonNode[]
  connections: Connection[]
  circlesById: Map<string, CircleNode>
  peopleById: Map<string, PersonNode>
  peopleByCell: Map<string, PersonNode[]>
  circlesByCell: Map<string, CircleNode[]>
  connectionsByEndpoint: Map<string, Connection[]>
}

const BOARD_GRID_SIZE = 360
const personSpriteCache = new Map<string, HTMLCanvasElement>()
const imageCache = new Map<string, HTMLImageElement>()
const SPRITE_TIERS = [64, 128, 256]

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

function createBoardIndex(circles: CircleNode[], people: PersonNode[], connections: Connection[]): BoardIndex {
  const peopleByCell = new Map<string, PersonNode[]>()
  const circlesByCell = new Map<string, CircleNode[]>()
  const connectionsByEndpoint = new Map<string, Connection[]>()

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

// Set by the board so freshly-decoded images can trigger a repaint (otherwise an
// avatar only appears after the next interaction-driven redraw).
let requestBoardRepaint: (() => void) | null = null

function getCanvasImage(src: string): HTMLImageElement | null {
  const cached = imageCache.get(src)
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null
  const image = new Image()
  image.onload = () => {
    // Cached person sprites were baked without the image; drop them so they redraw.
    personSpriteCache.clear()
    requestBoardRepaint?.()
  }
  image.src = src
  imageCache.set(src, image)
  return image.complete && image.naturalWidth > 0 ? image : null
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
  const imageKey = person.imageUrl ? `img:${person.imageUrl.length}` : person.avatar
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
    }
  } else {
    ctx.fillStyle = '#ffffff'
    ctx.font = `500 ${(11 * scale).toFixed(1)}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(person.avatar, size / 2, size / 2 + scale)
  }
  ctx.restore()

  personSpriteCache.set(key, canvas)
  return canvas
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

function drawBoardLayer(
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

  drawCircleFills(ctx, visibleCircles, selectedItem, camera.scale, circleShapeMode, circleFillMode, selectedCircleIds)
  drawCircleEdges(ctx, visibleCircles, index, camera.scale)
  drawPersonEdges(ctx, visiblePeople, index, camera.scale)
  drawCustomConnections(ctx, visiblePeopleIds, visibleCircleIds, index, selectedItem, hoveredConnId, camera.scale)
  drawCircleDetails(ctx, visibleCircles, camera.scale, circleFillMode, showCircleLabels)
  drawPeople(ctx, visiblePeople, index, selectedItem, hoveredPersonId, camera.scale, dpr, showPersonLabels, selectedPeopleIds)
  if (connector) drawConnector(ctx, connector, camera.scale)
  drawSelectionHandles(ctx, selectedItem, index, camera.scale)

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

function drawCircleEdges(ctx: CanvasRenderingContext2D, circles: CircleNode[], index: BoardIndex, scale: number) {
  ctx.beginPath()
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.52)'
  ctx.lineWidth = Math.max(2 / scale, 1.1)
  for (const circle of circles) {
    const source = circle.connectedTo ? index.circlesById.get(circle.connectedTo) : null
    if (!source) continue
    drawCurvePath(ctx, source, circle)
  }
  ctx.stroke()
}

function drawPersonEdges(ctx: CanvasRenderingContext2D, people: PersonNode[], index: BoardIndex, scale: number) {
  ctx.beginPath()
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.28)'
  ctx.lineWidth = Math.max(1.15 / scale, 0.7)
  for (const person of people) {
    const circle = index.circlesById.get(person.circleId)
    if (!circle) continue
    ctx.moveTo(circle.x, circle.y)
    ctx.lineTo(person.x, person.y)
  }
  ctx.stroke()
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
  const candidates = new Map<string, Connection>()
  for (const id of visiblePeopleIds) {
    const bucket = index.connectionsByEndpoint.get(id)
    if (bucket) for (const conn of bucket) candidates.set(conn.id, conn)
  }
  for (const id of visibleCircleIds) {
    const bucket = index.connectionsByEndpoint.get(id)
    if (bucket) for (const conn of bucket) candidates.set(conn.id, conn)
  }

  for (const conn of candidates.values()) {
    const source = index.peopleById.get(conn.fromId) || index.circlesById.get(conn.fromId)
    const target = index.peopleById.get(conn.toId) || index.circlesById.get(conn.toId)
    if (!source || !target) continue
    const isSelected = selectedItem?.type === 'connection' && selectedItem.id === conn.id
    const isHovered = hoveredConnId === conn.id
    ctx.beginPath()
    ctx.strokeStyle = isSelected ? '#00629d' : isHovered ? '#64748b' : conn.id.startsWith('stress-link-') ? 'rgba(148, 163, 184, 0.30)' : '#94a3b8'
    ctx.lineWidth = isSelected ? Math.max(4 / scale, 2) : isHovered ? Math.max(3 / scale, 1.5) : Math.max(1.6 / scale, 0.55)
    drawCurvePath(ctx, source, target)
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
) {
  for (const circle of circles) {
    const tone = getCircleColors(circle)
    const isTransparent = (circle.fillMode ?? circleFillMode) === 'transparent'
    const path = new Path2D(getCircleRenderPath(circle, circleShapeMode))
    ctx.save()
    if (!isTransparent) {
      ctx.shadowColor = 'rgba(0,0,0,0.06)'
      ctx.shadowBlur = 16 / scale
      ctx.shadowOffsetY = 8 / scale
    }
    ctx.globalAlpha = isTransparent ? 0.34 : 1
    ctx.fillStyle = tone.fill
    ctx.fill(path)
    ctx.restore()

    ctx.save()
    ctx.strokeStyle = tone.border
    const isSelected = (selectedItem?.type === 'circle' && selectedItem.id === circle.id) || selectedCircleIds.includes(circle.id)
    ctx.lineWidth =
      isSelected
        ? Math.max(3.5 / scale, 2)
        : Math.max((isTransparent ? 2.2 : 1.4) / scale, isTransparent ? 1.4 : 0.9)
    if (isTransparent) ctx.setLineDash([8 / scale, 7 / scale])
    ctx.stroke(path)
    ctx.restore()
  }
}

function drawCircleDetails(
  ctx: CanvasRenderingContext2D,
  circles: CircleNode[],
  scale: number,
  circleFillMode: CircleFillMode,
  showCircleLabels: boolean,
) {
  for (const circle of circles) {
    if (showCircleLabels) drawCircleLabel(ctx, circle, scale)
    drawCircleCenter(ctx, circle, scale, circleFillMode)
  }
}

function getCircleRenderPath(circle: CircleNode, circleShapeMode: CircleShapeMode) {
  void circleShapeMode
  const amplitude = circle.amplitude ?? 0
  const sides = circle.sides ?? 25
  const shapeType: ShapeType = amplitude > 0 ? 'wavy' : sides >= 25 ? 'circle' : 'polygon'
  return getNodePath(
    circle.x,
    circle.y,
    circle.radius,
    shapeType,
    sides,
    amplitude,
  )
}

function drawCircleCenter(ctx: CanvasRenderingContext2D, circle: CircleNode, scale: number, circleFillMode: CircleFillMode) {
  const tone = getCircleColors(circle)
  const radius = CIRCLE_CENTER_RADIUS
  ctx.save()
  ctx.beginPath()
  ctx.arc(circle.x, circle.y, radius, 0, Math.PI * 2)
  ctx.fillStyle = tone.centerBg
  ctx.globalAlpha = (circle.fillMode ?? circleFillMode) === 'transparent' ? 0.92 : 1
  ctx.fill()
  ctx.lineWidth = Math.max(3 / scale, 2)
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()

  const image = circle.imageUrl ? getCanvasImage(circle.imageUrl) : null
  if (image) {
    ctx.globalAlpha = 1
    ctx.clip()
    drawImageCover(ctx, image, circle.x - radius, circle.y - radius, radius * 2, radius * 2)
  } else {
    ctx.fillStyle = '#ffffff'
    const hasEmojiIcon = Array.from(circle.icon).some((char) => (char.codePointAt(0) ?? 0) > 127)
    ctx.font = hasEmojiIcon
      ? '18px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
      : '500 10px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(circle.icon, circle.x, circle.y + (hasEmojiIcon ? 1.5 : 0.5))
  }
  ctx.restore()
}

function drawCircleLabel(ctx: CanvasRenderingContext2D, circle: CircleNode, scale: number) {
  if (scale < 0.42) return
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
) {
  const spriteRes = pickSpriteTier(PERSON_VISUAL_RADIUS * 2 * scale * dpr)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  for (const person of people) {
    const circle = index.circlesById.get(person.circleId)
    const circleColor = circle ? getCircleColors(circle).centerBg : MATERIAL_TONES.blue.centerBg
    const isSelected = (selectedItem?.type === 'person' && selectedItem.id === person.id) || selectedPeopleIds.includes(person.id)
    const isHovered = hoveredPersonId === person.id
    const stroke = person.isFavorite ? '#ffd600' : isSelected ? '#00629d' : isHovered ? '#64748b' : circleColor
    const strokeWidth = person.isFavorite ? (isSelected ? 5.5 : 4.5) : isSelected || isHovered ? 2.5 : 1.5
    ctx.drawImage(
      getPersonSprite(person, circleColor, spriteRes, stroke, strokeWidth),
      person.x - PERSON_VISUAL_RADIUS,
      person.y - PERSON_VISUAL_RADIUS,
      PERSON_VISUAL_RADIUS * 2,
      PERSON_VISUAL_RADIUS * 2,
    )
    if (showPersonLabels && (scale >= 0.62 || isSelected || isHovered)) drawPersonLabel(ctx, person, scale)
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

function hitTestBoard(index: BoardIndex, camera: Camera, selectedItem: SelectedItem, screen: { x: number; y: number }): BoardHit {
  const point = {
    x: (screen.x - camera.x) / camera.scale,
    y: (screen.y - camera.y) / camera.scale,
  }
  const scale = camera.scale
  const handleHit = HANDLE_HIT_RADIUS / scale

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

  const hitRect = {
    left: point.x - 28 / scale,
    right: point.x + 28 / scale,
    top: point.y - 28 / scale,
    bottom: point.y + 28 / scale,
  }
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

  const circles = queryCircles(index, hitRect).reverse()
  for (const circle of circles) {
    const d = Math.hypot(point.x - circle.x, point.y - circle.y)
    if (d <= CIRCLE_CENTER_RADIUS + 6 / scale) return { type: 'circle-center', circle }
    if (Math.abs(d - circle.radius) <= EDGE_RESIZE_HIT_SIZE / scale) return { type: 'circle-edge', circle }
    if (d <= circle.radius) return { type: 'circle-body', circle }
  }

  return null
}

function findConnectionNearPoint(index: BoardIndex, point: { x: number; y: number }, tolerance: number) {
  let best: Connection | null = null
  let bestDist = tolerance
  for (const conn of index.connections) {
    if (conn.id.startsWith('stress-link-')) continue
    const source = index.peopleById.get(conn.fromId) || index.circlesById.get(conn.fromId)
    const target = index.peopleById.get(conn.toId) || index.circlesById.get(conn.toId)
    if (!source || !target) continue
    const dist = distanceToSegment(point, source, target)
    if (dist < bestDist) {
      bestDist = dist
      best = conn
    }
  }
  return best
}

function distanceToSegment(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
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

function drawCurvePath(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }) {
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2 - 40
  ctx.moveTo(from.x, from.y)
  ctx.quadraticCurveTo(mx, my, to.x, to.y)
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
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

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function createDemoGraphState(): GraphState {
  const circles: CircleNode[] = [
    makeCircle('you', 'You', 'YOU', 0, 0, 104, null, null, 'blue'),
    makeCircle('eu', 'EU', '🇪🇺', 0, -600, 286, null, 'you', 'blue'),
    makeCircle('denmark', 'Denmark', '🇩🇰', -30, 650, 276, null, 'you', 'red'),
    makeCircle('russia', 'Russia', '🇷🇺', 720, 20, 286, null, 'you', 'blue'),
    makeCircle('other', 'Other', '🌐', -720, 20, 268, null, 'you', 'red'),

    makeCircle('sweden', 'Sweden', '🇸🇪', -92, -720, 62, 'eu', 'eu', 'blue'),
    makeCircle('france', 'France', '🇫🇷', 112, -655, 64, 'eu', 'eu', 'blue'),
    makeCircle('germany', 'Germany', '🇩🇪', 40, -462, 68, 'eu', 'eu', 'amber'),
    makeCircle('netherlands', 'Netherlands', '🇳🇱', -160, -510, 62, 'eu', 'eu', 'red'),

    makeCircle('pandora', 'Pandora', 'P', -26, 800, 78, 'denmark', 'denmark', 'red'),
    makeCircle('lego', 'LEGO', 'LG', -190, 565, 62, 'denmark', 'denmark', 'amber'),
    makeCircle('maersk', 'Maersk', 'MA', 150, 560, 62, 'denmark', 'denmark', 'blue'),
    makeCircle('copenhagen', 'Copenhagen', 'CPH', -230, 770, 66, 'denmark', 'denmark', 'green'),

    makeCircle('yandex', 'Yandex', 'YA', 840, -130, 68, 'russia', 'russia', 'amber'),
    makeCircle('avito', 'Avito', 'AV', 858, 150, 68, 'russia', 'russia', 'green'),
    makeCircle('media-ru', 'Media', 'TV', 600, 170, 62, 'russia', 'russia', 'violet'),
    makeCircle('moscow', 'Moscow', '🏙️', 600, -170, 66, 'russia', 'russia', 'blue'),

    makeCircle('usa-canada', 'US / Canada', '🌎', -890, -40, 72, 'other', 'other', 'blue'),
    makeCircle('israel', 'Israel', '🇮🇱', -650, -150, 62, 'other', 'other', 'blue'),
    makeCircle('japan', 'Japan', '🇯🇵', -595, 150, 62, 'other', 'other', 'red'),
    makeCircle('singapore', 'Singapore', '🇸🇬', -780, 200, 62, 'other', 'other', 'green'),
  ]

  const people: PersonNode[] = [
    makePerson('me-a', 'Artem', 'Founder', -46, -28, 'you', 'AR', true),
    makePerson('me-b', 'Mira', 'Research', 38, -10, 'you', 'MI'),
    makePerson('me-c', 'Noah', 'Advisor', 8, 60, 'you', 'NO'),

    makePerson('se-1', 'Elin', 'IKEA growth', -126, -740, 'sweden', 'EL'),
    makePerson('se-2', 'Jonas', 'Fintech', -58, -698, 'sweden', 'JO'),
    makePerson('fr-1', 'Camille', 'Policy', 78, -682, 'france', 'CA'),
    makePerson('fr-2', 'Louis', 'Climate tech', 146, -636, 'france', 'LO'),
    makePerson('de-1', 'Hanna', 'Operations', 6, -486, 'germany', 'HA'),
    makePerson('de-2', 'Felix', 'Investor', 74, -440, 'germany', 'FE'),
    makePerson('nl-1', 'Sanne', 'Marketplace', -192, -532, 'netherlands', 'SA'),
    makePerson('nl-2', 'Milan', 'Logistics', -126, -488, 'netherlands', 'MI'),

    makePerson('pan-1', 'Freja', 'Product', -70, 784, 'pandora', 'FR', true),
    makePerson('pan-2', 'Sofie', 'Brand', -26, 752, 'pandora', 'SO'),
    makePerson('pan-3', 'Mads', 'Retail', 22, 792, 'pandora', 'MA'),
    makePerson('pan-4', 'Nikolaj', 'Data', -4, 846, 'pandora', 'NI'),
    makePerson('lego-1', 'Liva', 'Partnerships', -220, 545, 'lego', 'LI'),
    makePerson('lego-2', 'Oscar', 'Design lead', -162, 590, 'lego', 'OC'),
    makePerson('maersk-1', 'Aksel', 'Shipping', 120, 540, 'maersk', 'AK'),
    makePerson('maersk-2', 'Ida', 'Strategy', 178, 584, 'maersk', 'ID'),
    makePerson('cph-1', 'Nora', 'Community', -260, 748, 'copenhagen', 'NO'),
    makePerson('cph-2', 'Viktor', 'AI builder', -202, 792, 'copenhagen', 'VI'),

    makePerson('yan-1', 'Dmitry', 'Search', 812, -154, 'yandex', 'DM'),
    makePerson('yan-2', 'Irina', 'Maps', 874, -110, 'yandex', 'IR'),
    makePerson('avi-1', 'Oleg', 'Marketplace', 830, 128, 'avito', 'OL', true),
    makePerson('avi-2', 'Anya', 'Trust', 892, 174, 'avito', 'AN'),
    makePerson('med-1', 'Vera', 'Journalist', 572, 148, 'media-ru', 'VE'),
    makePerson('med-2', 'Pavel', 'Analyst', 632, 192, 'media-ru', 'PA'),
    makePerson('msk-1', 'Katya', 'VC', 570, -194, 'moscow', 'KA'),
    makePerson('msk-2', 'Sergey', 'Founder', 632, -150, 'moscow', 'SE'),

    makePerson('na-1', 'Grace', 'Canada', -924, -62, 'usa-canada', 'GR'),
    makePerson('na-2', 'Ethan', 'US sales', -858, -18, 'usa-canada', 'ET'),
    makePerson('il-1', 'Yael', 'Cybersecurity', -680, -174, 'israel', 'YA'),
    makePerson('il-2', 'Ari', 'Investor', -622, -130, 'israel', 'AR'),
    makePerson('jp-1', 'Ren', 'Robotics', -622, 126, 'japan', 'RE'),
    makePerson('jp-2', 'Yuki', 'Enterprise', -566, 172, 'japan', 'YU'),
    makePerson('sg-1', 'Mei', 'APAC ops', -808, 178, 'singapore', 'ME'),
    makePerson('sg-2', 'Kai', 'Fintech', -750, 222, 'singapore', 'KA'),
  ]

  const connections: Connection[] = []

  return { circles, people, connections }
}

function parseCSV(text: string): string[][] {
  const lines: string[][] = []
  let row: string[] = []
  let inQuotes = false
  let currentValue = ''

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"'
        i++ // skip next quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentValue.trim())
      currentValue = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++
      }
      row.push(currentValue.trim())
      if (row.length > 0 && row.some(val => val !== '')) {
        lines.push(row)
      }
      row = []
      currentValue = ''
    } else {
      currentValue += char
    }
  }
  if (currentValue || row.length > 0) {
    row.push(currentValue.trim())
    if (row.some(val => val !== '')) {
      lines.push(row)
    }
  }
  return lines
}

function makeCircle(
  id: string,
  name: string,
  icon: string,
  x: number,
  y: number,
  radius: number,
  parentId: string | null,
  connectedTo: string | null,
  tone: CircleTone,
): CircleNode {
  return {
    id,
    name,
    icon,
    x,
    y,
    radius,
    minRadius: radius,
    parentId,
    connectedTo,
    tone,
    shapeType: 'wavy',
    sides: Math.max(8, Math.round(radius / 10)),
    amplitude: Math.max(4, Math.round(radius * 0.055)),
  }
}

function makePerson(
  id: string,
  name: string,
  role: string,
  x: number,
  y: number,
  circleId: string,
  avatar: string,
  isFavorite = false,
): PersonNode {
  return {
    id,
    name,
    role,
    x,
    y,
    circleId,
    avatar,
    shapeType: 'circle',
    sides: 10,
    amplitude: 0,
    isFavorite,
  }
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
    connections: DEFAULT_STATE.connections.map((connection) => ({ ...connection })),
  })
}

// A blank canvas for a brand-new account: just the central "you" circle.
function createFreshGraph(): GraphState {
  return ensureContainment({
    circles: [makeCircle('you', 'You', 'YOU', 0, 0, 104, null, null, 'blue')],
    people: [],
    connections: [],
  })
}

// Put the signed-in user's Google avatar + name on the "you" circle. Only fills
// the avatar when none is set, so a custom upload from a previous session wins.
function stampYouIdentity(graph: GraphState, user: User): GraphState {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const avatarUrl =
    typeof meta.avatar_url === 'string'
      ? meta.avatar_url
      : typeof meta.picture === 'string'
        ? meta.picture
        : undefined
  const fullName =
    typeof meta.full_name === 'string'
      ? meta.full_name
      : typeof meta.name === 'string'
        ? meta.name
        : undefined
  if (!avatarUrl && !fullName) return graph
  return {
    ...graph,
    circles: graph.circles.map((circle) =>
      circle.id === 'you'
        ? {
            ...circle,
            imageUrl: circle.imageUrl ?? avatarUrl,
            name: circle.name && circle.name !== 'You' ? circle.name : fullName ?? circle.name,
          }
        : circle,
    ),
  }
}

function findFreeSpaceInCircle(
  circles: CircleNode[],
  people: PersonNode[],
  circleId: string
): { x: number; y: number } {
  const circle = circles.find((c) => c.id === circleId)
  if (!circle) return { x: 0, y: 0 }

  const candidateRadii = [circle.radius * 0.3, circle.radius * 0.6]
  const numAngles = 12
  let bestPoint = { x: circle.x, y: circle.y }
  let maxMinDist = -1

  const elements = [
    ...people.map((p) => ({ x: p.x, y: p.y, r: 24 })),
    ...circles.filter((c) => c.id !== circleId).map((c) => ({ x: c.x, y: c.y, r: c.radius })),
  ]

  for (const r of candidateRadii) {
    for (let i = 0; i < numAngles; i++) {
      const angle = (i * 2 * Math.PI) / numAngles
      const px = circle.x + r * Math.cos(angle)
      const py = circle.y + r * Math.sin(angle)

      let minDist = Infinity
      for (const el of elements) {
        const dist = Math.hypot(px - el.x, py - el.y) - el.r
        if (dist < minDist) {
          minDist = dist
        }
      }

      if (minDist > maxMinDist) {
        maxMinDist = minDist
        bestPoint = { x: px, y: py }
      }
    }
  }

  if (maxMinDist === Infinity || maxMinDist < 5) {
    const randomAngle = Math.random() * 2 * Math.PI
    const randomRadius = circle.radius * 0.4
    return {
      x: circle.x + randomRadius * Math.cos(randomAngle),
      y: circle.y + randomRadius * Math.sin(randomAngle),
    }
  }

  return bestPoint
}

function resizeCircleFromPoint(state: GraphState, circleId: string, point: { x: number; y: number }): GraphState {
  const circle = state.circles.find((candidate) => candidate.id === circleId)
  if (!circle) return state

  const requestedRadius = Math.max(MIN_CIRCLE_RADIUS, Math.hypot(point.x - circle.x, point.y - circle.y))
  const radiusRatio = requestedRadius < circle.radius ? requestedRadius / circle.radius : 1
  const resizedState = radiusRatio < 1 ? pullCircleContentsTowardCenter(state, circleId, circle, radiusRatio) : state

  return ensureContainment({
    ...resizedState,
    circles: resizedState.circles.map((candidate) =>
      candidate.id === circleId ? { ...candidate, minRadius: requestedRadius, radius: requestedRadius } : candidate,
    ),
  }, { activeCircleId: circleId })
}

type LayoutContext = {
  activeCircleId?: string
  activePersonId?: string
}

function ensureContainment(state: GraphState, context: LayoutContext = {}): GraphState {
  return fitContainment(resolveCollisions(fitContainment(resolveCollisions(state, context)), context))
}

function fitContainment(state: GraphState): GraphState {
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

function pullCircleContentsTowardCenter(
  state: GraphState,
  circleId: string,
  circle: CircleNode,
  radiusRatio: number,
): GraphState {
  const descendantCircleIds = getDescendantCircleIds(state.circles, circleId)
  const containedCircleIds = new Set(descendantCircleIds)
  containedCircleIds.add(circleId)
  const scale = clamp(radiusRatio, 0.12, 1)

  function pullPoint(point: { x: number; y: number }) {
    return {
      x: circle.x + (point.x - circle.x) * scale,
      y: circle.y + (point.y - circle.y) * scale,
    }
  }

  return {
    ...state,
    circles: state.circles.map((candidate) =>
      descendantCircleIds.has(candidate.id)
        ? {
            ...candidate,
            ...pullPoint(candidate),
            radius: Math.max(MIN_CIRCLE_RADIUS, candidate.radius * scale),
            minRadius: Math.max(MIN_CIRCLE_RADIUS, candidate.minRadius * scale),
          }
        : candidate,
    ),
    people: state.people.map((person) =>
      containedCircleIds.has(person.circleId) ? { ...person, ...pullPoint(person) } : person,
    ),
  }
}

function resolveCollisions(state: GraphState, context: LayoutContext): GraphState {
  let circles = state.circles.map((circle) => ({ ...circle }))
  let people = state.people.map((person) => ({ ...person }))

  for (let pass = 0; pass < COLLISION_PASSES; pass += 1) {
    let changed = false
    const circleIndexById = new Map(circles.map((circle, index) => [circle.id, index]))
    const personIndexById = new Map(people.map((person, index) => [person.id, index]))

    for (let i = 0; i < circles.length; i += 1) {
      for (let j = i + 1; j < circles.length; j += 1) {
        const a = circles[i]
        const b = circles[j]
        if (a.parentId !== b.parentId) continue

        const separation = getSeparation(a, b, a.radius + b.radius + CIRCLE_COLLISION_GAP)
        if (!separation) continue

        const activeSide = context.activeCircleId === a.id ? 'a' : context.activeCircleId === b.id ? 'b' : null
        let moveA = activeSide === 'a' ? 0 : activeSide === 'b' ? 1 : 0.5
        let moveB = activeSide === 'b' ? 0 : activeSide === 'a' ? 1 : 0.5

        if (a.id === 'you') {
          moveA = 0
          moveB = 1
        } else if (b.id === 'you') {
          moveA = 1
          moveB = 0
        }

        if (moveA > 0) {
          const translated = translateCircleSubtree(circles, people, a.id, -separation.x * moveA, -separation.y * moveA)
          circles = translated.circles
          people = translated.people
        }
        if (moveB > 0) {
          const translated = translateCircleSubtree(circles, people, b.id, separation.x * moveB, separation.y * moveB)
          circles = translated.circles
          people = translated.people
        }
        changed = true
      }
    }

    for (let i = 0; i < people.length; i += 1) {
      for (let j = i + 1; j < people.length; j += 1) {
        const a = people[i]
        const b = people[j]
        if (a.circleId !== b.circleId) continue

        const separation = getSeparation(a, b, PERSON_COLLISION_RADIUS * 2 + PERSON_COLLISION_GAP)
        if (!separation) continue

        const activeSide = context.activePersonId === a.id ? 'a' : context.activePersonId === b.id ? 'b' : null
        const moveA = activeSide === 'a' ? 0 : activeSide === 'b' ? 1 : 0.5
        const moveB = activeSide === 'b' ? 0 : activeSide === 'a' ? 1 : 0.5

        people[i] = { ...a, x: a.x - separation.x * moveA, y: a.y - separation.y * moveA }
        people[j] = { ...b, x: b.x + separation.x * moveB, y: b.y + separation.y * moveB }
        changed = true
      }
    }

    for (const childCircle of circles) {
      if (!childCircle.parentId) continue
      for (const person of people) {
        if (person.circleId !== childCircle.parentId) continue

        const separation = getSeparation(
          childCircle,
          person,
          childCircle.radius + PERSON_COLLISION_RADIUS + PERSON_CIRCLE_COLLISION_GAP,
        )
        if (!separation) continue

        const personIndex = personIndexById.get(person.id)
        if (personIndex == null) continue
        people[personIndex] = {
          ...people[personIndex],
          x: people[personIndex].x + separation.x,
          y: people[personIndex].y + separation.y,
        }
        changed = true
      }
    }

    for (const person of people) {
      const parentIndex = circleIndexById.get(person.circleId)
      const personIndex = personIndexById.get(person.id)
      if (parentIndex == null || personIndex == null) continue

      const parentCircle = circles[parentIndex]
      const separation = getSeparation(
        parentCircle,
        people[personIndex],
        CIRCLE_CENTER_COLLISION_RADIUS + PERSON_COLLISION_RADIUS + PERSON_COLLISION_GAP,
      )
      if (!separation) continue

      people[personIndex] = {
        ...people[personIndex],
        x: people[personIndex].x + separation.x,
        y: people[personIndex].y + separation.y,
      }
      changed = true
    }

    for (const person of people) {
      const parentIndex = circleIndexById.get(person.circleId)
      const personIndex = personIndexById.get(person.id)
      if (parentIndex == null || personIndex == null) continue
      people[personIndex] = clampPersonInsideCircle(people[personIndex], circles[parentIndex])
    }

    if (!changed) break
  }

  return { ...state, circles, people }
}

function getSeparation(
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

function translateCircleSubtree(
  circles: CircleNode[],
  people: PersonNode[],
  circleId: string,
  deltaX: number,
  deltaY: number,
) {
  const subtreeIds = getDescendantCircleIds(circles, circleId)
  subtreeIds.add(circleId)

  return {
    circles: circles.map((circle) =>
      subtreeIds.has(circle.id) ? { ...circle, x: circle.x + deltaX, y: circle.y + deltaY } : circle,
    ),
    people: people.map((person) =>
      subtreeIds.has(person.circleId) ? { ...person, x: person.x + deltaX, y: person.y + deltaY } : person,
    ),
  }
}

function clampPersonInsideCircle(person: PersonNode, circle: CircleNode) {
  const maxDistance = Math.max(0, circle.radius - PERSON_COLLISION_RADIUS)
  const dx = person.x - circle.x
  const dy = person.y - circle.y
  const distance = Math.hypot(dx, dy)
  if (distance <= maxDistance || distance < 0.0001) return person

  return {
    ...person,
    x: circle.x + (dx / distance) * maxDistance,
    y: circle.y + (dy / distance) * maxDistance,
  }
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

function PaletteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="13.5" cy="6.5" r=".5" />
      <circle cx="17.5" cy="10.5" r=".5" />
      <circle cx="8.5" cy="7.5" r=".5" />
      <circle cx="6.5" cy="12.5" r=".5" />
      <path d="M12 3a9 9 0 0 0 0 18h1.6a2.4 2.4 0 0 0 1.7-4.1l-.4-.4a1.2 1.2 0 0 1 .8-2h1.8A3.5 3.5 0 0 0 21 11c0-4.4-4-8-9-8Z" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function ConnectionServiceIcon({ service }: { service: PersonLinkService }) {
  if (service === 'linkedin') return <span className="service-icon service-icon--linkedin">in</span>
  if (service === 'telegram') return <span className="service-icon service-icon--telegram">tg</span>
  if (service === 'instagram') return <span className="service-icon service-icon--instagram">ig</span>
  if (service === 'facebook') return <span className="service-icon service-icon--facebook">f</span>
  if (service === 'whatsapp') return <span className="service-icon service-icon--whatsapp">wa</span>
  if (service === 'x') return <span className="service-icon service-icon--x">x</span>
  return <span className="service-icon service-icon--website">web</span>
}

export default App
