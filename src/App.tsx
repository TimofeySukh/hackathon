import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'

type Person = {
  id: string
  name: string
  role: string
  initials: string
  x: number
  y: number
}

type CircleGroup = {
  id: string
  name: string
  tone: 'coral' | 'blue' | 'violet' | 'green' | 'amber'
  x: number
  y: number
  width: number
  height: number
  people: Person[]
}

type Camera = {
  x: number
  y: number
  scale: number
}

type DragState =
  | { type: 'pan'; pointerId: number; startX: number; startY: number; originX: number; originY: number }
  | { type: 'group'; pointerId: number; groupId: string; startX: number; startY: number; originX: number; originY: number }
  | {
      type: 'resize'
      pointerId: number
      groupId: string
      startX: number
      startY: number
      originWidth: number
      originHeight: number
    }

const initialGroups: CircleGroup[] = [
  {
    id: 'family',
    name: 'Family',
    tone: 'coral',
    x: -560,
    y: -170,
    width: 360,
    height: 300,
    people: [
      { id: 'maria', name: 'Maria', role: 'mom', initials: 'MA', x: 0.3, y: 0.38 },
      { id: 'alex', name: 'Alex', role: 'brother', initials: 'AL', x: 0.58, y: 0.3 },
      { id: 'nina', name: 'Nina', role: 'cousin', initials: 'NI', x: 0.5, y: 0.62 },
    ],
  },
  {
    id: 'school',
    name: 'School',
    tone: 'blue',
    x: -160,
    y: 190,
    width: 430,
    height: 315,
    people: [
      { id: 'emma', name: 'Emma', role: 'design', initials: 'EM', x: 0.22, y: 0.42 },
      { id: 'jonas', name: 'Jonas', role: 'math', initials: 'JO', x: 0.44, y: 0.27 },
      { id: 'sara', name: 'Sara', role: 'events', initials: 'SA', x: 0.66, y: 0.48 },
      { id: 'daniel', name: 'Daniel', role: 'old friend', initials: 'DA', x: 0.48, y: 0.68 },
    ],
  },
  {
    id: 'hackathon',
    name: 'Hackathon',
    tone: 'violet',
    x: -40,
    y: -210,
    width: 470,
    height: 335,
    people: [
      { id: 'liam', name: 'Liam', role: 'frontend', initials: 'LI', x: 0.24, y: 0.42 },
      { id: 'maya', name: 'Maya', role: 'pitch', initials: 'MY', x: 0.46, y: 0.29 },
      { id: 'noah', name: 'Noah', role: 'backend', initials: 'NO', x: 0.66, y: 0.43 },
      { id: 'vera', name: 'Vera', role: 'mentor', initials: 'VE', x: 0.5, y: 0.65 },
    ],
  },
  {
    id: 'work',
    name: 'Work',
    tone: 'green',
    x: 420,
    y: 150,
    width: 390,
    height: 300,
    people: [
      { id: 'oliver', name: 'Oliver', role: 'pm', initials: 'OL', x: 0.3, y: 0.36 },
      { id: 'freja', name: 'Freja', role: 'data', initials: 'FR', x: 0.58, y: 0.32 },
      { id: 'tobias', name: 'Tobias', role: 'ops', initials: 'TO', x: 0.5, y: 0.6 },
    ],
  },
  {
    id: 'copenhagen',
    name: 'Copenhagen',
    tone: 'amber',
    x: 500,
    y: -230,
    width: 330,
    height: 260,
    people: [
      { id: 'ida', name: 'Ida', role: 'founder', initials: 'ID', x: 0.32, y: 0.42 },
      { id: 'mikkel', name: 'Mikkel', role: 'coffee', initials: 'MI', x: 0.62, y: 0.5 },
    ],
  },
]

const links = [
  ['hackathon', 'work'],
  ['hackathon', 'school'],
  ['school', 'family'],
  ['work', 'copenhagen'],
]

function App() {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const [groups, setGroups] = useState(initialGroups)
  const [selectedGroupId, setSelectedGroupId] = useState('hackathon')
  const [query, setQuery] = useState('')
  const [camera, setCamera] = useState<Camera>({ x: -180, y: -40, scale: 0.68 })
  const [dragState, setDragState] = useState<DragState | null>(null)

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0]
  const isCollapsed = camera.scale < 0.56
  const lowerQuery = query.trim().toLowerCase()

  const groupById = useMemo(() => Object.fromEntries(groups.map((group) => [group.id, group])), [groups])

  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    const boardElement = board

    function handleNativeWheel(event: WheelEvent) {
      event.preventDefault()
      const rect = boardElement.getBoundingClientRect()
      const nextScale = clamp(camera.scale - event.deltaY * 0.0012, 0.38, 1.35)
      const before = {
        x: (event.clientX - rect.left - camera.x) / camera.scale,
        y: (event.clientY - rect.top - camera.y) / camera.scale,
      }
      setCamera({
        scale: nextScale,
        x: event.clientX - rect.left - before.x * nextScale,
        y: event.clientY - rect.top - before.y * nextScale,
      })
    }

    boardElement.addEventListener('wheel', handleNativeWheel, { passive: false })
    return () => boardElement.removeEventListener('wheel', handleNativeWheel)
  }, [camera])

  function startPan(event: PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragState({
      type: 'pan',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: camera.x,
      originY: camera.y,
    })
  }

  function startGroupDrag(event: PointerEvent<HTMLButtonElement>, group: CircleGroup) {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedGroupId(group.id)
    setDragState({
      type: 'group',
      pointerId: event.pointerId,
      groupId: group.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: group.x,
      originY: group.y,
    })
  }

  function startResize(event: PointerEvent<HTMLButtonElement>, group: CircleGroup) {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedGroupId(group.id)
    setDragState({
      type: 'resize',
      pointerId: event.pointerId,
      groupId: group.id,
      startX: event.clientX,
      startY: event.clientY,
      originWidth: group.width,
      originHeight: group.height,
    })
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragState || event.pointerId !== dragState.pointerId) return
    if (dragState.type === 'pan') {
      setCamera((current) => ({
        ...current,
        x: dragState.originX + event.clientX - dragState.startX,
        y: dragState.originY + event.clientY - dragState.startY,
      }))
      return
    }

    if (dragState.type === 'group') {
      const dx = (event.clientX - dragState.startX) / camera.scale
      const dy = (event.clientY - dragState.startY) / camera.scale
      setGroups((current) =>
        current.map((group) =>
          group.id === dragState.groupId ? { ...group, x: dragState.originX + dx, y: dragState.originY + dy } : group,
        ),
      )
      return
    }

    const dx = (event.clientX - dragState.startX) / camera.scale
    const dy = (event.clientY - dragState.startY) / camera.scale
    setGroups((current) =>
      current.map((group) =>
        group.id === dragState.groupId
          ? {
              ...group,
              width: Math.max(260, dragState.originWidth + dx),
              height: Math.max(210, dragState.originHeight + dy),
            }
          : group,
      ),
    )
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragState?.pointerId === event.pointerId) {
      setDragState(null)
    }
  }

  function setZoom(scale: number) {
    setCamera((current) => ({ ...current, scale: clamp(scale, 0.38, 1.35) }))
  }

  return (
    <main className="prototype-shell">
      <header className="top-chrome">
        <div className="brand-lockup" aria-label="Datanode social map prototype">
          <span className="brand-mark">dn</span>
          <span className="brand-text">Social map</span>
        </div>
        <label className="search-box">
          <span className="search-box__icon" aria-hidden="true">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people or circles"
            aria-label="Search people or circles"
          />
        </label>
        <div className="toolbar-group" aria-label="Zoom controls">
          <button type="button" onClick={() => setZoom(camera.scale - 0.12)} aria-label="Zoom out">
            -
          </button>
          <span>{Math.round(camera.scale * 100)}%</span>
          <button type="button" onClick={() => setZoom(camera.scale + 0.12)} aria-label="Zoom in">
            +
          </button>
        </div>
      </header>

      <section
        ref={boardRef}
        className={`relationship-board${dragState?.type === 'pan' ? ' is-panning' : ''}`}
        onPointerDown={startPan}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        aria-label="Relationship circle canvas prototype"
      >
        <div
          className="board-plane"
          style={{
            transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`,
          }}
        >
          <svg className="group-links" width="1" height="1" aria-hidden="true">
            {links.map(([fromId, toId]) => {
              const from = groupById[fromId]
              const to = groupById[toId]
              if (!from || !to) return null
              const fromPoint = centerOf(from)
              const toPoint = centerOf(to)
              return (
                <path
                  key={`${fromId}-${toId}`}
                  d={`M ${fromPoint.x} ${fromPoint.y} C ${(fromPoint.x + toPoint.x) / 2} ${fromPoint.y}, ${
                    (fromPoint.x + toPoint.x) / 2
                  } ${toPoint.y}, ${toPoint.x} ${toPoint.y}`}
                />
              )
            })}
          </svg>

          {groups.map((group) => {
            const matchesGroup =
              lowerQuery.length === 0 ||
              group.name.toLowerCase().includes(lowerQuery) ||
              group.people.some((person) => `${person.name} ${person.role}`.toLowerCase().includes(lowerQuery))
            return (
              <article
                key={group.id}
                className={[
                  'circle-group',
                  `circle-group--${group.tone}`,
                  selectedGroupId === group.id ? 'is-selected' : '',
                  matchesGroup ? '' : 'is-muted',
                  isCollapsed ? 'is-collapsed' : '',
                ].join(' ')}
                style={{
                  transform: `translate3d(${group.x}px, ${group.y}px, 0)`,
                  width: group.width,
                  height: group.height,
                }}
              >
                <button className="circle-group__drag-layer" type="button" onPointerDown={(event) => startGroupDrag(event, group)}>
                  <span className="circle-group__title">{group.name}</span>
                  <span className="circle-group__count">{group.people.length} people</span>
                </button>

                <div className="circle-group__people" aria-hidden={isCollapsed}>
                  {group.people.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      className={[
                        'person-node',
                        lowerQuery && `${person.name} ${person.role}`.toLowerCase().includes(lowerQuery) ? 'is-match' : '',
                      ].join(' ')}
                      style={{ left: `${person.x * 100}%`, top: `${person.y * 100}%` }}
                    >
                      <span className="person-node__avatar">{person.initials}</span>
                      <span className="person-node__copy">
                        <strong>{person.name}</strong>
                        <small>{person.role}</small>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="circle-group__collapsed-preview">
                  <span>{group.people.length}</span>
                  <div>
                    {group.people.slice(0, 3).map((person) => (
                      <i key={person.id}>{person.initials.slice(0, 1)}</i>
                    ))}
                  </div>
                </div>

                <button className="resize-handle" type="button" onPointerDown={(event) => startResize(event, group)} aria-label={`Resize ${group.name}`} />
              </article>
            )
          })}
        </div>
      </section>

      <aside className="inspector-panel" aria-label="Selected circle details">
        <div>
          <p className="panel-kicker">Selected circle</p>
          <h1>{selectedGroup.name}</h1>
          <p>
            Move the circle to reorganize the map. Resize it when a real-life context needs more space. People stay
            attached to their circle.
          </p>
        </div>
        <div className="panel-stats">
          <span>
            <strong>{selectedGroup.people.length}</strong>
            People
          </span>
          <span>
            <strong>{Math.round(selectedGroup.width)}px</strong>
            Width
          </span>
        </div>
        <div className="people-list">
          {selectedGroup.people.map((person) => (
            <button type="button" key={person.id}>
              <span>{person.initials}</span>
              <strong>{person.name}</strong>
              <small>{person.role}</small>
            </button>
          ))}
        </div>
      </aside>

      <div className="legend-strip" aria-label="Circle legend">
        {groups.map((group) => (
          <button
            type="button"
            key={group.id}
            className={`legend-chip legend-chip--${group.tone}${selectedGroupId === group.id ? ' is-active' : ''}`}
            onClick={() => setSelectedGroupId(group.id)}
          >
            {group.name}
          </button>
        ))}
      </div>
    </main>
  )
}

function centerOf(group: CircleGroup) {
  return {
    x: group.x + group.width / 2,
    y: group.y + group.height / 2,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="m20 20-4.4-4.4m2.4-5.1a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
    </svg>
  )
}

export default App
