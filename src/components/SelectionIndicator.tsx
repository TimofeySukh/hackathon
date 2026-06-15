import { useLayoutEffect, useRef, useState } from 'react'

type Box = { x: number; y: number; w: number; h: number }

/**
 * Material 3 "active indicator": one persistent element that *slides* to the
 * currently selected option instead of an outline/background blinking on each
 * item. Mount it as a child of a `position: relative` group; tag each selectable
 * sibling with `data-ind-key`. The indicator measures the active sibling and
 * animates its transform/size toward it.
 *
 * - First placement on mount is instant (no slide-in from origin); only
 *   subsequent selection changes animate.
 * - The slide transition lives in CSS (`.selection-indicator`), so the global
 *   `prefers-reduced-motion` guard collapses it automatically.
 */
export function SelectionIndicator({
  activeKey,
  variant,
}: {
  /** `data-ind-key` of the selected sibling, or null to hide the indicator. */
  activeKey: string | null
  /** `ring` = halo around a swatch; `pill` = filled track behind a segment. */
  variant: 'ring' | 'pill'
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [box, setBox] = useState<Box | null>(null)
  // Don't animate the very first placement (e.g. when a popover opens), only
  // moves between options after that.
  const placedRef = useRef(false)
  const [animate, setAnimate] = useState(false)

  // Resolve the container from our own parent so we don't depend on a parent
  // ref (a child layout effect runs before the parent's ref is attached).
  useLayoutEffect(() => {
    const container = ref.current?.parentElement
    if (!container || activeKey == null) {
      setBox(null)
      placedRef.current = false
      return
    }
    const el = container.querySelector<HTMLElement>(
      `[data-ind-key="${CSS.escape(activeKey)}"]`,
    )
    if (!el) {
      setBox(null)
      placedRef.current = false
      return
    }
    setBox({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight })
    setAnimate(placedRef.current)
    placedRef.current = true
  }, [activeKey])

  // Ring sits 2px outside the swatch (+2px border ≈ the old 2px/2px outline);
  // the pill matches the segment exactly.
  const pad = variant === 'ring' ? 2 : 0
  const style = box
    ? {
        transform: `translate(${box.x - pad}px, ${box.y - pad}px)`,
        width: box.w + pad * 2,
        height: box.h + pad * 2,
      }
    : undefined

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={`selection-indicator selection-indicator--${variant}${
        animate ? '' : ' no-anim'
      }${box ? '' : ' is-hidden'}`}
      style={style}
    />
  )
}
