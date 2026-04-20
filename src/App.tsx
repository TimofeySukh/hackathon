import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  WheelEvent as ReactWheelEvent,
} from 'react'

import { useAuth } from './lib/useAuth'
import { normalizeTagName, searchPeopleWithAi } from './lib/graphStorage'
import type { Connection, PersonNode, PersonNote, Tag } from './lib/graphTypes'
import { DEFAULT_TAG_COLOR, DEFAULT_TAGS, normalizeTagColor } from './lib/tagPalette'
import { useBoardGraph } from './lib/useBoardGraph'

type Theme = 'dark' | 'light'

type Offset = {
  x: number
  y: number
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
  nodeId: string
  startClientX: number
  startClientY: number
  originX: number
  originY: number
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

type BoardStyle = CSSProperties & {
  '--board-offset-x': string
  '--board-offset-y': string
  '--dot-gap': string
  '--major-dot-gap': string
  '--dot-size': string
  '--major-dot-size': string
}

type TagColorStyle = CSSProperties & {
  '--tag-color': string
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
const MIN_SCALE = 0.2
const MAX_SCALE = 2.5
const GRID_GAP = 12
const MAJOR_GRID_GAP = 96
const DOT_SIZE = 0.65
const MAJOR_DOT_SIZE = 2
const TAG_PRESET_COLORS = ['#ff6b6b', '#ff9f43', '#ffd93d', '#4cd137', '#2ed573', '#1e90ff', '#3742fa', '#a55eea', '#ff7eb6', '#8affd6']
const NODE_CLICK_DRAG_THRESHOLD = 4
const NODE_RADIUS = 9
const NODE_HIT_RADIUS = 31
const CREATE_THRESHOLD = 18
const WHEEL_ZOOM_INTENSITY = 0.0016
const INSPECTOR_ANCHOR_GAP = 40
const INSPECTOR_VIEWPORT_MARGIN = 16
const TRACKPAD_PAN_IDLE_MS = 320
const IS_MAC_PLATFORM = /Mac|iPhone|iPad|iPod/i.test(window.navigator.platform)

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

type GraphEdgeProps = {
  edge: Connection
  fromNode: PersonNode
  toNode: PersonNode
  isSelected: boolean
  onSelect: (connectionId: string, event: ReactMouseEvent<SVGPathElement>) => void
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
        onMouseDown={(event) => onSelect(edge.id, event)}
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
  isGraphReady: boolean
  connectionModifierLabel: string
  onMouseDown: (node: PersonNode, event: ReactMouseEvent<HTMLButtonElement>) => void
  onClick: (node: PersonNode) => void
}

const GraphNodeCard = memo(function GraphNodeCard({
  node,
  isSelected,
  tagColor,
  showLabel,
  isGraphReady,
  connectionModifierLabel,
  onMouseDown,
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
        title={
          isGraphReady
            ? node.is_root
              ? `Hold ${connectionModifierLabel} and drag to connect`
              : `Drag to move. Hold ${connectionModifierLabel} and drag to connect.`
            : 'Sign in with Google to edit'
        }
        onMouseDown={(event) => onMouseDown(node, event)}
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
    connections,
    status: graphStatus,
    error: graphError,
    createPerson,
    updatePerson,
    movePerson,
    deletePerson,
    createConnection,
    deleteConnection,
    createTag,
    deleteTag,
    updateTag,
    createNote,
    updateNote,
    deleteNote,
  } = useBoardGraph(session?.user ?? null)

  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    return savedTheme === 'light' ? 'light' : 'dark'
  })
  const [zoomPercentage, setZoomPercentage] = useState(100)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [inspectorNodeId, setInspectorNodeId] = useState<string | null>(null)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
  const [connectionMenuPosition, setConnectionMenuPosition] = useState<Offset | null>(null)
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDrag | null>(null)
  const [nodeDrag, setNodeDrag] = useState<NodeDrag | null>(null)
  const [draggedPositions, setDraggedPositions] = useState<Record<string, Offset>>({})
  const [nameDraft, setNameDraft] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false)
  const [activeTagOptionIndex, setActiveTagOptionIndex] = useState(0)
  const [isTagsMenuOpen, setIsTagsMenuOpen] = useState(false)
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
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false)
  const connectionModifierLabel = IS_MAC_PLATFORM ? 'Command' : 'Control'

  const boardRef = useRef<HTMLElement | null>(null)
  const boardSurfaceRef = useRef<HTMLDivElement | null>(null)
  const graphLayerRef = useRef<HTMLDivElement | null>(null)
  const tagsMenuRef = useRef<HTMLDivElement | null>(null)
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
  const pendingViewportRef = useRef<{ offset: Offset; scale: number } | null>(null)
  const viewportFrameRef = useRef<number | null>(null)
  const connectionDragStateRef = useRef<ConnectionDrag | null>(null)
  const nodeDragStateRef = useRef<NodeDrag | null>(null)
  const draggedPositionsRef = useRef<Record<string, Offset>>({})
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
  })

  const isAuthenticated = status === 'authenticated' && Boolean(session?.user)
  const isGraphReady = isAuthenticated && graphStatus === 'ready' && Boolean(board)
  const boardNodes = useMemo(
    () =>
      (isGraphReady ? people : [ANONYMOUS_ROOT]).map((node) => {
        const dragPosition = draggedPositions[node.id]
        return dragPosition ? { ...node, ...dragPosition } : node
      }),
    [draggedPositions, isGraphReady, people],
  )
  const boardConnections = useMemo(
    () => (isGraphReady ? connections : []),
    [connections, isGraphReady],
  )
  const nodesById = useMemo(
    () => Object.fromEntries(boardNodes.map((node) => [node.id, node])) as Record<string, PersonNode>,
    [boardNodes],
  )
  const tagMenuItems = useMemo<TagMenuItem[]>(
    () =>
      isGraphReady
        ? tags.map((tag) => ({
            id: tag.id,
            name: tag.name,
            color: normalizeTagColor(tagColorDrafts[tag.id] ?? tag.color ?? DEFAULT_TAG_COLOR),
            isPersisted: true,
          }))
        : DEFAULT_TAGS.map((tag) => ({
            id: `default-${tag.name}`,
            name: tag.name,
            color: tag.color,
            isPersisted: false,
          })),
    [isGraphReady, tagColorDrafts, tags],
  )
  const tagColorById = useMemo(
    () =>
      Object.fromEntries(
        tags.map((tag) => [
          tag.id,
          normalizeTagColor(tagColorDrafts[tag.id] ?? tag.color ?? DEFAULT_TAG_COLOR),
        ]),
      ) as Record<string, string>,
    [tagColorDrafts, tags],
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
  const isDenseGraph = visibleBoardNodes.length >= 24
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
    () => notes.filter((note) => note.person_id === inspectorNode?.id),
    [inspectorNode?.id, notes],
  )
  const tagsById = useMemo(
    () => Object.fromEntries(tags.map((tag) => [tag.id, tag])) as Record<string, Tag>,
    [tags],
  )
  const selectedInspectorTag = inspectorNode?.tag_id ? tagsById[inspectorNode.tag_id] ?? null : null
  const filteredInspectorTags = useMemo(() => {
    const normalizedDraft = tagDraft.trim().toLowerCase()
    if (!normalizedDraft) return tags

    return tags.filter((tag) => tag.name.toLowerCase().includes(normalizedDraft))
  }, [tagDraft, tags])
  const canCreateInspectorTag = useMemo(() => {
    const normalizedDraft = normalizeTagName(tagDraft)
    if (!normalizedDraft || !isGraphReady) return false

    return !tags.some((tag) => normalizeTagName(tag.name).toLowerCase() === normalizedDraft.toLowerCase())
  }, [isGraphReady, tagDraft, tags])
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

    for (const note of notes) {
      if (!nextNotesByPersonId[note.person_id]) {
        nextNotesByPersonId[note.person_id] = []
      }
      nextNotesByPersonId[note.person_id].push(note)
    }

    return nextNotesByPersonId
  }, [notes])
  const searchResults: SearchResult[] = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (!normalizedQuery) return []

    return (isGraphReady ? people : [ANONYMOUS_ROOT])
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
  }, [isGraphReady, notesByPersonId, people, searchQuery, tagsById])
  const visibleSearchResults = aiSearchQuery === searchQuery.trim() ? aiSearchResults : searchResults

  const error = authError ?? graphError

  const requestLogin = useCallback(() => {
    if (status === 'authenticated' || status === 'loading') return false

    setIsLoginPromptOpen(true)
    return true
  }, [status])

  useEffect(() => {
    connectionDragStateRef.current = connectionDrag
  }, [connectionDrag])

  useEffect(() => {
    nodeDragStateRef.current = nodeDrag
  }, [nodeDrag])

  useEffect(() => {
    draggedPositionsRef.current = draggedPositions
  }, [draggedPositions])

  const closeInspectorUi = useCallback(() => {
    setInspectorNodeId(null)
    setSelectedConnectionId(null)
    setConnectionMenuPosition(null)
    setIsTagPickerOpen(false)
    setActiveTagOptionIndex(0)
  }, [])

  const closeTransientUi = useCallback(() => {
    setIsTagsMenuOpen(false)
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

    if (boardSurfaceRef.current) {
      const viewportWidth = boardRef.current?.clientWidth ?? 0
      const viewportHeight = boardRef.current?.clientHeight ?? 0
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
  }, [])

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
      if (trackpadPan.timeoutId !== null) {
        window.clearTimeout(trackpadPan.timeoutId)
      }
    }
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
        return
      }

      newNoteTextareaRef.current?.focus()
      autoResizeTextarea(newNoteTextareaRef.current)
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

      if (distance < CREATE_THRESHOLD) {
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
    const handleMouseMove = (event: MouseEvent) => {
      const currentConnectionDrag = connectionDragStateRef.current
      if (currentConnectionDrag) {
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
        setDraggedPositions((currentPositions) => {
          const nextPositions = {
          ...currentPositions,
          [currentNodeDrag.nodeId]: {
            x:
              currentNodeDrag.originX +
              (event.clientX - currentNodeDrag.startClientX) / viewportRef.current.scale,
            y:
              currentNodeDrag.originY +
              (event.clientY - currentNodeDrag.startClientY) / viewportRef.current.scale,
          },
          }
          draggedPositionsRef.current = nextPositions
          return nextPositions
        })
        return
      }

      if (!boardDragRef.current.active) return

      const nextX = boardDragRef.current.originX + event.clientX - boardDragRef.current.startX
      const nextY = boardDragRef.current.originY + event.clientY - boardDragRef.current.startY

      queueViewportUpdate({ x: nextX, y: nextY }, viewportRef.current.scale)
    }

    const handleMouseUp = (event: MouseEvent) => {
      void (async () => {
        if (connectionDragStateRef.current) {
          await finishConnectionDrag(event.clientX, event.clientY)
          return
        }

        const currentNodeDrag = nodeDragStateRef.current
        if (currentNodeDrag) {
          const finalPosition = draggedPositionsRef.current[currentNodeDrag.nodeId]
          const movedDistance = Math.hypot(
            event.clientX - currentNodeDrag.startClientX,
            event.clientY - currentNodeDrag.startClientY,
          )
          suppressNodeClickRef.current = movedDistance > NODE_CLICK_DRAG_THRESHOLD
          setNodeDrag(null)
          nodeDragStateRef.current = null

          try {
            if (finalPosition) {
            const xChanged = Math.abs(finalPosition.x - currentNodeDrag.originX) > 0.001
            const yChanged = Math.abs(finalPosition.y - currentNodeDrag.originY) > 0.001

            if (xChanged || yChanged) {
              await movePerson(currentNodeDrag.nodeId, finalPosition.x, finalPosition.y)
            }
          }
          } finally {
            setDraggedPositions((currentPositions) => {
              const nextPositions = { ...currentPositions }
              delete nextPositions[currentNodeDrag.nodeId]
              draggedPositionsRef.current = nextPositions
              return nextPositions
            })
          }
          return
        }

        boardDragRef.current.active = false
        setIsDraggingBoard(false)
      })()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [finishConnectionDrag, movePerson, queueViewportUpdate])

  function startBoardDragging(event: ReactMouseEvent<HTMLElement>) {
    if (event.button !== 0 || connectionDrag || nodeDrag) return

    setSelectedConnectionId(null)
    setConnectionMenuPosition(null)
    boardDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: viewportRef.current.offset.x,
      originY: viewportRef.current.offset.y,
      active: true,
    }

    setIsDraggingBoard(true)
    setInspectorNodeId(null)
  }

  const startNodeInteraction = useCallback((node: PersonNode, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return

    event.stopPropagation()
    if (requestLogin()) return

    boardDragRef.current.active = false
    setIsDraggingBoard(false)
    setSelectedNodeId(node.id)
    setInspectorNodeId(null)
    setSelectedConnectionId(null)
    setConnectionMenuPosition(null)

    if (!isGraphReady) return

    const isConnectionModifierPressed = IS_MAC_PLATFORM ? event.metaKey : event.ctrlKey

    if (!isConnectionModifierPressed && !node.is_root) {
      const nextNodeDrag = {
        nodeId: node.id,
        startClientX: event.clientX,
        startClientY: event.clientY,
        originX: node.x,
        originY: node.y,
      }
      nodeDragStateRef.current = nextNodeDrag
      setNodeDrag(nextNodeDrag)
      return
    }

    if (!isConnectionModifierPressed) return

    const view = viewportRef.current
    const worldPoint = screenToWorld(
      event.clientX,
      event.clientY,
      boardRef.current,
      view.offset,
      view.scale,
    )
    const nextConnectionDrag = {
      fromId: node.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      worldX: worldPoint?.x ?? node.x,
      worldY: worldPoint?.y ?? node.y,
    }
    connectionDragStateRef.current = nextConnectionDrag
    setConnectionDrag(nextConnectionDrag)
  }, [isGraphReady, requestLogin])

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
    } as CSSProperties
  }

  async function saveInspectorName() {
    if (!inspectorNode || !isGraphReady) return

    const nextValue = nameDraft
    const nextName = nextValue.trim()
    if (nextName === inspectorNode.name) return

    await updatePerson({
      id: inspectorNode.id,
      name: nextName,
    })
  }

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

    await createTag(nextName)
  }

  function previewTagColor(tagId: string, color: string) {
    const nextColor = normalizeTagColor(color)
    setTagColorDrafts((currentDrafts) => ({
      ...currentDrafts,
      [tagId]: nextColor,
    }))
    saveTagColorDraft(tagId, nextColor)
  }

  async function persistTagColor(tagId: string) {
    const color = tagColorDrafts[tagId]
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

    setAiSearchStatus('loading')
    setAiSearchError(null)

    try {
      const results = await searchPeopleWithAi(query)
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

  const selectConnection = useCallback((connectionId: string, event: ReactMouseEvent<SVGPathElement>) => {
    if (!isGraphReady) return

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
    if (requestLogin()) return
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
    openInspectorForNode(node)
  }, [inspectorNodeId, openInspectorForNode, requestLogin])

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
      {isLoginPromptOpen ? (
        <div className="login-prompt" role="presentation" onMouseDown={() => setIsLoginPromptOpen(false)}>
          <section
            className="login-prompt__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-prompt-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p className="login-prompt__eyebrow">Login Required</p>
            <h2 id="login-prompt-title" className="login-prompt__title">
              {status === 'unconfigured' ? 'Connect Supabase to unlock editing' : 'Sign in to edit your board'}
            </h2>
            <p className="login-prompt__body">
              {status === 'unconfigured'
                ? 'Google sign-in is not configured in this environment yet, so editing and saving are unavailable here.'
                : 'You need an account to move nodes, create connections, edit notes, and save tags.'}
            </p>
            <div className="login-prompt__actions">
              <button
                type="button"
                className="login-prompt__button login-prompt__button--ghost"
                onClick={() => setIsLoginPromptOpen(false)}
              >
                Not now
              </button>
              <button
                type="button"
                className="login-prompt__button"
                onClick={() => {
                  setIsLoginPromptOpen(false)
                  void signInWithGoogle()
                }}
                disabled={status === 'loading' || status === 'unconfigured'}
              >
                {status === 'unconfigured' ? 'Sign-in unavailable' : 'Sign in with Google'}
              </button>
            </div>
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
                                    void persistTagColor(tag.id)
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
                                  previewTagColor(tag.id, event.target.value)
                                  void persistTagColor(tag.id)
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
                    if (requestLogin()) return
                    void handleCreateMenuTag()
                  }}
                  disabled={status === 'loading' || status === 'unconfigured'}
                >
                  + New tag
                </button>
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
                  requestLogin()
                  setIsSearchOpen(true)
                  setIsTagsMenuOpen(false)
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
                  <span>{aiSearchStatus === 'loading' ? 'Asking AI...' : 'Press Enter for AI search.'}</span>
                  {searchQuery.trim() ? (
                    <button
                      type="button"
                      className="search-panel__ai-button"
                      onClick={() => {
                        if (requestLogin()) return
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
                        {graphStatus === 'loading' ? 'Loading your graph' : board?.title ?? 'Personal board'}
                      </span>
                    </div>
                    <button type="button" className="account-panel__button" onClick={signOut}>
                      Sign out
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
                tagTriggerRef.current?.focus()
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
        className={`board-viewport${isDraggingBoard ? ' is-dragging' : ''}${isDenseGraph ? ' is-dense-graph' : ''}${isVeryDenseGraph ? ' is-very-dense-graph' : ''}`}
        onMouseDown={(event) => {
          flushDraftNoteOnBoardPointerDown()
          startBoardDragging(event)
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
        <div ref={graphLayerRef} className="graph-layer">
          <svg
            className="graph-connections"
            viewBox="-2200 -2200 4400 4400"
            aria-hidden="true"
          >
            {visibleBoardConnections.map((edge) => {
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
          {visibleBoardNodes.map((node) => (
            <GraphNodeCard
              key={node.id}
              node={node}
              isSelected={node.id === selectedNode?.id}
              tagColor={node.tag_id ? tagColorById[node.tag_id] : null}
              showLabel={!isDenseGraph || node.id === selectedNode?.id || node.is_root}
              isGraphReady={isGraphReady}
              connectionModifierLabel={connectionModifierLabel}
              onMouseDown={startNodeInteraction}
              onClick={handleNodeClick}
            />
          ))}
        </div>

        {selectedConnectionId && connectionMenuPosition ? (
          <div
            className="connection-menu"
            style={{
              left: `${connectionMenuPosition.x}px`,
              top: `${connectionMenuPosition.y}px`,
            }}
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
  const distance = Math.hypot(dx, dy) || 1
  const unitX = dx / distance
  const unitY = dy / distance
  const curve = Math.min(44, distance * 0.18)

  return {
    start: {
      x: fromNode.x + unitX * NODE_RADIUS,
      y: fromNode.y + unitY * NODE_RADIUS,
    },
    end: {
      x: toNode.x - unitX * NODE_RADIUS,
      y: toNode.y - unitY * NODE_RADIUS,
    },
    controlA: {
      x: fromNode.x + unitX * (NODE_RADIUS + curve),
      y: fromNode.y + unitY * (NODE_RADIUS + curve),
    },
    controlB: {
      x: toNode.x - unitX * (NODE_RADIUS + curve),
      y: toNode.y - unitY * (NODE_RADIUS + curve),
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
