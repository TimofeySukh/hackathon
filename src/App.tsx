import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'

import { useAuth } from './lib/useAuth'
import { supabase } from './lib/supabase'
import type { PersonNode, Tag } from './lib/graphTypes'

type Tone = 'coral' | 'blue' | 'violet' | 'green' | 'amber'

type BlobGroup = {
  id: string
  name: string
  tone: Tone
  x: number
  y: number
  minRadius: number
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

type Camera = {
  x: number
  y: number
  scale: number
}

type DragState =
  | { type: 'pan'; pointerId: number; startX: number; startY: number; originX: number; originY: number }
  | {
      type: 'group'
      pointerId: number
      groupId: string
      startX: number
      startY: number
      originX: number
      originY: number
      originPeople: Record<string, { x: number; y: number }>
    }
  | { type: 'person'; pointerId: number; personId: string; startX: number; startY: number; originX: number; originY: number }

const toneCycle: Tone[] = ['coral', 'blue', 'violet', 'green', 'amber']

const initialGroups: BlobGroup[] = [
  { id: 'family', name: 'Family', tone: 'coral', x: -620, y: -70, minRadius: 96, wobble: 0.28 },
  { id: 'school', name: 'School', tone: 'blue', x: -250, y: 155, minRadius: 86, wobble: 0.18 },
  { id: 'hackathon', name: 'Hackathon', tone: 'violet', x: -80, y: -130, minRadius: 112, wobble: 0.34 },
  { id: 'work', name: 'Work', tone: 'green', x: 350, y: 210, minRadius: 104, wobble: 0.24 },
  { id: 'copenhagen', name: 'Copenhagen', tone: 'amber', x: 210, y: -80, minRadius: 112, wobble: 0.2 },
]

const initialPeople: Person[] = [
  { id: 'maria', name: 'Maria', role: 'mom', initials: 'MA', x: -680, y: -88, memberships: ['family'] },
  { id: 'alex', name: 'Alex', role: 'brother', initials: 'AL', x: -565, y: -84, memberships: ['family'] },
  { id: 'nina', name: 'Nina', role: 'cousin', initials: 'NI', x: -612, y: 16, memberships: ['family'] },
  { id: 'emma', name: 'Emma', role: 'designer', initials: 'EM', x: -330, y: 190, memberships: ['school', 'copenhagen'] },
  { id: 'jonas', name: 'Jonas', role: 'math', initials: 'JO', x: -235, y: 135, memberships: ['school', 'copenhagen'] },
  { id: 'sara', name: 'Sara', role: 'events', initials: 'SA', x: -125, y: 185, memberships: ['school', 'copenhagen'] },
  { id: 'liam', name: 'Liam', role: 'frontend', initials: 'LI', x: -150, y: -120, memberships: ['hackathon'] },
  { id: 'maya', name: 'Maya', role: 'pitch', initials: 'MY', x: 90, y: -116, memberships: ['hackathon', 'copenhagen'] },
  { id: 'noah', name: 'Noah', role: 'backend', initials: 'NO', x: -182, y: -42, memberships: ['hackathon', 'work'] },
  { id: 'vera', name: 'Vera', role: 'mentor', initials: 'VE', x: 150, y: 26, memberships: ['hackathon', 'work', 'copenhagen'] },
  { id: 'oliver', name: 'Oliver', role: 'pm', initials: 'OL', x: 265, y: 185, memberships: ['work'] },
  { id: 'freja', name: 'Freja', role: 'data', initials: 'FR', x: 445, y: 145, memberships: ['work', 'copenhagen'] },
  { id: 'tobias', name: 'Tobias', role: 'ops', initials: 'TO', x: 365, y: 300, memberships: ['work'] },
  { id: 'ida', name: 'Ida', role: 'founder', initials: 'ID', x: 302, y: -112, memberships: ['copenhagen'] },
  { id: 'mikkel', name: 'Mikkel', role: 'coffee', initials: 'MI', x: 430, y: -88, memberships: ['copenhagen'] },
]

function App() {
  const { session, status: authStatus, error: authError, signInWithGoogle } = useAuth()
  const boardRef = useRef<HTMLDivElement | null>(null)
  const [groups, setGroups] = useState(initialGroups)
  const [people, setPeople] = useState(initialPeople)
  const [selectedGroupId, setSelectedGroupId] = useState('hackathon')
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>('maya')
  const [query, setQuery] = useState('')
  const [camera, setCamera] = useState<Camera>({ x: -165, y: -20, scale: 0.72 })
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [liveDataStatus, setLiveDataStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [liveDataMessage, setLiveDataMessage] = useState<string | null>(null)

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0]
  const selectedPerson = people.find((person) => person.id === selectedPersonId) ?? null
  const groupById = useMemo(() => Object.fromEntries(groups.map((group) => [group.id, group])), [groups])
  const lowerQuery = query.trim().toLowerCase()
  const isCollapsed = camera.scale < 0.52
  const absorbedGroupIds = useMemo(() => getAbsorbedGroupIds(groups, people), [groups, people])

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
    setDragState({
      type: 'group',
      pointerId: event.pointerId,
      groupId: group.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: group.x,
      originY: group.y,
      originPeople: Object.fromEntries(
        people
          .filter((person) => person.memberships.includes(group.id))
          .map((person) => [person.id, { x: person.x, y: person.y }]),
      ),
    })
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
      setPeople((current) =>
        current.map((person) =>
          dragState.originPeople[person.id]
            ? {
                ...person,
                x: dragState.originPeople[person.id].x + dx,
                y: dragState.originPeople[person.id].y + dy,
              }
            : person,
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
        const containingGroups = groups.filter((group) => isPointInsideBlob(draggedPerson, group, people)).map((group) => group.id)
        const nextMemberships = unique([...draggedPerson.memberships, ...containingGroups])
        const primaryGroupId = nextMemberships[0] ?? selectedGroupId

        setPeople((current) => current.map((person) => (person.id === draggedPerson.id ? { ...person, memberships: nextMemberships } : person)))
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
      x: selectedGroup.x + selectedGroup.minRadius * 0.36,
      y: selectedGroup.y,
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
      minRadius: 88,
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
          ? { ...person, x: group.x + group.minRadius * 0.32, y: group.y, memberships: unique([...person.memberships, groupId]) }
          : person,
      ),
    )
    setSelectedGroupId(groupId)
  }

  async function loadExistingBoardReadOnly() {
    if (!supabase) {
      setLiveDataStatus('error')
      setLiveDataMessage('Supabase is not configured for this environment.')
      return
    }

    if (!session?.user) {
      await signInWithGoogle()
      return
    }

    setLiveDataStatus('loading')
    setLiveDataMessage('Loading existing board without writing to the database.')

    try {
      const boardResult = await supabase
        .from('boards')
        .select('id,title')
        .eq('user_id', session.user.id)
        .limit(1)
        .maybeSingle()

      if (boardResult.error) throw boardResult.error
      if (!boardResult.data) {
        setLiveDataStatus('error')
        setLiveDataMessage('No existing board was found for this user.')
        return
      }

      const [peopleResult, tagsResult] = await Promise.all([
        supabase.from('people').select('*').eq('board_id', boardResult.data.id),
        supabase.from('tags').select('*').eq('user_id', session.user.id),
      ])

      if (peopleResult.error) throw peopleResult.error
      if (tagsResult.error) throw tagsResult.error

      const imported = mapExistingBoardToSlimePrototype(
        (peopleResult.data ?? []) as PersonNode[],
        (tagsResult.data ?? []) as Tag[],
      )
      setGroups(imported.groups)
      setPeople(imported.people)
      setSelectedGroupId(imported.groups[0]?.id ?? 'imported')
      setSelectedPersonId(imported.people[0]?.id ?? null)
      setCamera({ x: -80, y: -20, scale: 0.72 })
      setLiveDataStatus('ready')
      setLiveDataMessage(`Loaded ${imported.people.length} people from existing board. Edits here are local only.`)
    } catch (error) {
      setLiveDataStatus('error')
      setLiveDataMessage(error instanceof Error ? error.message : 'Unable to load existing board.')
    }
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
          <button type="button" onClick={() => void loadExistingBoardReadOnly()} disabled={liveDataStatus === 'loading'}>
            {authStatus === 'authenticated' ? 'Use live data' : 'Sign in'}
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
            <g className="blob-mix-layer">
              {groups.filter((group) => !absorbedGroupIds.has(group.id)).map((group) => (
                <path
                  key={group.id}
                  className={`blob-path blob-path--${group.tone}${selectedGroupId === group.id ? ' is-selected' : ''}`}
                  d={createBlobPath(group, people)}
                />
              ))}
              {groups.filter((group) => absorbedGroupIds.has(group.id)).map((group) => (
                <path
                  key={`${group.id}-inner`}
                  className={`blob-path blob-path--inner blob-path--${group.tone}${selectedGroupId === group.id ? ' is-selected' : ''}`}
                  d={createBlobPath(group, people)}
                />
              ))}
            </g>
            <g className="blob-outline-layer">
              {groups.filter((group) => !absorbedGroupIds.has(group.id)).map((group) => (
                <path key={group.id} className={`blob-outline blob-outline--${group.tone}`} d={createBlobPath(group, people)} />
              ))}
              {groups.filter((group) => absorbedGroupIds.has(group.id)).map((group) => (
                <path key={`${group.id}-inner-outline`} className={`blob-outline blob-outline--inner blob-outline--${group.tone}`} d={createBlobPath(group, people)} />
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
                  absorbedGroupIds.has(group.id) ? 'is-absorbed' : '',
                  matchesGroup ? '' : 'is-muted',
                  isCollapsed ? 'is-collapsed' : '',
                ].join(' ')}
                style={{ transform: `translate3d(${group.x}px, ${group.y}px, 0)` }}
              >
                <button className="blob-group__drag-layer" type="button" onPointerDown={(event) => startGroupDrag(event, group)}>
                  <span className="blob-group__title">{group.name}</span>
                  <span className="blob-group__count">{members.length} people</span>
                </button>
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
            <div className="live-data-panel">
              <button type="button" onClick={() => void loadExistingBoardReadOnly()} disabled={liveDataStatus === 'loading'}>
                {authStatus === 'authenticated' ? 'Use existing board data' : 'Sign in for existing data'}
              </button>
              {liveDataMessage || authError ? <p>{liveDataMessage ?? authError}</p> : null}
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

function createBlobPath(group: BlobGroup, people: Person[]) {
  const pointCount = getAdaptivePointCount(group, people)
  const points = Array.from({ length: pointCount }, (_, index) => {
    const angle = (Math.PI * 2 * index) / pointCount
    const radius = getSlimeRadius(group, people, angle)
    return {
      x: group.x + Math.cos(angle) * radius,
      y: group.y + Math.sin(angle) * radius,
    }
  })
  const first = midpoint(points[points.length - 1], points[0])
  const segments = [`M ${first.x} ${first.y}`]

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    const mid = midpoint(current, next)
    segments.push(`Q ${current.x} ${current.y} ${mid.x} ${mid.y}`)
  }

  segments.push('Z')
  return segments.join(' ')
}

function getAdaptivePointCount(group: BlobGroup, people: Person[]) {
  const members = people.filter((person) => person.memberships.includes(group.id))
  const maxDistance = members.reduce((largestDistance, person) => {
    return Math.max(largestDistance, Math.hypot(person.x - group.x, person.y - group.y))
  }, group.minRadius)

  return clamp(Math.round(maxDistance / 18) + members.length * 2 + 14, 20, 52)
}

function getSlimeRadius(group: BlobGroup, people: Person[], angle: number) {
  const directionX = Math.cos(angle)
  const directionY = Math.sin(angle)
  const normalX = -directionY
  const normalY = directionX
  const members = people.filter((person) => person.memberships.includes(group.id))
  const baseWave =
    1 +
    Math.sin(angle * 8 + group.wobble * 8) * 0.035 +
    Math.sin(angle * 13 + group.wobble * 13) * 0.018
  let radius = group.minRadius * baseWave

  for (const member of members) {
    const dx = member.x - group.x
    const dy = member.y - group.y
    const projection = dx * directionX + dy * directionY
    if (projection <= 0) continue

    const perpendicularDistance = Math.abs(dx * normalX + dy * normalY)
    const pull = Math.max(0, 1 - perpendicularDistance / 118)
    radius = Math.max(radius, projection + 50 * pull + 40)
  }

  const outsiders = people.filter((person) => !person.memberships.includes(group.id))
  for (const outsider of outsiders) {
    const dx = outsider.x - group.x
    const dy = outsider.y - group.y
    const projection = dx * directionX + dy * directionY
    if (projection <= group.minRadius * 0.55) continue

    const perpendicularDistance = Math.abs(dx * normalX + dy * normalY)
    const avoid = Math.max(0, 1 - perpendicularDistance / 126)
    if (avoid <= 0) continue

    const cap = projection - 64 - avoid * 46
    radius = Math.min(radius, Math.max(group.minRadius * 0.62, cap))
  }

  return radius
}

function isPointInsideBlob(point: { x: number; y: number }, group: BlobGroup, people: Person[]) {
  const dx = point.x - group.x
  const dy = point.y - group.y
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return true
  const angle = Math.atan2(dy, dx)
  return distance <= getSlimeRadius(group, people, angle) + 10
}

function midpoint(first: { x: number; y: number }, second: { x: number; y: number }) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  }
}

function getAbsorbedGroupIds(groups: BlobGroup[], people: Person[]) {
  const membersByGroup = new Map(
    groups.map((group) => [
      group.id,
      people.filter((person) => person.memberships.includes(group.id)).map((person) => person.id),
    ]),
  )
  const absorbedIds = new Set<string>()

  for (const group of groups) {
    const members = membersByGroup.get(group.id) ?? []
    if (members.length === 0) continue

    for (const candidateParent of groups) {
      if (candidateParent.id === group.id) continue
      const parentMembers = membersByGroup.get(candidateParent.id) ?? []
      if (parentMembers.length <= members.length) continue

      const parentMemberSet = new Set(parentMembers)
      if (members.every((personId) => parentMemberSet.has(personId))) {
        absorbedIds.add(group.id)
        break
      }
    }
  }

  return absorbedIds
}

function mapExistingBoardToSlimePrototype(sourcePeople: PersonNode[], sourceTags: Tag[]) {
  const visiblePeople = sourcePeople.filter((person) => !person.is_root)
  const fallbackGroupId = 'imported-untagged'
  const usedTagIds = new Set(visiblePeople.map((person) => person.tag_id).filter((tagId): tagId is string => Boolean(tagId)))
  const importedTags = sourceTags.filter((tag) => usedTagIds.has(tag.id))
  const groupsSource = importedTags.length > 0
    ? importedTags
    : [{ id: fallbackGroupId, name: 'People', color: '#4f7fcf' } as Pick<Tag, 'id' | 'name' | 'color'>]

  const normalizedPositions = normalizeImportedPositions(visiblePeople)
  const people: Person[] = visiblePeople.map((person, index) => {
    const position = normalizedPositions.get(person.id) ?? { x: index * 54, y: 0 }
    const membership = person.tag_id && usedTagIds.has(person.tag_id) ? person.tag_id : groupsSource[0].id

    return {
      id: person.id,
      name: person.name.trim() || 'Unnamed person',
      role: person.is_root ? 'root' : 'contact',
      initials: createInitials(person.name || 'Unnamed person'),
      x: position.x,
      y: position.y,
      memberships: [membership],
    }
  })

  const groups: BlobGroup[] = groupsSource.map((tag, index) => {
    const members = people.filter((person) => person.memberships.includes(tag.id))
    const centroid = getCentroid(members)
    return {
      id: tag.id,
      name: tag.name,
      tone: toneFromColor(tag.color, index),
      x: centroid.x,
      y: centroid.y,
      minRadius: 84 + Math.min(34, members.length * 4),
      wobble: 0.12 + (index % 4) * 0.06,
    }
  })

  return { groups, people }
}

function normalizeImportedPositions(sourcePeople: PersonNode[]) {
  const positions = new Map<string, { x: number; y: number }>()
  if (sourcePeople.length === 0) return positions

  const minX = Math.min(...sourcePeople.map((person) => person.x))
  const maxX = Math.max(...sourcePeople.map((person) => person.x))
  const minY = Math.min(...sourcePeople.map((person) => person.y))
  const maxY = Math.max(...sourcePeople.map((person) => person.y))
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const width = Math.max(1, maxX - minX)
  const height = Math.max(1, maxY - minY)
  const scale = Math.min(0.72, 860 / width, 560 / height)

  for (const person of sourcePeople) {
    positions.set(person.id, {
      x: (person.x - centerX) * scale,
      y: (person.y - centerY) * scale,
    })
  }

  return positions
}

function getCentroid(people: Person[]) {
  if (people.length === 0) return { x: 0, y: 0 }
  return {
    x: people.reduce((sum, person) => sum + person.x, 0) / people.length,
    y: people.reduce((sum, person) => sum + person.y, 0) / people.length,
  }
}

function toneFromColor(color: string | undefined, fallbackIndex: number): Tone {
  if (!color) return toneCycle[fallbackIndex % toneCycle.length]

  const normalized = color.replace('#', '')
  if (normalized.length !== 6) return toneCycle[fallbackIndex % toneCycle.length]

  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  if ([red, green, blue].some((value) => Number.isNaN(value))) return toneCycle[fallbackIndex % toneCycle.length]

  const candidates: Array<{ tone: Tone; rgb: [number, number, number] }> = [
    { tone: 'coral', rgb: [217, 109, 92] },
    { tone: 'blue', rgb: [79, 127, 207] },
    { tone: 'violet', rgb: [118, 87, 201] },
    { tone: 'green', rgb: [69, 143, 99] },
    { tone: 'amber', rgb: [185, 128, 45] },
  ]

  return candidates.reduce((best, candidate) => {
    const distance = Math.hypot(red - candidate.rgb[0], green - candidate.rgb[1], blue - candidate.rgb[2])
    return distance < best.distance ? { tone: candidate.tone, distance } : best
  }, { tone: toneCycle[fallbackIndex % toneCycle.length], distance: Number.POSITIVE_INFINITY }).tone
}

function getWorldPoint(clientX: number, clientY: number, camera: Camera, boardElement: HTMLElement | null) {
  const rect = boardElement?.getBoundingClientRect()
  return {
    x: (clientX - (rect?.left ?? 0) - camera.x) / camera.scale,
    y: (clientY - (rect?.top ?? 0) - camera.y) / camera.scale,
  }
}

function getToneStyle(tone?: Tone) {
  return tone ? ({ '--person-tone': `var(--tone-${tone})` } as CSSProperties) : undefined
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
