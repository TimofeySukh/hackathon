import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'

import { useBoardGraph } from './features/board/useBoardGraph'
import { useIsMobileLayout } from './features/board/useIsMobileLayout'
import type { GraphNode, Offset } from './features/board/types'
import { useAuth } from './lib/useAuth'

type Theme = 'dark' | 'light'
type InteractionMode = 'navigate' | 'connect' | 'move' | 'edit'

type GraphSnapshot = {
  nodes: GraphNode[]
  edges: { id: string; boardId?: string; from: string; to: string }[]
  selectedNodeId: string | null
}

type NodeInspectorNote = {
  id: string
  text: string
}

type NodeInspectorMeta = {
  color: string
  notes: NodeInspectorNote[]
}

type HighlightSpot = Offset & {
  id: number
  createdAt: number
  tailX: number
  tailY: number
  tailCore: number
  tailSize: number
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

type ConnectionDrag = {
  fromId: string
  pointerId: number
  startClientX: number
  startClientY: number
  clientX: number
  clientY: number
  worldX: number
  worldY: number
}

type PanGesture = {
  kind: 'pan'
  pointerId: number
  startClientX: number
  startClientY: number
  originX: number
  originY: number
}

type PinchGesture = {
  kind: 'pinch'
  pointerIds: [number, number]
  initialDistance: number
  initialScale: number
  worldCenter: Offset
}

type MoveGesture = {
  kind: 'move-node'
  pointerId: number
  nodeId: string
  startWorld: Offset
  originX: number
  originY: number
}

type BoardGesture = PanGesture | PinchGesture | MoveGesture | null

type TapCandidate =
  | {
      kind: 'board-connect'
      clientX: number
      clientY: number
    }
  | null

type LongPressCandidate = {
  nodeId: string
  pointerId: number
  startClientX: number
  startClientY: number
  triggered: boolean
  timerId: number
}

const THEME_STORAGE_KEY = 'hackathon-theme'
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
const getNow = () => Date.now()

function App() {
  const { session, board, status, error, signInWithGoogle, signOut } = useAuth()
  const {
    nodes,
    edges,
    status: graphStatus,
    error: graphError,
    updateNode,
    createConnectedNode,
    connectNodes,
    deleteNode,
    replaceGraph,
  } = useBoardGraph(board?.id ?? null)
  const isMobileLayout = useIsMobileLayout()

  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    return savedTheme === 'light' ? 'light' : 'dark'
  })
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 })
  const [scale, setScale] = useState(1)
  const [selectedNodeId, setSelectedNodeId] = useState('root')
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [actionSheetNodeId, setActionSheetNodeId] = useState<string | null>(null)
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('navigate')
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDrag | null>(null)
  const [history, setHistory] = useState<GraphSnapshot[]>([])
  const [highlightSpots, setHighlightSpots] = useState<HighlightSpot[]>([])
  const [pointerPosition, setPointerPosition] = useState<Offset | null>(null)
  const [highlightClock, setHighlightClock] = useState(() => Date.now())

  const boardRef = useRef<HTMLElement | null>(null)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const selectedNodeIdRef = useRef<string | null>('root')
  const highlightIdRef = useRef(0)
  const lastHighlightSpotRef = useRef<Offset | null>(null)
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

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
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

  const addHighlightSpot = (clientX: number, clientY: number, force = false) => {
    const viewport = boardRef.current?.getBoundingClientRect()
    if (!viewport) return

    const now = getNow()
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
  }

  const nodesById = useMemo(
    () => Object.fromEntries(nodes.map((node) => [node.id, node])) as Record<string, GraphNode>,
    [nodes],
  )
  const activeSelectedNodeId = nodesById[selectedNodeId] ? selectedNodeId : (nodes[0]?.id ?? 'root')
  const activeInteractionMode = isMobileLayout ? interactionMode : 'navigate'

  const pushHistory = useCallback(() => {
    setHistory((currentHistory) => [
      ...currentHistory.slice(-HISTORY_LIMIT + 1),
      {
        nodes: cloneGraphNodes(nodesRef.current),
        edges: edgesRef.current.map((edge) => ({ ...edge })),
        selectedNodeId: selectedNodeIdRef.current,
      },
    ])
  }, [])

  const undoLastGraphChange = useCallback(() => {
    setHistory((currentHistory) => {
      const previousSnapshot = currentHistory[currentHistory.length - 1]
      if (!previousSnapshot) return currentHistory

      void replaceGraph(
        cloneGraphNodes(previousSnapshot.nodes),
        previousSnapshot.edges.map((edge) => ({ ...edge })),
      )
      setSelectedNodeId(previousSnapshot.selectedNodeId ?? previousSnapshot.nodes[0]?.id ?? 'root')
      setEditingNodeId(null)
      setActionSheetNodeId(null)
      setConnectionDrag(null)
      setInteractionMode('navigate')

      return currentHistory.slice(0, -1)
    })
  }, [replaceGraph])

  useEffect(() => {
    const handleUndo = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.key.toLowerCase() !== 'z') {
        return
      }

      const target = event.target
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)

      if (isTypingTarget) return

      event.preventDefault()
      undoLastGraphChange()
    }

    window.addEventListener('keydown', handleUndo)

    return () => window.removeEventListener('keydown', handleUndo)
  }, [undoLastGraphChange])

  const setMobileMode = (nextMode: InteractionMode) => {
    clearLongPress()
    setActionSheetNodeId(null)
    setInteractionMode(nextMode)
  }

  const finishDesktopConnectionDrag = async (event: ReactPointerEvent<HTMLElement>) => {
    if (!connectionDrag) return

    const distance = Math.hypot(
      event.clientX - connectionDrag.startClientX,
      event.clientY - connectionDrag.startClientY,
    )

    const created = distance >= DESKTOP_CREATE_THRESHOLD

    if (created) {
      const targetNode = nodes.find((node) => {
        if (node.id === connectionDrag.fromId) return false

        const distanceToNode = Math.hypot(node.x - connectionDrag.worldX, node.y - connectionDrag.worldY)

        return distanceToNode <= NODE_HIT_RADIUS / scale
      })

      if (targetNode) {
        pushHistory()
        await connectNodes(connectionDrag.fromId, targetNode.id)
        setSelectedNodeId(targetNode.id)
        suppressNodeClickRef.current = true
        setConnectionDrag(null)
        return
      }

      pushHistory()
      const nextNode = await createConnectedNode(
        connectionDrag.fromId,
        connectionDrag.worldX,
        connectionDrag.worldY,
      )

      if (nextNode) {
        setSelectedNodeId(nextNode.id)
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
    const centerClientX = viewport.left + center.x
    const centerClientY = viewport.top + center.y
    const nextDistance = Math.max(1, getDistance(firstPointer, secondPointer))
    const nextScale = clampScale(gesture.initialScale * (nextDistance / gesture.initialDistance))

    setScale(nextScale)
    setOffset({
      x: center.x - viewport.width / 2 - gesture.worldCenter.x * nextScale,
      y: center.y - viewport.height / 2 - gesture.worldCenter.y * nextScale,
    })
    addHighlightSpot(centerClientX, centerClientY, true)
  }

  const handleBoardPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('[data-node-interactive="true"]')) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

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
        )

        if (worldCenter) {
          boardGestureRef.current = {
            kind: 'pinch',
            pointerIds: [firstPointerId, secondPointerId],
            initialDistance: Math.max(1, getDistance(firstPointer, secondPointer)),
            initialScale: scale,
            worldCenter,
          }
          return
        }
      }
    }

    boardGestureRef.current = {
      kind: 'pan',
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    addHighlightSpot(event.clientX, event.clientY, true)
  }

  const handleBoardPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    addHighlightSpot(event.clientX, event.clientY)

    clearLongPressOnMove(event.clientX, event.clientY)

    if (connectionDrag && connectionDrag.pointerId === event.pointerId) {
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

    if (boardGestureRef.current?.kind === 'pinch') {
      updatePinchGesture(boardGestureRef.current)
      return
    }

    if (boardGestureRef.current?.kind === 'pan' && boardGestureRef.current.pointerId === event.pointerId) {
      setOffset({
        x: boardGestureRef.current.originX + event.clientX - boardGestureRef.current.startClientX,
        y: boardGestureRef.current.originY + event.clientY - boardGestureRef.current.startClientY,
      })
      return
    }

    if (
      boardGestureRef.current?.kind === 'move-node' &&
      boardGestureRef.current.pointerId === event.pointerId
    ) {
      const worldPoint = screenToWorld(event.clientX, event.clientY, boardRef.current, offset, scale)
      if (!worldPoint) return

      updateNode(
        boardGestureRef.current.nodeId,
        {
          x: boardGestureRef.current.originX + (worldPoint.x - boardGestureRef.current.startWorld.x),
          y: boardGestureRef.current.originY + (worldPoint.y - boardGestureRef.current.startWorld.y),
        },
        false,
      )
    }
  }

  const handleBoardPointerUp = async (event: ReactPointerEvent<HTMLElement>) => {
    activePointersRef.current.delete(event.pointerId)
    clearLongPress()

    if (connectionDrag && connectionDrag.pointerId === event.pointerId) {
      await finishDesktopConnectionDrag(event)
      return
    }

    if (boardGestureRef.current?.kind === 'move-node' && boardGestureRef.current.pointerId === event.pointerId) {
      const movedNode = nodesById[boardGestureRef.current.nodeId]
      if (movedNode) {
        pushHistory()
        await updateNode(boardGestureRef.current.nodeId, { x: movedNode.x, y: movedNode.y })
      }
      boardGestureRef.current = null
      setInteractionMode((currentMode) => (currentMode === 'move' ? 'navigate' : currentMode))
      return
    }

    if (
      tapCandidateRef.current?.kind === 'board-connect' &&
      activeSelectedNodeId &&
      Math.hypot(event.clientX - tapCandidateRef.current.clientX, event.clientY - tapCandidateRef.current.clientY) <
        TAP_MOVE_LIMIT
    ) {
      const worldPoint = screenToWorld(event.clientX, event.clientY, boardRef.current, offset, scale)

      if (worldPoint) {
        pushHistory()
        const nextNode = await createConnectedNode(activeSelectedNodeId, worldPoint.x, worldPoint.y)
        if (nextNode) {
          setSelectedNodeId(nextNode.id)
          setEditingNodeId(nextNode.id)
        }
      }
    }

    tapCandidateRef.current = null
    boardGestureRef.current = null
  }

  const handleBoardPointerCancel = () => {
    activePointersRef.current.clear()
    boardGestureRef.current = null
    tapCandidateRef.current = null
    clearLongPress()
    setConnectionDrag(null)
  }

  const handleBoardWheel = (event: ReactWheelEvent<HTMLElement>) => {
    event.preventDefault()
    addHighlightSpot(event.clientX, event.clientY, true)

    const prefersPan = Math.abs(event.deltaX) > 0 || Math.abs(event.deltaY) < 24

    if (prefersPan) {
      setOffset((currentOffset) => ({
        x: currentOffset.x - event.deltaX,
        y: currentOffset.y - event.deltaY,
      }))
      return
    }

    const zoomIntensity = event.deltaY > 0 ? 0.88 : 1.12
    const nextScale = clampScale(scale * zoomIntensity)

    if (nextScale === scale) return

    const viewport = event.currentTarget.getBoundingClientRect()
    const pointerX = event.clientX - viewport.left
    const pointerY = event.clientY - viewport.top
    const worldX = (pointerX - viewport.width / 2 - offset.x) / scale
    const worldY = (pointerY - viewport.height / 2 - offset.y) / scale

    setScale(nextScale)
    setOffset({
      x: pointerX - viewport.width / 2 - worldX * nextScale,
      y: pointerY - viewport.height / 2 - worldY * nextScale,
    })
  }

  const startDesktopConnectionDrag = (
    nodeId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (isMobileLayout || event.pointerType !== 'mouse' || event.button !== 0) return

    event.stopPropagation()
    const worldPoint = screenToWorld(event.clientX, event.clientY, boardRef.current, offset, scale)

    setSelectedNodeId(nodeId)
    setEditingNodeId(null)
    setConnectionDrag({
      fromId: nodeId,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      worldX: worldPoint?.x ?? nodesById[nodeId]?.x ?? 0,
      worldY: worldPoint?.y ?? nodesById[nodeId]?.y ?? 0,
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
      clearLongPress()
      return
    }

    setSelectedNodeId(nodeId)
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
    setEditingNodeId(nodeId)
    setActionSheetNodeId(null)
    setInteractionMode('edit')
  }

  const selectedNode = nodesById[activeSelectedNodeId]
  const actionSheetNode = actionSheetNodeId ? nodesById[actionSheetNodeId] : null
  const selectedNodeMeta = selectedNode ? parseNodeMeta(selectedNode.note) : null
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
    setActionSheetNodeId(null)
    setInteractionMode('navigate')
    setSelectedNodeId(nodes.find((candidate) => candidate.id !== nodeId)?.id ?? 'root')
    setEditingNodeId(null)
  }

  const previewPath = connectionDrag
    ? getPreviewPath(nodesById[connectionDrag.fromId], {
        x: connectionDrag.worldX,
        y: connectionDrag.worldY,
      })
    : null

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

  const inspectorStyle = useMemo(() => {
    if (!selectedNode || isMobileLayout || boardSize.width === 0 || boardSize.height === 0) return null

    const { width, height } = boardSize
    const rawLeft = width / 2 + offset.x + selectedNode.x * scale + 52
    const rawTop = height / 2 + offset.y + selectedNode.y * scale - 28

    return {
      left: `${Math.min(width - 302, Math.max(18, rawLeft))}px`,
      top: `${Math.min(height - 410, Math.max(90, rawTop))}px`,
    }
  }, [boardSize, isMobileLayout, offset.x, offset.y, scale, selectedNode])

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

  const combinedError = error ?? graphError

  return (
    <main className={`app-shell theme-${theme}${isMobileLayout ? ' app-shell--mobile' : ''}`}>
      <div className="app-actions">
        <div className="account-panel" aria-live="polite">
          {status === 'authenticated' && session?.user ? (
            <>
              {session.user.user_metadata.avatar_url ? (
                <img className="account-panel__avatar" src={session.user.user_metadata.avatar_url} alt="" />
              ) : (
                <span className="account-panel__avatar" aria-hidden="true">
                  {(session.user.email ?? 'U').slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="account-panel__text">
                <span className="account-panel__label">{session.user.email}</span>
                <span className="account-panel__meta">
                  {board?.title ?? 'Personal board'}
                  {graphStatus === 'loading' ? ' · Syncing graph' : ''}
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
                    : 'Sign in to sync your graph across devices'}
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
          {combinedError ? <span className="account-panel__error">{combinedError}</span> : null}
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
        className={`board-viewport${isMobileLayout ? ' board-viewport--mobile' : ''}`}
        onPointerDown={handleBoardPointerDown}
        onPointerMove={handleBoardPointerMove}
        onPointerUp={handleBoardPointerUp}
        onPointerCancel={handleBoardPointerCancel}
        onPointerLeave={() => {
          lastHighlightSpotRef.current = null
          setPointerPosition(null)
        }}
        onWheel={handleBoardWheel}
        aria-label="Social network graph canvas"
      >
        <div className="board-surface" style={boardStyle} />
        <div className="board-highlights" aria-hidden="true">
          {highlightSpots.map((spot) => {
            const spotStyle = getHighlightSpotStyle(spot)

            if (!spotStyle) return null

            return <span key={spot.id} className="board-highlights__spot" style={spotStyle} />
          })}
        </div>

        <div className="graph-layer" style={graphStyle}>
          <svg
            className="graph-connections"
            viewBox="-2200 -2200 4400 4400"
            aria-hidden="true"
          >
            {edges.map((edge) => {
              const fromNode = nodesById[edge.from]
              const toNode = nodesById[edge.to]
              if (!fromNode || !toNode) return null

              const link = getLinkPath(fromNode, toNode, isMobileLayout)
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

          {nodes.map((node) => {
            const isSelected = node.id === activeSelectedNodeId
            const isEditing = node.id === editingNodeId
            const nodeMeta = parseNodeMeta(node.note)
            const hasMeta = Boolean(nodeMeta.notes.length || node.tag)

            return (
              <div
                key={node.id}
                className={`graph-node${node.kind === 'root' ? ' graph-node--root' : ''}${isSelected ? ' is-selected' : ''}${isMobileLayout ? ' graph-node--mobile' : ''}`}
                style={
                  {
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    '--node-color': nodeMeta.color,
                  } as CSSProperties
                }
              >
                {isEditing ? (
                  <div
                    className="graph-node__editor"
                    data-node-interactive="true"
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <span className="graph-node__dot" />
                    <input
                      className="graph-node__input"
                      value={node.label}
                      placeholder="Name"
                      autoFocus
                      onChange={(event) => updateNodeLabel(node.id, event.target.value)}
                      onBlur={() => {
                        setEditingNodeId(null)
                        setInteractionMode('navigate')
                      }}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="graph-node__button"
                    data-node-interactive="true"
                    data-selected={isSelected}
                    onPointerDown={(event) => {
                      startDesktopConnectionDrag(node.id, event)
                      startNodeLongPress(node.id, event)
                    }}
                    onPointerUp={() => {
                      void handleNodePress(node.id)
                    }}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (suppressNodeClickRef.current) {
                        suppressNodeClickRef.current = false
                        return
                      }
                      setSelectedNodeId(node.id)
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      if (!isMobileLayout) {
                        startEditingNode(node.id)
                      }
                    }}
                  >
                    <span className="graph-node__dot" />
                    <span className="graph-node__labelWrap">
                      <span className="graph-node__label">{node.label || 'Untitled'}</span>
                      {node.tag ? <span className="graph-node__tag">{node.tag}</span> : null}
                      {hasMeta ? (
                        <span className="graph-node__meta">
                          {nodeMeta.notes.length > 0
                            ? `${nodeMeta.notes.length} note${nodeMeta.notes.length === 1 ? '' : 's'}`
                            : 'Tagged node'}
                        </span>
                      ) : null}
                    </span>
                  </button>
                )}

                {isMobileLayout ? (
                  <button
                    type="button"
                    className="graph-node__moveHandle"
                    data-node-interactive="true"
                    aria-label={`Move ${node.label || 'node'}`}
                    onPointerDown={(event) => startNodeMove(node.id, event)}
                    onPointerMove={handleBoardPointerMove}
                    onPointerUp={handleBoardPointerUp}
                  >
                    <span className="graph-node__moveHandleIcon" />
                  </button>
                ) : null}
              </div>
            )
          })}

          {selectedNode && selectedNodeMeta && inspectorStyle ? (
            <aside
              className="node-inspector"
              style={inspectorStyle}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="node-inspector__header">
                <div className="node-inspector__identity">
                  <span
                    className="node-inspector__swatch"
                    style={{ backgroundColor: selectedNodeMeta.color }}
                    aria-hidden="true"
                  />
                  <div>
                    <div className="node-inspector__eyebrow">Node</div>
                    <div className="node-inspector__title">
                      {selectedNode.label.trim() || 'Untitled person'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="node-inspector__undo"
                  onClick={undoLastGraphChange}
                  disabled={history.length === 0}
                >
                  Undo
                </button>
              </div>

              <section className="node-inspector__section">
                <div className="node-inspector__section-label">Color</div>
                <div className="node-inspector__palette" aria-label="Node color palette">
                  {NODE_COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`node-inspector__color${
                        selectedNodeMeta.color === color ? ' is-active' : ''
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => void setNodeColor(selectedNode.id, color)}
                      aria-label={`Use ${color} for this node`}
                    />
                  ))}
                </div>
              </section>

              <section className="node-inspector__section">
                <div className="node-inspector__section-row">
                  <div className="node-inspector__section-label">Notes</div>
                  <button
                    type="button"
                    className="node-inspector__add-note"
                    onClick={() => void addNoteToNode(selectedNode.id)}
                  >
                    Add note
                  </button>
                </div>
                <div className="node-inspector__notes">
                  {selectedNodeMeta.notes.length === 0 ? (
                    <div className="node-inspector__empty">No notes yet.</div>
                  ) : (
                    selectedNodeMeta.notes.map((note, index) => (
                      <div key={note.id} className="node-inspector__note">
                        <div className="node-inspector__note-header">
                          <span className="node-inspector__note-label">Note {index + 1}</span>
                          <button
                            type="button"
                            className="node-inspector__note-delete"
                            onClick={() => void deleteNodeNote(selectedNode.id, note.id)}
                          >
                            Remove
                          </button>
                        </div>
                        <textarea
                          className="node-inspector__note-input"
                          value={note.text}
                          placeholder="Write a note about this person"
                          onChange={(event) =>
                            void updateNodeNote(selectedNode.id, note.id, event.target.value)
                          }
                        />
                      </div>
                    ))
                  )}
                </div>
              </section>

              <button
                type="button"
                className="node-inspector__delete"
                onClick={() => void deleteSelectedNode(selectedNode.id)}
                disabled={selectedNode.kind === 'root'}
              >
                <svg
                  className="node-inspector__delete-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h2v8H7V9Zm4 0h2v8h-2V9Zm4 0h2v8h-2V9ZM6 9h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9Z"
                    fill="currentColor"
                  />
                </svg>
                Delete
              </button>
            </aside>
          ) : null}
        </div>

        {isMobileLayout ? (
          <div className="mobile-toolbar" aria-label="Mobile board controls">
            <button
              type="button"
              className={`mobile-toolbar__button${activeInteractionMode === 'navigate' ? ' is-active' : ''}`}
              onClick={() => setMobileMode('navigate')}
            >
              Pan
            </button>
            <button
              type="button"
              className={`mobile-toolbar__button${activeInteractionMode === 'connect' ? ' is-active' : ''}`}
              onClick={() => setMobileMode('connect')}
              disabled={!selectedNode}
            >
              Add relation
            </button>
            <button
              type="button"
              className="mobile-toolbar__button"
              onClick={() => {
                if (!selectedNode) return

                const noteValue = window.prompt(
                  'Edit notes',
                  parseNodeMeta(selectedNode.note).notes.map((note) => note.text).join('\n\n'),
                )
                if (noteValue === null) return

                void updateNode(selectedNode.id, {
                  note: serializeNodeMeta({
                    ...parseNodeMeta(selectedNode.note),
                    notes: notesFromPromptValue(noteValue),
                  }),
                })
              }}
              disabled={!selectedNode}
            >
              Add note
            </button>
          </div>
        ) : null}

        {isMobileLayout && actionSheetNode ? (
          <div className="mobile-sheet" role="dialog" aria-label="Node actions">
            <div className="mobile-sheet__header">
              <div>
                <div className="mobile-sheet__eyebrow">Selected node</div>
                <div className="mobile-sheet__title">{actionSheetNode.label || 'Untitled'}</div>
                <div className="mobile-sheet__meta">
                  {actionSheetNodeMeta && actionSheetNodeMeta.notes.length > 0
                    ? `${actionSheetNodeMeta.notes.length} note${actionSheetNodeMeta.notes.length === 1 ? '' : 's'}`
                    : 'No notes yet'}
                  {actionSheetNode.tag ? ` · ${actionSheetNode.tag}` : ''}
                </div>
              </div>
              <button
                type="button"
                className="mobile-sheet__close"
                onClick={() => {
                  setActionSheetNodeId(null)
                  setInteractionMode('navigate')
                }}
              >
                Close
              </button>
            </div>

            <div className="mobile-sheet__actions">
              <button type="button" className="mobile-sheet__button" onClick={() => startEditingNode(actionSheetNode.id)}>
                Rename
              </button>
              <button
                type="button"
                className="mobile-sheet__button"
                onClick={() => {
                  const noteValue = window.prompt(
                    'Edit notes',
                    (actionSheetNodeMeta?.notes ?? []).map((note) => note.text).join('\n\n'),
                  )
                  if (noteValue === null) return

                  void updateNode(actionSheetNode.id, {
                    note: serializeNodeMeta({
                      ...(actionSheetNodeMeta ?? { color: DEFAULT_NODE_COLOR, notes: [] }),
                      notes: notesFromPromptValue(noteValue),
                    }),
                  })
                }}
              >
                Add note
              </button>
              <button
                type="button"
                className="mobile-sheet__button"
                onClick={() => {
                  const tagValue = window.prompt('Set tag', actionSheetNode.tag ?? '')
                  if (tagValue === null) return

                  void updateNode(actionSheetNode.id, { tag: tagValue.trim() || null })
                }}
              >
                Set tag
              </button>
              <button
                type="button"
                className="mobile-sheet__button mobile-sheet__button--danger"
                disabled={actionSheetNode.kind === 'root'}
                onClick={() => {
                  if (actionSheetNode.kind === 'root') return

                  if (!window.confirm('Delete this node and all of its connections?')) return

                  void deleteSelectedNode(actionSheetNode.id)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ) : null}
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

function getLinkPath(fromNode?: GraphNode, toNode?: Offset | null, isMobileLayout = false) {
  if (!fromNode || !toNode) return null

  const radius = getNodeRadius(fromNode.kind, isMobileLayout)
  const dx = toNode.x - fromNode.x
  const dy = toNode.y - fromNode.y
  const distance = Math.hypot(dx, dy) || 1
  const unitX = dx / distance
  const unitY = dy / distance
  const curve = Math.min(isMobileLayout ? 88 : 44, distance * 0.18)

  return {
    start: {
      x: fromNode.x + unitX * radius,
      y: fromNode.y + unitY * radius,
    },
    end: {
      x: toNode.x - unitX * NODE_RADIUS,
      y: toNode.y - unitY * NODE_RADIUS,
    },
    controlA: {
      x: fromNode.x + unitX * (radius + curve),
      y: fromNode.y + unitY * (radius + curve),
    },
    controlB: {
      x: toNode.x - unitX * (NODE_RADIUS + curve),
      y: toNode.y - unitY * (NODE_RADIUS + curve),
    },
  }
}

function getPreviewPath(fromNode?: GraphNode, pointer?: Offset | null) {
  return getLinkPath(fromNode, pointer)
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
    return kind === 'root' ? 15 : 12
  }

  return kind === 'root' ? 36 : 28
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
}

export default App
