import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  WheelEvent as ReactWheelEvent,
} from 'react'

type Theme = 'dark' | 'light'

type Offset = {
  x: number
  y: number
}

type HighlightSpot = Offset & {
  id: number
  createdAt: number
}

type BoardStyle = CSSProperties & {
  '--board-offset-x': string
  '--board-offset-y': string
  '--dot-gap': string
  '--major-dot-gap': string
  '--dot-size': string
  '--major-dot-size': string
}

type HighlightSpotStyle = CSSProperties & {
  '--highlight-x': string
  '--highlight-y': string
  '--board-offset-x': string
  '--board-offset-y': string
  '--dot-gap': string
  '--major-dot-gap': string
  '--dot-size': string
  '--major-dot-size': string
  opacity: number
}

const THEME_STORAGE_KEY = 'hackathon-theme'
const MIN_SCALE = 0.2
const MAX_SCALE = 2.5
const GRID_GAP = 26
const MAJOR_GRID_GAP = 104
const DOT_SIZE = 1
const MAJOR_DOT_SIZE = 2
const HIGHLIGHT_LIFETIME_MS = 420
const HIGHLIGHT_DISTANCE = 12
const HIGHLIGHT_LIMIT = 28
const HIGHLIGHT_RADIUS = 78
const HIGHLIGHT_TICK_MS = 50

function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    return savedTheme === 'light' ? 'light' : 'dark'
  })
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [highlightSpots, setHighlightSpots] = useState<HighlightSpot[]>([])
  const [pointerPosition, setPointerPosition] = useState<Offset | null>(null)
  const [highlightClock, setHighlightClock] = useState(() => Date.now())
  const [isDragging, setIsDragging] = useState(false)

  const boardRef = useRef<HTMLElement | null>(null)
  const highlightIdRef = useRef(0)
  const lastHighlightSpotRef = useRef<Offset | null>(null)
  const dragStateRef = useRef({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    active: false,
  })

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (highlightSpots.length === 0) return undefined

    const intervalId = window.setInterval(() => {
      const now = Date.now()

      setHighlightClock(now)
      setHighlightSpots((currentSpots) =>
        currentSpots.filter((spot) => now - spot.createdAt < HIGHLIGHT_LIFETIME_MS),
      )
    }, HIGHLIGHT_TICK_MS)

    return () => window.clearInterval(intervalId)
  }, [highlightSpots.length])

  const addHighlightSpot = useCallback((clientX: number, clientY: number, force = false) => {
    const viewport = boardRef.current?.getBoundingClientRect()
    if (!viewport) return

    const now = Date.now()
    const nextSpot = {
      x: clientX - viewport.left,
      y: clientY - viewport.top,
    }
    const previousSpot = lastHighlightSpotRef.current
    const distanceFromPrevious = previousSpot
      ? Math.hypot(nextSpot.x - previousSpot.x, nextSpot.y - previousSpot.y)
      : Number.POSITIVE_INFINITY

    if (!force && distanceFromPrevious < HIGHLIGHT_DISTANCE) return

    const id = highlightIdRef.current + 1
    highlightIdRef.current = id
    lastHighlightSpotRef.current = nextSpot
    setPointerPosition(nextSpot)
    setHighlightClock(now)

    setHighlightSpots((currentSpots) => [
      ...currentSpots.slice(-HIGHLIGHT_LIMIT + 1),
      { id, createdAt: now, ...nextSpot },
    ])
  }, [])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!dragStateRef.current.active) return

      const nextX = dragStateRef.current.originX + event.clientX - dragStateRef.current.startX
      const nextY = dragStateRef.current.originY + event.clientY - dragStateRef.current.startY

      setOffset({ x: nextX, y: nextY })
      addHighlightSpot(event.clientX, event.clientY)
    }

    const handleMouseUp = () => {
      dragStateRef.current.active = false
      lastHighlightSpotRef.current = null
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [addHighlightSpot])

  const startDragging = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.button !== 0) return

    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
      active: true,
    }

    addHighlightSpot(event.clientX, event.clientY, true)
    setIsDragging(true)
  }

  const moveWithWheel = (event: ReactWheelEvent<HTMLElement>) => {
    event.preventDefault()

    const prefersPan = Math.abs(event.deltaX) > 0 || Math.abs(event.deltaY) < 24

    if (prefersPan) {
      setOffset((currentOffset) => ({
        x: currentOffset.x - event.deltaX,
        y: currentOffset.y - event.deltaY,
      }))
      return
    }

    const zoomIntensity = event.deltaY > 0 ? 0.88 : 1.12
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * zoomIntensity))

    if (nextScale === scale) return

    const { left, top } = event.currentTarget.getBoundingClientRect()
    const pointerX = event.clientX - left
    const pointerY = event.clientY - top
    const worldX = (pointerX - offset.x) / scale
    const worldY = (pointerY - offset.y) / scale

    setScale(nextScale)
    setOffset({
      x: pointerX - worldX * nextScale,
      y: pointerY - worldY * nextScale,
    })
  }

  const gridStyle = {
    '--dot-gap': `${GRID_GAP * scale}px`,
    '--major-dot-gap': `${MAJOR_GRID_GAP * scale}px`,
    '--dot-size': `${Math.max(0.75, DOT_SIZE * scale)}px`,
    '--major-dot-size': `${Math.max(1.5, MAJOR_DOT_SIZE * scale)}px`,
    '--board-offset-x': `${offset.x}px`,
    '--board-offset-y': `${offset.y}px`,
  }

  const boardStyle: BoardStyle = gridStyle

  const getHighlightOpacity = (spot: HighlightSpot) => {
    const age = highlightClock - spot.createdAt
    const ageOpacity = Math.max(0, 1 - age / HIGHLIGHT_LIFETIME_MS)

    if (!pointerPosition) return ageOpacity

    const distance = Math.hypot(spot.x - pointerPosition.x, spot.y - pointerPosition.y)
    const distanceOpacity = Math.max(0, 1 - distance / HIGHLIGHT_RADIUS)

    return Math.min(0.95, ageOpacity * distanceOpacity)
  }

  const getHighlightSpotStyle = (spot: HighlightSpot): HighlightSpotStyle | null => {
    const opacity = getHighlightOpacity(spot)

    if (opacity <= 0.03) return null

    return {
      ...gridStyle,
      '--highlight-x': `${spot.x}px`,
      '--highlight-y': `${spot.y}px`,
      opacity,
    }
  }

  return (
    <main className={`app-shell theme-${theme}`}>
      <button
        type="button"
        className="theme-toggle"
        onClick={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      >
        <span className="theme-toggle__track">
          <span className="theme-toggle__label">{theme === 'dark' ? 'Dark' : 'Light'}</span>
          <span className="theme-toggle__thumb" />
        </span>
      </button>

      <section
        ref={boardRef}
        className={`board-viewport${isDragging ? ' is-dragging' : ''}`}
        onMouseDown={startDragging}
        onMouseEnter={(event) => addHighlightSpot(event.clientX, event.clientY, true)}
        onMouseMove={(event) => addHighlightSpot(event.clientX, event.clientY)}
        onMouseLeave={() => {
          lastHighlightSpotRef.current = null
          setPointerPosition(null)
        }}
        onWheel={moveWithWheel}
        aria-label="Infinite board canvas"
      >
        <div className="board-surface" style={boardStyle} />
        <div className="board-highlights" aria-hidden="true">
          {highlightSpots.map((spot) => {
            const spotStyle = getHighlightSpotStyle(spot)

            if (!spotStyle) return null

            return <span key={spot.id} className="board-highlights__spot" style={spotStyle} />
          })}
        </div>
      </section>
    </main>
  )
}

export default App
