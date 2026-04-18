import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  WheelEvent as ReactWheelEvent,
} from 'react'

import { useAuth } from './lib/useAuth'
import { normalizeTagName } from './lib/graphStorage'
import type { PersonNode, PersonNote } from './lib/graphTypes'
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
const CREATE_THRESHOLD = 18

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
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDrag | null>(null)
  const [nodeDrag, setNodeDrag] = useState<NodeDrag | null>(null)
  const [draggedPositions, setDraggedPositions] = useState<Record<string, Offset>>({})
  const [nameDraft, setNameDraft] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [newNoteBody, setNewNoteBody] = useState('')
  const [noteDrafts, setNoteDrafts] = useState<Record<string, NoteDraft>>({})
  const [isDraggingBoard, setIsDraggingBoard] = useState(false)

  const boardRef = useRef<HTMLElement | null>(null)
  const boardSurfaceRef = useRef<HTMLDivElement | null>(null)
  const graphLayerRef = useRef<HTMLDivElement | null>(null)
  const zoomIndicatorRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef({ offset: { x: 0, y: 0 }, scale: 1 })
  const pendingViewportRef = useRef<{ offset: Offset; scale: number } | null>(null)
  const viewportFrameRef = useRef<number | null>(null)
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
        return distanceToNode <= NODE_HIT_RADIUS / scale
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
    [boardNodes, connectionDrag, createConnection, createPerson, isGraphReady, scale],
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

      if (nodeDrag) {
        setDraggedPositions((currentPositions) => ({
          ...currentPositions,
          [nodeDrag.nodeId]: {
            x: nodeDrag.originX + (event.clientX - nodeDrag.startClientX) / scale,
            y: nodeDrag.originY + (event.clientY - nodeDrag.startClientY) / scale,
          },
        }))
        return
      }

      if (!boardDragRef.current.active) return

      const nextX = boardDragRef.current.originX + event.clientX - boardDragRef.current.startX
      const nextY = boardDragRef.current.originY + event.clientY - boardDragRef.current.startY

      setOffset({ x: nextX, y: nextY })
      addHighlightSpot(event.clientX, event.clientY)
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
        lastHighlightSpotRef.current = null
        setIsDraggingBoard(false)
      })()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [addHighlightSpot, connectionDrag, draggedPositions, finishConnectionDrag, movePerson, nodeDrag, offset, scale])

  function startBoardDragging(event: ReactMouseEvent<HTMLElement>) {
    if (event.button !== 0 || connectionDrag || nodeDrag) return

    boardDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
      active: true,
    }

    addHighlightSpot(event.clientX, event.clientY, true)
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

    if (event.shiftKey && !node.is_root) {
      setNodeDrag({
        nodeId: node.id,
        startClientX: event.clientX,
        startClientY: event.clientY,
        originX: node.x,
        originY: node.y,
      })
      return
    }

    const worldPoint = screenToWorld(event.clientX, event.clientY, boardRef.current, offset, scale)
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

  function moveWithWheel(event: ReactWheelEvent<HTMLElement>) {
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

  async function handleCreateNote() {
    if (!inspectorNode || !isGraphReady) return

    const title = newNoteTitle.trim() || 'Untitled note'
    const body = newNoteBody.trim()

    if (!title && !body) return

    await createNote(title, body, inspectorNode.id)
    setNewNoteTitle('')
    setNewNoteBody('')
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

    await deletePerson(inspectorNode.id)
    setInspectorNodeId(null)
    setSelectedNodeId(null)
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
          className="inspector-panel inspector-panel--floating"
          style={{
            left: `calc(50% + ${offset.x + inspectorNode.x * scale + 42}px)`,
            top: `calc(50% + ${offset.y + inspectorNode.y * scale}px)`,
          }}
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
                  ? 'Drag to connect. Hold Shift to move.'
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

            return (
              <div
                key={node.id}
                className={`graph-node${node.is_root ? ' graph-node--root' : ''}${isSelected ? ' is-selected' : ''}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
              >
                <button
                  type="button"
                  className="graph-node__button"
                  title={
                    isGraphReady
                      ? node.is_root
                        ? 'Drag to connect'
                        : 'Drag to connect. Hold Shift to move.'
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

export default App
