import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

import type { BoardGraphPayload, Connection, PersonNode, PersonNote, Tag } from './graphTypes'
import {
  createConnection,
  createNote,
  createPerson,
  createTag,
  deleteConnection,
  deleteNote,
  deletePerson,
  deleteTag,
  loadBoardGraph,
  movePerson,
  updateNote,
  updatePerson,
  updateTag,
} from './graphStorage'

type GraphStatus = 'idle' | 'loading' | 'ready'

type GraphState = {
  board: BoardGraphPayload['board'] | null
  people: PersonNode[]
  tags: Tag[]
  notes: PersonNote[]
  connections: Connection[]
  status: GraphStatus
  error: string | null
}

const EMPTY_GRAPH_STATE: GraphState = {
  board: null,
  people: [],
  tags: [],
  notes: [],
  connections: [],
  status: 'idle',
  error: null,
}

export function useBoardGraph(user: User | null) {
  const [graphState, setGraphState] = useState<GraphState>(EMPTY_GRAPH_STATE)

  useEffect(() => {
    if (!user) {
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

  return {
    ...visibleState,
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
        await deletePerson(id)
        setGraphState((currentState) => ({
          ...currentState,
          people: currentState.people.filter((person) => person.id !== id),
          notes: currentState.notes.filter((note) => note.person_id !== id),
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
