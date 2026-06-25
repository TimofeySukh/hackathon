import { useEffect, useRef } from 'react'

interface Ripple {
  x: number;
  y: number;
  startTime: number;
  duration: number;
  maxRadius: number;
  intensity: number;
  type: 'ambient' | 'mouse' | 'click';
}

export default function CanvasGridBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ripplesRef = useRef<Ripple[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    // Add ambient ripples periodically
    const spawnAmbientRipple = () => {
      const x = Math.random() * width
      const y = Math.random() * height
      ripplesRef.current.push({
        x,
        y,
        startTime: performance.now(),
        duration: 3500 + Math.random() * 2000,
        maxRadius: Math.max(width, height) * 0.4,
        intensity: 0.25 + Math.random() * 0.25,
        type: 'ambient',
      })
    }

    // Initialize with a few ambient ripples
    for (let i = 0; i < 3; i++) {
      setTimeout(spawnAmbientRipple, Math.random() * 2000)
    }
    const interval = setInterval(spawnAmbientRipple, 4000)

    const handleMouseMove = (e: MouseEvent) => {
      const now = performance.now()
      const lastRipple = ripplesRef.current
        .filter((r) => r.type === 'mouse')
        .slice(-1)[0]
      
      // Throttle mouse-triggered ripples
      if (!lastRipple || now - lastRipple.startTime > 200) {
        ripplesRef.current.push({
          x: e.clientX,
          y: e.clientY,
          startTime: now,
          duration: 1800,
          maxRadius: 220,
          intensity: 0.45,
          type: 'mouse',
        })
      }
    }

    const handleClick = (e: MouseEvent) => {
      ripplesRef.current.push({
        x: e.clientX,
        y: e.clientY,
        startTime: performance.now(),
        duration: 3000,
        maxRadius: Math.max(width, height) * 0.85,
        intensity: 0.95,
        type: 'click',
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('click', handleClick)

    const draw = () => {
      ctx.clearRect(0, 0, width, height)

      const now = performance.now()
      // Filter expired ripples
      ripplesRef.current = ripplesRef.current.filter(
        (r) => now - r.startTime < r.duration
      )

      // Spacing of the grid dots
      const gridSpacing = 24
      const cols = Math.ceil(width / gridSpacing)
      const rows = Math.ceil(height / gridSpacing)

      for (let c = 0; c <= cols; c++) {
        for (let r = 0; r <= rows; r++) {
          const x = c * gridSpacing
          const y = r * gridSpacing

          let maxIntensity = 0
          for (const rip of ripplesRef.current) {
            const age = now - rip.startTime
            const progress = age / rip.duration
            const currentRadius = rip.maxRadius * progress
            const dist = Math.hypot(x - rip.x, y - rip.y)

            const crestWidth = rip.type === 'click' ? 120 : 60
            const diff = Math.abs(dist - currentRadius)
            
            // Bell curve calculation for ripple height/intensity
            const intensity =
              Math.exp(-Math.pow(diff / crestWidth, 2)) *
              (1 - progress) *
              rip.intensity

            if (intensity > maxIntensity) {
              maxIntensity = intensity
            }
          }

          const isMajor = c % 8 === 0 && r % 8 === 0
          const baseOpacity = isMajor ? 0.08 : 0.03
          const baseRadius = isMajor ? 1.4 : 0.9

          const litOpacity = baseOpacity + (0.7 - baseOpacity) * maxIntensity
          const litRadius = baseRadius + maxIntensity * 2.2

          if (litOpacity > 0.01) {
            ctx.beginPath()
            // Teal color matching the futuristic dark theme
            ctx.fillStyle = `rgba(20, 184, 166, ${litOpacity})`
            ctx.arc(x, y, litRadius, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('click', handleClick)
      clearInterval(interval)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
