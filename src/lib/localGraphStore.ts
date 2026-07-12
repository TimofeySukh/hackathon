import type { GraphState } from './board/types'

const DATABASE_NAME = 'social-datanode-local'
const DATABASE_VERSION = 1
const GRAPH_STORE = 'graphs'
const ACTIVE_GRAPH_KEY = 'active'
const LEGACY_LOCAL_GRAPH_KEY = 'hackathon-board:local-graph'

function isGraphState(value: unknown): value is GraphState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<GraphState>
  return (
    Array.isArray(candidate.circles) &&
    Array.isArray(candidate.people) &&
    Array.isArray(candidate.connections)
  )
}

function requestResult<T>(request: IDBRequest<T>, action: string): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true })
    request.addEventListener('error', () => reject(new Error(`${action}: ${request.error?.message ?? 'IndexedDB request failed.'}`)), { once: true })
  })
}

function transactionComplete(transaction: IDBTransaction, action: string): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true })
    transaction.addEventListener('abort', () => reject(new Error(`${action}: ${transaction.error?.message ?? 'IndexedDB transaction was aborted.'}`)), { once: true })
    transaction.addEventListener('error', () => reject(new Error(`${action}: ${transaction.error?.message ?? 'IndexedDB transaction failed.'}`)), { once: true })
  })
}

async function openDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in window)) {
    throw new Error('This browser does not provide IndexedDB for local board storage.')
  }

  const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
  request.addEventListener('upgradeneeded', () => {
    if (!request.result.objectStoreNames.contains(GRAPH_STORE)) {
      request.result.createObjectStore(GRAPH_STORE)
    }
  }, { once: true })
  return await requestResult(request, 'Failed to open local board storage')
}

async function readIndexedGraph(): Promise<GraphState | null> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(GRAPH_STORE, 'readonly')
    const value = await requestResult(
      transaction.objectStore(GRAPH_STORE).get(ACTIVE_GRAPH_KEY),
      'Failed to read the local board',
    )
    return isGraphState(value) ? value : null
  } finally {
    database.close()
  }
}

export async function saveLocalGraph(graph: GraphState): Promise<void> {
  if (!isGraphState(graph)) throw new Error('Cannot save the local board: graph data is invalid.')

  const database = await openDatabase()
  try {
    const transaction = database.transaction(GRAPH_STORE, 'readwrite')
    const completed = transactionComplete(transaction, 'Failed to save the local board')
    transaction.objectStore(GRAPH_STORE).put(graph, ACTIVE_GRAPH_KEY)
    await completed
  } finally {
    database.close()
  }
}

export async function loadLocalGraph(): Promise<GraphState | null> {
  const saved = await readIndexedGraph()
  if (saved) return saved

  const legacyRaw = window.localStorage.getItem(LEGACY_LOCAL_GRAPH_KEY)
  if (!legacyRaw) return null

  let legacyGraph: unknown
  try {
    legacyGraph = JSON.parse(legacyRaw)
  } catch (error) {
    throw new Error(`Failed to read the legacy local board: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!isGraphState(legacyGraph)) {
    throw new Error('Failed to read the legacy local board: graph data is invalid.')
  }

  await saveLocalGraph(legacyGraph)
  window.localStorage.removeItem(LEGACY_LOCAL_GRAPH_KEY)
  return legacyGraph
}
