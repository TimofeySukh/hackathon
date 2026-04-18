import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'

import { useAuth } from './lib/useAuth'
import { normalizeTagName, searchPeopleWithAi } from './lib/graphStorage'
import type { PersonNode, PersonNote, Tag } from './lib/graphTypes'
import { DEFAULT_TAG_COLOR, DEFAULT_TAGS, normalizeTagColor } from './lib/tagPalette'
import { useBoardGraph } from './lib/useBoardGraph'

type Theme = 'dark' | 'light'

type Offset = {
  x: number
  y: number
}

type HighlightSpot = Offset & {
  id: number
  createdAt: number
  tailX: number
  tailY: number
  tailCore: number
  tailSize: number
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

type HighlightSpotStyle = CSSProperties & {
  '--highlight-x': string
  '--highlight-y': string
  '--board-offset-x': string
  '--board-offset-y': string
  '--dot-gap': string
  '--major-dot-gap': string
  '--dot-size': string
  '--major-dot-size': string
  '--highlight-tail-x': string
  '--highlight-tail-y': string
  '--highlight-tail-core': string
  '--highlight-tail-size': string
  opacity: number
}

type TagColorStyle = CSSProperties & {
  '--tag-color': string
}

type TagPaletteStyle = CSSProperties & {
  '--palette-color': string
  '--palette-cursor-x': string
  '--palette-cursor-y': string
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

const THEME_STORAGE_KEY = 'hackathon-theme'
const TAG_COLOR_STORAGE_KEY = 'hackathon-tag-colors'
const MIN_SCALE = 0.2
const MAX_SCALE = 2.5
const GRID_GAP = 12
const MAJOR_GRID_GAP = 96
const DOT_SIZE = 0.65
const MAJOR_DOT_SIZE = 2
const HIGHLIGHT_LIFETIME_MS = 420
const HIGHLIGHT_DISTANCE = 12
const HIGHLIGHT_LIMIT = 28
const HIGHLIGHT_RADIUS = 56
const HIGHLIGHT_TICK_MS = 50
const HIGHLIGHT_TAIL_START = 18
const HIGHLIGHT_TAIL_LIMIT = 48
const NODE_RADIUS = 9
const NODE_HIT_RADIUS = 31
const CREATE_THRESHOLD = 18
const WHEEL_ZOOM_INTENSITY = 0.0016

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
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [zoomPercentage, setZoomPercentage] = useState(100)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [inspectorNodeId, setInspectorNodeId] = useState<string | null>(null)
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDrag | null>(null)
  const [nodeDrag, setNodeDrag] = useState<NodeDrag | null>(null)
  const [draggedPositions, setDraggedPositions] = useState<Record<string, Offset>>({})
  const [nameDraft, setNameDraft] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [isTagsMenuOpen, setIsTagsMenuOpen] = useState(false)
  const [activeColorTagId, setActiveColorTagId] = useState<string | null>(null)
  const [tagColorDrafts, setTagColorDrafts] = useState<Record<string, string>>(() =>
    loadTagColorDrafts(),
  )
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [newNoteBody, setNewNoteBody] = useState('')
  const [noteDrafts, setNoteDrafts] = useState<Record<string, NoteDraft>>({})
  const [highlightSpots, setHighlightSpots] = useState<HighlightSpot[]>([])
  const [pointerPosition, setPointerPosition] = useState<Offset | null>(null)
  const [highlightClock, setHighlightClock] = useState(() => Date.now())
  const [isDraggingBoard, setIsDraggingBoard] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [aiSearchQuery, setAiSearchQuery] = useState('')
  const [aiSearchResults, setAiSearchResults] = useState<SearchResult[]>([])
  const [aiSearchStatus, setAiSearchStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [aiSearchError, setAiSearchError] = useState<string | null>(null)

  const boardRef = useRef<HTMLElement | null>(null)
  const boardSurfaceRef = useRef<HTMLDivElement | null>(null)
  const graphLayerRef = useRef<HTMLDivElement | null>(null)
  const inspectorPanelRef = useRef<HTMLElement | null>(null)
  const zoomIndicatorRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const highlightIdRef = useRef(0)
  const lastHighlightSpotRef = useRef<Offset | null>(null)
  const inspectorWorldPositionRef = useRef<Offset | null>(null)
  const viewportRef = useRef({ offset: { x: 0, y: 0 }, scale: 1 })
  const pendingViewportRef = useRef<{ offset: Offset; scale: number } | null>(null)
  const viewportFrameRef = useRef<number | null>(null)
  const gestureScaleRef = useRef(1)
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
  const defaultSelectedNodeId = boardNodes.find((node) => node.is_root)?.id ?? boardNodes[0]?.id ?? null
  const activeSelectedNodeId =
    selectedNodeId && nodesById[selectedNodeId] ? selectedNodeId : defaultSelectedNodeId

  const selectedNode = useMemo(() => {
    if (boardNodes.length === 0) return null
    if (activeSelectedNodeId) return nodesById[activeSelectedNodeId] ?? null
    return null
  }, [activeSelectedNodeId, boardNodes.length, nodesById])

  const inspectorNode = useMemo(() => {
    if (!inspectorNodeId) return null
    return nodesById[inspectorNodeId] ?? null
  }, [inspectorNodeId, nodesById])

  const inspectorNodeNotes = useMemo(
    () => notes.filter((note) => note.person_id === inspectorNode?.id),
    [inspectorNode?.id, notes],
  )
  const tagsById = useMemo(
    () => Object.fromEntries(tags.map((tag) => [tag.id, tag])) as Record<string, Tag>,
    [tags],
  )
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

    return boardNodes
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
  }, [boardNodes, notesByPersonId, searchQuery, tagsById])
  const visibleSearchResults = aiSearchQuery === searchQuery.trim() ? aiSearchResults : searchResults

  const inspectorNodeConnections = useMemo(() => {
    if (!inspectorNode) return []

    return boardConnections
      .filter(
        (connection) =>
          connection.person_a_id === inspectorNode.id || connection.person_b_id === inspectorNode.id,
      )
      .map((connection) => {
        const otherPersonId =
          connection.person_a_id === inspectorNode.id
            ? connection.person_b_id
            : connection.person_a_id

        return {
          connection,
          otherPerson: nodesById[otherPersonId] ?? null,
        }
      })
      .filter((entry) => entry.otherPerson)
  }, [boardConnections, inspectorNode, nodesById])

  const error = authError ?? graphError

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!isSearchOpen) return

    searchInputRef.current?.focus()
  }, [isSearchOpen])

  const applyViewport = useCallback((nextOffset: Offset, nextScale: number) => {
    viewportRef.current = { offset: nextOffset, scale: nextScale }
    setOffset(nextOffset)
    setScale(nextScale)

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
      const inspectorX =
        viewportWidth / 2 + nextOffset.x + inspectorWorldPositionRef.current.x * nextScale
      const inspectorY =
        viewportHeight / 2 + nextOffset.y + inspectorWorldPositionRef.current.y * nextScale

      inspectorPanelRef.current.style.left = `${inspectorX}px`
      inspectorPanelRef.current.style.top = `${inspectorY}px`
      inspectorPanelRef.current.style.setProperty('--inspector-scale', `${nextScale}`)
    }

    const nextZoomPercentage = Math.round(nextScale * 100)
    if (zoomIndicatorRef.current) {
      zoomIndicatorRef.current.textContent = `${nextZoomPercentage}%`
    }
    setZoomPercentage((currentZoomPercentage) =>
      currentZoomPercentage === nextZoomPercentage ? currentZoomPercentage : nextZoomPercentage,
    )
  }, [])

  useEffect(() => {
    if (highlightSpots.length === 0) return undefined

    const intervalId = window.setInterval(() => {
      const now = Date.now()
      setHighlightClock(now)
      setHighlightSpots((currentSpots) =>
        currentSpots.filter((spot) => now - spot.createdAt < HIGHLIGHT_LIFETIME_MS),
      )
    }, HIGHLIGHT_TICK_MS)

    return () => window.clearInterval(intervalId)
  }, [highlightSpots.length])

  const addHighlightSpot = useCallback((clientX: number, clientY: number, force = false) => {
    const viewport = boardRef.current?.getBoundingClientRect()
    if (!viewport) return

    const now = Date.now()
    const nextSpot = {
      x: clientX - viewport.left,
      y: clientY - viewport.top,
    }
    const previousSpot = lastHighlightSpotRef.current
    const distanceFromPrevious = previousSpot
      ? Math.hypot(nextSpot.x - previousSpot.x, nextSpot.y - previousSpot.y)
      : Number.POSITIVE_INFINITY

    if (!force && distanceFromPrevious < HIGHLIGHT_DISTANCE) return

    const hasTail = previousSpot && Number.isFinite(distanceFromPrevious)
    const tailReach = hasTail
      ? Math.min(HIGHLIGHT_TAIL_LIMIT, Math.max(0, distanceFromPrevious - HIGHLIGHT_TAIL_START))
      : 0
    const tailUnitX =
      hasTail && distanceFromPrevious > 0 ? (nextSpot.x - previousSpot.x) / distanceFromPrevious : 0
    const tailUnitY =
      hasTail && distanceFromPrevious > 0 ? (nextSpot.y - previousSpot.y) / distanceFromPrevious : 0
    const tailSize = tailReach * 0.75

    const id = highlightIdRef.current + 1
    highlightIdRef.current = id
    lastHighlightSpotRef.current = nextSpot
    setPointerPosition(nextSpot)
    setHighlightClock(now)

    setHighlightSpots((currentSpots) => [
      ...currentSpots.slice(-HIGHLIGHT_LIMIT + 1),
      {
        id,
        createdAt: now,
        tailX: nextSpot.x - tailUnitX * tailReach,
        tailY: nextSpot.y - tailUnitY * tailReach,
        tailCore: tailSize * 0.36,
        tailSize,
        ...nextSpot,
      },
    ])
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

  useEffect(() => {
    applyViewport(viewportRef.current.offset, viewportRef.current.scale)

    return () => {
      if (viewportFrameRef.current !== null) {
        window.cancelAnimationFrame(viewportFrameRef.current)
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
  }, [applyViewport, inspectorNode])

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
        setSelectedNodeId(createdNode.id)
        setInspectorNodeId(null)
      } finally {
        setConnectionDrag(null)
      }
    },
    [boardNodes, connectionDrag, createConnection, createPerson, isGraphReady],
  )

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (connectionDrag) {
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
            ? {
                ...currentDrag,
                clientX: event.clientX,
                clientY: event.clientY,
                worldX: worldPoint?.x ?? currentDrag.worldX,
                worldY: worldPoint?.y ?? currentDrag.worldY,
              }
            : null,
        )
        return
      }

      if (nodeDrag) {
        setDraggedPositions((currentPositions) => ({
          ...currentPositions,
          [nodeDrag.nodeId]: {
            x: nodeDrag.originX + (event.clientX - nodeDrag.startClientX) / viewportRef.current.scale,
            y: nodeDrag.originY + (event.clientY - nodeDrag.startClientY) / viewportRef.current.scale,
          },
        }))
        return
      }

      if (!boardDragRef.current.active) return

      const nextX = boardDragRef.current.originX + event.clientX - boardDragRef.current.startX
      const nextY = boardDragRef.current.originY + event.clientY - boardDragRef.current.startY

      queueViewportUpdate({ x: nextX, y: nextY }, viewportRef.current.scale)
    }

    const handleMouseUp = (event: MouseEvent) => {
      void (async () => {
        if (connectionDrag) {
          await finishConnectionDrag(event.clientX, event.clientY)
          return
        }

        if (nodeDrag) {
          const finalPosition = draggedPositions[nodeDrag.nodeId]
          setNodeDrag(null)
          setDraggedPositions((currentPositions) => {
            const nextPositions = { ...currentPositions }
            delete nextPositions[nodeDrag.nodeId]
            return nextPositions
          })

          if (finalPosition) {
            const xChanged = Math.abs(finalPosition.x - nodeDrag.originX) > 0.001
            const yChanged = Math.abs(finalPosition.y - nodeDrag.originY) > 0.001

            if (xChanged || yChanged) {
              await movePerson(nodeDrag.nodeId, finalPosition.x, finalPosition.y)
            }
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
  }, [connectionDrag, draggedPositions, finishConnectionDrag, movePerson, nodeDrag, queueViewportUpdate])

  function startBoardDragging(event: ReactMouseEvent<HTMLElement>) {
    if (event.button !== 0 || connectionDrag || nodeDrag) return

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

  function startNodeInteraction(node: PersonNode, event: ReactMouseEvent<HTMLButtonElement>) {
    if (event.button !== 0) return

    event.stopPropagation()
    boardDragRef.current.active = false
    setIsDraggingBoard(false)
    setSelectedNodeId(node.id)
    setInspectorNodeId(null)

    if (!isGraphReady) return

    if (!event.altKey && !node.is_root) {
      setNodeDrag({
        nodeId: node.id,
        startClientX: event.clientX,
        startClientY: event.clientY,
        originX: node.x,
        originY: node.y,
      })
      return
    }

    if (!event.altKey) return

    const view = viewportRef.current
    const worldPoint = screenToWorld(
      event.clientX,
      event.clientY,
      boardRef.current,
      view.offset,
      view.scale,
    )
    setConnectionDrag({
      fromId: node.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      worldX: worldPoint?.x ?? node.x,
      worldY: worldPoint?.y ?? node.y,
    })
  }

  const moveWithWheel = useCallback((event: WheelEvent) => {
    event.preventDefault()
    const view = viewportRef.current
    const deltaMultiplier = event.deltaMode === 1 ? 16 : 1
    const deltaX = event.deltaX * deltaMultiplier
    const deltaY = event.deltaY * deltaMultiplier

    if (!event.ctrlKey) {
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
  }, [queueViewportUpdate, zoomAtClientPoint])

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

  async function handleTagSelection(nextTagId: string) {
    if (!inspectorNode || !isGraphReady) return

    await updatePerson({
      id: inspectorNode.id,
      tag_id: nextTagId || null,
    })
  }

  async function handleCreateTag() {
    if (!tagDraft.trim() || !inspectorNode || !isGraphReady) return

    const createdTag = await createTag(normalizeTagName(tagDraft))
    setTagDraft('')
    await updatePerson({
      id: inspectorNode.id,
      tag_id: createdTag.id,
    })
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

  async function handleDeleteMenuTag(tagId: string) {
    if (!isGraphReady) return

    await deleteTag(tagId)
    setActiveColorTagId((currentTagId) => (currentTagId === tagId ? null : currentTagId))
    setTagColorDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts }
      delete nextDrafts[tagId]
      window.localStorage.setItem(TAG_COLOR_STORAGE_KEY, JSON.stringify(nextDrafts))
      return nextDrafts
    })
  }

  const handleDeleteSelectedNode = useCallback(async (nodeId: string) => {
    await deletePerson(nodeId)
    setInspectorNodeId((currentNodeId) => (currentNodeId === nodeId ? null : currentNodeId))
    setSelectedNodeId(null)
  }, [deletePerson])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' || !isGraphReady || !selectedNode) return
      if (selectedNode.is_root || isEditableElement(event.target)) return

      event.preventDefault()
      void handleDeleteSelectedNode(selectedNode.id)
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDeleteSelectedNode, isGraphReady, selectedNode])

  function pickTagColor(tag: TagMenuItem, event: ReactPointerEvent<HTMLDivElement>) {
    if (!tag.isPersisted) return

    const bounds = event.currentTarget.getBoundingClientRect()
    const x = clamp((event.clientX - bounds.left) / bounds.width, 0, 1)
    const y = clamp((event.clientY - bounds.top) / bounds.height, 0, 1)
    const color = hsvToHex(x * 360, (1 - y) * 100, 100)

    previewTagColor(tag.id, color)
  }

  async function handleCreateNote() {
    if (!inspectorNode || !isGraphReady) return

    const title = newNoteTitle.trim() || 'Untitled note'
    const body = newNoteBody.trim()

    if (!title && !body) return

    await createNote(title, body, inspectorNode.id)
    setNewNoteTitle('')
    setNewNoteBody('')
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

    const nextTitle = draft.title.trim() || 'Untitled note'
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
    setSelectedNodeId(node.id)
    setInspectorNodeId(node.id)
    setNameDraft(node.name)
    setIsSearchOpen(false)
  }

  const previewPath = connectionDrag
    ? getLinkPath(nodesById[connectionDrag.fromId], {
        x: connectionDrag.worldX,
        y: connectionDrag.worldY,
      })
    : null

  function getHighlightOpacity(spot: HighlightSpot) {
    const age = highlightClock - spot.createdAt
    const ageOpacity = Math.max(0, 1 - age / HIGHLIGHT_LIFETIME_MS)

    if (!pointerPosition) return ageOpacity

    const distance = Math.hypot(spot.x - pointerPosition.x, spot.y - pointerPosition.y)
    const distanceOpacity = Math.max(0, 1 - distance / HIGHLIGHT_RADIUS)

    return Math.min(0.95, ageOpacity * distanceOpacity)
  }

  function getHighlightSpotStyle(spot: HighlightSpot): HighlightSpotStyle | null {
    const opacity = getHighlightOpacity(spot)

    if (opacity <= 0.03) return null

    return {
      '--dot-gap': `${GRID_GAP * scale}px`,
      '--major-dot-gap': `${MAJOR_GRID_GAP * scale}px`,
      '--dot-size': `${Math.max(0.45, DOT_SIZE * scale)}px`,
      '--major-dot-size': `${Math.max(1.5, MAJOR_DOT_SIZE * scale)}px`,
      '--board-offset-x': `${offset.x}px`,
      '--board-offset-y': `${offset.y}px`,
      '--highlight-x': `${spot.x}px`,
      '--highlight-y': `${spot.y}px`,
      '--highlight-tail-x': `${spot.tailX}px`,
      '--highlight-tail-y': `${spot.tailY}px`,
      '--highlight-tail-core': `${spot.tailCore}px`,
      '--highlight-tail-size': `${spot.tailSize}px`,
      opacity,
    }
  }

  return (
    <main className={`app-shell theme-${theme}`}>
      <div className="tags-menu">
        <button
          type="button"
          className="tags-menu__toggle"
          onClick={() => setIsTagsMenuOpen((isOpen) => !isOpen)}
          aria-expanded={isTagsMenuOpen}
        >
          Tags
        </button>

        {isTagsMenuOpen ? (
          <section className="tags-menu__panel" aria-label="Tag colors">
            <div className="tags-menu__list">
              {tagMenuItems.map((tag) => {
                const color = normalizeTagColor(tagColorDrafts[tag.id] ?? tag.color ?? DEFAULT_TAG_COLOR)
                const palettePosition = getPalettePosition(color)
                const isPaletteOpen = activeColorTagId === tag.id
                const tagColorStyle = { '--tag-color': color } as TagColorStyle
                const paletteStyle = {
                  '--palette-color': `hsl(${palettePosition.hue} 100% 50%)`,
                  '--palette-cursor-x': `${palettePosition.x}%`,
                  '--palette-cursor-y': `${palettePosition.y}%`,
                } as TagPaletteStyle

                return (
                  <div key={tag.id} className="tags-menu__item">
                    <button
                      type="button"
                      className="tags-menu__swatch"
                      style={tagColorStyle}
                      onClick={() => setActiveColorTagId(isPaletteOpen ? null : tag.id)}
                      disabled={!tag.isPersisted}
                      aria-label={`Change ${tag.name} color`}
                    />
                    <span className="tags-menu__name">{tag.name}</span>
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
                        <div
                          className="tags-menu__palette"
                          style={paletteStyle}
                          onPointerDown={(event) => {
                            event.currentTarget.setPointerCapture(event.pointerId)
                            pickTagColor(tag, event)
                          }}
                          onPointerMove={(event) => {
                            if (event.buttons !== 1) return
                            pickTagColor(tag, event)
                          }}
                          onPointerUp={(event) => {
                            event.currentTarget.releasePointerCapture(event.pointerId)
                            void persistTagColor(tag.id)
                          }}
                        >
                          <span className="tags-menu__palette-cursor" />
                        </div>
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
              disabled={!isGraphReady}
            >
              + New tag
            </button>
          </section>
        ) : null}
      </div>

      <div className="app-actions">
        <div className={`search-panel${isSearchOpen ? ' is-open' : ''}`}>
          <div className="search-panel__header">
            <button
              type="button"
              className="search-panel__toggle"
              onClick={() => {
                setIsSearchOpen((currentValue) => !currentValue)
              }}
              aria-expanded={isSearchOpen}
              aria-controls="people-search-panel"
            >
              Search people
            </button>
            {isSearchOpen ? (
              <button
                type="button"
                className="search-panel__clear"
                onClick={() => {
                  setSearchQuery('')
                  setIsSearchOpen(false)
                }}
              >
                Close
              </button>
            ) : null}
          </div>

          {isSearchOpen ? (
            <div id="people-search-panel" className="search-panel__body">
              <label className="search-panel__field">
                <span className="search-panel__label">Find by name, tag, or note</span>
                <input
                  ref={searchInputRef}
                  className="search-panel__input"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value)
                    setAiSearchStatus('idle')
                    setAiSearchError(null)
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Describe who you want to find, then press Enter"
                />
              </label>
              {isGraphReady ? (
                <div className="search-panel__hint">
                  <span>{aiSearchStatus === 'loading' ? 'Asking AI...' : 'Press Enter for AI search.'}</span>
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

        <div className="account-panel" aria-live="polite">
          {status === 'authenticated' && session?.user ? (
            <>
              {session.user.user_metadata.avatar_url ? (
                <img
                  className="account-panel__avatar"
                  src={session.user.user_metadata.avatar_url}
                  alt=""
                />
              ) : (
                <span className="account-panel__avatar" aria-hidden="true">
                  {(session.user.email ?? 'U').slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="account-panel__text">
                <span className="account-panel__label">{session.user.email}</span>
                <span className="account-panel__meta">
                  {graphStatus === 'loading' ? 'Loading your graph' : board?.title ?? 'Personal board'}
                </span>
              </span>
              <button type="button" className="account-panel__button" onClick={signOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <span className="account-panel__text">
                <span className="account-panel__label">
                  {status === 'loading' ? 'Checking session' : 'Social graph'}
                </span>
                <span className="account-panel__meta">
                  {status === 'unconfigured'
                    ? 'Connect Supabase to enable Google login'
                    : 'Sign in to save your network space'}
                </span>
              </span>
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

        <button
          type="button"
          className="theme-toggle"
          onClick={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          <span className="theme-toggle__track">
            <span className="theme-toggle__label">{theme === 'dark' ? 'Dark' : 'Light'}</span>
            <span className="theme-toggle__thumb" />
          </span>
        </button>
      </div>

      {inspectorNode ? (
        <aside
          ref={inspectorPanelRef}
          className="inspector-panel"
          aria-label="Selected person inspector"
          onMouseDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          <div className="inspector-panel__header">
            <div>
              <p className="inspector-panel__eyebrow">
                {inspectorNode.is_root ? 'Your node' : 'Selected person'}
              </p>
              <h2 className="inspector-panel__title">
                {inspectorNode.name.trim() || (inspectorNode.is_root ? 'You' : 'Unnamed person')}
              </h2>
            </div>
            <span className="inspector-panel__hint">
              {inspectorNode.is_root
                ? 'Root stays at 0,0'
                : isGraphReady
                  ? 'Drag to move. Hold Option and drag to connect.'
                  : 'Sign in to edit'}
            </span>
          </div>

          <label className="field-group">
            <span className="field-group__label">Name</span>
            <input
              className="field-group__input"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={() => {
                void saveInspectorName()
              }}
              disabled={!isGraphReady}
              placeholder="Name"
            />
          </label>

          <div className="field-group">
            <span className="field-group__label">Tag</span>
            <select
              className="field-group__input"
              value={inspectorNode.tag_id ?? ''}
              onChange={(event) => {
                void handleTagSelection(event.target.value)
              }}
              disabled={!isGraphReady}
            >
              <option value="">No tag</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
            <div className="field-group__inline">
              <input
                className="field-group__input"
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                placeholder="New tag"
                disabled={!isGraphReady}
              />
              <button
                type="button"
                className="field-group__button"
                onClick={() => {
                  void handleCreateTag()
                }}
                disabled={!isGraphReady || !tagDraft.trim()}
              >
                Add tag
              </button>
            </div>
          </div>

          <div className="field-group">
            <span className="field-group__label">Position</span>
            <p className="field-group__meta">
              X {inspectorNode.x.toFixed(0)}, Y {inspectorNode.y.toFixed(0)}
            </p>
          </div>

          <div className="field-group">
            <div className="field-group__header">
              <span className="field-group__label">Connections</span>
              <span className="field-group__meta">{inspectorNodeConnections.length}</span>
            </div>
            {inspectorNodeConnections.length > 0 ? (
              <div className="stack-list">
                {inspectorNodeConnections.map(({ connection, otherPerson }) => (
                  <div key={connection.id} className="stack-list__item">
                    <span className="stack-list__text">
                      {otherPerson?.name.trim() || 'Unnamed person'}
                    </span>
                    {isGraphReady ? (
                      <button
                        type="button"
                        className="stack-list__button"
                        onClick={() => {
                          void deleteConnection(connection.id)
                        }}
                      >
                        Disconnect
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="field-group__meta">No connections yet.</p>
            )}
          </div>

          <div className="field-group">
            <div className="field-group__header">
              <span className="field-group__label">Notes</span>
              <span className="field-group__meta">{inspectorNodeNotes.length}</span>
            </div>

            {inspectorNodeNotes.length > 0 ? (
              <div className="note-list">
                {inspectorNodeNotes.map((note) => {
                  const draft = noteDrafts[note.id] ?? {
                    title: note.title,
                    body: note.body,
                  }

                  return (
                    <article key={note.id} className="note-card">
                      <input
                        className="field-group__input"
                        value={draft.title}
                        onChange={(event) => updateNoteDraft(note.id, 'title', event.target.value)}
                        onBlur={() => {
                          void persistNote(note)
                        }}
                        disabled={!isGraphReady}
                        placeholder="Title"
                      />
                      <textarea
                        className="field-group__textarea"
                        value={draft.body}
                        onChange={(event) => updateNoteDraft(note.id, 'body', event.target.value)}
                        onBlur={() => {
                          void persistNote(note)
                        }}
                        disabled={!isGraphReady}
                        placeholder="Write a note"
                        rows={4}
                      />
                      {isGraphReady ? (
                        <button
                          type="button"
                          className="stack-list__button stack-list__button--danger"
                          onClick={() => {
                            void deleteNote(note.id)
                          }}
                        >
                          Delete note
                        </button>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="field-group__meta">No notes yet.</p>
            )}

            <div className="note-card note-card--draft">
              <input
                className="field-group__input"
                value={newNoteTitle}
                onChange={(event) => setNewNoteTitle(event.target.value)}
                placeholder="New note title"
                disabled={!isGraphReady}
              />
              <textarea
                className="field-group__textarea"
                value={newNoteBody}
                onChange={(event) => setNewNoteBody(event.target.value)}
                placeholder="New note body"
                rows={4}
                disabled={!isGraphReady}
              />
              <button
                type="button"
                className="field-group__button"
                onClick={() => {
                  void handleCreateNote()
                }}
                disabled={!isGraphReady || (!newNoteTitle.trim() && !newNoteBody.trim())}
              >
                Add note
              </button>
            </div>
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
        className={`board-viewport${isDraggingBoard ? ' is-dragging' : ''}`}
        onMouseDown={startBoardDragging}
        onMouseEnter={(event) => addHighlightSpot(event.clientX, event.clientY, true)}
        onMouseMove={(event) => addHighlightSpot(event.clientX, event.clientY)}
        onMouseLeave={() => {
          lastHighlightSpotRef.current = null
          setPointerPosition(null)
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
        <div className="board-highlights" aria-hidden="true">
          {highlightSpots.map((spot) => {
            const spotStyle = getHighlightSpotStyle(spot)
            if (!spotStyle) return null
            return <span key={spot.id} className="board-highlights__spot" style={spotStyle} />
          })}
        </div>

        <div ref={graphLayerRef} className="graph-layer">
          <svg
            className="graph-connections"
            viewBox="-2200 -2200 4400 4400"
            aria-hidden="true"
          >
            {boardConnections.map((edge) => {
              const fromNode = nodesById[edge.person_a_id]
              const toNode = nodesById[edge.person_b_id]
              const link = getLinkPath(fromNode, toNode)
              if (!link) return null

              return (
                <path
                  key={edge.id}
                  className="graph-edge"
                  d={`M ${link.start.x} ${link.start.y} C ${link.controlA.x} ${link.controlA.y}, ${link.controlB.x} ${link.controlB.y}, ${link.end.x} ${link.end.y}`}
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

          {boardNodes.map((node) => {
            const isSelected = node.id === selectedNode?.id
            const tagColor = node.tag_id ? tagColorById[node.tag_id] : null
            const nodeStyle = {
              left: `${node.x}px`,
              top: `${node.y}px`,
              ...(tagColor ? { '--node-color': tagColor } : {}),
            } as GraphNodeStyle

            return (
              <div
                key={node.id}
                className={`graph-node${node.is_root ? ' graph-node--root' : ''}${isSelected ? ' is-selected' : ''}`}
                style={nodeStyle}
              >
                <button
                  type="button"
                  className="graph-node__button"
                  title={
                    isGraphReady
                      ? node.is_root
                        ? 'Hold Option and drag to connect'
                        : 'Drag to move. Hold Option and drag to connect.'
                      : 'Sign in with Google to edit'
                  }
                  onMouseDown={(event) => startNodeInteraction(node, event)}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSelectedNodeId(node.id)
                    setInspectorNodeId(null)
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation()
                    setSelectedNodeId(node.id)
                    setInspectorNodeId(node.id)
                    setNameDraft(node.name)
                  }}
                >
                  <span className="graph-node__dot" />
                  <span className="graph-node__label">
                    {node.name.trim() || (node.is_root ? 'You' : 'Unnamed person')}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
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

function hexToRgb(hex: string) {
  const normalizedHex = normalizeTagColor(hex).slice(1)

  return {
    r: Number.parseInt(normalizedHex.slice(0, 2), 16),
    g: Number.parseInt(normalizedHex.slice(2, 4), 16),
    b: Number.parseInt(normalizedHex.slice(4, 6), 16),
  }
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')}`
}

function hexToHsv(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let hue = 0

  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6
    else if (max === green) hue = (blue - red) / delta + 2
    else hue = (red - green) / delta + 4
  }

  return {
    hue: Math.round((hue * 60 + 360) % 360),
    saturation: max === 0 ? 0 : (delta / max) * 100,
    value: max * 100,
  }
}

function hsvToHex(hue: number, saturation: number, value: number) {
  const chroma = (value / 100) * (saturation / 100)
  const huePrime = hue / 60
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1))
  const match = value / 100 - chroma
  let red = 0
  let green = 0
  let blue = 0

  if (huePrime >= 0 && huePrime < 1) [red, green, blue] = [chroma, x, 0]
  else if (huePrime < 2) [red, green, blue] = [x, chroma, 0]
  else if (huePrime < 3) [red, green, blue] = [0, chroma, x]
  else if (huePrime < 4) [red, green, blue] = [0, x, chroma]
  else if (huePrime < 5) [red, green, blue] = [x, 0, chroma]
  else [red, green, blue] = [chroma, 0, x]

  return rgbToHex((red + match) * 255, (green + match) * 255, (blue + match) * 255)
}

function getPalettePosition(color: string) {
  const hsv = hexToHsv(color)

  return {
    hue: hsv.hue,
    x: (hsv.hue / 360) * 100,
    y: 100 - hsv.saturation,
  }
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
