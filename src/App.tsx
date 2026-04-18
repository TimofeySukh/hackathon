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

type ConnectionDrag = {
  fromId: string
  startClientX: number
  startClientY: number
  clientX: number
  clientY: number
  worldX: number
  worldY: number
}

type EdgeStyle = CSSProperties & {
  width: string
  transform: string
}

const THEME_STORAGE_KEY = 'hackathon-theme'
const MIN_SCALE = 0.2
const MAX_SCALE = 2.5
const GRID_GAP = 12
const MAJOR_GRID_GAP = 96
const DOT_SIZE = 0.65
const MAJOR_DOT_SIZE = 2
const NODE_HIT_RADIUS = 31
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
  const [inspectorNodeId, setInspectorNodeId] = useState<string | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDrag | null>(null)
  const [isDraggingBoard, setIsDraggingBoard] = useState(false)

  const boardRef = useRef<HTMLElement | null>(null)
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

  const nodesById = useMemo(
    () => Object.fromEntries(nodes.map((node) => [node.id, node])) as Record<string, GraphNode>,
    [nodes],
  )
  const inspectorNode = inspectorNodeId ? nodesById[inspectorNodeId] : null

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

        const distanceToNode = Math.hypot(
          node.x - connectionDrag.worldX,
          node.y - connectionDrag.worldY,
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
        setInspectorNodeId(null)
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
      setInspectorNodeId(null)
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
    }

    const handleMouseUp = (event: MouseEvent) => {
      if (connectionDrag) {
        finishConnectionDrag(event.clientX, event.clientY)
        return
      }

      boardDragRef.current.active = false
      setIsDraggingBoard(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [connectionDrag, finishConnectionDrag, offset, scale])

  const startBoardDragging = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.button !== 0 || connectionDrag) return

    boardDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
      active: true,
    }

    setIsDraggingBoard(true)
    setInspectorNodeId(null)
    setEditingNodeId(null)
  }

  const startConnectionDrag = (nodeId: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return

    event.stopPropagation()
    boardDragRef.current.active = false
    setIsDraggingBoard(false)
    setSelectedNodeId(nodeId)
    setInspectorNodeId(null)
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

  const deleteNode = (nodeId: string) => {
    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId))
    setEdges((currentEdges) =>
      currentEdges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
    )
    setInspectorNodeId(null)
    setEditingNodeId(null)

    if (selectedNodeId === nodeId) {
      setSelectedNodeId('root')
    }
  }

  const moveWithWheel = (event: ReactWheelEvent<HTMLElement>) => {
    event.preventDefault()

    const isMouseWheel = event.deltaMode === 1
    const isTrackpadPinch = event.ctrlKey
    const prefersZoom = (isMouseWheel || isTrackpadPinch) && Math.abs(event.deltaX) < 1

    if (!prefersZoom) {
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
    ? getLineStyle(nodesById[connectionDrag.fromId], {
        x: connectionDrag.worldX,
        y: connectionDrag.worldY,
      })
    : null

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
        onWheel={moveWithWheel}
        aria-label="Social network graph canvas"
      >
        <div className="board-surface" style={boardStyle} />

        <div className="graph-layer" style={graphStyle}>
          <div className="graph-connections" aria-hidden="true">
            {edges.map((edge) => {
              const fromNode = nodesById[edge.from]
              const toNode = nodesById[edge.to]
              const lineStyle = getLineStyle(fromNode, toNode)
              if (!lineStyle) return null

              return <span key={edge.id} className="graph-edge" style={lineStyle} />
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
                      setInspectorNodeId(null)
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      setSelectedNodeId(node.id)
                      setInspectorNodeId(node.id)
                    }}
                  >
                    <span className="graph-node__dot" />
                    <span className="graph-node__label">{node.label}</span>
                  </button>
                )}
              </div>
            )
          })}

          {inspectorNode ? (
            <div
              className="node-inspector"
              style={{ left: `${inspectorNode.x}px`, top: `${inspectorNode.y + 34}px` }}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="node-inspector__title">{inspectorNode.label || 'Untitled'}</div>
              <div className="node-inspector__actions">
                <button
                  type="button"
                  className="node-inspector__button"
                  onClick={() => {
                    setInspectorNodeId(null)
                    setEditingNodeId(inspectorNode.id)
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="node-inspector__button node-inspector__button--danger"
                  onClick={() => deleteNode(inspectorNode.id)}
                  disabled={inspectorNode.kind === 'root'}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : null}
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

function getLineStyle(fromNode?: GraphNode, toNode?: Offset | null): EdgeStyle | null {
  if (!fromNode || !toNode) return null

  const dx = toNode.x - fromNode.x
  const dy = toNode.y - fromNode.y
  const distance = Math.hypot(dx, dy)
  if (distance < 1) return null

  return {
    width: `${distance}px`,
    transform: `translate(${fromNode.x}px, ${fromNode.y}px) rotate(${Math.atan2(dy, dx)}rad)`,
  }
}

export default App
