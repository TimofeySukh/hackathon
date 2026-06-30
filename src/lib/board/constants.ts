// Shared board constants: camera limits, hit-test sizes, layout/collision tuning,
// the Material tone palette, color presets and link-service options.

import type { AnimFrame, CircleTone, PersonLinkService } from './types'

export const MIN_SCALE = 0.04
export const MAX_SCALE = 4.0
// Below this zoom the board switches to a simplified "zones only" view: just the
// colored zone fills and their labels, with people, connections and centers hidden.
export const ZONE_ONLY_SCALE = 0.35

export const CONNECT_THRESHOLD = 40
export const MIN_CIRCLE_RADIUS = 72
export const EDGE_RESIZE_HIT_SIZE = 16
// Wider than the entry band to avoid hover flicker, but still close to the
// rendered edge so resize affordance does not feel detached from the shape.
export const EDGE_RESIZE_HIT_LEAVE_SIZE = 28
export const EDGE_HOVER_ANIM_MS = 320
export const MORPH_ANIM_MS = 380
export const COLOR_ANIM_MS = 220
export const RING_ANIM_MS = 420
export const RING_VERTEX_SPREAD_END = 0.88
export const PERSON_VISUAL_RADIUS = 20
export const CIRCLE_CENTER_RADIUS = 20
export const HANDLE_HIT_RADIUS = 16
export const FAVORITE_HALO_INSET = 5
export const CONNECTOR_HANDLE_GAP = 22
export const CONNECTOR_HANDLE_GAP_FAVORITE = 28
export const CIRCLE_LINK_CONNECTION_PREFIX = 'circle-link:'
export const MEMBERSHIP_CONNECTION_PREFIX = 'membership:'
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
// Above this many board nodes, direct pointer interactions must not run the
// global O(n^2) collision relaxer. Large imported boards are already packed, so
// drag/resize should mutate only the touched nodes and defer full layout work.
export const BOARD_INTERACTION_LAYOUT_LIMIT = 1500

// Sunflower (phyllotaxis) packing spacing for people laid out inside a circle on
// import. The golden-angle spiral's minimum nearest-neighbour distance is ~1.657x
// this (measured), so 28 keeps people at least 2*PERSON_COLLISION_RADIUS +
// PERSON_COLLISION_GAP = 46px apart — no overlap, so the O(n^2) relaxer isn't needed.
export const PERSON_PACK_SPACING = 28
// Extra slack around imported/person-packed company circles. The mathematical
// containment radius fits avatars exactly, but dense boards need visual breathing
// room for strokes, labels, and the fact that large imports skip global cleanup.
export const IMPORT_CIRCLE_RADIUS_PADDING = 18
// Above this many imported nodes (circles + people), skip the O(n^2) containment
// relax after a bulk import: the import builder already lays everything out
// non-overlapping, so running the relaxer would only freeze the tab for no gain.
// Mirrors MERGE_LAYOUT_LIMIT for the merge path.
export const IMPORT_LAYOUT_LIMIT = 1500

// Side of one spatial-hash cell (world units) used by the board index.
export const BOARD_GRID_SIZE = 360

export const EMPTY_ANIM_FRAME: AnimFrame = {
  scales: new Map(),
  liftScales: new Map(),
  morphs: new Map(),
  handleReveal: new Map(),
  favoriteReveal: new Map(),
  favoriteTilt: new Map(),
  ringReveal: new Map(),
  edgeHoverReveal: new Map(),
  colorReveal: new Map(),
}

export const MATERIAL_TONES: Record<CircleTone, { fill: string; border: string; text: string; centerBg: string }> = {
  blue: { fill: '#D2E4FF', border: '#004A77', text: '#001D35', centerBg: '#00629D' },
  red: { fill: '#FFDAD6', border: '#BA1A1A', text: '#410002', centerBg: '#C00015' },
  green: { fill: '#D1E8D2', border: '#0F6D38', text: '#00210B', centerBg: '#1E824A' },
  amber: { fill: '#FFE082', border: '#B06000', text: '#2A1400', centerBg: '#D87A00' },
  violet: { fill: '#EADDFF', border: '#6750A4', text: '#21005D', centerBg: '#7F67BE' },
}

export const CIRCLE_TONES: CircleTone[] = ['blue', 'red', 'green', 'amber', 'violet']

export function randomCircleTone(): CircleTone {
  return CIRCLE_TONES[Math.floor(Math.random() * CIRCLE_TONES.length)]
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
