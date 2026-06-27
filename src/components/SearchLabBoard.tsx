import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { MIN_SCALE, MAX_SCALE, ZONE_ONLY_SCALE, EMPTY_ANIM_FRAME } from '../lib/board/constants'
import { clamp } from '../lib/board/geometry'
import { createBoardIndex, drawBoardLayer, hitTestBoard, setBoardRepaintCallback } from '../lib/board/render'
import type { Camera, GraphState, SelectedItem } from '../lib/board/types'
import { boundsForCircleIds } from '../lib/search/syntheticBoardLayout'
import { discoveryFocusMaxScale } from '../lib/search/discoveryCamera'

type Props = {
  graph: GraphState
  selectedPersonId: string | null
  onSelectPerson: (id: string | null) => void
  loading?: boolean
  peopleCount: number
  focusCircleIds?: string[] | null
  searchMatchPersonIds?: string[]
  totalMatchCount?: number
}

function computeGraphBounds(graph: GraphState) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const circle of graph.circles) {
    minX = Math.min(minX, circle.x - circle.radius)
    minY = Math.min(minY, circle.y - circle.radius)
    maxX = Math.max(maxX, circle.x + circle.radius)
    maxY = Math.max(maxY, circle.y + circle.radius)
  }

  if (!Number.isFinite(minX)) {
    return { minX: -400, minY: -400, maxX: 400, maxY: 400 }
  }

  return { minX, minY, maxX, maxY }
}

function cameraForBounds(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  width: number,
  height: number,
  maxScale = 0.9,
): Camera {
  const pad = 96
  const worldW = bounds.maxX - bounds.minX + pad * 2
  const worldH = bounds.maxY - bounds.minY + pad * 2
  const scale = clamp(Math.min(width / worldW, height / worldH), MIN_SCALE, maxScale)
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2
  return {
    x: width / 2 - cx * scale,
    y: height / 2 - cy * scale,
    scale,
  }
}

function initialCamera(graph: GraphState, width: number, height: number, peopleCount: number): Camera {
  const you = graph.circles.find((circle) => circle.id === 'you')
  if (peopleCount > 500 && you) {
    return {
      x: width / 2 - you.x * 0.1,
      y: height / 2 - you.y * 0.1,
      scale: 0.1,
    }
  }
  return cameraForBounds(computeGraphBounds(graph), width, height)
}

export function SearchLabBoard({
  graph,
  selectedPersonId,
  onSelectPerson,
  loading,
  peopleCount,
  focusCircleIds,
  searchMatchPersonIds = [],
  totalMatchCount = 0,
}: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: 0.82 })
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null)
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 0.82 })
  const [hoveredPersonId, setHoveredPersonId] = useState<string | null>(null)

  const index = useMemo(
    () => createBoardIndex(graph.circles, graph.people, graph.connections ?? []),
    [graph],
  )

  const selectedItem: SelectedItem = selectedPersonId
    ? { type: 'person', id: selectedPersonId }
    : null

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const surface = surfaceRef.current
    if (!canvas || !surface) return
    const liveCamera = cameraRef.current
    drawBoardLayer(
      canvas,
      surface,
      liveCamera,
      index,
      selectedItem,
      hoveredPersonId,
      null,
      null,
      liveCamera.scale >= ZONE_ONLY_SCALE,
      liveCamera.scale >= 0.55,
      'circles',
      'transparent',
      selectedPersonId ? [selectedPersonId] : [],
      null,
      [],
      null,
      EMPTY_ANIM_FRAME,
      searchMatchPersonIds,
    )
  }, [hoveredPersonId, index, searchMatchPersonIds, selectedItem, selectedPersonId])

  useEffect(() => {
    cameraRef.current = camera
    paint()
  }, [camera, paint])

  useEffect(() => {
    paint()
  }, [graph, paint])

  useEffect(() => {
    setBoardRepaintCallback(() => paint())
    return () => setBoardRepaintCallback(null)
  }, [paint])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const { width, height } = surface.getBoundingClientRect()

    if (focusCircleIds && focusCircleIds.length > 0) {
      const bounds = boundsForCircleIds(graph, focusCircleIds)
      if (bounds) {
        const maxScale = totalMatchCount > 0 ? discoveryFocusMaxScale(totalMatchCount) : 1.1
        const next = cameraForBounds(bounds, width, height, maxScale)
        cameraRef.current = next
        setCamera(next)
        return
      }
    }

    const next = initialCamera(graph, width, height, peopleCount)
    cameraRef.current = next
    setCamera(next)
  }, [focusCircleIds, graph, peopleCount, totalMatchCount])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const observer = new ResizeObserver(() => paint())
    observer.observe(surface)
    return () => observer.disconnect()
  }, [paint])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return

    function handleWheel(event: WheelEvent) {
      event.preventDefault()
      const rect = surface!.getBoundingClientRect()
      const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const current = cameraRef.current
      const before = {
        x: (pointer.x - current.x) / current.scale,
        y: (pointer.y - current.y) / current.scale,
      }

      if (event.ctrlKey || event.metaKey) {
        const zoomIntensity = 0.015
        const nextScale = clamp(current.scale * Math.exp(-event.deltaY * zoomIntensity), MIN_SCALE, MAX_SCALE)
        setCamera({
          scale: nextScale,
          x: pointer.x - before.x * nextScale,
          y: pointer.y - before.y * nextScale,
        })
      } else {
        setCamera({
          ...current,
          x: current.x - event.deltaX,
          y: current.y - event.deltaY,
        })
      }
    }

    surface.addEventListener('wheel', handleWheel, { passive: false })
    return () => surface.removeEventListener('wheel', handleWheel)
  }, [])

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const surface = surfaceRef.current
    if (!surface) return

    const rect = surface.getBoundingClientRect()
    const local = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const hit = hitTestBoard(index, cameraRef.current, selectedItem, local)

    if (hit?.type === 'person') {
      onSelectPerson(hit.person.id)
      return
    }

    onSelectPerson(null)
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: cameraRef.current.x,
      originY: cameraRef.current.y,
    }
    surface.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const surface = surfaceRef.current
    if (!surface) return

    const rect = surface.getBoundingClientRect()
    const local = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const hit = hitTestBoard(index, cameraRef.current, selectedItem, local)
    setHoveredPersonId(hit?.type === 'person' ? hit.person.id : null)

    const pan = panRef.current
    if (pan?.pointerId === event.pointerId) {
      setCamera({
        ...cameraRef.current,
        x: pan.originX + event.clientX - pan.startX,
        y: pan.originY + event.clientY - pan.startY,
      })
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const pan = panRef.current
    if (pan?.pointerId === event.pointerId) {
      panRef.current = null
      surfaceRef.current?.releasePointerCapture(event.pointerId)
    }
  }

  const gridStyle = {
    backgroundSize: `${160 * camera.scale}px ${160 * camera.scale}px, ${20 * camera.scale}px ${20 * camera.scale}px`,
    backgroundPosition: `${camera.x}px ${camera.y}px`,
  } as const

  return (
    <div className="search-lab__board-wrap">
      <div
        ref={surfaceRef}
        className="graph-surface search-lab__graph-surface"
        style={gridStyle}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <canvas ref={canvasRef} className="board-canvas-layer" aria-label="Search Lab board" />
        {loading ? (
          <div className="search-lab__board-loading">
            <span className="discovery-panel__spinner" aria-hidden="true" />
            Running local agent…
          </div>
        ) : null}
      </div>
    </div>
  )
}
