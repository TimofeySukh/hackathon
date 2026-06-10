import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'

import type { BoardGraphPayload, Connection, NodeGroup, PersonAiNote, PersonNode, PersonNote, Tag } from './graphTypes'
import {
  bulkCreateGraph,
  createNote,
  createPerson,
  createTag,
  deleteGraphData,
  deleteNote,
  deletePerson,
  deleteTag,
  getPersonAiNote,
  invokePersonAiNoteSync,
  loadBoardGraph,
  movePerson,
  saveNodeGroups as saveRemoteNodeGroups,
  upsertPersonAiNoteStatus,
  updateNote,
  updatePerson,
  updateTag,
} from './graphStorage'
import type { BulkGraphPersonInput } from './graphStorage'

type GraphStatus = 'idle' | 'loading' | 'ready'

type GraphState = {
  board: BoardGraphPayload['board'] | null
  people: PersonNode[]
  tags: Tag[]
  notes: PersonNote[]
  personAiNotes: PersonAiNote[]
  connections: Connection[]
  nodeGroups: NodeGroup[]
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
  nodeGroups: [],
  status: 'idle',
  error: null,
}

export function useBoardGraph(user: User | null) {
  const [graphState, setGraphState] = useState<GraphState>(EMPTY_GRAPH_STATE)
  const personAiSyncInFlightRef = useRef(new Set<string>())

  useEffect(() => {
    const personAiSyncInFlight = personAiSyncInFlightRef.current

    if (!user) {
      personAiSyncInFlight.clear()
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
          connections: [],
          nodeGroups: payload.nodeGroups,
          status: 'ready',
          error: null,
        })
      })
      .catch((error: unknown) => {
        if (!isMounted) return

        // Surface the real reason instead of the generic fallback — Supabase
        // rejects with a PostgrestError object that is not `instanceof Error`.
        console.error('loadBoardGraph failed:', error)
        const detail =
          error instanceof Error
            ? error.message
            : typeof error === 'object' && error !== null
              ? ((error as { message?: string; details?: string; hint?: string; code?: string }).message ??
                  JSON.stringify(error))
              : String(error)

        setGraphState({
          ...EMPTY_GRAPH_STATE,
          status: 'idle',
          error: `Unable to load board data: ${detail}`,
        })
      })

    return () => {
      isMounted = false
      personAiSyncInFlight.clear()
    }
  }, [user])

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

  const setError = (error: unknown) => {
    console.error('Board update failed:', error)
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null
          ? ((error as { message?: string }).message ?? JSON.stringify(error))
          : String(error)

    setGraphState((currentState) => ({
      ...currentState,
      error: `Board update failed: ${detail}`,
    }))
  }

  const syncPersonAiNote = async (personId: string) => {
    if (personAiSyncInFlightRef.current.has(personId)) {
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
    }
  }

  return {
    ...visibleState,
    async refreshPersonAiNote(personId: string) {
      try {
        await syncPersonAiNote(personId)
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async deleteCurrentGraphData() {
      try {
        const { userId } = ensureUserAndBoard()
        await deleteGraphData(userId)
        setGraphState((currentState) => ({
          ...currentState,
          tags: [],
          notes: [],
          personAiNotes: [],
          connections: [],
          nodeGroups: [],
          people: currentState.people.filter((person) => person.is_root).map((person) => ({
            ...person,
            tag_id: null,
          })),
          error: null,
        }))
      } catch (error) {
        setError(error)
        throw error
      }
    },
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
    async bulkCreatePeople(people: BulkGraphPersonInput[]) {
      try {
        const { boardId, userId } = ensureUserAndBoard()
        const payload = await bulkCreateGraph({
          boardId,
          ownerUserId: userId,
          people,
        })

        setGraphState((currentState) => ({
          ...currentState,
          people: [...currentState.people, ...payload.people],
          notes: [...currentState.notes, ...payload.notes],
          connections: [],
          error: null,
        }))

        return payload
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
        personAiSyncInFlightRef.current.delete(id)
        await deletePerson(id)
        setGraphState((currentState) => ({
          ...currentState,
          people: currentState.people.filter((person) => person.id !== id),
          notes: currentState.notes.filter((note) => note.person_id !== id),
          personAiNotes: currentState.personAiNotes.filter((note) => note.person_id !== id),
          connections: [],
          nodeGroups: currentState.nodeGroups
            .map((group) => ({
              ...group,
              memberIds: group.memberIds.filter((memberId) => memberId !== id),
            }))
            .filter((group) => group.memberIds.length >= 2),
          error: null,
        }))
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async saveNodeGroups(groups: NodeGroup[]) {
      try {
        const { boardId, userId } = ensureUserAndBoard()
        const savedGroups = await saveRemoteNodeGroups(boardId, userId, groups)
        setGraphState((currentState) => ({
          ...currentState,
          nodeGroups: savedGroups,
          error: null,
        }))
        return savedGroups
      } catch (error) {
        setError(error)
        throw error
      }
    },
    async createConnection() {
      return null
    },
    async deleteConnection() {
      setGraphState((currentState) => ({
        ...currentState,
        connections: [],
        error: null,
      }))
    },
    async createNote(title: string, body: string, personId: string, options?: { syncAi?: boolean }) {
      void options

      try {
        const { userId } = ensureUserAndBoard()
        const note = await createNote({
          personId,
          ownerUserId: userId,
          title,
          body,
        })
        applyNote(note)
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
