import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  WheelEvent as ReactWheelEvent,
} from 'react'

import { useAuth } from './lib/useAuth'

type Theme = 'dark' | 'light'

type Offset = {
  x: number
  y: number
}

type GraphNode = {
  id: string
  label: string
  x: number
  y: number
  kind?: 'root' | 'default'
}

type GraphEdge = {
  id: string
  from: string
  to: string
}

type BoardStyle = CSSProperties & {
  '--board-offset-x': string
  '--board-offset-y': string
  '--dot-gap': string
  '--major-dot-gap': string
  '--dot-size': string
  '--major-dot-size': string
}

<<<<<<< HEAD
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
=======
type NodeStyle = CSSProperties & {
  '--node-color': string
  '--node-dot-size': string
  '--node-hit-size': string
  '--node-label-gap': string
}

type EdgeStyle = CSSProperties & {
  width: string
  transform: string
>>>>>>> c976632 (Speed up board rendering and fix graph links)
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

const THEME_STORAGE_KEY = 'hackathon-theme'
const MIN_SCALE = 0.2
const MAX_SCALE = 2.5
const GRID_GAP = 12
const MAJOR_GRID_GAP = 96
const DOT_SIZE = 0.65
const MAJOR_DOT_SIZE = 2
<<<<<<< HEAD
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

const INITIAL_NODES: GraphNode[] = [{ id: 'root', label: 'You', x: 0, y: 0, kind: 'root' }]
const INITIAL_EDGES: GraphEdge[] = []

=======
const DESKTOP_CREATE_THRESHOLD = 18
const LONG_PRESS_MS = 420
const TAP_MOVE_LIMIT = 10
const HISTORY_LIMIT = 50
const DEFAULT_NODE_COLOR = '#8affd6'
const NODE_META_PREFIX = '__graph_meta__:'
const NODE_COLOR_OPTIONS = [
  '#8affd6',
  '#5eead4',
  '#7dd3fc',
  '#c4b5fd',
  '#f9a8d4',
  '#fda4af',
  '#fdba74',
  '#fde68a',
]
>>>>>>> c976632 (Speed up board rendering and fix graph links)
function App() {
  const { session, board, status, error, signInWithGoogle, signOut } = useAuth()
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    return savedTheme === 'light' ? 'light' : 'dark'
  })
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [nodes, setNodes] = useState<GraphNode[]>(INITIAL_NODES)
  const [edges, setEdges] = useState<GraphEdge[]>(INITIAL_EDGES)
  const [selectedNodeId, setSelectedNodeId] = useState('root')
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDrag | null>(null)
<<<<<<< HEAD
  const [highlightSpots, setHighlightSpots] = useState<HighlightSpot[]>([])
  const [pointerPosition, setPointerPosition] = useState<Offset | null>(null)
  const [highlightClock, setHighlightClock] = useState(() => Date.now())
  const [isDraggingBoard, setIsDraggingBoard] = useState(false)

  const boardRef = useRef<HTMLElement | null>(null)
  const highlightIdRef = useRef(0)
  const lastHighlightSpotRef = useRef<Offset | null>(null)
  const boardDragRef = useRef({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    active: false,
  })
=======
  const [history, setHistory] = useState<GraphSnapshot[]>([])

  const boardRef = useRef<HTMLElement | null>(null)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const selectedNodeIdRef = useRef<string | null>('root')
  const activePointersRef = useRef(new Map<number, Offset>())
  const boardGestureRef = useRef<BoardGesture>(null)
  const tapCandidateRef = useRef<TapCandidate>(null)
  const longPressRef = useRef<LongPressCandidate | null>(null)
  const suppressNodeClickRef = useRef(false)

  function clearLongPress() {
    if (!longPressRef.current) return

    window.clearTimeout(longPressRef.current.timerId)
    longPressRef.current = null
  }
>>>>>>> c976632 (Speed up board rendering and fix graph links)

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
<<<<<<< HEAD
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

=======
    const boardElement = boardRef.current
    if (!boardElement) return undefined

    const updateBoardSize = () => {
      setBoardSize({
        width: boardElement.clientWidth,
        height: boardElement.clientHeight,
      })
    }

    updateBoardSize()

    const resizeObserver = new ResizeObserver(updateBoardSize)
    resizeObserver.observe(boardElement)

    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId
  }, [selectedNodeId])

>>>>>>> c976632 (Speed up board rendering and fix graph links)
  const nodesById = useMemo(
    () => Object.fromEntries(nodes.map((node) => [node.id, node])) as Record<string, GraphNode>,
    [nodes],
  )

  const finishConnectionDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (!connectionDrag) return

      const distance = Math.hypot(
        clientX - connectionDrag.startClientX,
        clientY - connectionDrag.startClientY,
      )

      if (distance < CREATE_THRESHOLD) {
        setConnectionDrag(null)
        return
      }

      const targetNode = nodes.find((node) => {
        if (node.id === connectionDrag.fromId) return false

<<<<<<< HEAD
        const distanceToNode = Math.hypot(
          node.x - connectionDrag.worldX,
          node.y - connectionDrag.worldY,
=======
      if (nextNode) {
        setSelectedNodeId(nextNode.id)
        setInspectorNodeId(null)
        setEditingNodeId(nextNode.id)
      }
    }

    suppressNodeClickRef.current = created
    setConnectionDrag(null)
  }

  const updatePinchGesture = (gesture: PinchGesture) => {
    const firstPointer = activePointersRef.current.get(gesture.pointerIds[0])
    const secondPointer = activePointersRef.current.get(gesture.pointerIds[1])
    const viewport = boardRef.current?.getBoundingClientRect()

    if (!firstPointer || !secondPointer || !viewport) return

    const center = getCenter(firstPointer, secondPointer)
    const nextDistance = Math.max(1, getDistance(firstPointer, secondPointer))
    const nextScale = clampScale(gesture.initialScale * (nextDistance / gesture.initialDistance))

    setScale(nextScale)
    setOffset({
      x: center.x - viewport.width / 2 - gesture.worldCenter.x * nextScale,
      y: center.y - viewport.height / 2 - gesture.worldCenter.y * nextScale,
    })
  }

  const handleBoardPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('[data-node-interactive="true"]')) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    setInspectorNodeId(null)
    setEditingNodeId(null)
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (isMobileLayout && activeInteractionMode === 'connect') {
      tapCandidateRef.current = { kind: 'board-connect', clientX: event.clientX, clientY: event.clientY }
      return
    }

    if (
      isMobileLayout &&
      activePointersRef.current.size === 2 &&
      boardRef.current &&
      !connectionDrag &&
      boardGestureRef.current?.kind !== 'move-node'
    ) {
      const [firstPointerId, secondPointerId] = [...activePointersRef.current.keys()]
      const firstPointer = activePointersRef.current.get(firstPointerId)
      const secondPointer = activePointersRef.current.get(secondPointerId)

      if (firstPointer && secondPointer) {
        const center = getCenter(firstPointer, secondPointer)
        const worldCenter = screenToWorld(
          boardRef.current.getBoundingClientRect().left + center.x,
          boardRef.current.getBoundingClientRect().top + center.y,
          boardRef.current,
          offset,
          scale,
>>>>>>> c976632 (Speed up board rendering and fix graph links)
        )

        return distanceToNode <= NODE_HIT_RADIUS / scale
      })

      if (targetNode) {
        setEdges((currentEdges) => {
          const alreadyConnected = currentEdges.some(
            (edge) => edge.from === connectionDrag.fromId && edge.to === targetNode.id,
          )

          if (alreadyConnected) return currentEdges

          return [
            ...currentEdges,
            {
              id: `edge-${connectionDrag.fromId}-${targetNode.id}`,
              from: connectionDrag.fromId,
              to: targetNode.id,
            },
          ]
        })
        setSelectedNodeId(targetNode.id)
        setConnectionDrag(null)
        return
      }

      const nextId = `node-${crypto.randomUUID()}`
      const nextNode: GraphNode = {
        id: nextId,
        label: '',
        x: connectionDrag.worldX,
        y: connectionDrag.worldY,
      }

      setNodes((currentNodes) => [...currentNodes, nextNode])
      setEdges((currentEdges) => [
        ...currentEdges,
        {
          id: `edge-${connectionDrag.fromId}-${nextId}`,
          from: connectionDrag.fromId,
          to: nextId,
        },
      ])
      setSelectedNodeId(nextId)
      setEditingNodeId(nextId)
      setConnectionDrag(null)
    },
    [connectionDrag, nodes, scale],
  )

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (connectionDrag) {
        const worldPoint = screenToWorld(event.clientX, event.clientY, boardRef.current, offset, scale)

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

      if (!boardDragRef.current.active) return

      const nextX = boardDragRef.current.originX + event.clientX - boardDragRef.current.startX
      const nextY = boardDragRef.current.originY + event.clientY - boardDragRef.current.startY

      setOffset({ x: nextX, y: nextY })
      addHighlightSpot(event.clientX, event.clientY)
    }

    const handleMouseUp = (event: MouseEvent) => {
      if (connectionDrag) {
        finishConnectionDrag(event.clientX, event.clientY)
        return
      }

      boardDragRef.current.active = false
      lastHighlightSpotRef.current = null
      setIsDraggingBoard(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [addHighlightSpot, connectionDrag, finishConnectionDrag, offset, scale])

  const startBoardDragging = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.button !== 0 || connectionDrag) return

    boardDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
      active: true,
    }
<<<<<<< HEAD

    addHighlightSpot(event.clientX, event.clientY, true)
    setIsDraggingBoard(true)
    setEditingNodeId(null)
  }

  const startConnectionDrag = (nodeId: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
=======
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleBoardPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
>>>>>>> c976632 (Speed up board rendering and fix graph links)

    event.stopPropagation()
    boardDragRef.current.active = false
    setIsDraggingBoard(false)
    setSelectedNodeId(nodeId)
    setEditingNodeId(null)
    const worldPoint = screenToWorld(event.clientX, event.clientY, boardRef.current, offset, scale)
    setConnectionDrag({
      fromId: nodeId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      worldX: worldPoint?.x ?? nodesById[nodeId].x,
      worldY: worldPoint?.y ?? nodesById[nodeId].y,
    })
  }

  const updateNodeLabel = (nodeId: string, value: string) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => (node.id === nodeId ? { ...node, label: value } : node)),
    )
  }

  const moveWithWheel = (event: ReactWheelEvent<HTMLElement>) => {
    event.preventDefault()

    const prefersPan = Math.abs(event.deltaX) > 0 || Math.abs(event.deltaY) < 24

    if (prefersPan) {
      setOffset((currentOffset) => ({
        x: currentOffset.x - event.deltaX,
        y: currentOffset.y - event.deltaY,
      }))
      return
    }

    const zoomIntensity = event.deltaY > 0 ? 0.88 : 1.12
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * zoomIntensity))

    if (nextScale === scale) return

    const { left, top } = event.currentTarget.getBoundingClientRect()
    const pointerX = event.clientX - left
    const pointerY = event.clientY - top
    const centerX = event.currentTarget.clientWidth / 2
    const centerY = event.currentTarget.clientHeight / 2
    const worldX = (pointerX - centerX - offset.x) / scale
    const worldY = (pointerY - centerY - offset.y) / scale

    setScale(nextScale)
    setOffset({
      x: pointerX - centerX - worldX * nextScale,
      y: pointerY - centerY - worldY * nextScale,
    })
  }

<<<<<<< HEAD
=======
  const startDesktopConnectionDrag = (
    nodeId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (isMobileLayout || event.pointerType !== 'mouse' || event.button !== 0) return

    event.stopPropagation()
    const node = nodesById[nodeId]

    setSelectedNodeId(nodeId)
    setEditingNodeId(null)
    setConnectionDrag({
      fromId: nodeId,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      worldX: node?.x ?? 0,
      worldY: node?.y ?? 0,
    })

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const startNodeLongPress = (nodeId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isMobileLayout || event.pointerType === 'mouse') return

    clearLongPress()

    const timerId = window.setTimeout(() => {
      setSelectedNodeId(nodeId)
      setActionSheetNodeId(nodeId)
      setInteractionMode('edit')

      if (longPressRef.current) {
        longPressRef.current.triggered = true
      }
    }, LONG_PRESS_MS)

    longPressRef.current = {
      nodeId,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      triggered: false,
      timerId,
    }
  }

  const clearLongPressOnMove = (clientX: number, clientY: number) => {
    const candidate = longPressRef.current
    if (!candidate || candidate.triggered) return

    if (Math.hypot(clientX - candidate.startClientX, clientY - candidate.startClientY) > TAP_MOVE_LIMIT) {
      clearLongPress()
    }
  }

  const handleNodePress = async (nodeId: string) => {
    if (isMobileLayout) {
      if (longPressRef.current?.triggered) {
        suppressNodeClickRef.current = true
        clearLongPress()
        return
      }

      if (activeInteractionMode === 'connect' && activeSelectedNodeId && activeSelectedNodeId !== nodeId) {
        pushHistory()
        await connectNodes(activeSelectedNodeId, nodeId)
      }

      setSelectedNodeId(nodeId)
      setInspectorNodeId(null)
      clearLongPress()
      return
    }

    setSelectedNodeId(nodeId)
    setInspectorNodeId(null)
  }

  const startNodeMove = (nodeId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isMobileLayout) return

    event.preventDefault()
    event.stopPropagation()
    clearLongPress()

    const worldPoint = screenToWorld(event.clientX, event.clientY, boardRef.current, offset, scale)
    const node = nodesById[nodeId]
    if (!worldPoint || !node) return

    setSelectedNodeId(nodeId)
    setInspectorNodeId(null)
    setActionSheetNodeId(null)
    setInteractionMode('move')
    boardGestureRef.current = {
      kind: 'move-node',
      pointerId: event.pointerId,
      nodeId,
      startWorld: worldPoint,
      originX: node.x,
      originY: node.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const updateNodeLabel = (nodeId: string, value: string) => {
    void updateNode(nodeId, { label: value })
  }

  const updateNodeMeta = useCallback(
    async (nodeId: string, nextMeta: NodeInspectorMeta) => {
      await updateNode(nodeId, { note: serializeNodeMeta(nextMeta) })
    },
    [updateNode],
  )

  const startEditingNode = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    setInspectorNodeId(null)
    setEditingNodeId(nodeId)
    setActionSheetNodeId(null)
    setInteractionMode('edit')
  }

  const selectedNode = nodesById[activeSelectedNodeId]
  const inspectorNode = activeInspectorNodeId ? nodesById[activeInspectorNodeId] : null
  const actionSheetNode = actionSheetNodeId ? nodesById[actionSheetNodeId] : null
  const selectedNodeMeta = inspectorNode ? parseNodeMeta(inspectorNode.note) : null
  const actionSheetNodeMeta = actionSheetNode ? parseNodeMeta(actionSheetNode.note) : null

  const setNodeColor = async (nodeId: string, color: string) => {
    const node = nodesById[nodeId]
    if (!node) return

    const currentMeta = parseNodeMeta(node.note)
    if (currentMeta.color === color) return

    pushHistory()
    await updateNodeMeta(nodeId, { ...currentMeta, color })
  }

  const addNoteToNode = async (nodeId: string) => {
    const node = nodesById[nodeId]
    if (!node) return

    pushHistory()
    const currentMeta = parseNodeMeta(node.note)
    await updateNodeMeta(nodeId, {
      ...currentMeta,
      notes: [...currentMeta.notes, { id: `note-${crypto.randomUUID()}`, text: '' }],
    })
  }

  const updateNodeNote = async (nodeId: string, noteId: string, text: string) => {
    const node = nodesById[nodeId]
    if (!node) return

    const currentMeta = parseNodeMeta(node.note)
    await updateNodeMeta(nodeId, {
      ...currentMeta,
      notes: currentMeta.notes.map((note) => (note.id === noteId ? { ...note, text } : note)),
    })
  }

  const deleteNodeNote = async (nodeId: string, noteId: string) => {
    const node = nodesById[nodeId]
    if (!node) return

    pushHistory()
    const currentMeta = parseNodeMeta(node.note)
    await updateNodeMeta(nodeId, {
      ...currentMeta,
      notes: currentMeta.notes.filter((note) => note.id !== noteId),
    })
  }

  const deleteSelectedNode = async (nodeId: string) => {
    const node = nodesById[nodeId]
    if (!node || node.kind === 'root') return

    pushHistory()
    await deleteNode(nodeId)
    setInspectorNodeId(null)
    setActionSheetNodeId(null)
    setInteractionMode('navigate')
    setSelectedNodeId(nodes.find((candidate) => candidate.id !== nodeId)?.id ?? 'root')
    setEditingNodeId(null)
  }

  const previewPath = connectionDrag
    ? getLineGeometry(nodesById[connectionDrag.fromId], {
        x: connectionDrag.worldX,
        y: connectionDrag.worldY,
      })
    : null

>>>>>>> c976632 (Speed up board rendering and fix graph links)
  const gridStyle = {
    '--dot-gap': `${GRID_GAP * scale}px`,
    '--major-dot-gap': `${MAJOR_GRID_GAP * scale}px`,
    '--dot-size': `${Math.max(0.45, DOT_SIZE * scale)}px`,
    '--major-dot-size': `${Math.max(1.5, MAJOR_DOT_SIZE * scale)}px`,
    '--board-offset-x': `${offset.x}px`,
    '--board-offset-y': `${offset.y}px`,
  }

  const boardStyle: BoardStyle = gridStyle

  const graphStyle = {
    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
  } satisfies CSSProperties

  const previewPath = connectionDrag
    ? getPreviewPath(nodesById[connectionDrag.fromId], {
        x: connectionDrag.worldX,
        y: connectionDrag.worldY,
      })
    : null

<<<<<<< HEAD
  const getHighlightOpacity = (spot: HighlightSpot) => {
    const age = highlightClock - spot.createdAt
    const ageOpacity = Math.max(0, 1 - age / HIGHLIGHT_LIFETIME_MS)

    if (!pointerPosition) return ageOpacity

    const distance = Math.hypot(spot.x - pointerPosition.x, spot.y - pointerPosition.y)
    const distanceOpacity = Math.max(0, 1 - distance / HIGHLIGHT_RADIUS)

    return Math.min(0.95, ageOpacity * distanceOpacity)
  }

  const getHighlightSpotStyle = (spot: HighlightSpot): HighlightSpotStyle | null => {
    const opacity = getHighlightOpacity(spot)

    if (opacity <= 0.03) return null

    return {
      ...gridStyle,
      '--highlight-x': `${spot.x}px`,
      '--highlight-y': `${spot.y}px`,
      '--highlight-tail-x': `${spot.tailX}px`,
      '--highlight-tail-y': `${spot.tailY}px`,
      '--highlight-tail-core': `${spot.tailCore}px`,
      '--highlight-tail-size': `${spot.tailSize}px`,
      opacity,
    }
  }
=======
  const combinedError = error ?? graphError
>>>>>>> c976632 (Speed up board rendering and fix graph links)

  return (
    <main className={`app-shell theme-${theme}`}>
      <div className="app-actions">
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
                <span className="account-panel__meta">{board?.title ?? 'Personal board'}</span>
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

      <section
        ref={boardRef}
<<<<<<< HEAD
        className={`board-viewport${isDraggingBoard ? ' is-dragging' : ''}`}
        onMouseDown={startBoardDragging}
        onMouseEnter={(event) => addHighlightSpot(event.clientX, event.clientY, true)}
        onMouseMove={(event) => addHighlightSpot(event.clientX, event.clientY)}
        onMouseLeave={() => {
          lastHighlightSpotRef.current = null
          setPointerPosition(null)
        }}
        onWheel={moveWithWheel}
=======
        className={`board-viewport${isMobileLayout ? ' board-viewport--mobile' : ''}`}
        onPointerDown={handleBoardPointerDown}
        onPointerMove={handleBoardPointerMove}
        onPointerUp={handleBoardPointerUp}
        onPointerCancel={handleBoardPointerCancel}
        onWheel={handleBoardWheel}
>>>>>>> c976632 (Speed up board rendering and fix graph links)
        aria-label="Social network graph canvas"
      >
        <div className="board-surface" style={boardStyle} />

        <div className="graph-layer" style={graphStyle}>
          <div className="graph-connections" aria-hidden="true">
            {edges.map((edge) => {
              const fromNode = nodesById[edge.from]
              const toNode = nodesById[edge.to]
              const line = getLineGeometry(fromNode, toNode)
              if (!line) return null

              return <span key={edge.id} className="graph-edge" style={line} />
            })}

            {previewPath ? <span className="graph-edge graph-edge--preview" style={previewPath} /> : null}
          </div>

          {nodes.map((node) => {
            const isSelected = node.id === selectedNodeId
            const isEditing = node.id === editingNodeId

            return (
              <div
                key={node.id}
                className={`graph-node${node.kind === 'root' ? ' graph-node--root' : ''}${isSelected ? ' is-selected' : ''}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
              >
                {isEditing ? (
                  <div
                    className="graph-node__editor"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <span className="graph-node__dot" />
                    <input
                      className="graph-node__input"
                      value={node.label}
                      placeholder="Name"
                      autoFocus
                      onChange={(event) => updateNodeLabel(node.id, event.target.value)}
                      onBlur={() => setEditingNodeId(null)}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="graph-node__button"
                    onMouseDown={(event) => startConnectionDrag(node.id, event)}
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedNodeId(node.id)
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      setEditingNodeId(node.id)
                    }}
                  >
                    <span className="graph-node__dot" />
                    <span className="graph-node__label">{node.label}</span>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>
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

function getLineGeometry(fromNode?: GraphNode, toNode?: Offset | null): EdgeStyle | null {
  if (!fromNode || !toNode) return null

  const dx = toNode.x - fromNode.x
  const dy = toNode.y - fromNode.y
<<<<<<< HEAD
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

function getPreviewPath(fromNode?: GraphNode, pointer?: Offset | null) {
  return getLinkPath(fromNode, pointer)
=======
  const length = Math.hypot(dx, dy)
  if (length < 1) return null

  const angle = Math.atan2(dy, dx)

  return {
    width: `${length}px`,
    transform: `translate(${fromNode.x}px, ${fromNode.y}px) rotate(${angle}rad)`,
  }
}

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

function getDistance(first: Offset, second: Offset) {
  return Math.hypot(second.x - first.x, second.y - first.y)
}

function getCenter(first: Offset, second: Offset) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  }
}

function getNodeRadius(kind: GraphNode['kind'], isMobileLayout: boolean) {
  if (!isMobileLayout) {
    return kind === 'root' ? 17 : 12
  }

  return kind === 'root' ? 36 : 28
}

function getNodeDiameter(kind: GraphNode['kind'], isMobileLayout: boolean) {
  return getNodeRadius(kind, isMobileLayout) * 2
}

function getNodeHitRadius(kind: GraphNode['kind'], isMobileLayout: boolean) {
  return isMobileLayout ? getNodeRadius(kind, true) + 20 : getNodeRadius(kind, false) + 16
}

function getNodeHitDiameter(kind: GraphNode['kind'], isMobileLayout: boolean) {
  return getNodeHitRadius(kind, isMobileLayout) * 2
}


function parseNodeMeta(noteValue: string | null): NodeInspectorMeta {
  if (!noteValue) {
    return { color: DEFAULT_NODE_COLOR, notes: [] }
  }

  if (!noteValue.startsWith(NODE_META_PREFIX)) {
    return {
      color: DEFAULT_NODE_COLOR,
      notes: noteValue.trim() ? [{ id: 'legacy-note', text: noteValue }] : [],
    }
  }

  try {
    const parsed = JSON.parse(noteValue.slice(NODE_META_PREFIX.length)) as {
      color?: string
      notes?: Array<{ id?: string; text?: string }>
    }

    return {
      color: parsed.color || DEFAULT_NODE_COLOR,
      notes: (parsed.notes ?? [])
        .filter((note) => typeof note.text === 'string')
        .map((note, index) => ({
          id: note.id || `note-${index}`,
          text: note.text ?? '',
        })),
    }
  } catch {
    return { color: DEFAULT_NODE_COLOR, notes: [] }
  }
}

function serializeNodeMeta(meta: NodeInspectorMeta) {
  const normalizedNotes = meta.notes
    .map((note) => ({ ...note, text: note.text.trim() }))
    .filter((note) => note.text.length > 0)

  if (normalizedNotes.length === 0 && meta.color === DEFAULT_NODE_COLOR) {
    return null
  }

  return `${NODE_META_PREFIX}${JSON.stringify({
    color: meta.color,
    notes: normalizedNotes,
  })}`
}

function notesFromPromptValue(value: string) {
  return value
    .split(/\n\s*\n/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((text) => ({ id: `note-${crypto.randomUUID()}`, text }))
}

function cloneGraphNodes(nodes: GraphNode[]) {
  return nodes.map((node) => ({ ...node }))
>>>>>>> c976632 (Speed up board rendering and fix graph links)
}

export default App
