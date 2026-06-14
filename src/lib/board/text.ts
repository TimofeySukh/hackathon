// Small text helpers shared between the data layer (App) and the renderer.

// Derive 1-2 uppercase initials from a name, for avatar / circle-center glyphs.
export function makeInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const initials = parts.length >= 2
    ? `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`
    : parts[0]?.slice(0, 2) ?? ''
  return initials.toUpperCase() || 'IN'
}
