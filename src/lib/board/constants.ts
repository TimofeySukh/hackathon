// Shared board constants: camera limits, hit-test sizes, layout/collision tuning,
// the Material tone palette, color presets and link-service options.

import type { AnimFrame, CircleTone, PersonLinkService } from './types'

export const MIN_SCALE = 0.1
export const MAX_SCALE = 4.0
// Below this zoom the board switches to a simplified "zones only" view: just the
// colored zone fills and their labels, with people, connections and centers hidden.
export const ZONE_ONLY_SCALE = 0.3

export const CONNECT_THRESHOLD = 40
export const MIN_CIRCLE_RADIUS = 72
export const EDGE_RESIZE_HIT_SIZE = 18
export const PERSON_VISUAL_RADIUS = 20
export const CIRCLE_CENTER_RADIUS = 20
export const HANDLE_HIT_RADIUS = 16
export const PERSON_CONTAINMENT_RADIUS = 28
export const CIRCLE_CONTAINMENT_PADDING = 28
// Above this many merged items, skip the O(n^2) containment relax so a huge merge
// can't freeze the tab. The new subset is pre-sized to contain everything instead.
export const MERGE_LAYOUT_LIMIT = 1000
export const PERSON_COLLISION_RADIUS = 21
export const PERSON_COLLISION_GAP = 4
export const CIRCLE_CENTER_COLLISION_RADIUS = 24
export const PERSON_CIRCLE_COLLISION_GAP = 8
export const CIRCLE_COLLISION_GAP = 4
export const COLLISION_PASSES = 10

// Side of one spatial-hash cell (world units) used by the board index.
export const BOARD_GRID_SIZE = 360

export const EMPTY_ANIM_FRAME: AnimFrame = { scales: new Map(), morphs: new Map() }

export const MATERIAL_TONES: Record<CircleTone, { fill: string; border: string; text: string; centerBg: string }> = {
  blue: { fill: '#D2E4FF', border: '#004A77', text: '#001D35', centerBg: '#00629D' },
  red: { fill: '#FFDAD6', border: '#BA1A1A', text: '#410002', centerBg: '#C00015' },
  green: { fill: '#D1E8D2', border: '#0F6D38', text: '#00210B', centerBg: '#1E824A' },
  amber: { fill: '#FFE082', border: '#B06000', text: '#2A1400', centerBg: '#D87A00' },
  violet: { fill: '#EADDFF', border: '#6750A4', text: '#21005D', centerBg: '#7F67BE' },
}

// The picker shows the first 8 of these as presets. They are deliberately
// distinct from the five quick-swatch tones (blue/red/green/amber/violet) so the
// presets add reach instead of repeating colors already one tap away.
export const CIRCLE_COLOR_PRESETS = [
  '#00897B', // teal
  '#00838F', // cyan
  '#5E35B1', // deep purple
  '#AD1457', // magenta
  '#6D4C41', // brown
  '#546E7A', // slate
  '#8AC926', // lime
  '#F95738', // coral
  // remaining options (not shown in the 8-swatch grid, kept for reuse)
  '#0B57D0',
  '#2E7D32',
  '#F57C00',
  '#455A64',
  '#F4D35E',
  '#EE964B',
  '#A23E48',
  '#6A4C93',
  '#1982C4',
  '#B8C480',
]

export const LINK_SERVICE_OPTIONS: { service: PersonLinkService; label: string; placeholder: string }[] = [
  { service: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/name' },
  { service: 'telegram', label: 'Telegram', placeholder: '@username' },
  { service: 'instagram', label: 'Instagram', placeholder: '@username' },
  { service: 'facebook', label: 'Facebook', placeholder: 'facebook.com/name' },
  { service: 'whatsapp', label: 'WhatsApp', placeholder: '+45 12 34 56 78' },
  { service: 'x', label: 'X', placeholder: '@username' },
  { service: 'website', label: 'Custom', placeholder: 'https://example.com/profile' },
]
