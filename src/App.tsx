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
      type: 'person'
      pointerId: number
      groupId: string
      personId: string
      startX: number
      startY: number
      originX: number
      originY: number
    }
  | {
      type: 'resize'
      pointerId: number
      groupId: string
      startX: number
      startY: number
      originWidth: number
      originHeight: number
    }

const toneCycle: CircleGroup['tone'][] = ['coral', 'blue', 'violet', 'green', 'amber']

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
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [camera, setCamera] = useState<Camera>({ x: -180, y: -40, scale: 0.68 })
  const [dragState, setDragState] = useState<DragState | null>(null)

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0]
  const selectedPersonContext = getPersonContext(groups, selectedPersonId)
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
    setSelectedPersonId(null)
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

  function startPersonDrag(event: PointerEvent<HTMLButtonElement>, group: CircleGroup, person: Person) {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedGroupId(group.id)
    setDragState({
      type: 'person',
      pointerId: event.pointerId,
      groupId: group.id,
      personId: person.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: person.x,
      originY: person.y,
    })
  }

  function startResize(event: PointerEvent<HTMLButtonElement>, group: CircleGroup) {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedGroupId(group.id)
    setSelectedPersonId(null)
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

    if (dragState.type === 'person') {
      const dx = (event.clientX - dragState.startX) / camera.scale
      const dy = (event.clientY - dragState.startY) / camera.scale
      const originGroup = groups.find((group) => group.id === dragState.groupId)
      if (!originGroup) return

      const nextPersonX = dragState.originX + dx / originGroup.width
      const nextPersonY = dragState.originY + dy / originGroup.height
      setGroups((current) =>
        current.map((group) =>
          group.id === dragState.groupId
            ? {
                ...group,
                people: group.people.map((person) =>
                  person.id === dragState.personId ? { ...person, x: nextPersonX, y: nextPersonY } : person,
                ),
              }
            : group,
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
    if (dragState?.pointerId !== event.pointerId) return

    if (dragState.type === 'person') {
      const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY)
      const worldPoint = getWorldPoint(event.clientX, event.clientY, camera, boardRef.current)
      const targetGroup = groups.find((group) => isPointInsideGroup(worldPoint, group))

      if (distance < 6) {
        setSelectedPersonId(dragState.personId)
      } else if (targetGroup && targetGroup.id !== dragState.groupId) {
        movePersonToGroup(dragState.personId, dragState.groupId, targetGroup.id, worldPoint)
      } else {
        clampPersonToGroup(dragState.personId, dragState.groupId)
      }
    }

    if (dragState.type !== 'person') {
      setSelectedPersonId(null)
    }

    if (dragState.pointerId === event.pointerId) {
      setDragState(null)
    }
  }

  function setZoom(scale: number) {
    setCamera((current) => ({ ...current, scale: clamp(scale, 0.38, 1.35) }))
  }

  function addPersonToSelectedGroup() {
    const personNumber = selectedGroup.people.length + 1
    const person: Person = {
      id: `person-${Date.now()}`,
      name: `New person ${personNumber}`,
      role: 'new contact',
      initials: createInitials(`New person ${personNumber}`),
      x: clamp(0.34 + (personNumber % 3) * 0.16, 0.16, 0.84),
      y: clamp(0.36 + (personNumber % 4) * 0.12, 0.22, 0.78),
    }
    setGroups((current) =>
      current.map((group) => {
        if (group.id !== selectedGroup.id) return group
        return { ...group, people: [...group.people, person] }
      }),
    )
    setSelectedPersonId(person.id)
  }

  function addCircleGroup() {
    const rect = boardRef.current?.getBoundingClientRect()
    const centerPoint = rect
      ? getWorldPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, camera, boardRef.current)
      : { x: 0, y: 0 }
    const groupNumber = groups.length + 1
    const nextGroup: CircleGroup = {
      id: `group-${Date.now()}`,
      name: `New circle ${groupNumber}`,
      tone: toneCycle[groups.length % toneCycle.length],
      x: centerPoint.x - 180,
      y: centerPoint.y - 140,
      width: 360,
      height: 280,
      people: [],
    }
    setGroups((current) => [...current, nextGroup])
    setSelectedGroupId(nextGroup.id)
    setSelectedPersonId(null)
  }

  function updateSelectedPerson(nextFields: Partial<Pick<Person, 'name' | 'role'>>) {
    if (!selectedPersonContext) return
    setGroups((current) =>
      current.map((group) =>
        group.id === selectedPersonContext.group.id
          ? {
              ...group,
              people: group.people.map((person) =>
                person.id === selectedPersonContext.person.id
                  ? {
                      ...person,
                      ...nextFields,
                      initials: nextFields.name ? createInitials(nextFields.name) : person.initials,
                    }
                  : person,
              ),
            }
          : group,
      ),
    )
  }

  function movePersonToGroup(personId: string, fromGroupId: string, toGroupId: string, worldPoint: { x: number; y: number }) {
    setGroups((current) => {
      const fromGroup = current.find((group) => group.id === fromGroupId)
      const person = fromGroup?.people.find((entry) => entry.id === personId)
      if (!person) return current

      return current.map((group) => {
        if (group.id === fromGroupId) {
          return { ...group, people: group.people.filter((entry) => entry.id !== personId) }
        }
        if (group.id === toGroupId) {
          return {
            ...group,
            people: [
              ...group.people,
              {
                ...person,
                x: clamp((worldPoint.x - group.x) / group.width, 0.12, 0.88),
                y: clamp((worldPoint.y - group.y) / group.height, 0.18, 0.82),
              },
            ],
          }
        }
        return group
      })
    })
    setSelectedGroupId(toGroupId)
    setSelectedPersonId(personId)
  }

  function clampPersonToGroup(personId: string, groupId: string) {
    setGroups((current) =>
      current.map((group) =>
        group.id === groupId
          ? {
              ...group,
              people: group.people.map((person) =>
                person.id === personId ? { ...person, x: clamp(person.x, 0.12, 0.88), y: clamp(person.y, 0.18, 0.82) } : person,
              ),
            }
          : group,
      ),
    )
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
        <div className="command-group" aria-label="Create controls">
          <button type="button" onClick={addPersonToSelectedGroup}>
            + Person
          </button>
          <button type="button" onClick={addCircleGroup}>
            + Circle
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
                  selectedPersonContext?.group.id === group.id ? 'has-selected-person' : '',
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
                        selectedPersonContext?.person.id === person.id ? 'is-selected' : '',
                        lowerQuery && `${person.name} ${person.role}`.toLowerCase().includes(lowerQuery) ? 'is-match' : '',
                      ].join(' ')}
                      style={{ left: `${person.x * 100}%`, top: `${person.y * 100}%` }}
                      onPointerDown={(event) => startPersonDrag(event, group, person)}
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

      <aside className="inspector-panel" aria-label="Selected details">
        {selectedPersonContext ? (
          <>
            <div>
              <p className="panel-kicker">Person card</p>
              <h1>{selectedPersonContext.person.name}</h1>
              <p>
                This card opens from a person click. Drag the person around the circle, or drop them into another
                circle to change context.
              </p>
            </div>
            <div className="person-editor">
              <label>
                Name
                <input
                  value={selectedPersonContext.person.name}
                  onChange={(event) => updateSelectedPerson({ name: event.target.value })}
                />
              </label>
              <label>
                Role
                <input
                  value={selectedPersonContext.person.role}
                  onChange={(event) => updateSelectedPerson({ role: event.target.value })}
                />
              </label>
            </div>
            <button className="panel-secondary-action" type="button" onClick={() => setSelectedPersonId(null)}>
              Back to {selectedPersonContext.group.name}
            </button>
          </>
        ) : (
          <>
            <div>
              <p className="panel-kicker">Selected circle</p>
              <h1>{selectedGroup.name}</h1>
              <p>
                Move the circle to reorganize the map. Resize it when a real-life context needs more space. People stay
                attached to their circle.
              </p>
            </div>
            <div className="panel-actions">
              <button type="button" onClick={addPersonToSelectedGroup}>
                + Add person
              </button>
              <button type="button" onClick={addCircleGroup}>
                + New circle
              </button>
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
                <button type="button" key={person.id} onClick={() => setSelectedPersonId(person.id)}>
                  <span>{person.initials}</span>
                  <strong>{person.name}</strong>
                  <small>{person.role}</small>
                </button>
              ))}
            </div>
          </>
        )}
      </aside>

      <div className="legend-strip" aria-label="Circle legend">
        {groups.map((group) => (
          <button
            type="button"
            key={group.id}
            className={`legend-chip legend-chip--${group.tone}${selectedGroupId === group.id ? ' is-active' : ''}`}
            onClick={() => {
              setSelectedGroupId(group.id)
              setSelectedPersonId(null)
            }}
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

function getPersonContext(groups: CircleGroup[], personId: string | null) {
  if (!personId) return null

  for (const group of groups) {
    const person = group.people.find((entry) => entry.id === personId)
    if (person) return { group, person }
  }

  return null
}

function getWorldPoint(clientX: number, clientY: number, camera: Camera, boardElement: HTMLElement | null) {
  const rect = boardElement?.getBoundingClientRect()
  return {
    x: (clientX - (rect?.left ?? 0) - camera.x) / camera.scale,
    y: (clientY - (rect?.top ?? 0) - camera.y) / camera.scale,
  }
}

function isPointInsideGroup(point: { x: number; y: number }, group: CircleGroup) {
  return point.x >= group.x && point.x <= group.x + group.width && point.y >= group.y && point.y <= group.y + group.height
}

function createInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'NP'
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
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
