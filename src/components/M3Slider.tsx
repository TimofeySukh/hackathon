import { useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

/**
 * The canonical Material 3 slider for this app — reuse it for any value control;
 * don't hand-roll another. Thick track, a vertical pill handle, and a gap
 * between the active/inactive track and the handle.
 *
 * `variant="wave"` renders the active portion of the track as a sine wave whose
 * amplitude grows with the value (M3 Expressive wavy slider). Use it when the
 * value *is* a wave amount, so the control visualises what it changes.
 */
export function M3Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  variant = 'plain',
  label,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  variant?: 'plain' | 'wave'
  label?: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const [localFrac, setLocalFrac] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const frac = max > min ? (value - min) / (max - min) : 0
  const activeFrac = isDragging && localFrac !== null ? localFrac : frac

  function setFromClientX(clientX: number) {
    const el = trackRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let f = (clientX - r.left) / r.width
    f = Math.max(0, Math.min(1, f))
    setLocalFrac(f)
    let v = min + f * (max - min)
    v = Math.round(v / step) * step
    onChange(Math.max(min, Math.min(max, v)))
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer may already be gone (or synthetic); capture is best-effort.
    }
    setIsDragging(true)
    setFromClientX(event.clientX)
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (isDragging || event.buttons === 1) {
      setFromClientX(event.clientX)
    }
  }

  function onPointerUpOrCancel() {
    setIsDragging(false)
    setLocalFrac(null)
  }

  const H = 28
  const mid = H / 2
  const gap = 6
  const handleX = activeFrac * width
  const activeEnd = Math.max(0, handleX - gap)
  const inactiveStart = Math.min(width, handleX + gap)

  // Active wave: amplitude scales with the value, so the track shows the waviness.
  let wavePath = ''
  if (variant === 'wave') {
    const amp = activeFrac * 8
    const wavelength = 18
    let d = `M 0 ${mid}`
    for (let x = 2; x <= activeEnd; x += 2) {
      const y = mid + Math.sin((x / wavelength) * Math.PI * 2) * amp
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`
    }
    wavePath = d
  }

  return (
    <div className="m3-slider">
      {label && <span className="m3-slider__label">{label}</span>}
      <div
        ref={trackRef}
        className="m3-slider__track"
        style={{ height: H }}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUpOrCancel}
        onPointerCancel={onPointerUpOrCancel}
        onLostPointerCapture={onPointerUpOrCancel}
      >
        <svg className="m3-slider__svg" width={width} height={H} aria-hidden="true">
          <line
            className="m3-slider__inactive"
            x1={inactiveStart}
            y1={mid}
            x2={width}
            y2={mid}
          />
          {variant === 'wave' ? (
            <path className="m3-slider__active" d={wavePath} fill="none" />
          ) : (
            <line className="m3-slider__active" x1={0} y1={mid} x2={activeEnd} y2={mid} />
          )}
        </svg>
        <span className="m3-slider__handle" style={{ left: handleX }} />
      </div>
    </div>
  )
}
