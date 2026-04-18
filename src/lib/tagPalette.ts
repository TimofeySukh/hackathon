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
