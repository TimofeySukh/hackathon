import { useEffect, useRef, useState } from 'react'
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

const THEME_STORAGE_KEY = 'hackathon-theme'

function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    return savedTheme === 'light' ? 'light' : 'dark'
  })
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)

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
    const handleMouseMove = (event: MouseEvent) => {
      if (!dragStateRef.current.active) return

      const nextX = dragStateRef.current.originX + event.clientX - dragStateRef.current.startX
      const nextY = dragStateRef.current.originY + event.clientY - dragStateRef.current.startY

      setOffset({ x: nextX, y: nextY })
    }

    const handleMouseUp = () => {
      dragStateRef.current.active = false
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const startDragging = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.button !== 0) return

    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
      active: true,
    }

    setIsDragging(true)
  }

  const moveWithWheel = (event: ReactWheelEvent<HTMLElement>) => {
    event.preventDefault()

    setOffset((currentOffset) => ({
      x: currentOffset.x - event.deltaX,
      y: currentOffset.y - event.deltaY,
    }))
  }

  const boardStyle = {
    backgroundPosition: `${offset.x}px ${offset.y}px, ${offset.x}px ${offset.y}px, center, center`,
  } satisfies CSSProperties

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
        className={`board-viewport${isDragging ? ' is-dragging' : ''}`}
        onMouseDown={startDragging}
        onWheel={moveWithWheel}
        aria-label="Infinite board canvas"
      >
        <div className="board-surface" style={boardStyle} />
      </section>
    </main>
  )
}

export default App
