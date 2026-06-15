import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

/**
 * The canonical Material 3 slider for this app — reuse it for any value control;
 * don't hand-roll another. Thick track, a vertical pill handle, and a gap
 * between the active/inactive track and the handle.
 *
 * `variant="wave"` renders the active portion of the track as a sine wave whose
 * amplitude grows with the value (M3 Expressive wavy slider). Use it when the
 * value *is* a wave amount, so the control visualises what it changes.
 *
 * Motion: a tap on the track makes the handle (and the active fill/wave) *glide*
 * to the tapped spot via a short spring tween instead of teleporting. Dragging
 * is instant (zero latency) — the glide is disabled on the first pointer move.
 * External value changes glide too. Honors prefers-reduced-motion.
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

  const targetFrac = max > min ? (value - min) / (max - min) : 0

  // Fraction actually rendered. Tweened toward the target on tap / external
  // change; set instantly while dragging.
  const [renderFrac, setRenderFrac] = useState(targetFrac)
  const renderRef = useRef(targetFrac)
  const rafRef = useRef<number | null>(null)
  const draggingRef = useRef(false)
  // Position of the pointer when it was pressed down. We only cancel the glide
  // animation and switch to instant drag mode after the pointer has moved >=5 px
  // from this point. Without a threshold, pointermove fires on the same frame as
  // pointerdown (for any mouse jitter) and kills the animation before it starts.
  const downPosRef = useRef<{ x: number; moved: boolean } | null>(null)
  const selfChangeRef = useRef(false)

  function prefersReducedMotion() {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }

  function setRender(f: number) {
    renderRef.current = f
    setRenderFrac(f)
  }

  function cancelAnim() {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  // Short, decelerating spring-ish glide (no overshoot, so it can't visually
  // pass the tapped point on a single-direction value control).
  function animateTo(target: number) {
    cancelAnim()
    if (prefersReducedMotion()) {
      setRender(target)
      return
    }
    const start = renderRef.current
    const t0 = performance.now()
    const dur = 200
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setRender(start + (target - start) * eased)
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  // External value changes glide; our own pointer-driven changes are handled in
  // the pointer handlers (skip here to avoid fighting them).
  useEffect(() => {
    if (selfChangeRef.current) {
      selfChangeRef.current = false
      return
    }
    if (draggingRef.current) {
      setRender(targetFrac)
      return
    }
    if (Math.abs(targetFrac - renderRef.current) < 0.0005) return
    animateTo(targetFrac)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetFrac])

  useEffect(() => () => cancelAnim(), [])

  function fracFromClientX(clientX: number) {
    const el = trackRef.current
    if (!el) return renderRef.current
    const r = el.getBoundingClientRect()
    const f = (clientX - r.left) / r.width
    return Math.max(0, Math.min(1, f))
  }

  // Commit a fraction as a stepped value and return the stepped fraction so the
  // handle sits exactly on the committed value.
  function commit(f: number) {
    let v = min + f * (max - min)
    v = Math.round(v / step) * step
    v = Math.max(min, Math.min(max, v))
    selfChangeRef.current = true
    onChange(v)
    return max > min ? (v - min) / (max - min) : 0
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer may already be gone (or synthetic); capture is best-effort.
    }
    draggingRef.current = true
    downPosRef.current = { x: event.clientX, moved: false }
    animateTo(commit(fracFromClientX(event.clientX))) // glide to the tapped spot
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current && event.buttons !== 1) return
    const down = downPosRef.current
    if (down && !down.moved) {
      // Stay in glide mode until the pointer moves at least 5 px horizontally.
      if (Math.abs(event.clientX - down.x) < 5) return
      down.moved = true
      cancelAnim() // threshold crossed → drop the glide, track instantly
    }
    setRender(commit(fracFromClientX(event.clientX)))
  }

  function onPointerUpOrCancel() {
    draggingRef.current = false
    downPosRef.current = null
  }

  const activeFrac = renderFrac
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
