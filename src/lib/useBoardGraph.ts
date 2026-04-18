import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'

import type { BoardGraphPayload, Connection, PersonAiNote, PersonNode, PersonNote, Tag } from './graphTypes'
import {
  createConnection,
  createNote,
  createPerson,
  createTag,
  deleteConnection,
  deleteNote,
  deletePerson,
  getPersonAiNote,
  invokePersonAiNoteSync,
  loadBoardGraph,
  movePerson,
  upsertPersonAiNoteStatus,
  updateNote,
  updatePerson,
} from './graphStorage'

type GraphStatus = 'idle' | 'loading' | 'ready'

type GraphState = {
  board: BoardGraphPayload['board'] | null
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
  const [graphState, setGraphState] = useState<GraphState>(EMPTY_GRAPH_STATE)
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

        setGraphState({
          ...EMPTY_GRAPH_STATE,
          status: 'idle',
          error: error instanceof Error ? error.message : 'Unable to load board data.',
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

  return {
    ...visibleState,
    async createTag(name: string) {
      try {
        const { userId } = ensureUserAndBoard()
        const tag = await createTag(userId, name)
        setGraphState((currentState) => ({
          ...currentState,
          tags: [...currentState.tags, tag].sort((left, right) => left.name.localeCompare(right.name)),
          error: null,
        }))
        return tag
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async createPerson(input: Omit<Parameters<typeof createPerson>[0], 'boardId' | 'ownerUserId'>) {
      try {
        const { boardId, userId } = ensureUserAndBoard()
        const person = await createPerson({
          boardId,
          ownerUserId: userId,
          ...input,
        })
        applyPerson(person)
        return person
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async updatePerson(input: Parameters<typeof updatePerson>[0]) {
      try {
        const person = await updatePerson(input)
        applyPerson(person)
        return person
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async movePerson(id: string, x: number, y: number) {
      try {
        const person = await movePerson(id, x, y)
        applyPerson(person)
        return person
      } catch (error) {
        setError(error)
        throw error
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
    async createNote(title: string, body: string, personId: string) {
      try {
        const { userId } = ensureUserAndBoard()
        const note = await createNote({
          personId,
          ownerUserId: userId,
          title,
          body,
        })
        applyNote(note)
        schedulePersonAiSync(note.person_id)
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
  }
}
