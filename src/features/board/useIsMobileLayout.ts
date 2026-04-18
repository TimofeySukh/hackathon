import { useEffect, useState } from 'react'

const MOBILE_LAYOUT_QUERY = '(max-width: 720px), (pointer: coarse)'

export function useIsMobileLayout() {
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    window.matchMedia(MOBILE_LAYOUT_QUERY).matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_LAYOUT_QUERY)
    const handleChange = () => {
      setIsMobileLayout(mediaQuery.matches)
    }

    handleChange()
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return isMobileLayout
}
