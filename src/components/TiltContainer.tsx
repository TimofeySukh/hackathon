import React, { useRef, useState } from 'react'

interface TiltContainerProps {
  children: React.ReactNode
  className?: string
}

export default function TiltContainer({ children, className }: TiltContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [transformStyle, setTransformStyle] = useState<string>(
    'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
  )

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left // x position within the element.
    const y = e.clientY - rect.top // y position within the element.

    const centerX = rect.width / 2
    const centerY = rect.height / 2

    // Max 8 degrees tilt to keep it subtle and elegant
    const rotX = ((centerY - y) / centerY) * 8
    const rotY = ((x - centerX) / centerX) * 8

    setTransformStyle(
      `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.02, 1.02, 1.02)`
    )
  }

  const handleMouseLeave = () => {
    setTransformStyle(
      'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
    )
  }

  return (
    <div
      ref={containerRef}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: transformStyle,
        transition: 'transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        transformStyle: 'preserve-3d',
      }}
    >
      {children}
    </div>
  )
}
