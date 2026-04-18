import { useCallback, useEffect, useMemo, useState } from 'react'

import { supabase } from '../../lib/supabase'
import { createAnonymousGraph, ROOT_NODE_LABEL, type GraphEdge, type GraphNode } from './types'

type GraphStatus = 'loading' | 'ready'
type GraphStorageMode = 'local' | 'remote'

type BoardNodeRow = {
  id: string
  board_id: string
  label: string
  x: number
  y: number
  kind: 'root' | 'default'
  note: string | null
  tag: string | null
}

type BoardEdgeRow = {
  id: string
  board_id: string
  from_node_id: string
  to_node_id: string
}

const mapNodeRow = (row: BoardNodeRow): GraphNode => ({
  id: row.id,
  boardId: row.board_id,
  label: row.label,
  x: row.x,
  y: row.y,
  kind: row.kind,
  note: row.note,
  tag: row.tag,
})

const mapEdgeRow = (row: BoardEdgeRow): GraphEdge => ({
  id: row.id,
  boardId: row.board_id,
  from: row.from_node_id,
  to: row.to_node_id,
})

const createNodeRow = (boardId: string, node: GraphNode): BoardNodeRow => ({
  id: node.id,
  board_id: boardId,
  label: node.label,
  x: node.x,
  y: node.y,
  kind: node.kind,
  note: node.note,
  tag: node.tag,
})

const createEdgeRow = (boardId: string, edge: GraphEdge): BoardEdgeRow => ({
  id: edge.id,
  board_id: boardId,
  from_node_id: edge.from,
  to_node_id: edge.to,
})

const hasEdge = (edges: GraphEdge[], from: string, to: string) =>
  edges.some((edge) => edge.from === from && edge.to === to)

function hasMissingGraphTables(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'PGRST205'
  )
}

async function ensureBoardRoot(boardId: string) {
  if (!supabase) return

  const { data, error } = await supabase
    .from('board_nodes')
    .select('id')
    .eq('board_id', boardId)
    .eq('kind', 'root')
    .limit(1)

  if (error) {
    throw error
  }

  if (data && data.length > 0) return

  const { error: insertError } = await supabase.from('board_nodes').insert({
    board_id: boardId,
    label: ROOT_NODE_LABEL,
    x: 0,
    y: 0,
    kind: 'root',
    note: null,
    tag: null,
  })

  if (insertError && insertError.code !== '23505') {
    throw insertError
  }
}

async function loadBoardGraph(boardId: string) {
  if (!supabase) {
    return createAnonymousGraph()
  }

  await ensureBoardRoot(boardId)

  const [{ data: nodeRows, error: nodeError }, { data: edgeRows, error: edgeError }] =
    await Promise.all([
      supabase
        .from('board_nodes')
        .select('id, board_id, label, x, y, kind, note, tag')
        .eq('board_id', boardId)
        .order('created_at', { ascending: true }),
      supabase
        .from('board_edges')
        .select('id, board_id, from_node_id, to_node_id')
        .eq('board_id', boardId)
        .order('created_at', { ascending: true }),
    ])

  if (nodeError) {
    throw nodeError
  }

  if (edgeError) {
    throw edgeError
  }

  return {
    nodes: (nodeRows ?? []).map(mapNodeRow),
    edges: (edgeRows ?? []).map(mapEdgeRow),
  }
}

export function useBoardGraph(boardId: string | null) {
  const anonymousGraph = useMemo(() => createAnonymousGraph(), [])
  const [nodes, setNodes] = useState<GraphNode[]>(anonymousGraph.nodes)
  const [edges, setEdges] = useState<GraphEdge[]>(anonymousGraph.edges)
  const [status, setStatus] = useState<GraphStatus>('ready')
  const [error, setError] = useState<string | null>(null)
  const [storageMode, setStorageMode] = useState<GraphStorageMode>(() =>
    boardId && supabase ? 'remote' : 'local',
  )

  const refreshGraph = useCallback(async () => {
    if (!boardId || !supabase) {
      setNodes(anonymousGraph.nodes)
      setEdges(anonymousGraph.edges)
      setStatus('ready')
      setError(null)
      setStorageMode('local')
      return
    }

    setStatus('loading')

    try {
      const graph = await loadBoardGraph(boardId)
      setNodes(graph.nodes)
      setEdges(graph.edges)
      setStatus('ready')
      setError(null)
      setStorageMode('remote')
    } catch (loadError) {
      if (hasMissingGraphTables(loadError)) {
        setNodes(anonymousGraph.nodes)
        setEdges(anonymousGraph.edges)
        setStatus('ready')
        setError(null)
        setStorageMode('local')
        return
      }

      setStatus('ready')
      setError(loadError instanceof Error ? loadError.message : 'Unable to load board graph.')
    }
  }, [anonymousGraph.edges, anonymousGraph.nodes, boardId])

  useEffect(() => {
    queueMicrotask(() => {
      void refreshGraph()
    })
  }, [refreshGraph])

  useEffect(() => {
    if (!boardId || !supabase || storageMode !== 'remote') return undefined

    const client = supabase

    const reload = () => {
      void refreshGraph()
    }

    const channel = client
      .channel(`board-graph-${boardId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'board_nodes',
          filter: `board_id=eq.${boardId}`,
        },
        reload,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'board_edges',
          filter: `board_id=eq.${boardId}`,
        },
        reload,
      )
      .subscribe()

    return () => {
      void client.removeChannel(channel)
    }
  }, [boardId, refreshGraph, storageMode])

  const persistNode = useCallback(
    async (node: GraphNode) => {
      if (!boardId || !supabase || storageMode !== 'remote') return
      const client = supabase

      const { error: persistError } = await client
        .from('board_nodes')
        .upsert(createNodeRow(boardId, node))

      if (persistError) {
        throw persistError
      }
    },
    [boardId, storageMode],
  )

  const persistEdge = useCallback(
    async (edge: GraphEdge) => {
      if (!boardId || !supabase || storageMode !== 'remote') return
      const client = supabase

      const { error: persistError } = await client
        .from('board_edges')
        .upsert(createEdgeRow(boardId, edge))

      if (persistError) {
        throw persistError
      }
    },
    [boardId, storageMode],
  )

  const updateNode = useCallback(
    async (nodeId: string, patch: Partial<Omit<GraphNode, 'id'>>, persist = true) => {
      let nextNode: GraphNode | null = null

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== nodeId) return node

          nextNode = { ...node, ...patch }
          return nextNode
        }),
      )

      if (!nextNode) return

      if (!persist) return

      try {
        await persistNode(nextNode)
      } catch (persistError) {
        setError(persistError instanceof Error ? persistError.message : 'Unable to update node.')
        void refreshGraph()
      }
    },
    [persistNode, refreshGraph],
  )

  const createConnectedNode = useCallback(
    async (fromId: string, x: number, y: number) => {
      const nextNode: GraphNode = {
        id: `node-${crypto.randomUUID()}`,
        boardId: boardId ?? undefined,
        label: '',
        x,
        y,
        kind: 'default',
        note: null,
        tag: null,
      }

      const nextEdge: GraphEdge = {
        id: `edge-${crypto.randomUUID()}`,
        boardId: boardId ?? undefined,
        from: fromId,
        to: nextNode.id,
      }

      setNodes((currentNodes) => [...currentNodes, nextNode])
      setEdges((currentEdges) => [...currentEdges, nextEdge])

      try {
        await Promise.all([persistNode(nextNode), persistEdge(nextEdge)])
      } catch (persistError) {
        setError(
          persistError instanceof Error ? persistError.message : 'Unable to create connected node.',
        )
        void refreshGraph()
      }

      return nextNode
    },
    [boardId, persistEdge, persistNode, refreshGraph],
  )

  const connectNodes = useCallback(
    async (fromId: string, toId: string) => {
      if (fromId === toId || hasEdge(edges, fromId, toId)) return

      const nextEdge: GraphEdge = {
        id: `edge-${crypto.randomUUID()}`,
        boardId: boardId ?? undefined,
        from: fromId,
        to: toId,
      }

      setEdges((currentEdges) => [...currentEdges, nextEdge])

      try {
        await persistEdge(nextEdge)
      } catch (persistError) {
        setError(
          persistError instanceof Error ? persistError.message : 'Unable to create relationship.',
        )
        void refreshGraph()
      }
    },
    [boardId, edges, persistEdge, refreshGraph],
  )

  const deleteNode = useCallback(
    async (nodeId: string) => {
      const targetNode = nodes.find((node) => node.id === nodeId)
      if (!targetNode || targetNode.kind === 'root') return

      setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId))
      setEdges((currentEdges) =>
        currentEdges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
      )

      if (!boardId || !supabase || storageMode !== 'remote') return
      const client = supabase

      const deleteEdges = client
        .from('board_edges')
        .delete()
        .eq('board_id', boardId)
        .or(`from_node_id.eq.${nodeId},to_node_id.eq.${nodeId}`)

      const deleteNodeQuery = client
        .from('board_nodes')
        .delete()
        .eq('board_id', boardId)
        .eq('id', nodeId)

      const [{ error: edgeError }, { error: nodeError }] = await Promise.all([
        deleteEdges,
        deleteNodeQuery,
      ])

      if (edgeError || nodeError) {
        setError(edgeError?.message ?? nodeError?.message ?? 'Unable to delete node.')
        void refreshGraph()
      }
    },
    [boardId, nodes, refreshGraph, storageMode],
  )

  const replaceGraph = useCallback(
    async (nextNodes: GraphNode[], nextEdges: GraphEdge[]) => {
      setNodes(nextNodes)
      setEdges(nextEdges)

      if (!boardId || !supabase || storageMode !== 'remote') return
      const client = supabase

      const nodeRows = nextNodes.map((node) => createNodeRow(boardId, node))
      const edgeRows = nextEdges.map((edge) => createEdgeRow(boardId, edge))

      try {
        const { error: deleteEdgesError } = await client
          .from('board_edges')
          .delete()
          .eq('board_id', boardId)

        if (deleteEdgesError) throw deleteEdgesError

        const { error: deleteNodesError } = await client
          .from('board_nodes')
          .delete()
          .eq('board_id', boardId)

        if (deleteNodesError) throw deleteNodesError

        if (nodeRows.length > 0) {
          const { error: insertNodesError } = await client.from('board_nodes').insert(nodeRows)
          if (insertNodesError) throw insertNodesError
        }

        if (edgeRows.length > 0) {
          const { error: insertEdgesError } = await client.from('board_edges').insert(edgeRows)
          if (insertEdgesError) throw insertEdgesError
        }
      } catch (replaceError) {
        setError(replaceError instanceof Error ? replaceError.message : 'Unable to restore graph.')
        void refreshGraph()
      }
    },
    [boardId, refreshGraph, storageMode],
  )

  return {
    nodes,
    edges,
    status,
    error,
    refreshGraph,
    updateNode,
    createConnectedNode,
    connectNodes,
    deleteNode,
    replaceGraph,
  }
}
