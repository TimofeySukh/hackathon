import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CSSProperties,
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react'

import { useAuth } from './lib/useAuth'
import { deleteAccountData, normalizeTagName, searchPeopleWithAi } from './lib/graphStorage'
import type { Connection, PersonAiNote, PersonNode, PersonNote, Tag } from './lib/graphTypes'
import { DEFAULT_TAG_COLOR, DEFAULT_TAGS, hexToRgb, normalizeTagColor } from './lib/tagPalette'
import { useBoardGraph } from './lib/useBoardGraph'

type Theme = 'dark' | 'light'

type Offset = {
  x: number
  y: number
}

type TouchPoint = {
  clientX: number
  clientY: number
}

type PinchGesture = {
  firstPointerId: number
  secondPointerId: number
  previousDistance: number
  previousMidpoint: Offset
}

type ConnectionDrag = {
  fromId: string
  startClientX: number
  startClientY: number
  clientX: number
  clientY: number
  worldX: number
  worldY: number
}

type NodeDrag = {
  nodeIds: string[]
  startClientX: number
  startClientY: number
  originPositions: Record<string, Offset>
}

type AreaSelection = {
  startClientX: number
  startClientY: number
  currentClientX: number
  currentClientY: number
  viewportLeft: number
  viewportTop: number
}

type NodeGroup = {
  id: string
  boardId: string
  memberIds: string[]
  color: string
  createdAt: string
}

type NodeGroupBubble = {
  id: string
  path: string
  hull: Offset[]
  fill: string
  stroke: string
}

type LocalGraphState = {
  people: PersonNode[]
  tags: Tag[]
  notes: PersonNote[]
  connections: Connection[]
}

type TapState = {
  time: number
  clientX: number
  clientY: number
}

type NoteDraft = {
  title: string
  body: string
}

type TextRange = {
  start: number
  end: number
}

type SearchResult = {
  node: PersonNode
  score: number
  matches: string[]
  source: 'local' | 'ai'
}

type LinkedInConnectionRow = {
  firstName: string
  lastName: string
  url: string
  email: string
  company: string
  position: string
  connectedOn: string
}

type LinkedInImportStatus = {
  state: 'idle' | 'loading' | 'success' | 'error'
  message: string | null
}

type LinkedInImportOptions = {
  includeEmail: boolean
  includeUrl: boolean
}

type BoardStyle = CSSProperties & {
  '--board-offset-x': string
  '--board-offset-y': string
  '--dot-gap': string
  '--major-dot-gap': string
  '--dot-size': string
  '--major-dot-size': string
}

type WorldBounds = {
  left: number
  right: number
  top: number
  bottom: number
  centerX: number
  centerY: number
  scale: number
}

type TagColorStyle = CSSProperties & {
  '--tag-color': string
  '--tag-color-rgb'?: string
}

type GraphNodeStyle = CSSProperties & {
  '--node-color'?: string
}

type GestureEventLike = Event & {
  clientX: number
  clientY: number
  scale: number
}

type TagMenuItem = Pick<Tag, 'id' | 'name' | 'color'> & {
  isPersisted: boolean
}

type TagPickerOption =
  | {
      id: 'clear'
      type: 'clear'
      label: string
    }
  | {
      id: string
      type: 'tag'
      label: string
      tagId: string
      color: string
    }
  | {
      id: 'create'
      type: 'create'
      label: string
    }

const THEME_STORAGE_KEY = 'hackathon-theme'
const TAG_COLOR_STORAGE_KEY = 'hackathon-tag-colors'
const NODE_GROUP_STORAGE_KEY = 'hackathon-node-groups'
const LOCAL_GRAPH_STORAGE_KEY = 'hackathon-local-graph'
const LINKEDIN_TAG_NAME = 'LinkedIn'
const DEFAULT_LINKEDIN_IMPORT_OPTIONS: LinkedInImportOptions = {
  includeEmail: false,
  includeUrl: false,
}
const AI_SEARCH_CANDIDATE_LIMIT = 40
const LINKEDIN_SYNC_STEPS = [
  {
    title: 'Open Settings & Privacy',
    body: 'First, open your LinkedIn profile menu and go to Settings & Privacy.',
    image: '/linkedin-sync/settings-privacy.png',
  },
  {
    title: 'Open Data privacy',
    body: 'In Settings, select Data privacy.',
    image: '/linkedin-sync/data-privacy.png',
  },
  {
    title: 'Open Download my data',
    body: 'In the data section, press Download your data.',
    image: '/linkedin-sync/download-data.png',
  },
  {
    title: 'Request the larger archive',
    body: 'Select the larger data archive, then press Request archive.',
    image: '/linkedin-sync/request-archive.png',
  },
]
const MIN_SCALE = 0.2
const MAX_SCALE = 2.5
const GRID_GAP = 12
const MAJOR_GRID_GAP = 96
const DOT_SIZE = 0.65
const MAJOR_DOT_SIZE = 2
const TAG_PRESET_COLORS = ['#ff6b6b', '#ff9f43', '#ffd93d', '#4f7cff', '#1e90ff', '#3742fa', '#a55eea', '#8b5cf6', '#ff7eb6', '#d946ef']
const NODE_CLICK_DRAG_THRESHOLD = 4
const NODE_RADIUS = 9
const NODE_HIT_RADIUS = 31
const MIN_LINK_VISIBLE_LENGTH = 2
const CONNECTION_CREATE_THRESHOLD = 18
const WHEEL_ZOOM_INTENSITY = 0.0016
const INSPECTOR_ANCHOR_GAP = 40
const INSPECTOR_VIEWPORT_MARGIN = 16
const TRACKPAD_PAN_IDLE_MS = 320
const DOUBLE_TAP_MS = 330
const DOUBLE_TAP_DISTANCE = 22
const GROUP_DROP_DISTANCE = 86
const GROUP_MEMBER_SPACING = 72
const GROUP_BLOB_NODE_RADIUS = 12
const GROUP_BLOB_PADDING = 28
const GROUP_BLOB_SAMPLE_POINTS = 18
const LINKEDIN_RING_CAPACITIES = [10, 40]
const LINKEDIN_RING_RADIUS = 260
const LINKEDIN_RING_STEP = 190
const LINKEDIN_GRID_SPACING = 170
const RENDER_MARGIN_SCREEN_PX = 700
const RENDER_BOUNDS_PAN_THRESHOLD = 320
const MAX_RENDERED_NODES = 1600
const MAX_RENDERED_CONNECTIONS = 1400
const LABEL_NODE_LIMIT = 450
const LABEL_MIN_SCALE = 0.58
const CONNECTION_NODE_LIMIT = 1200
const LARGE_GRAPH_SVG_SIZE = 200000

function getLinkedInRingCapacity(ringIndex: number) {
  if (ringIndex < LINKEDIN_RING_CAPACITIES.length) {
    return LINKEDIN_RING_CAPACITIES[ringIndex]
  }

  return 100 + (ringIndex - 2) * 50
}

function parseCsvRows(csv: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let isQuoted = false

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]
    const nextCharacter = csv[index + 1]

    if (character === '"') {
      if (isQuoted && nextCharacter === '"') {
        cell += '"'
        index += 1
        continue
      }

      isQuoted = !isQuoted
      continue
    }

    if (character === ',' && !isQuoted) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((character === '\n' || character === '\r') && !isQuoted) {
      if (character === '\r' && nextCharacter === '\n') {
        index += 1
      }
      row.push(cell)
      if (row.some((value) => value.trim())) {
        rows.push(row)
      }
      row = []
      cell = ''
      continue
    }

    cell += character
  }

  row.push(cell)
  if (row.some((value) => value.trim())) {
    rows.push(row)
  }

  return rows
}

function normalizeLinkedInValue(value: string | undefined) {
  return (value ?? '').replace(/^\uFEFF/, '').trim()
}

function parseLinkedInConnectionsCsv(csv: string): LinkedInConnectionRow[] {
  const rows = parseCsvRows(csv)
  const headerIndex = rows.findIndex((row) =>
    normalizeLinkedInValue(row[0]).toLowerCase() === 'first name' &&
    normalizeLinkedInValue(row[1]).toLowerCase() === 'last name',
  )

  if (headerIndex < 0) {
    throw new Error('Connections.csv does not contain the expected LinkedIn connections header.')
  }

  const headers = rows[headerIndex].map((header) => normalizeLinkedInValue(header).toLowerCase())
  const columnIndex = (name: string) => headers.indexOf(name.toLowerCase())
  const firstNameIndex = columnIndex('first name')
  const lastNameIndex = columnIndex('last name')
  const urlIndex = columnIndex('url')
  const emailIndex = columnIndex('email address')
  const companyIndex = columnIndex('company')
  const positionIndex = columnIndex('position')
  const connectedOnIndex = columnIndex('connected on')

  return rows.slice(headerIndex + 1).map((row) => ({
    firstName: normalizeLinkedInValue(row[firstNameIndex]),
    lastName: normalizeLinkedInValue(row[lastNameIndex]),
    url: normalizeLinkedInValue(row[urlIndex]),
    email: normalizeLinkedInValue(row[emailIndex]),
    company: normalizeLinkedInValue(row[companyIndex]),
    position: normalizeLinkedInValue(row[positionIndex]),
    connectedOn: normalizeLinkedInValue(row[connectedOnIndex]),
  })).filter((connection) => connection.firstName || connection.lastName || connection.url)
}

async function readLinkedInConnectionsFromArchive(file: File) {
  const { BlobReader, TextWriter, ZipReader } = await import('@zip.js/zip.js')
  const zipReader = new ZipReader(new BlobReader(file))

  try {
    const entries = await zipReader.getEntries()
    const connectionsEntry = entries.find((entry) =>
      !entry.directory && entry.filename.toLowerCase().endsWith('connections.csv'),
    )

    if (!connectionsEntry || !('getData' in connectionsEntry)) {
      throw new Error('Connections.csv was not found in this LinkedIn archive.')
    }

    const csv = await connectionsEntry.getData(new TextWriter())
    return parseLinkedInConnectionsCsv(csv)
  } finally {
    await zipReader.close()
  }
}

function getLinkedInConnectionName(connection: LinkedInConnectionRow) {
  return normalizeTagName(`${connection.firstName} ${connection.lastName}`)
}

function getLinkedInNoteBody(connection: LinkedInConnectionRow, options: LinkedInImportOptions) {
  return [
    connection.position ? `Position/headline: ${connection.position}` : '',
    connection.company ? `Company: ${connection.company}` : '',
    options.includeUrl && connection.url ? `LinkedIn: ${connection.url}` : '',
    options.includeEmail && connection.email ? `Email: ${connection.email}` : '',
    connection.connectedOn ? `Connected on: ${connection.connectedOn}` : '',
    `Imported LinkedIn name: ${getLinkedInConnectionName(connection)}`,
    'Source: LinkedIn Connections.csv',
  ].filter(Boolean).join('\n')
}

function extractLinkedInImportKeysFromNotes(notes: PersonNote[]) {
  const urls = new Set<string>()
  const names = new Set<string>()

  for (const note of notes) {
    const match = note.body.match(/LinkedIn:\s*(\S+)/i)
    if (match?.[1]) {
      urls.add(match[1].toLowerCase())
    }

    const sourceMatch = note.body.match(/Imported LinkedIn name:\s*(.+)/i)
    if (sourceMatch?.[1]) {
      names.add(normalizeTagName(sourceMatch[1]).toLowerCase())
    }
  }

  return { names, urls }
}

function getQuadrantKey(position: Offset) {
  if (position.x >= 0 && position.y < 0) return 'top-right'
  if (position.x < 0 && position.y < 0) return 'top-left'
  if (position.x < 0 && position.y >= 0) return 'bottom-left'
  return 'bottom-right'
}

type QuadrantKey = ReturnType<typeof getQuadrantKey>

function getRingSlotPosition(slotIndex: number, angleStart: number, angleEnd: number) {
  const capacityScale = Math.abs(angleEnd - angleStart) / (Math.PI * 2)
  let remainingSlot = slotIndex
  let ringIndex = 0

  const getScaledCapacity = (targetRingIndex: number) =>
    Math.max(1, Math.ceil(getLinkedInRingCapacity(targetRingIndex) * capacityScale))

  while (remainingSlot >= getScaledCapacity(ringIndex)) {
    remainingSlot -= getScaledCapacity(ringIndex)
    ringIndex += 1
  }

  const capacity = getScaledCapacity(ringIndex)
  const radius = LINKEDIN_RING_RADIUS + ringIndex * LINKEDIN_RING_STEP
  const progress = capacity === 1 ? 0.5 : (remainingSlot + 0.5) / capacity
  const angle = angleStart + (angleEnd - angleStart) * progress

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  }
}

function getLinkedInImportPositions(count: number, people: PersonNode[]) {
  const existingPeople = people.filter((person) => !person.is_root)

  if (existingPeople.length === 0) {
    return Array.from({ length: count }, (_, index) => getRingSlotPosition(index, 0, Math.PI * 2))
  }

  const occupiedQuadrants = new Set<QuadrantKey>(existingPeople.map((person) => getQuadrantKey(person)))
  const quadrants = [
    { key: 'bottom-right', start: 0, end: Math.PI / 2 },
    { key: 'bottom-left', start: Math.PI / 2, end: Math.PI },
    { key: 'top-left', start: Math.PI, end: Math.PI * 1.5 },
    { key: 'top-right', start: Math.PI * 1.5, end: Math.PI * 2 },
  ] satisfies Array<{ key: QuadrantKey; start: number; end: number }>
  const emptyQuadrants = quadrants.filter((quadrant) => !occupiedQuadrants.has(quadrant.key))

  if (emptyQuadrants.length > 0) {
    const quadrantSlotCounts = new Map<QuadrantKey, number>()

    return Array.from({ length: count }, (_, index) => {
      const quadrant = emptyQuadrants[index % emptyQuadrants.length]
      const slotIndex = quadrantSlotCounts.get(quadrant.key) ?? 0
      quadrantSlotCounts.set(quadrant.key, slotIndex + 1)
      return getRingSlotPosition(slotIndex, quadrant.start, quadrant.end)
    })
  }

  const maxX = Math.max(0, ...existingPeople.map((person) => person.x))
  const maxY = Math.max(0, ...existingPeople.map((person) => person.y))
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)))
  const startX = maxX + LINKEDIN_GRID_SPACING
  const startY = maxY + LINKEDIN_GRID_SPACING

  return Array.from({ length: count }, (_, index) => ({
    x: startX + (index % columns) * LINKEDIN_GRID_SPACING,
    y: startY + Math.floor(index / columns) * LINKEDIN_GRID_SPACING,
  }))
}

function isLikelyTrackpadPan(event: WheelEvent) {
  if (event.ctrlKey) return false
  if (Math.abs(event.deltaX) > 0) return true
  if (event.deltaMode === 1) return false

  const absDeltaY = Math.abs(event.deltaY)

  if (absDeltaY === 0) return false
  if (absDeltaY < 24) return true

  return !Number.isInteger(absDeltaY / 120)
}

const ANONYMOUS_ROOT: PersonNode = {
  id: 'anonymous-root',
  board_id: 'anonymous-board',
  owner_user_id: 'anonymous-user',
  name: 'You',
  tag_id: null,
  x: 0,
  y: 0,
  is_root: true,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
}

const ANONYMOUS_BOARD = {
  id: 'anonymous-board',
  user_id: 'anonymous-user',
  title: 'SocialDataNode',
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
}

function createLocalId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createUuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (character) =>
    (Number(character) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(character) / 4).toString(16),
  )
}

function getViewportRenderBounds(boardElement: HTMLElement, offset: Offset, scale: number): WorldBounds {
  const viewportWidth = boardElement.clientWidth
  const viewportHeight = boardElement.clientHeight
  const marginWorld = RENDER_MARGIN_SCREEN_PX / scale
  const left = (-viewportWidth / 2 - offset.x) / scale - marginWorld
  const right = (viewportWidth / 2 - offset.x) / scale + marginWorld
  const top = (-viewportHeight / 2 - offset.y) / scale - marginWorld
  const bottom = (viewportHeight / 2 - offset.y) / scale + marginWorld

  return {
    left,
    right,
    top,
    bottom,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    scale,
  }
}

function shouldUpdateRenderBounds(currentBounds: WorldBounds | null, nextBounds: WorldBounds) {
  if (!currentBounds) return true

  const thresholdWorld = RENDER_BOUNDS_PAN_THRESHOLD / nextBounds.scale

  return (
    Math.abs(currentBounds.centerX - nextBounds.centerX) > thresholdWorld ||
    Math.abs(currentBounds.centerY - nextBounds.centerY) > thresholdWorld ||
    Math.abs(currentBounds.scale - nextBounds.scale) > 0.08
  )
}

function isNodeInsideBounds(node: PersonNode, bounds: WorldBounds | null) {
  if (!bounds) return true

  return node.x >= bounds.left && node.x <= bounds.right && node.y >= bounds.top && node.y <= bounds.bottom
}

function createDefaultLocalTags(): Tag[] {
  const timestamp = new Date(0).toISOString()

  return DEFAULT_TAGS.map((tag) => ({
    id: `local-tag-${normalizeTagName(tag.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    user_id: 'anonymous-user',
    name: tag.name,
    normalized_name: normalizeTagName(tag.name).toLowerCase(),
    color: tag.color,
    created_at: timestamp,
    updated_at: timestamp,
  }))
}

function createDefaultLocalGraph(): LocalGraphState {
  return {
    people: [ANONYMOUS_ROOT],
    tags: createDefaultLocalTags(),
    notes: [],
    connections: [],
  }
}

function sanitizeLocalGraph(input: Partial<LocalGraphState> | null | undefined): LocalGraphState {
  const defaults = createDefaultLocalGraph()
  const people = Array.isArray(input?.people)
    ? input.people.filter((person) => person && typeof person.id === 'string')
    : defaults.people
  const normalizedPeople = [
    ANONYMOUS_ROOT,
    ...people
      .filter((person) => person.id !== ANONYMOUS_ROOT.id && !person.is_root)
      .map((person) => ({
        ...person,
        board_id: ANONYMOUS_BOARD.id,
        owner_user_id: ANONYMOUS_BOARD.user_id,
        is_root: false,
      })),
  ]
  const personIds = new Set(normalizedPeople.map((person) => person.id))

  const savedTags = Array.isArray(input?.tags)
    ? input.tags
        .filter((tag) => tag && typeof tag.id === 'string' && typeof tag.name === 'string')
        .map((tag) => ({
          ...tag,
          user_id: ANONYMOUS_BOARD.user_id,
          normalized_name: normalizeTagName(tag.normalized_name || tag.name).toLowerCase(),
          color: normalizeTagColor(tag.color ?? DEFAULT_TAG_COLOR),
        }))
    : []
  const tagNames = new Set(savedTags.map((tag) => tag.normalized_name))
  const tags = [
    ...savedTags,
    ...defaults.tags.filter((tag) => !tagNames.has(tag.normalized_name)),
  ]

  const notes = Array.isArray(input?.notes)
    ? input.notes
        .filter((note) => note && typeof note.id === 'string' && personIds.has(note.person_id))
        .map((note) => ({
          ...note,
          owner_user_id: ANONYMOUS_BOARD.user_id,
        }))
    : []

  const connections = Array.isArray(input?.connections)
    ? input.connections
        .filter(
          (connection) =>
            connection &&
            typeof connection.id === 'string' &&
            personIds.has(connection.person_a_id) &&
            personIds.has(connection.person_b_id) &&
            connection.person_a_id !== connection.person_b_id,
        )
        .map((connection) => ({
          ...connection,
          board_id: ANONYMOUS_BOARD.id,
          owner_user_id: ANONYMOUS_BOARD.user_id,
        }))
    : []

  return { people: normalizedPeople, tags, notes, connections }
}

function loadLocalGraph() {
  try {
    const savedGraph = window.localStorage.getItem(LOCAL_GRAPH_STORAGE_KEY)
    if (!savedGraph) return createDefaultLocalGraph()

    return sanitizeLocalGraph(JSON.parse(savedGraph) as Partial<LocalGraphState>)
  } catch {
    window.localStorage.removeItem(LOCAL_GRAPH_STORAGE_KEY)
    return createDefaultLocalGraph()
  }
}

function saveLocalGraph(graph: LocalGraphState) {
  window.localStorage.setItem(LOCAL_GRAPH_STORAGE_KEY, JSON.stringify(sanitizeLocalGraph(graph)))
}

function getNodeGroupStorageKey(boardId: string) {
  return `${NODE_GROUP_STORAGE_KEY}:${boardId}`
}

function loadNodeGroups(boardId: string): NodeGroup[] {
  try {
    const savedGroups = window.localStorage.getItem(getNodeGroupStorageKey(boardId))
    if (!savedGroups) return []

    const parsedGroups = JSON.parse(savedGroups) as NodeGroup[]
    if (!Array.isArray(parsedGroups)) return []

    return parsedGroups.filter(
      (group) =>
        group &&
        group.boardId === boardId &&
        typeof group.id === 'string' &&
        Array.isArray(group.memberIds) &&
        group.memberIds.length >= 2 &&
        typeof group.color === 'string',
    )
  } catch {
    return []
  }
}

function saveNodeGroups(boardId: string, groups: NodeGroup[]) {
  const storageKey = getNodeGroupStorageKey(boardId)
  if (groups.length === 0) {
    window.localStorage.removeItem(storageKey)
    return
  }

  window.localStorage.setItem(storageKey, JSON.stringify(groups))
}

function sanitizeNodeGroups(groups: NodeGroup[], boardId: string, nodes: PersonNode[]) {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const assignedNodeIds = new Set<string>()
  const nextGroups: NodeGroup[] = []

  for (const group of groups) {
    const memberIds = group.memberIds.filter((nodeId) => nodeIds.has(nodeId) && !assignedNodeIds.has(nodeId))
    if (memberIds.length < 2) continue

    for (const nodeId of memberIds) assignedNodeIds.add(nodeId)
    nextGroups.push({
      ...group,
      boardId,
      memberIds,
      color: normalizeTagColor(group.color),
    })
  }

  return nextGroups
}

function getNodeGroupForNode(groups: NodeGroup[], nodeId: string) {
  return groups.find((group) => group.memberIds.includes(nodeId)) ?? null
}

function getNodeDisplayColor(node: PersonNode, tagColorById: Record<string, string>) {
  if (node.is_root) return DEFAULT_TAG_COLOR
  return node.tag_id ? tagColorById[node.tag_id] ?? DEFAULT_TAG_COLOR : DEFAULT_TAG_COLOR
}

function rgbaFromHex(color: string, alpha: number) {
  return `rgb(${hexToRgb(color)} / ${alpha})`
}

function getNodeGroupBubbles(groups: NodeGroup[], nodes: PersonNode[]): NodeGroupBubble[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]))

  return groups
    .map((group) => {
      const members = group.memberIds.map((nodeId) => nodesById.get(nodeId)).filter(Boolean) as PersonNode[]
      if (members.length < 2) return null

      const color = normalizeTagColor(group.color)
      const hull = getGroupBubbleHull(members)
      const path = hull ? getSmoothClosedPath(hull) : null
      if (!path) return null

      return {
        id: group.id,
        path,
        hull,
        fill: rgbaFromHex(color, 0.18),
        stroke: rgbaFromHex(color, 0.64),
      }
    })
    .filter(Boolean) as NodeGroupBubble[]
}

function getGroupBubbleHull(nodes: PersonNode[]) {
  const points: Offset[] = []
  const radius = GROUP_BLOB_NODE_RADIUS + GROUP_BLOB_PADDING

  for (const node of nodes) {
    for (let index = 0; index < GROUP_BLOB_SAMPLE_POINTS; index += 1) {
      const angle = (index * Math.PI * 2) / GROUP_BLOB_SAMPLE_POINTS
      const wobble = index % 2 === 0 ? 2 : -1
      points.push({
        x: node.x + Math.cos(angle) * (radius + wobble),
        y: node.y + Math.sin(angle) * (radius - wobble),
      })
    }
  }

  const hull = getConvexHull(points)
  if (hull.length < 3) return null

  return hull
}

function getConvexHull(points: Offset[]) {
  const sortedPoints = [...points].sort((left, right) => left.x - right.x || left.y - right.y)
  if (sortedPoints.length <= 1) return sortedPoints

  const cross = (origin: Offset, left: Offset, right: Offset) =>
    (left.x - origin.x) * (right.y - origin.y) - (left.y - origin.y) * (right.x - origin.x)
  const lower: Offset[] = []
  for (const point of sortedPoints) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop()
    }
    lower.push(point)
  }

  const upper: Offset[] = []
  for (let index = sortedPoints.length - 1; index >= 0; index -= 1) {
    const point = sortedPoints[index]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop()
    }
    upper.push(point)
  }

  lower.pop()
  upper.pop()
  return [...lower, ...upper]
}

function getSmoothClosedPath(points: Offset[]) {
  const first = points[0]
  const commands = [`M ${first.x} ${first.y}`]

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    const midX = (current.x + next.x) / 2
    const midY = (current.y + next.y) / 2
    commands.push(`Q ${current.x} ${current.y} ${midX} ${midY}`)
  }

  commands.push('Z')
  return commands.join(' ')
}

function isPointInPolygon(point: Offset, polygon: Offset[]) {
  let isInside = false

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index]
    const previous = polygon[previousIndex]
    const crossesY = current.y > point.y !== previous.y > point.y
    if (!crossesY) continue

    const crossingX = ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x
    if (point.x < crossingX) isInside = !isInside
  }

  return isInside
}

function getDistanceToSegment(point: Offset, start: Offset, end: Offset) {
  const segmentX = end.x - start.x
  const segmentY = end.y - start.y
  const lengthSquared = segmentX * segmentX + segmentY * segmentY
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y)

  const projection = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / lengthSquared),
  )
  const projectedX = start.x + projection * segmentX
  const projectedY = start.y + projection * segmentY
  return Math.hypot(point.x - projectedX, point.y - projectedY)
}

function getDistanceToPolygon(point: Offset, polygon: Offset[]) {
  return polygon.reduce((minDistance, vertex, index) => {
    const nextVertex = polygon[(index + 1) % polygon.length]
    return Math.min(minDistance, getDistanceToSegment(point, vertex, nextVertex))
  }, Number.POSITIVE_INFINITY)
}

function isPointTouchingPolygon(point: Offset, polygon: Offset[], radius: number) {
  return isPointInPolygon(point, polygon) || getDistanceToPolygon(point, polygon) <= radius
}

function arrangeGroupMembers(nodes: PersonNode[], memberIds: string[]) {
  const members = memberIds.map((nodeId) => nodes.find((node) => node.id === nodeId)).filter(Boolean) as PersonNode[]
  if (members.length < 2) return new Map<string, Offset>()

  const centerX = members.reduce((sum, node) => sum + node.x, 0) / members.length
  const centerY = members.reduce((sum, node) => sum + node.y, 0) / members.length
  const positions = new Map<string, Offset>()

  if (members.length === 2) {
    const [first, second] = members
    const angle = Math.atan2(second.y - first.y, second.x - first.x) || 0
    const halfSpacing = GROUP_MEMBER_SPACING / 2
    positions.set(first.id, {
      x: centerX - Math.cos(angle) * halfSpacing,
      y: centerY - Math.sin(angle) * halfSpacing,
    })
    positions.set(second.id, {
      x: centerX + Math.cos(angle) * halfSpacing,
      y: centerY + Math.sin(angle) * halfSpacing,
    })
    return positions
  }

  const radius = GROUP_MEMBER_SPACING + Math.max(0, members.length - 3) * 12
  const sortedMembers = [...members].sort((left, right) => {
    const leftAngle = Math.atan2(left.y - centerY, left.x - centerX)
    const rightAngle = Math.atan2(right.y - centerY, right.x - centerX)
    return leftAngle - rightAngle
  })

  sortedMembers.forEach((node, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / sortedMembers.length
    positions.set(node.id, {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    })
  })

  return positions
}

function getDraggedNodePositions(currentNodeDrag: NodeDrag, currentPositions: Record<string, Offset>) {
  return currentNodeDrag.nodeIds.reduce<Record<string, Offset>>((positions, nodeId) => {
    const finalPosition = currentPositions[nodeId] ?? currentNodeDrag.originPositions[nodeId]
    if (finalPosition) positions[nodeId] = finalPosition
    return positions
  }, {})
}

function getNodeDragCenter(nodeIds: string[], positions: Record<string, Offset>) {
  const nodes = nodeIds.map((nodeId) => positions[nodeId]).filter(Boolean) as Offset[]
  if (nodes.length === 0) return null

  return {
    x: nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length,
    y: nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length,
  }
}

type GraphEdgeProps = {
  edge: Connection
  fromNode: PersonNode
  toNode: PersonNode
  isSelected: boolean
  onSelect: (connectionId: string, event: ReactPointerEvent<SVGPathElement>) => void
}

const GraphEdgePath = memo(function GraphEdgePath({
  edge,
  fromNode,
  toNode,
  isSelected,
  onSelect,
}: GraphEdgeProps) {
  const link = getLinkPath(fromNode, toNode)
  if (!link) return null

  const pathD = `M ${link.start.x} ${link.start.y} C ${link.controlA.x} ${link.controlA.y}, ${link.controlB.x} ${link.controlB.y}, ${link.end.x} ${link.end.y}`

  return (
    <g>
      <path
        className="graph-edge-hit"
        d={pathD}
        onPointerDown={(event) => onSelect(edge.id, event)}
      />
      <path
        className={`graph-edge${isSelected ? ' is-selected' : ''}`}
        d={pathD}
      />
    </g>
  )
})

type GraphNodeProps = {
  node: PersonNode
  isSelected: boolean
  tagColor: string | null
  showLabel: boolean
  onPointerDown: (node: PersonNode, event: ReactPointerEvent<HTMLButtonElement>) => void
  onClick: (node: PersonNode) => void
}

const GraphNodeCard = memo(function GraphNodeCard({
  node,
  isSelected,
  tagColor,
  showLabel,
  onPointerDown,
  onClick,
}: GraphNodeProps) {
  const nodeStyle = {
    transform: `translate(${node.x}px, ${node.y}px)`,
    ...(tagColor ? { '--node-color': tagColor } : {}),
  } as GraphNodeStyle

  return (
    <div
      className={`graph-node${node.is_root ? ' graph-node--root' : ''}${isSelected ? ' is-selected' : ''}`}
      style={nodeStyle}
    >
      <button
        type="button"
        className="graph-node__button"
        title={node.is_root ? 'Double click the board to create a person' : 'Drag to move'}
        onPointerDown={(event) => onPointerDown(node, event)}
        onClick={(event) => {
          event.stopPropagation()
          onClick(node)
        }}
      >
        <span className="graph-node__dot" />
        {showLabel ? (
          <span className="graph-node__label">
            {node.name.trim() || (node.is_root ? 'You' : 'Unnamed person')}
          </span>
        ) : null}
      </button>
    </div>
  )
})

function App() {
  const { session, status, error: authError, signInWithGoogle, signOut } = useAuth()
  const {
    board,
    people,
    tags,
    notes,
    personAiNotes,
    connections,
    status: graphStatus,
    error: graphError,
    createPerson: createRemotePerson,
    updatePerson: updateRemotePerson,
    movePerson: moveRemotePerson,
    deletePerson: deleteRemotePerson,
    createConnection: createRemoteConnection,
    deleteConnection: deleteRemoteConnection,
    createTag: createRemoteTag,
    deleteTag: deleteRemoteTag,
    updateTag: updateRemoteTag,
    createNote: createRemoteNote,
    updateNote: updateRemoteNote,
    deleteNote: deleteRemoteNote,
    refreshPersonAiNote,
    deleteCurrentGraphData,
    bulkCreatePeople: bulkCreateRemotePeople,
  } = useBoardGraph(session?.user ?? null)

  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    return savedTheme === 'dark' ? 'dark' : 'light'
  })
  const [zoomPercentage, setZoomPercentage] = useState(100)
  const [renderBounds, setRenderBounds] = useState<WorldBounds | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [inspectorNodeId, setInspectorNodeId] = useState<string | null>(null)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
  const [connectionMenuPosition, setConnectionMenuPosition] = useState<Offset | null>(null)
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDrag | null>(null)
  const [nodeDrag, setNodeDrag] = useState<NodeDrag | null>(null)
  const [draggedPositions, setDraggedPositions] = useState<Record<string, Offset>>({})
  const [nodeGroups, setNodeGroups] = useState<NodeGroup[]>([])
  const [multiSelectedNodeIds, setMultiSelectedNodeIds] = useState<string[]>([])
  const [areaSelection, setAreaSelection] = useState<AreaSelection | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false)
  const [activeTagOptionIndex, setActiveTagOptionIndex] = useState(0)
  const [isTagsMenuOpen, setIsTagsMenuOpen] = useState(false)
  const [isLinkedInMenuOpen, setIsLinkedInMenuOpen] = useState(false)
  const [isLinkedInGuideOpen, setIsLinkedInGuideOpen] = useState(false)
  const [isLinkedInUploadOpen, setIsLinkedInUploadOpen] = useState(false)
  const [isLinkedInDragActive, setIsLinkedInDragActive] = useState(false)
  const [linkedInImportStatus, setLinkedInImportStatus] = useState<LinkedInImportStatus>({
    state: 'idle',
    message: null,
  })
  const [linkedInImportOptions, setLinkedInImportOptions] = useState<LinkedInImportOptions>(
    DEFAULT_LINKEDIN_IMPORT_OPTIONS,
  )
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [activeColorTagId, setActiveColorTagId] = useState<string | null>(null)
  const [tagColorDrafts, setTagColorDrafts] = useState<Record<string, string>>(() =>
    loadTagColorDrafts(),
  )
  const [tagNameDrafts, setTagNameDrafts] = useState<Record<string, string>>({})
  const [hiddenTagIds, setHiddenTagIds] = useState<Record<string, boolean>>({})
  const [newNoteText, setNewNoteText] = useState('')
  const [noteDrafts, setNoteDrafts] = useState<Record<string, NoteDraft>>({})
  const [collapsedNotes, setCollapsedNotes] = useState<Record<string, boolean>>({})
  const [isDraggingBoard, setIsDraggingBoard] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [nameTagRange, setNameTagRange] = useState<TextRange | null>(null)
  const [aiSearchQuery, setAiSearchQuery] = useState('')
  const [aiSearchResults, setAiSearchResults] = useState<SearchResult[]>([])
  const [aiSearchStatus, setAiSearchStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [aiSearchError, setAiSearchError] = useState<string | null>(null)
  const [initialLocalGraph] = useState(() => loadLocalGraph())
  const [localPeople, setLocalPeople] = useState<PersonNode[]>(initialLocalGraph.people)
  const [localTags, setLocalTags] = useState<Tag[]>(initialLocalGraph.tags)
  const [localNotes, setLocalNotes] = useState<PersonNote[]>(initialLocalGraph.notes)
  const [localConnections, setLocalConnections] = useState<Connection[]>(initialLocalGraph.connections)

  const boardRef = useRef<HTMLElement | null>(null)
  const boardSurfaceRef = useRef<HTMLDivElement | null>(null)
  const graphCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const graphLayerRef = useRef<HTMLDivElement | null>(null)
  const tagsMenuRef = useRef<HTMLDivElement | null>(null)
  const linkedInMenuRef = useRef<HTMLDivElement | null>(null)
  const linkedInFileInputRef = useRef<HTMLInputElement | null>(null)
  const searchPanelRef = useRef<HTMLDivElement | null>(null)
  const accountPanelRef = useRef<HTMLDivElement | null>(null)
  const inspectorPanelRef = useRef<HTMLElement | null>(null)
  const zoomIndicatorRef = useRef<HTMLDivElement | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const tagTriggerRef = useRef<HTMLButtonElement | null>(null)
  const tagSearchInputRef = useRef<HTMLInputElement | null>(null)
  const newNoteTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const tagPickerMenuRef = useRef<HTMLDivElement | null>(null)
  const tagPickerOptionRefs = useRef<Array<HTMLDivElement | null>>([])
  const noteBodyRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})
  const inspectorWorldPositionRef = useRef<Offset | null>(null)
  const inspectorOpenScaleRef = useRef(1)
  const suppressNodeClickRef = useRef(false)
  const viewportRef = useRef({ offset: { x: 0, y: 0 }, scale: 1 })
  const renderBoundsRef = useRef<WorldBounds | null>(null)
  const graphCanvasFrameRef = useRef<number | null>(null)
  const graphCanvasDataRef = useRef<{
    nodes: PersonNode[]
    connections: Connection[]
    nodesById: Record<string, PersonNode>
    tagColorById: Record<string, string>
    theme: Theme
  }>({
    nodes: [],
    connections: [],
    nodesById: {},
    tagColorById: {},
    theme: 'light',
  })
  const pendingViewportRef = useRef<{ offset: Offset; scale: number } | null>(null)
  const viewportFrameRef = useRef<number | null>(null)
  const connectionDragStateRef = useRef<ConnectionDrag | null>(null)
  const nodeDragStateRef = useRef<NodeDrag | null>(null)
  const boardNodesRef = useRef<PersonNode[]>([])
  const nodeGroupsRef = useRef<NodeGroup[]>([])
  const draggedPositionsRef = useRef<Record<string, Offset>>({})
  const areaSelectionRef = useRef<AreaSelection | null>(null)
  const lastBoardTapRef = useRef<TapState | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const touchPointersRef = useRef(new Map<number, TouchPoint>())
  const pinchGestureRef = useRef<PinchGesture | null>(null)
  const visibleBoardNodesRef = useRef<PersonNode[]>([])
  const gestureScaleRef = useRef(1)
  const trackpadPanRef = useRef<{ active: boolean; timeoutId: number | null }>({
    active: false,
    timeoutId: null,
  })
  const boardDragRef = useRef({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    active: false,
    moved: false,
  })

  const isAuthenticated = status === 'authenticated' && Boolean(session?.user)
  const isRemoteGraphReady = isAuthenticated && graphStatus === 'ready' && Boolean(board)
  const activeBoard = isRemoteGraphReady ? board : ANONYMOUS_BOARD
  const activePeople = isRemoteGraphReady ? people : localPeople
  const activeTags = isRemoteGraphReady ? tags : localTags
  const activeNotes = isRemoteGraphReady ? notes : localNotes
  const activePersonAiNotes = useMemo(
    () => (isRemoteGraphReady ? personAiNotes : []),
    [isRemoteGraphReady, personAiNotes],
  )
  const activeConnections = isRemoteGraphReady ? connections : localConnections
  const activeBoardId = activeBoard?.id ?? ANONYMOUS_BOARD.id
  const isGraphReady = isRemoteGraphReady || !isAuthenticated
  const boardNodes = useMemo(
    () =>
      activePeople.map((node) => {
        const dragPosition = draggedPositions[node.id]
        return dragPosition ? { ...node, ...dragPosition } : node
      }),
    [activePeople, draggedPositions],
  )
  const boardConnections = useMemo(
    () => activeConnections,
    [activeConnections],
  )
  const nodesById = useMemo(
    () => Object.fromEntries(boardNodes.map((node) => [node.id, node])) as Record<string, PersonNode>,
    [boardNodes],
  )
  const tagMenuItems = useMemo<TagMenuItem[]>(
    () =>
      activeTags.map((tag) => ({
            id: tag.id,
            name: tag.name,
            color: normalizeTagColor(tagColorDrafts[tag.id] ?? tag.color ?? DEFAULT_TAG_COLOR),
            isPersisted: true,
          })),
    [activeTags, tagColorDrafts],
  )
  const tagColorById = useMemo(
    () =>
      Object.fromEntries(
        activeTags.map((tag) => [
          tag.id,
          normalizeTagColor(tagColorDrafts[tag.id] ?? tag.color ?? DEFAULT_TAG_COLOR),
        ]),
      ) as Record<string, string>,
    [activeTags, tagColorDrafts],
  )
  const visibleTagIds = useMemo(
    () => new Set(tagMenuItems.filter((tag) => !hiddenTagIds[tag.id]).map((tag) => tag.id)),
    [hiddenTagIds, tagMenuItems],
  )
  const areAllTagsVisible = useMemo(
    () => tagMenuItems.every((tag) => !hiddenTagIds[tag.id]),
    [hiddenTagIds, tagMenuItems],
  )
  const visibleBoardNodes = useMemo(
    () =>
      boardNodes.filter((node) => {
        if (node.is_root || !node.tag_id) return true
        return visibleTagIds.has(node.tag_id)
      }),
    [boardNodes, visibleTagIds],
  )
  const visibleNodesById = useMemo(
    () =>
      Object.fromEntries(visibleBoardNodes.map((node) => [node.id, node])) as Record<string, PersonNode>,
    [visibleBoardNodes],
  )
  const visibleBoardConnections = useMemo(
    () =>
      boardConnections.filter(
        (edge) => visibleNodesById[edge.person_a_id] && visibleNodesById[edge.person_b_id],
      ),
    [boardConnections, visibleNodesById],
  )
  const visibleNodeGroupBubbles = useMemo(
    () => getNodeGroupBubbles(nodeGroups, visibleBoardNodes),
    [nodeGroups, visibleBoardNodes],
  )
  const pinnedRenderNodeIds = useMemo(() => {
    const nodeIds = new Set<string>()

    if (selectedNodeId) nodeIds.add(selectedNodeId)
    if (inspectorNodeId) nodeIds.add(inspectorNodeId)
    if (connectionDrag?.fromId) nodeIds.add(connectionDrag.fromId)
    for (const nodeId of multiSelectedNodeIds) {
      nodeIds.add(nodeId)
    }

    return nodeIds
  }, [connectionDrag, inspectorNodeId, multiSelectedNodeIds, selectedNodeId])
  const renderedBoardNodes = useMemo(() => {
    const candidates = visibleBoardNodes.filter(
      (node) => node.is_root || pinnedRenderNodeIds.has(node.id) || isNodeInsideBounds(node, renderBounds),
    )

    if (candidates.length <= MAX_RENDERED_NODES) return candidates

    const pinnedNodes = candidates.filter((node) => node.is_root || pinnedRenderNodeIds.has(node.id))
    const pinnedIds = new Set(pinnedNodes.map((node) => node.id))
    const centerX = renderBounds?.centerX ?? 0
    const centerY = renderBounds?.centerY ?? 0
    const remainingSlots = Math.max(0, MAX_RENDERED_NODES - pinnedNodes.length)
    const nearestNodes = candidates
      .filter((node) => !pinnedIds.has(node.id))
      .sort((left, right) => {
        const leftDistance = Math.hypot(left.x - centerX, left.y - centerY)
        const rightDistance = Math.hypot(right.x - centerX, right.y - centerY)
        return leftDistance - rightDistance
      })
      .slice(0, remainingSlots)

    return [...pinnedNodes, ...nearestNodes]
  }, [pinnedRenderNodeIds, renderBounds, visibleBoardNodes])
  const renderedNodesById = useMemo(
    () => Object.fromEntries(renderedBoardNodes.map((node) => [node.id, node])) as Record<string, PersonNode>,
    [renderedBoardNodes],
  )
  const renderedBoardConnections = useMemo(() => {
    if (renderedBoardNodes.length > CONNECTION_NODE_LIMIT && !selectedConnectionId) return []

    const renderedConnections = visibleBoardConnections.filter(
      (edge) => renderedNodesById[edge.person_a_id] && renderedNodesById[edge.person_b_id],
    )

    if (renderedConnections.length <= MAX_RENDERED_CONNECTIONS) return renderedConnections

    const selectedConnection = selectedConnectionId
      ? renderedConnections.find((connection) => connection.id === selectedConnectionId) ?? null
      : null
    const cappedConnections = renderedConnections
      .filter((connection) => connection.id !== selectedConnectionId)
      .slice(0, selectedConnection ? MAX_RENDERED_CONNECTIONS - 1 : MAX_RENDERED_CONNECTIONS)

    return selectedConnection ? [selectedConnection, ...cappedConnections] : cappedConnections
  }, [renderedBoardNodes.length, renderedNodesById, selectedConnectionId, visibleBoardConnections])
  const shouldShowGraphLabels =
    (renderBounds?.scale ?? 1) >= LABEL_MIN_SCALE &&
    renderedBoardNodes.length <= LABEL_NODE_LIMIT
  const drawGraphCanvas = useCallback(() => {
    const canvas = graphCanvasRef.current
    const boardElement = boardRef.current
    if (!canvas || !boardElement) return

    const context = canvas.getContext('2d')
    if (!context) return

    const { nodes, connections, nodesById: canvasNodesById, tagColorById: canvasTagColorById, theme: canvasTheme } =
      graphCanvasDataRef.current
    const view = viewportRef.current
    const width = boardElement.clientWidth
    const height = boardElement.clientHeight
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    const canvasWidth = Math.max(1, Math.floor(width * pixelRatio))
    const canvasHeight = Math.max(1, Math.floor(height * pixelRatio))

    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth
      canvas.height = canvasHeight
    }

    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.clearRect(0, 0, width, height)

    if (nodes.length === 0) return

    const margin = 80
    const toScreen = (node: Pick<PersonNode, 'x' | 'y'>) => ({
      x: width / 2 + view.offset.x + node.x * view.scale,
      y: height / 2 + view.offset.y + node.y * view.scale,
    })
    const isOnScreen = (point: Offset) =>
      point.x >= -margin && point.x <= width + margin && point.y >= -margin && point.y <= height + margin
    const visibleNodeIds = new Set<string>()
    const visibleNodes: Array<{ node: PersonNode; screen: Offset }> = []

    for (const node of nodes) {
      const screen = toScreen(node)
      if (!isOnScreen(screen)) continue

      visibleNodeIds.add(node.id)
      visibleNodes.push({ node, screen })
    }

    if (visibleNodes.length === 0) return

    if (connections.length <= 20000 && view.scale >= 0.16) {
      context.beginPath()
      context.strokeStyle = canvasTheme === 'light' ? 'rgba(79, 124, 255, 0.16)' : 'rgba(138, 255, 214, 0.12)'
      context.lineWidth = Math.max(0.6, Math.min(1.2, view.scale))

      let drawnConnections = 0
      for (const connection of connections) {
        if (!visibleNodeIds.has(connection.person_a_id) && !visibleNodeIds.has(connection.person_b_id)) continue

        const fromNode = canvasNodesById[connection.person_a_id]
        const toNode = canvasNodesById[connection.person_b_id]
        if (!fromNode || !toNode) continue

        const from = toScreen(fromNode)
        const to = toScreen(toNode)
        if (!isOnScreen(from) && !isOnScreen(to)) continue

        context.moveTo(from.x, from.y)
        context.lineTo(to.x, to.y)
        drawnConnections += 1
        if (drawnConnections >= 12000) break
      }
      context.stroke()
    }

    const defaultFill = canvasTheme === 'light' ? 'rgba(79, 124, 255, 0.76)' : 'rgba(138, 255, 214, 0.72)'
    const radius = Math.max(1.2, Math.min(3.2, 2.4 * view.scale))

    for (const { node, screen } of visibleNodes) {
      context.beginPath()
      context.fillStyle = node.tag_id ? canvasTagColorById[node.tag_id] ?? defaultFill : defaultFill
      context.globalAlpha = node.is_root ? 0.95 : 0.76
      context.arc(screen.x, screen.y, node.is_root ? radius * 1.8 : radius, 0, Math.PI * 2)
      context.fill()
    }

    context.globalAlpha = 1
  }, [])

  const scheduleGraphCanvasDraw = useCallback(() => {
    if (graphCanvasFrameRef.current !== null) return

    graphCanvasFrameRef.current = window.requestAnimationFrame(() => {
      graphCanvasFrameRef.current = null
      drawGraphCanvas()
    })
  }, [drawGraphCanvas])
  const multiSelectedNodeIdSet = useMemo(() => new Set(multiSelectedNodeIds), [multiSelectedNodeIds])
  const isVeryDenseGraph = visibleBoardNodes.length >= 60
  const defaultSelectedNodeId =
    visibleBoardNodes.find((node) => node.is_root)?.id ?? visibleBoardNodes[0]?.id ?? null
  const activeSelectedNodeId =
    selectedNodeId && visibleNodesById[selectedNodeId] ? selectedNodeId : defaultSelectedNodeId

  const selectedNode = useMemo(() => {
    if (visibleBoardNodes.length === 0) return null
    if (activeSelectedNodeId) return visibleNodesById[activeSelectedNodeId] ?? null
    return null
  }, [activeSelectedNodeId, visibleBoardNodes.length, visibleNodesById])

  const inspectorNode = useMemo(() => {
    if (!inspectorNodeId) return null
    return visibleNodesById[inspectorNodeId] ?? null
  }, [inspectorNodeId, visibleNodesById])

  const inspectorNodeNotes = useMemo(
    () => activeNotes.filter((note) => note.person_id === inspectorNode?.id),
    [activeNotes, inspectorNode?.id],
  )
  const inspectorPersonAiNote = useMemo<PersonAiNote | null>(
    () => activePersonAiNotes.find((note) => note.person_id === inspectorNode?.id) ?? null,
    [activePersonAiNotes, inspectorNode?.id],
  )
  const tagsById = useMemo(
    () => Object.fromEntries(activeTags.map((tag) => [tag.id, tag])) as Record<string, Tag>,
    [activeTags],
  )
  const selectedInspectorTag = inspectorNode?.tag_id ? tagsById[inspectorNode.tag_id] ?? null : null
  const filteredInspectorTags = useMemo(() => {
    const normalizedDraft = tagDraft.trim().toLowerCase()
    if (!normalizedDraft) return activeTags

    return activeTags.filter((tag) => tag.name.toLowerCase().includes(normalizedDraft))
  }, [activeTags, tagDraft])
  const canCreateInspectorTag = useMemo(() => {
    const normalizedDraft = normalizeTagName(tagDraft)
    if (!normalizedDraft || !isGraphReady) return false

    return !activeTags.some((tag) => normalizeTagName(tag.name).toLowerCase() === normalizedDraft.toLowerCase())
  }, [activeTags, isGraphReady, tagDraft])
  const tagPickerOptions = useMemo<TagPickerOption[]>(() => {
    const nextOptions: TagPickerOption[] = []

    if (selectedInspectorTag) {
      nextOptions.push({
        id: 'clear',
        type: 'clear',
        label: 'No tag',
      })
    }

    nextOptions.push(
      ...filteredInspectorTags.map((tag) => ({
        id: tag.id,
        type: 'tag' as const,
        label: tag.name,
        tagId: tag.id,
        color: tagColorById[tag.id] ?? normalizeTagColor(tag.color ?? DEFAULT_TAG_COLOR),
      })),
    )

    if (canCreateInspectorTag) {
      nextOptions.push({
        id: 'create',
        type: 'create',
        label: `Create "${normalizeTagName(tagDraft)}"`,
      })
    }

    return nextOptions
  }, [canCreateInspectorTag, filteredInspectorTags, selectedInspectorTag, tagColorById, tagDraft])
  const notesByPersonId = useMemo(() => {
    const nextNotesByPersonId: Record<string, PersonNote[]> = {}

    for (const note of activeNotes) {
      if (!nextNotesByPersonId[note.person_id]) {
        nextNotesByPersonId[note.person_id] = []
      }
      nextNotesByPersonId[note.person_id].push(note)
    }

    return nextNotesByPersonId
  }, [activeNotes])
  const searchResults: SearchResult[] = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (!normalizedQuery) return []

    return activePeople
      .map((node) => {
        const matches: string[] = []
        let score = 0
        const tagName = node.tag_id ? tagsById[node.tag_id]?.name ?? '' : ''
        const personNotes = notesByPersonId[node.id] ?? []
        const normalizedName = node.name.trim().toLowerCase()
        const normalizedTag = tagName.toLowerCase()

        if (normalizedName.includes(normalizedQuery)) {
          matches.push(`Name: ${node.name.trim() || 'Unnamed person'}`)
          score += normalizedName.startsWith(normalizedQuery) ? 6 : 4
        }

        if (normalizedTag.includes(normalizedQuery)) {
          matches.push(`Tag: ${tagName}`)
          score += normalizedTag.startsWith(normalizedQuery) ? 4 : 3
        }

        for (const note of personNotes) {
          const normalizedTitle = note.title.toLowerCase()
          const normalizedBody = note.body.toLowerCase()

          if (normalizedTitle.includes(normalizedQuery)) {
            matches.push(`Note title: ${note.title || 'Untitled note'}`)
            score += 2
            continue
          }

          if (normalizedBody.includes(normalizedQuery)) {
            matches.push(`Note: ${note.body.trim().slice(0, 48) || 'Body match'}`)
            score += 1
          }
        }

        return {
          node,
          score,
          matches: Array.from(new Set(matches)).slice(0, 3),
          source: 'local' as const,
        }
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score
        return (left.node.name || '').localeCompare(right.node.name || '')
      })
      .slice(0, 8)
  }, [activePeople, notesByPersonId, searchQuery, tagsById])
  const aiSearchCandidateIds = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    if (!normalizedQuery) {
      return activePeople
        .slice()
        .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
        .slice(0, AI_SEARCH_CANDIDATE_LIMIT)
        .map((node) => node.id)
    }

    const scoredPeople = activePeople.map((node) => {
      let score = 0
      const tagName = node.tag_id ? tagsById[node.tag_id]?.name ?? '' : ''
      const personNotes = notesByPersonId[node.id] ?? []
      const normalizedName = node.name.trim().toLowerCase()
      const normalizedTag = tagName.toLowerCase()

      if (normalizedName.includes(normalizedQuery)) {
        score += normalizedName.startsWith(normalizedQuery) ? 8 : 5
      }

      if (normalizedTag.includes(normalizedQuery)) {
        score += normalizedTag.startsWith(normalizedQuery) ? 5 : 3
      }

      for (const note of personNotes) {
        const normalizedTitle = note.title.toLowerCase()
        const normalizedBody = note.body.toLowerCase()

        if (normalizedTitle.includes(normalizedQuery)) score += 2
        if (normalizedBody.includes(normalizedQuery)) score += 1
      }

      return { node, score }
    })

    const matches = scoredPeople
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score
        return right.node.updated_at.localeCompare(left.node.updated_at)
      })

    const fallback = scoredPeople
      .filter((entry) => entry.score === 0)
      .sort((left, right) => right.node.updated_at.localeCompare(left.node.updated_at))

    return [...matches, ...fallback]
      .slice(0, AI_SEARCH_CANDIDATE_LIMIT)
      .map((entry) => entry.node.id)
  }, [activePeople, notesByPersonId, searchQuery, tagsById])
  const visibleSearchResults = aiSearchQuery === searchQuery.trim() ? aiSearchResults : searchResults

  const error = authError ?? graphError

  const createPerson = useCallback(async (input: { name: string; tagId?: string | null; x: number; y: number }) => {
    if (isRemoteGraphReady) {
      return createRemotePerson(input)
    }

    const timestamp = new Date().toISOString()
    const person: PersonNode = {
      id: createLocalId('local-person'),
      board_id: ANONYMOUS_BOARD.id,
      owner_user_id: ANONYMOUS_BOARD.user_id,
      name: input.name,
      tag_id: input.tagId ?? null,
      x: input.x,
      y: input.y,
      is_root: false,
      created_at: timestamp,
      updated_at: timestamp,
    }
    setLocalPeople((currentPeople) => [...currentPeople, person])
    return person
  }, [createRemotePerson, isRemoteGraphReady])

  const updatePerson = useCallback(async (input: { id: string; name?: string; tag_id?: string | null }) => {
    if (isRemoteGraphReady) {
      return updateRemotePerson(input)
    }

    const timestamp = new Date().toISOString()
    const existingPerson = localPeople.find((person) => person.id === input.id)
    if (!existingPerson) throw new Error('Person was not found.')

    const updatedPerson = {
      ...existingPerson,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.tag_id !== undefined ? { tag_id: input.tag_id } : {}),
      updated_at: timestamp,
    }
    setLocalPeople((currentPeople) =>
      currentPeople.map((person) => (person.id === input.id ? updatedPerson : person)),
    )

    return updatedPerson
  }, [isRemoteGraphReady, localPeople, updateRemotePerson])

  const movePerson = useCallback(async (id: string, x: number, y: number) => {
    if (isRemoteGraphReady) {
      return moveRemotePerson(id, x, y)
    }

    const timestamp = new Date().toISOString()
    const existingPerson = localPeople.find((person) => person.id === id && !person.is_root)
    if (!existingPerson) throw new Error('Person was not found.')

    const updatedPerson = {
      ...existingPerson,
      x,
      y,
      updated_at: timestamp,
    }
    setLocalPeople((currentPeople) =>
      currentPeople.map((person) => (person.id === id && !person.is_root ? updatedPerson : person)),
    )

    return updatedPerson
  }, [isRemoteGraphReady, localPeople, moveRemotePerson])

  const deletePerson = useCallback(async (id: string) => {
    if (isRemoteGraphReady) {
      return deleteRemotePerson(id)
    }

    setLocalPeople((currentPeople) => currentPeople.filter((person) => person.id !== id || person.is_root))
    setLocalNotes((currentNotes) => currentNotes.filter((note) => note.person_id !== id))
    setLocalConnections((currentConnections) =>
      currentConnections.filter((connection) => connection.person_a_id !== id && connection.person_b_id !== id),
    )
  }, [deleteRemotePerson, isRemoteGraphReady])

  const createConnection = useCallback(async (firstPersonId: string, secondPersonId: string) => {
    if (isRemoteGraphReady) {
      return createRemoteConnection(firstPersonId, secondPersonId)
    }

    if (firstPersonId === secondPersonId) {
      throw new Error('Cannot connect a person to themselves.')
    }

    const [personAId, personBId] =
      firstPersonId < secondPersonId ? [firstPersonId, secondPersonId] : [secondPersonId, firstPersonId]
    const existingConnection = localConnections.find(
      (connection) => connection.person_a_id === personAId && connection.person_b_id === personBId,
    )
    if (existingConnection) return existingConnection

    const connection: Connection = {
      id: createLocalId('local-connection'),
      board_id: ANONYMOUS_BOARD.id,
      owner_user_id: ANONYMOUS_BOARD.user_id,
      person_a_id: personAId,
      person_b_id: personBId,
      created_at: new Date().toISOString(),
    }
    setLocalConnections((currentConnections) => [...currentConnections, connection])
    return connection
  }, [createRemoteConnection, isRemoteGraphReady, localConnections])

  const deleteConnection = useCallback(async (id: string) => {
    if (isRemoteGraphReady) {
      return deleteRemoteConnection(id)
    }

    setLocalConnections((currentConnections) => currentConnections.filter((connection) => connection.id !== id))
  }, [deleteRemoteConnection, isRemoteGraphReady])

  async function createTag(name: string) {
    if (isRemoteGraphReady) {
      return createRemoteTag(name)
    }

    const normalizedName = normalizeTagName(name)
    const existingTag = localTags.find(
      (tag) => normalizeTagName(tag.name).toLowerCase() === normalizedName.toLowerCase(),
    )
    if (existingTag) return existingTag

    const timestamp = new Date().toISOString()
    const tag: Tag = {
      id: createLocalId('local-tag'),
      user_id: ANONYMOUS_BOARD.user_id,
      name: normalizedName,
      normalized_name: normalizedName.toLowerCase(),
      color: DEFAULT_TAG_COLOR,
      created_at: timestamp,
      updated_at: timestamp,
    }
    setLocalTags((currentTags) => [...currentTags, tag])
    return tag
  }

  async function updateTag(input: { id: string; name?: string; color?: string }) {
    if (isRemoteGraphReady) {
      return updateRemoteTag(input)
    }

    const timestamp = new Date().toISOString()
    let updatedTag: Tag | null = null
    setLocalTags((currentTags) =>
      currentTags.map((tag) => {
        if (tag.id !== input.id) return tag

        const nextName = input.name !== undefined ? normalizeTagName(input.name) : tag.name
        updatedTag = {
          ...tag,
          name: nextName,
          normalized_name: normalizeTagName(nextName).toLowerCase(),
          ...(input.color !== undefined ? { color: normalizeTagColor(input.color) } : {}),
          updated_at: timestamp,
        }
        return updatedTag
      }),
    )

    if (!updatedTag) throw new Error('Tag was not found.')
    return updatedTag
  }

  async function deleteTag(id: string) {
    if (isRemoteGraphReady) {
      return deleteRemoteTag(id)
    }

    setLocalTags((currentTags) => currentTags.filter((tag) => tag.id !== id))
    setLocalPeople((currentPeople) =>
      currentPeople.map((person) => (person.tag_id === id ? { ...person, tag_id: null } : person)),
    )
  }

  async function createNote(
    title: string,
    body: string,
    personId: string,
    options?: { syncAi?: boolean },
  ) {
    if (isRemoteGraphReady) {
      return createRemoteNote(title, body, personId, options)
    }

    const timestamp = new Date().toISOString()
    const note: PersonNote = {
      id: createLocalId('local-note'),
      person_id: personId,
      owner_user_id: ANONYMOUS_BOARD.user_id,
      title,
      body,
      created_at: timestamp,
      updated_at: timestamp,
    }
    setLocalNotes((currentNotes) => [...currentNotes, note])
    return note
  }

  async function updateNote(input: { id: string; title?: string; body?: string }) {
    if (isRemoteGraphReady) {
      return updateRemoteNote(input)
    }

    const timestamp = new Date().toISOString()
    let updatedNote: PersonNote | null = null
    setLocalNotes((currentNotes) =>
      currentNotes.map((note) => {
        if (note.id !== input.id) return note

        updatedNote = {
          ...note,
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
          updated_at: timestamp,
        }
        return updatedNote
      }),
    )

    if (!updatedNote) throw new Error('Note was not found.')
    return updatedNote
  }

  async function deleteNote(id: string) {
    if (isRemoteGraphReady) {
      return deleteRemoteNote(id)
    }

    setLocalNotes((currentNotes) => currentNotes.filter((note) => note.id !== id))
  }

  useEffect(() => {
    connectionDragStateRef.current = connectionDrag
  }, [connectionDrag])

  useEffect(() => {
    nodeDragStateRef.current = nodeDrag
  }, [nodeDrag])

  useEffect(() => {
    boardNodesRef.current = boardNodes
  }, [boardNodes])

  useEffect(() => {
    nodeGroupsRef.current = nodeGroups
  }, [nodeGroups])

  useEffect(() => {
    draggedPositionsRef.current = draggedPositions
  }, [draggedPositions])

  useEffect(() => {
    areaSelectionRef.current = areaSelection
  }, [areaSelection])

  useEffect(() => {
    if (isRemoteGraphReady) return

    saveLocalGraph({
      people: localPeople,
      tags: localTags,
      notes: localNotes,
      connections: localConnections,
    })
  }, [isRemoteGraphReady, localConnections, localNotes, localPeople, localTags])

  useEffect(() => {
    visibleBoardNodesRef.current = renderedBoardNodes
  }, [renderedBoardNodes])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const loadedGroups = sanitizeNodeGroups(loadNodeGroups(activeBoardId), activeBoardId, boardNodesRef.current)
      nodeGroupsRef.current = loadedGroups
      setNodeGroups(loadedGroups)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [activeBoardId])

  useEffect(() => {
    setNodeGroups((currentGroups) => {
      const nextGroups = sanitizeNodeGroups(currentGroups, activeBoardId, boardNodes)
      if (JSON.stringify(nextGroups) === JSON.stringify(currentGroups)) {
        saveNodeGroups(activeBoardId, currentGroups)
        return currentGroups
      }

      nodeGroupsRef.current = nextGroups
      saveNodeGroups(activeBoardId, nextGroups)
      return nextGroups
    })
  }, [activeBoardId, boardNodes])

  useEffect(() => {
    graphCanvasDataRef.current = {
      nodes: visibleBoardNodes,
      connections: visibleBoardConnections,
      nodesById,
      tagColorById,
      theme,
    }
    scheduleGraphCanvasDraw()
  }, [nodesById, scheduleGraphCanvasDraw, tagColorById, theme, visibleBoardConnections, visibleBoardNodes])

  const closeInspectorUi = useCallback(() => {
    setInspectorNodeId(null)
    setSelectedConnectionId(null)
    setConnectionMenuPosition(null)
    setIsTagPickerOpen(false)
    setActiveTagOptionIndex(0)
  }, [])

  const closeTransientUi = useCallback(() => {
    setIsTagsMenuOpen(false)
    setIsLinkedInMenuOpen(false)
    setIsAccountMenuOpen(false)
    setIsSearchOpen(false)
    setIsTagPickerOpen(false)
    setActiveColorTagId(null)
    setActiveTagOptionIndex(0)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return

      const isInsideTopBar =
        tagsMenuRef.current?.contains(target) ||
        linkedInMenuRef.current?.contains(target) ||
        searchPanelRef.current?.contains(target) ||
        accountPanelRef.current?.contains(target)

      if (!isInsideTopBar) {
        closeTransientUi()
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [closeTransientUi])

  useEffect(() => {
    if (!isTagPickerOpen) return

    const menu = tagPickerMenuRef.current
    const activeOption = tagPickerOptionRefs.current[activeTagOptionIndex]
    if (!menu || !activeOption) return

    const optionTop = activeOption.offsetTop
    const optionBottom = optionTop + activeOption.offsetHeight
    const visibleTop = menu.scrollTop
    const visibleBottom = visibleTop + menu.clientHeight

    if (optionTop < visibleTop) {
      menu.scrollTop = optionTop
      return
    }

    if (optionBottom > visibleBottom) {
      menu.scrollTop = optionBottom - menu.clientHeight
    }
  }, [activeTagOptionIndex, isTagPickerOpen, tagPickerOptions.length])
  const applyViewport = useCallback((nextOffset: Offset, nextScale: number) => {
    viewportRef.current = { offset: nextOffset, scale: nextScale }
    const boardElement = boardRef.current

    if (boardSurfaceRef.current) {
      const viewportWidth = boardElement?.clientWidth ?? 0
      const viewportHeight = boardElement?.clientHeight ?? 0
      const gridOriginX = viewportWidth / 2 + nextOffset.x
      const gridOriginY = viewportHeight / 2 + nextOffset.y

      boardSurfaceRef.current.style.setProperty('--dot-gap', `${GRID_GAP * nextScale}px`)
      boardSurfaceRef.current.style.setProperty('--major-dot-gap', `${MAJOR_GRID_GAP * nextScale}px`)
      boardSurfaceRef.current.style.setProperty('--dot-size', `${Math.max(0.45, DOT_SIZE * nextScale)}px`)
      boardSurfaceRef.current.style.setProperty(
        '--major-dot-size',
        `${Math.max(1.5, MAJOR_DOT_SIZE * nextScale)}px`,
      )
      boardSurfaceRef.current.style.setProperty('--board-offset-x', `${gridOriginX}px`)
      boardSurfaceRef.current.style.setProperty('--board-offset-y', `${gridOriginY}px`)
    }

    if (graphLayerRef.current) {
      graphLayerRef.current.style.transform = `translate(${nextOffset.x}px, ${nextOffset.y}px) scale(${nextScale})`
    }

    if (inspectorPanelRef.current && inspectorWorldPositionRef.current) {
      const viewportWidth = boardRef.current?.clientWidth ?? window.innerWidth
      const viewportHeight = boardRef.current?.clientHeight ?? window.innerHeight
      const inspectorScale = nextScale / inspectorOpenScaleRef.current
      const inspectorX =
        viewportWidth / 2 + nextOffset.x + inspectorWorldPositionRef.current.x * nextScale
      const inspectorY =
        viewportHeight / 2 + nextOffset.y + inspectorWorldPositionRef.current.y * nextScale

      inspectorPanelRef.current.style.left = `${inspectorX}px`
      inspectorPanelRef.current.style.top = `${inspectorY}px`
      inspectorPanelRef.current.style.setProperty('--inspector-scale', `${inspectorScale}`)
    }

    const nextZoomPercentage = Math.round(nextScale * 100)
    if (zoomIndicatorRef.current) {
      zoomIndicatorRef.current.textContent = `${nextZoomPercentage}%`
    }
    setZoomPercentage((currentZoomPercentage) =>
      currentZoomPercentage === nextZoomPercentage ? currentZoomPercentage : nextZoomPercentage,
    )

    if (boardElement) {
      const nextRenderBounds = getViewportRenderBounds(boardElement, nextOffset, nextScale)

      if (shouldUpdateRenderBounds(renderBoundsRef.current, nextRenderBounds)) {
        renderBoundsRef.current = nextRenderBounds
        setRenderBounds(nextRenderBounds)
      }
    }

    scheduleGraphCanvasDraw()
  }, [scheduleGraphCanvasDraw])

  const queueViewportUpdate = useCallback(
    (nextOffset: Offset, nextScale: number) => {
      pendingViewportRef.current = { offset: nextOffset, scale: nextScale }

      if (viewportFrameRef.current !== null) return

      viewportFrameRef.current = window.requestAnimationFrame(() => {
        viewportFrameRef.current = null

        const pendingViewport = pendingViewportRef.current
        if (!pendingViewport) return

        pendingViewportRef.current = null
        applyViewport(pendingViewport.offset, pendingViewport.scale)
      })
    },
    [applyViewport],
  )

  const keepInspectorInView = useCallback(() => {
    const boardElement = boardRef.current
    const inspectorElement = inspectorPanelRef.current
    const inspectorPosition = inspectorWorldPositionRef.current
    if (!boardElement || !inspectorElement || !inspectorPosition) return

    const view = viewportRef.current
    const viewportWidth = boardElement.clientWidth
    const viewportHeight = boardElement.clientHeight
    const panelBounds = inspectorElement.getBoundingClientRect()
    const panelWidth = panelBounds.width
    const panelHeight = panelBounds.height
    const currentAnchorX = viewportWidth / 2 + view.offset.x + inspectorPosition.x * view.scale
    const currentAnchorY = viewportHeight / 2 + view.offset.y + inspectorPosition.y * view.scale
    const minAnchorX = INSPECTOR_VIEWPORT_MARGIN + INSPECTOR_ANCHOR_GAP + panelWidth
    const maxAnchorX = viewportWidth - INSPECTOR_VIEWPORT_MARGIN + INSPECTOR_ANCHOR_GAP
    const minAnchorY = INSPECTOR_VIEWPORT_MARGIN + panelHeight / 2
    const maxAnchorY = viewportHeight - INSPECTOR_VIEWPORT_MARGIN - panelHeight / 2
    const nextAnchorX =
      minAnchorX > maxAnchorX
        ? viewportWidth - INSPECTOR_VIEWPORT_MARGIN + INSPECTOR_ANCHOR_GAP
        : clamp(currentAnchorX, minAnchorX, maxAnchorX)
    const nextAnchorY =
      minAnchorY > maxAnchorY ? viewportHeight / 2 : clamp(currentAnchorY, minAnchorY, maxAnchorY)
    const deltaX = nextAnchorX - currentAnchorX
    const deltaY = nextAnchorY - currentAnchorY

    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return

    queueViewportUpdate(
      {
        x: view.offset.x + deltaX,
        y: view.offset.y + deltaY,
      },
      view.scale,
    )
  }, [queueViewportUpdate])

  useEffect(() => {
    applyViewport(viewportRef.current.offset, viewportRef.current.scale)
    const trackpadPan = trackpadPanRef.current

    return () => {
      if (viewportFrameRef.current !== null) {
        window.cancelAnimationFrame(viewportFrameRef.current)
      }
      if (graphCanvasFrameRef.current !== null) {
        window.cancelAnimationFrame(graphCanvasFrameRef.current)
      }
      if (trackpadPan.timeoutId !== null) {
        window.clearTimeout(trackpadPan.timeoutId)
      }
    }
  }, [applyViewport])

  useEffect(() => {
    const handleResize = () => {
      applyViewport(viewportRef.current.offset, viewportRef.current.scale)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [applyViewport])

  useEffect(() => {
    inspectorWorldPositionRef.current = inspectorNode
      ? {
          x: inspectorNode.x,
          y: inspectorNode.y,
        }
      : null

    applyViewport(viewportRef.current.offset, viewportRef.current.scale)

    if (!inspectorNode) return undefined

    const frameId = window.requestAnimationFrame(() => {
      keepInspectorInView()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [applyViewport, inspectorNode, keepInspectorInView])

  useEffect(() => {
    if (!inspectorNode) return undefined

    const frameId = window.requestAnimationFrame(() => {
      if (!inspectorNode.name.trim()) {
        nameInputRef.current?.focus()
        nameInputRef.current?.select()
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [inspectorNode])

  useEffect(() => {
    if (!isTagPickerOpen) return

    const frameId = window.requestAnimationFrame(() => {
      if (nameTagRange) return
      tagSearchInputRef.current?.focus()
      tagSearchInputRef.current?.select()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isTagPickerOpen, nameTagRange])

  const zoomAtClientPoint = useCallback(
    (clientX: number, clientY: number, nextScale: number) => {
      const viewport = boardRef.current
      if (!viewport) return

      const view = viewportRef.current
      const clampedScale = clampScale(nextScale)

      if (clampedScale === view.scale) return

      const { left, top } = viewport.getBoundingClientRect()
      const pointerX = clientX - left
      const pointerY = clientY - top
      const centerX = viewport.clientWidth / 2
      const centerY = viewport.clientHeight / 2
      const worldX = (pointerX - centerX - view.offset.x) / view.scale
      const worldY = (pointerY - centerY - view.offset.y) / view.scale

      queueViewportUpdate(
        {
          x: pointerX - centerX - worldX * clampedScale,
          y: pointerY - centerY - worldY * clampedScale,
        },
        clampedScale,
      )
    },
    [queueViewportUpdate],
  )

  const cancelActiveDragForPinch = useCallback(() => {
    boardDragRef.current.active = false
    activePointerIdRef.current = null
    areaSelectionRef.current = null
    connectionDragStateRef.current = null
    nodeDragStateRef.current = null
    draggedPositionsRef.current = {}

    setIsDraggingBoard(false)
    setAreaSelection(null)
    setConnectionDrag(null)
    setNodeDrag(null)
    setDraggedPositions({})
  }, [])

  const getTouchPointPair = useCallback((gesture: Pick<PinchGesture, 'firstPointerId' | 'secondPointerId'>) => {
    const firstPoint = touchPointersRef.current.get(gesture.firstPointerId)
    const secondPoint = touchPointersRef.current.get(gesture.secondPointerId)

    if (!firstPoint || !secondPoint) return null

    return {
      midpoint: {
        x: (firstPoint.clientX + secondPoint.clientX) / 2,
        y: (firstPoint.clientY + secondPoint.clientY) / 2,
      },
      distance: Math.hypot(firstPoint.clientX - secondPoint.clientX, firstPoint.clientY - secondPoint.clientY),
    }
  }, [])

  const beginTouchPinch = useCallback(() => {
    const viewport = boardRef.current
    if (!viewport || touchPointersRef.current.size < 2) return false

    const [firstPointerId, secondPointerId] = Array.from(touchPointersRef.current.keys()).slice(-2)
    const pair = getTouchPointPair({ firstPointerId, secondPointerId })
    if (!pair || pair.distance < 4) return false

    cancelActiveDragForPinch()
    closeTransientUi()

    pinchGestureRef.current = {
      firstPointerId,
      secondPointerId,
      previousDistance: pair.distance,
      previousMidpoint: pair.midpoint,
    }

    setSelectedConnectionId(null)
    setConnectionMenuPosition(null)
    return true
  }, [cancelActiveDragForPinch, closeTransientUi, getTouchPointPair])

  const updateTouchPinch = useCallback(() => {
    const viewport = boardRef.current
    const gesture = pinchGestureRef.current
    if (!viewport || !gesture) return false

    const pair = getTouchPointPair(gesture)
    if (!pair || pair.distance < 4) return false

    const { left, top } = viewport.getBoundingClientRect()
    const previousMidpointX = gesture.previousMidpoint.x - left
    const previousMidpointY = gesture.previousMidpoint.y - top
    const currentMidpointX = pair.midpoint.x - left
    const currentMidpointY = pair.midpoint.y - top
    const centerX = viewport.clientWidth / 2
    const centerY = viewport.clientHeight / 2
    const view = pendingViewportRef.current ?? viewportRef.current
    const rawScaleDelta = pair.distance / gesture.previousDistance
    const scaleDelta = clamp(rawScaleDelta, 0.86, 1.16)
    const nextScale = clampScale(view.scale * scaleDelta)
    const worldX = (previousMidpointX - centerX - view.offset.x) / view.scale
    const worldY = (previousMidpointY - centerY - view.offset.y) / view.scale

    queueViewportUpdate(
      {
        x: currentMidpointX - centerX - worldX * nextScale,
        y: currentMidpointY - centerY - worldY * nextScale,
      },
      nextScale,
    )

    pinchGestureRef.current = {
      ...gesture,
      previousDistance: pair.distance,
      previousMidpoint: pair.midpoint,
    }

    return true
  }, [getTouchPointPair, queueViewportUpdate])

  const openInspectorForNode = useCallback((node: PersonNode) => {
    inspectorOpenScaleRef.current = viewportRef.current.scale
    setInspectorNodeId(node.id)
    setSelectedNodeId(node.id)
    setSelectedConnectionId(null)
    setConnectionMenuPosition(null)
    setNameDraft(node.name)
    setTagDraft('')
    setNameTagRange(null)
    setNewNoteText('')
    closeTransientUi()
  }, [closeTransientUi])

  const applyNodeGroup = useCallback((group: NodeGroup) => {
    setNodeGroups((currentGroups) => {
      const groupMemberIds = new Set(group.memberIds)
      const nextGroups = sanitizeNodeGroups(
        [
          ...currentGroups
            .filter((currentGroup) => currentGroup.id !== group.id)
            .map((currentGroup) => ({
              ...currentGroup,
              memberIds: currentGroup.memberIds.filter((memberId) => !groupMemberIds.has(memberId)),
            })),
          group,
        ],
        activeBoardId,
        boardNodesRef.current,
      )
      nodeGroupsRef.current = nextGroups
      saveNodeGroups(activeBoardId, nextGroups)
      return nextGroups
    })
  }, [activeBoardId])

  const addNodesToGroup = useCallback(
    async (memberIds: string[], targetNode: PersonNode, existingGroup: NodeGroup | null = null) => {
      if (memberIds.length === 0) return false

      const currentNodes = boardNodesRef.current
      const currentGroups = nodeGroupsRef.current
      const targetGroup = existingGroup ?? getNodeGroupForNode(currentGroups, targetNode.id)
      const currentMemberIds = targetGroup?.memberIds ?? [targetNode.id]
      const nextMemberIds = Array.from(new Set([...currentMemberIds, ...memberIds]))
      if (nextMemberIds.length < 2) return false

      const nextGroup: NodeGroup = {
        id: targetGroup?.id ?? createLocalId('node-group'),
        boardId: activeBoardId,
        memberIds: nextMemberIds,
        color: targetGroup?.color ?? getNodeDisplayColor(targetNode, tagColorById),
        createdAt: targetGroup?.createdAt ?? new Date().toISOString(),
      }
      const nextPositions = arrangeGroupMembers(currentNodes, nextMemberIds)
      if (nextPositions.size === 0) return false

      applyNodeGroup(nextGroup)

      await Promise.all(
        Array.from(nextPositions.entries()).map(([nodeId, position]) => {
          const node = currentNodes.find((candidateNode) => candidateNode.id === nodeId)
          if (!node || node.is_root) return Promise.resolve()
          return movePerson(nodeId, position.x, position.y)
        }),
      )
      return true
    },
    [activeBoardId, applyNodeGroup, movePerson, tagColorById],
  )

  const addNodeToContainingGroup = useCallback(
    async (nodeId: string, point: Offset) => {
      const currentNodes = boardNodesRef.current
      const currentGroups = nodeGroupsRef.current
      const groupBubbles = getNodeGroupBubbles(currentGroups, currentNodes)
      const targetBubble = groupBubbles.find((bubble) => isPointTouchingPolygon(point, bubble.hull, NODE_RADIUS))
      if (!targetBubble) return false

      const targetGroup = currentGroups.find((group) => group.id === targetBubble.id) ?? null
      const targetNode = targetGroup
        ? currentNodes.find((node) => node.id === targetGroup.memberIds[0]) ?? null
        : null
      if (!targetNode) return false

      return addNodesToGroup([nodeId], targetNode, targetGroup)
    },
    [addNodesToGroup],
  )

  const createPersonAtClientPoint = useCallback(
    async (clientX: number, clientY: number) => {
      if (!isGraphReady) return

      const view = viewportRef.current
      const worldPoint = screenToWorld(clientX, clientY, boardRef.current, view.offset, view.scale)
      if (!worldPoint) return

      const createdNode = await createPerson({
        name: '',
        tagId: null,
        x: worldPoint.x,
        y: worldPoint.y,
      })
      boardNodesRef.current = [...boardNodesRef.current, createdNode]
      await addNodeToContainingGroup(createdNode.id, worldPoint)
      openInspectorForNode(createdNode)
    },
    [addNodeToContainingGroup, createPerson, isGraphReady, openInspectorForNode],
  )

  const finishNodeGroupDrop = useCallback(
    async (currentNodeDrag: NodeDrag) => {
      const draggedNodeIds = currentNodeDrag.nodeIds.filter((nodeId) => {
        const node = boardNodesRef.current.find((candidateNode) => candidateNode.id === nodeId)
        return node && !node.is_root
      })
      if (draggedNodeIds.length === 0) return false

      const currentNodes = boardNodesRef.current
      const draggedIdSet = new Set(draggedNodeIds)
      const draggedPositions = getDraggedNodePositions(currentNodeDrag, draggedPositionsRef.current)
      const draggedCenter = getNodeDragCenter(draggedNodeIds, draggedPositions)
      if (!draggedCenter) return false
      const draggedPoints = draggedNodeIds.map((nodeId) => draggedPositions[nodeId]).filter(Boolean) as Offset[]

      const currentGroups = nodeGroupsRef.current
      const candidateGroupNodes = currentNodes.filter((node) => !draggedIdSet.has(node.id))
      const groupBubbles = getNodeGroupBubbles(currentGroups, candidateGroupNodes)
      const targetBubble = groupBubbles.find((bubble) =>
        draggedPoints.some((point) => isPointTouchingPolygon(point, bubble.hull, NODE_RADIUS)),
      )
      if (targetBubble) {
        const targetGroup = currentGroups.find((group) => group.id === targetBubble.id) ?? null
        const targetMemberId = targetGroup?.memberIds.find((memberId) => !draggedIdSet.has(memberId))
        const targetNode = targetMemberId ? currentNodes.find((node) => node.id === targetMemberId) ?? null : null
        if (targetNode) {
          return addNodesToGroup(draggedNodeIds, targetNode, targetGroup)
        }
      }

      const targetNode = currentNodes
        .filter((node) => !node.is_root && !draggedIdSet.has(node.id))
        .map((node) => ({ node, distance: Math.hypot(node.x - draggedCenter.x, node.y - draggedCenter.y) }))
        .filter(({ distance }) => distance <= GROUP_DROP_DISTANCE)
        .sort((left, right) => left.distance - right.distance)[0]?.node ?? null

      if (targetNode) {
        if (getNodeGroupForNode(currentGroups, targetNode.id)) return false
        return addNodesToGroup(draggedNodeIds, targetNode)
      }

      if (draggedNodeIds.length === 1) {
        return addNodeToContainingGroup(draggedNodeIds[0], draggedCenter)
      }

      return false
    },
    [addNodeToContainingGroup, addNodesToGroup],
  )

  const finishConnectionDrag = useCallback(
    async (clientX: number, clientY: number) => {
      if (!connectionDrag || !isGraphReady) {
        setConnectionDrag(null)
        return
      }

      const distance = Math.hypot(
        clientX - connectionDrag.startClientX,
        clientY - connectionDrag.startClientY,
      )

      if (distance < CONNECTION_CREATE_THRESHOLD) {
        setConnectionDrag(null)
        return
      }

      const targetNode = boardNodes.find((node) => {
        if (node.id === connectionDrag.fromId) return false

        const distanceToNode = Math.hypot(
          node.x - connectionDrag.worldX,
          node.y - connectionDrag.worldY,
        )
        return distanceToNode <= NODE_HIT_RADIUS / viewportRef.current.scale
      })

      try {
        if (targetNode) {
          await createConnection(connectionDrag.fromId, targetNode.id)
          setSelectedNodeId(targetNode.id)
          setInspectorNodeId(null)
          setConnectionDrag(null)
          return
        }

        const createdNode = await createPerson({
          name: '',
          tagId: null,
          x: connectionDrag.worldX,
          y: connectionDrag.worldY,
        })
        await createConnection(connectionDrag.fromId, createdNode.id)
        openInspectorForNode(createdNode)
      } finally {
        setConnectionDrag(null)
      }
    },
    [boardNodes, connectionDrag, createConnection, createPerson, isGraphReady, openInspectorForNode],
  )

  useEffect(() => {
    const touchPointers = touchPointersRef.current

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        touchPointers.set(event.pointerId, {
          clientX: event.clientX,
          clientY: event.clientY,
        })

        if (pinchGestureRef.current) {
          event.preventDefault()
          updateTouchPinch()
          return
        }
      }

      if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) return

      const currentAreaSelection = areaSelectionRef.current
      if (currentAreaSelection) {
        event.preventDefault()
        const nextSelection = {
          ...currentAreaSelection,
          currentClientX: event.clientX,
          currentClientY: event.clientY,
        }
        areaSelectionRef.current = nextSelection
        setAreaSelection(nextSelection)
        return
      }

      const currentConnectionDrag = connectionDragStateRef.current
      if (currentConnectionDrag) {
        event.preventDefault()
        const view = viewportRef.current
        const worldPoint = screenToWorld(
          event.clientX,
          event.clientY,
          boardRef.current,
          view.offset,
          view.scale,
        )

        setConnectionDrag((currentDrag) =>
          currentDrag
            ? ((connectionDragStateRef.current = {
                ...currentDrag,
                clientX: event.clientX,
                clientY: event.clientY,
                worldX: worldPoint?.x ?? currentDrag.worldX,
                worldY: worldPoint?.y ?? currentDrag.worldY,
              }),
              connectionDragStateRef.current)
            : null,
        )
        return
      }

      const currentNodeDrag = nodeDragStateRef.current
      if (currentNodeDrag) {
        event.preventDefault()
        setDraggedPositions((currentPositions) => {
          const deltaX = (event.clientX - currentNodeDrag.startClientX) / viewportRef.current.scale
          const deltaY = (event.clientY - currentNodeDrag.startClientY) / viewportRef.current.scale
          const nextPositions = {
            ...currentPositions,
          }
          for (const nodeId of currentNodeDrag.nodeIds) {
            const originPosition = currentNodeDrag.originPositions[nodeId]
            if (!originPosition) continue
            nextPositions[nodeId] = {
              x: originPosition.x + deltaX,
              y: originPosition.y + deltaY,
            }
          }
          draggedPositionsRef.current = nextPositions
          return nextPositions
        })
        return
      }

      if (!boardDragRef.current.active) return

      event.preventDefault()
      const nextX = boardDragRef.current.originX + event.clientX - boardDragRef.current.startX
      const nextY = boardDragRef.current.originY + event.clientY - boardDragRef.current.startY
      if (Math.hypot(event.clientX - boardDragRef.current.startX, event.clientY - boardDragRef.current.startY) > NODE_CLICK_DRAG_THRESHOLD) {
        boardDragRef.current.moved = true
      }

      queueViewportUpdate({ x: nextX, y: nextY }, viewportRef.current.scale)
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        touchPointers.delete(event.pointerId)

        if (pinchGestureRef.current) {
          event.preventDefault()
          pinchGestureRef.current = null

          const remainingTouches = Array.from(touchPointers.entries())
          const remainingTouch = remainingTouches[remainingTouches.length - 1]
          if (remainingTouch) {
            const [pointerId, point] = remainingTouch
            activePointerIdRef.current = pointerId
            boardDragRef.current = {
              startX: point.clientX,
              startY: point.clientY,
              originX: viewportRef.current.offset.x,
              originY: viewportRef.current.offset.y,
              active: true,
              moved: false,
            }
            setIsDraggingBoard(true)
          }
          return
        }
      }

      if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) return

      void (async () => {
        const currentAreaSelection = areaSelectionRef.current
        if (currentAreaSelection) {
          activePointerIdRef.current = null
          const viewport = boardRef.current?.getBoundingClientRect()
          const movedDistance = Math.hypot(
            event.clientX - currentAreaSelection.startClientX,
            event.clientY - currentAreaSelection.startClientY,
          )

          if (viewport && movedDistance >= NODE_CLICK_DRAG_THRESHOLD) {
            const minClientX = Math.min(currentAreaSelection.startClientX, currentAreaSelection.currentClientX)
            const maxClientX = Math.max(currentAreaSelection.startClientX, currentAreaSelection.currentClientX)
            const minClientY = Math.min(currentAreaSelection.startClientY, currentAreaSelection.currentClientY)
            const maxClientY = Math.max(currentAreaSelection.startClientY, currentAreaSelection.currentClientY)

            setMultiSelectedNodeIds(
              visibleBoardNodesRef.current
                .filter((node) => {
                  if (node.is_root) return false
                  const clientX =
                    viewport.left + viewport.width / 2 + viewportRef.current.offset.x + node.x * viewportRef.current.scale
                  const clientY =
                    viewport.top + viewport.height / 2 + viewportRef.current.offset.y + node.y * viewportRef.current.scale

                  return (
                    clientX >= minClientX &&
                    clientX <= maxClientX &&
                    clientY >= minClientY &&
                    clientY <= maxClientY
                  )
                })
                .map((node) => node.id),
            )
          } else {
            setMultiSelectedNodeIds([])
          }

          areaSelectionRef.current = null
          setAreaSelection(null)
          return
        }

        if (connectionDragStateRef.current) {
          activePointerIdRef.current = null
          await finishConnectionDrag(event.clientX, event.clientY)
          return
        }

        const currentNodeDrag = nodeDragStateRef.current
        if (currentNodeDrag) {
          activePointerIdRef.current = null
          const movedDistance = Math.hypot(
            event.clientX - currentNodeDrag.startClientX,
            event.clientY - currentNodeDrag.startClientY,
          )
          suppressNodeClickRef.current = movedDistance > NODE_CLICK_DRAG_THRESHOLD
          setNodeDrag(null)
          nodeDragStateRef.current = null

          try {
            const movedNodeIds = currentNodeDrag.nodeIds.filter((nodeId) => {
              const finalPosition = draggedPositionsRef.current[nodeId]
              const originPosition = currentNodeDrag.originPositions[nodeId]
              if (!finalPosition || !originPosition) return false

              return (
                Math.abs(finalPosition.x - originPosition.x) > 0.001 ||
                Math.abs(finalPosition.y - originPosition.y) > 0.001
              )
            })

            if (movedNodeIds.length > 0) {
              boardNodesRef.current = boardNodesRef.current.map((node) => {
                const finalPosition = draggedPositionsRef.current[node.id]
                return finalPosition ? { ...node, ...finalPosition } : node
              })
              const didGroupDrop = await finishNodeGroupDrop(currentNodeDrag)
              if (didGroupDrop) return

              await Promise.all(
                movedNodeIds.map((nodeId) => {
                  const finalPosition = draggedPositionsRef.current[nodeId]
                  return movePerson(nodeId, finalPosition.x, finalPosition.y)
                }),
              )
            }
          } finally {
            setDraggedPositions((currentPositions) => {
              const nextPositions = { ...currentPositions }
              for (const nodeId of currentNodeDrag.nodeIds) {
                delete nextPositions[nodeId]
              }
              draggedPositionsRef.current = nextPositions
              return nextPositions
            })
          }
          return
        }

        const didTapBoard = boardDragRef.current.active && !boardDragRef.current.moved
        boardDragRef.current.active = false
        activePointerIdRef.current = null
        setIsDraggingBoard(false)

        if (didTapBoard && event.pointerType !== 'mouse') {
          const lastTap = lastBoardTapRef.current
          const isDoubleTap =
            lastTap &&
            event.timeStamp - lastTap.time <= DOUBLE_TAP_MS &&
            Math.hypot(event.clientX - lastTap.clientX, event.clientY - lastTap.clientY) <= DOUBLE_TAP_DISTANCE

          if (isDoubleTap) {
            lastBoardTapRef.current = null
            await createPersonAtClientPoint(event.clientX, event.clientY)
          } else {
            lastBoardTapRef.current = {
              time: event.timeStamp,
              clientX: event.clientX,
              clientY: event.clientY,
            }
          }
        }
      })()
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      touchPointers.clear()
      pinchGestureRef.current = null
    }
  }, [createPersonAtClientPoint, finishConnectionDrag, finishNodeGroupDrop, movePerson, queueViewportUpdate, updateTouchPinch])

  function startBoardDragging(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === 'touch') {
      touchPointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      })

      if (touchPointersRef.current.size > 1) {
        event.preventDefault()
        beginTouchPinch()
        return
      }
    }

    if (connectionDrag || nodeDrag) return

    if (!event.isPrimary) return

    if (event.button === 2) {
      event.preventDefault()
      activePointerIdRef.current = event.pointerId
      setSelectedConnectionId(null)
      setConnectionMenuPosition(null)
      setInspectorNodeId(null)
      closeTransientUi()
      const viewport = event.currentTarget.getBoundingClientRect()
      const nextAreaSelection = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        currentClientX: event.clientX,
        currentClientY: event.clientY,
        viewportLeft: viewport.left,
        viewportTop: viewport.top,
      }
      areaSelectionRef.current = nextAreaSelection
      setAreaSelection(nextAreaSelection)
      return
    }

    if (event.button !== 0) return

    event.preventDefault()
    activePointerIdRef.current = event.pointerId
    setSelectedConnectionId(null)
    setConnectionMenuPosition(null)
    setMultiSelectedNodeIds([])
    boardDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: viewportRef.current.offset.x,
      originY: viewportRef.current.offset.y,
      active: true,
      moved: false,
    }

    setIsDraggingBoard(true)
    setInspectorNodeId(null)
  }

  function handleBoardDoubleClick(event: ReactMouseEvent<HTMLElement>) {
    if (event.target instanceof Element && event.target.closest('.graph-node, .connection-menu')) return

    event.preventDefault()
    void createPersonAtClientPoint(event.clientX, event.clientY)
  }

  const startNodeInteraction = useCallback((node: PersonNode, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return

    if (event.pointerType === 'touch') {
      touchPointersRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      })

      if (touchPointersRef.current.size > 1) {
        event.preventDefault()
        event.stopPropagation()
        beginTouchPinch()
        return
      }
    }

    if (!event.isPrimary) return

    event.stopPropagation()
    boardDragRef.current.active = false
    setIsDraggingBoard(false)
    setSelectedNodeId(node.id)
    setInspectorNodeId(null)
    setSelectedConnectionId(null)
    setConnectionMenuPosition(null)

    if (!isGraphReady) return

    activePointerIdRef.current = event.pointerId
    if (!node.is_root) {
      const dragNodeIds =
        multiSelectedNodeIdSet.has(node.id) && multiSelectedNodeIds.length > 1
          ? visibleBoardNodes
              .filter((candidateNode) => multiSelectedNodeIdSet.has(candidateNode.id) && !candidateNode.is_root)
              .map((candidateNode) => candidateNode.id)
          : [node.id]
      const originPositions = Object.fromEntries(
        dragNodeIds.map((nodeId) => {
          const dragNode = nodesById[nodeId]
          return [nodeId, { x: dragNode.x, y: dragNode.y }]
        }),
      ) as Record<string, Offset>
      const nextNodeDrag = {
        nodeIds: dragNodeIds,
        startClientX: event.clientX,
        startClientY: event.clientY,
        originPositions,
      }
      nodeDragStateRef.current = nextNodeDrag
      setNodeDrag(nextNodeDrag)
      return
    }
  }, [beginTouchPinch, isGraphReady, multiSelectedNodeIdSet, multiSelectedNodeIds.length, nodesById, visibleBoardNodes])

  const markTrackpadPanActive = useCallback(() => {
    trackpadPanRef.current.active = true

    if (trackpadPanRef.current.timeoutId !== null) {
      window.clearTimeout(trackpadPanRef.current.timeoutId)
    }

    trackpadPanRef.current.timeoutId = window.setTimeout(() => {
      trackpadPanRef.current.active = false
      trackpadPanRef.current.timeoutId = null
    }, TRACKPAD_PAN_IDLE_MS)
  }, [])

  const moveWithWheel = useCallback((event: WheelEvent) => {
    event.preventDefault()
    const view = viewportRef.current
    const deltaMultiplier = event.deltaMode === 1 ? 16 : 1
    const deltaX = event.deltaX * deltaMultiplier
    const deltaY = event.deltaY * deltaMultiplier

    if (isLikelyTrackpadPan(event)) {
      markTrackpadPanActive()
      queueViewportUpdate(
        {
          x: view.offset.x - deltaX,
          y: view.offset.y - deltaY,
        },
        view.scale,
      )
      return
    }

    const normalizedDelta = Math.max(-120, Math.min(120, deltaY))
    const nextScale = view.scale * Math.exp(-normalizedDelta * WHEEL_ZOOM_INTENSITY)
    zoomAtClientPoint(event.clientX, event.clientY, nextScale)
  }, [markTrackpadPanActive, queueViewportUpdate, zoomAtClientPoint])

  function handleInspectorWheel(event: ReactWheelEvent<HTMLElement>) {
    if (event.ctrlKey) {
      event.stopPropagation()
      moveWithWheel(event.nativeEvent)
      return
    }

    if (trackpadPanRef.current.active) {
      event.stopPropagation()
      moveWithWheel(event.nativeEvent)
      return
    }

    event.stopPropagation()
  }

  useEffect(() => {
    const viewport = boardRef.current
    if (!viewport) return undefined

    const handleWheel = (event: WheelEvent) => {
      moveWithWheel(event)
    }

    const handleGestureStart = (event: Event) => {
      event.preventDefault()
      gestureScaleRef.current = 1
    }

    const handleGestureChange = (event: Event) => {
      event.preventDefault()

      if (touchPointersRef.current.size > 0) return

      const gestureEvent = event as GestureEventLike
      const scaleDelta = gestureEvent.scale / gestureScaleRef.current
      gestureScaleRef.current = gestureEvent.scale

      if (!Number.isFinite(scaleDelta) || scaleDelta === 1) return

      const view = viewportRef.current
      zoomAtClientPoint(
        gestureEvent.clientX,
        gestureEvent.clientY,
        view.scale * scaleDelta,
      )
    }

    const handleGestureEnd = (event: Event) => {
      event.preventDefault()
      gestureScaleRef.current = 1
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })
    viewport.addEventListener('gesturestart', handleGestureStart, { passive: false })
    viewport.addEventListener('gesturechange', handleGestureChange, { passive: false })
    viewport.addEventListener('gestureend', handleGestureEnd, { passive: false })

    return () => {
      viewport.removeEventListener('wheel', handleWheel)
      viewport.removeEventListener('gesturestart', handleGestureStart)
      viewport.removeEventListener('gesturechange', handleGestureChange)
      viewport.removeEventListener('gestureend', handleGestureEnd)
    }
  }, [moveWithWheel, zoomAtClientPoint])

  function getTagAccentStyle(color: string): CSSProperties {
    return {
      '--tag-color': color,
      '--tag-color-rgb': hexToRgb(color),
    } as CSSProperties
  }

  const saveInspectorName = useCallback(async () => {
    if (!inspectorNode || !isGraphReady) return

    const nextValue = nameDraft
    const nextName = nextValue.trim()
    if (nextName === inspectorNode.name) return

    await updatePerson({
      id: inspectorNode.id,
      name: nextName,
    })
  }, [inspectorNode, isGraphReady, nameDraft, updatePerson])

  useEffect(() => {
    if (!inspectorNode || !isGraphReady) return undefined

    const nextName = nameDraft.trim()
    if (nextName === inspectorNode.name) return undefined

    const timeoutId = window.setTimeout(() => {
      void saveInspectorName()
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [inspectorNode, isGraphReady, nameDraft, saveInspectorName])

  function openTagPicker(query = '') {
    setTagDraft(query)
    setIsTagPickerOpen(true)
    setActiveTagOptionIndex(0)
  }

  function closeTagPicker() {
    setIsTagPickerOpen(false)
    setTagDraft('')
    setActiveTagOptionIndex(0)
    setNameTagRange(null)
  }

  function handleInspectorNameChange(value: string, caretIndex: number) {
    setNameDraft(value)

    const trigger = extractTagTrigger(value, caretIndex)
    if (!trigger) {
      if (nameTagRange) {
        closeTagPicker()
      }
      return
    }

    setNameTagRange({ start: trigger.start, end: trigger.end })
    openTagPicker(trigger.query)
  }

  async function handleTagSelection(nextTagId: string) {
    if (!inspectorNode || !isGraphReady) return

    const selectedTagName = tagsById[nextTagId]?.name ?? ''
    if (nameTagRange) {
      const nextName = `${nameDraft.slice(0, nameTagRange.start)}${nameDraft.slice(nameTagRange.end)}`
        .replace(/\s{2,}/g, ' ')
        .trim()

      setNameDraft(nextName)
      await updatePerson({
        id: inspectorNode.id,
        name: nextName,
        tag_id: nextTagId || null,
      })
      closeTagPicker()
      window.requestAnimationFrame(() => {
        nameInputRef.current?.focus()
      })
      return
    }

    await updatePerson({
      id: inspectorNode.id,
      tag_id: nextTagId || null,
    })
    setTagDraft(selectedTagName)
    closeTagPicker()
  }

  async function handleCreateTag() {
    const nextName = normalizeTagName(tagDraft)
    if (!nextName || !inspectorNode || !isGraphReady) return

    const existingTag = tags.find(
      (tag) => normalizeTagName(tag.name).toLowerCase() === nextName.toLowerCase(),
    )
    const createdTag = existingTag ?? (await createTag(nextName))
    setTagDraft(createdTag.name)
    await handleTagSelection(createdTag.id)
  }

  async function handleClearTag() {
    if (!inspectorNode || !isGraphReady) return

    if (nameTagRange) {
      const nextName = `${nameDraft.slice(0, nameTagRange.start)}${nameDraft.slice(nameTagRange.end)}`
        .replace(/\s{2,}/g, ' ')
        .trim()

      setNameDraft(nextName)
      await updatePerson({
        id: inspectorNode.id,
        name: nextName,
        tag_id: null,
      })
      closeTagPicker()
      window.requestAnimationFrame(() => {
        nameInputRef.current?.focus()
      })
      return
    }

    await updatePerson({
      id: inspectorNode.id,
      tag_id: null,
    })
    setTagDraft('')
    closeTagPicker()
  }

  async function handleDeleteInspectorTag(tagId: string, tagName: string) {
    if (!isGraphReady) return

    const shouldDelete = window.confirm(
      `Delete "${tagName}"? This removes the tag from every person using it.`,
    )
    if (!shouldDelete) return

    await deleteTag(tagId)
    if (inspectorNode?.tag_id === tagId || normalizeTagName(tagDraft) === normalizeTagName(tagName)) {
      setTagDraft('')
    }
    setActiveTagOptionIndex(0)
    setIsTagPickerOpen(true)
  }

  async function handleInspectorTagColorChange(tagId: string, color: string) {
    if (!isGraphReady) return

    previewTagColor(tagId, color)
    await persistTagColor(tagId)
  }

  function chooseTagPickerOption(option: TagPickerOption) {
    if (option.type === 'clear') {
      void handleClearTag()
      return
    }

    if (option.type === 'create') {
      void handleCreateTag()
      return
    }

    void handleTagSelection(option.tagId)
  }

  function handleTagKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeTagPicker()
      if (nameTagRange) {
        nameInputRef.current?.focus()
        return
      }

      tagTriggerRef.current?.focus()
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setIsTagPickerOpen(true)
      setActiveTagOptionIndex((currentIndex) => {
        if (tagPickerOptions.length === 0) return 0

        const direction = event.key === 'ArrowDown' ? 1 : -1
        return (currentIndex + direction + tagPickerOptions.length) % tagPickerOptions.length
      })
      return
    }

    if (event.key !== 'Enter') return

    event.preventDefault()
    const activeOption = tagPickerOptions[Math.min(activeTagOptionIndex, tagPickerOptions.length - 1)]
    if (activeOption) {
      chooseTagPickerOption(activeOption)
      return
    }
  }

  async function handleCreateMenuTag() {
    if (!isGraphReady) return

    const existingNames = new Set(tags.map((tag) => normalizeTagName(tag.name).toLowerCase()))
    let nextName = 'New tag'
    let suffix = 2

    while (existingNames.has(normalizeTagName(nextName).toLowerCase())) {
      nextName = `New tag ${suffix}`
      suffix += 1
    }

    const createdTag = await createTag(nextName)
    setActiveColorTagId(createdTag.id)
  }

  function previewTagColor(tagId: string, color: string) {
    const nextColor = normalizeTagColor(color)
    setTagColorDrafts((currentDrafts) => ({
      ...currentDrafts,
      [tagId]: nextColor,
    }))
    saveTagColorDraft(tagId, nextColor)
  }

  async function persistTagColor(tagId: string, nextColor = tagColorDrafts[tagId]) {
    const color = nextColor ? normalizeTagColor(nextColor) : null
    if (!color || !isGraphReady) return

    try {
      await updateTag({
        id: tagId,
        color,
      })
    } catch {
      saveTagColorDraft(tagId, color)
    }
  }

  function showTagInMenu(tagId: string) {
    setHiddenTagIds((currentTagIds) => {
      if (!currentTagIds[tagId]) return currentTagIds

      const nextTagIds = { ...currentTagIds }
      delete nextTagIds[tagId]
      return nextTagIds
    })
  }

  function hideTagInMenu(tagId: string) {
    setHiddenTagIds((currentTagIds) => ({
      ...currentTagIds,
      [tagId]: true,
    }))
  }

  function toggleAllTagsInMenu() {
    if (areAllTagsVisible) {
      setHiddenTagIds(
        Object.fromEntries(tagMenuItems.map((tag) => [tag.id, true])) as Record<string, boolean>,
      )
      return
    }

    setHiddenTagIds({})
  }

  async function handleDeleteMenuTag(tagId: string) {
    if (!isGraphReady) return

    await deleteTag(tagId)
    setHiddenTagIds((currentTagIds) => {
      if (!currentTagIds[tagId]) return currentTagIds

      const nextTagIds = { ...currentTagIds }
      delete nextTagIds[tagId]
      return nextTagIds
    })
    setTagColorDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts }
      delete nextDrafts[tagId]
      window.localStorage.setItem(TAG_COLOR_STORAGE_KEY, JSON.stringify(nextDrafts))
      return nextDrafts
    })
  }

  async function persistMenuTagName(tagId: string, fallbackName: string) {
    if (!isGraphReady) return

    const rawDraft = tagNameDrafts[tagId] ?? fallbackName
    const nextName = normalizeTagName(rawDraft)
    if (!nextName || nextName === fallbackName) {
      setTagNameDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts }
        delete nextDrafts[tagId]
        return nextDrafts
      })
      return
    }

    const duplicateExists = tags.some(
      (tag) => tag.id !== tagId && normalizeTagName(tag.name).toLowerCase() === nextName.toLowerCase(),
    )

    if (duplicateExists) {
      setTagNameDrafts((currentDrafts) => ({
        ...currentDrafts,
        [tagId]: fallbackName,
      }))
      return
    }

    try {
      await updateTag({
        id: tagId,
        name: nextName,
      })
      setTagNameDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts }
        delete nextDrafts[tagId]
        return nextDrafts
      })
    } catch {
      setTagNameDrafts((currentDrafts) => ({
        ...currentDrafts,
        [tagId]: fallbackName,
      }))
    }
  }

  const handleDeleteSelectedNode = useCallback(async (nodeId: string) => {
    await deletePerson(nodeId)
    setInspectorNodeId((currentNodeId) => (currentNodeId === nodeId ? null : currentNodeId))
    setSelectedNodeId(null)
  }, [deletePerson])

  const handleDeleteSelectedConnection = useCallback(async (connectionId?: string | null) => {
    const targetConnectionId = connectionId ?? selectedConnectionId
    if (!targetConnectionId) return

    await deleteConnection(targetConnectionId)
    setSelectedConnectionId((currentConnectionId) =>
      currentConnectionId === targetConnectionId ? null : currentConnectionId,
    )
    setConnectionMenuPosition(null)
  }, [deleteConnection, selectedConnectionId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' || !isGraphReady || isEditableElement(event.target)) return

      if (selectedConnectionId) {
        event.preventDefault()
        void handleDeleteSelectedConnection()
        return
      }

      if (!selectedNode || selectedNode.is_root) return

      event.preventDefault()
      void handleDeleteSelectedNode(selectedNode.id)
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    handleDeleteSelectedConnection,
    handleDeleteSelectedNode,
    isGraphReady,
    selectedConnectionId,
    selectedNode,
  ])

  async function createInspectorNote(value: string) {
    if (!inspectorNode || !isGraphReady) return null

    const { title, body } = parseNoteContent(value)
    if (!title && !body) return null

    const createdNote = await createNote(title, body, inspectorNode.id)
    setCollapsedNotes((currentNotes) => ({
      ...currentNotes,
      [createdNote.id]: true,
    }))
    return createdNote
  }

  async function importLinkedInArchive(file: File) {
    if (!isRemoteGraphReady) {
      setLinkedInImportStatus({
        state: 'error',
        message: 'Sign in and wait for your board to load before importing LinkedIn connections.',
      })
      return
    }

    setLinkedInImportStatus({
      state: 'loading',
      message: 'Reading LinkedIn archive...',
    })

    try {
      const rootPerson = people.find((person) => person.is_root)
      if (!rootPerson) {
        throw new Error('Root person is not available.')
      }

      const rows = await readLinkedInConnectionsFromArchive(file)
      const existingLinkedInImportKeys = extractLinkedInImportKeysFromNotes(notes)
      const existingNames = new Set(
        people.map((person) => normalizeTagName(person.name).toLowerCase()).filter(Boolean),
      )
      const seenImportKeys = new Set<string>()
      const connectionsToCreate = rows.filter((connection) => {
        const name = getLinkedInConnectionName(connection)
        const normalizedName = name.toLowerCase()
        const normalizedUrl = connection.url.toLowerCase()
        const importKey = normalizedUrl || `${normalizedName}:${connection.company.toLowerCase()}`

        if (!name || seenImportKeys.has(importKey)) return false
        if (normalizedUrl && existingLinkedInImportKeys.urls.has(normalizedUrl)) return false
        if (existingLinkedInImportKeys.names.has(normalizedName)) return false
        if (!normalizedUrl && existingNames.has(normalizedName)) return false

        seenImportKeys.add(importKey)
        return true
      })

      if (connectionsToCreate.length === 0) {
        setLinkedInImportStatus({
          state: 'success',
          message: `No new LinkedIn connections to import. ${rows.length} rows were already present or empty.`,
        })
        return
      }

      const linkedInTag =
        tags.find((tag) => normalizeTagName(tag.name).toLowerCase() === LINKEDIN_TAG_NAME.toLowerCase()) ??
        await createTag(LINKEDIN_TAG_NAME)
      const positions = getLinkedInImportPositions(connectionsToCreate.length, people)
      const peopleToCreate = connectionsToCreate.map((connection, index) => ({
        id: createUuid(),
        name: getLinkedInConnectionName(connection),
        tagId: linkedInTag.id,
        x: positions[index].x,
        y: positions[index].y,
        noteTitle: 'LinkedIn connection',
        noteBody: getLinkedInNoteBody(connection, linkedInImportOptions),
        connectToPersonId: rootPerson.id,
      }))

      setLinkedInImportStatus({
        state: 'loading',
        message: `Importing ${peopleToCreate.length} LinkedIn connections in batches...`,
      })

      const importedGraph = await bulkCreateRemotePeople(peopleToCreate)
      const importedCount = importedGraph.people.length

      setLinkedInImportStatus({
        state: 'success',
        message: `Imported ${importedCount} LinkedIn connections. Skipped ${rows.length - importedCount} existing or empty rows.`,
      })
    } catch (error) {
      setLinkedInImportStatus({
        state: 'error',
        message: error instanceof Error ? error.message : 'Unable to import LinkedIn connections.',
      })
    } finally {
      if (linkedInFileInputRef.current) {
        linkedInFileInputRef.current.value = ''
      }
      setIsLinkedInDragActive(false)
    }
  }

  function openLinkedInUpload() {
    setIsLinkedInMenuOpen(false)
    setIsLinkedInGuideOpen(false)
    setIsLinkedInUploadOpen(true)
    setLinkedInImportStatus({ state: 'idle', message: null })
  }

  function handleLinkedInFileSelection(file: File | undefined) {
    if (!file || linkedInImportStatus.state === 'loading') return
    void importLinkedInArchive(file)
  }

  function handleLinkedInDrop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    setIsLinkedInDragActive(false)
    handleLinkedInFileSelection(event.dataTransfer.files[0])
  }

  async function handleCreateNoteFromDraft(refocusComposer = true) {
    const createdNote = await createInspectorNote(newNoteText)
    if (!createdNote) return

    setNewNoteText('')
    if (!refocusComposer) return

    window.requestAnimationFrame(() => {
      newNoteTextareaRef.current?.focus()
      autoResizeTextarea(newNoteTextareaRef.current)
    })
  }

  async function handleAiSearch() {
    const query = searchQuery.trim()
    if (!query || !isGraphReady) return
    if (!isAuthenticated) {
      setAiSearchStatus('error')
      setAiSearchError('Sign in to use AI search.')
      return
    }

    setAiSearchStatus('loading')
    setAiSearchError(null)

    try {
      const results = await searchPeopleWithAi(query, aiSearchCandidateIds)
      const nextAiSearchResults: SearchResult[] = []

      for (const result of results) {
          const node = nodesById[result.person_id]
        if (!node) continue

        nextAiSearchResults.push({
          node,
          score: result.score,
          matches: [result.reason, ...result.matched_signals].filter(Boolean).slice(0, 4),
          source: 'ai',
        })
      }

      setAiSearchQuery(query)
      setAiSearchResults(nextAiSearchResults)
      setAiSearchStatus('ready')
    } catch (error) {
      setAiSearchStatus('error')
      setAiSearchError(error instanceof Error ? error.message : 'AI search failed.')
    }
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setIsSearchOpen(false)
      event.currentTarget.blur()
      return
    }

    if (event.key !== 'Enter') return

    event.preventDefault()
    void handleAiSearch()
  }

  function updateNoteDraft(noteId: string, field: keyof NoteDraft, value: string) {
    setNoteDrafts((currentDrafts) => ({
      ...currentDrafts,
      [noteId]: {
        title: currentDrafts[noteId]?.title ?? inspectorNodeNotes.find((note) => note.id === noteId)?.title ?? '',
        body: currentDrafts[noteId]?.body ?? inspectorNodeNotes.find((note) => note.id === noteId)?.body ?? '',
        [field]: value,
      },
    }))
  }

  async function persistNote(note: PersonNote) {
    const draft = noteDrafts[note.id]
    if (!draft) return

    const nextTitle = normalizeNoteTitle(draft.title)
    const nextBody = draft.body

    if (nextTitle === note.title && nextBody === note.body) return

    const updated = await updateNote({
      id: note.id,
      title: nextTitle,
      body: nextBody,
    })
    setNoteDrafts((currentDrafts) => ({
      ...currentDrafts,
      [note.id]: {
        title: updated.title,
        body: updated.body,
      },
    }))
  }

  function handleExistingNoteTitleKeyDown(noteId: string, event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return

    event.preventDefault()
    setCollapsedNotes((currentNotes) => ({
      ...currentNotes,
      [noteId]: false,
    }))
    window.requestAnimationFrame(() => {
      noteBodyRefs.current[noteId]?.focus()
    })
  }

  async function handleNewNoteKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    const isSubmit = event.key === 'Enter' && (event.metaKey || event.ctrlKey)
    if (!isSubmit) return

    event.preventDefault()
    await handleCreateNoteFromDraft()
  }

  async function handleNewNoteBlur() {
    await handleCreateNoteFromDraft(false)
  }

  function flushDraftNoteOnBoardPointerDown() {
    const activeElement = document.activeElement
    const isComposerFocused = activeElement === newNoteTextareaRef.current

    if (!isComposerFocused || !newNoteText.trim()) return

    void handleNewNoteBlur()
  }

  function toggleNoteCollapse(noteId: string) {
    setCollapsedNotes((currentNotes) => ({
      ...currentNotes,
      [noteId]: !(currentNotes[noteId] ?? true),
    }))
  }

  async function handleDeletePerson() {
    if (!inspectorNode || !isGraphReady || inspectorNode.is_root) return

    await handleDeleteSelectedNode(inspectorNode.id)
  }

  function handleExportGraph() {
    const exportedAt = new Date().toISOString()
    const payload = {
      format: 'hackathon-board-graph',
      version: 1,
      exported_at: exportedAt,
      storage_mode: isRemoteGraphReady ? 'supabase' : 'local',
      board: activeBoard,
      people: activePeople,
      tags: activeTags,
      notes: activeNotes,
      person_ai_notes: activePersonAiNotes,
      connections: activeConnections,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `hackathon-board-export-${exportedAt.slice(0, 10)}.json`
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function handleDeleteGraphData() {
    const shouldDelete = window.confirm(
      'Delete this graph data? This removes people, notes, tags, connections, and AI summaries from this board.',
    )
    if (!shouldDelete) return

    if (isRemoteGraphReady) {
      await deleteCurrentGraphData()
      setInspectorNodeId(null)
      setSelectedNodeId(null)
      return
    }

    setLocalPeople([ANONYMOUS_ROOT])
    setLocalTags(createDefaultLocalTags())
    setLocalNotes([])
    setLocalConnections([])
    setNodeGroups([])
    saveNodeGroups(activeBoardId, [])
    setInspectorNodeId(null)
    setSelectedNodeId(null)
  }

  async function handleDeleteAccountData() {
    if (!isAuthenticated) return

    const shouldDelete = window.confirm(
      'Delete your account data? This removes your graph and profile, then deletes the authenticated user account.',
    )
    if (!shouldDelete) return

    await deleteAccountData()
    await signOut()
    setIsAccountMenuOpen(false)
  }

  async function handleRefreshPersonAiNote() {
    if (!inspectorNode || !isRemoteGraphReady) return

    await refreshPersonAiNote(inspectorNode.id)
  }

  function focusNode(node: PersonNode) {
    const nextScale = viewportRef.current.scale
    queueViewportUpdate(
      {
        x: -node.x * nextScale,
        y: -node.y * nextScale,
      },
      nextScale,
    )
    openInspectorForNode(node)
  }

  const selectConnection = useCallback((connectionId: string, event: ReactPointerEvent<SVGPathElement>) => {
    if (!isGraphReady) return
    if (event.pointerType === 'touch') return

    event.preventDefault()
    event.stopPropagation()
    const viewport = boardRef.current?.getBoundingClientRect()
    closeTransientUi()
    setSelectedNodeId(null)
    setInspectorNodeId(null)
    setSelectedConnectionId(connectionId)
    setConnectionMenuPosition({
      x: event.clientX - (viewport?.left ?? 0),
      y: event.clientY - (viewport?.top ?? 0),
    })
  }, [closeTransientUi, isGraphReady])

  const handleNodeClick = useCallback((node: PersonNode) => {
    if (suppressNodeClickRef.current) {
      suppressNodeClickRef.current = false
      return
    }
    if (inspectorNodeId === node.id) {
      setInspectorNodeId(null)
      setIsTagPickerOpen(false)
      setActiveTagOptionIndex(0)
      return
    }
    setMultiSelectedNodeIds([])
    openInspectorForNode(node)
  }, [inspectorNodeId, openInspectorForNode])

  const previewPath = connectionDrag
    ? getLinkPath(nodesById[connectionDrag.fromId], {
        x: connectionDrag.worldX,
        y: connectionDrag.worldY,
      })
    : null

  const themeIconLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
  const accountMenuLabel =
    status === 'authenticated' && session?.user ? 'Account menu' : 'Sign in menu'
  const selectedTagColor = selectedInspectorTag
    ? tagColorById[selectedInspectorTag.id] ?? normalizeTagColor(selectedInspectorTag.color ?? DEFAULT_TAG_COLOR)
    : null

  return (
    <main className={`app-shell theme-${theme}`}>
      {isLinkedInUploadOpen ? (
        <div
          className="linkedin-upload"
          role="presentation"
          onMouseDown={() => {
            if (linkedInImportStatus.state !== 'loading') {
              setIsLinkedInUploadOpen(false)
            }
          }}
        >
          <section
            className="linkedin-upload__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="linkedin-upload-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="linkedin-upload-title" className="linkedin-upload__title">
              Sync your LinkedIn connections
            </h2>
            <div
              className={`linkedin-upload__dropzone${isLinkedInDragActive ? ' is-active' : ''}`}
              onDragEnter={(event) => {
                event.preventDefault()
                setIsLinkedInDragActive(true)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                setIsLinkedInDragActive(true)
              }}
              onDragLeave={(event) => {
                event.preventDefault()
                setIsLinkedInDragActive(false)
              }}
              onDrop={handleLinkedInDrop}
            >
              <input
                ref={linkedInFileInputRef}
                className="linkedin-upload__input"
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={(event) => handleLinkedInFileSelection(event.target.files?.[0])}
                disabled={linkedInImportStatus.state === 'loading'}
              />
              <button
                type="button"
                className="linkedin-upload__select"
                onClick={() => linkedInFileInputRef.current?.click()}
                disabled={linkedInImportStatus.state === 'loading'}
              >
                Drag and drop or select
              </button>
              <p className="linkedin-upload__hint">
                Use the complete LinkedIn data export zip. The archive file is read in the browser;
                only Connections.csv rows are imported.
              </p>
            </div>
            <div className="linkedin-upload__field-options" aria-label="LinkedIn import fields">
              <p className="linkedin-upload__field-options-title">
                Default import saves name, company, position, and connected date.
              </p>
              <label className="linkedin-upload__field-option">
                <input
                  type="checkbox"
                  checked={linkedInImportOptions.includeEmail}
                  onChange={(event) =>
                    setLinkedInImportOptions((currentOptions) => ({
                      ...currentOptions,
                      includeEmail: event.target.checked,
                    }))
                  }
                  disabled={linkedInImportStatus.state === 'loading'}
                />
                <span>Also save email addresses</span>
              </label>
              <label className="linkedin-upload__field-option">
                <input
                  type="checkbox"
                  checked={linkedInImportOptions.includeUrl}
                  onChange={(event) =>
                    setLinkedInImportOptions((currentOptions) => ({
                      ...currentOptions,
                      includeUrl: event.target.checked,
                    }))
                  }
                  disabled={linkedInImportStatus.state === 'loading'}
                />
                <span>Also save LinkedIn profile URLs</span>
              </label>
            </div>
            {linkedInImportStatus.message ? (
              <p className={`linkedin-upload__status is-${linkedInImportStatus.state}`}>
                {linkedInImportStatus.message}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}

      <div className="top-bar">
        <div className="top-bar__left">
          <div ref={tagsMenuRef} className="tags-menu">
            <button
              type="button"
              className="top-bar__icon-button tags-menu__toggle"
              onClick={() => {
                const nextIsOpen = !isTagsMenuOpen
                setIsTagsMenuOpen(nextIsOpen)
                setIsLinkedInMenuOpen(false)
                setIsLinkedInGuideOpen(false)
                setIsAccountMenuOpen(false)
                setIsSearchOpen(false)
                setActiveColorTagId(null)
                if (nextIsOpen) {
                  closeInspectorUi()
                }
              }}
              aria-expanded={isTagsMenuOpen}
              aria-label="Tags menu"
            >
              <svg
                className="top-bar__icon-glyph"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M8 7.5h10" />
                <path d="M8 12h10" />
                <path d="M8 16.5h10" />
                <circle cx="5.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
                <circle cx="5.5" cy="12" r="1" fill="currentColor" stroke="none" />
                <circle cx="5.5" cy="16.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </button>

            {isTagsMenuOpen ? (
              <section className="tags-menu__panel" aria-label="Tag colors">
                <div className="tags-menu__actions">
                  <button
                    type="button"
                    className="tags-menu__action-button"
                    onClick={toggleAllTagsInMenu}
                  >
                    {areAllTagsVisible ? 'Clear all' : 'Select all'}
                  </button>
                </div>

                <div className="tags-menu__list">
                  {tagMenuItems.map((tag) => {
                    const color = normalizeTagColor(tagColorDrafts[tag.id] ?? tag.color ?? DEFAULT_TAG_COLOR)
                    const isPaletteOpen = activeColorTagId === tag.id
                    const isVisible = !hiddenTagIds[tag.id]
                    const tagColorStyle = { '--tag-color': color } as TagColorStyle

                    return (
                      <div key={tag.id} className="tags-menu__item">
                        <button
                          type="button"
                          className="tags-menu__swatch"
                          style={tagColorStyle}
                          onClick={() => setActiveColorTagId(isPaletteOpen ? null : tag.id)}
                          disabled={!tag.isPersisted}
                          aria-label={`Change ${tag.name} color`}
                        >
                          <span className="tags-menu__swatch-core" aria-hidden="true" />
                        </button>
                        <input
                          className="tags-menu__name-input"
                          value={tagNameDrafts[tag.id] ?? tag.name}
                          onChange={(event) => {
                            setTagNameDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [tag.id]: event.target.value,
                            }))
                          }}
                          onBlur={() => {
                            void persistMenuTagName(tag.id, tag.name)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              void persistMenuTagName(tag.id, tag.name)
                              event.currentTarget.blur()
                            }

                            if (event.key === 'Escape') {
                              setTagNameDrafts((currentDrafts) => ({
                                ...currentDrafts,
                                [tag.id]: tag.name,
                              }))
                              event.currentTarget.blur()
                            }
                          }}
                          disabled={!tag.isPersisted}
                          aria-label={`Rename ${tag.name} tag`}
                        />
                        <button
                          type="button"
                          className={`tags-menu__visibility-toggle${isVisible ? ' is-active' : ''}`}
                          onClick={() => {
                            if (isVisible) {
                              hideTagInMenu(tag.id)
                              return
                            }

                            showTagInMenu(tag.id)
                          }}
                          aria-label={`${isVisible ? 'Hide' : 'Show'} people with ${tag.name} tag`}
                          aria-pressed={isVisible}
                        >
                          {isVisible ? '✓' : ''}
                        </button>
                        {tag.isPersisted ? (
                          <button
                            type="button"
                            className="tags-menu__delete"
                            onClick={() => {
                              void handleDeleteMenuTag(tag.id)
                            }}
                            aria-label={`Delete ${tag.name} tag`}
                          >
                            ×
                          </button>
                        ) : null}

                        {isPaletteOpen ? (
                          <div className="tags-menu__palette-wrap">
                            <div className="tags-menu__palette-header">
                              <span className="tags-menu__palette-label">Color</span>
                              <span className="tags-menu__palette-value">{color.toUpperCase()}</span>
                            </div>
                            <div className="tags-menu__preset-grid">
                              {TAG_PRESET_COLORS.map((presetColor) => (
                                <button
                                  key={presetColor}
                                  type="button"
                                  className={`tags-menu__preset${presetColor === color ? ' is-selected' : ''}`}
                                  style={{ '--tag-color': presetColor } as TagColorStyle}
                                  onClick={() => {
                                    previewTagColor(tag.id, presetColor)
                                    void persistTagColor(tag.id, presetColor)
                                  }}
                                  aria-label={`Set ${tag.name} color to ${presetColor}`}
                                />
                              ))}
                            </div>
                            <label className="tags-menu__native-picker">
                              <span className="tags-menu__native-picker-label">Custom color</span>
                              <input
                                className="tags-menu__native-picker-input"
                                type="color"
                                value={color}
                                onChange={(event) => {
                                  const nextColor = event.target.value
                                  previewTagColor(tag.id, nextColor)
                                  void persistTagColor(tag.id, nextColor)
                                }}
                              />
                            </label>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>

                <button
                  type="button"
                  className="tags-menu__new"
                  onClick={() => {
                    void handleCreateMenuTag()
                  }}
                >
                  + New tag
                </button>
              </section>
            ) : null}
          </div>

          <div ref={linkedInMenuRef} className="linkedin-menu">
            <button
              type="button"
              className="top-bar__icon-button linkedin-menu__toggle"
              onClick={() => {
                const nextIsOpen = !isLinkedInMenuOpen
                setIsLinkedInMenuOpen(nextIsOpen)
                setIsTagsMenuOpen(false)
                setIsAccountMenuOpen(false)
                setIsSearchOpen(false)
                setActiveColorTagId(null)
                if (nextIsOpen) {
                  setIsLinkedInGuideOpen(false)
                  closeInspectorUi()
                }
              }}
              aria-expanded={isLinkedInMenuOpen}
              aria-label="LinkedIn connection menu"
            >
              <span className="linkedin-menu__logo" aria-hidden="true">
                in
              </span>
            </button>

            {isLinkedInMenuOpen ? (
              <section className="linkedin-menu__panel" aria-label="LinkedIn connection sync">
                <div className="linkedin-menu__actions">
                  <button
                    type="button"
                    className="linkedin-menu__action"
                    onClick={() => setIsLinkedInGuideOpen(true)}
                  >
                    How to sync your LinkedIn connections
                  </button>
                  <button
                    type="button"
                    className="linkedin-menu__action"
                    onClick={openLinkedInUpload}
                  >
                    Sync your LinkedIn connections
                  </button>
                </div>

                {isLinkedInGuideOpen ? (
                  <div className="linkedin-menu__guide">
                    <div className="linkedin-menu__steps">
                      {LINKEDIN_SYNC_STEPS.map((step, stepIndex) => (
                        <article key={step.title} className="linkedin-menu__step">
                          <div className="linkedin-menu__step-copy">
                            <span className="linkedin-menu__step-index">{stepIndex + 1}</span>
                            <div>
                              <h3 className="linkedin-menu__step-title">{step.title}</h3>
                              <p className="linkedin-menu__step-body">{step.body}</p>
                            </div>
                          </div>
                          <img className="linkedin-menu__step-image" src={step.image} alt="" loading="lazy" />
                        </article>
                      ))}
                    </div>
                    <p className="linkedin-menu__wait-note">
                      Wait up to 24 hours. LinkedIn will email you when the archive is ready. After
                      you receive it, return to this connection menu and press Sync your LinkedIn
                      connections.
                    </p>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>

        <div className="top-bar__right">
          <div ref={searchPanelRef} className="search-panel">
            <div className="search-panel__bar">
              <input
                ref={searchInputRef}
                className="search-panel__input"
                value={searchQuery}
                onFocus={() => {
                  setIsSearchOpen(true)
                  setIsTagsMenuOpen(false)
                  setIsLinkedInMenuOpen(false)
                  setIsLinkedInGuideOpen(false)
                  setIsAccountMenuOpen(false)
                  setActiveColorTagId(null)
                  closeInspectorUi()
                }}
                onChange={(event) => {
                  const nextQuery = event.target.value
                  setSearchQuery(nextQuery)
                  setIsSearchOpen(true)
                  setAiSearchStatus('idle')
                  setAiSearchError(null)
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search people"
                aria-label="Search people"
                aria-expanded={isSearchOpen}
                aria-controls="people-search-panel"
              />
            </div>

            {isSearchOpen ? (
              <div id="people-search-panel" className="search-panel__dropdown">
              {isGraphReady ? (
                <div className="search-panel__hint">
                  <span>
                    {aiSearchStatus === 'loading'
                      ? 'Asking AI...'
                      : isAuthenticated
                        ? 'Press Enter for AI search.'
                        : 'Local search works without sign-in. Sign in for AI search.'}
                  </span>
                  {searchQuery.trim() ? (
                    <button
                      type="button"
                      className="search-panel__ai-button"
                      onClick={() => {
                        void handleAiSearch()
                      }}
                      disabled={aiSearchStatus === 'loading'}
                    >
                      AI search
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="search-panel__empty">Sign in to use AI search.</p>
              )}
              {aiSearchError ? <p className="search-panel__error">{aiSearchError}</p> : null}

              {searchQuery.trim() ? (
                visibleSearchResults.length > 0 ? (
                  <div className="search-panel__results">
                    {visibleSearchResults.map((result) => (
                      <button
                        key={result.node.id}
                        type="button"
                        className="search-result"
                        onClick={() => focusNode(result.node)}
                      >
                        <span className="search-result__title">
                          {result.node.name.trim() || (result.node.is_root ? 'You' : 'Unnamed person')}
                        </span>
                        <span className="search-result__meta">
                          {result.source === 'ai' ? 'AI match: ' : ''}
                          {result.matches.join(' • ')}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="search-panel__empty">
                    {aiSearchStatus === 'loading' ? 'Searching your graph with AI...' : 'No people match this query yet.'}
                  </p>
                )
              ) : (
                <p className="search-panel__empty">
                  Type naturally, for example: "someone who can help with n8n automation".
                </p>
              )}
              </div>
            ) : null}
          </div>

          <div ref={accountPanelRef} className="account-panel" aria-live="polite">
            <button
              type="button"
              className="top-bar__icon-button account-panel__trigger"
              onClick={() => {
                const nextIsOpen = !isAccountMenuOpen
                setIsAccountMenuOpen(nextIsOpen)
                setIsTagsMenuOpen(false)
                setIsLinkedInMenuOpen(false)
                setIsLinkedInGuideOpen(false)
                setIsSearchOpen(false)
                if (nextIsOpen) {
                  closeInspectorUi()
                }
              }}
              aria-expanded={isAccountMenuOpen}
              aria-label={accountMenuLabel}
            >
              {status === 'authenticated' && session?.user?.user_metadata.avatar_url ? (
                <img
                  className="account-panel__avatar"
                  src={session.user.user_metadata.avatar_url}
                  alt=""
                />
              ) : (
                <span className="account-panel__avatar" aria-hidden="true">
                  {status === 'authenticated' && session?.user
                    ? (session.user.email ?? 'U').slice(0, 1).toUpperCase()
                    : '@'}
                </span>
              )}
            </button>

            {isAccountMenuOpen ? (
              <div className="account-panel__popover">
                {status === 'authenticated' && session?.user ? (
                  <>
                    <div className="account-panel__text">
                      <span className="account-panel__label">{session.user.email}</span>
                      <span className="account-panel__meta">
                        {graphStatus === 'loading' ? 'Loading your graph' : activeBoard?.title ?? 'SocialDataNode'}
                      </span>
                    </div>
                    <button type="button" className="account-panel__button" onClick={signOut}>
                      Sign out
                    </button>
                    <div className="account-panel__divider" />
                    <button type="button" className="account-panel__button" onClick={handleExportGraph}>
                      Export graph
                    </button>
                    <button type="button" className="account-panel__button" onClick={() => void handleDeleteGraphData()}>
                      Delete graph data
                    </button>
                    <button
                      type="button"
                      className="account-panel__button account-panel__button--danger"
                      onClick={() => void handleDeleteAccountData()}
                    >
                      Delete account data
                    </button>
                  </>
                ) : (
                  <>
                    <div className="account-panel__text">
                      <span className="account-panel__label">
                        {status === 'loading' ? 'Checking session' : 'Social graph'}
                      </span>
                      <span className="account-panel__meta">
                        {status === 'unconfigured'
                          ? 'Connect Supabase to enable Google login'
                          : 'Sign in to save your network space'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="account-panel__button"
                      onClick={signInWithGoogle}
                      disabled={status === 'loading' || status === 'unconfigured'}
                    >
                      Sign in with Google
                    </button>
                    <div className="account-panel__divider" />
                    <button type="button" className="account-panel__button" onClick={handleExportGraph}>
                      Export local graph
                    </button>
                    <button type="button" className="account-panel__button" onClick={() => void handleDeleteGraphData()}>
                      Clear local graph
                    </button>
                  </>
                )}
                {error ? <span className="account-panel__error">{error}</span> : null}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="top-bar__icon-button theme-toggle"
            onClick={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
            aria-label={themeIconLabel}
          >
            <span className="theme-toggle__glyph" aria-hidden="true">
              {theme === 'dark' ? '☀' : '☾'}
            </span>
          </button>
        </div>
      </div>

      {inspectorNode ? (
        <aside
          ref={inspectorPanelRef}
          className="inspector-panel"
          aria-label="Selected person inspector"
          onMouseDown={(event) => event.stopPropagation()}
          onWheel={handleInspectorWheel}
        >
          <input
            ref={nameInputRef}
            className="inspector-panel__name"
            value={nameDraft}
            onChange={(event) => {
              handleInspectorNameChange(
                event.target.value,
                event.target.selectionStart ?? event.target.value.length,
              )
            }}
            onKeyDown={(event) => {
              if (isTagPickerOpen && nameTagRange) {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  setActiveTagOptionIndex((currentIndex) => {
                    if (tagPickerOptions.length === 0) return 0

                    const direction = event.key === 'ArrowDown' ? 1 : -1
                    return (currentIndex + direction + tagPickerOptions.length) % tagPickerOptions.length
                  })
                  return
                }

                if (event.key === 'Enter') {
                  event.preventDefault()
                  const activeOption =
                    tagPickerOptions[Math.min(activeTagOptionIndex, tagPickerOptions.length - 1)]
                  if (activeOption) {
                    chooseTagPickerOption(activeOption)
                  }
                  return
                }

                if (event.key === 'Escape') {
                  event.preventDefault()
                  closeTagPicker()
                  return
                }
              }

              if (event.key === 'Enter') {
                event.preventDefault()
                newNoteTextareaRef.current?.focus()
                autoResizeTextarea(newNoteTextareaRef.current)
              }
            }}
            onBlur={() => {
              void saveInspectorName()
            }}
            disabled={!isGraphReady}
            placeholder="Name"
          />

          <div className="field-group field-group--compact">
            <div className="tag-picker">
              <button
                ref={tagTriggerRef}
                type="button"
                className={`tag-picker__trigger${selectedInspectorTag ? ' is-selected' : ' is-ghost'}`}
                style={
                  selectedTagColor
                    ? ({ '--tag-color': selectedTagColor } as TagColorStyle)
                    : undefined
                }
                onClick={() => {
                  openTagPicker()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openTagPicker()
                    return
                  }

                  if ((event.key === 'Backspace' || event.key === 'Delete') && selectedInspectorTag) {
                    event.preventDefault()
                    void handleClearTag()
                  }
                }}
                aria-expanded={isTagPickerOpen}
                aria-controls="inspector-tag-options"
              >
                {selectedInspectorTag ? (
                  <>
                    <span className="tag-picker__trigger-dot" aria-hidden="true" />
                    <span className="tag-picker__trigger-label">{selectedInspectorTag.name}</span>
                  </>
                ) : (
                  <span className="tag-picker__ghost-label">+ add tag</span>
                )}
              </button>
              {isTagPickerOpen ? (
                <div
                  ref={tagPickerMenuRef}
                  id="inspector-tag-options"
                  className="tag-picker__menu"
                  role="listbox"
                >
                  <input
                    ref={tagSearchInputRef}
                    className="tag-picker__search"
                    value={tagDraft}
                    onChange={(event) => {
                      setTagDraft(event.target.value)
                      setActiveTagOptionIndex(0)
                    }}
                    onKeyDown={handleTagKeyDown}
                    onBlur={() => {
                      window.setTimeout(() => {
                        closeTagPicker()
                      }, 120)
                    }}
                    placeholder="Search or create a tag"
                    disabled={!isGraphReady}
                    role="combobox"
                    aria-expanded={isTagPickerOpen}
                    aria-controls="inspector-tag-options"
                    aria-activedescendant={
                      isTagPickerOpen && tagPickerOptions[activeTagOptionIndex]
                        ? `inspector-tag-option-${tagPickerOptions[activeTagOptionIndex].id}`
                        : undefined
                    }
                  />
                  {tagPickerOptions.map((option, optionIndex) => {
                    const isTagSelected = option.type === 'tag' && option.tagId === inspectorNode.tag_id

                    return (
                      <div
                        key={option.id}
                        ref={(element) => {
                          tagPickerOptionRefs.current[optionIndex] = element
                        }}
                        id={`inspector-tag-option-${option.id}`}
                        className={[
                          'tag-picker__row',
                          option.type === 'clear' ? 'tag-picker__option--muted' : '',
                          option.type === 'create' ? 'tag-picker__option--create' : '',
                          isTagSelected ? 'is-selected' : '',
                          optionIndex === activeTagOptionIndex ? 'is-active' : '',
                        ].filter(Boolean).join(' ')}
                        onMouseEnter={() => setActiveTagOptionIndex(optionIndex)}
                        role="option"
                        aria-selected={optionIndex === activeTagOptionIndex}
                      >
                        {option.type === 'tag' ? (
                          <label
                            className="tag-picker__color"
                            style={getTagAccentStyle(option.color)}
                            aria-label={`Change ${option.label} color`}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <input
                              type="color"
                              className="tag-picker__color-input"
                              value={option.color}
                              onChange={(event) => {
                                void handleInspectorTagColorChange(option.tagId, event.target.value)
                              }}
                            />
                          </label>
                        ) : (
                          <span className="tag-picker__spacer" aria-hidden="true" />
                        )}
                        <button
                          type="button"
                          className="tag-picker__option"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            chooseTagPickerOption(option)
                          }}
                        >
                          {option.type === 'tag' ? (
                            <span
                              className="tag-picker__label"
                              style={getTagAccentStyle(option.color)}
                            >
                              {option.label}
                            </span>
                          ) : (
                            option.label
                          )}
                        </button>
                        {option.type === 'tag' ? (
                          <button
                            type="button"
                            className="tag-picker__delete"
                            aria-label={`Delete ${option.label} tag`}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleDeleteInspectorTag(option.tagId, option.label)
                            }}
                          >
                            x
                          </button>
                        ) : (
                          <span className="tag-picker__spacer" aria-hidden="true" />
                        )}
                      </div>
                    )
                  })}
                  {tagPickerOptions.length === 0 ? (
                    <span className="tag-picker__empty">No matching tags.</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {isRemoteGraphReady ? (
            <section className="ai-summary-panel" aria-label="AI person summary">
              <div className="ai-summary-panel__header">
                <div className="ai-summary-panel__text">
                  <span className="ai-summary-panel__label">AI summary</span>
                  <span className="ai-summary-panel__meta">
                    {inspectorPersonAiNote?.status === 'pending'
                      ? 'Refreshing selected person'
                      : inspectorPersonAiNote?.updated_at
                        ? `Updated ${new Date(inspectorPersonAiNote.updated_at).toLocaleDateString()}`
                        : 'Not created yet'}
                  </span>
                </div>
                <button
                  type="button"
                  className="ai-summary-panel__button"
                  onClick={() => {
                    void handleRefreshPersonAiNote()
                  }}
                  disabled={inspectorPersonAiNote?.status === 'pending'}
                >
                  {inspectorPersonAiNote?.status === 'pending' ? 'Working...' : 'Refresh'}
                </button>
              </div>
              {inspectorPersonAiNote?.summary ? (
                <p className="ai-summary-panel__summary">{inspectorPersonAiNote.summary}</p>
              ) : (
                <p className="ai-summary-panel__summary">
                  Refresh sends this person, tag, and notes to AI. Search uses only selected candidates.
                </p>
              )}
              {inspectorPersonAiNote?.error_message ? (
                <p className="ai-summary-panel__error">{inspectorPersonAiNote.error_message}</p>
              ) : null}
            </section>
          ) : null}

          <div className="note-list">
            {inspectorNodeNotes.map((note) => {
              const draft = noteDrafts[note.id] ?? {
                title: note.title,
                body: note.body,
              }
              const isCollapsed = collapsedNotes[note.id] ?? true

              return (
                <article key={note.id} className={`note-card${isCollapsed ? ' is-collapsed' : ''}`}>
                  <div className="note-card__header">
                    <button
                      type="button"
                      className="note-card__icon"
                      onClick={() => toggleNoteCollapse(note.id)}
                      aria-label={isCollapsed ? 'Expand note' : 'Collapse note'}
                    >
                      {isCollapsed ? '>' : 'v'}
                    </button>
                    <input
                      className="note-card__title"
                      value={draft.title}
                      onChange={(event) => updateNoteDraft(note.id, 'title', event.target.value)}
                      onKeyDown={(event) => handleExistingNoteTitleKeyDown(note.id, event)}
                      onBlur={() => {
                        void persistNote(note)
                      }}
                      disabled={!isGraphReady}
                      placeholder="# Title"
                    />
                    {isGraphReady ? (
                      <button
                        type="button"
                        className="note-card__icon note-card__icon--danger"
                        aria-label="Delete note"
                        onClick={() => {
                          void deleteNote(note.id)
                        }}
                      >
                        x
                      </button>
                    ) : null}
                  </div>
                  {!isCollapsed ? (
                    <textarea
                      ref={(element) => {
                        noteBodyRefs.current[note.id] = element
                        autoResizeTextarea(element)
                      }}
                      className="note-card__body"
                      value={draft.body}
                      onChange={(event) => {
                        autoResizeTextarea(event.currentTarget)
                        updateNoteDraft(note.id, 'body', event.target.value)
                      }}
                      onBlur={() => {
                        void persistNote(note)
                      }}
                      disabled={!isGraphReady}
                      placeholder="Write a note"
                      rows={1}
                    />
                  ) : null}
                </article>
              )
            })}

            <article className="note-card note-card--draft">
              <div className="note-card__composer-shell">
              <textarea
                ref={newNoteTextareaRef}
                className="note-card__composer"
                value={newNoteText}
                onChange={(event) => {
                  setNewNoteText(event.target.value)
                  autoResizeTextarea(event.currentTarget)
                }}
                onKeyDown={(event) => {
                  void handleNewNoteKeyDown(event)
                }}
                onBlur={() => {
                  void handleNewNoteBlur()
                }}
                disabled={!isGraphReady}
                placeholder={'Write a note\nTitle on the first line, details below'}
                rows={4}
              />
              </div>
            </article>
          </div>

          {!inspectorNode.is_root && isGraphReady ? (
            <button
              type="button"
              className="danger-button"
              onClick={() => {
                void handleDeletePerson()
              }}
            >
              Delete person
            </button>
          ) : null}
        </aside>
      ) : null}

      <section
        ref={boardRef}
        className={`board-viewport${isDraggingBoard ? ' is-dragging' : ''}${isVeryDenseGraph ? ' is-very-dense-graph' : ''}`}
        onPointerDown={(event) => {
          flushDraftNoteOnBoardPointerDown()
          startBoardDragging(event)
        }}
        onDoubleClick={handleBoardDoubleClick}
        onContextMenu={(event) => {
          event.preventDefault()
        }}
        aria-label="Social network graph canvas"
      >
        <div
          ref={boardSurfaceRef}
          className="board-surface"
          style={
            {
              '--dot-gap': `${GRID_GAP}px`,
              '--major-dot-gap': `${MAJOR_GRID_GAP}px`,
              '--dot-size': `${DOT_SIZE}px`,
              '--major-dot-size': `${MAJOR_DOT_SIZE}px`,
              '--board-offset-x': '0px',
              '--board-offset-y': '0px',
            } as BoardStyle
          }
        />
        <canvas ref={graphCanvasRef} className="graph-canvas" aria-hidden="true" />
        <div ref={graphLayerRef} className="graph-layer">
          <svg
            className="graph-connections"
            viewBox={`${-LARGE_GRAPH_SVG_SIZE / 2} ${-LARGE_GRAPH_SVG_SIZE / 2} ${LARGE_GRAPH_SVG_SIZE} ${LARGE_GRAPH_SVG_SIZE}`}
            aria-hidden="true"
          >
            {visibleNodeGroupBubbles.map((groupBubble) => (
              <path
                key={groupBubble.id}
                className="node-group-bubble"
                d={groupBubble.path}
                style={{
                  fill: groupBubble.fill,
                  stroke: groupBubble.stroke,
                }}
              />
            ))}

            {renderedBoardConnections.map((edge) => {
              const fromNode = nodesById[edge.person_a_id]
              const toNode = nodesById[edge.person_b_id]
              if (!fromNode || !toNode) return null

              return (
                <GraphEdgePath
                  key={edge.id}
                  edge={edge}
                  fromNode={fromNode}
                  toNode={toNode}
                  isSelected={edge.id === selectedConnectionId}
                  onSelect={selectConnection}
                />
              )
            })}

            {previewPath ? (
              <path
                className="graph-edge graph-edge--preview"
                d={`M ${previewPath.start.x} ${previewPath.start.y} C ${previewPath.controlA.x} ${previewPath.controlA.y}, ${previewPath.controlB.x} ${previewPath.controlB.y}, ${previewPath.end.x} ${previewPath.end.y}`}
              />
            ) : null}
          </svg>
          {renderedBoardNodes.map((node) => (
            <GraphNodeCard
              key={node.id}
              node={node}
              isSelected={node.id === selectedNode?.id || multiSelectedNodeIdSet.has(node.id)}
              tagColor={node.tag_id ? tagColorById[node.tag_id] : null}
              showLabel={shouldShowGraphLabels || node.is_root || node.id === selectedNode?.id}
              onPointerDown={startNodeInteraction}
              onClick={handleNodeClick}
            />
          ))}
        </div>

        {areaSelection ? (
          <div
            className="board-selection-box"
            style={{
              left: `${Math.min(areaSelection.startClientX, areaSelection.currentClientX) - areaSelection.viewportLeft}px`,
              top: `${Math.min(areaSelection.startClientY, areaSelection.currentClientY) - areaSelection.viewportTop}px`,
              width: `${Math.abs(areaSelection.currentClientX - areaSelection.startClientX)}px`,
              height: `${Math.abs(areaSelection.currentClientY - areaSelection.startClientY)}px`,
            }}
          />
        ) : null}

        {selectedConnectionId && connectionMenuPosition ? (
          <div
            className="connection-menu"
            style={{
              left: `${connectionMenuPosition.x}px`,
              top: `${connectionMenuPosition.y}px`,
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="connection-menu__button"
              onClick={() => {
                void handleDeleteSelectedConnection()
              }}
            >
              Delete connection
            </button>
          </div>
        ) : null}
      </section>

      <div ref={zoomIndicatorRef} className="zoom-indicator" aria-live="polite">
        {zoomPercentage}%
      </div>
    </main>
  )
}

function screenToWorld(
  clientX: number,
  clientY: number,
  boardElement: HTMLElement | null,
  offset: Offset,
  scale: number,
) {
  const viewport = boardElement?.getBoundingClientRect()
  if (!viewport) return null

  return {
    x: (clientX - viewport.left - viewport.width / 2 - offset.x) / scale,
    y: (clientY - viewport.top - viewport.height / 2 - offset.y) / scale,
  }
}

function getLinkPath(fromNode?: PersonNode, toNode?: Offset | null) {
  if (!fromNode || !toNode) return null

  const dx = toNode.x - fromNode.x
  const dy = toNode.y - fromNode.y
  const distance = Math.hypot(dx, dy)
  if (distance < MIN_LINK_VISIBLE_LENGTH) return null

  const unitX = dx / distance
  const unitY = dy / distance
  const endpointInset = Math.min(NODE_RADIUS, Math.max(0, distance / 2 - MIN_LINK_VISIBLE_LENGTH / 2))
  const visibleDistance = Math.max(0, distance - endpointInset * 2)
  const curve = Math.min(44, visibleDistance * 0.18)
  const start = {
    x: fromNode.x + unitX * endpointInset,
    y: fromNode.y + unitY * endpointInset,
  }
  const end = {
    x: toNode.x - unitX * endpointInset,
    y: toNode.y - unitY * endpointInset,
  }

  return {
    start,
    end,
    controlA: {
      x: start.x + unitX * curve,
      y: start.y + unitY * curve,
    },
    controlB: {
      x: end.x - unitX * curve,
      y: end.y - unitY * curve,
    },
  }
}

function clampScale(value: number) {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, value))
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function normalizeNoteTitle(value: string) {
  const trimmedValue = value.trim()
  if (!trimmedValue) return 'Untitled note'

  return trimmedValue.replace(/^#+\s*/, '').trim() || 'Untitled note'
}

function parseNoteContent(value: string) {
  const normalizedValue = value.replace(/\r\n/g, '\n').trim()
  if (!normalizedValue) {
    return { title: '', body: '' }
  }

  const [rawTitle, ...bodyLines] = normalizedValue.split('\n')

  return {
    title: normalizeNoteTitle(rawTitle),
    body: bodyLines.join('\n').trim(),
  }
}

function extractTagTrigger(value: string, caretIndex: number) {
  const beforeCaret = value.slice(0, caretIndex)
  const match = beforeCaret.match(/(?:^|\s)#([^\s#]*)$/)
  if (!match || match.index === undefined) return null

  const prefixOffset = match[0].startsWith('#') ? 0 : 1
  const start = match.index + prefixOffset

  return {
    start,
    end: caretIndex,
    query: match[1] ?? '',
  }
}

function autoResizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) return

  element.style.height = '0px'
  element.style.height = `${element.scrollHeight}px`
}

function loadTagColorDrafts() {
  const savedDrafts = window.localStorage.getItem(TAG_COLOR_STORAGE_KEY)
  if (!savedDrafts) return {}

  try {
    const parsedDrafts = JSON.parse(savedDrafts) as Record<string, string>

    return Object.fromEntries(
      Object.entries(parsedDrafts).map(([tagId, color]) => [tagId, normalizeTagColor(color)]),
    )
  } catch {
    window.localStorage.removeItem(TAG_COLOR_STORAGE_KEY)
    return {}
  }
}

function saveTagColorDraft(tagId: string, color: string) {
  let currentDrafts: Record<string, string> = {}
  const savedDrafts = window.localStorage.getItem(TAG_COLOR_STORAGE_KEY)

  if (savedDrafts) {
    try {
      currentDrafts = JSON.parse(savedDrafts) as Record<string, string>
    } catch {
      currentDrafts = {}
    }
  }

  window.localStorage.setItem(
    TAG_COLOR_STORAGE_KEY,
    JSON.stringify({
      ...currentDrafts,
      [tagId]: normalizeTagColor(color),
    }),
  )
}

function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

export default App
