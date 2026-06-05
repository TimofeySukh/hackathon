import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'

type Tone = 'coral' | 'blue' | 'violet' | 'green' | 'amber'

type BlobGroup = {
  id: string
  name: string
  tone: Tone
  x: number
  y: number
  rx: number
  ry: number
  wobble: number
}

type Person = {
  id: string
  name: string
  role: string
  initials: string
  x: number
  y: number
  memberships: string[]
}

type Relationship = {
  from: string
  to: string
  label: string
  strength: number
}

type Camera = {
  x: number
  y: number
  scale: number
}

type DragState =
  | { type: 'pan'; pointerId: number; startX: number; startY: number; originX: number; originY: number }
  | { type: 'group'; pointerId: number; groupId: string; startX: number; startY: number; originX: number; originY: number }
  | { type: 'resize'; pointerId: number; groupId: string; startX: number; startY: number; originRx: number; originRy: number }
  | { type: 'person'; pointerId: number; personId: string; startX: number; startY: number; originX: number; originY: number }

const toneCycle: Tone[] = ['coral', 'blue', 'violet', 'green', 'amber']

const initialGroups: BlobGroup[] = [
  { id: 'family', name: 'Family', tone: 'coral', x: -620, y: -70, rx: 205, ry: 165, wobble: 0.28 },
  { id: 'school', name: 'School', tone: 'blue', x: -250, y: 260, rx: 235, ry: 170, wobble: 0.18 },
  { id: 'hackathon', name: 'Hackathon', tone: 'violet', x: -80, y: -130, rx: 270, ry: 185, wobble: 0.34 },
  { id: 'work', name: 'Work', tone: 'green', x: 350, y: 210, rx: 240, ry: 185, wobble: 0.24 },
  { id: 'copenhagen', name: 'Copenhagen', tone: 'amber', x: 360, y: -115, rx: 225, ry: 160, wobble: 0.2 },
]

const initialPeople: Person[] = [
  { id: 'maria', name: 'Maria', role: 'mom', initials: 'MA', x: -680, y: -88, memberships: ['family'] },
  { id: 'alex', name: 'Alex', role: 'brother', initials: 'AL', x: -565, y: -84, memberships: ['family'] },
  { id: 'nina', name: 'Nina', role: 'cousin', initials: 'NI', x: -612, y: 16, memberships: ['family'] },
  { id: 'emma', name: 'Emma', role: 'designer', initials: 'EM', x: -330, y: 285, memberships: ['school', 'hackathon'] },
  { id: 'jonas', name: 'Jonas', role: 'math', initials: 'JO', x: -235, y: 240, memberships: ['school'] },
  { id: 'sara', name: 'Sara', role: 'events', initials: 'SA', x: -125, y: 290, memberships: ['school', 'copenhagen'] },
  { id: 'liam', name: 'Liam', role: 'frontend', initials: 'LI', x: -150, y: -120, memberships: ['hackathon'] },
  { id: 'maya', name: 'Maya', role: 'pitch', initials: 'MY', x: 90, y: -116, memberships: ['hackathon', 'copenhagen'] },
  { id: 'noah', name: 'Noah', role: 'backend', initials: 'NO', x: -5, y: -42, memberships: ['hackathon', 'work'] },
  { id: 'vera', name: 'Vera', role: 'mentor', initials: 'VE', x: 150, y: 26, memberships: ['hackathon', 'work', 'copenhagen'] },
  { id: 'oliver', name: 'Oliver', role: 'pm', initials: 'OL', x: 265, y: 185, memberships: ['work'] },
  { id: 'freja', name: 'Freja', role: 'data', initials: 'FR', x: 445, y: 145, memberships: ['work', 'copenhagen'] },
  { id: 'tobias', name: 'Tobias', role: 'ops', initials: 'TO', x: 365, y: 300, memberships: ['work'] },
  { id: 'ida', name: 'Ida', role: 'founder', initials: 'ID', x: 302, y: -112, memberships: ['copenhagen'] },
  { id: 'mikkel', name: 'Mikkel', role: 'coffee', initials: 'MI', x: 430, y: -88, memberships: ['copenhagen'] },
]

const initialRelationships: Relationship[] = [
  { from: 'maya', to: 'vera', label: 'pitch mentor', strength: 0.9 },
  { from: 'noah', to: 'oliver', label: 'built together', strength: 0.7 },
  { from: 'emma', to: 'sara', label: 'events', strength: 0.55 },
  { from: 'freja', to: 'ida', label: 'data intro', strength: 0.65 },
  { from: 'vera', to: 'freja', label: 'knows well', strength: 0.62 },
]

function App() {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const [groups, setGroups] = useState(initialGroups)
  const [people, setPeople] = useState(initialPeople)
  const [relationships] = useState(initialRelationships)
  const [selectedGroupId, setSelectedGroupId] = useState('hackathon')
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>('maya')
  const [query, setQuery] = useState('')
  const [camera, setCamera] = useState<Camera>({ x: -165, y: -20, scale: 0.72 })
  const [dragState, setDragState] = useState<DragState | null>(null)

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0]
  const selectedPerson = people.find((person) => person.id === selectedPersonId) ?? null
  const groupById = useMemo(() => Object.fromEntries(groups.map((group) => [group.id, group])), [groups])
  const personById = useMemo(() => Object.fromEntries(people.map((person) => [person.id, person])), [people])
  const lowerQuery = query.trim().toLowerCase()
  const isCollapsed = camera.scale < 0.52

  const sharedMemberships = useMemo(
    () => people.filter((person) => person.memberships.length > 1),
    [people],
  )

  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    const boardElement = board

    function handleNativeWheel(event: WheelEvent) {
      event.preventDefault()
      const rect = boardElement.getBoundingClientRect()
      const nextScale = clamp(camera.scale - event.deltaY * 0.0012, 0.36, 1.38)
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
    setDragState({ type: 'pan', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: camera.x, originY: camera.y })
  }

  function startGroupDrag(event: PointerEvent<HTMLButtonElement>, group: BlobGroup) {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedGroupId(group.id)
    setSelectedPersonId(null)
    setDragState({ type: 'group', pointerId: event.pointerId, groupId: group.id, startX: event.clientX, startY: event.clientY, originX: group.x, originY: group.y })
  }

  function startResize(event: PointerEvent<HTMLButtonElement>, group: BlobGroup) {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedGroupId(group.id)
    setSelectedPersonId(null)
    setDragState({ type: 'resize', pointerId: event.pointerId, groupId: group.id, startX: event.clientX, startY: event.clientY, originRx: group.rx, originRy: group.ry })
  }

  function startPersonDrag(event: PointerEvent<HTMLButtonElement>, person: Person) {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedPersonId(person.id)
    setDragState({ type: 'person', pointerId: event.pointerId, personId: person.id, startX: event.clientX, startY: event.clientY, originX: person.x, originY: person.y })
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragState || event.pointerId !== dragState.pointerId) return

    if (dragState.type === 'pan') {
      setCamera((current) => ({ ...current, x: dragState.originX + event.clientX - dragState.startX, y: dragState.originY + event.clientY - dragState.startY }))
      return
    }

    if (dragState.type === 'group') {
      const dx = (event.clientX - dragState.startX) / camera.scale
      const dy = (event.clientY - dragState.startY) / camera.scale
      setGroups((current) => current.map((group) => (group.id === dragState.groupId ? { ...group, x: dragState.originX + dx, y: dragState.originY + dy } : group)))
      return
    }

    if (dragState.type === 'resize') {
      const dx = (event.clientX - dragState.startX) / camera.scale
      const dy = (event.clientY - dragState.startY) / camera.scale
      setGroups((current) =>
        current.map((group) =>
          group.id === dragState.groupId
            ? { ...group, rx: Math.max(135, dragState.originRx + dx), ry: Math.max(120, dragState.originRy + dy) }
            : group,
        ),
      )
      return
    }

    const dx = (event.clientX - dragState.startX) / camera.scale
    const dy = (event.clientY - dragState.startY) / camera.scale
    setPeople((current) => current.map((person) => (person.id === dragState.personId ? { ...person, x: dragState.originX + dx, y: dragState.originY + dy } : person)))
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (!dragState || dragState.pointerId !== event.pointerId) return

    if (dragState.type === 'person') {
      const draggedPerson = people.find((person) => person.id === dragState.personId)
      if (draggedPerson) {
        const containingGroups = groups.filter((group) => isPointInsideBlob(draggedPerson, group)).map((group) => group.id)
        const nextMemberships = containingGroups.length > 0 ? containingGroups : draggedPerson.memberships
        const primaryGroupId = nextMemberships[0] ?? selectedGroupId

        setPeople((current) => current.map((person) => (person.id === draggedPerson.id ? { ...person, memberships: nextMemberships } : person)))

        if (containingGroups.length === 0) {
          setGroups((current) => current.map((group) => (group.id === primaryGroupId ? expandBlobToInclude(group, draggedPerson) : group)))
        }
        setSelectedGroupId(primaryGroupId)
      }
    }

    setDragState(null)
  }

  function addPersonToSelectedGroup() {
    const personNumber = people.length + 1
    const person: Person = {
      id: `person-${Date.now()}`,
      name: `New person ${personNumber}`,
      role: 'new contact',
      initials: createInitials(`New person ${personNumber}`),
      x: selectedGroup.x + selectedGroup.rx * 0.12,
      y: selectedGroup.y + selectedGroup.ry * 0.08,
      memberships: [selectedGroup.id],
    }
    setPeople((current) => [...current, person])
    setSelectedPersonId(person.id)
  }

  function addCircleGroup() {
    const rect = boardRef.current?.getBoundingClientRect()
    const centerPoint = rect ? getWorldPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, camera, boardRef.current) : { x: 0, y: 0 }
    const groupNumber = groups.length + 1
    const group: BlobGroup = {
      id: `group-${Date.now()}`,
      name: `New circle ${groupNumber}`,
      tone: toneCycle[groups.length % toneCycle.length],
      x: centerPoint.x,
      y: centerPoint.y,
      rx: 190,
      ry: 145,
      wobble: 0.12 + (groups.length % 4) * 0.08,
    }
    setGroups((current) => [...current, group])
    setSelectedGroupId(group.id)
    setSelectedPersonId(null)
  }

  function updateSelectedPerson(nextFields: Partial<Pick<Person, 'name' | 'role'>>) {
    if (!selectedPerson) return
    setPeople((current) =>
      current.map((person) =>
        person.id === selectedPerson.id
          ? { ...person, ...nextFields, initials: nextFields.name ? createInitials(nextFields.name) : person.initials }
          : person,
      ),
    )
  }

  function togglePersonMembership(groupId: string) {
    if (!selectedPerson) return
    setPeople((current) =>
      current.map((person) => {
        if (person.id !== selectedPerson.id) return person
        const hasMembership = person.memberships.includes(groupId)
        const nextMemberships = hasMembership
          ? person.memberships.filter((id) => id !== groupId)
          : [...person.memberships, groupId]
        return { ...person, memberships: nextMemberships.length > 0 ? nextMemberships : [groupId] }
      }),
    )
    setSelectedGroupId(groupId)
  }

  function updateSelectedGroup(nextFields: Partial<Pick<BlobGroup, 'name' | 'tone'>>) {
    setGroups((current) => current.map((group) => (group.id === selectedGroup.id ? { ...group, ...nextFields } : group)))
  }

  function placeSelectedPersonInGroup(groupId: string) {
    if (!selectedPerson) return
    const group = groupById[groupId]
    if (!group) return
    setPeople((current) =>
      current.map((person) =>
        person.id === selectedPerson.id
          ? { ...person, x: group.x + group.rx * 0.08, y: group.y, memberships: unique([...person.memberships, groupId]) }
          : person,
      ),
    )
    setSelectedGroupId(groupId)
  }

  const visibleRelationships = relationships.filter((relationship) => {
    if (!selectedPerson) return true
    return relationship.from === selectedPerson.id || relationship.to === selectedPerson.id
  })
  const selectedPersonRelationships = selectedPerson
    ? relationships.filter((relationship) => relationship.from === selectedPerson.id || relationship.to === selectedPerson.id)
    : []

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
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people or circles" aria-label="Search people or circles" />
        </label>
        <div className="toolbar-group" aria-label="Zoom controls">
          <button type="button" onClick={() => setCamera((current) => ({ ...current, scale: clamp(current.scale - 0.12, 0.36, 1.38) }))} aria-label="Zoom out">
            -
          </button>
          <span>{Math.round(camera.scale * 100)}%</span>
          <button type="button" onClick={() => setCamera((current) => ({ ...current, scale: clamp(current.scale + 0.12, 0.36, 1.38) }))} aria-label="Zoom in">
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
        <div className="board-plane" style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})` }}>
          <svg className="blob-svg" viewBox="-2200 -2200 4400 4400" aria-hidden="true">
            <defs>
              <filter id="soft-ribbon" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="7" />
              </filter>
            </defs>
            <g className="relationship-ribbons">
              {visibleRelationships.map((relationship) => {
                const from = personById[relationship.from]
                const to = personById[relationship.to]
                if (!from || !to) return null
                const path = getSoftRelationshipPath(from, to, relationship.strength)
                return <path key={`${relationship.from}-${relationship.to}`} d={path} />
              })}
            </g>
            <g className="blob-mix-layer">
              {groups.map((group) => (
                <path
                  key={group.id}
                  className={`blob-path blob-path--${group.tone}${selectedGroupId === group.id ? ' is-selected' : ''}`}
                  d={createBlobPath(group)}
                />
              ))}
            </g>
            <g className="blob-outline-layer">
              {groups.map((group) => (
                <path key={group.id} className={`blob-outline blob-outline--${group.tone}`} d={createBlobPath(group)} />
              ))}
            </g>
          </svg>

          {groups.map((group) => {
            const members = people.filter((person) => person.memberships.includes(group.id))
            const matchesGroup = lowerQuery.length === 0 || group.name.toLowerCase().includes(lowerQuery) || members.some((person) => `${person.name} ${person.role}`.toLowerCase().includes(lowerQuery))
            return (
              <article
                key={group.id}
                className={[
                  'blob-group',
                  `blob-group--${group.tone}`,
                  selectedGroupId === group.id ? 'is-selected' : '',
                  matchesGroup ? '' : 'is-muted',
                  isCollapsed ? 'is-collapsed' : '',
                ].join(' ')}
                style={{ transform: `translate3d(${group.x}px, ${group.y}px, 0)` }}
              >
                <button className="blob-group__drag-layer" type="button" onPointerDown={(event) => startGroupDrag(event, group)}>
                  <span className="blob-group__title">{group.name}</span>
                  <span className="blob-group__count">{members.length} people</span>
                </button>
                <button className="resize-handle" type="button" style={{ transform: `translate(${group.rx * 0.77}px, ${group.ry * 0.72}px)` }} onPointerDown={(event) => startResize(event, group)} aria-label={`Resize ${group.name}`} />
              </article>
            )
          })}

          {people.map((person) => {
            const matchesPerson = lowerQuery.length === 0 || `${person.name} ${person.role}`.toLowerCase().includes(lowerQuery)
            const primaryGroup = groupById[person.memberships[0]]
            return (
              <button
                key={person.id}
                type="button"
                className={['person-node', selectedPerson?.id === person.id ? 'is-selected' : '', matchesPerson ? '' : 'is-muted'].join(' ')}
                style={{ transform: `translate3d(${person.x}px, ${person.y}px, 0)` }}
                onPointerDown={(event) => startPersonDrag(event, person)}
              >
                <span className="person-node__avatar" style={getToneStyle(primaryGroup?.tone)}>{person.initials}</span>
                <span className="person-node__copy">
                  <strong>{person.name}</strong>
                  <small>{person.role}</small>
                </span>
                <span className="person-node__chips">
                  {person.memberships.slice(0, 3).map((groupId) => {
                    const group = groupById[groupId]
                    return group ? <i key={group.id} className={`membership-dot membership-dot--${group.tone}`} /> : null
                  })}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <aside className="inspector-panel" aria-label="Selected details">
        {selectedPerson ? (
          <>
            <div>
              <p className="panel-kicker">Person card</p>
              <h1>{selectedPerson.name}</h1>
              <p>Memberships define where this person belongs. Drag into an overlap to auto-attach multiple circles, or toggle circles manually.</p>
            </div>
            <div className="person-editor">
              <label>
                Name
                <input value={selectedPerson.name} onChange={(event) => updateSelectedPerson({ name: event.target.value })} />
              </label>
              <label>
                Role
                <input value={selectedPerson.role} onChange={(event) => updateSelectedPerson({ role: event.target.value })} />
              </label>
            </div>
            <div className="membership-editor" aria-label="Person memberships">
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className={`membership-toggle membership-toggle--${group.tone}${selectedPerson.memberships.includes(group.id) ? ' is-active' : ''}`}
                  onClick={() => togglePersonMembership(group.id)}
                >
                  {group.name}
                </button>
              ))}
            </div>
            <div className="place-actions">
              {groups.map((group) => (
                <button key={group.id} type="button" onClick={() => placeSelectedPersonInGroup(group.id)}>
                  Place in {group.name}
                </button>
              ))}
            </div>
            {selectedPersonRelationships.length > 0 ? (
              <div className="relationship-list" aria-label="Soft relationships">
                <p className="panel-kicker">Soft relationships</p>
                {selectedPersonRelationships.map((relationship) => {
                  const otherPersonId = relationship.from === selectedPerson.id ? relationship.to : relationship.from
                  const otherPerson = personById[otherPersonId]
                  if (!otherPerson) return null
                  return (
                    <button key={`${relationship.from}-${relationship.to}`} type="button" onClick={() => setSelectedPersonId(otherPerson.id)}>
                      <span>{relationship.label}</span>
                      <strong>{otherPerson.name}</strong>
                    </button>
                  )
                })}
              </div>
            ) : null}
            <button className="panel-secondary-action" type="button" onClick={() => setSelectedPersonId(null)}>
              Back to circle
            </button>
          </>
        ) : (
          <>
            <div>
              <p className="panel-kicker">Selected circle</p>
              <h1>{selectedGroup.name}</h1>
              <p>Move circles until their blobs overlap. People in the overlap belong to every containing circle, and dragged-out people deform their primary blob.</p>
            </div>
            <div className="person-editor">
              <label>
                Circle name
                <input value={selectedGroup.name} onChange={(event) => updateSelectedGroup({ name: event.target.value })} />
              </label>
            </div>
            <div className="tone-picker" aria-label="Circle color">
              {toneCycle.map((tone) => (
                <button key={tone} type="button" className={`tone-swatch tone-swatch--${tone}${selectedGroup.tone === tone ? ' is-active' : ''}`} onClick={() => updateSelectedGroup({ tone })} aria-label={`Set color ${tone}`} />
              ))}
            </div>
            <div className="panel-actions">
              <button type="button" onClick={addPersonToSelectedGroup}>+ Add person</button>
              <button type="button" onClick={addCircleGroup}>+ New circle</button>
            </div>
            <div className="panel-stats">
              <span><strong>{people.filter((person) => person.memberships.includes(selectedGroup.id)).length}</strong>People</span>
              <span><strong>{sharedMemberships.length}</strong>Shared</span>
            </div>
            <div className="people-list">
              {people.filter((person) => person.memberships.includes(selectedGroup.id)).map((person) => (
                <button type="button" key={person.id} onClick={() => setSelectedPersonId(person.id)}>
                  <span>{person.initials}</span>
                  <strong>{person.name}</strong>
                  <small>{person.memberships.map((groupId) => groupById[groupId]?.name).filter(Boolean).join(' + ')}</small>
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

function createBlobPath(group: BlobGroup) {
  const { x, y, rx, ry, wobble } = group
  const top = ry * (1 + wobble * 0.12)
  const right = rx * (1 - wobble * 0.08)
  const bottom = ry * (1 - wobble * 0.1)
  const left = rx * (1 + wobble * 0.1)
  const c = 0.56

  return [
    `M ${x} ${y - top}`,
    `C ${x + right * c} ${y - top * (1 + wobble * 0.18)}, ${x + right * (1 + wobble * 0.12)} ${y - right * 0.3}, ${x + right} ${y}`,
    `C ${x + right * (1 - wobble * 0.12)} ${y + bottom * c}, ${x + rx * 0.32} ${y + bottom * (1 + wobble * 0.16)}, ${x} ${y + bottom}`,
    `C ${x - left * c} ${y + bottom * (1 - wobble * 0.12)}, ${x - left * (1 + wobble * 0.18)} ${y + ry * 0.24}, ${x - left} ${y}`,
    `C ${x - left * (1 - wobble * 0.08)} ${y - top * c}, ${x - rx * 0.34} ${y - top * (1 + wobble * 0.12)}, ${x} ${y - top}`,
    'Z',
  ].join(' ')
}

function isPointInsideBlob(point: { x: number; y: number }, group: BlobGroup) {
  const dx = (point.x - group.x) / (group.rx * (1 + group.wobble * 0.14))
  const dy = (point.y - group.y) / (group.ry * (1 + group.wobble * 0.12))
  return dx * dx + dy * dy <= 1
}

function expandBlobToInclude(group: BlobGroup, point: { x: number; y: number }) {
  const dx = Math.abs(point.x - group.x)
  const dy = Math.abs(point.y - group.y)
  return {
    ...group,
    rx: Math.max(group.rx, dx + 86),
    ry: Math.max(group.ry, dy + 70),
    wobble: clamp(group.wobble + 0.05, 0.12, 0.42),
  }
}

function getSoftRelationshipPath(from: Person, to: Person, strength: number) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lift = Math.max(70, Math.hypot(dx, dy) * 0.18) * (strength > 0.7 ? 1 : -1)
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2
  return `M ${from.x} ${from.y} Q ${midX - dy * 0.08} ${midY + lift + dx * 0.05} ${to.x} ${to.y}`
}

function getWorldPoint(clientX: number, clientY: number, camera: Camera, boardElement: HTMLElement | null) {
  const rect = boardElement?.getBoundingClientRect()
  return {
    x: (clientX - (rect?.left ?? 0) - camera.x) / camera.scale,
    y: (clientY - (rect?.top ?? 0) - camera.y) / camera.scale,
  }
}

function getToneStyle(tone?: Tone) {
  return tone ? ({ '--person-tone': `var(--tone-${tone})` } as React.CSSProperties) : undefined
}

function createInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'NP'
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items))
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
