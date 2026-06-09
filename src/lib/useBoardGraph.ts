import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'

import type { BoardGraphPayload, Circle, Connection, PersonAiNote, PersonNode, PersonNote, Tag } from './graphTypes'
import {
  createConnection,
  createNote,
  createPerson,
  createTag,
  deleteConnection,
  deleteNote,
  deletePerson,
  deleteTag,
  getPersonAiNote,
  invokePersonAiNoteSync,
  loadBoardGraph,
  movePerson,
  upsertPersonAiNoteStatus,
  updateNote,
  updatePerson,
  updateTag,
  createCircle,
  updateCircle,
  moveCircle,
  deleteCircle,
} from './graphStorage'

export type CircleTone = 'blue' | 'red' | 'green' | 'amber' | 'violet'
export type ShapeType = 'circle' | 'wavy' | 'polygon'

export type CircleNodeUi = {
  id: string
  name: string
  icon: string
  x: number
  y: number
  radius: number
  minRadius: number
  parentId: string | null
  connectedTo: string | null
  tone: CircleTone
  shapeType: ShapeType
  sides: number
  amplitude: number
  imageUrl?: string
  isRoot?: boolean
}

export type PersonNodeUi = {
  id: string
  name: string
  role: string
  x: number
  y: number
  circleId: string
  avatar: string
  shapeType?: ShapeType
  sides?: number
  amplitude?: number
  imageUrl?: string
  isRoot?: boolean
}

export function mapDbCircleToUi(circle: Circle): CircleNodeUi {
  return {
    id: circle.id,
    name: circle.name,
    icon: circle.icon,
    x: circle.x,
    y: circle.y,
    radius: circle.radius,
    minRadius: circle.min_radius,
    parentId: circle.parent_id,
    connectedTo: circle.connected_to,
    tone: circle.tone as CircleTone,
    shapeType: circle.shape_type as ShapeType,
    sides: circle.sides,
    amplitude: circle.amplitude,
    imageUrl: circle.image_url ?? undefined,
    isRoot: circle.is_root,
  }
}

export function mapDbPersonToUi(person: PersonNode): PersonNodeUi {
  return {
    id: person.id,
    name: person.name,
    role: person.role,
    x: person.x,
    y: person.y,
    circleId: person.circle_id ?? '',
    avatar: person.avatar,
    shapeType: (person.shape_type as ShapeType) ?? undefined,
    sides: person.sides ?? undefined,
    amplitude: person.amplitude ?? undefined,
    imageUrl: person.image_url ?? undefined,
    isRoot: person.is_root,
  }
}

type GraphStatus = 'idle' | 'loading' | 'ready'

type GraphState = {
  board: BoardGraphPayload['board'] | null
  circles: Circle[]
  people: PersonNode[]
  tags: Tag[]
  notes: PersonNote[]
  personAiNotes: PersonAiNote[]
  connections: Connection[]
  status: GraphStatus
  error: string | null
}

const EMPTY_GRAPH_STATE: GraphState = {
  board: null,
  circles: [],
  people: [],
  tags: [],
  notes: [],
  personAiNotes: [],
  connections: [],
  status: 'idle',
  error: null,
}

const PERSON_AI_SYNC_DEBOUNCE_MS = 3000

export function useBoardGraph(user: User | null) {
  const [graphState, setGraphState] = useState<GraphState>(() => ({
    ...EMPTY_GRAPH_STATE,
    status: user ? 'loading' : 'idle',
  }))
  const personAiSyncTimersRef = useRef(new Map<string, number>())
  const personAiSyncInFlightRef = useRef(new Set<string>())
  const personAiSyncQueuedRef = useRef(new Set<string>())

  const clearScheduledPersonAiSync = useCallback((personId?: string) => {
    if (personId) {
      const timerId = personAiSyncTimersRef.current.get(personId)
      if (timerId !== undefined) {
        window.clearTimeout(timerId)
        personAiSyncTimersRef.current.delete(personId)
      }
      return
    }

    for (const timerId of personAiSyncTimersRef.current.values()) {
      window.clearTimeout(timerId)
    }
    personAiSyncTimersRef.current.clear()
  }, [])

  useEffect(() => {
    const personAiSyncInFlight = personAiSyncInFlightRef.current
    const personAiSyncQueued = personAiSyncQueuedRef.current

    if (!user) {
      clearScheduledPersonAiSync()
      personAiSyncInFlight.clear()
      personAiSyncQueued.clear()
      return
    }

    let isMounted = true
    Promise.resolve().then(() => {
      if (!isMounted) return

      setGraphState((currentState) => ({
        ...currentState,
        status: 'loading',
        error: null,
      }))
    })

    loadBoardGraph(user)
      .then((payload) => {
        if (!isMounted) return

        setGraphState({
          board: payload.board,
          circles: payload.circles,
          people: payload.people,
          tags: payload.tags,
          notes: payload.notes,
          personAiNotes: payload.personAiNotes,
          connections: payload.connections,
          status: 'ready',
          error: null,
        })
      })
      .catch((error: unknown) => {
        if (!isMounted) return

        let errMsg = 'Unable to load board data.'
        if (error instanceof Error) {
          errMsg = error.message
        } else if (error && typeof error === 'object' && 'message' in error) {
          const candidate = error as { message: unknown }
          if (typeof candidate.message === 'string') {
            errMsg = candidate.message
          }
        }

        setGraphState({
          ...EMPTY_GRAPH_STATE,
          status: 'idle',
          error: errMsg,
        })
      })

    return () => {
      isMounted = false
      clearScheduledPersonAiSync()
      personAiSyncInFlight.clear()
      personAiSyncQueued.clear()
    }
  }, [clearScheduledPersonAiSync, user])

  const visibleState = user ? graphState : EMPTY_GRAPH_STATE
  const graphStateRef = useRef(graphState)
  useEffect(() => {
    graphStateRef.current = graphState
  }, [graphState])

  const movePersonTimersRef = useRef(new Map<string, number>())
  const moveCircleTimersRef = useRef(new Map<string, number>())

  useEffect(() => {
    const movePersonTimers = movePersonTimersRef.current
    const moveCircleTimers = moveCircleTimersRef.current
    return () => {
      for (const timerId of movePersonTimers.values()) {
        window.clearTimeout(timerId)
      }
      for (const timerId of moveCircleTimers.values()) {
        window.clearTimeout(timerId)
      }
    }
  }, [])

  const ensureUserAndBoard = () => {
    if (!user || !graphState.board) {
      throw new Error('Board data is not available.')
    }

    return {
      userId: user.id,
      boardId: graphState.board.id,
    }
  }

  const applyPerson = (person: PersonNode) => {
    setGraphState((currentState) => ({
      ...currentState,
      people: currentState.people.some((entry) => entry.id === person.id)
        ? currentState.people.map((entry) => (entry.id === person.id ? person : entry))
        : [...currentState.people, person],
      error: null,
    }))
  }

  const applyNote = (note: PersonNote) => {
    setGraphState((currentState) => ({
      ...currentState,
      notes: currentState.notes.some((entry) => entry.id === note.id)
        ? currentState.notes.map((entry) => (entry.id === note.id ? note : entry))
        : [...currentState.notes, note],
      error: null,
    }))
  }

  const applyPersonAiNote = (personAiNote: PersonAiNote) => {
    setGraphState((currentState) => ({
      ...currentState,
      personAiNotes: currentState.personAiNotes.some((entry) => entry.id === personAiNote.id)
        ? currentState.personAiNotes.map((entry) => (entry.id === personAiNote.id ? personAiNote : entry))
        : [...currentState.personAiNotes, personAiNote],
      error: null,
    }))
  }

  const applyConnection = (connection: Connection) => {
    setGraphState((currentState) => ({
      ...currentState,
      connections: currentState.connections.some((entry) => entry.id === connection.id)
        ? currentState.connections
        : [...currentState.connections, connection],
      error: null,
    }))
  }

  const setError = (error: unknown) => {
    setGraphState((currentState) => ({
      ...currentState,
      error: error instanceof Error ? error.message : 'Board update failed.',
    }))
  }

  const syncPersonAiNote = async (personId: string) => {
    if (personAiSyncInFlightRef.current.has(personId)) {
      personAiSyncQueuedRef.current.add(personId)
      return
    }

    personAiSyncInFlightRef.current.add(personId)

    try {
      const { userId } = ensureUserAndBoard()
      const pendingAiNote = await upsertPersonAiNoteStatus({
        personId,
        ownerUserId: userId,
        status: 'pending',
      })
      applyPersonAiNote(pendingAiNote)

      try {
        await invokePersonAiNoteSync(personId)
        const refreshedAiNote = await getPersonAiNote(personId)

        if (refreshedAiNote) {
          applyPersonAiNote(refreshedAiNote)
        }
      } catch (error) {
        const existingAiNote = await getPersonAiNote(personId).catch(() => null)

        if (existingAiNote?.status === 'error') {
          applyPersonAiNote(existingAiNote)
          return
        }

        const fallbackErrorAiNote = await upsertPersonAiNoteStatus({
          personId,
          ownerUserId: userId,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unable to refresh AI note.',
        }).catch(() => null)

        if (fallbackErrorAiNote) {
          applyPersonAiNote(fallbackErrorAiNote)
        }
      }
    } finally {
      personAiSyncInFlightRef.current.delete(personId)
      if (personAiSyncQueuedRef.current.has(personId)) {
        personAiSyncQueuedRef.current.delete(personId)
        schedulePersonAiSync(personId)
      }
    }
  }

  const schedulePersonAiSync = (personId: string) => {
    clearScheduledPersonAiSync(personId)
    const timerId = window.setTimeout(() => {
      personAiSyncTimersRef.current.delete(personId)
      void syncPersonAiNote(personId)
    }, PERSON_AI_SYNC_DEBOUNCE_MS)

    personAiSyncTimersRef.current.set(personId, timerId)
  }

  const uiCircles = useMemo(() => visibleState.circles.map(mapDbCircleToUi), [visibleState.circles])
  const uiPeople = useMemo(() => visibleState.people.map(mapDbPersonToUi), [visibleState.people])

  return {
    board: visibleState.board,
    status: visibleState.status,
    error: visibleState.error,
    tags: visibleState.tags,
    notes: visibleState.notes,
    personAiNotes: visibleState.personAiNotes,
    connections: visibleState.connections,
    circles: uiCircles,
    people: uiPeople,

    async createTag(name: string) {
      try {
        const { userId } = ensureUserAndBoard()
        const tag = await createTag(userId, name)
        setGraphState((currentState) => ({
          ...currentState,
          tags: [...currentState.tags, tag],
          error: null,
        }))
        return tag
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async updateTag(input: Parameters<typeof updateTag>[0]) {
      try {
        const tag = await updateTag(input)
        setGraphState((currentState) => ({
          ...currentState,
          tags: currentState.tags.map((entry) => (entry.id === tag.id ? tag : entry)),
          error: null,
        }))
        return tag
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async deleteTag(id: string) {
      try {
        await deleteTag(id)
        setGraphState((currentState) => ({
          ...currentState,
          tags: currentState.tags.filter((tag) => tag.id !== id),
          people: currentState.people.map((person) =>
            person.tag_id === id ? { ...person, tag_id: null } : person,
          ),
          error: null,
        }))
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async createPerson(input: {
      name: string
      x: number
      y: number
      circleId: string | null
      role: string
      avatar: string
      shapeType: string
      sides: number
      amplitude: number
      imageUrl?: string | null
    }) {
      try {
        const { boardId, userId } = ensureUserAndBoard()
        const person = await createPerson({
          boardId,
          ownerUserId: userId,
          ...input,
        })
        applyPerson(person)
        return mapDbPersonToUi(person)
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async updatePerson(input: {
      id: string
      name?: string
      tag_id?: string | null
      circle_id?: string | null
      role?: string
      avatar?: string
      shape_type?: string
      sides?: number
      amplitude?: number
      image_url?: string | null
    }) {
      try {
        const person = await updatePerson(input)
        applyPerson(person)
        return mapDbPersonToUi(person)
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async movePerson(id: string, x: number, y: number) {
      // Optimistically update local state immediately
      setGraphState((currentState) => ({
        ...currentState,
        people: currentState.people.map((p) => (p.id === id ? { ...p, x, y } : p)),
      }))

      const isLoadTest = id.startsWith('load-test-person-') || id.startsWith('stress-')
      if (user && !isLoadTest) {
        const existingTimer = movePersonTimersRef.current.get(id)
        if (existingTimer !== undefined) {
          window.clearTimeout(existingTimer)
        }

        const timerId = window.setTimeout(async () => {
          movePersonTimersRef.current.delete(id)
          try {
            await movePerson(id, x, y)
          } catch (error) {
            setError(error)
          }
        }, 500)

        movePersonTimersRef.current.set(id, timerId)
      }
    },
    async deletePerson(id: string) {
      try {
        clearScheduledPersonAiSync(id)
        personAiSyncInFlightRef.current.delete(id)
        personAiSyncQueuedRef.current.delete(id)
        await deletePerson(id)
        setGraphState((currentState) => ({
          ...currentState,
          people: currentState.people.filter((person) => person.id !== id),
          notes: currentState.notes.filter((note) => note.person_id !== id),
          personAiNotes: currentState.personAiNotes.filter((note) => note.person_id !== id),
          connections: currentState.connections.filter(
            (connection) => connection.person_a_id !== id && connection.person_b_id !== id,
          ),
          error: null,
        }))
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async createCircle(input: {
      name: string
      icon: string
      x: number
      y: number
      radius: number
      minRadius: number
      parentId: string | null
      connectedTo: string | null
      tone: string
      shapeType: string
      sides: number
      amplitude: number
      imageUrl?: string | null
    }) {
      try {
        const { boardId, userId } = ensureUserAndBoard()
        const circle = await createCircle({
          boardId,
          ownerUserId: userId,
          ...input,
        })
        setGraphState((currentState) => ({
          ...currentState,
          circles: [...currentState.circles, circle],
          error: null,
        }))
        return mapDbCircleToUi(circle)
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async updateCircle(id: string, updates: Partial<CircleNodeUi>) {
      try {
        const dbUpdates: Record<string, unknown> = {}
        if (updates.name !== undefined) dbUpdates.name = updates.name
        if (updates.icon !== undefined) dbUpdates.icon = updates.icon
        if (updates.x !== undefined) dbUpdates.x = updates.x
        if (updates.y !== undefined) dbUpdates.y = updates.y
        if (updates.radius !== undefined) dbUpdates.radius = updates.radius
        if (updates.minRadius !== undefined) dbUpdates.min_radius = updates.minRadius
        if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId
        if (updates.connectedTo !== undefined) dbUpdates.connected_to = updates.connectedTo
        if (updates.tone !== undefined) dbUpdates.tone = updates.tone
        if (updates.shapeType !== undefined) dbUpdates.shape_type = updates.shapeType
        if (updates.sides !== undefined) dbUpdates.sides = updates.sides
        if (updates.amplitude !== undefined) dbUpdates.amplitude = updates.amplitude
        if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl

        const circle = await updateCircle({ id, ...dbUpdates })
        setGraphState((currentState) => ({
          ...currentState,
          circles: currentState.circles.map((c) => (c.id === id ? circle : c)),
          error: null,
        }))
        return mapDbCircleToUi(circle)
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async moveCircle(id: string, x: number, y: number) {
      // Optimistically move subtree immediately
      setGraphState((currentState) => {
        const circle = currentState.circles.find((c) => c.id === id)
        if (!circle) return currentState

        const deltaX = x - circle.x
        const deltaY = y - circle.y

        const descendants = new Set<string>()
        const pending = [id]
        while (pending.length > 0) {
          const pId = pending.pop()!
          for (const c of currentState.circles) {
            if (c.parent_id === pId && !descendants.has(c.id)) {
              descendants.add(c.id)
              pending.push(c.id)
            }
          }
        }
        descendants.add(id)

        const nextCircles = currentState.circles.map((c) =>
          descendants.has(c.id) ? { ...c, x: c.x + deltaX, y: c.y + deltaY } : c,
        )
        const nextPeople = currentState.people.map((p) =>
          p.circle_id && descendants.has(p.circle_id) ? { ...p, x: p.x + deltaX, y: p.y + deltaY } : p,
        )

        return {
          ...currentState,
          circles: nextCircles,
          people: nextPeople,
        }
      })

      const isLoadTest = id === 'load-test-circle'
      if (user && !isLoadTest) {
        const existingTimer = moveCircleTimersRef.current.get(id)
        if (existingTimer !== undefined) {
          window.clearTimeout(existingTimer)
        }

        const timerId = window.setTimeout(async () => {
          moveCircleTimersRef.current.delete(id)
          try {
            const currentState = graphStateRef.current
            const descendants = new Set<string>()
            const pending = [id]
            while (pending.length > 0) {
              const pId = pending.pop()!
              for (const c of currentState.circles) {
                if (c.parent_id === pId && !descendants.has(c.id)) {
                  descendants.add(c.id)
                  pending.push(c.id)
                }
              }
            }
            descendants.add(id)

            const promises: Promise<unknown>[] = []
            for (const c of currentState.circles) {
              if (descendants.has(c.id)) {
                promises.push(moveCircle(c.id, c.x, c.y))
              }
            }
            for (const p of currentState.people) {
              if (p.circle_id && descendants.has(p.circle_id)) {
                promises.push(movePerson(p.id, p.x, p.y))
              }
            }
            await Promise.all(promises)
          } catch (error) {
            setError(error)
          }
        }, 500)

        moveCircleTimersRef.current.set(id, timerId)
      }
    },
    async deleteCircle(id: string) {
      try {
        await deleteCircle(id)
        setGraphState((currentState) => {
          const descendants = new Set<string>()
          const pending = [id]
          while (pending.length > 0) {
            const pId = pending.pop()!
            for (const c of currentState.circles) {
              if (c.parent_id === pId && !descendants.has(c.id)) {
                descendants.add(c.id)
                pending.push(c.id)
              }
            }
          }
          descendants.add(id)

          const rootCircle = currentState.circles.find((c) => c.is_root)
          const rootCircleId = rootCircle ? rootCircle.id : ''

          return {
            ...currentState,
            circles: currentState.circles.filter((c) => !descendants.has(c.id)),
            people: currentState.people.map((p) =>
              p.circle_id && descendants.has(p.circle_id) ? { ...p, circle_id: rootCircleId } : p,
            ),
            error: null,
          }
        })
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async createConnection(firstPersonId: string, secondPersonId: string) {
      try {
        const { boardId, userId } = ensureUserAndBoard()
        const connection = await createConnection({
          boardId,
          ownerUserId: userId,
          firstPersonId,
          secondPersonId,
        })
        applyConnection(connection)
        return connection
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async deleteConnection(id: string) {
      try {
        await deleteConnection(id)
        setGraphState((currentState) => ({
          ...currentState,
          connections: currentState.connections.filter((connection) => connection.id !== id),
          error: null,
        }))
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async createNote(title: string, body: string, personId: string, options?: { syncAi?: boolean }) {
      try {
        const { userId } = ensureUserAndBoard()
        const note = await createNote({
          personId,
          ownerUserId: userId,
          title,
          body,
        })
        applyNote(note)
        if (options?.syncAi !== false) {
          schedulePersonAiSync(note.person_id)
        }
        return note
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async updateNote(input: Parameters<typeof updateNote>[0]) {
      try {
        const note = await updateNote(input)
        applyNote(note)
        schedulePersonAiSync(note.person_id)
        return note
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async deleteNote(id: string) {
      try {
        await deleteNote(id)
        setGraphState((currentState) => ({
          ...currentState,
          notes: currentState.notes.filter((note) => note.id !== id),
          error: null,
        }))
      } catch (error) {
        setError(error)
        throw error
      }
    },
    syncPersonAiNote,
  }
}
