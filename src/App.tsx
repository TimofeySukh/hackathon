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
const HIGHLIGHT_LIFETIME_MS = 420
const HIGHLIGHT_DISTANCE = 12
const HIGHLIGHT_LIMIT = 28
const HIGHLIGHT_RADIUS = 56
const HIGHLIGHT_TICK_MS = 50
const HIGHLIGHT_TAIL_START = 18
const HIGHLIGHT_TAIL_LIMIT = 48
const NODE_RADIUS = 9
const CREATE_THRESHOLD = 18

const INITIAL_NODES: GraphNode[] = [{ id: 'root', label: 'You', x: 0, y: 0, kind: 'root' }]
const INITIAL_EDGES: GraphEdge[] = []

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

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

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
    [connectionDrag],
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

    addHighlightSpot(event.clientX, event.clientY, true)
    setIsDraggingBoard(true)
    setEditingNodeId(null)
  }

  const startConnectionDrag = (nodeId: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return

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
        className={`board-viewport${isDraggingBoard ? ' is-dragging' : ''}`}
        onMouseDown={startBoardDragging}
        onMouseEnter={(event) => addHighlightSpot(event.clientX, event.clientY, true)}
        onMouseMove={(event) => addHighlightSpot(event.clientX, event.clientY)}
        onMouseLeave={() => {
          lastHighlightSpotRef.current = null
          setPointerPosition(null)
        }}
        onWheel={moveWithWheel}
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
            <defs>
              <marker
                id="network-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className="graph-arrow-head" />
              </marker>
            </defs>

            {edges.map((edge) => {
              const fromNode = nodesById[edge.from]
              const toNode = nodesById[edge.to]
              if (!fromNode || !toNode) return null

              const link = getLinkPath(fromNode, toNode)
              if (!link) return null

              return (
                <path
                  key={edge.id}
                  className="graph-edge"
                  d={`M ${link.start.x} ${link.start.y} C ${link.controlA.x} ${link.controlA.y}, ${link.controlB.x} ${link.controlB.y}, ${link.end.x} ${link.end.y}`}
                  markerEnd="url(#network-arrow)"
                />
              )
            })}

            {previewPath ? (
              <path
                className="graph-edge graph-edge--preview"
                d={`M ${previewPath.start.x} ${previewPath.start.y} C ${previewPath.controlA.x} ${previewPath.controlA.y}, ${previewPath.controlB.x} ${previewPath.controlB.y}, ${previewPath.end.x} ${previewPath.end.y}`}
                markerEnd="url(#network-arrow)"
              />
            ) : null}
          </svg>

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

function getLinkPath(fromNode?: GraphNode, toNode?: Offset | null) {
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

function getPreviewPath(fromNode?: GraphNode, pointer?: Offset | null) {
  return getLinkPath(fromNode, pointer)
}

export default App
