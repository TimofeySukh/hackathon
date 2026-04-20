export const DEFAULT_TAG_COLOR = '#8affd6'

export const DEFAULT_TAGS = [
  { name: 'Work', color: '#ff4d4d' },
  { name: 'Friends', color: '#3f7cff' },
  { name: 'Family', color: '#39c795' },
] as const

export function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value)
}

export function normalizeTagColor(color: string) {
  return isHexColor(color) ? color.toLowerCase() : DEFAULT_TAG_COLOR
}

export function hexToRgb(color: string) {
  const normalized = normalizeTagColor(color)
  const red = Number.parseInt(normalized.slice(1, 3), 16)
  const green = Number.parseInt(normalized.slice(3, 5), 16)
  const blue = Number.parseInt(normalized.slice(5, 7), 16)

  return `${red} ${green} ${blue}`
}

export function getDefaultTagColor(name: string) {
  const defaultTag = DEFAULT_TAGS.find((tag) => tag.name.toLowerCase() === name.trim().toLowerCase())

  return defaultTag?.color ?? DEFAULT_TAG_COLOR
}
