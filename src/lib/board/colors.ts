// Pure color helpers for the board: tone resolution, hex<->rgb<->hsv conversion,
// mixing and readable-contrast selection.

import type { CircleNode, CircleToneColors, HsvColor } from './types'
import { MATERIAL_TONES } from './constants'

export type { CircleToneColors }

export function getCircleColors(circle: CircleNode): CircleToneColors {
  if (!circle.customColor) return MATERIAL_TONES[circle.tone]
  return {
    fill: colorMix(circle.customColor, '#ffffff', 0.78),
    border: colorMix(circle.customColor, '#000000', 0.28),
    text: '#1a1c1e',
    centerBg: circle.customColor,
  }
}

export function lerpHex(a: string, b: string, t: number) {
  const from = hexToRgb(a)
  const to = hexToRgb(b)
  if (!from || !to) return t < 0.5 ? a : b
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t)
  return rgbToHex(mix(from.r, to.r), mix(from.g, to.g), mix(from.b, to.b))
}

export function lerpCircleColors(from: CircleToneColors, to: CircleToneColors, t: number): CircleToneColors {
  return {
    fill: lerpHex(from.fill, to.fill, t),
    border: lerpHex(from.border, to.border, t),
    text: lerpHex(from.text, to.text, t),
    centerBg: lerpHex(from.centerBg, to.centerBg, t),
  }
}

export function circleColorsEqual(a: CircleToneColors, b: CircleToneColors) {
  return (
    a.fill.toLowerCase() === b.fill.toLowerCase() &&
    a.border.toLowerCase() === b.border.toLowerCase() &&
    a.centerBg.toLowerCase() === b.centerBg.toLowerCase()
  )
}

export function colorMix(hex: string, target: string, amount: number) {
  const sourceRgb = hexToRgb(hex)
  const targetRgb = hexToRgb(target)
  if (!sourceRgb || !targetRgb) return hex
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount)
  return rgbToHex(mix(sourceRgb.r, targetRgb.r), mix(sourceRgb.g, targetRgb.g), mix(sourceRgb.b, targetRgb.b))
}

export function hexToRgb(hex: string) {
  const normalized = hex.trim().replace(/^#/, '')
  if (!/^[\da-fA-F]{6}$/.test(normalized)) return null
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  }
}

export function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

export function hexToHsv(hex: string): HsvColor {
  const rgb = hexToRgb(hex) ?? { r: 0, g: 98, b: 157 }
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6)
    else if (max === g) h = 60 * ((b - r) / delta + 2)
    else h = 60 * ((r - g) / delta + 4)
  }
  if (h < 0) h += 360
  return {
    h,
    s: max === 0 ? 0 : delta / max,
    v: max,
  }
}

export function hsvToHex({ h, s, v }: HsvColor) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return rgbToHex(
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  )
}

export function getReadableColor(background: string) {
  const rgb = hexToRgb(background)
  if (!rgb) return '#ffffff'
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
  return luminance > 0.58 ? '#1a1c1e' : '#ffffff'
}
