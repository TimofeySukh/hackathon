import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import * as zip from '@zip.js/zip.js'
import linkedinIcon from './assets/brands/linkedin.svg'
import telegramIcon from './assets/brands/telegram.svg'
import instagramIcon from './assets/brands/instagram.svg'
import facebookIcon from './assets/brands/facebook.svg'
import whatsappIcon from './assets/brands/whatsapp.svg'
import xIcon from './assets/brands/x.svg'
import websiteIcon from './assets/brands/website.svg'
import googleIcon from './assets/brands/google.svg'
import sdnLogo from './assets/sdn-logo.svg'

zip.configure({ useWebWorkers: false })
import { cancelPendingBoardAuthReturn, consumeAuthReturnHash, hasPendingBoardAuthReturn, useAuth } from './lib/useAuth'
import LandingPage from './LandingPage'
import ContactPage from './ContactPage'
import PrivacyPage from './PrivacyPage'
import DocsPage from './DocsPage'
import { createAgentToken, getGraphApiBaseUrl, listAgentTokens, revokeAgentToken } from './lib/agentApi'
import type { AgentScope, AgentTokenRecord } from './lib/agentApi'
import { isE2EFakeAuth, supabase } from './lib/supabase'
import { GraphRevisionConflictError, loadGraphRecord, saveGraph, loadLocalGraph, saveLocalGraph } from './lib/graphPersistence'
import { enrichLinkedInProfile } from './lib/linkedinEnrichment'
import { searchGraphByQuery } from './lib/search/graphSearch'
import { mapSmartSearchResults, shouldUseSmartSearch, smartSearchGraph, type AgentSearchStep } from './lib/smartSearch'
import { OnboardingCoach } from './Onboarding'
import { getOnboardingSteps, type OnboardingSurface } from './onboardingSteps'
import type { OnboardingAction } from './onboardingSteps'
import { SelectionIndicator } from './components/SelectionIndicator'
import { M3Slider } from './components/M3Slider'
// STRESS TEST — dev-only performance harness. See src/lib/stressTest.ts.

import type {
  CircleTone,
  CircleShapeMode,
  CircleFillMode,
  CircleNode,
  CircleMorph,
  PersonNote,
  PersonLinkService,
  PersonLink,
  PersonNode,
  ShapeType,
  GraphState,
  Camera,
  DragConnector,
  MarqueeState,
  SelectedItem,
  HsvColor,
  BoardAnim,
  AnimFrame,
  Connection,
} from './lib/board/types'
import {
  MIN_SCALE,
  MAX_SCALE,
  ZONE_ONLY_SCALE,
  CONNECT_THRESHOLD,
  PERSON_CONTAINMENT_RADIUS,
  CIRCLE_CONTAINMENT_PADDING,
  CIRCLE_COLLISION_GAP,
  MERGE_LAYOUT_LIMIT,
  IMPORT_LAYOUT_LIMIT,
  BOARD_INTERACTION_LAYOUT_LIMIT,
  CIRCLE_LINK_CONNECTION_PREFIX,
  MEMBERSHIP_CONNECTION_PREFIX,
  MATERIAL_TONES,
  CIRCLE_COLOR_PRESETS,
  LINK_SERVICE_OPTIONS,
  EMPTY_ANIM_FRAME,
  EDGE_HOVER_ANIM_MS,
  COLOR_ANIM_MS,
  MORPH_ANIM_MS,
  RING_ANIM_MS,
  randomCircleTone,
} from './lib/board/constants'
import { getCircleColors, hexToHsv, hsvToHex, lerpCircleColors, circleColorsEqual } from './lib/board/colors'
import { clamp } from './lib/board/geometry'
import {
  ensureContainment,
  createFreshGraph,
  findFreeSpaceInCircle,
  getDescendantCircleIds,
  personPackOffset,
  packedCircleRadius,
  packCirclesInRings,
  resolveCircleOnlyLayoutInPlace,
  movePersonInPlace,
  resizeCircleFromPointInPlace,
} from './lib/board/layout'
import { createBoardIndex, hitTestBoard, readAnimFrame, drawBoardLayer, setBoardRepaintCallback, resolveCircleEdgeHover } from './lib/board/render'
import { makeInitials } from './lib/board/text'

export type { CircleNode, PersonNode, Connection, GraphState, CircleTone } from './lib/board/types'

// Undo history kept at module scope (not useRef) so the mutating helpers that
// read/write it aren't analyzed as accessing React refs during render. Single
// mount in this app, so a plain stack is enough; one snapshot per user action.
const MAX_UNDO_STEPS = 100
const undoHistory: GraphState[] = []

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const DRAG_START_THRESHOLD = 5
const MAX_PAN_INERTIA_VELOCITY = 1.45

function limitPanVelocity(x: number, y: number) {
  const speed = Math.hypot(x, y)
  if (speed <= MAX_PAN_INERTIA_VELOCITY) return { x, y }
  const ratio = MAX_PAN_INERTIA_VELOCITY / speed
  return { x: x * ratio, y: y * ratio }
}

function shouldRunGlobalInteractionLayout(state: GraphState) {
  return state.circles.length + state.people.length <= BOARD_INTERACTION_LAYOUT_LIMIT
}

function settleInteractionGraph(state: GraphState) {
  return shouldRunGlobalInteractionLayout(state) ? ensureContainment(state) : state
}

function graphHasConnectionBetween(state: GraphState, fromId: string, toId: string) {
  if (fromId === toId) return true
  const matchesPair = (a: string | null | undefined, b: string | null | undefined) =>
    (a === fromId && b === toId) || (a === toId && b === fromId)

  if ((state.connections || []).some((conn) => matchesPair(conn.fromId, conn.toId))) return true
  if (state.people.some((person) => matchesPair(person.id, person.circleId))) return true
  return state.circles.some((circle) => matchesPair(circle.id, circle.connectedTo))
}

function appendGraphConnection(state: GraphState, fromId: string, toId: string): GraphState {
  if (graphHasConnectionBetween(state, fromId, toId)) return state
  return {
    ...state,
    connections: [
      ...(state.connections || []),
      {
        id: `conn-${Date.now()}`,
        fromId,
        toId,
      },
    ],
  }
}

function isGraphState(value: unknown): value is GraphState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<GraphState>
  return (
    Array.isArray(candidate.circles) &&
    Array.isArray(candidate.people) &&
    Array.isArray(candidate.connections)
  )
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (!error || typeof error !== 'object') return String(error)

  const details = error as Record<string, unknown>
  const parts = [
    typeof details.message === 'string' ? details.message : null,
    typeof details.details === 'string' ? details.details : null,
    typeof details.hint === 'string' ? details.hint : null,
    typeof details.code === 'string' ? `code ${details.code}` : null,
  ].filter(Boolean)

  if (parts.length > 0) return parts.join(' ')

  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

type CreateMenu = {
  sourceCircleId: string
  x: number
  y: number
  screenX: number
  screenY: number
  dragSourceId?: string
  dragSourceType?: 'circle' | 'person'
}

type SearchResult = {
  kind: 'person' | 'circle' | 'linkedin-profile'
  id: string
  name: string
  sub: string
  aiReason?: string
  avatarUrl?: string
  initials?: string
  color?: string
}

type LinkedInProfileImport = {
  url: string
  slug: string
  name: string
  company: string
  companyLogoUrl?: string
  headline: string
  description?: string
  avatarUrl?: string
  source: 'provider' | 'cache' | 'preview' | 'fallback'
}

type LinkedInConnectionsImportResult = {
  graph: GraphState
  importedPeople: number
  importedCompanies: number
}

type LinkedInConnectionsHeaders = {
  firstNameIdx: number
  lastNameIdx: number
  companyIdx: number
  positionIdx: number
  urlIdx: number
  emailIdx: number
  connectedOnIdx: number
}

type PanState = {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  lastX: number
  lastY: number
  lastT: number
  velocityX: number
  velocityY: number
  moved: boolean
}

type PinchState = {
  initialDist: number
  initialMid: { x: number; y: number }
  initialCamera: Camera
  midWorld: { x: number; y: number }
}

type MoveCircleState = {
  pointerId: number
  circleId: string
  startX: number
  startY: number
  originX: number
  originY: number
  circleOrigins?: Record<string, { x: number; y: number }>
  personOrigins?: Record<string, { x: number; y: number }>
  disconnectedCircleIds?: string[]
  liftIds: string[]
  liftStarted: boolean
  moved: boolean
  graphSnapshot?: GraphState
  lastX: number
  lastY: number
}

type MovePersonState = {
  pointerId: number
  personId: string
  startX: number
  startY: number
  originX: number
  originY: number
  selectedOrigins?: Record<string, { x: number; y: number }>
  // Mixed selection: zones (and their contents) dragged along with the people.
  circleOrigins?: Record<string, { x: number; y: number }>
  liftIds: string[]
  liftStarted: boolean
  moved: boolean
  graphSnapshot?: GraphState
  lastX: number
  lastY: number
}

type ResizeCircleState = {
  pointerId: number
  circleId: string
  startX?: number
  startY?: number
  graphSnapshot?: GraphState
}

function inferLinkService(rawValue: string): PersonLinkService {
  const value = rawValue.trim().toLowerCase()
  if (value.includes('linkedin.com')) return 'linkedin'
  if (value.includes('t.me') || value.includes('telegram.me')) return 'telegram'
  if (value.includes('instagram.com')) return 'instagram'
  if (value.includes('facebook.com') || value.includes('fb.com')) return 'facebook'
  if (value.includes('wa.me') || value.includes('whatsapp.com')) return 'whatsapp'
  if (value.includes('x.com') || value.includes('twitter.com')) return 'x'
  if (value.startsWith('@')) return 'telegram'
  if (/^\+?[\d\s().-]{7,}$/.test(value)) return 'whatsapp'
  return 'website'
}

function normalizeLinkInput(rawValue: string, service: PersonLinkService): { label: string; url: string } {
  const value = rawValue.trim()
  const cleanHandle = value.replace(/^@/, '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
  if (service === 'telegram') {
    const handle = cleanHandle.replace(/^t\.me\//, '').replace(/^telegram\.me\//, '')
    return { label: `@${handle}`, url: `https://t.me/${handle}` }
  }
  if (service === 'instagram') {
    const handle = cleanHandle.replace(/^instagram\.com\//, '')
    return { label: `@${handle}`, url: `https://instagram.com/${handle}` }
  }
  if (service === 'x') {
    const handle = cleanHandle.replace(/^x\.com\//, '').replace(/^twitter\.com\//, '')
    return { label: `@${handle}`, url: `https://x.com/${handle}` }
  }
  if (service === 'whatsapp') {
    const digits = value.replace(/[^\d+]/g, '')
    return { label: digits || value, url: digits ? `https://wa.me/${digits.replace(/^\+/, '')}` : value }
  }
  if (service === 'linkedin') {
    const url = /^https?:\/\//i.test(value) ? value : `https://${cleanHandle}`
    return { label: cleanHandle.replace(/^linkedin\.com\/in\//, ''), url }
  }
  if (service === 'facebook') {
    const url = /^https?:\/\//i.test(value) ? value : `https://${cleanHandle}`
    return { label: cleanHandle.replace(/^facebook\.com\//, '').replace(/^fb\.com\//, ''), url }
  }
  return {
    label: cleanHandle || value,
    url: /^https?:\/\//i.test(value) ? value : `https://${value}`,
  }
}

function normalizeLinkedInProfileUrl(rawValue: string): string | null {
  const value = extractLinkedInProfileUrlCandidate(rawValue)
  if (!value) return null
  const withProtocol = /^https?:\/\//i.test(value)
    ? value
    : value.toLowerCase().startsWith('ps://')
      ? `htt${value}`
      : `https://${value}`
  try {
    const url = new URL(withProtocol)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return null
    const pathParts = url.pathname.split('/').filter(Boolean)
    if (!['in', 'pub'].includes(pathParts[0] ?? '') || !pathParts[1]) return null
    return `https://www.linkedin.com/${pathParts[0]}/${pathParts[1]}/`
  } catch {
    return null
  }
}

function extractLinkedInProfileUrlCandidate(rawValue: string) {
  const value = rawValue.trim()
  if (!value) return ''
  const match = value.match(/(?:(?:https?|ps):\/\/)?(?:[\w-]+\.)?linkedin\.com\/(?:in|pub)\/[^\s"'<>]+/i)
  return (match?.[0] ?? value).replace(/[),.;]+$/, '')
}

function getLinkedInProfileImportUrl(rawValue: string) {
  const normalized = normalizeLinkedInProfileUrl(rawValue)
  if (normalized) return normalized

  const value = rawValue.trim()
  const slugMatch = value.match(/linkedin\.com\/(?:in|pub)\/([^/\s"'<>?#]+)/i)
  if (!slugMatch?.[1]) return null
  return `https://www.linkedin.com/in/${slugMatch[1].replace(/[),.;]+$/, '')}/`
}

function getLinkedInSlug(profileUrl: string) {
  try {
    const url = new URL(profileUrl)
    return url.pathname.split('/').filter(Boolean)[1] ?? 'profile'
  } catch {
    return 'profile'
  }
}

function titleCaseSlug(slug: string) {
  return slug
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}

const LINKEDIN_COMPANY_TONES: CircleTone[] = ['red', 'green', 'amber', 'violet', 'blue']

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

function toneForLinkedInCompany(companyId: string): CircleTone {
  if (companyId === 'linkedin-company-socialdatanode') return 'blue'
  return LINKEDIN_COMPANY_TONES[hashString(companyId) % LINKEDIN_COMPANY_TONES.length]
}

function shouldRecolorLegacyLinkedInCompany(circle: CircleNode) {
  return circle.id.startsWith('linkedin-company-') &&
    circle.id !== 'linkedin-company-socialdatanode' &&
    circle.tone === 'blue' &&
    !circle.customColor
}

function parseLinkedInTitle(title: string) {
  const cleanTitle = title.replace(/\s*\|\s*LinkedIn\s*$/i, '').trim()
  const parts = cleanTitle.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean)
  return {
    name: parts[0] ?? '',
    headline: parts.slice(1).join(' - '),
    company: parts.length >= 3 ? parts[parts.length - 1] : '',
  }
}

function getMetaContent(document: Document, property: string) {
  return (
    document.querySelector(`meta[property="${property}"]`)?.getAttribute('content') ??
    document.querySelector(`meta[name="${property}"]`)?.getAttribute('content') ??
    ''
  ).trim()
}

async function fetchLinkedInProfileMetadata(profileUrl: string): Promise<Partial<LinkedInProfileImport>> {
  try {
    const response = await fetch(profileUrl, { credentials: 'omit' })
    if (!response.ok) return {}
    const html = await response.text()
    const document = new DOMParser().parseFromString(html, 'text/html')
    const title = getMetaContent(document, 'og:title') || document.title
    const description = getMetaContent(document, 'og:description')
    const parsedTitle = parseLinkedInTitle(title)
    return {
      name: parsedTitle.name,
      headline: parsedTitle.headline || description,
      company: parsedTitle.company,
      avatarUrl: getMetaContent(document, 'og:image') || undefined,
    }
  } catch {
    return {}
  }
}

async function buildLinkedInProfileImport(rawValue: string): Promise<LinkedInProfileImport | null> {
  const url = normalizeLinkedInProfileUrl(rawValue)
  if (!url) return null
  const slug = getLinkedInSlug(url)
  const enrichment = await enrichLinkedInProfile(url)
  const needsPreviewFallback = !enrichment || !enrichment.name || (!enrichment.company && !enrichment.headline) || !enrichment.avatarUrl
  const metadata = needsPreviewFallback ? await fetchLinkedInProfileMetadata(url) : {}
  const fallbackName = titleCaseSlug(slug)
  const name = (enrichment?.name || metadata.name || fallbackName || 'LinkedIn Connection').trim()
  const company = (enrichment?.company || metadata.company || 'Unknown Company').trim()
  const headline = (enrichment?.headline || metadata.headline || company || 'LinkedIn connection').trim()
  const description = enrichment?.description?.trim()
  const source = enrichment?.source ?? (metadata.name || metadata.company || metadata.headline || metadata.avatarUrl ? 'preview' : 'fallback')
  return {
    url,
    slug,
    name,
    company,
    companyLogoUrl: enrichment?.companyLogoUrl,
    headline,
    description,
    avatarUrl: enrichment?.avatarUrl || metadata.avatarUrl,
    source,
  }
}

const authOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--md-surface-container-low, #eef1f3)',
}

const authCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '16px',
  padding: '32px',
  borderRadius: '24px',
  background: 'var(--md-surface, #fff)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
  maxWidth: '320px',
}

const LINKEDIN_GUIDE_HINT_KEY = 'social-linkedin-guide-hint-seen-v1'
const PERSON_DOUBLE_TAP_MS = 350
const PERSON_DOUBLE_TAP_DISTANCE = 28
const SEARCH_LINKEDIN_HINT_KEY = 'social-search-linkedin-hint-seen-v1'
const BOARD_ONBOARDING_STORAGE_KEY = 'social-board-onboarding-done-v3'
const BOARD_ONBOARDING_FORCE_KEY = 'social-board-onboarding-open-v3'
const ONBOARDING_COMPLETE_DELAY_MS = 1000
const ONBOARDING_LINKEDIN_EXAMPLES = [
  {
    name: 'Timofey Sukhov',
    role: 'CEO',
    url: 'https://www.linkedin.com/in/timofey-sukhov-775b38404/',
    avatarUrl: '/timofey_avatar.jpeg',
  },
  {
    name: 'Velizar Seleznev',
    role: 'CTO',
    url: 'https://www.linkedin.com/in/velizar-seleznev/',
    avatarUrl: '/velizar_avatar.jpeg',
  },
] as const
const CIRCLE_CREATION_DEFAULTS_KEY = 'hackathon-board:circle-creation-defaults:v1'
type BoardToolMode = 'edit' | 'pan' | 'select'

type CircleCreationDefaults = {
  fillMode: CircleFillMode
  shapeType: ShapeType
  sides: number
  amplitude: number
}

const DEFAULT_CIRCLE_CREATION_DEFAULTS: CircleCreationDefaults = {
  fillMode: 'transparent',
  shapeType: 'circle',
  sides: 25,
  amplitude: 0,
}

function loadCircleCreationDefaults(): CircleCreationDefaults {
  try {
    window.localStorage.removeItem(CIRCLE_CREATION_DEFAULTS_KEY)
  } catch {
    // ignore
  }
  return DEFAULT_CIRCLE_CREATION_DEFAULTS
}

function hasLocalFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function markLocalFlag(key: string) {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    // ignore
  }
}

function consumeSessionFlag(key: string): boolean {
  try {
    const value = window.sessionStorage.getItem(key) === '1'
    window.sessionStorage.removeItem(key)
    return value
  } catch {
    return false
  }
}

function isTouchBoardLayout(): boolean {
  return window.matchMedia('(hover: none), (pointer: coarse), (max-width: 720px)').matches
}


function AuthPrivacyNotice({ onOpenPrivacy }: { onOpenPrivacy: () => void }) {
  return (
    <p className="auth-card__privacy">
      By creating an account, you agree to our{' '}
      <a
        href="#privacy"
        onClick={(event) => {
          event.preventDefault()
          onOpenPrivacy()
        }}
      >
        Privacy Policy
      </a>
      .
    </p>
  )
}

function resolveViewModeFromLocation(options: { includePendingAuthReturn?: boolean } = {}): 'landing' | 'board' | 'docs' | 'contact' | 'privacy' {
  const hash = window.location.hash
  if (hash === '#board') return 'board'
  if (hash === '#docs' || hash.startsWith('#docs/')) return 'docs'
  if (hash === '#contact') return 'contact'
  if (hash === '#privacy') return 'privacy'
  if (options.includePendingAuthReturn && hasPendingBoardAuthReturn()) return 'board'
  return 'landing'
}

function App() {
  const [viewMode, setViewMode] = useState<'landing' | 'board' | 'docs' | 'contact' | 'privacy'>(() =>
    resolveViewModeFromLocation({ includePendingAuthReturn: true })
  );

  useEffect(() => {
    const handleHashChange = () => {
      const nextViewMode = resolveViewModeFromLocation()
      if (nextViewMode !== 'board') cancelPendingBoardAuthReturn()
      setViewMode(nextViewMode);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const surfaceRef = useRef<HTMLDivElement | null>(null)
  // Canvas 2D board renderer: circles, edges, people, labels, and interaction chrome.
  const peopleCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const panRef = useRef<PanState | null>(null)
  const moveCircleRef = useRef<MoveCircleState | null>(null)
  const movePersonRef = useRef<MovePersonState | null>(null)
  const resizeCircleRef = useRef<ResizeCircleState | null>(null)
  const activePointersRef = useRef<PointerEvent[]>([])
  const pinchRef = useRef<PinchState | null>(null)
  const marqueeRef = useRef<MarqueeState | null>(null)
  const isRightClickDragRef = useRef(false)
  const rightClickMarqueeMovedRef = useRef(false)
  // Drag updates are coalesced to one React commit per animation frame (like the
  // pan/zoom gesture) so a move event flood doesn't trigger a re-render storm.
  const dragRafRef = useRef<number | null>(null)
  const pendingGraphRef = useRef<((current: GraphState) => GraphState) | null>(null)
  const panInertiaRafRef = useRef<number | null>(null)
  const panInertiaLastTRef = useRef(0)
  const cameraBitmapCacheRef = useRef<{
    canvas: HTMLCanvasElement
    startCamera: Camera
    pad: number
    cssWidth: number
    cssHeight: number
    dpr: number
  } | null>(null)
  const loadedGraphSourceRef = useRef<'saved' | 'empty' | 'local' | 'error'>('empty')
  const loadedGraphSnapshotRef = useRef<string | null>(null)
  const loadedGraphRevisionRef = useRef<number | null>(null)
  const pendingSaveGraphRef = useRef<GraphState | null>(null)
  const pendingSaveSnapshotRef = useRef<string | null>(null)
  const [saveEpoch, bumpSaveEpoch] = useState(0)
  const graphChannelId = useId()
  const pendingConnectorRef = useRef<DragConnector | null>(null)
  // Start from a blank board (just the "you" circle), never the old demo seed.
  // The real graph replaces this once loaded; keeping demo data here caused it to
  // flash for a few frames on some reloads before the loaded graph took over.
  const [graph, setGraph] = useState(createFreshGraph)
  // True once the current drag/resize gesture has recorded its undo snapshot.
  // Only touched from pointer event handlers, never during render.
  const gestureSnapshotTakenRef = useRef(false)
  const [pressingSwatchId, setPressingSwatchId] = useState<string | null>(null)
  const [returningSwatchId, setReturningSwatchId] = useState<string | null>(null)
  const pressingSwatchTimeRef = useRef<number>(0)
  const pressingSwatchIdRef = useRef<string | null>(null)
  const swatchPressTxRef = useRef<number>(0)
  const auth = useAuth()
  const userId = auth.session?.user?.id ?? null

  // Redirect only authenticated auth callback returns to the board. A normal signed-in
  // visitor can still open and stay on the landing/docs/contact/privacy pages.
  useEffect(() => {
    if (auth.status !== 'authenticated') return

    const authReturnHash = consumeAuthReturnHash()
    if (authReturnHash) {
      window.location.hash = authReturnHash
    }
  }, [auth.status])

  // Sign-in dialog: a single "Sign in" button opens this; it holds every
  // sign-in option so the Settings panel itself stays compact.
  const [showSignInModal, setShowSignInModal] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [newPasswordInput, setNewPasswordInput] = useState('')
  const [emailAuthMode, setEmailAuthMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [emailAuthBusy, setEmailAuthBusy] = useState(false)
  const [emailAuthAction, setEmailAuthAction] = useState<'submit' | 'resend' | null>(null)
  const [emailAuthNotice, setEmailAuthNotice] = useState<string | null>(null)
  const [emailAuthError, setEmailAuthError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [agentTokens, setAgentTokens] = useState<AgentTokenRecord[]>([])
  const [agentTokenName, setAgentTokenName] = useState('AI agent')
  const [newAgentToken, setNewAgentToken] = useState<string | null>(null)
  const [agentTokenStatus, setAgentTokenStatus] = useState<string | null>(null)
  const [agentTokensBusy, setAgentTokensBusy] = useState(false)
  const [agentSettingsTab, setAgentSettingsTab] = useState<'quick' | 'mcp' | 'cli' | 'api' | 'keys'>('quick')

  const defaultAgentScopes: AgentScope[] = ['graph:read', 'search:read', 'people:write', 'notes:write', 'links:write', 'connections:write']

  const refreshAgentTokens = async () => {
    if (!auth.session) return
    setAgentTokensBusy(true)
    setAgentTokenStatus(null)
    try {
      const tokens = await listAgentTokens(auth.session)
      setAgentTokens(tokens.filter((token) => !token.revoked_at))
    } catch (error) {
      setAgentTokenStatus(error instanceof Error ? error.message : 'Could not load agent tokens.')
    } finally {
      setAgentTokensBusy(false)
    }
  }

  const handleCreateAgentToken = async () => {
    if (!auth.session || agentTokensBusy) return
    setAgentTokensBusy(true)
    setAgentTokenStatus(null)
    setNewAgentToken(null)
    try {
      const created = await createAgentToken(auth.session, agentTokenName.trim() || 'AI agent', defaultAgentScopes)
      setNewAgentToken(created.token)
      setAgentTokens((current) => [created.record, ...current])
      setAgentTokenStatus('Token created. Copy it now; it will not be shown again.')
    } catch (error) {
      setAgentTokenStatus(error instanceof Error ? error.message : 'Could not create agent token.')
    } finally {
      setAgentTokensBusy(false)
    }
  }

  const handleRevokeAgentToken = async (tokenId: string) => {
    if (!auth.session || agentTokensBusy) return
    setAgentTokensBusy(true)
    setAgentTokenStatus(null)
    try {
      await revokeAgentToken(auth.session, tokenId)
      setAgentTokens((current) => current.filter((token) => token.id !== tokenId))
    } catch (error) {
      setAgentTokenStatus(error instanceof Error ? error.message : 'Could not revoke agent token.')
    } finally {
      setAgentTokensBusy(false)
    }
  }

  const handleCopyAgentText = async (value: string, notice: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setAgentTokenStatus(notice)
    } catch {
      setAgentTokenStatus('Could not copy automatically. Select the text and copy it manually.')
    }
  }

  const openSignInModal = () => {
    setEmailAuthMode('signin')
    setEmailAuthNotice(null)
    setEmailAuthError(null)
    auth.clearError()
    setShowSignInModal(true)
  }

  const handleEmailAuthSubmit = async () => {
    const email = emailInput.trim()
    const isRecoveryUpdate = auth.isPasswordRecovery

    if (emailAuthBusy) return
    if (isRecoveryUpdate) {
      if (passwordInput.length < 8 || passwordInput !== newPasswordInput) return
    } else if (emailAuthMode === 'reset') {
      if (!email) return
    } else if (!email || !passwordInput) {
      return
    }
    if (emailAuthMode === 'signup' && passwordInput.length < 8) return

    setEmailAuthBusy(true)
    setEmailAuthAction('submit')
    setEmailAuthNotice(null)
    setEmailAuthError(null)
    auth.clearError()
    try {
      if (isRecoveryUpdate) {
        const { error } = await auth.updatePassword(passwordInput)
        if (error) {
          setEmailAuthError('Could not update the password. Try again from a fresh reset link.')
          return
        }
        setEmailAuthNotice('Password updated. You are signed in.')
        setPasswordInput('')
        setNewPasswordInput('')
      } else if (emailAuthMode === 'signup') {
        const { error, needsConfirmation } = await auth.signUpWithEmail(email, passwordInput)
        if (error) {
          setEmailAuthError(error)
          return
        }
        if (!error && needsConfirmation) {
          setEmailAuthNotice('Check your email to confirm your account. You can close this and keep editing locally.')
          setPasswordInput('')
          return
        }
        setShowSignInModal(false)
        setPasswordInput('')
      } else if (emailAuthMode === 'reset') {
        const { error } = await auth.sendPasswordReset(email)
        if (error) {
          setEmailAuthNotice('If that email can receive a reset link, we will send one. Try again in a few minutes if it does not arrive.')
        } else {
          setEmailAuthNotice('If an account exists for that email, a reset link is on the way.')
        }
      } else {
        const { error } = await auth.signInWithEmail(email, passwordInput)
        if (error) {
          setEmailAuthError('Email or password is incorrect.')
          return
        }
        if (!error) {
          setShowSignInModal(false)
          setPasswordInput('')
        }
      }
    } finally {
      setEmailAuthBusy(false)
      setEmailAuthAction(null)
    }
  }

  const handleResendConfirmation = async () => {
    const email = emailInput.trim()
    if (!email || emailAuthBusy) return
    setEmailAuthBusy(true)
    setEmailAuthAction('resend')
    setEmailAuthError(null)
    auth.clearError()
    try {
      const { error } = await auth.resendConfirmation(email)
      if (error) {
        setEmailAuthError('Could not resend the confirmation email. Try again in a few minutes.')
      } else {
        setEmailAuthNotice('Confirmation email sent again.')
      }
    } finally {
      setEmailAuthBusy(false)
      setEmailAuthAction(null)
    }
  }
  // True once we've pulled this user's saved graph (or confirmed they have none).
  // The board stays hidden until then so the demo seed never flashes or gets saved.
  const [graphLoaded, setGraphLoaded] = useState(false)
  const [graphLoadError, setGraphLoadError] = useState<string | null>(null)
  // Bumped when an avatar image finishes decoding, to force a board repaint.
  const [imageEpoch, setImageEpoch] = useState(0)

  useEffect(() => {
    setBoardRepaintCallback(() => setImageEpoch((epoch) => epoch + 1))
    return () => {
      setBoardRepaintCallback(null)
    }
  }, [])

  useEffect(() => {
    if (!('BroadcastChannel' in window)) return undefined
    if (auth.status !== 'authenticated' || !userId) return undefined
    const channel = new BroadcastChannel(`social-datanode-graph:${userId}`)
    channel.onmessage = (event: MessageEvent<{ sourceId?: string; revision?: number }>) => {
      if (event.data?.sourceId === graphChannelId) return
      const incomingRevision = event.data?.revision
      if (typeof incomingRevision !== 'number') return
      const currentRevision = loadedGraphRevisionRef.current
      if (currentRevision !== null && incomingRevision > currentRevision) {
        loadedGraphSourceRef.current = 'error'
        setGraphLoadError('This board changed in another tab or through an agent. To protect your data, reload before making more changes.')
      }
    }
    return () => channel.close()
  }, [auth.status, graphChannelId, userId])

  const broadcastGraphRevision = useCallback((userIdValue: string, revision: number | null) => {
    if (!('BroadcastChannel' in window) || revision === null) return
    const channel = new BroadcastChannel(`social-datanode-graph:${userIdValue}`)
    channel.postMessage({ sourceId: graphChannelId, revision })
    channel.close()
  }, [graphChannelId])

  const clearPendingSave = useCallback((graphJson: string | null = null) => {
    if (graphJson === null || pendingSaveSnapshotRef.current === graphJson) {
      pendingSaveGraphRef.current = null
      pendingSaveSnapshotRef.current = null
      bumpSaveEpoch((epoch) => epoch + 1)
    }
  }, [])

  const graphRef = useRef(graph)
  useEffect(() => {
    graphRef.current = graph
  }, [graph])

  // Listen to remote changes on the user's graph row via Supabase Realtime
  useEffect(() => {
    if (isE2EFakeAuth) return
    if (auth.status !== 'authenticated' || !userId || !supabase || !auth.session) return

    const channel = supabase
      .channel(`user-graph-changes:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_graphs',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newRevision = payload.new?.revision
          const newGraphData = payload.new?.graph

          if (typeof newRevision !== 'number' || !newRevision || !newGraphData) return

          // If the revision is equal or smaller, ignore it (it was written by this tab or is stale)
          if (newRevision <= (loadedGraphRevisionRef.current ?? 0)) {
            return
          }

          const base = sanitizeDefaultCircleStyles(newGraphData)
          const stamped = stampYouIdentity(base, auth.session!.user)
          const incomingSnapshot = JSON.stringify(stamped)
          const pendingSaveGraph = pendingSaveGraphRef.current

          if (pendingSaveGraph && isGraphStateEqual(stamped, pendingSaveGraph)) {
            loadedGraphSourceRef.current = 'saved'
            loadedGraphSnapshotRef.current = incomingSnapshot
            loadedGraphRevisionRef.current = newRevision
            clearPendingSave(pendingSaveSnapshotRef.current)
            return
          }

          // Check if there are local unsaved modifications
          const isUnsaved = (() => {
            if (!loadedGraphSnapshotRef.current) return false
            try {
              const snap = JSON.parse(loadedGraphSnapshotRef.current) as GraphState
              return !isGraphStateEqual(graphRef.current, snap)
            } catch {
              return true
            }
          })()

          if (!isUnsaved) {
            // No unsaved modifications: automatically apply the update in real-time
            loadedGraphSourceRef.current = 'saved'
            loadedGraphSnapshotRef.current = incomingSnapshot
            loadedGraphRevisionRef.current = newRevision
            setGraph(stamped)
          } else {
            // There are unsaved changes: notify the user and enter error state to protect local edits
            loadedGraphSourceRef.current = 'error'
            setGraphLoadError(
              'This board was updated elsewhere (e.g. via CLI or another tab). You have unsaved changes. To protect your data, reload the page to load the latest version.'
            )
          }
        }
      )
      .subscribe()

    return () => {
      void channel.unsubscribe()
    }
  }, [auth.status, userId, auth.session, clearPendingSave])

  // Load the signed-in user's graph; a brand-new account starts from a blank
  // canvas with only their "you" circle — the local demo data is never persisted.
  useEffect(() => {
    if (auth.status !== 'authenticated' || !userId || !auth.session) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGraphLoaded(false)
    setGraphLoadError(null)
    loadGraphRecord(userId)
      .then((loaded) => {
        if (cancelled) return
        const base = sanitizeDefaultCircleStyles(loaded.graph ?? createFreshGraph())
        const stamped = stampYouIdentity(base, auth.session!.user)
        loadedGraphSourceRef.current = loaded.source
        loadedGraphSnapshotRef.current = JSON.stringify(stamped)
        loadedGraphRevisionRef.current = loaded.revision
        clearPendingSave()
        setGraph(stamped)
        setGraphLoaded(true)
      })
      .catch((error) => {
        console.error('Failed to load graph', error)
        if (!cancelled) {
          const stamped = stampYouIdentity(createFreshGraph(), auth.session!.user)
          loadedGraphSourceRef.current = 'error'
          loadedGraphSnapshotRef.current = JSON.stringify(stamped)
          loadedGraphRevisionRef.current = null
          clearPendingSave()
          setGraphLoadError('Failed to load your board from the database. To protect your data, changes will not be saved. Please reload the page.')
          setGraph(stamped)
          setGraphLoaded(true)
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, userId])

  // Debounced autosave: a flood of drags or a bulk import collapses into one write.
  useEffect(() => {
    if (!graphLoaded || auth.status !== 'authenticated' || !userId) return
    if (loadedGraphSourceRef.current === 'error') return
    if (loadedGraphSourceRef.current === 'local') return
    const graphJson = JSON.stringify(graph)
    if (loadedGraphSnapshotRef.current === graphJson) return
    if (loadedGraphSnapshotRef.current) {
      try {
        const snap = JSON.parse(loadedGraphSnapshotRef.current) as GraphState
        if (isGraphStateEqual(graph, snap)) {
          loadedGraphSnapshotRef.current = graphJson
          return
        }
      } catch {
        // Fall through and attempt to save the current valid graph.
      }
    }
    if (pendingSaveSnapshotRef.current !== null) return
    const timer = window.setTimeout(() => {
      pendingSaveGraphRef.current = graph
      pendingSaveSnapshotRef.current = graphJson
      void saveGraph(userId, graph, loadedGraphRevisionRef.current)
        .then((nextRevision) => {
          loadedGraphRevisionRef.current = nextRevision
          loadedGraphSourceRef.current = 'saved'
          loadedGraphSnapshotRef.current = graphJson
          clearPendingSave(graphJson)
          broadcastGraphRevision(userId, nextRevision)
        })
        .catch((error) => {
          clearPendingSave(graphJson)
          if (error instanceof GraphRevisionConflictError) {
            loadedGraphSourceRef.current = 'error'
            setGraphLoadError('This board changed in another tab or through an agent. To protect your data, reload before making more changes.')
            return
          }
          console.error('Failed to save graph', error)
        })
    }, 800)
    return () => window.clearTimeout(timer)
  }, [graph, graphLoaded, auth.status, broadcastGraphRevision, clearPendingSave, saveEpoch, userId])

  // Signed-out visitors aren't blocked: their board is restored from (and saved
  // to) localStorage so work survives a reload without an account. Signing in
  // takes over with the Supabase-backed graph via the effects above.
  const isLocalMode = auth.status === 'anonymous' || auth.status === 'unconfigured'

  useEffect(() => {
    if (!isLocalMode) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGraphLoaded(false)
    setGraphLoadError(null)
    const saved = loadLocalGraph()
    if (saved) {
      const sanitized = sanitizeDefaultCircleStyles(saved)
      loadedGraphSourceRef.current = 'local'
      loadedGraphSnapshotRef.current = JSON.stringify(sanitized)
      loadedGraphRevisionRef.current = null
      setGraph(sanitized)
    } else {
      loadedGraphSourceRef.current = 'empty'
      loadedGraphSnapshotRef.current = JSON.stringify(graph)
      loadedGraphRevisionRef.current = null
    }
    setGraphLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocalMode])

  // Debounced local autosave for signed-out visitors.
  useEffect(() => {
    if (!graphLoaded || !isLocalMode) return
    const timer = window.setTimeout(() => {
      saveLocalGraph(graph)
    }, 800)
    return () => window.clearTimeout(timer)
  }, [graph, graphLoaded, isLocalMode])

  async function persistGraphImmediately(nextGraph: GraphState) {
    if (auth.status === 'authenticated' && userId) {
      try {
        const graphJson = JSON.stringify(nextGraph)
        pendingSaveGraphRef.current = nextGraph
        pendingSaveSnapshotRef.current = graphJson
        const nextRevision = await saveGraph(userId, nextGraph, loadedGraphRevisionRef.current)
        loadedGraphRevisionRef.current = nextRevision
        loadedGraphSourceRef.current = 'saved'
        loadedGraphSnapshotRef.current = graphJson
        clearPendingSave(graphJson)
        setGraph(nextGraph)
        broadcastGraphRevision(userId, nextRevision)
      } catch (error) {
        clearPendingSave(JSON.stringify(nextGraph))
        if (error instanceof GraphRevisionConflictError) {
          loadedGraphSourceRef.current = 'error'
          setGraphLoadError('This board changed in another tab or through an agent. To protect your data, reload before making more changes.')
        }
        throw error
      }
      return
    }

    if (isLocalMode) {
      saveLocalGraph(nextGraph)
      loadedGraphSourceRef.current = 'local'
      loadedGraphSnapshotRef.current = JSON.stringify(nextGraph)
      clearPendingSave()
    }
    setGraph(nextGraph)
  }

  const [camera, setCamera] = useState<Camera>({ x: window.innerWidth / 2, y: window.innerHeight / 2, scale: 0.82 })
  // cameraRef holds the *live* camera during a pan/zoom gesture. `camera` state
  // is only the last *settled* value (committed when the gesture stops moving).
  const cameraRef = useRef(camera)
  // Gesture machinery: during a pan/zoom we drive the DOM transform + canvas
  // imperatively (no React re-render), then commit to state once it settles.
  const gestureActiveRef = useRef(false)
  const gestureRafRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const driveCameraRef = useRef<(next: Camera) => void>(() => {})
  const settleGestureRef = useRef<() => void>(() => {})

  // Transient board animations (node pop-in). Each entry runs a short rAF loop
  // that repaints the canvas with interpolated progress, then self-prunes.
  // paintBoardRef always points at the latest paint closure so the loop repaints
  // with current state. animNowRef holds the most recent rAF timestamp so a
  // state-driven repaint mid-animation can compute progress without reading the
  // clock during render. See readAnimFrame / drawBoardLayer.
  const boardAnimsRef = useRef<Map<string, BoardAnim>>(new Map())
  const boardAnimRafRef = useRef<number | null>(null)
  const animNowRef = useRef(0)
  const paintBoardRef = useRef<(now?: number) => void>(() => {})
  const pressedNodeIdsRef = useRef<Set<string>>(new Set())
  const liftedNodeIdsRef = useRef<Set<string>>(new Set())
  const suppressDoubleClickUntilRef = useRef(0)
  const lastPersonTapRef = useRef<{ personId: string; time: number; x: number; y: number } | null>(null)
  const inspectorNameInputRef = useRef<HTMLInputElement>(null)
  const pendingInspectorNameFocusPersonIdRef = useRef<string | null>(null)
  const handleExitNodesRef = useRef<Map<string, CircleNode | PersonNode>>(new Map())
  const prevSelectionRef = useRef<SelectedItem>(null)
  const ringCircleIdRef = useRef<string | null>(null)
  const edgeHoverCircleIdRef = useRef<string | null>(null)



  const [connector, setConnector] = useState<DragConnector | null>(null)
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [createMenu, setCreateMenu] = useState<CreateMenu | null>(null)
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null)
  const [renderedInspectorItem, setRenderedInspectorItem] = useState<SelectedItem>(null)
  const [isInspectorOpen, setIsInspectorOpen] = useState(false)
  const isInspectorOpenRef = useRef(false)
  const inspectorCloseTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    isInspectorOpenRef.current = isInspectorOpen
  }, [isInspectorOpen])

  useEffect(() => {
    if (selectedItem) {
      if (inspectorCloseTimeoutRef.current !== null) {
        window.clearTimeout(inspectorCloseTimeoutRef.current)
        inspectorCloseTimeoutRef.current = null
      }

      const stayOpen = isInspectorOpenRef.current && renderedInspectorItem !== null
      setRenderedInspectorItem(selectedItem)

      if (stayOpen) {
        setIsInspectorOpen(true)
        return
      }

      setIsInspectorOpen(false)
      const openFrame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setIsInspectorOpen(true))
      })
      return () => window.cancelAnimationFrame(openFrame)
    }
    setIsInspectorOpen(false)
    // Match the 220ms CSS transition duration
    inspectorCloseTimeoutRef.current = window.setTimeout(() => {
      setRenderedInspectorItem(null)
      inspectorCloseTimeoutRef.current = null
    }, 220)
    return () => {
      if (inspectorCloseTimeoutRef.current !== null) {
        window.clearTimeout(inspectorCloseTimeoutRef.current)
      }
    }
  }, [selectedItem])

  function requestInspectorNameFocus(personId: string) {
    pendingInspectorNameFocusPersonIdRef.current = personId
    if (
      renderedInspectorItem?.type === 'person' &&
      renderedInspectorItem.id === personId &&
      isInspectorOpen
    ) {
      pendingInspectorNameFocusPersonIdRef.current = null
      window.requestAnimationFrame(() => {
        const input = inspectorNameInputRef.current
        if (!input) return
        input.focus({ preventScroll: true })
        input.select()
      })
    }
  }

  useEffect(() => {
    const pendingPersonId = pendingInspectorNameFocusPersonIdRef.current
    if (!pendingPersonId) return
    if (renderedInspectorItem?.type !== 'person' || renderedInspectorItem.id !== pendingPersonId) {
      if (renderedInspectorItem?.type === 'person' && renderedInspectorItem.id !== pendingPersonId) {
        pendingInspectorNameFocusPersonIdRef.current = null
      }
      return
    }
    if (!isInspectorOpen) return

    pendingInspectorNameFocusPersonIdRef.current = null
    const input = inspectorNameInputRef.current
    if (!input) return
    const frame = window.requestAnimationFrame(() => {
      input.focus({ preventScroll: true })
      input.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [renderedInspectorItem, isInspectorOpen])

  function selectionShowsHandles(item: SelectedItem | null) {
    if (!item) return false
    if (item.type === 'person') return true
    if (item.type === 'circle') return item.showHandles === true
    return false
  }

  const [showCircleDropdown, setShowCircleDropdown] = useState(false)
  const [showCircleStylePanel, setShowCircleStylePanel] = useState(false)
  // Which color picker is being actively dragged (vs tapped). A tap glides the
  // thumb to the point; an active drag tracks the pointer with no latency.
  const [pickerDragging, setPickerDragging] = useState<'wheel' | 'brightness' | null>(null)
  const [colorAnimTick, setColorAnimTick] = useState(0)
  // Pointer-down position for each picker — used to enforce a min-distance
  // threshold before switching from "tap glide" mode to "instant drag" mode.
  // Without this, pointermove fires immediately for any mouse movement,
  // stripping the CSS transition before the thumb has a chance to animate.
  const pickerDownRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const pendingSelectRef = useRef<SelectedItem | null>(null)
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([])
  const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>([])
  const [hoveredPersonId, setHoveredPersonId] = useState<string | null>(null)
  const [hoveredCircleEdgeId, setHoveredCircleEdgeId] = useState<string | null>(null)
  const hoveredCircleEdgeIdRef = useRef<string | null>(null)

  // Viewport size in CSS px, used to cull off-screen nodes. Updated on resize.
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })

  const [showSettings, setShowSettings] = useState(false)
  const [boardToolMode, setBoardToolMode] = useState<BoardToolMode>('edit')
  const [isTouchLayout, setIsTouchLayout] = useState(isTouchBoardLayout)
  const onboardingSurface: OnboardingSurface = isTouchLayout ? 'mobile' : 'desktop'
  const onboardingSteps = useMemo(() => getOnboardingSteps(onboardingSurface), [onboardingSurface])
  const [onboardingStep, setOnboardingStep] = useState(-1)
  const [completedOnboardingStep, setCompletedOnboardingStep] = useState<number | null>(null)
  const onboardingStepRef = useRef(onboardingStep)
  const completedOnboardingStepRef = useRef(completedOnboardingStep)
  const onboardingDecidedRef = useRef(false)
  const onboardingAdvanceTimerRef = useRef<number | null>(null)
  const [highlightLinkedInGuideHelp, setHighlightLinkedInGuideHelp] = useState(
    () => !hasLocalFlag(LINKEDIN_GUIDE_HINT_KEY),
  )

  useEffect(() => {
    const media = window.matchMedia('(hover: none), (pointer: coarse), (max-width: 720px)')
    const updateTouchLayout = () => {
      setIsTouchLayout(media.matches)
    }
    updateTouchLayout()
    media.addEventListener('change', updateTouchLayout)
    return () => media.removeEventListener('change', updateTouchLayout)
  }, [])

  useEffect(() => {
    if (isTouchLayout || boardToolMode === 'edit') return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBoardToolMode('edit')
  }, [boardToolMode, isTouchLayout])

  useLayoutEffect(() => {
    onboardingStepRef.current = onboardingStep
    completedOnboardingStepRef.current = completedOnboardingStep
  }, [onboardingStep, completedOnboardingStep])

  useEffect(() => {
    if (onboardingDecidedRef.current) return
    if (!graphLoaded || auth.status === 'loading') return
    onboardingDecidedRef.current = true
    const forced = consumeSessionFlag(BOARD_ONBOARDING_FORCE_KEY)
    if (forced || !hasLocalFlag(BOARD_ONBOARDING_STORAGE_KEY)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      onboardingStepRef.current = 0
      setOnboardingStep(0)
    }
  }, [auth.status, graphLoaded])

  useEffect(() => {
    return () => {
      if (onboardingAdvanceTimerRef.current !== null) {
        window.clearTimeout(onboardingAdvanceTimerRef.current)
      }
    }
  }, [])

  function clearOnboardingAdvanceTimer() {
    if (onboardingAdvanceTimerRef.current === null) return
    window.clearTimeout(onboardingAdvanceTimerRef.current)
    onboardingAdvanceTimerRef.current = null
  }

  function finishOnboarding() {
    clearOnboardingAdvanceTimer()
    markLocalFlag(BOARD_ONBOARDING_STORAGE_KEY)
    onboardingStepRef.current = -1
    completedOnboardingStepRef.current = null
    setCompletedOnboardingStep(null)
    setOnboardingStep(-1)
  }

  function onboardingNext() {
    clearOnboardingAdvanceTimer()
    const step = onboardingStepRef.current
    if (step < 0) return
    const next = step + 1
    const nextStep = next >= onboardingSteps.length ? -1 : next
    if (nextStep < 0) markLocalFlag(BOARD_ONBOARDING_STORAGE_KEY)
    onboardingStepRef.current = nextStep
    completedOnboardingStepRef.current = null
    setCompletedOnboardingStep(null)
    setOnboardingStep(nextStep)
  }

  function onboardingBack() {
    clearOnboardingAdvanceTimer()
    const nextStep = onboardingStepRef.current > 0 ? onboardingStepRef.current - 1 : onboardingStepRef.current
    onboardingStepRef.current = nextStep
    completedOnboardingStepRef.current = null
    setCompletedOnboardingStep(null)
    setOnboardingStep(nextStep)
  }

  function completeOnboardingStep(stepIndex: number) {
    if (stepIndex < 0 || stepIndex >= onboardingSteps.length) return
    clearOnboardingAdvanceTimer()
    onboardingStepRef.current = stepIndex
    completedOnboardingStepRef.current = stepIndex
    setOnboardingStep(stepIndex)
    setCompletedOnboardingStep(stepIndex)
    onboardingAdvanceTimerRef.current = window.setTimeout(() => {
      onboardingAdvanceTimerRef.current = null
      completedOnboardingStepRef.current = null
      setCompletedOnboardingStep(null)
      setOnboardingStep((step) => {
        if (step !== stepIndex) return step
        const next = step + 1
        if (next >= onboardingSteps.length) {
          markLocalFlag(BOARD_ONBOARDING_STORAGE_KEY)
          onboardingStepRef.current = -1
          return -1
        }
        onboardingStepRef.current = next
        return next
      })
    }, ONBOARDING_COMPLETE_DELAY_MS)
  }

  function completeOnboardingAction(action: OnboardingAction) {
    const step = onboardingStepRef.current
    if (step < 0 || completedOnboardingStepRef.current !== null) return
    const current = onboardingSteps[step]
    if (!current || current.trigger !== action) return
    completeOnboardingStep(step)
  }

  function openLinkedInGuide() {
    const step = onboardingStepRef.current
    const currentTrigger = onboardingSteps[step]?.trigger
    if (currentTrigger === 'linkedin-guide') {
      completeOnboardingStep(step)
    } else if (
      currentTrigger === 'settings' &&
      onboardingSteps[step + 1]?.trigger === 'linkedin-guide'
    ) {
      completeOnboardingStep(step + 1)
    }
    markLocalFlag(LINKEDIN_GUIDE_HINT_KEY)
    setHighlightLinkedInGuideHelp(false)
    setShowSettings(false)
    setShowLinkedInGuide(true)
  }

  const [showAgentSettings, setShowAgentSettings] = useState(false)
  const [showLinkedInGuide, setShowLinkedInGuide] = useState(false)
  const showCircleLabels = true
  const showPersonLabels = true
  const circleShapeMode: CircleShapeMode = 'circles'
  const circleFillMode: CircleFillMode = 'transparent'
  const [circleCreationDefaults] = useState(loadCircleCreationDefaults)
  const centerBehavior = 'connect'
  const [hoveredConnId, setHoveredConnId] = useState<string | null>(null)
  const [openNotesPersonId, setOpenNotesPersonId] = useState<string | null>(null)
  const [newNoteBody, setNewNoteBody] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [newLinkValue, setNewLinkValue] = useState('')
  const [newLinkService, setNewLinkService] = useState<PersonLinkService>('website')
  const [showLinkServicePicker, setShowLinkServicePicker] = useState(false)
  const noteInputRef = useRef<HTMLTextAreaElement>(null)
  const notesListRef = useRef<HTMLDivElement>(null)

  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const settingsPanelRef = useRef<HTMLDivElement>(null)
  const linkedInGuidePanelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const graphFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (auth.status !== 'authenticated' || !auth.session || !showAgentSettings) return
    const timer = window.setTimeout(() => void refreshAgentTokens(), 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, auth.session, showAgentSettings])

  // Search: a pill in the top toolbar that finds people and circles and
  // circles (the "tags"), then flies the camera to the picked node.
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSearchIndex, setActiveSearchIndex] = useState(0)
  const [aiSearchResults, setAiSearchResults] = useState<SearchResult[] | null>(null)
  const [aiSearchExplanation, setAiSearchExplanation] = useState<string | null>(null)
  const [aiSearchSteps, setAiSearchSteps] = useState<AgentSearchStep[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const [isSmartSearching, setIsSmartSearching] = useState(false)
  const [showSearchLinkedInHint, setShowSearchLinkedInHint] = useState(false)
  const smartSearchRequestRef = useRef(0)
  const [isImportingLinkedInProfile, setIsImportingLinkedInProfile] = useState(false)
  const [isImportingLinkedInZip, setIsImportingLinkedInZip] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchPanelRef = useRef<HTMLDivElement>(null)
  const focusAnimRef = useRef<number | null>(null)

  function resetInspectorDraftState() {
    setOpenNotesPersonId(null)
    setNewNoteBody('')
    setIsAddingNote(false)
    setEditingNoteId(null)
    setNewLinkValue('')
    setNewLinkService('website')
    setShowLinkServicePicker(false)
    if (noteInputRef.current) {
      noteInputRef.current.style.height = 'auto'
    }
  }

  function selectItem(item: SelectedItem) {
    const isSameSelection =
      selectedItem?.type === item?.type &&
      selectedItem?.id === item?.id &&
      (item?.type !== 'circle' ||
        selectedItem?.type !== 'circle' ||
        selectedItem.showHandles === item.showHandles)

    if (isSameSelection) return

    resetInspectorDraftState()
    setShowCircleStylePanel(false)
    setSelectedItem(item)
  }

  // Smoothly fly the camera so (wx, wy) in world space lands a touch above the
  // screen centre (keeps the node clear of the bottom inspector) at targetScale.
  // Reuses driveCamera: each frame drives the live camera and re-arms its settle
  // timer, which commits the final position to React state when we stop.
  function focusCameraOnWorld(wx: number, wy: number, targetScale: number) {
    const start = { ...cameraRef.current }
    const cx = window.innerWidth / 2
    const cy = window.innerWidth <= 720 ? window.innerHeight * 0.22 : window.innerHeight * 0.44
    const end = { x: cx - wx * targetScale, y: cy - wy * targetScale, scale: targetScale }
    if (focusAnimRef.current != null) window.cancelAnimationFrame(focusAnimRef.current)
    // eslint-disable-next-line react-hooks/purity -- animation start time is read from an event handler, not render.
    const t0 = performance.now()
    const duration = 520
    const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration)
      const e = easeInOutCubic(t)
      driveCameraRef.current({
        x: start.x + (end.x - start.x) * e,
        y: start.y + (end.y - start.y) * e,
        scale: start.scale + (end.scale - start.scale) * e,
      })
      focusAnimRef.current = t < 1 ? window.requestAnimationFrame(step) : null
    }
    focusAnimRef.current = window.requestAnimationFrame(step)
  }

  function closeSearch() {
    setSearchOpen(false)
    setSearchQuery('')
    setShowSearchLinkedInHint(false)
    setActiveSearchIndex(0)
    setAiSearchResults(null)
    setAiSearchExplanation(null)
    setAiSearchSteps([])
    setAiSuggestions([])
    setIsSmartSearching(false)
    smartSearchRequestRef.current += 1
  }

  function graphSearchResultsToUi(
    results: ReturnType<typeof searchGraphByQuery>,
  ): SearchResult[] {
    return results.map((result) => {
      if (result.type === 'person') {
        const person = peopleById.get(result.id)
        const circle = circlesById.get(result.circleId)
        return {
          kind: 'person' as const,
          id: result.id,
          name: result.name,
          sub: result.subtitle,
          aiReason: result.aiReason,
          avatarUrl: person?.imageUrl,
          initials: makeInitials(result.name),
          color: circle ? getCircleColors(circle).centerBg : undefined,
        }
      }
      const circle = circlesById.get(result.id)
      return {
        kind: 'circle' as const,
        id: result.id,
        name: result.name,
        sub: result.subtitle || 'Circle',
        aiReason: result.aiReason,
        color: circle ? getCircleColors(circle).centerBg : undefined,
      }
    })
  }

  async function handleImportLinkedInProfileFromSearch(rawValue = searchQuery) {
    if (isImportingLinkedInProfile) return
    const profileUrl = getLinkedInProfileImportUrl(rawValue)
    if (!profileUrl) return
    const existingPerson = findPersonByLinkedInProfileUrl(graph.people, profileUrl)
    if (existingPerson && !personNeedsLinkedInEnrichment(existingPerson, graph.circles)) {
      selectItem({ type: 'person', id: existingPerson.id })
      focusCameraOnWorld(existingPerson.x, existingPerson.y, 1.5)
      closeSearch()
      completeOnboardingAction('search-import')
      return
    }
    setIsImportingLinkedInProfile(true)
    try {
      const profile = await buildLinkedInProfileImport(profileUrl)
      if (!profile) return

      const next = existingPerson
        ? updateLinkedInProfileInGraph(graph, existingPerson.id, profile)
        : addLinkedInProfileToGraph(graph, profile)
      pushHistory()
      setGraph(next.graph)
      selectItem({ type: 'person', id: next.person.id })
      focusCameraOnWorld(next.person.x, next.person.y, 1.5)
      closeSearch()
      completeOnboardingAction('search-import')
    } catch (err) {
      console.error(err)
      const errorMessage = getErrorMessage(err)
      alert(`Failed to import LinkedIn profile: ${errorMessage}`)
    } finally {
      setIsImportingLinkedInProfile(false)
    }
  }

  function handleOnboardingLinkedInExample(url: string) {
    setSearchQuery(url)
    setShowSearchLinkedInHint(false)
    setActiveSearchIndex(0)
    void handleImportLinkedInProfileFromSearch(url)
  }

  function handleSelectSearchResult(result: SearchResult) {
    if (result.kind === 'linkedin-profile') {
      void handleImportLinkedInProfileFromSearch()
      return
    }
    if (result.kind === 'person') {
      const person = graph.people.find((p) => p.id === result.id)
      if (!person) return
      selectItem({ type: 'person', id: person.id })
      focusCameraOnWorld(person.x, person.y, 1.5)
    } else {
      const circle = graph.circles.find((c) => c.id === result.id)
      if (!circle) return
      selectItem({ type: 'circle', id: circle.id })
      const minDim = Math.min(window.innerWidth, window.innerHeight)
      const scale = Math.max(0.25, Math.min(1.6, (0.55 * minDim) / (2 * circle.radius)))
      focusCameraOnWorld(circle.x, circle.y, scale)
    }
    closeSearch()
  }

  // Snapshot the current graph before a mutating action so Ctrl+Z can restore
  // it. History lives in module-level state (see undoHistory) rather than a
  // useRef so these helpers don't read React refs — that keeps the React
  // Compiler from treating every mutating action as ref access during render.
  // `graph` is the latest committed value in each render's closure, which for a
  // drag's first move is still the pre-drag state, so one snapshot per gesture.
  function pushHistory() {
    undoHistory.push(graph)
    if (undoHistory.length > MAX_UNDO_STEPS) undoHistory.shift()
  }

  // Record one snapshot per drag/resize gesture, on its first actual move.
  function ensureGestureSnapshot() {
    if (gestureSnapshotTakenRef.current) return
    gestureSnapshotTakenRef.current = true
    pushHistory()
  }

  function undo() {
    const previous = undoHistory.pop()
    if (!previous) return
    // Drop any in-flight drag frame so it can't clobber the restored state.
    if (dragRafRef.current != null) {
      window.cancelAnimationFrame(dragRafRef.current)
      dragRafRef.current = null
    }
    pendingGraphRef.current = null
    setGraph(previous)
    selectItem(null)
    setSelectedPeopleIds([])
    setCreateMenu(null)
  }

  const undoRef = useRef<() => void>(() => {})
  useEffect(() => {
    undoRef.current = undo
  })

  // Global Ctrl/Cmd+Z, so undo works regardless of board focus. Ignored while
  // typing in a field so it doesn't fight the input's own native undo.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.key === 'z' || event.key === 'Z') || !(event.metaKey || event.ctrlKey)) return
      if (event.shiftKey) return
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      event.preventDefault()
      undoRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  async function handleLinkedInImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (isImportingLinkedInZip) return
    setIsImportingLinkedInZip(true)

    try {
      const zipReader = new zip.ZipReader(new zip.BlobReader(file))
      const entries = await zipReader.getEntries()

      const connectionsEntry = entries.find(
        (e) => e.filename === 'Connections.csv' || e.filename.endsWith('/Connections.csv')
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!connectionsEntry || typeof (connectionsEntry as any).getData !== 'function') {
        alert('Could not find Connections.csv inside the ZIP file.')
        await zipReader.close()
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const csvText = await (connectionsEntry as any).getData(new zip.TextWriter())
      await zipReader.close()

      const result = await buildLinkedInConnectionsGraph(graph, csvText)
      pushHistory()
      await persistGraphImmediately(result.graph)

      alert(`LinkedIn data imported successfully: ${result.importedPeople} people across ${result.importedCompanies} companies.`)
    } catch (err) {
      console.error(err)
      const errorMessage = getErrorMessage(err)
      alert(`Failed to import LinkedIn ZIP: ${errorMessage}`)
    } finally {
      setIsImportingLinkedInZip(false)
      event.target.value = ''
    }
  }

  async function handleGraphImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const parsed = JSON.parse(await file.text()) as unknown
      if (!isGraphState(parsed)) {
        alert('Could not import graph: the file is not a valid board graph JSON.')
        return
      }

      const importedGraph = sanitizeDefaultCircleStyles(parsed)
      const nextGraph = auth.status === 'authenticated' && auth.session
        ? stampYouIdentity(importedGraph, auth.session.user)
        : importedGraph
      pushHistory()
      await persistGraphImmediately(nextGraph)
      selectItem(null)
      setSelectedPeopleIds([])
      setCreateMenu(null)
      alert('Graph imported successfully.')
    } catch (err) {
      console.error(err)
      const errorMessage = getErrorMessage(err)
      alert(`Failed to import graph: ${errorMessage}`)
    } finally {
      event.target.value = ''
    }
  }

  function handleGraphExport() {
    const date = new Date().toISOString().slice(0, 10)
    const blob = new Blob([`${JSON.stringify(graph, null, 2)}\n`], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `social-datanode-graph-${date}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function handleClearGraph() {
    const confirmed = window.confirm('Clear the current graph? This removes all circles, people, notes, and connections.')
    if (!confirmed) return
    const nextGraph = auth.status === 'authenticated' && auth.session
      ? stampYouIdentity(createFreshGraph(), auth.session.user)
      : createFreshGraph()
    pushHistory()
    setGraph(nextGraph)
    selectItem(null)
    setSelectedPeopleIds([])
    setCreateMenu(null)
  }

  function deletePerson(personId: string) {
    pushHistory()
    setGraph((current) => ({
      ...current,
      people: current.people.filter((p) => p.id !== personId),
      connections: (current.connections || []).filter(
        (conn) => conn.fromId !== personId && conn.toId !== personId
      ),
    }))
    selectItem(null)
  }

  function togglePersonFavorite(personId: string) {
    const person = graph.people.find((p) => p.id === personId)
    const becomingFavorite = !person?.isFavorite
    pushHistory()
    setGraph((current) => ({
      ...current,
      people: current.people.map((p) =>
        p.id === personId ? { ...p, isFavorite: !p.isFavorite } : p
      ),
    }))
    if (becomingFavorite) {
      startBoardAnim(`favorite-in:${personId}`, 540)
    } else {
      startBoardAnim(`favorite-out:${personId}`, 360)
    }
  }
  // Reference to bypass noUnusedLocals error while favorite UI is commented out
  void togglePersonFavorite;

  function addPersonNote(personId: string, title: string, body: string) {
    pushHistory()
    setGraph((current) => ({
      ...current,
      people: current.people.map((p) => {
        if (p.id === personId) {
          const notes = p.notes ? [...p.notes] : []
          notes.push({ id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, title, body })
          return { ...p, notes }
        }
        return p
      }),
    }))
  }

  function scrollNotesListToBottom() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const list = notesListRef.current
        if (!list) return
        list.scrollTop = list.scrollHeight
      })
    })
  }

  function handleSaveNewNote(personId: string) {
    const trimmed = newNoteBody.trim()
    if (trimmed) {
      addPersonNote(
        personId,
        trimmed.split('\n')[0].substring(0, 30) || 'Untitled note',
        trimmed
      )
      setNewNoteBody('')
      if (noteInputRef.current) {
        noteInputRef.current.style.height = 'auto'
      }
      scrollNotesListToBottom()
      requestAnimationFrame(() => {
        noteInputRef.current?.focus()
      })
    }
  }

  function updatePersonNote(personId: string, noteId: string, title: string, body: string) {
    setGraph((current) => ({
      ...current,
      people: current.people.map((p) => {
        if (p.id === personId && p.notes) {
          const notes = p.notes.map((n) =>
            n.id === noteId ? { ...n, title, body } : n
          )
          return { ...p, notes }
        }
        return p
      }),
    }))
  }

  function deletePersonNote(personId: string, noteId: string) {
    pushHistory()
    setGraph((current) => ({
      ...current,
      people: current.people.map((p) => {
        if (p.id === personId && p.notes) {
          const notes = p.notes.filter((n) => n.id !== noteId)
          return { ...p, notes }
        }
        return p
      }),
    }))
  }

  function addPersonLink(personId: string, rawValue: string, service: PersonLinkService) {
    const trimmed = rawValue.trim()
    if (!trimmed) return
    const normalized = normalizeLinkInput(trimmed, service)
    setGraph((current) => ({
      ...current,
      people: current.people.map((p) => {
        if (p.id !== personId) return p
        const links = p.links ? [...p.links] : []
        links.push({
          id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          service,
          label: normalized.label,
          url: normalized.url,
        })
        return { ...p, links }
      }),
    }))
  }

  function deletePersonLink(personId: string, linkId: string) {
    setGraph((current) => ({
      ...current,
      people: current.people.map((p) => {
        if (p.id !== personId || !p.links) return p
        return { ...p, links: p.links.filter((link) => link.id !== linkId) }
      }),
    }))
  }

  function handleSaveNewLink(personId: string) {
    const trimmed = newLinkValue.trim()
    if (!trimmed) return
    const inferredService = inferLinkService(trimmed)
    const needsChoice = trimmed.startsWith('@') || /^\+?[\d\s().-]{7,}$/.test(trimmed)
    if (needsChoice && !showLinkServicePicker) {
      setNewLinkService(inferredService)
      setShowLinkServicePicker(true)
      return
    }
    addPersonLink(personId, trimmed, showLinkServicePicker ? newLinkService : inferredService)
    setNewLinkValue('')
    setShowLinkServicePicker(false)
    setNewLinkService('website')
  }

  function setCircleColorFromHsv(circleId: string, hsv: HsvColor, instant = false) {
    const hex = hsvToHex(hsv)
    if (instant) {
      boardAnimsRef.current.delete(`color:${circleId}`)
      updateCircleStyle(circleId, { customColor: hex })
      return
    }
    animateCircleColor(circleId, { customColor: hex })
  }

  function displayCircleColors(circle: CircleNode) {
    const blend = readAnimFrame(boardAnimsRef.current, animNowRef.current).colorReveal.get(circle.id)
    if (blend) return lerpCircleColors(blend.from, blend.to, blend.t)
    return getCircleColors(circle)
  }

  function animateCircleColor(circleId: string, updates: Partial<CircleNode>) {
    const live = graphRef.current.circles.find((c) => c.id === circleId)
    if (!live) return
    const target = { ...live, ...updates }
    const to = getCircleColors(target)
    const blend = readAnimFrame(boardAnimsRef.current, animNowRef.current).colorReveal.get(circleId)
    const from = blend ? lerpCircleColors(blend.from, blend.to, blend.t) : getCircleColors(live)
    updateCircleStyle(circleId, updates)
    if (circleColorsEqual(from, to)) return
    if (prefersReducedMotion()) return
    boardAnimsRef.current.set(`color:${circleId}`, {
      start: -1,
      duration: COLOR_ANIM_MS,
      colorMorph: { from, to },
    })
    if (boardAnimRafRef.current == null) {
      boardAnimRafRef.current = window.requestAnimationFrame(tickBoardAnims)
    }
  }

  function scheduleCircleMorph(circleId: string, next: CircleMorph) {
    if (prefersReducedMotion()) return
    const key = `morph:${circleId}`
    const existing = boardAnimsRef.current.get(key)
    if (existing?.morph) {
      boardAnimsRef.current.set(key, {
        ...existing,
        morph: {
          ...existing.morph,
          toSides: next.toSides,
          toAmp: next.toAmp,
          toShapeType: next.toShapeType,
        },
      })
      if (boardAnimRafRef.current == null) {
        boardAnimRafRef.current = window.requestAnimationFrame(tickBoardAnims)
      }
      return
    }
    startBoardAnim(key, MORPH_ANIM_MS, next)
  }

  function updateCircleStyleAndCreationDefaults(id: string, updates: Partial<CircleNode>) {
    updateCircleStyle(id, updates)
  }

  // Minimum pointer movement (px) before a tap is promoted to a drag.
  // Below this threshold the CSS transition stays active so the thumb glides
  // to the tapped spot.  Above it we drop the transition for zero-latency tracking.
  const PICKER_DRAG_THRESHOLD = 5

  function handleColorWheelPointerDown(event: ReactPointerEvent<HTMLButtonElement>, circle: CircleNode) {
    event.preventDefault()
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* best-effort */ }
    // Record the down position; reset moved flag so the glide can fire.
    pickerDownRef.current = { x: event.clientX, y: event.clientY, moved: false }
    setPickerDragging(null) // ensure transition is active for the coming glide
    const rect = event.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const dx = event.clientX - centerX
    const dy = event.clientY - centerY
    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2)
    const distance = Math.min(radius, Math.hypot(dx, dy))
    const current = hexToHsv(displayCircleColors(circle).centerBg)
    const angle = Math.atan2(dy, dx)
    const hue = (angle * 180) / Math.PI + 180
    setCircleColorFromHsv(circle.id, { h: hue, s: distance / radius, v: current.v })
  }

  function handleColorWheelPointerMove(event: ReactPointerEvent<HTMLButtonElement>, circle: CircleNode) {
    if (event.buttons !== 1 || !pickerDownRef.current) return
    const down = pickerDownRef.current
    // Promote to drag only after crossing the threshold distance.
    if (!down.moved) {
      const dist = Math.hypot(event.clientX - down.x, event.clientY - down.y)
      if (dist < PICKER_DRAG_THRESHOLD) return // still within tap zone — let the glide play
      down.moved = true
      setPickerDragging('wheel') // drop transition; track instantly from here
      boardAnimsRef.current.delete(`color:${circle.id}`)
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const dx = event.clientX - centerX
    const dy = event.clientY - centerY
    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2)
    const distance = Math.min(radius, Math.hypot(dx, dy))
    const current = hexToHsv(displayCircleColors(circle).centerBg)
    const angle = Math.atan2(dy, dx)
    const hue = (angle * 180) / Math.PI + 180
    setCircleColorFromHsv(circle.id, { h: hue, s: distance / radius, v: current.v }, true)
  }

  function handleBrightnessPointerDown(event: ReactPointerEvent<HTMLButtonElement>, circle: CircleNode) {
    event.preventDefault()
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* best-effort */ }
    pickerDownRef.current = { x: event.clientX, y: event.clientY, moved: false }
    setPickerDragging(null)
    const rect = event.currentTarget.getBoundingClientRect()
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    const current = hexToHsv(displayCircleColors(circle).centerBg)
    setCircleColorFromHsv(circle.id, { ...current, v: x })
  }

  function handleBrightnessPointerMove(event: ReactPointerEvent<HTMLButtonElement>, circle: CircleNode) {
    if (event.buttons !== 1 || !pickerDownRef.current) return
    const down = pickerDownRef.current
    if (!down.moved) {
      const dist = Math.hypot(event.clientX - down.x, event.clientY - down.y)
      if (dist < PICKER_DRAG_THRESHOLD) return
      down.moved = true
      setPickerDragging('brightness')
      boardAnimsRef.current.delete(`color:${circle.id}`)
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    const current = hexToHsv(displayCircleColors(circle).centerBg)
    setCircleColorFromHsv(circle.id, { ...current, v: x }, true)
  }

  function handlePickerPointerUp() {
    pickerDownRef.current = null
    setPickerDragging(null)
  }

  function handleSwatchPointerDown(id: string, action: () => void) {
    ++swatchPressTxRef.current
    setPressingSwatchId(id)
    setReturningSwatchId(null)
    pressingSwatchIdRef.current = id
    // eslint-disable-next-line react-hooks/purity
    pressingSwatchTimeRef.current = performance.now()
    action()
  }

  function handleSwatchPointerUp(id: string) {
    if (pressingSwatchIdRef.current !== id) return
    pressingSwatchIdRef.current = null
    const tx = swatchPressTxRef.current
    const elapsed = performance.now() - pressingSwatchTimeRef.current
    const minDur = 180 // Match the minimum hold duration
    if (elapsed < minDur) {
      setTimeout(() => {
        if (swatchPressTxRef.current === tx) {
          setPressingSwatchId(null)
          setReturningSwatchId(id)
          setTimeout(() => {
            setReturningSwatchId((curr) => curr === id ? null : curr)
          }, 350)
        }
      }, minDur - elapsed)
    } else {
      if (swatchPressTxRef.current === tx) {
        setPressingSwatchId(null)
        setReturningSwatchId(id)
        setTimeout(() => {
          setReturningSwatchId((curr) => curr === id ? null : curr)
        }, 350)
      }
    }
  }

  function updateCircleCorners(circle: CircleNode, sides: number) {
    const live = graphRef.current.circles.find((c) => c.id === circle.id) ?? circle
    const amplitude = live.amplitude ?? 0
    const committedSides = live.sides ?? 25
    const fromShapeType = live.shapeType ?? (amplitude > 0 ? 'wavy' : committedSides >= 25 ? 'circle' : 'polygon')
    const toShapeType = amplitude > 0 ? 'wavy' : sides >= 25 ? 'circle' : 'polygon'
    const updates: Partial<CircleNode> = {
      shapeType: toShapeType,
      shapeCustom: toShapeType !== 'circle',
      sides,
      amplitude,
    }
    updateCircleStyleAndCreationDefaults(live.id, updates)
    if (committedSides === sides) return

    const existing = boardAnimsRef.current.get(`morph:${live.id}`)?.morph
    scheduleCircleMorph(live.id, {
      fromSides: existing?.fromSides ?? committedSides,
      fromAmp: existing?.fromAmp ?? amplitude,
      toSides: sides,
      toAmp: amplitude,
      fromShapeType: existing?.fromShapeType ?? fromShapeType,
      toShapeType,
    })
  }

  function updateCircleAmplitude(circle: CircleNode, amplitude: number) {
    const live = graphRef.current.circles.find((c) => c.id === circle.id) ?? circle
    const sides = live.sides ?? 25
    const committedAmp = live.amplitude ?? 0
    const fromShapeType = live.shapeType ?? (committedAmp > 0 ? 'wavy' : sides >= 25 ? 'circle' : 'polygon')
    const toShapeType = amplitude > 0 ? 'wavy' : sides >= 25 ? 'circle' : 'polygon'
    const updates: Partial<CircleNode> = {
      shapeType: toShapeType,
      shapeCustom: toShapeType !== 'circle',
      sides,
      amplitude,
    }
    updateCircleStyleAndCreationDefaults(live.id, updates)
    if (Math.abs(amplitude - committedAmp) < 0.05) return

    const existing = boardAnimsRef.current.get(`morph:${live.id}`)?.morph
    scheduleCircleMorph(live.id, {
      fromSides: existing?.fromSides ?? sides,
      fromAmp: existing?.fromAmp ?? committedAmp,
      toSides: sides,
      toAmp: amplitude,
      fromShapeType: existing?.fromShapeType ?? fromShapeType,
      toShapeType,
    })
  }

  function deleteCircle(circleId: string) {
    if (circleId === 'you') return

    const circle = graph.circles.find((c) => c.id === circleId)
    if (!circle) return

    const circleLabel = circle.name.trim() || circle.icon.trim() || 'this circle'
    const confirmed = window.confirm(
      `Delete "${circleLabel}"? People in this circle stay where they are but are removed from the circle. Nested circles move to the parent circle.`,
    )
    if (!confirmed) return

    pushHistory()
    setGraph((current) => {
      const deletedCircle = current.circles.find((c) => c.id === circleId)
      if (!deletedCircle) return current

      const newParentId = deletedCircle.parentId ?? 'you'

      // 1. Promote child circles to the parent of the deleted circle
      const nextCircles = current.circles
        .filter((c) => c.id !== circleId)
        .map((c) => {
          const updated = { ...c }
          if (c.parentId === circleId) {
            updated.parentId = newParentId
          }
          if (c.connectedTo === circleId) {
            updated.connectedTo = null
          }
          return updated
        })

      // 2. Detach people from the deleted circle without moving them
      const nextPeople = current.people.map((p) => {
        if (p.circleId === circleId) {
          return { ...p, circleId: '' }
        }
        return p
      })

      // 3. Filter connections: remove connection only if it directly connected the deleted circle
      const nextConnections = (current.connections || []).filter(
        (conn) => conn.fromId !== circleId && conn.toId !== circleId
      )

      return settleInteractionGraph({
        ...current,
        circles: nextCircles,
        people: nextPeople,
        connections: nextConnections,
      })
    })

    selectItem(null)
  }

  function deleteConnection(connId: string) {
    pushHistory()
    setGraph((current) => {
      if (connId.startsWith(MEMBERSHIP_CONNECTION_PREFIX)) {
        const personId = connId.slice(MEMBERSHIP_CONNECTION_PREFIX.length)
        return {
          ...current,
          people: current.people.map((person) => person.id === personId ? { ...person, circleId: '' } : person),
        }
      }

      if (connId.startsWith(CIRCLE_LINK_CONNECTION_PREFIX)) {
        const circleId = connId.slice(CIRCLE_LINK_CONNECTION_PREFIX.length)
        return {
          ...current,
          circles: current.circles.map((circle) => circle.id === circleId ? { ...circle, connectedTo: null } : circle),
        }
      }

      return {
        ...current,
        connections: (current.connections || []).filter((conn) => conn.id !== connId),
      }
    })
    selectItem(null)
  }

  function deleteSelectedItem() {
    if (selectedPeopleIds.length > 0) {
      pushHistory()
      setGraph((current) => {
        const deletedPeopleIds = new Set<string>(selectedPeopleIds)

        const nextPeople = current.people.filter((p) => !deletedPeopleIds.has(p.id))

        const nextConnections = (current.connections || []).filter(
          (conn) =>
            !deletedPeopleIds.has(conn.fromId) &&
            !deletedPeopleIds.has(conn.toId)
        )

        return settleInteractionGraph({
          ...current,
          people: nextPeople,
          connections: nextConnections,
        })
      })
      setSelectedPeopleIds([])
      selectItem(null)
    } else if (selectedItem?.type === 'person') {
      deletePerson(selectedItem.id)
    } else if (selectedItem?.type === 'connection') {
      deleteConnection(selectedItem.id)
    }
  }

  useEffect(() => {
    cameraRef.current = camera
  }, [camera])

  useEffect(() => {
    function handleOutsideClick(event: PointerEvent) {
      if (
        showSettings &&
        settingsPanelRef.current &&
        !settingsPanelRef.current.contains(event.target as Node) &&
        settingsButtonRef.current &&
        !settingsButtonRef.current.contains(event.target as Node)
      ) {
        setShowSettings(false)
      }
      if (
        searchOpen &&
        searchPanelRef.current &&
        !searchPanelRef.current.contains(event.target as Node)
      ) {
        closeSearch()
      }
      if (
        showLinkedInGuide &&
        linkedInGuidePanelRef.current &&
        !linkedInGuidePanelRef.current.contains(event.target as Node)
      ) {
        setShowLinkedInGuide(false)
      }
    }
    document.addEventListener('pointerdown', handleOutsideClick)
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick)
    }
  }, [showSettings, searchOpen, showLinkedInGuide])

  useEffect(() => {
    if (!showCircleStylePanel) return
    function handleOutsideCircleStyleClick(event: PointerEvent) {
      const target = event.target as HTMLElement
      if (target.closest('.circle-style-popover') || target.closest('.quick-circle-color--more')) return
      setShowCircleStylePanel(false)
    }
    document.addEventListener('pointerdown', handleOutsideCircleStyleClick)
    return () => {
      document.removeEventListener('pointerdown', handleOutsideCircleStyleClick)
    }
  }, [showCircleStylePanel])

  useEffect(() => {
    function handleOutsideNotesClick(event: PointerEvent) {
      if (openNotesPersonId === null) return
      const target = event.target as HTMLElement
      if (target.closest('.notes-popover') || target.closest('.notes-btn')) {
        return
      }
      setOpenNotesPersonId(null)
    }
    document.addEventListener('pointerdown', handleOutsideNotesClick)
    return () => {
      document.removeEventListener('pointerdown', handleOutsideNotesClick)
    }
  }, [openNotesPersonId])

  // Keep the latest delete-selection logic in a ref so the global keydown
  // listener can subscribe once yet always call the current selection/actions.
  // (The delete helpers are unstable now that they snapshot undo history, so
  // listing them as deps would re-subscribe every render.)
  const deleteSelectionRef = useRef<() => void>(() => {})
  useEffect(() => {
    // deleteSelectedItem covers every case: marquee multi-select of people and
    // circles, plus single person/circle/connection.
    deleteSelectionRef.current = () => deleteSelectedItem()
  })

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const activeEl = document.activeElement
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return
      }
      deleteSelectionRef.current()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!showCircleDropdown) return
    function handleOutsideClick() {
      setShowCircleDropdown(false)
    }
    const timeout = setTimeout(() => {
      window.addEventListener('click', handleOutsideClick)
    }, 0)
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('click', handleOutsideClick)
    }
  }, [showCircleDropdown])

  const displayCircles = graph.circles
  const displayPeople = graph.people
  const displayConnections = useMemo(() => graph.connections || [], [graph.connections])

  const circlesById = useMemo(() => new Map(displayCircles.map((circle) => [circle.id, circle])), [displayCircles])
  const peopleById = useMemo(() => new Map(displayPeople.map((person) => [person.id, person])), [displayPeople])

  // Live search results: people matched on name, owning circle, notes, and links;
  // circles ("tags") match on name.
  // Capped so the dropdown stays compact; people first since finding a person is
  // the primary use, circles after.
  const localSearchResults = useMemo<SearchResult[]>(() => {
    const q = searchQuery.trim()
    if (!q) return []
    const linkedInUrl = getLinkedInProfileImportUrl(searchQuery)
    const linkedInImport: SearchResult[] = linkedInUrl
      ? [{
          kind: 'linkedin-profile',
          id: linkedInUrl,
          name: isImportingLinkedInProfile ? 'Importing profile...' : 'Add LinkedIn profile',
          sub: isImportingLinkedInProfile ? linkedInUrl : linkedInUrl,
        }]
      : []
    const ranked = graphSearchResultsToUi(searchGraphByQuery(
      { circles: displayCircles, people: displayPeople, connections: displayConnections },
      q,
      8,
    ))
    return [...linkedInImport, ...ranked].slice(0, 8)
  }, [searchQuery, isImportingLinkedInProfile, displayPeople, displayCircles, displayConnections, circlesById, peopleById])

  const isAiSearchActive = auth.status === 'authenticated' && shouldUseSmartSearch(searchQuery.trim())
  const searchResults = isAiSearchActive
    ? (isSmartSearching ? [] : (aiSearchResults ?? localSearchResults))
    : localSearchResults

  useEffect(() => {
    const query = searchQuery.trim()
    if (!query) {
      setAiSearchResults(null)
      setAiSearchExplanation(null)
      setAiSearchSteps([])
      setAiSuggestions([])
      setIsSmartSearching(false)
      return
    }
    if (auth.status !== 'authenticated' || !auth.session || !shouldUseSmartSearch(query)) {
      setAiSearchResults(null)
      setAiSearchExplanation(null)
      setAiSearchSteps([])
      setAiSuggestions([])
      setIsSmartSearching(false)
      return
    }

    const requestId = smartSearchRequestRef.current + 1
    smartSearchRequestRef.current = requestId
    setIsSmartSearching(true)
    setAiSearchResults(null)
    setAiSearchExplanation(null)
    setAiSearchSteps([])
    setAiSuggestions([])

    const timer = window.setTimeout(() => {
      void smartSearchGraph(auth.session!, query, 8)
        .then((response) => {
          if (requestId !== smartSearchRequestRef.current) return
          const linkedInUrl = getLinkedInProfileImportUrl(searchQuery)
          const linkedInImport: SearchResult[] = linkedInUrl
            ? [{
                kind: 'linkedin-profile',
                id: linkedInUrl,
                name: isImportingLinkedInProfile ? 'Importing profile...' : 'Add LinkedIn profile',
                sub: isImportingLinkedInProfile ? linkedInUrl : linkedInUrl,
              }]
            : []
          const ranked = graphSearchResultsToUi(mapSmartSearchResults(response.results))
          setAiSearchResults([...linkedInImport, ...ranked].slice(0, 8))
          setAiSearchExplanation(response.explanation || null)
          setAiSearchSteps(response.steps ?? [])
          setAiSuggestions(response.suggestions ?? [])
        })
        .catch((error) => {
          if (requestId !== smartSearchRequestRef.current) return
          console.error(error)
          setAiSearchResults(null)
          setAiSearchExplanation('AI search failed. Showing quick matches instead.')
          setAiSearchSteps([{ id: 'error', label: 'AI search unavailable', detail: error instanceof Error ? error.message : String(error) }])
          setAiSuggestions([])
        })
        .finally(() => {
          if (requestId === smartSearchRequestRef.current) {
            setIsSmartSearching(false)
          }
        })
    }, 450)

    return () => window.clearTimeout(timer)
  }, [searchQuery, auth.status, auth.session, isImportingLinkedInProfile, displayPeople, displayCircles, displayConnections, circlesById, peopleById])

  const aiPanelSteps = isSmartSearching && aiSearchSteps.length === 0
    ? [
        { id: 'read', label: 'Reading your question' },
        { id: 'scan', label: 'Scanning contacts and notes' },
        { id: 'match', label: 'AI matching by meaning' },
      ]
    : aiSearchSteps

  const currentSearchIndex = searchResults.length > 0
    ? clamp(activeSearchIndex, 0, searchResults.length - 1)
    : 0
  const isOnboardingSearchImportStep =
    onboardingStep >= 0 &&
    completedOnboardingStep === null &&
    onboardingSteps[onboardingStep]?.trigger === 'search-import'
  const sortedCircles = useMemo(() => {
    function getDepth(circleId: string | null): number {
      let depth = 0
      let curr = circleId
      while (curr) {
        depth++
        curr = circlesById.get(curr)?.parentId ?? null
      }
      return depth
    }
    return [...displayCircles].sort((a, b) => getDepth(a.parentId) - getDepth(b.parentId))
  }, [displayCircles, circlesById])
  const boardIndex = useMemo(
    () => createBoardIndex(sortedCircles, displayPeople, displayConnections),
    [sortedCircles, displayPeople, displayConnections],
  )
  const boardIndexRef = useRef(boardIndex)
  useLayoutEffect(() => {
    boardIndexRef.current = boardIndex
  }, [boardIndex])





  const selectedCircle = renderedInspectorItem?.type === 'circle' ? circlesById.get(renderedInspectorItem.id) ?? null : null
  const selectedPerson = renderedInspectorItem?.type === 'person'
    ? graph.people.find((person) => person.id === renderedInspectorItem.id) ?? null
    : null
  const selectedConnection = useMemo<Connection | null>(() => {
    if (renderedInspectorItem?.type !== 'connection') return null

    const stored = (graph.connections || []).find((conn) => conn.id === renderedInspectorItem.id)
    if (stored) return stored

    if (renderedInspectorItem.id.startsWith(MEMBERSHIP_CONNECTION_PREFIX)) {
      const personId = renderedInspectorItem.id.slice(MEMBERSHIP_CONNECTION_PREFIX.length)
      const person = peopleById.get(personId)
      if (person?.circleId && circlesById.has(person.circleId)) {
        return { id: renderedInspectorItem.id, fromId: person.circleId, toId: person.id }
      }
    }

    if (renderedInspectorItem.id.startsWith(CIRCLE_LINK_CONNECTION_PREFIX)) {
      const circleId = renderedInspectorItem.id.slice(CIRCLE_LINK_CONNECTION_PREFIX.length)
      const circle = circlesById.get(circleId)
      if (circle?.connectedTo && circlesById.has(circle.connectedTo)) {
        return { id: renderedInspectorItem.id, fromId: circle.connectedTo, toId: circle.id }
      }
    }

    return null
  }, [circlesById, graph.connections, peopleById, renderedInspectorItem])

  useEffect(() => {
    const prev = prevSelectionRef.current
    prevSelectionRef.current = selectedItem

    const prevShows = selectionShowsHandles(prev)
    const nextShows = selectionShowsHandles(selectedItem)
    const prevId = prevShows && prev ? prev.id : null
    const nextId = nextShows && selectedItem ? selectedItem.id : null

    const handlesTurnedOffSameCircle =
      prev?.type === 'circle' &&
      selectedItem?.type === 'circle' &&
      prev.id === selectedItem.id &&
      prev.showHandles &&
      !selectedItem.showHandles

    const handlesTurnedOnSameCircle =
      prev?.type === 'circle' &&
      selectedItem?.type === 'circle' &&
      prev.id === selectedItem.id &&
      !prev.showHandles &&
      selectedItem.showHandles

    if (prevId && (prevId !== nextId || handlesTurnedOffSameCircle)) {
      const node =
        prev?.type === 'person'
          ? graph.people.find((person) => person.id === prevId)
          : circlesById.get(prevId)
      if (node) {
        handleExitNodesRef.current.set(prevId, node)
        startBoardAnim(`handles-out:${prevId}`, 220)
      }
    }

    if (nextId && (nextId !== prevId || handlesTurnedOnSameCircle)) {
      startBoardAnim(`handles:${nextId}`, 300)
    }
  }, [selectedItem, graph.circles, graph.people, circlesById])

  useEffect(() => {
    const circleId = selectedItem?.type === 'circle' ? selectedItem.id : null
    const prevRingId = ringCircleIdRef.current

    if (circleId && circleId !== prevRingId) {
      if (prevRingId) startBoardAnim(`ring-out:${prevRingId}`, RING_ANIM_MS)
      startBoardAnim(`ring:${circleId}`, RING_ANIM_MS)
      ringCircleIdRef.current = circleId
    } else if (!circleId && prevRingId) {
      startBoardAnim(`ring-out:${prevRingId}`, RING_ANIM_MS)
      ringCircleIdRef.current = null
    }
  }, [selectedItem])

  useEffect(() => {
    const prev = edgeHoverCircleIdRef.current
    if (hoveredCircleEdgeId === prev) return

    if (prev) animateEdgeHoverTo(prev, 0)
    if (hoveredCircleEdgeId) animateEdgeHoverTo(hoveredCircleEdgeId, 1)
    edgeHoverCircleIdRef.current = hoveredCircleEdgeId
  }, [hoveredCircleEdgeId])



  // Push the live camera onto the dotted grid without going through React.
  function applyDomCamera() {
    const surface = surfaceRef.current
    const cam = cameraRef.current
    if (surface && cam) {
      const minor = 20 * cam.scale
      const major = 160 * cam.scale
      surface.style.backgroundSize = `${major}px ${major}px, ${minor}px ${minor}px`
      surface.style.backgroundPosition = `${cam.x}px ${cam.y}px`
    }
  }

  function clearCameraBitmapCache() {
    cameraBitmapCacheRef.current = null
    const canvas = peopleCanvasRef.current
    if (canvas) {
      canvas.style.transform = ''
      canvas.style.transformOrigin = ''
    }
  }

  function ensureCameraBitmapCache() {
    const canvas = peopleCanvasRef.current
    const surface = surfaceRef.current
    if (!canvas || !surface) return null
    const width = Math.max(1, surface.clientWidth)
    const height = Math.max(1, surface.clientHeight)
    const existing = cameraBitmapCacheRef.current
    if (
      existing &&
      existing.cssWidth >= width &&
      existing.cssHeight >= height &&
      Math.abs(existing.startCamera.scale - cameraRef.current.scale) / Math.max(cameraRef.current.scale, 0.001) < 0.2
    ) {
      return existing
    }

    const pad = Math.min(900, Math.max(360, Math.round(Math.max(width, height) * 0.75)))
    const cacheCanvas = existing?.canvas ?? document.createElement('canvas')
    const startCamera = { ...cameraRef.current }
    const cacheCamera = {
      x: startCamera.x + pad,
      y: startCamera.y + pad,
      scale: startCamera.scale,
    }
    const cssWidth = width + pad * 2
    const cssHeight = height + pad * 2
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25)

    drawBoardLayer(
      cacheCanvas,
      surface,
      cacheCamera,
      boardIndex,
      selectedItem,
      hoveredPersonId,
      hoveredConnId,
      connector,
      showCircleLabels,
      showPersonLabels,
      circleShapeMode,
      circleFillMode,
      selectedPeopleIds,
      marqueeRef.current,
      selectedCircleIds,
      EMPTY_ANIM_FRAME,
      new Map(),
      null,
      {
        viewportWidth: cssWidth,
        viewportHeight: cssHeight,
        dprCap: 1.25,
        performanceMode: true,
      },
    )

    const next = { canvas: cacheCanvas, startCamera, pad, cssWidth, cssHeight, dpr }
    cameraBitmapCacheRef.current = next
    return next
  }

  function drawCameraBitmapCache() {
    const canvas = peopleCanvasRef.current
    const surface = surfaceRef.current
    if (!canvas || !surface) return false
    const cache = ensureCameraBitmapCache()
    if (!cache) return false

    const width = Math.max(1, surface.clientWidth)
    const height = Math.max(1, surface.clientHeight)
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
    const nextWidth = Math.round(width * dpr)
    const nextHeight = Math.round(height * dpr)
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth
      canvas.height = nextHeight
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }

    const current = cameraRef.current
    const ratio = current.scale / cache.startCamera.scale
    const maxPan = cache.pad * 0.82
    const dx = current.x - cache.startCamera.x
    const dy = current.y - cache.startCamera.y
    if (Math.abs(dx) > maxPan || Math.abs(dy) > maxPan || ratio < 0.68 || ratio > 1.48) {
      cameraBitmapCacheRef.current = null
      return false
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = ratio > 1 ? 'medium' : 'low'
    ctx.translate(
      current.x - (cache.pad + cache.startCamera.x) * ratio,
      current.y - (cache.pad + cache.startCamera.y) * ratio,
    )
    ctx.scale(ratio, ratio)
    ctx.drawImage(
      cache.canvas,
      0,
      0,
      cache.canvas.width,
      cache.canvas.height,
      0,
      0,
      cache.cssWidth,
      cache.cssHeight,
    )
    return true
  }

  // One imperative frame of a gesture: move the DOM and repaint the (culled)
  // people canvas at the live camera, so newly revealed people fill in mid-pan.
  function applyLiveCamera() {
    const cam = cameraRef.current
    applyDomCamera()
    if (drawCameraBitmapCache()) return
    const canvas = peopleCanvasRef.current
    const surface = surfaceRef.current
    if (canvas && surface) {
      drawBoardLayer(
        canvas,
        surface,
        cam,
        boardIndex,
        selectedItem,
        hoveredPersonId,
        hoveredConnId,
        connector,
        showCircleLabels,
        showPersonLabels,
        circleShapeMode,
        circleFillMode,
        selectedPeopleIds,
        marqueeRef.current,
        selectedCircleIds,
        EMPTY_ANIM_FRAME,
        new Map(),
        null,
        { performanceMode: true, dprCap: 1.25 },
      )
    }
  }

  // Called on every pan/zoom event. Updates the live camera, schedules one
  // imperative repaint per frame, promotes the world to its own GPU layer
  // (so zoom scales the cached bitmap instead of repainting every vector),
  // and (re)arms the settle timer that commits a sharp render once you pause.
  function driveCamera(next: Camera) {
    cameraRef.current = next
    if (!gestureActiveRef.current) {
      gestureActiveRef.current = true
    }
    if (gestureRafRef.current == null) {
      gestureRafRef.current = window.requestAnimationFrame(() => {
        gestureRafRef.current = null
        applyLiveCamera()
      })
    }
    if (settleTimerRef.current != null) window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = window.setTimeout(() => settleGestureRef.current(), 130)
  }

  // Gesture stopped (pointer up, or no wheel events for a beat): drop the GPU
  // layer and commit the live camera to React state, which repaints everything
  // sharp at the final position.
  function settleGesture() {
    if (!gestureActiveRef.current) return
    if (settleTimerRef.current != null) {
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
    if (gestureRafRef.current != null) {
      window.cancelAnimationFrame(gestureRafRef.current)
      gestureRafRef.current = null
    }
    clearCameraBitmapCache()
    gestureActiveRef.current = false
    setCamera(cameraRef.current)
  }

  function cancelPanInertia() {
    if (panInertiaRafRef.current != null) {
      window.cancelAnimationFrame(panInertiaRafRef.current)
      panInertiaRafRef.current = null
    }
  }

  function startPanInertia(velocityX: number, velocityY: number) {
    cancelPanInertia()
    if (prefersReducedMotion()) {
      settleGesture()
      return
    }
    let vx = velocityX
    let vy = velocityY
    const limited = limitPanVelocity(vx, vy)
    vx = limited.x
    vy = limited.y
    if (Math.hypot(vx, vy) < 0.08) {
      settleGesture()
      return
    }
    panInertiaLastTRef.current = performance.now()
    const step = (now: number) => {
      const dt = Math.min(32, Math.max(1, now - panInertiaLastTRef.current))
      panInertiaLastTRef.current = now
      const decay = Math.exp(-dt / 360)
      vx *= decay
      vy *= decay
      driveCameraRef.current({
        ...cameraRef.current,
        x: cameraRef.current.x + vx * dt,
        y: cameraRef.current.y + vy * dt,
      })
      if (Math.hypot(vx, vy) < 0.025) {
        panInertiaRafRef.current = null
        settleGesture()
        return
      }
      panInertiaRafRef.current = window.requestAnimationFrame(step)
    }
    panInertiaRafRef.current = window.requestAnimationFrame(step)
  }

  // Keep stable refs pointing at the latest gesture closures (so the wheel
  // listener, registered once, always calls the current ones), and — if
  // anything re-renders App mid-gesture (e.g. the FPS meter ticks) — re-assert
  // the live transform before the browser paints so it can't snap back to the
  // stale settled camera.
  useLayoutEffect(() => {
    driveCameraRef.current = driveCamera
    settleGestureRef.current = settleGesture
    if (gestureActiveRef.current) applyDomCamera()
  })

  useEffect(() => () => {
    if (gestureRafRef.current != null) window.cancelAnimationFrame(gestureRafRef.current)
    if (settleTimerRef.current != null) window.clearTimeout(settleTimerRef.current)
    if (dragRafRef.current != null) window.cancelAnimationFrame(dragRafRef.current)
    if (boardAnimRafRef.current != null) window.cancelAnimationFrame(boardAnimRafRef.current)
    if (focusAnimRef.current != null) window.cancelAnimationFrame(focusAnimRef.current)
    if (panInertiaRafRef.current != null) window.cancelAnimationFrame(panInertiaRafRef.current)
  }, [])

  // Track viewport size so culling has the current visible rectangle.
  useEffect(() => {
    function handleResize() {
      setViewport({ w: window.innerWidth, h: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Single canonical board paint. Reads the live animation frame, so an ordinary
  // state-driven repaint composes cleanly with any in-flight pulse/pop, and the
  // rAF loop below reuses the exact same draw through paintBoardRef.
  function withActiveLiftScales(frame: AnimFrame): AnimFrame {
    if (pressedNodeIdsRef.current.size === 0 && liftedNodeIdsRef.current.size === 0) return frame
    const liftScales = new Map(frame.liftScales)
    for (const id of pressedNodeIdsRef.current) {
      if (!boardAnimsRef.current.has(`press-in:${id}`)) {
        liftScales.set(id, Math.max(liftScales.get(id) ?? 1, 1.06))
      }
    }
    for (const id of liftedNodeIdsRef.current) {
      if (!boardAnimsRef.current.has(`lift-in:${id}`)) {
        liftScales.set(id, Math.max(liftScales.get(id) ?? 1, 1.1))
      }
    }
    return { ...frame, liftScales }
  }

  const paintBoard = (now?: number) => {
    const canvas = peopleCanvasRef.current
    const surface = surfaceRef.current
    if (!canvas || !surface) return
    const frame = withActiveLiftScales(readAnimFrame(boardAnimsRef.current, now ?? animNowRef.current))
    drawBoardLayer(
      canvas,
      surface,
      cameraRef.current,
      boardIndex,
      selectedItem,
      hoveredPersonId,
      hoveredConnId,
      connector,
      showCircleLabels,
      showPersonLabels,
      circleShapeMode,
      circleFillMode,
      selectedPeopleIds,
      marquee,
      selectedCircleIds,
      frame,
      handleExitNodesRef.current,
      hoveredCircleEdgeId,
    )
  }

  // Keep paintBoardRef pointing at the latest closure so the animation loop
  // (registered once per run) always repaints with current board state.
  useLayoutEffect(() => {
    paintBoardRef.current = paintBoard
  })

  // Drives one repaint per frame while any board animation is in flight, then
  // self-prunes finished animations and settles to a static frame. `now` is the
  // rAF timestamp (same clock origin as the lazily-anchored anim start times).
  function tickBoardAnims(now: number) {
    animNowRef.current = now
    let active = false
    let colorAnimActive = false
    for (const [key, a] of boardAnimsRef.current) {
      if (key.startsWith('color:')) colorAnimActive = true
      const start = a.start < 0 ? now : a.start // anchor on first frame
      if (now - start >= a.duration) {
        if (key.startsWith('handles-out:')) {
          handleExitNodesRef.current.delete(key.slice(12))
        }
        boardAnimsRef.current.delete(key)
      } else {
        if (a.start < 0) boardAnimsRef.current.set(key, { ...a, start })
        active = true
      }
    }



    paintBoardRef.current(now)
    if (colorAnimActive) setColorAnimTick((t) => t + 1)
    if (active) {
      boardAnimRafRef.current = window.requestAnimationFrame(tickBoardAnims)
    } else {
      boardAnimRafRef.current = null
    }
  }

  // Register (or restart) a transient board animation and ensure the loop runs.
  // start = -1 anchors to the rAF clock on the first frame (keeps clock reads
  // out of render-reachable code).
  function startBoardAnim(key: string, duration: number, morph?: CircleMorph) {
    if (prefersReducedMotion()) return
    boardAnimsRef.current.set(key, { start: -1, duration, morph })
    if (boardAnimRafRef.current == null) {
      boardAnimRafRef.current = window.requestAnimationFrame(tickBoardAnims)
    }
  }

  function startScalarBoardAnim(key: string, duration: number, fromValue: number, toValue: number) {
    if (prefersReducedMotion()) return
    boardAnimsRef.current.set(key, { start: -1, duration, fromValue, toValue })
    if (boardAnimRafRef.current == null) {
      boardAnimRafRef.current = window.requestAnimationFrame(tickBoardAnims)
    }
  }

  function startLiftFeedback(ids: string[]) {
    if (prefersReducedMotion()) return
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return
    for (const id of uniqueIds) {
      liftedNodeIdsRef.current.add(id)
      boardAnimsRef.current.delete(`lift-out:${id}`)
      startBoardAnim(`lift-in:${id}`, 140)
    }
  }

  function startPressFeedback(ids: string[]) {
    if (prefersReducedMotion()) return
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return
    for (const id of uniqueIds) {
      pressedNodeIdsRef.current.add(id)
      boardAnimsRef.current.delete(`press-out:${id}`)
      startBoardAnim(`press-in:${id}`, 110)
    }
  }

  function stopPressFeedback(ids: string[]) {
    if (prefersReducedMotion()) return
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return
    for (const id of uniqueIds) {
      const wasPressed = pressedNodeIdsRef.current.has(id) || boardAnimsRef.current.has(`press-in:${id}`)
      if (!wasPressed) continue
      pressedNodeIdsRef.current.delete(id)
      boardAnimsRef.current.delete(`press-in:${id}`)
      startBoardAnim(`press-out:${id}`, 210)
    }
  }

  function stopLiftFeedback(ids: string[]) {
    if (prefersReducedMotion()) return
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return
    for (const id of uniqueIds) {
      const wasLifted = liftedNodeIdsRef.current.has(id) || boardAnimsRef.current.has(`lift-in:${id}`)
      if (!wasLifted) continue
      liftedNodeIdsRef.current.delete(id)
      boardAnimsRef.current.delete(`lift-in:${id}`)
      startBoardAnim(`lift-out:${id}`, 180)
    }
  }

  function currentEdgeHoverLevel(circleId: string) {
    const level = readAnimFrame(boardAnimsRef.current, animNowRef.current).edgeHoverReveal.get(circleId)
    if (level !== undefined) return level
    return edgeHoverCircleIdRef.current === circleId ? 1 : 0
  }

  function animateEdgeHoverTo(circleId: string, target: number) {
    const from = currentEdgeHoverLevel(circleId)
    if (Math.abs(from - target) < 0.02) {
      boardAnimsRef.current.delete(`edge-hover:${circleId}`)
      return
    }
    startScalarBoardAnim(`edge-hover:${circleId}`, EDGE_HOVER_ANIM_MS, from, target)
  }

  // Repaint the people canvas whenever the settled camera, people, viewport or
  // interactive set changes. (Gesture frames are handled imperatively above.)
  useEffect(() => {
    paintBoard()
    // paintBoard reads all of these from the current render closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    camera,
    viewport,
    boardIndex,
    selectedItem,
    hoveredPersonId,
    hoveredConnId,
    connector,
    showCircleLabels,
    showPersonLabels,
    circleShapeMode,
    circleFillMode,
    selectedPeopleIds,
    imageEpoch,
    marquee,
    selectedCircleIds,
    hoveredCircleEdgeId,
    viewMode,
  ])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return

    function handleWheel(event: WheelEvent) {
      event.preventDefault()
      const activeSurface = surfaceRef.current
      if (!activeSurface) return
      const rect = activeSurface.getBoundingClientRect()
      if (!rect) return

      const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const currentCamera = cameraRef.current
      const before = {
        x: (pointer.x - currentCamera.x) / currentCamera.scale,
        y: (pointer.y - currentCamera.y) / currentCamera.scale,
      }

      if (event.ctrlKey) {
        const zoomIntensity = 0.015
        const nextScale = clamp(currentCamera.scale * Math.exp(-event.deltaY * zoomIntensity), MIN_SCALE, MAX_SCALE)
        driveCameraRef.current({
          scale: nextScale,
          x: pointer.x - before.x * nextScale,
          y: pointer.y - before.y * nextScale,
        })
      } else {
        driveCameraRef.current({
          ...currentCamera,
          x: currentCamera.x - event.deltaX,
          y: currentCamera.y - event.deltaY,
        })
      }
      completeOnboardingAction('navigate')
    }

    surface.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      surface.removeEventListener('wheel', handleWheel)
    }
  }, [viewMode])

  function screenToWorld(point: { x: number; y: number }) {
    const liveCamera = cameraRef.current
    return {
      x: (point.x - liveCamera.x) / liveCamera.scale,
      y: (point.y - liveCamera.y) / liveCamera.scale,
    }
  }

  // Coalesce drag-driven state updates to one commit per frame. Each move stores
  // the latest absolute target (updaters/connector are not cumulative), and a
  // single rAF flushes it — so a 120 Hz move stream becomes <=60 re-renders/s.
  function scheduleDrag() {
    if (dragRafRef.current != null) return
    dragRafRef.current = window.requestAnimationFrame(() => {
      dragRafRef.current = null
      const update = pendingGraphRef.current
      pendingGraphRef.current = null
      if (update) setGraph(update)
      const conn = pendingConnectorRef.current
      pendingConnectorRef.current = null
      if (conn) setConnector(conn)
    })
  }



  // Set the board cursor imperatively (avoids a re-render). The hand only shows
  // while a real pan/drag is happening; resting and clicking keep the arrow, and
  // anything interactive under the pointer shows the pointer cursor.
  function setSurfaceCursor(value: string) {
    const surface = surfaceRef.current
    if (surface && surface.style.cursor !== value) surface.style.cursor = value
  }

  function startBoardPan(event: ReactPointerEvent<HTMLDivElement>) {
    cancelPanInertia()
    setSelectedPeopleIds([])
    setSelectedCircleIds([])
    selectItem(null)
    setOpenNotesPersonId(null)
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: cameraRef.current.x,
      originY: cameraRef.current.y,
      lastX: event.clientX,
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocityX: 0,
      velocityY: 0,
      moved: false,
    }
    setSurfaceCursor('grabbing')
  }

  function handleSurfacePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch' && event.button !== 0 && event.button !== 2) return
    const isRightClick = event.pointerType !== 'touch' && event.button === 2
    isRightClickDragRef.current = isRightClick
    if (isRightClick) rightClickMarqueeMovedRef.current = false
    cancelPanInertia()



    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)

    activePointersRef.current = [
      ...activePointersRef.current.filter((p) => p.pointerId !== event.pointerId),
      event.nativeEvent,
    ]

    if (activePointersRef.current.length >= 2) {
      stopPressFeedback([
        ...(moveCircleRef.current?.liftIds ?? []),
        ...(movePersonRef.current?.liftIds ?? []),
        ...(resizeCircleRef.current ? [resizeCircleRef.current.circleId] : []),
        ...(connector ? [connector.sourceId] : []),
      ])
      stopLiftFeedback([
        ...(moveCircleRef.current?.liftIds ?? []),
        ...(movePersonRef.current?.liftIds ?? []),
      ])
      panRef.current = null
      moveCircleRef.current = null
      movePersonRef.current = null
      resizeCircleRef.current = null
      setConnector(null)
      pendingConnectorRef.current = null
      pendingGraphRef.current = null
      if (dragRafRef.current != null) {
        window.cancelAnimationFrame(dragRafRef.current)
        dragRafRef.current = null
      }
      if (marqueeRef.current) {
        marqueeRef.current = null
        setMarquee(null)
      }

      const p1 = activePointersRef.current[0]
      const p2 = activePointersRef.current[1]
      const rect = event.currentTarget.getBoundingClientRect()
      const lp1 = { x: p1.clientX - rect.left, y: p1.clientY - rect.top }
      const lp2 = { x: p2.clientX - rect.left, y: p2.clientY - rect.top }
      const initialDist = Math.hypot(lp1.x - lp2.x, lp1.y - lp2.y)
      const initialMid = {
        x: (lp1.x + lp2.x) / 2,
        y: (lp1.y + lp2.y) / 2,
      }
      const initialCamera = { ...cameraRef.current }
      pinchRef.current = {
        initialDist,
        initialMid,
        initialCamera,
        midWorld: {
          x: (initialMid.x - initialCamera.x) / initialCamera.scale,
          y: (initialMid.y - initialCamera.y) / initialCamera.scale,
        },
      }
      return
    }

    if (boardToolMode === 'pan' && !isRightClick) {
      setCreateMenu(null)
      startBoardPan(event)
      return
    }

    setCreateMenu(null)
    setOpenNotesPersonId(null)
    // A fresh gesture hasn't recorded its undo snapshot yet.
    gestureSnapshotTakenRef.current = false

    const hit = hitTestBoard(boardIndex, cameraRef.current, selectedItem, {
      x: event.clientX,
      y: event.clientY,
    }, hoveredCircleEdgeIdRef.current)

    if (hit?.type === 'connector-handle') {
      if (isRightClick) return
      if (boardToolMode === 'select') return
      startConnector(event, hit.sourceId, hit.sourceType, hit.x, hit.y)
      return
    }

    if (hit?.type === 'person') {
      if (isRightClick) {
        setGraph((current) => ({
          ...current,
          people: current.people.map((p) => p.id === hit.person.id ? { ...p, circleId: '' } : p),
          connections: (current.connections || []).filter(
            (conn) => conn.fromId !== hit.person.id && conn.toId !== hit.person.id
          ),
        }))
        setSelectedPeopleIds([])
        setSelectedCircleIds([])
        selectItem({ type: 'person', id: hit.person.id })
        startPersonMove(event, hit.person)
      } else {
        if (event.shiftKey || boardToolMode === 'select') {
          setSelectedPeopleIds((prev) => {
            let next = [...prev]
            if (selectedItem?.type === 'person' && !next.includes(selectedItem.id)) {
              next.push(selectedItem.id)
            }
            if (next.includes(hit.person.id)) {
              next = next.filter((id) => id !== hit.person.id)
            } else {
              next.push(hit.person.id)
            }
            return next
          })
          selectItem(null)
        } else {
          pendingSelectRef.current = { type: 'person', id: hit.person.id }
          if (!selectedPeopleIds.includes(hit.person.id)) {
            setSelectedPeopleIds([])
            setSelectedCircleIds([])
          }
          startPersonMove(event, hit.person)
        }
      }
      return
    }

    if (hit?.type === 'circle-center') {
      if (isRightClick) {
        setGraph((current) => ({
          ...current,
          circles: current.circles.map((c) =>
            c.id === hit.circle.id ? { ...c, parentId: null, connectedTo: null } : c
          ),
          connections: (current.connections || []).filter(
            (conn) => conn.fromId !== hit.circle.id && conn.toId !== hit.circle.id
          ),
        }))
        setSelectedPeopleIds([])
        setSelectedCircleIds([])
        selectItem({ type: 'circle', id: hit.circle.id, showHandles: true })
        startCircleMove(event, hit.circle)
      } else {
        if (event.shiftKey || boardToolMode === 'select') {
          setSelectedCircleIds((prev) => {
            let next = [...prev]
            if (selectedItem?.type === 'circle' && !next.includes(selectedItem.id)) {
              next.push(selectedItem.id)
            }
            if (next.includes(hit.circle.id)) {
              next = next.filter((id) => id !== hit.circle.id)
            } else {
              next.push(hit.circle.id)
            }
            return next
          })
          selectItem(null)
        } else {
          pendingSelectRef.current = { type: 'circle', id: hit.circle.id, showHandles: true }
          if (!selectedCircleIds.includes(hit.circle.id)) {
            setSelectedPeopleIds([])
            setSelectedCircleIds([])
          }
          const isGroupDrag =
            selectedCircleIds.includes(hit.circle.id) &&
            selectedCircleIds.length + selectedPeopleIds.length > 1
          if (centerBehavior === 'connect' && !isGroupDrag) {
            startConnector(event, hit.circle.id, 'circle', hit.circle.x, hit.circle.y)
          } else {
            startCircleMove(event, hit.circle)
          }
        }
      }
      return
    }

    if (isRightClick || (boardToolMode === 'select' && (!hit || hit.type === 'circle-body' || hit.type === 'circle-edge' || hit.type === 'connection'))) {
      if (!event.shiftKey) {
        setSelectedPeopleIds([])
        setSelectedCircleIds([])
        selectItem(null)
      }
      setOpenNotesPersonId(null)
      pendingSelectRef.current = null
      const marqueeState = {
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
      }
      marqueeRef.current = marqueeState
      setMarquee(marqueeState)
      return
    }

    if (hit?.type === 'circle-edge') {
      setSelectedPeopleIds([])
      setSelectedCircleIds([])
      pendingSelectRef.current = null
      startCircleResize(event, hit.circle)
      return
    }

    if (hit?.type === 'circle-body') {
      if (event.shiftKey) {
        setSelectedCircleIds((prev) => {
          let next = [...prev]
          if (selectedItem?.type === 'circle' && !next.includes(selectedItem.id)) {
            next.push(selectedItem.id)
          }
          if (next.includes(hit.circle.id)) {
            next = next.filter((id) => id !== hit.circle.id)
          } else {
            next.push(hit.circle.id)
          }
          return next
        })
        selectItem(null)
      } else {
        pendingSelectRef.current = { type: 'circle', id: hit.circle.id, showHandles: false }
        if (!selectedCircleIds.includes(hit.circle.id)) {
          setSelectedPeopleIds([])
          setSelectedCircleIds([])
        }
        startCircleMove(event, hit.circle)
      }
      return
    }

    if (hit?.type === 'connection') {
      setSelectedPeopleIds([])
      setSelectedCircleIds([])
      pendingSelectRef.current = { type: 'connection', id: hit.connection.id }
      event.currentTarget.setPointerCapture(event.pointerId)
      panRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: cameraRef.current.x,
        originY: cameraRef.current.y,
        lastX: event.clientX,
        lastY: event.clientY,
        lastT: event.timeStamp,
        velocityX: 0,
        velocityY: 0,
        moved: false,
      }
      return
    }

    setSelectedPeopleIds([])
    setSelectedCircleIds([])
    selectItem(null)
    setOpenNotesPersonId(null)
    pendingSelectRef.current = null
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: cameraRef.current.x,
      originY: cameraRef.current.y,
      lastX: event.clientX,
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocityX: 0,
      velocityY: 0,
      moved: false,
    }
  }

  function handleSurfacePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    activePointersRef.current = activePointersRef.current.map((p) =>
      p.pointerId === event.pointerId ? event.nativeEvent : p
    )




    if (marqueeRef.current) {
      marqueeRef.current.currentX = event.clientX
      marqueeRef.current.currentY = event.clientY
      if (isRightClickDragRef.current) {
        const distance = Math.hypot(
          event.clientX - marqueeRef.current.startX,
          event.clientY - marqueeRef.current.startY,
        )
        if (distance > DRAG_START_THRESHOLD) rightClickMarqueeMovedRef.current = true
      }
      setMarquee({ ...marqueeRef.current })
      setSurfaceCursor('crosshair')
      return
    }

    if (activePointersRef.current.length >= 2 && !pinchRef.current) {
      const p1 = activePointersRef.current[0]
      const p2 = activePointersRef.current[1]
      const rect = event.currentTarget.getBoundingClientRect()
      const lp1 = { x: p1.clientX - rect.left, y: p1.clientY - rect.top }
      const lp2 = { x: p2.clientX - rect.left, y: p2.clientY - rect.top }
      const initialDist = Math.hypot(lp1.x - lp2.x, lp1.y - lp2.y)
      const initialMid = {
        x: (lp1.x + lp2.x) / 2,
        y: (lp1.y + lp2.y) / 2,
      }
      const initialCamera = { ...cameraRef.current }
      pinchRef.current = {
        initialDist,
        initialMid,
        initialCamera,
        midWorld: {
          x: (initialMid.x - initialCamera.x) / initialCamera.scale,
          y: (initialMid.y - initialCamera.y) / initialCamera.scale,
        },
      }
    }

    const pinch = pinchRef.current
    if (pinch && activePointersRef.current.length >= 2) {
      const p1 = activePointersRef.current[0]
      const p2 = activePointersRef.current[1]
      const rect = event.currentTarget.getBoundingClientRect()
      const lp1 = { x: p1.clientX - rect.left, y: p1.clientY - rect.top }
      const lp2 = { x: p2.clientX - rect.left, y: p2.clientY - rect.top }
      const newDist = Math.hypot(lp1.x - lp2.x, lp1.y - lp2.y)
      const newMid = {
        x: (lp1.x + lp2.x) / 2,
        y: (lp1.y + lp2.y) / 2,
      }

      const scaleFactor = pinch.initialDist > 5 ? newDist / pinch.initialDist : 1
      const nextScale = clamp(pinch.initialCamera.scale * scaleFactor, MIN_SCALE, MAX_SCALE)

      const nextX = newMid.x - pinch.midWorld.x * nextScale
      const nextY = newMid.y - pinch.midWorld.y * nextScale

      driveCamera({
        scale: nextScale,
        x: nextX,
        y: nextY,
      })
      completeOnboardingAction('navigate')
      return
    }

    const pan = panRef.current
    if (pan?.pointerId === event.pointerId) {
      const now = event.timeStamp
      const dt = Math.max(1, now - pan.lastT)
      const dx = event.clientX - pan.lastX
      const dy = event.clientY - pan.lastY
      const velocity = limitPanVelocity(dx / dt, dy / dt)
      pan.velocityX = velocity.x
      pan.velocityY = velocity.y
      pan.lastX = event.clientX
      pan.lastY = event.clientY
      pan.lastT = now
      if (Math.hypot(event.clientX - pan.startX, event.clientY - pan.startY) > DRAG_START_THRESHOLD) {
        suppressDoubleClickUntilRef.current = Date.now() + 700
        if (!pan.moved) completeOnboardingAction('navigate')
        pan.moved = true
      }
      driveCamera({
        ...cameraRef.current,
        x: pan.originX + event.clientX - pan.startX,
        y: pan.originY + event.clientY - pan.startY,
      })
    }

    // During a drag, coalesce graph updates to one animation-frame commit. Do not
    // run global layout here: on imported boards it is O(n^2) and makes every
    // pointer frame rewrite the whole board.
    const moving = moveCircleRef.current
    if (moving?.pointerId === event.pointerId) {
      const moveDistance = Math.hypot(event.clientX - moving.startX, event.clientY - moving.startY)
      if (moveDistance <= DRAG_START_THRESHOLD) return
      if (!moving.moved) {
        moving.moved = true
        suppressDoubleClickUntilRef.current = Date.now() + 700
      }
      if (!moving.liftStarted) {
        moving.liftStarted = true
        startLiftFeedback(moving.liftIds)
      }
      ensureGestureSnapshot()
      const deltaX = (event.clientX - moving.lastX) / camera.scale
      const deltaY = (event.clientY - moving.lastY) / camera.scale
      moving.lastX = event.clientX
      moving.lastY = event.clientY
      const base = moving.graphSnapshot || graph
      const targets = moving.disconnectedCircleIds || [moving.circleId]

      const subtreeIds = new Set<string>()
      for (const cid of targets) {
        subtreeIds.add(cid)
        for (const descId of getDescendantCircleIds(base.circles, cid)) {
          subtreeIds.add(descId)
        }
      }

      const draggedPersonIds = new Set<string>()
      if (moving.personOrigins) {
        for (const pid in moving.personOrigins) {
          draggedPersonIds.add(pid)
        }
      }

      resolveCircleOnlyLayoutInPlace(
        boardIndexRef.current,
        subtreeIds,
        draggedPersonIds,
        deltaX,
        deltaY,
      )
      paintBoard()


    }

    const movingPerson = movePersonRef.current
    if (movingPerson?.pointerId === event.pointerId) {
      const moveDistance = Math.hypot(event.clientX - movingPerson.startX, event.clientY - movingPerson.startY)
      if (moveDistance <= DRAG_START_THRESHOLD) return
      if (!movingPerson.moved) {
        movingPerson.moved = true
        suppressDoubleClickUntilRef.current = Date.now() + 700
      }
      if (!movingPerson.liftStarted) {
        movingPerson.liftStarted = true
        startLiftFeedback(movingPerson.liftIds)
      }
      ensureGestureSnapshot()
      const deltaX = (event.clientX - movingPerson.lastX) / camera.scale
      const deltaY = (event.clientY - movingPerson.lastY) / camera.scale
      movingPerson.lastX = event.clientX
      movingPerson.lastY = event.clientY
      const { selectedOrigins, circleOrigins } = movingPerson

      movePersonInPlace(
        boardIndexRef.current,
        selectedOrigins || null,
        circleOrigins || null,
        movingPerson.personId,
        deltaX,
        deltaY,
      )
      paintBoard()


    }

    const resizing = resizeCircleRef.current
    if (resizing?.pointerId === event.pointerId) {
      const moveDistance = Math.hypot(event.clientX - (resizing.startX ?? event.clientX), event.clientY - (resizing.startY ?? event.clientY))
      if (moveDistance > DRAG_START_THRESHOLD) {
        suppressDoubleClickUntilRef.current = Date.now() + 700
        stopPressFeedback([resizing.circleId])
      }
      ensureGestureSnapshot()
      const world = screenToWorld({ x: event.clientX, y: event.clientY })

      resizeCircleFromPointInPlace(
        boardIndexRef.current,
        resizing.circleId,
        world,
      )
      paintBoard()


    }

    if (connector) {
      const world = screenToWorld({ x: event.clientX, y: event.clientY })
      if (Math.hypot(world.x - connector.startX, world.y - connector.startY) * cameraRef.current.scale > DRAG_START_THRESHOLD) {
        suppressDoubleClickUntilRef.current = Date.now() + 700
      }
      pendingConnectorRef.current = { ...connector, endX: world.x, endY: world.y }
      scheduleDrag()
      setSurfaceCursor('grabbing')
      return
    }

    // Cursor handling based on active state / hover
    if (pan || moving || movingPerson) {
      setSurfaceCursor('grabbing')
    } else if (resizing) {
      const circle = graph.circles.find((c) => c.id === resizing.circleId)
      if (circle) {
        const world = screenToWorld({ x: event.clientX, y: event.clientY })
        setSurfaceCursor(getResizeCursor(world, circle))
      }
    } else {
      const hit = hitTestBoard(boardIndex, cameraRef.current, selectedItem, {
        x: event.clientX,
        y: event.clientY,
      }, hoveredCircleEdgeIdRef.current)
      if (hit?.type === 'circle-edge') {
        const world = screenToWorld({ x: event.clientX, y: event.clientY })
        setSurfaceCursor(getResizeCursor(world, hit.circle))
      } else if (hit?.type === 'person' || hit?.type === 'circle-center' || hit?.type === 'connection' || hit?.type === 'connector-handle') {
        setSurfaceCursor('pointer')
      } else {
        setSurfaceCursor('default')
      }
    }

    // Idle hover is canvas hit-testing now; React only stores the hovered ids.
    if (!pan && !moving && !movingPerson && !resizing) {
      const world = screenToWorld({ x: event.clientX, y: event.clientY })
      const hit = hitTestBoard(boardIndex, cameraRef.current, selectedItem, {
        x: event.clientX,
        y: event.clientY,
      }, hoveredCircleEdgeIdRef.current)
      const id = hit?.type === 'person' ? hit.person.id : null
      if (id !== hoveredPersonId) setHoveredPersonId(id)
      const connId = hit?.type === 'connection' ? hit.connection.id : null
      if (connId !== hoveredConnId) setHoveredConnId(connId)
      const edgeId = resolveCircleEdgeHover(boardIndex, world, cameraRef.current.scale, hoveredCircleEdgeIdRef.current)
      if (edgeId !== hoveredCircleEdgeIdRef.current) {
        hoveredCircleEdgeIdRef.current = edgeId
        setHoveredCircleEdgeId(edgeId)
      }
    } else {
      if (hoveredPersonId) setHoveredPersonId(null)
      if (hoveredConnId) setHoveredConnId(null)
      if (hoveredCircleEdgeIdRef.current) {
        hoveredCircleEdgeIdRef.current = null
        setHoveredCircleEdgeId(null)
      }
    }
  }

  function handleSurfacePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    activePointersRef.current = activePointersRef.current.filter((p) => p.pointerId !== event.pointerId)
    if (activePointersRef.current.length < 2) {
      pinchRef.current = null
    }

    // Gesture is ending: drop the hand and restore the idle cursor based on what's
    // under the pointer now.
    const upHit = hitTestBoard(boardIndex, cameraRef.current, selectedItem, {
      x: event.clientX,
      y: event.clientY,
    }, hoveredCircleEdgeIdRef.current)
    setSurfaceCursor(upHit ? 'pointer' : 'default')

    if (marqueeRef.current) {
      const startX = marqueeRef.current.startX
      const startY = marqueeRef.current.startY
      const currentX = event.clientX
      const currentY = event.clientY

      const distance = Math.hypot(currentX - startX, currentY - startY)
      if (distance > DRAG_START_THRESHOLD) {
        const pStart = screenToWorld({ x: Math.min(startX, currentX), y: Math.min(startY, currentY) })
        const pEnd = screenToWorld({ x: Math.max(startX, currentX), y: Math.max(startY, currentY) })

        const selectedPIds = graph.people
          .filter((p) => p.x >= pStart.x && p.x <= pEnd.x && p.y >= pStart.y && p.y <= pEnd.y)
          .map((p) => p.id)

        const selectedCIds = graph.circles
          .filter((c) => c.id !== 'you' && c.x >= pStart.x && c.x <= pEnd.x && c.y >= pStart.y && c.y <= pEnd.y)
          .map((c) => c.id)

        if (event.shiftKey) {
          setSelectedPeopleIds((prev) => Array.from(new Set([...prev, ...selectedPIds])))
          setSelectedCircleIds((prev) => Array.from(new Set([...prev, ...selectedCIds])))
        } else {
          setSelectedPeopleIds(selectedPIds)
          setSelectedCircleIds(selectedCIds)
        }
        selectItem(null)
        completeOnboardingAction('select')
      } else {
        const hit = hitTestBoard(boardIndex, cameraRef.current, selectedItem, {
          x: startX,
          y: startY,
        }, hoveredCircleEdgeIdRef.current)

        if (hit?.type === 'circle-body' || hit?.type === 'circle-edge') {
          setSelectedCircleIds((prev) => {
            let next = [...prev]
            if (selectedItem?.type === 'circle' && !next.includes(selectedItem.id)) {
              next.push(selectedItem.id)
            }
            if (next.includes(hit.circle.id)) {
              next = next.filter((id) => id !== hit.circle.id)
            } else {
              next.push(hit.circle.id)
            }
            return next
          })
          if (!event.shiftKey) {
            setSelectedPeopleIds([])
          }
          selectItem(null)
        } else if (hit?.type === 'connection') {
          if (!event.shiftKey) {
            setSelectedPeopleIds([])
            setSelectedCircleIds([])
          }
          selectItem({ type: 'connection', id: hit.connection.id })
        } else {
          if (!event.shiftKey) {
            setSelectedPeopleIds([])
            setSelectedCircleIds([])
            selectItem(null)
          }
        }
      }

      marqueeRef.current = null
      setMarquee(null)
      settleGesture()
      isRightClickDragRef.current = false
      return
    }

    const activePan = panRef.current?.pointerId === event.pointerId ? panRef.current : null
    if (activePan) {
      panRef.current = null
      if (activePointersRef.current.length === 0 && activePan.moved) {
        startPanInertia(activePan.velocityX, activePan.velocityY)
      } else {
        settleGesture()
      }
    } else if (activePointersRef.current.length === 0) {
      settleGesture()
    }

    const activeMoveCircle = moveCircleRef.current?.pointerId === event.pointerId ? moveCircleRef.current : null
    const activeMovePerson = movePersonRef.current?.pointerId === event.pointerId ? movePersonRef.current : null
    const activeResizeCircle = resizeCircleRef.current?.pointerId === event.pointerId ? resizeCircleRef.current : null
    const endingLiftIds = [
      ...(activeMoveCircle?.liftIds ?? []),
      ...(activeMovePerson?.liftIds ?? []),
    ]

    const movingCircleId = activeMoveCircle ? activeMoveCircle.circleId : null
    const disconnectedCircleIds = activeMoveCircle ? activeMoveCircle.disconnectedCircleIds : null
    const wasRightClickDrag = isRightClickDragRef.current

    const resizeMoveDist = activeResizeCircle
      ? Math.hypot(event.clientX - (activeResizeCircle.startX ?? event.clientX), event.clientY - (activeResizeCircle.startY ?? event.clientY))
      : 0
    const wasResize = activeResizeCircle !== null
    const completedResize = wasResize && resizeMoveDist > DRAG_START_THRESHOLD
    const completedNodeMove = (activeMoveCircle?.moved ?? false) || (activeMovePerson?.moved ?? false)
    const endingMove = completedNodeMove || completedResize
    if (completedResize || completedNodeMove) {
      completeOnboardingAction('organize')
    }
    const endingPressIds = [
      ...(activeMoveCircle?.liftIds ?? []),
      ...(activeMovePerson?.liftIds ?? []),
      ...(activeResizeCircle ? [activeResizeCircle.circleId] : []),
    ]

    if (moveCircleRef.current?.pointerId === event.pointerId) moveCircleRef.current = null
    if (movePersonRef.current?.pointerId === event.pointerId) movePersonRef.current = null
    if (resizeCircleRef.current?.pointerId === event.pointerId) resizeCircleRef.current = null
    stopPressFeedback(endingPressIds)
    stopLiftFeedback(endingLiftIds)

    if (endingMove) {
      const nextResolved = {
        ...graph,
        circles: graph.circles.map((c) => {
          const indexC = boardIndexRef.current.circlesById.get(c.id)
          return indexC ? { ...c, x: indexC.x, y: indexC.y, radius: indexC.radius, minRadius: indexC.minRadius } : c
        }),
        people: graph.people.map((p) => {
          const indexP = boardIndexRef.current.peopleById.get(p.id)
          return indexP ? { ...p, x: indexP.x, y: indexP.y, circleId: indexP.circleId } : p
        }),
      }
      setGraph(() => {
        let next = nextResolved
        if (wasRightClickDrag && movingCircleId) {
          const draggedCircleIds = disconnectedCircleIds || [movingCircleId]
          let nextCircles = next.circles
          for (const cid of draggedCircleIds) {
            const circlesById = new Map(nextCircles.map((c) => [c.id, c]))
            const isDescendant = (childId: string, parentId: string): boolean => {
              let curr: string | null = childId
              while (curr) {
                if (curr === parentId) return true
                curr = circlesById.get(curr)?.parentId ?? null
              }
              return false
            }
            const circle = nextCircles.find((c) => c.id === cid)
            if (circle) {
              const innermost = nextCircles
                .filter((c) => c.id !== cid && !isDescendant(c.id, cid) && Math.hypot(circle.x - c.x, circle.y - c.y) <= c.radius)
                .sort((a, b) => a.radius - b.radius)[0]
              const nextParentId = innermost ? innermost.id : null
              nextCircles = nextCircles.map((c) => c.id === cid ? { ...c, parentId: nextParentId } : c)
            }
          }
          next = { ...next, circles: nextCircles }
        }
        return settleInteractionGraph(next)
      })
      isRightClickDragRef.current = false
      settleGesture()
    }

    if (pendingSelectRef.current) {
      if (boardToolMode !== 'select') {
        const pendingSelection = pendingSelectRef.current
        const selectionChanged =
          pendingSelection.type !== selectedItem?.type ||
          pendingSelection.id !== selectedItem?.id ||
          (pendingSelection.type === 'circle' &&
            selectedItem?.type === 'circle' &&
            pendingSelection.showHandles !== selectedItem.showHandles)

        selectItem(pendingSelection)

        const dragDistance = activeMovePerson
          ? Math.hypot(event.clientX - activeMovePerson.startX, event.clientY - activeMovePerson.startY)
          : activeMoveCircle
            ? Math.hypot(event.clientX - activeMoveCircle.startX, event.clientY - activeMoveCircle.startY)
            : panRef.current?.pointerId === event.pointerId
              ? Math.hypot(event.clientX - panRef.current.startX, event.clientY - panRef.current.startY)
              : 0

        if (dragDistance < 25) {
          if (pendingSelection.type === 'person') {
            const person = graph.people.find((p) => p.id === pendingSelection.id)
            if (person) {
              const now = Date.now()
              const lastTap = lastPersonTapRef.current
              const isDoubleTap =
                lastTap?.personId === person.id &&
                now - lastTap.time <= PERSON_DOUBLE_TAP_MS &&
                Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) <= PERSON_DOUBLE_TAP_DISTANCE

              if (isDoubleTap) {
                lastPersonTapRef.current = null
                requestInspectorNameFocus(person.id)
              } else {
                lastPersonTapRef.current = {
                  personId: person.id,
                  time: now,
                  x: event.clientX,
                  y: event.clientY,
                }
              }

              if (selectionChanged) {
                focusCameraOnWorld(person.x, person.y, cameraRef.current.scale)
              }
            }
          } else if (pendingSelection.type === 'circle') {
            const circle = graph.circles.find((c) => c.id === pendingSelection.id)
            if (circle && selectionChanged) {
              focusCameraOnWorld(circle.x, circle.y, cameraRef.current.scale)
            }
          }
        }
      }
      pendingSelectRef.current = null
    }

    // Resolve the connector against its latest endpoint (which may still be queued
    // in the drag rAF), then clear any pending frame.
    const conn = pendingConnectorRef.current ?? connector
    pendingConnectorRef.current = null
    if (dragRafRef.current != null) {
      window.cancelAnimationFrame(dragRafRef.current)
      dragRafRef.current = null
    }
    if (!conn) return
    stopPressFeedback([conn.sourceId])

    if (cameraRef.current.scale < ZONE_ONLY_SCALE) {
      setConnector(null)
      return
    }

    const distance = Math.hypot(conn.endX - conn.startX, conn.endY - conn.startY)
    if (distance > CONNECT_THRESHOLD) {
      const targetPerson = graph.people.find((p) => Math.hypot(p.x - conn.endX, p.y - conn.endY) < 30)
      const targetCircle = graph.circles.find((c) => Math.hypot(c.x - conn.endX, c.y - conn.endY) < 30)

      if (targetPerson && targetPerson.id !== conn.sourceId) {
        if (!graphHasConnectionBetween(graph, conn.sourceId, targetPerson.id)) {
          pushHistory()
          setGraph((current) => appendGraphConnection(current, conn.sourceId, targetPerson.id))
        }
      } else if (targetCircle && targetCircle.id !== conn.sourceId) {
        if (!graphHasConnectionBetween(graph, conn.sourceId, targetCircle.id)) {
          pushHistory()
          if (conn.sourceType === 'circle') {
            setGraph((current) => {
              const srcCircle = current.circles.find((c) => c.id === conn.sourceId)
              if (srcCircle && !srcCircle.connectedTo) {
                return {
                  ...current,
                  circles: current.circles.map((c) =>
                    c.id === conn.sourceId ? { ...c, connectedTo: targetCircle.id } : c
                  ),
                }
              } else {
                return appendGraphConnection(current, conn.sourceId, targetCircle.id)
              }
            })
          } else {
            setGraph((current) => appendGraphConnection(current, conn.sourceId, targetCircle.id))
          }
        }
      } else {
        if (conn.sourceType === 'circle') {
          setCreateMenu({
            sourceCircleId: conn.sourceId,
            x: conn.endX,
            y: conn.endY,
            screenX: event.clientX,
            screenY: event.clientY,
            dragSourceId: conn.sourceId,
            dragSourceType: 'circle',
          })
        } else if (conn.sourceType === 'person') {
          const person = graph.people.find((p) => p.id === conn.sourceId)
          const sourceCircleId = person ? person.circleId : 'you'
          setCreateMenu({
            sourceCircleId,
            x: conn.endX,
            y: conn.endY,
            screenX: event.clientX,
            screenY: event.clientY,
            dragSourceId: conn.sourceId,
            dragSourceType: 'person',
          })
        }
      }
    }
    setConnector(null)
  }

  function handleSurfaceContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault()

    const hit = hitTestBoard(boardIndex, cameraRef.current, selectedItem, {
      x: event.clientX,
      y: event.clientY,
    }, hoveredCircleEdgeIdRef.current)
    if (hit?.type !== 'circle-body' && hit?.type !== 'circle-edge' && hit?.type !== 'circle-center') return
    if (rightClickMarqueeMovedRef.current) return

    selectItem({ type: 'circle', id: hit.circle.id })
    const world = screenToWorld({ x: event.clientX, y: event.clientY })
    setCreateMenu({
      sourceCircleId: hit.circle.id,
      x: world.x,
      y: world.y,
      screenX: event.clientX,
      screenY: event.clientY,
    })
  }

  function startConnector(
    event: ReactPointerEvent<HTMLElement>,
    sourceId: string,
    sourceType: 'circle' | 'person',
    startX: number,
    startY: number
  ) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setCreateMenu(null)
    selectItem({ type: sourceType, id: sourceId })
    setConnector({
      sourceId,
      sourceType,
      startX,
      startY,
      endX: startX,
      endY: startY,
    })
    startPressFeedback([sourceId])
  }

  function startCircleMove(event: ReactPointerEvent<Element>, circle: CircleNode) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)

    const draggingSelection = selectedCircleIds.includes(circle.id)
    const targets = draggingSelection ? selectedCircleIds : [circle.id]
    const subtreeIds = new Set<string>()
    for (const cid of targets) {
      subtreeIds.add(cid)
      for (const descId of getDescendantCircleIds(graph.circles, cid)) {
        subtreeIds.add(descId)
      }
    }

    const circleOrigins: Record<string, { x: number; y: number }> = {}
    const personOrigins: Record<string, { x: number; y: number }> = {}
    for (const c of graph.circles) {
      if (subtreeIds.has(c.id)) circleOrigins[c.id] = { x: c.x, y: c.y }
    }
    for (const p of graph.people) {
      if (subtreeIds.has(p.circleId)) personOrigins[p.id] = { x: p.x, y: p.y }
    }

    // Mixed selection: drag any loosely-selected people along with the zones.
    if (draggingSelection) {
      for (const pid of selectedPeopleIds) {
        const p = boardIndex.peopleById.get(pid)
        if (p && !(p.id in personOrigins)) personOrigins[p.id] = { x: p.x, y: p.y }
      }
    }

    moveCircleRef.current = {
      pointerId: event.pointerId,
      circleId: circle.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: circle.x,
      originY: circle.y,
      circleOrigins,
      personOrigins,
      disconnectedCircleIds: targets,
      liftIds: targets,
      liftStarted: false,
      moved: false,
      graphSnapshot: {
        ...graph,
        circles: graph.circles.map((c) => ({ ...c })),
        people: graph.people.map((p) => ({ ...p })),
      },
      lastX: event.clientX,
      lastY: event.clientY,
    }
    startPressFeedback(targets)
  }

  function startPersonMove(event: ReactPointerEvent<HTMLElement>, person: PersonNode) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setCreateMenu(null)
    selectItem({ type: 'person', id: person.id })

    const selectedOrigins: Record<string, { x: number; y: number }> = {}
    const draggingSelection = selectedPeopleIds.includes(person.id)
    const targets = draggingSelection ? selectedPeopleIds : [person.id]
    for (const pid of targets) {
      const p = boardIndex.peopleById.get(pid)
      if (p) {
        selectedOrigins[pid] = { x: p.x, y: p.y }
      }
    }

    // Mixed selection: when the grabbed person is part of the selection and zones
    // are selected too, drag those zones (and everything inside them) along.
    const circleOrigins: Record<string, { x: number; y: number }> = {}
    if (draggingSelection && selectedCircleIds.length > 0) {
      const subtreeIds = new Set<string>()
      for (const cid of selectedCircleIds) {
        subtreeIds.add(cid)
        for (const descId of getDescendantCircleIds(graph.circles, cid)) {
          subtreeIds.add(descId)
        }
      }
      for (const c of graph.circles) {
        if (subtreeIds.has(c.id)) circleOrigins[c.id] = { x: c.x, y: c.y }
      }
      for (const p of graph.people) {
        if (subtreeIds.has(p.circleId) && !(p.id in selectedOrigins)) {
          selectedOrigins[p.id] = { x: p.x, y: p.y }
        }
      }
    }

    const liftIds = draggingSelection ? [...targets, ...selectedCircleIds] : [person.id]

    movePersonRef.current = {
      pointerId: event.pointerId,
      personId: person.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: person.x,
      originY: person.y,
      selectedOrigins,
      circleOrigins,
      liftIds,
      liftStarted: false,
      moved: false,
      graphSnapshot: {
        ...graph,
        circles: graph.circles.map((c) => ({ ...c })),
        people: graph.people.map((p) => ({ ...p })),
      },
      lastX: event.clientX,
      lastY: event.clientY,
    }
    startPressFeedback(liftIds)
  }

  function startCircleResize(event: ReactPointerEvent<Element>, circle: CircleNode) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setCreateMenu(null)
    selectItem({ type: 'circle', id: circle.id })
    resizeCircleRef.current = {
      pointerId: event.pointerId,
      circleId: circle.id,
      startX: event.clientX,
      startY: event.clientY,
      graphSnapshot: {
        ...graph,
        circles: graph.circles.map((c) => ({ ...c })),
        people: graph.people.map((p) => ({ ...p })),
      },
    }
    startPressFeedback([circle.id])
  }

  // Double-tap creates a person exactly where you tapped. It only adopts a
  // circle when the tap lands inside one (or on someone already in a circle);
  // tapping empty space leaves the person free-floating instead of dragging it
  // into the "you" blob. We deliberately skip ensureContainment so the rest of
  // the board never reflows or visibly jumps around the new person.
  function handleSurfaceDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    if (Date.now() <= suppressDoubleClickUntilRef.current) {
      suppressDoubleClickUntilRef.current = 0
      event.preventDefault()
      return
    }

    if (cameraRef.current.scale < ZONE_ONLY_SCALE) return
    const hit = hitTestBoard(boardIndex, cameraRef.current, selectedItem, {
      x: event.clientX,
      y: event.clientY,
    }, hoveredCircleEdgeIdRef.current)

    if (hit?.type === 'person') {
      event.preventDefault()
      setSelectedPeopleIds([])
      setSelectedCircleIds([])
      selectItem({ type: 'person', id: hit.person.id })
      focusCameraOnWorld(hit.person.x, hit.person.y, cameraRef.current.scale)
      lastPersonTapRef.current = null
      requestInspectorNameFocus(hit.person.id)
      return
    }

    // An empty-space tap yields no owning circle (''), so the person stays put.
    let circleId = ''
    if (hit && (hit.type === 'circle-body' || hit.type === 'circle-center' || hit.type === 'circle-edge')) {
      circleId = hit.circle.id
    }

    const world = screenToWorld({ x: event.clientX, y: event.clientY })
    // eslint-disable-next-line react-hooks/purity -- created from a pointer event, not during render.
    const id = `person-${Date.now()}`
    // eslint-disable-next-line react-hooks/purity -- randomizes a newly created person's shape in an event handler.
    const sides = Math.floor(Math.random() * 5) + 8
    pushHistory()
    setGraph((current) => ({
      ...current,
      people: [
        ...current.people,
        {
          id,
          name: `New person ${current.people.length + 1}`,
          x: world.x,
          y: world.y,
          circleId,
          avatar: makeAvatar(current.people.length + 1),
          shapeType: 'circle',
          sides,
          amplitude: 0,
        },
      ],
    }))
    setSelectedPeopleIds([])

    selectItem({ type: 'person', id })
    completeOnboardingAction('create-person')
    // Grow the new person in so it feels placed, not blinked into existence.
    startBoardAnim('pop:' + id, 360)
  }

  function handleMergeSelected() {
    const totalCount = selectedPeopleIds.length + selectedCircleIds.length
    if (totalCount < 2) return

    const selectedPeople = graph.people.filter((p) => selectedPeopleIds.includes(p.id))
    const selectedCircles = graph.circles.filter((c) => selectedCircleIds.includes(c.id))

    const sumX = selectedPeople.reduce((sum, p) => sum + p.x, 0) + selectedCircles.reduce((sum, c) => sum + c.x, 0)
    const sumY = selectedPeople.reduce((sum, p) => sum + p.y, 0) + selectedCircles.reduce((sum, c) => sum + c.y, 0)
    const avgX = sumX / totalCount
    const avgY = sumY / totalCount

    // The new subset must be parented OUTSIDE everything it absorbs, otherwise the
    // tree gets a cycle (subset -> child -> subset) and the layout recursion hangs
    // the tab. Walk up from the natural parent, skipping any circle being merged
    // (or a descendant of one). A null result means a top-level, independent
    // subset — we never silently force it under "you".
    const absorbed = new Set<string>(selectedCircleIds)
    for (const cid of selectedCircleIds) {
      for (const descId of getDescendantCircleIds(graph.circles, cid)) absorbed.add(descId)
    }
    let parentCircleId: string | null = null
    if (selectedPeople.length > 0) {
      parentCircleId = selectedPeople[0].circleId || null
    } else if (selectedCircles.length > 0) {
      parentCircleId = selectedCircles[0].parentId ?? null
    }
    const walked = new Set<string>()
    while (parentCircleId && absorbed.has(parentCircleId)) {
      if (walked.has(parentCircleId)) {
        parentCircleId = null
        break
      }
      walked.add(parentCircleId)
      parentCircleId = circlesById.get(parentCircleId)?.parentId ?? null
    }

    const parentCircle = parentCircleId ? circlesById.get(parentCircleId) : null
    const newName = parentCircle ? `${parentCircle.name} subset` : 'Group'

    // Pre-size the subset to contain everything it absorbs, so we don't rely on
    // the heavy containment pass to grow it (and can skip that pass for big merges).
    let radius = 82
    for (const p of selectedPeople) {
      radius = Math.max(radius, Math.hypot(p.x - avgX, p.y - avgY) + PERSON_CONTAINMENT_RADIUS)
    }
    for (const c of selectedCircles) {
      radius = Math.max(radius, Math.hypot(c.x - avgX, c.y - avgY) + c.radius + CIRCLE_CONTAINMENT_PADDING)
    }
    radius = Math.ceil(radius)

    const newCircleId = `circle-${Date.now()}`

    pushHistory()
    setGraph((current) => {
      const newCircle = {
        id: newCircleId,
        name: newName,
        icon: 'SUB',
        x: avgX,
        y: avgY,
        radius,
        minRadius: 82,
        parentId: parentCircleId,
        connectedTo: parentCircleId,
        tone: randomCircleTone(),
        fillMode: circleCreationDefaults.fillMode,
        shapeType: circleCreationDefaults.shapeType,
        shapeCustom: false,
        sides: circleCreationDefaults.sides,
        amplitude: circleCreationDefaults.amplitude,
      }

      const nextCircles = current.circles.map((c) =>
        selectedCircleIds.includes(c.id) ? { ...c, parentId: newCircleId } : c
      )

      const nextPeople = current.people.map((person) =>
        selectedPeopleIds.includes(person.id) ? { ...person, circleId: newCircleId } : person
      )

      const merged = { ...current, circles: [...nextCircles, newCircle], people: nextPeople }
      // The subset is already sized to hold its contents, so for very large merges
      // skip the O(n^2) collision relax that would otherwise freeze the tab.
      return totalCount > MERGE_LAYOUT_LIMIT ? merged : ensureContainment(merged)
    })

    selectItem({ type: 'circle', id: newCircleId })
    setSelectedPeopleIds([])
    setSelectedCircleIds([])
  }

  function createPerson() {
    if (!createMenu) return

    // Drop the person exactly where the menu was opened and auto-detect which
    // bubble that point falls inside (innermost). Empty space -> free-floating,
    // not forced into the source circle. We skip ensureContainment so the rest
    // of the board never reflows or jumps. selectedItem is passed as null so the
    // hit test reports the containing circle/person, not a connector handle.
    const hit = hitTestBoard(boardIndex, cameraRef.current, null, {
      x: createMenu.screenX,
      y: createMenu.screenY,
    })
    let circleId = ''
    if (hit && (hit.type === 'circle-body' || hit.type === 'circle-center' || hit.type === 'circle-edge')) {
      circleId = hit.circle.id
    } else if (hit && hit.type === 'person') {
      circleId = hit.person.circleId ?? ''
    }

    // eslint-disable-next-line react-hooks/purity -- created from a pointer event, not during render.
    const id = `person-${Date.now()}`
    // eslint-disable-next-line react-hooks/purity -- randomizes a newly created person's shape in an event handler.
    const sides = Math.floor(Math.random() * 5) + 8
    pushHistory()
    setGraph((current) => {
      const nextGraph: GraphState = {
        ...current,
        people: [
          ...current.people,
          {
            id,
            name: `New person ${current.people.length + 1}`,
            x: createMenu.x,
            y: createMenu.y,
            circleId,
            avatar: makeAvatar(current.people.length + 1),
            shapeType: 'circle',
            sides,
            amplitude: 0,
          },
        ],
      }
      if (createMenu.dragSourceType === 'person' && createMenu.dragSourceId) {
        return appendGraphConnection(nextGraph, createMenu.dragSourceId, id)
      }
      return nextGraph
    })

    selectItem({ type: 'person', id })
    // Grow the new person in so it feels placed, not blinked into existence.
    startBoardAnim('pop:' + id, 360)
    setCreateMenu(null)
  }

  function completeCreateCircleOnboarding() {
    if (createMenu?.dragSourceType !== 'circle') return
    completeOnboardingAction('create-circle')
  }

  // "Add circle" in the create menu auto-detects containment the same way the
  // double-tap shortcut does: a target point inside the source circle nests a
  // subset, otherwise it spawns a connected circle outside.
  function createCircleAuto() {
    if (!createMenu) return
    const source = circlesById.get(createMenu.sourceCircleId)
    if (!source) return
    const inside = Math.hypot(createMenu.x - source.x, createMenu.y - source.y) <= source.radius
    createCircle(inside ? 'nested' : 'external')
  }

  function createCircle(mode: 'nested' | 'external') {
    if (!createMenu) return

    const source = circlesById.get(createMenu.sourceCircleId)
    if (!source) return

    const id = `circle-${Date.now()}`
    const isNested = mode === 'nested'
    pushHistory()
    setGraph((current) => {
      const nextGraph = settleInteractionGraph({
        ...current,
        circles: [
          ...current.circles,
          {
            id,
            name: isNested ? `${source.name} subset` : 'New circle',
            icon: isNested ? 'SUB' : 'C',
            x: createMenu.x,
            y: createMenu.y,
            radius: isNested ? 82 : 190,
            minRadius: isNested ? 82 : 190,
            parentId: isNested ? source.id : null,
            connectedTo: source.id,
            tone: randomCircleTone(),
            fillMode: circleCreationDefaults.fillMode,
            shapeType: circleCreationDefaults.shapeType,
            shapeCustom: false,
            sides: circleCreationDefaults.sides,
            amplitude: circleCreationDefaults.amplitude,
          },
        ],
      })
      if (createMenu.dragSourceType === 'person' && createMenu.dragSourceId) {
        return appendGraphConnection(nextGraph, createMenu.dragSourceId, id)
      }
      return nextGraph
    })

    selectItem({ type: 'circle', id })
    completeCreateCircleOnboarding()
    setCreateMenu(null)
  }





  function renameSelected(value: string) {
    if (!selectedItem) return
    if (selectedItem.type === 'circle') {
      setGraph((current) => ({
        ...current,
        circles: current.circles.map((circle) => (circle.id === selectedItem.id ? { ...circle, name: value } : circle)),
      }))
      return
    }

    setGraph((current) => ({
      ...current,
      people: current.people.map((person) => (person.id === selectedItem.id ? { ...person, name: value } : person)),
    }))
  }

  function updateCircleStyle(id: string, updates: Partial<CircleNode>) {
    setGraph((current) => ({
      ...current,
      circles: current.circles.map((circle) =>
        circle.id === id ? { ...circle, ...updates } : circle
      ),
    }))
  }

  function updatePersonStyle(id: string, updates: Partial<PersonNode>) {
    setGraph((current) => ({
      ...current,
      people: current.people.map((person) =>
        person.id === id ? { ...person, ...updates } : person
      ),
    }))
  }



  function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>, onComplete: (base64: string) => void) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        onComplete(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  // Auth gate rendered as an OVERLAY (not an early return) so the board JSX always
  // mounts — its mount-time effects (e.g. the native wheel listener for trackpad
  // pinch-zoom / two-finger pan) need surfaceRef to exist on first commit. When
  // Supabase isn't configured we just never show the overlay (local dev mode).
  // Signed-out visitors are no longer gated behind a sign-in wall: the only
  // blocking overlay left is the brief "loading your board" state for a user
  // whose Supabase graph is still being fetched.
  const showAuthOverlay =
    auth.status !== 'unconfigured' &&
    (auth.status === 'loading' || (auth.status === 'authenticated' && !graphLoaded))
  const showPasswordUpdatedDialog =
    auth.status === 'authenticated' &&
    !auth.isPasswordRecovery &&
    emailAuthNotice === 'Password updated. You are signed in.'
  const showAuthDialog =
    auth.isPasswordRecovery ||
    showPasswordUpdatedDialog ||
    (auth.status === 'anonymous' && showSignInModal)
  const authDialogMode = showPasswordUpdatedDialog
    ? 'updated'
    : auth.isPasswordRecovery
      ? 'update'
      : emailAuthMode
  const authDialogTitle =
    authDialogMode === 'signup'
      ? 'Create account'
      : authDialogMode === 'reset'
        ? 'Reset password'
        : authDialogMode === 'update'
          ? 'Choose a new password'
          : authDialogMode === 'updated'
            ? 'Password updated'
          : 'Sign in'
  const authDialogSubtitle =
    authDialogMode === 'signup'
      ? 'Use only email and password. No username, no profile setup.'
      : authDialogMode === 'reset'
        ? 'Enter your email and we will send a reset link.'
        : authDialogMode === 'update'
          ? 'Set a new password to finish the reset.'
          : authDialogMode === 'updated'
            ? 'You are signed in with your new password.'
          : 'Save your board across devices.'
  const authSubmitDisabled =
    emailAuthBusy ||
    (authDialogMode === 'update'
      ? passwordInput.length < 8 || passwordInput !== newPasswordInput
      : authDialogMode === 'reset'
        ? !emailInput.trim()
        : !emailInput.trim() || !passwordInput || (authDialogMode === 'signup' && passwordInput.length < 8))
  const authSubmitLabel =
    emailAuthBusy && emailAuthAction === 'submit'
      ? 'Please wait...'
      : authDialogMode === 'signup'
        ? 'Create account'
        : authDialogMode === 'reset'
          ? 'Send reset link'
          : authDialogMode === 'update'
            ? 'Update password'
          : 'Sign in with email'
  const agentApiUrl = getGraphApiBaseUrl() ?? ''
  const agentTokenForInstructions = newAgentToken ?? '<create-a-key-first>'
  const agentCopyInstruction = `You are allowed to connect to my DataNode graph through MCP.

Use this configuration:

DATANODE_API_URL=${agentApiUrl}
DATANODE_API_TOKEN=${agentTokenForInstructions}

MCP server config:
{
  "mcpServers": {
    "datanode": {
      "command": "npx",
      "args": ["-y", "github:TimofeySukh/hackathon"],
      "env": {
        "DATANODE_API_URL": "${agentApiUrl}",
        "DATANODE_API_TOKEN": "${agentTokenForInstructions}"
      }
    }
  }
}

Developer Wiki & Docs:
Full API reference, CLI usage guide, and interactive docs are available publicly at:
${window.location.origin}/#docs

CLI Client:
To run the CLI on-the-fly or install globally:
- Run via npx: npx -y --package github:TimofeySukh/hackathon datanode-cli <command>
- Install globally: npm install -g github:TimofeySukh/hackathon

Available actions:
- search people, circles, notes, and saved links
- list circles and choose the correct circleId
- add people to exactly one direct circle
- add notes, links, and relationship connections

If an API write returns 409 Conflict, reload graph metadata and retry the intended operation once.`
  const mcpConfigSnippet = `{
  "mcpServers": {
    "datanode": {
      "command": "npx",
      "args": ["-y", "github:TimofeySukh/hackathon"],
      "env": {
        "DATANODE_API_URL": "${agentApiUrl}",
        "DATANODE_API_TOKEN": "${agentTokenForInstructions}"
      }
    }
  }
}`
  const cliSnippet = `# 1. Set environment variables
export DATANODE_API_URL=${agentApiUrl}
export DATANODE_API_TOKEN=${agentTokenForInstructions}

# Option A: Run on-the-fly via npx from anywhere
npx -y --package github:TimofeySukh/hackathon datanode-cli search "Alice"
npx -y --package github:TimofeySukh/hackathon datanode-cli circles
npx -y --package github:TimofeySukh/hackathon datanode-cli people:add <circle-id> "Alice Chen" "Met at conference"

# Option B: Install globally and run
npm install -g github:TimofeySukh/hackathon
datanode-cli search "Alice"
datanode-cli circles
datanode-cli people:add <circle-id> "Alice Chen" "Met at conference"

# Option C: Run from the repository checkout
npm run datanode:cli -- search "Alice"
npm run datanode:cli -- circles
npm run datanode:cli -- people:add <circle-id> "Alice Chen" "Met at conference"`
  const apiSnippet = `GET ${agentApiUrl}/search?q=alice
Authorization: Bearer ${agentTokenForInstructions}

POST ${agentApiUrl}/people
Authorization: Bearer ${agentTokenForInstructions}
Content-Type: application/json

{
  "expectedRevision": 42,
  "circleId": "<circle-id>",
  "name": "Alice Chen",
  "notes": [{ "body": "Met at conference" }]
}`

  function openPrivacyFromAuthDialog() {
    setEmailAuthNotice(null)
    setEmailAuthError(null)
    auth.clearError()
    setShowSignInModal(false)
    window.location.hash = '#privacy'
  }



  if (viewMode === 'landing' || viewMode === 'contact' || viewMode === 'privacy') {
    const landingAuthProps = {
      onLogin: () => {
        setEmailAuthMode('signin')
        setEmailAuthNotice(null)
        setEmailAuthError(null)
        auth.clearError()
        setShowSignInModal(true)
      },
      onSignUp: () => {
        setEmailAuthMode('signup')
        setEmailAuthNotice(null)
        setEmailAuthError(null)
        auth.clearError()
        setShowSignInModal(true)
      },
      isAuthenticated: auth.status === 'authenticated',
    }

    return (
      <div className="app-shell">
        {viewMode === 'landing' && <LandingPage {...landingAuthProps} />}
        {viewMode === 'contact' && <ContactPage {...landingAuthProps} />}
        {viewMode === 'privacy' && <PrivacyPage {...landingAuthProps} />}
        {showAuthDialog && (
          <div
            className={`auth-overlay ${showAuthDialog ? 'is-open' : ''}`}
            onClick={() => {
              if (auth.isPasswordRecovery) {
                auth.dismissPasswordRecovery()
                setPasswordInput('')
                setNewPasswordInput('')
              }
              setEmailAuthNotice(null)
              setShowSignInModal(false)
            }}
          >
            <div
              className="auth-card"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="auth-card__close"
                aria-label="Close"
                onClick={() => {
                  if (auth.isPasswordRecovery) {
                    auth.dismissPasswordRecovery()
                    setPasswordInput('')
                    setNewPasswordInput('')
                  }
                  setEmailAuthNotice(null)
                  setShowSignInModal(false)
                }}
              >
                ×
              </button>
              <div className="auth-card__header">
                <img className="auth-card__brand-mark" src={sdnLogo} alt="" aria-hidden="true" />
                <div>
                  <h2>{authDialogTitle}</h2>
                  <p>{authDialogSubtitle}</p>
                </div>
              </div>
              {authDialogMode !== 'update' && authDialogMode !== 'updated' && authDialogMode !== 'reset' && (
                <>
                  <button
                    type="button"
                    className="m3-primary-button auth-card__google"
                    onClick={() => void auth.signInWithGoogle()}
                  >
                    <GoogleIcon />
                    Continue with Google
                  </button>
                  <div className="auth-card__divider">
                    <span />
                    <small>or</small>
                    <span />
                  </div>
                </>
              )}
              {authDialogMode !== 'updated' && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleEmailAuthSubmit()
                  }}
                  className="auth-card__form"
                >
                  {authDialogMode !== 'update' && (
                    <label className="auth-input-group">
                      <span>Email</span>
                      <input
                        className="auth-input"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        placeholder="you@example.com"
                        value={emailInput}
                        onChange={(event) => setEmailInput(event.target.value)}
                      />
                    </label>
                  )}
                  {authDialogMode !== 'reset' && (
                    <label className="auth-input-group">
                      <span>{authDialogMode === 'update' ? 'New password' : 'Password'}</span>
                      <div className="auth-input-shell">
                        <input
                          className="auth-input"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete={authDialogMode === 'signin' ? 'current-password' : 'new-password'}
                          placeholder={authDialogMode === 'signin' ? 'Your password' : 'At least 8 characters'}
                          value={passwordInput}
                          onChange={(event) => setPasswordInput(event.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                        >
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </label>
                  )}
                  {authDialogMode === 'update' && (
                    <label className="auth-input-group">
                      <span>Confirm password</span>
                      <input
                        className="auth-input"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Repeat new password"
                        value={newPasswordInput}
                        onChange={(event) => setNewPasswordInput(event.target.value)}
                      />
                    </label>
                  )}
                  {(authDialogMode === 'signup' || authDialogMode === 'update') && (
                    <p className="auth-card__helper">Use at least 8 characters. Passphrases are welcome.</p>
                  )}
                  <button
                    type="submit"
                    className="m3-primary-button auth-card__submit"
                    disabled={authSubmitDisabled}
                  >
                    {authSubmitLabel}
                  </button>
                </form>
              )}
              {authDialogMode !== 'update' && authDialogMode !== 'updated' && (
                <div className="auth-card__links">
                  {authDialogMode !== 'reset' && (
                    <button
                      type="button"
                      className="auth-card__switch"
                      onClick={() => {
                        setEmailAuthMode('reset')
                        setPasswordInput('')
                        setEmailAuthNotice(null)
                        setEmailAuthError(null)
                        auth.clearError()
                      }}
                    >
                      Forgot password?
                    </button>
                  )}
                  <button
                    type="button"
                    className="auth-card__switch"
                    onClick={() => {
                      setEmailAuthMode((mode) => (mode === 'signup' ? 'signin' : 'signup'))
                      setPasswordInput('')
                      setEmailAuthNotice(null)
                      setEmailAuthError(null)
                      auth.clearError()
                    }}
                  >
                    {authDialogMode === 'signup'
                      ? 'Already have an account? Sign in'
                      : "Don't have an account? Create one"}
                  </button>
                </div>
              )}
              {emailAuthNotice && (
                <div className="auth-card__notice" role="status">
                  <p>{emailAuthNotice}</p>
                  {authDialogMode === 'signup' && emailInput.trim() && (
                    <button
                      type="button"
                      className="auth-card__switch"
                      disabled={emailAuthBusy}
                      onClick={() => void handleResendConfirmation()}
                    >
                      {emailAuthBusy && emailAuthAction === 'resend' ? 'Sending...' : 'Resend email'}
                    </button>
                  )}
                </div>
              )}
              {(emailAuthError || (authDialogMode !== 'reset' ? auth.error : null)) && (
                <p className="auth-card__error" role="alert">{emailAuthError || auth.error}</p>
              )}
              {(authDialogMode === 'signin' || authDialogMode === 'signup') && (
                <AuthPrivacyNotice onOpenPrivacy={openPrivacyFromAuthDialog} />
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (viewMode === 'docs') {
    return <DocsPage />
  }

  return (
    <main className={`app-shell ${searchOpen ? 'is-search-open' : ''} ${showSettings ? 'is-settings-open' : ''} ${selectedItem ? 'is-inspector-open' : ''} ${boardToolMode === 'pan' ? 'is-pan-mode' : ''}`}>
      {graphLoadError && (
        <div style={{
          position: 'absolute',
          top: 76,
          left: 16,
          right: 16,
          zIndex: 9,
          background: 'var(--md-error-container, #f9dedc)',
          color: 'var(--md-on-error-container, #410e0b)',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          border: '1px solid var(--md-error, #b3261e)',
          borderRadius: '16px',
          boxShadow: 'var(--md-elev-2)',
          fontSize: '14px',
          fontWeight: 500,
        }}>
          <span>{graphLoadError}</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: 'var(--md-error, #b3261e)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '100px',
              padding: '6px 16px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '14px',
            }}
          >
            Reload Page
          </button>
        </div>
      )}
      <div className="board-left-rail" aria-label="Board navigation">
        <a
          href="#"
          className="board-home-button"
          onClick={(event) => {
            event.preventDefault()
            window.location.hash = ''
          }}
          aria-label="Back to home"
          title="Back to home"
        >
          <img src={sdnLogo} alt="" aria-hidden="true" />
        </a>
        {isTouchLayout && (
        <div className="board-mode-menu" aria-label="Board interaction mode">
          <button
            type="button"
            className={boardToolMode === 'edit' ? 'is-active' : ''}
            aria-label="Edit mode"
            title="Edit mode"
            aria-pressed={boardToolMode === 'edit'}
            onClick={() => {
              cancelPanInertia()
              setBoardToolMode('edit')
              completeOnboardingAction('mode')
            }}
          >
            <PointerIcon />
          </button>
          <button
            type="button"
            className={boardToolMode === 'select' ? 'is-active' : ''}
            aria-label="Select mode"
            title="Select mode"
            aria-pressed={boardToolMode === 'select'}
            onClick={() => {
              cancelPanInertia()
              setBoardToolMode('select')
              setCreateMenu(null)
              completeOnboardingAction('mode')
            }}
          >
            <SelectIcon />
          </button>
          <button
            type="button"
            className={boardToolMode === 'pan' ? 'is-active' : ''}
            aria-label="Pan mode"
            title="Pan mode"
            aria-pressed={boardToolMode === 'pan'}
            onClick={() => {
              cancelPanInertia()
              setBoardToolMode('pan')
              setCreateMenu(null)
              completeOnboardingAction('mode')
            }}
          >
            <PanIcon />
          </button>
        </div>
        )}
      </div>

      <div className="toolbar" aria-label="Graph controls">
        <div
          ref={searchPanelRef}
          className={`search-box ${searchOpen ? 'is-open' : ''} ${isAiSearchActive ? 'is-ai-search' : ''}`}
        >
          <button
            type="button"
            className="search-box__toggle"
            aria-label="Search"
            onClick={() => {
              if (searchOpen) {
                closeSearch()
              } else {
                setShowSettings(false)
                setSearchOpen(true)
                if (!hasLocalFlag(SEARCH_LINKEDIN_HINT_KEY)) {
                  setShowSearchLinkedInHint(true)
                  markLocalFlag(SEARCH_LINKEDIN_HINT_KEY)
                }
                window.requestAnimationFrame(() => searchInputRef.current?.focus())
              }
            }}
          >
            <SearchIcon />
          </button>
          {searchOpen && (
            <>
              <input
                ref={searchInputRef}
                className="search-box__input"
                type="text"
                value={searchQuery}
                placeholder={auth.status === 'authenticated' ? 'Ask AI to find someone…' : 'Search people or circles…'}
                aria-label="Search people or circles"
                aria-controls="board-search-results"
                aria-activedescendant={searchResults.length > 0 ? `search-result-${searchResults[currentSearchIndex]?.kind}-${searchResults[currentSearchIndex]?.id}` : undefined}
                onChange={(event) => {
                  const nextQuery = event.target.value
                  setSearchQuery(nextQuery)
                  if (nextQuery.trim() !== '') setShowSearchLinkedInHint(false)
                  setActiveSearchIndex(0)
                  setAiSearchResults(null)
                  setAiSearchExplanation(null)
                  setAiSearchSteps([])
                  setAiSuggestions([])
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    closeSearch()
                  } else if (event.key === 'ArrowDown' && searchResults.length > 0) {
                    event.preventDefault()
                    setActiveSearchIndex((index) => (index + 1) % searchResults.length)
                  } else if (event.key === 'ArrowUp' && searchResults.length > 0) {
                    event.preventDefault()
                    setActiveSearchIndex((index) => (index - 1 + searchResults.length) % searchResults.length)
                  } else if (event.key === 'Home' && searchResults.length > 0) {
                    event.preventDefault()
                    setActiveSearchIndex(0)
                  } else if (event.key === 'End' && searchResults.length > 0) {
                    event.preventDefault()
                    setActiveSearchIndex(searchResults.length - 1)
                  } else if (event.key === 'Enter' && searchResults.length > 0) {
                    event.preventDefault()
                    handleSelectSearchResult(searchResults[currentSearchIndex])
                  }
                }}
              />
              {searchQuery.trim() !== '' && (
                <button type="button" className="search-box__clear" aria-label="Clear search" onClick={() => { setSearchQuery(''); searchInputRef.current?.focus() }}>
                  ×
                </button>
              )}
            </>
          )}
          {searchOpen && searchQuery.trim() === '' && showSearchLinkedInHint && !isOnboardingSearchImportStep && (
            <div className="search-linkedin-hint" role="note">
              Paste a LinkedIn profile link here to add that person to your board.
            </div>
          )}
          {searchOpen && searchQuery.trim() === '' && isOnboardingSearchImportStep && (
            <div className="search-onboarding-links" role="listbox" aria-label="LinkedIn examples">
              <span className="search-onboarding-links__title">Try a LinkedIn profile</span>
              {ONBOARDING_LINKEDIN_EXAMPLES.map((profile) => (
                <button
                  key={profile.url}
                  type="button"
                  role="option"
                  className="search-onboarding-links__item"
                  disabled={isImportingLinkedInProfile}
                  onClick={() => handleOnboardingLinkedInExample(profile.url)}
                >
                  <img src={profile.avatarUrl} alt="" />
                  <span>
                    <span className="search-onboarding-links__name">{profile.name}</span>
                    <span className="search-onboarding-links__sub">{profile.role} - LinkedIn profile</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {searchOpen && searchQuery.trim() !== '' && (
            <div id="board-search-results" className={`search-results ${isAiSearchActive ? 'search-results--ai' : ''}`} role="listbox">
              {isAiSearchActive && (
                <div className="search-results__ai-panel" aria-live="polite">
                  <div className="search-results__ai-header">
                    <span className={`search-results__ai-badge ${isSmartSearching ? 'is-active' : ''}`}>AI search</span>
                    {aiSearchExplanation ? (
                      <p className="search-results__ai-explanation">{aiSearchExplanation}</p>
                    ) : isSmartSearching ? (
                      <p className="search-results__ai-explanation">Looking through your graph with multiple AI passes…</p>
                    ) : null}
                  </div>
                  {aiPanelSteps.length > 0 && (
                    <ol className="search-results__steps">
                      {aiPanelSteps.map((step, index) => (
                        <li
                          key={step.id}
                          className={`search-results__step ${isSmartSearching && index === aiPanelSteps.length - 1 ? 'is-active' : 'is-done'}`}
                        >
                          <span className="search-results__step-label">{step.label}</span>
                          {step.detail ? <span className="search-results__step-detail">{step.detail}</span> : null}
                        </li>
                      ))}
                    </ol>
                  )}
                  {!isSmartSearching && aiSuggestions.length > 0 && (
                    <div className="search-results__suggestions">
                      <span className="search-results__suggestions-title">AI suggests</span>
                      <div className="search-results__suggestion-list">
                        {aiSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            className="search-results__suggestion"
                            onClick={() => {
                              setSearchQuery(suggestion)
                              setActiveSearchIndex(0)
                              searchInputRef.current?.focus()
                            }}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {searchResults.length === 0 && !isSmartSearching ? (
                <div className="search-results__empty">{isAiSearchActive ? 'AI found no matches yet' : 'No matches'}</div>
              ) : searchResults.length === 0 ? null : (
                searchResults.map((result, index) => (
                  <button
                    key={`${result.kind}:${result.id}`}
                    id={`search-result-${result.kind}-${result.id}`}
                    type="button"
                    role="option"
                    aria-selected={index === currentSearchIndex}
                    className={`search-results__item ${index === currentSearchIndex ? 'is-active' : ''}`}
                    disabled={result.kind === 'linkedin-profile' && isImportingLinkedInProfile}
                    style={{ '--search-row-index': index } as CSSProperties}
                    onMouseEnter={() => setActiveSearchIndex(index)}
                    // eslint-disable-next-line react-hooks/refs
                    onClick={() => handleSelectSearchResult(result)}
                  >
                    <span
                      className={`search-results__icon search-results__icon--${result.kind}`}
                      style={result.color ? { backgroundColor: result.color } : undefined}
                    >
                      {result.kind === 'person'
                        ? result.avatarUrl
                          ? <img src={result.avatarUrl} alt="" />
                          : <span className="search-results__initials">{result.initials}</span>
                        : result.kind === 'linkedin-profile'
                          ? isImportingLinkedInProfile ? <span className="search-results__spinner" aria-hidden="true" /> : <LinkedInIcon />
                          : <CircleIcon />}
                    </span>
                    <span className="search-results__text">
                      <span className="search-results__name">{result.name || 'Untitled'}</span>
                      {result.sub ? <span className="search-results__sub">{result.sub}</span> : null}
                      {result.aiReason ? <span className="search-results__ai-reason">{result.aiReason}</span> : null}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <div className="toolbar__group">
          <button
            type="button"
            onClick={() => {
              setShowSettings(false)
              closeSearch()
              setOnboardingStep(0)
            }}
            aria-label="Open board guide"
            title="Open board guide"
          >
            <HelpIcon />
          </button>
          <button
            ref={settingsButtonRef}
            type="button"
            className="attention-badge-wrap"
            onClick={() => {
              if (!showSettings) closeSearch()
              if (!showSettings) completeOnboardingAction('settings')
              setShowSettings(!showSettings)
            }}
            aria-label="Settings"
            style={{
              background: showSettings ? 'var(--md-secondary-container)' : 'transparent',
              color: showSettings ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)',
            }}
          >
            <SettingsIcon />
            {auth.status === 'anonymous' && highlightLinkedInGuideHelp && (
              <span className="attention-badge attention-badge--toolbar" aria-hidden="true">
                !
              </span>
            )}
          </button>
        </div>
      </div>

        <div
          ref={settingsPanelRef}
          className={`settings-panel ${showSettings ? 'is-open' : ''}`}
        >
          <strong style={{ fontSize: '16px', fontWeight: 500, color: 'var(--md-on-surface)' }}>
            Settings
          </strong>
          <div style={{ marginTop: '12px', display: 'grid', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--md-on-surface-variant)' }}>
                  LinkedIn Data Import
                </label>
                <button
                  type="button"
                  className="linkedin-guide-help attention-badge-wrap"
                  aria-label="How to sync your LinkedIn"
                  title="How to sync your LinkedIn"
                  onClick={openLinkedInGuide}
                >
                  ?
                  {highlightLinkedInGuideHelp && (
                    <span className="attention-badge attention-badge--compact" aria-hidden="true">
                      !
                    </span>
                  )}
                </button>
              </div>
              <button
                type="button"
                className="m3-primary-button"
                disabled={isImportingLinkedInZip}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon />
                <span>{isImportingLinkedInZip ? 'Importing...' : 'Import LinkedIn ZIP'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                style={{ display: 'none' }}
                onChange={handleLinkedInImport}
              />
            </div>
            {auth.status === 'authenticated' && (
              <div style={{ borderTop: '1px solid var(--md-outline-variant)', paddingTop: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '8px' }}>
                  Account
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  {typeof auth.session?.user?.user_metadata?.avatar_url === 'string' && (
                    <img
                      src={auth.session.user.user_metadata.avatar_url as string}
                      alt=""
                      style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  )}
                  <span style={{ fontSize: '13px', color: 'var(--md-on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {auth.session?.user?.email}
                  </span>
                </div>
                <button
                  type="button"
                  className="m3-primary-button"
                  onClick={async () => {
                    // Flush the latest graph before the debounced autosave would have
                    // fired, so edits made right before logout aren't lost.
                    const canSave =
                      loadedGraphSourceRef.current !== 'error' &&
                      loadedGraphSourceRef.current !== 'local' &&
                      !(loadedGraphSourceRef.current === 'empty' && loadedGraphSnapshotRef.current === JSON.stringify(graph))

                    if (userId && canSave) {
                      try {
                        const nextRevision = await saveGraph(userId, graph, loadedGraphRevisionRef.current)
                        loadedGraphRevisionRef.current = nextRevision
                        loadedGraphSourceRef.current = 'saved'
                        loadedGraphSnapshotRef.current = JSON.stringify(graph)
                        broadcastGraphRevision(userId, nextRevision)
                      } catch (error) {
                        if (error instanceof GraphRevisionConflictError) {
                          setGraphLoadError('This board changed in another tab or through an agent. To protect your data, reload before signing out.')
                          return
                        }
                        console.error('Failed to save before sign-out', error)
                      }
                    }
                    await auth.signOut()
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
            {auth.status === 'authenticated' && (
              <div className="settings-graph-section">
                <label className="settings-section-label">
                  Agent API
                </label>
                <button
                  type="button"
                  className="m3-primary-button"
                  onClick={() => {
                    setShowSettings(false)
                    setNewAgentToken(null)
                    setAgentTokenStatus(null)
                    setShowAgentSettings(true)
                  }}
                >
                  Manage API keys
                </button>
              </div>
            )}
            {auth.status === 'anonymous' && (
              <div style={{ borderTop: '1px solid var(--md-outline-variant)', paddingTop: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '8px' }}>
                  Account
                </label>
                <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--md-on-surface-variant)' }}>
                  Sign in to save your data across devices. Until then it stays in this browser.
                </p>
                <button
                  type="button"
                  className="m3-primary-button"
                  onClick={() => openSignInModal()}
                >
                  Sign in
                </button>
              </div>
            )}
            <div className="settings-graph-section">
              <label className="settings-section-label">
                Graph
              </label>
              <div className="settings-graph-actions">
                <button
                  type="button"
                  className="m3-primary-button"
                  onClick={() => graphFileInputRef.current?.click()}
                >
                  <UploadIcon />
                  <span>Import graph</span>
                </button>
                <button
                  type="button"
                  className="m3-primary-button"
                  onClick={handleGraphExport}
                >
                  <DownloadIcon />
                  <span>Export graph</span>
                </button>
                <button
                  type="button"
                  className="m3-primary-button m3-primary-button--danger"
                  onClick={handleClearGraph}
                >
                  <TrashIcon />
                  <span>Clear graph</span>
                </button>
              </div>
              <input
                ref={graphFileInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={handleGraphImport}
              />
            </div>



          </div>
        </div>

        <div
          ref={linkedInGuidePanelRef}
          className={`linkedin-guide-panel ${showLinkedInGuide ? 'is-open' : ''}`}
        >
          <div className="linkedin-guide-panel__header">
            <button
              type="button"
              className="linkedin-guide-panel__back"
              aria-label="Back to settings"
              onClick={() => {
                setShowLinkedInGuide(false)
                setShowSettings(true)
              }}
            >
              <BackArrowIcon />
            </button>
            <strong className="linkedin-guide-panel__title">How to sync your LinkedIn</strong>
          </div>
          <div className="linkedin-guide-panel__steps">
            {[
              {
                n: 1,
                title: 'Open Settings & Privacy',
                body: 'Open your LinkedIn profile menu (top-right "Me" icon) and click Settings & Privacy.',
                img: '/linkedin-sync/settings-privacy.png',
              },
              {
                n: 2,
                title: 'Open Data privacy',
                body: 'In Settings, select Data privacy from the left sidebar.',
                img: '/linkedin-sync/data-privacy.png',
              },
              {
                n: 3,
                title: 'Open Download my data',
                body: 'In the data section, press Download your data.',
                img: '/linkedin-sync/download-data.png',
              },
              {
                n: 4,
                title: 'Request the larger archive',
                body: 'Select the larger data archive, then press Request archive.',
                img: '/linkedin-sync/request-archive.png',
              },
            ].map((step) => (
              <div key={step.n} className="linkedin-guide-step">
                <div className="linkedin-guide-step__copy">
                  <span className="linkedin-guide-step__index">{step.n}</span>
                  <div>
                    <h3 className="linkedin-guide-step__title">{step.title}</h3>
                    <p className="linkedin-guide-step__body">{step.body}</p>
                  </div>
                </div>
                <img className="linkedin-guide-step__image" src={step.img} alt={step.title} />
              </div>
            ))}
          </div>
          <p className="linkedin-guide-panel__note">
            Wait up to 24 hours. LinkedIn will email you when the archive is ready. After you
            receive it, return here and press <strong>Import LinkedIn ZIP</strong>.
          </p>
        </div>

      <div
        ref={surfaceRef}
        className="graph-surface"
        tabIndex={0}
        style={{
          backgroundSize: `${160 * camera.scale}px ${160 * camera.scale}px, ${20 * camera.scale}px ${20 * camera.scale}px`,
          backgroundPosition: `${camera.x}px ${camera.y}px`,
        }}
        onPointerDown={handleSurfacePointerDown}
        onPointerMove={handleSurfacePointerMove}
        onPointerUp={handleSurfacePointerUp}
        onPointerCancel={handleSurfacePointerUp}
        onDoubleClick={handleSurfaceDoubleClick}
        onKeyDown={(event) => {
          if (event.key !== 'Delete' && event.key !== 'Backspace') return
          event.preventDefault()
          deleteSelectedItem()
        }}
        onContextMenu={handleSurfaceContextMenu}
        onPointerLeave={() => {
          if (hoveredPersonId) setHoveredPersonId(null)
          if (hoveredConnId) setHoveredConnId(null)
          if (hoveredCircleEdgeIdRef.current) {
            hoveredCircleEdgeIdRef.current = null
            setHoveredCircleEdgeId(null)
          }
          setSurfaceCursor('default')
        }}
      >
        <canvas ref={peopleCanvasRef} className="board-canvas-layer" aria-label="Relationship board" />
      </div>

      {createMenu ? (
        <div className="create-menu" style={menuPosition(createMenu)}>
          <button type="button" onClick={createPerson}>
            <PersonIcon />
            <span>Add person</span>
          </button>
          <button type="button" onClick={createCircleAuto}>
            <CircleIcon />
            <span>Add circle</span>
          </button>
        </div>
      ) : null}

      {(selectedPeopleIds.length + selectedCircleIds.length) >= 2 && (
        <div className="merge-prompt-panel">
          <span className="merge-prompt-text">
            Selected{' '}
            <strong>
              {selectedPeopleIds.length > 0 && `${selectedPeopleIds.length} ${selectedPeopleIds.length === 1 ? 'person' : 'people'}`}
              {selectedPeopleIds.length > 0 && selectedCircleIds.length > 0 && ' and '}
              {selectedCircleIds.length > 0 && `${selectedCircleIds.length} ${selectedCircleIds.length === 1 ? 'circle' : 'circles'}`}
            </strong>
          </span>
          <div className="merge-prompt-buttons">
            <button
              type="button"
              className="primary-action"
              onClick={handleMergeSelected}
            >
              Merge into subset
            </button>
            <button
              type="button"
              className="m3-text-button"
              onClick={() => {
                setSelectedPeopleIds([])
                setSelectedCircleIds([])
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {renderedInspectorItem && (
      <aside
        key={`${renderedInspectorItem.type}:${renderedInspectorItem.id}`}
        className={`inspector ${isInspectorOpen ? 'is-open' : ''}`}
        aria-label="Selection details"
      >

            {renderedInspectorItem.type !== 'connection' ? (
              <div className="inspector-header">
                {selectedPerson && (
                  <div className="m3-avatar-picker-container">
                    <label className="m3-avatar-picker" title="Upload person photo">
                      <input
                        type="file"
                        accept="image/*"
                        className="m3-file-input-hidden"
                        onChange={(e) => handleImageUpload(e, (base64) => updatePersonStyle(selectedPerson.id, { imageUrl: base64 }))}
                      />
                      {selectedPerson.imageUrl ? (
                        <img src={selectedPerson.imageUrl} alt="Person avatar" />
                      ) : (
                        <svg className="m3-avatar-picker-default-icon" viewBox="0 0 24 24">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      )}
                      <div className="m3-avatar-picker-overlay">
                        <UploadIcon />
                      </div>
                    </label>
                  </div>
                )}
                {selectedCircle && (
                  <div className="m3-avatar-picker-container">
                    <label className="m3-avatar-picker" title="Upload circle photo">
                      <input
                        type="file"
                        accept="image/*"
                        className="m3-file-input-hidden"
                        onChange={(e) => handleImageUpload(e, (base64) => updateCircleStyle(selectedCircle.id, { imageUrl: base64 }))}
                      />
                      {selectedCircle.imageUrl ? (
                        <img src={selectedCircle.imageUrl} alt="Circle avatar" />
                      ) : (
                        <svg className="m3-avatar-picker-default-icon" viewBox="0 0 24 24">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                      )}
                      <div className="m3-avatar-picker-overlay">
                        <UploadIcon />
                      </div>
                    </label>
                  </div>
                )}
                <input
                  ref={inspectorNameInputRef}
                  className="inspector__name-input"
                  value={selectedCircle?.name ?? selectedPerson?.name ?? ''}
                  onChange={(event) => renameSelected(event.target.value)}
                  aria-label="Selected item name"
                />
                <div className="inspector-header-actions">
                  {/* Hide favorite star button for now (keep code as requested)
                  {selectedPerson && (
                    <button
                      type="button"
                      className={`star-favorite-btn-inline ${selectedPerson.isFavorite ? 'is-active' : ''}`}
                      onClick={() => togglePersonFavorite(selectedPerson.id)}
                      title={selectedPerson.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                      </svg>
                    </button>
                  )}
                  */}
                  <button
                    type="button"
                    className="inspector-close-btn"
                    onClick={() => {
                      setSelectedPeopleIds([])
                      setSelectedCircleIds([])
                      selectItem(null)
                    }}
                    title="Close details"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>
            ) : (
              <div className="inspector-header">
                <div style={{ fontSize: '15px', fontWeight: 500, padding: '4px 0', flex: 1 }}>
                  Relationship Link
                </div>
                <button
                  type="button"
                  className="inspector-close-btn"
                  onClick={() => {
                    setSelectedPeopleIds([])
                    setSelectedCircleIds([])
                    selectItem(null)
                  }}
                  title="Close details"
                  style={{ marginTop: '-4px' }}
                >
                  <CloseIcon />
                </button>
              </div>
            )}
            
            {selectedCircle && (
              <>
                {(() => {
                  void colorAnimTick
                  const selectedCircleColors = displayCircleColors(selectedCircle)
                  const selectedCircleHsv = hexToHsv(selectedCircleColors.centerBg)
                  const selectedCircleSides = selectedCircle.sides ?? 25
                  const selectedCircleAmplitude = selectedCircle.amplitude ?? 0
                  return (
                    <div className="circle-quick-style">
                      <div className="inspector-visual-row">
                        <div className="quick-circle-colors" aria-label="Quick circle colors" style={{ position: 'relative' }}>

                          {(['blue', 'red', 'green', 'amber', 'violet'] as CircleTone[]).map((tone) => {
                            const id = `tone:${tone}`
                            return (
                              <button
                                key={tone}
                                type="button"
                                data-ind-key={id}
                                className={`quick-circle-color ${selectedCircle.tone === tone && !selectedCircle.customColor ? 'is-selected' : ''} ${pressingSwatchId === id ? 'is-pressing' : ''} ${returningSwatchId === id ? 'is-returning' : ''}`}
                                style={{ backgroundColor: MATERIAL_TONES[tone].centerBg }}
                                onPointerDown={() => handleSwatchPointerDown(id, () => animateCircleColor(selectedCircle.id, { tone, customColor: undefined }))}
                                onPointerUp={() => handleSwatchPointerUp(id)}
                                onPointerLeave={() => handleSwatchPointerUp(id)}
                                onPointerCancel={() => handleSwatchPointerUp(id)}
                                aria-label={`Set quick color ${tone}`}
                              />
                            )
                          })}
                          <button
                            type="button"
                            className={`quick-circle-color quick-circle-color--more ${selectedCircle.customColor ? 'is-selected is-custom-color' : ''} ${showCircleStylePanel ? 'is-open' : ''}`}
                            style={{
                              '--palette-bg': selectedCircleColors.fill,
                              '--palette-color': selectedCircleColors.border,
                            } as React.CSSProperties}
                            onClick={() => setShowCircleStylePanel(!showCircleStylePanel)}
                            title="Customize circle"
                            aria-label="Customize circle"
                          >
                            <PaletteIcon />
                          </button>
                        </div>
                        <div className={`circle-style-popover ${showCircleStylePanel ? 'is-open' : ''}`}>
                          <div className="circle-style-theme-tabs">
                            <SelectionIndicator
                              variant="pill"
                              activeKey={selectedCircle.fillMode ?? circleFillMode}
                            />
                            <button
                              type="button"
                              data-ind-key="transparent"
                              className={(selectedCircle.fillMode ?? circleFillMode) === 'transparent' ? 'is-selected' : ''}
                              onClick={() => updateCircleStyleAndCreationDefaults(selectedCircle.id, { fillMode: 'transparent' })}
                            >
                              Transparent
                            </button>
                            <button
                              type="button"
                              data-ind-key="solid"
                              className={(selectedCircle.fillMode ?? circleFillMode) === 'solid' ? 'is-selected' : ''}
                              onClick={() => updateCircleStyleAndCreationDefaults(selectedCircle.id, { fillMode: 'solid' })}
                            >
                              Solid
                            </button>
                          </div>
                          <button
                            type="button"
                            className={`color-wheel ${pickerDragging === 'wheel' ? 'is-dragging' : ''}`}
                            style={{
                              '--wheel-color': selectedCircleColors.centerBg,
                              '--wheel-x': `${50 + Math.cos((selectedCircleHsv.h - 180) * Math.PI / 180) * selectedCircleHsv.s * 50}%`,
                              '--wheel-y': `${50 + Math.sin((selectedCircleHsv.h - 180) * Math.PI / 180) * selectedCircleHsv.s * 50}%`,
                            } as CSSProperties}
                            onPointerDown={(event) => handleColorWheelPointerDown(event, selectedCircle)}
                            onPointerMove={(event) => handleColorWheelPointerMove(event, selectedCircle)}
                            onPointerUp={handlePickerPointerUp}
                            onPointerCancel={handlePickerPointerUp}
                            onLostPointerCapture={handlePickerPointerUp}
                            aria-label="Pick circle color"
                          >
                            <span className="color-wheel__thumb" />
                          </button>
                          <button
                            type="button"
                            className={`brightness-slider ${pickerDragging === 'brightness' ? 'is-dragging' : ''}`}
                            style={{
                              '--brightness-color': hsvToHex({ ...selectedCircleHsv, v: 1 }),
                              '--brightness-pos': `${selectedCircleHsv.v * 100}%`,
                            } as CSSProperties}
                            onPointerDown={(event) => handleBrightnessPointerDown(event, selectedCircle)}
                            onPointerMove={(event) => handleBrightnessPointerMove(event, selectedCircle)}
                            onPointerUp={handlePickerPointerUp}
                            onPointerCancel={handlePickerPointerUp}
                            onLostPointerCapture={handlePickerPointerUp}
                            aria-label="Pick color brightness"
                          >
                            <span className="brightness-slider__thumb" />
                          </button>
                          <div className="circle-style-presets" style={{ position: 'relative' }}>

                            {CIRCLE_COLOR_PRESETS.slice(0, 8).map((color) => {
                              const id = `preset:${color.toLowerCase()}`
                              return (
                                <button
                                  key={color}
                                  type="button"
                                  data-ind-key={id}
                                  className={`circle-style-preset ${selectedCircleColors.centerBg.toLowerCase() === color.toLowerCase() ? 'is-selected' : ''} ${pressingSwatchId === id ? 'is-pressing' : ''} ${returningSwatchId === id ? 'is-returning' : ''}`}
                                  style={{ backgroundColor: color }}
                                  onPointerDown={() => handleSwatchPointerDown(id, () => animateCircleColor(selectedCircle.id, { customColor: color }))}
                                  onPointerUp={() => handleSwatchPointerUp(id)}
                                  onPointerLeave={() => handleSwatchPointerUp(id)}
                                  onPointerCancel={() => handleSwatchPointerUp(id)}
                                  aria-label={`Set circle color ${color}`}
                                />
                              )
                            })}
                          </div>
                          <div className="circle-style-shape-controls">
                            <M3Slider
                              variant="wave"
                              label={selectedCircleAmplitude <= 0 ? 'Wavyness' : `Wavyness ${Math.round(selectedCircleAmplitude)}`}
                              min={0}
                              max={28}
                              step={0.1}
                              value={selectedCircleAmplitude}
                              onChange={(value) => updateCircleAmplitude(selectedCircle, value)}
                            />
                            <M3Slider
                              variant="plain"
                              label={selectedCircleSides >= 25 ? 'Edges — circle' : `Edges ${selectedCircleSides}`}
                              min={5}
                              max={25}
                              value={selectedCircleSides}
                              onChange={(value) => updateCircleCorners(selectedCircle, value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Commented out Shape settings and Center Image URL to hide from menu, keeping in code for future use
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                  <div className="inspector-field">
                    <label>Shape Type</label>
                    <div className="m3-segmented-button">
                      <button
                        type="button"
                        className={`m3-segmented-button-item ${(!selectedCircle.shapeType || selectedCircle.shapeType === 'wavy') ? 'is-selected' : ''}`}
                        onClick={() => {
                          const updates: Partial<CircleNode> = { shapeType: 'wavy', shapeCustom: true }
                          if ((selectedCircle.amplitude ?? 5) > 50) {
                            updates.amplitude = 15
                          }
                          updateCircleStyle(selectedCircle.id, updates)
                        }}
                      >
                        Wavy
                      </button>
                      <button
                        type="button"
                        className={`m3-segmented-button-item ${selectedCircle.shapeType === 'polygon' ? 'is-selected' : ''}`}
                        onClick={() => {
                          const updates: Partial<CircleNode> = { shapeType: 'polygon', shapeCustom: true }
                          if ((selectedCircle.amplitude ?? 5) > 20) {
                            updates.amplitude = 8
                          }
                          updateCircleStyle(selectedCircle.id, updates)
                        }}
                      >
                        Polygon
                      </button>
                      <button
                        type="button"
                        className={`m3-segmented-button-item ${selectedCircle.shapeType === 'circle' ? 'is-selected' : ''}`}
                        onClick={() => {
                          updateCircleStyle(selectedCircle.id, { shapeType: 'circle', shapeCustom: false, sides: 25, amplitude: 0 })
                        }}
                      >
                        Circle
                      </button>
                    </div>
                  </div>
                  
                  {(selectedCircle.shapeType ?? 'wavy') !== 'circle' && (
                    <>
                      <div className="inspector-field">
                        <label>Sides / Petals ({selectedCircle.sides ?? 8})</label>
                        <input
                          type="range"
                          min="3"
                          max="60"
                          value={selectedCircle.sides ?? 8}
                          onChange={(e) => updateCircleStyle(selectedCircle.id, { sides: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="inspector-field">
                        <label>{selectedCircle.shapeType === 'polygon' ? 'Rounding' : 'Amplitude'} ({selectedCircle.amplitude ?? 5})</label>
                        <input
                          type="range"
                          min="0"
                          max={selectedCircle.shapeType === 'polygon' ? 20 : 50}
                          value={selectedCircle.amplitude ?? 5}
                          onChange={(e) => updateCircleStyle(selectedCircle.id, { amplitude: parseFloat(e.target.value) })}
                        />
                      </div>
                    </>
                  )}

                  <div className="inspector-field">
                    <label>Center Image URL</label>
                    <input
                      type="text"
                      placeholder="https://example.com/image.jpg"
                      value={selectedCircle.imageUrl ?? ''}
                      onChange={(e) => updateCircleStyle(selectedCircle.id, { imageUrl: e.target.value })}
                      className="m3-input-field"
                    />
                  </div>
                </div>
                */}

                {/* Sticky Actions at Bottom */}
                <div className="inspector-actions-section" style={{ borderTop: 'none', paddingTop: 0 }}>


                  {selectedCircle.id !== 'you' && (
                    <button
                      type="button"
                      className="primary-action"
                      style={{
                        background: 'var(--md-error-container)',
                        color: 'var(--md-on-error-container)',
                      }}
                      onClick={() => deleteCircle(selectedCircle.id)}
                    >
                      Delete circle
                    </button>
                  )}
                </div>
              </>
            )}

            {selectedPerson && (
              <>


                {/* Visual Settings Row: Select Circle + Avatar Photo Upload */}
                {(() => {
                  const personCircle = circlesById.get(selectedPerson.circleId)
                  const toneColors = personCircle ? getCircleColors(personCircle) : null
                  return (
                    <div className="inspector-visual-row">
                      <div className="inspector-field inspector-field--circle-select">
                        <div className="custom-select-wrap">
                           <button
                             type="button"
                             onClick={() => setShowCircleDropdown(!showCircleDropdown)}
                             className="custom-select-trigger"
                           >
                             <span
                               className="circle-color-dot"
                               style={{ backgroundColor: toneColors ? toneColors.centerBg : 'var(--md-outline-variant)' }}
                             />
                             <span>{personCircle?.name || 'Select circle'}</span>
                             <svg
                               viewBox="0 0 24 24"
                               style={{
                                 width: 16,
                                 height: 16,
                                 fill: 'none',
                                 stroke: 'var(--md-on-surface-variant, #43474e)',
                                 strokeWidth: 2,
                                 strokeLinecap: 'round',
                                 strokeLinejoin: 'round',
                                 transform: showCircleDropdown ? 'rotate(180deg)' : 'none',
                                 transition: 'transform 0.2s',
                               }}
                             >
                               <polyline points="6 9 12 15 18 9" />
                             </svg>
                           </button>

                           {showCircleDropdown && (
                             <div className="custom-select-dropdown">
                               {graph.circles.map((c) => {
                                 const optionColors = getCircleColors(c)
                                 return (
                                   <button
                                     key={c.id}
                                     type="button"
                                     onClick={() => {
                                       pushHistory()
                                       setGraph((current) => {
                                         const freePos = findFreeSpaceInCircle(current.circles, current.people, c.id)
                                         return settleInteractionGraph({
                                           ...current,
                                           people: current.people.map((p) =>
                                             p.id === selectedPerson.id ? { ...p, circleId: c.id, x: freePos.x, y: freePos.y } : p
                                           ),
                                         })
                                       })
                                       setShowCircleDropdown(false)
                                     }}
                                     className="custom-select-option"
                                   >
                                     <span
                                       className="circle-color-dot"
                                       style={{ backgroundColor: optionColors.centerBg }}
                                     />
                                     <span>{c.name}</span>
                                     {selectedPerson.circleId === c.id && (
                                       <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'var(--md-primary)', strokeWidth: 3, fill: 'none' }}>
                                         <polyline points="20 6 9 17 4 12" />
                                       </svg>
                                     )}
                                   </button>
                                 )
                               })}
                             </div>
                           )}
                         </div>
                       </div>
                    </div>
                  );
                })()}

                {/* Notes Section (Trello-Style) */}
                <div className="trello-list">
                  <div className="trello-list__header">
                    <h4 className="trello-list__title">Notes</h4>
                  </div>
 
                  {/* Scrollable list */}
                  <div className="trello-list__notes" ref={notesListRef}>
                    {selectedPerson.notes?.map((note, index) => (
                      <div key={note.id} className="trello-note-shell" style={{ '--note-index': index } as CSSProperties}>
                        {editingNoteId === note.id ? (
                          <div className="trello-card__editor">
                            <textarea
                              className="trello-card__editor-textarea"
                              autoFocus
                              value={note.body}
                              onChange={(e) => {
                                updatePersonNote(
                                  selectedPerson.id,
                                  note.id,
                                  e.target.value.split('\n')[0].substring(0, 30) || 'Untitled note',
                                  e.target.value
                                )
                              }}
                              onBlur={() => setEditingNoteId(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault()
                                  setEditingNoteId(null)
                                } else if (e.key === 'Escape') {
                                  setEditingNoteId(null)
                                }
                              }}
                              style={{
                                minHeight: '40px',
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            className="trello-card"
                            onClick={() => setEditingNoteId(note.id)}
                          >
                            <div className="trello-card__body">{note.body}</div>
                            <button
                              type="button"
                              className="trello-card__delete-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                deletePersonNote(selectedPerson.id, note.id)
                              }}
                              title="Delete note"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
 
                  {/* Trello Card Composer */}
                  {isAddingNote ? (
                    <div className="trello-list__composer">
                      <div className="trello-list__composer-card">
                        <textarea
                          ref={noteInputRef}
                          placeholder="Write a note..."
                          value={newNoteBody}
                          onChange={(e) => {
                            setNewNoteBody(e.target.value)
                            const maxHeight = 200
                            e.target.style.height = 'auto'
                            e.target.style.height = `${Math.min(e.target.scrollHeight, maxHeight)}px`
                          }}
                          className="trello-list__composer-textarea"
                          autoFocus
                          rows={1}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              handleSaveNewNote(selectedPerson.id)
                            } else if (e.key === 'Escape') {
                              setIsAddingNote(false)
                              setNewNoteBody('')
                            }
                          }}
                          style={{
                            minHeight: '20px',
                            height: 'auto',
                            resize: 'none',
                            overflowY: 'hidden',
                          }}
                        />
                      </div>
                      <div className="trello-list__composer-controls">
                        <button
                          type="button"
                          className="trello-list__composer-add-btn"
                          onClick={() => handleSaveNewNote(selectedPerson.id)}
                        >
                          Save note
                        </button>
                        <button
                          type="button"
                          className="trello-list__composer-cancel-btn"
                          onClick={() => {
                            setIsAddingNote(false)
                            setNewNoteBody('')
                          }}
                          title="Discard"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="trello-list__add-btn"
                      onClick={() => setIsAddingNote(true)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 14, height: 14 }}>
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span>Add note</span>
                    </button>
                  )}
                </div>

                <div className="connections-list">
                  <div className="connections-list__header">
                    <h4 className="connections-list__title">Connections</h4>
                  </div>
                  <div className="connections-list__items">
                    {selectedPerson.links?.map((link) => (
                      <div key={link.id} className="connection-item">
                        <button
                          type="button"
                          className={`connection-item__main connection-item__main--${link.service}`}
                          onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                          title={link.url}
                        >
                          <ConnectionServiceIcon service={link.service} />
                          <span>{link.label}</span>
                          <ExternalLinkIcon />
                        </button>
                        <button
                          type="button"
                          className="connection-item__delete"
                          onClick={() => deletePersonLink(selectedPerson.id, link.id)}
                          title="Delete connection"
                        >
                          <CloseIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="connection-composer">
                    <input
                      type="text"
                      value={newLinkValue}
                      placeholder="Add link, @handle, or phone"
                      onChange={(event) => {
                        setNewLinkValue(event.target.value)
                        setShowLinkServicePicker(false)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          handleSaveNewLink(selectedPerson.id)
                        } else if (event.key === 'Escape') {
                          setNewLinkValue('')
                          setShowLinkServicePicker(false)
                        }
                      }}
                    />
                    <button type="button" onClick={() => handleSaveNewLink(selectedPerson.id)}>
                      Save
                    </button>
                  </div>
                  {showLinkServicePicker && (
                    <div className="connection-service-picker">
                      {LINK_SERVICE_OPTIONS.filter((option) =>
                        newLinkValue.trim().startsWith('@')
                          ? ['telegram', 'instagram', 'x'].includes(option.service)
                          : ['whatsapp', 'telegram', 'website'].includes(option.service)
                      ).map((option) => (
                        <button
                          key={option.service}
                          type="button"
                          className={newLinkService === option.service ? 'is-selected' : ''}
                          onClick={() => {
                            setNewLinkService(option.service)
                            addPersonLink(selectedPerson.id, newLinkValue, option.service)
                            setNewLinkValue('')
                            setShowLinkServicePicker(false)
                            setNewLinkService('website')
                          }}
                        >
                          <ConnectionServiceIcon service={option.service} />
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Commented out Appearance Options to hide from menu, keeping in code for future use
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px', borderTop: '1px solid var(--md-outline-variant)', paddingTop: '12px' }}>
                  <div className="inspector-field">
                    <label>Shape Type</label>
                    <div className="m3-segmented-button">
                      <button
                        type="button"
                        className={`m3-segmented-button-item ${(!selectedPerson.shapeType || selectedPerson.shapeType === 'wavy') ? 'is-selected' : ''}`}
                        onClick={() => {
                          updatePersonStyle(selectedPerson.id, { shapeType: 'wavy', amplitude: 1 })
                        }}
                      >
                        Wavy
                      </button>
                      <button
                        type="button"
                        className={`m3-segmented-button-item ${selectedPerson.shapeType === 'polygon' ? 'is-selected' : ''}`}
                        onClick={() => {
                          updatePersonStyle(selectedPerson.id, { shapeType: 'polygon', amplitude: 8 })
                        }}
                      >
                        Polygon
                      </button>
                      <button
                        type="button"
                        className={`m3-segmented-button-item ${selectedPerson.shapeType === 'circle' ? 'is-selected' : ''}`}
                        onClick={() => {
                          updatePersonStyle(selectedPerson.id, { shapeType: 'circle', amplitude: 0 })
                        }}
                      >
                        Circle
                      </button>
                    </div>
                  </div>
                  
                  {(selectedPerson.shapeType ?? 'wavy') !== 'circle' && (
                    <>
                      <div className="inspector-field">
                        <label>Sides / Petals ({selectedPerson.sides ?? 8})</label>
                        <input
                          type="range"
                          min="3"
                          max="20"
                          value={selectedPerson.sides ?? 8}
                          onChange={(e) => updatePersonStyle(selectedPerson.id, { sides: parseInt(e.target.value) })}
                        />
                      </div>
                    </>
                  )}

                  <div className="inspector-field">
                    <label>Photo Image URL</label>
                    <input
                      type="text"
                      placeholder="https://example.com/image.jpg"
                      value={selectedPerson.imageUrl ?? ''}
                      onChange={(e) => updatePersonStyle(selectedPerson.id, { imageUrl: e.target.value })}
                      className="m3-input-field"
                    />
                  </div>
                </div>
                */}

                {/* Sticky Actions at Bottom */}
                <div className="inspector-actions-section">
                  <button
                    type="button"
                    className="primary-action"
                    style={{
                      background: 'var(--md-error-container)',
                      color: 'var(--md-on-error-container)',
                    }}
                    onClick={() => deletePerson(selectedPerson.id)}
                  >
                    Delete person
                  </button>
                </div>
              </>
            )}

            {selectedConnection && (
              <>
                <dl>
                  <div>
                    <dt>From</dt>
                    <dd>{(peopleById.get(selectedConnection.fromId) || circlesById.get(selectedConnection.fromId))?.name ?? 'Unknown'}</dd>
                  </div>
                  <div>
                    <dt>To</dt>
                    <dd>{(peopleById.get(selectedConnection.toId) || circlesById.get(selectedConnection.toId))?.name ?? 'Unknown'}</dd>
                  </div>
                </dl>

                <button
                  type="button"
                  className="primary-action"
                  style={{
                    marginTop: '16px',
                    background: 'var(--md-error-container)',
                    color: 'var(--md-on-error-container)',
                  }}
                  onClick={() => deleteConnection(selectedConnection.id)}
                >
                  Delete connection
                </button>
              </>
            )}
      </aside>
      )}

      {showAuthOverlay && (
        <div style={authOverlayStyle}>
          <div style={authCardStyle}>
            <img className="brand__mark" src={sdnLogo} alt="" aria-hidden="true" />
            <p style={{ margin: 0, color: 'var(--md-on-surface-variant)' }}>Loading your board…</p>
          </div>
        </div>
      )}

      {showAgentSettings && (
        <div
          className="agent-settings-overlay is-open"
          onClick={() => setShowAgentSettings(false)}
        >
          <section
            className="agent-settings-dialog"
            aria-modal="true"
            role="dialog"
            aria-labelledby="agent-settings-title"
            onClick={(event) => event.stopPropagation()}
          >
            <aside className="agent-settings-sidebar">
              <div className="agent-settings-sidebar__section">Agent access</div>
              {[
                ['quick', 'Quick setup'],
                ['mcp', 'MCP'],
                ['cli', 'CLI'],
                ['api', 'API'],
                ['keys', 'Keys'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`agent-settings-sidebar__item ${agentSettingsTab === id ? 'is-active' : ''}`}
                  onClick={() => setAgentSettingsTab(id as typeof agentSettingsTab)}
                >
                  {label}
                </button>
              ))}
              <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--md-outline-variant)' }}>
                <button
                  type="button"
                  className="agent-settings-sidebar__item"
                  style={{ color: 'var(--md-primary)', gap: '8px' }}
                  onClick={() => {
                    setShowAgentSettings(false)
                    window.location.hash = '#docs'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>📖</span> Full Wiki & Docs
                </button>
              </div>
            </aside>
            <div className="agent-settings-content">
              <button
                type="button"
                className="agent-settings-close"
                aria-label="Close"
                onClick={() => setShowAgentSettings(false)}
              >
                <CloseIcon />
              </button>
              <header className="agent-settings-header">
                <div>
                  <h2 id="agent-settings-title">
                    {agentSettingsTab === 'quick' ? 'Quick setup' : agentSettingsTab === 'mcp' ? 'MCP setup' : agentSettingsTab === 'cli' ? 'CLI setup' : agentSettingsTab === 'api' ? 'API reference' : 'API keys'}
                  </h2>
                  <p>
                    {agentSettingsTab === 'quick'
                      ? 'Create one key and copy the instruction into an AI agent.'
                      : agentSettingsTab === 'mcp'
                        ? 'Connect DataNode as an MCP server.'
                        : agentSettingsTab === 'cli'
                          ? 'Use the same key from a terminal.'
                          : agentSettingsTab === 'api'
                            ? 'Call the graph API directly.'
                            : 'Create and revoke agent keys.'}
                  </p>
                </div>
              </header>

              {agentSettingsTab === 'quick' && (
                <section className="agent-settings-section agent-settings-flow">
                  <div className="agent-settings-step">
                    <div>
                      <h3>1. Create a key</h3>
                      <p>This creates a revocable key with the default agent permissions.</p>
                    </div>
                    <div className="agent-settings-create-row">
                      <input
                        type="text"
                        value={agentTokenName}
                        onChange={(event) => setAgentTokenName(event.target.value)}
                        className="m3-input-field agent-settings-name-input"
                        placeholder="Token name"
                      />
                      <button
                        type="button"
                        className="m3-primary-button agent-settings-action"
                        disabled={agentTokensBusy}
                        onClick={handleCreateAgentToken}
                      >
                        Create key
                      </button>
                    </div>
                  </div>
                  <div className="agent-settings-step">
                    <div>
                      <h3>2. Copy this for the AI agent</h3>
                      <p>Paste it as-is. The agent does not need to understand the key internals.</p>
                    </div>
                    <textarea
                      readOnly
                      className="m3-input-field agent-settings-copybox"
                      value={agentCopyInstruction}
                      rows={13}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <button
                      type="button"
                      className="m3-primary-button agent-settings-copy-action"
                      disabled={!newAgentToken}
                      onClick={() => void handleCopyAgentText(agentCopyInstruction, 'Instruction copied.')}
                    >
                      Copy instruction
                    </button>
                  </div>
                  {agentTokenStatus && <p className="agent-settings-status">{agentTokenStatus}</p>}
                </section>
              )}

              {agentSettingsTab === 'mcp' && (
                <section className="agent-settings-section agent-settings-flow">
                  <div className="agent-settings-step">
                    <h3>MCP config</h3>
                    <p>Use this when an AI app asks for MCP server JSON.</p>
                    <textarea
                      readOnly
                      className="m3-input-field agent-settings-copybox"
                      value={mcpConfigSnippet}
                      rows={12}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <button
                      type="button"
                      className="m3-primary-button agent-settings-copy-action"
                      onClick={() => void handleCopyAgentText(mcpConfigSnippet, 'MCP config copied.')}
                    >
                      Copy MCP config
                    </button>
                  </div>
                </section>
              )}

              {agentSettingsTab === 'cli' && (
                <section className="agent-settings-section agent-settings-flow">
                  <div className="agent-settings-step">
                    <h3>CLI commands</h3>
                    <p>Install globally, or run on-the-fly via npx from anywhere:</p>
                    <textarea
                      readOnly
                      className="m3-input-field agent-settings-copybox"
                      value={cliSnippet}
                      rows={16}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <button
                      type="button"
                      className="m3-primary-button agent-settings-copy-action"
                      onClick={() => void handleCopyAgentText(cliSnippet, 'CLI snippet copied.')}
                    >
                      Copy CLI snippet
                    </button>
                  </div>
                </section>
              )}

              {agentSettingsTab === 'api' && (
                <section className="agent-settings-section agent-settings-flow">
                  <div className="agent-settings-step">
                    <h3>Direct API</h3>
                    <p>All writes use the current graph revision and return 409 when another client saved first.</p>
                    <textarea
                      readOnly
                      className="m3-input-field agent-settings-copybox"
                      value={apiSnippet}
                      rows={15}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <button
                      type="button"
                      className="m3-primary-button agent-settings-copy-action"
                      onClick={() => void handleCopyAgentText(apiSnippet, 'API example copied.')}
                    >
                      Copy API example
                    </button>
                  </div>
                </section>
              )}

              {agentSettingsTab === 'keys' && (
                <section className="agent-settings-section agent-settings-flow">
                  <div className="agent-settings-step">
                    <div>
                      <h3>Create key</h3>
                      <p>Use this if you need another key for a different agent or machine.</p>
                    </div>
                    <div className="agent-settings-create-row">
                      <input
                        type="text"
                        value={agentTokenName}
                        onChange={(event) => setAgentTokenName(event.target.value)}
                        className="m3-input-field agent-settings-name-input"
                        placeholder="Token name"
                      />
                      <button
                        type="button"
                        className="m3-primary-button agent-settings-action"
                        disabled={agentTokensBusy}
                        onClick={handleCreateAgentToken}
                      >
                        Create key
                      </button>
                    </div>
                  </div>
                  {newAgentToken && (
                    <div className="agent-settings-secret">
                      <div>
                        <h4>New key</h4>
                        <p>Copy it now. It is stored as a hash and will not be shown again.</p>
                      </div>
                      <input
                        type="text"
                        readOnly
                        value={newAgentToken}
                        className="m3-input-field"
                        onFocus={(event) => event.currentTarget.select()}
                      />
                    </div>
                  )}
                  {agentTokenStatus && <p className="agent-settings-status">{agentTokenStatus}</p>}
                  <div className="agent-token-list">
                    {agentTokens.length === 0 && (
                      <div className="agent-token-empty">
                        No active agent keys.
                      </div>
                    )}
                    {agentTokens.map((token) => (
                      <div key={token.id} className="agent-token-row">
                        <div className="agent-token-row__main">
                          <div className="agent-token-row__name">{token.name}</div>
                          <div className="agent-token-row__meta">
                            {token.token_prefix} · active
                            {token.last_used_at ? ` · last used ${new Date(token.last_used_at).toLocaleDateString()}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="m3-primary-button m3-primary-button--danger agent-settings-revoke"
                          disabled={agentTokensBusy}
                          onClick={() => handleRevokeAgentToken(token.id)}
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </section>
        </div>
      )}

      {showAuthDialog && (
        <div
          className={`auth-overlay ${showAuthDialog ? 'is-open' : ''}`}
          onClick={() => {
            if (auth.isPasswordRecovery) {
              auth.dismissPasswordRecovery()
              setPasswordInput('')
              setNewPasswordInput('')
            }
            setEmailAuthNotice(null)
            setShowSignInModal(false)
          }}
        >
          <div
            className="auth-card"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="auth-card__close"
              aria-label="Close"
              onClick={() => {
                if (auth.isPasswordRecovery) {
                  auth.dismissPasswordRecovery()
                  setPasswordInput('')
                  setNewPasswordInput('')
                }
                setEmailAuthNotice(null)
                setShowSignInModal(false)
              }}
            >
              ×
            </button>
            <div className="auth-card__header">
              <img className="auth-card__brand-mark" src={sdnLogo} alt="" aria-hidden="true" />
              <div>
                <h2>{authDialogTitle}</h2>
                <p>{authDialogSubtitle}</p>
              </div>
            </div>
            {authDialogMode !== 'update' && authDialogMode !== 'updated' && authDialogMode !== 'reset' && (
              <>
                <button
                  type="button"
                  className="m3-primary-button auth-card__google"
                  onClick={() => void auth.signInWithGoogle()}
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
                <div className="auth-card__divider">
                  <span />
                  <small>or</small>
                  <span />
                </div>
              </>
            )}
            {authDialogMode !== 'updated' && (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleEmailAuthSubmit()
                }}
                className="auth-card__form"
              >
                {authDialogMode !== 'update' && (
                  <label className="auth-input-group">
                    <span>Email</span>
                    <input
                      className="auth-input"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="you@example.com"
                      value={emailInput}
                      onChange={(event) => setEmailInput(event.target.value)}
                    />
                  </label>
                )}
                {authDialogMode !== 'reset' && (
                  <label className="auth-input-group">
                    <span>{authDialogMode === 'update' ? 'New password' : 'Password'}</span>
                    <div className="auth-input-shell">
                      <input
                        className="auth-input"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={authDialogMode === 'signin' ? 'current-password' : 'new-password'}
                        placeholder={authDialogMode === 'signin' ? 'Your password' : 'At least 8 characters'}
                        value={passwordInput}
                        onChange={(event) => setPasswordInput(event.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </label>
                )}
                {authDialogMode === 'update' && (
                  <label className="auth-input-group">
                    <span>Confirm password</span>
                    <input
                      className="auth-input"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Repeat new password"
                      value={newPasswordInput}
                      onChange={(event) => setNewPasswordInput(event.target.value)}
                    />
                  </label>
                )}
                {(authDialogMode === 'signup' || authDialogMode === 'update') && (
                  <p className="auth-card__helper">Use at least 8 characters. Passphrases are welcome.</p>
                )}
                <button
                  type="submit"
                  className="m3-primary-button auth-card__submit"
                  disabled={authSubmitDisabled}
                >
                  {authSubmitLabel}
                </button>
              </form>
            )}
            {authDialogMode !== 'update' && authDialogMode !== 'updated' && (
              <div className="auth-card__links">
                {authDialogMode !== 'reset' && (
                  <button
                    type="button"
                    className="auth-card__switch"
                    onClick={() => {
                      setEmailAuthMode('reset')
                      setPasswordInput('')
                      setEmailAuthNotice(null)
                      setEmailAuthError(null)
                      auth.clearError()
                    }}
                  >
                    Forgot password?
                  </button>
                )}
                <button
                  type="button"
                  className="auth-card__switch"
                  onClick={() => {
                    setEmailAuthMode((mode) => (mode === 'signup' ? 'signin' : 'signup'))
                    setPasswordInput('')
                    setEmailAuthNotice(null)
                    setEmailAuthError(null)
                    auth.clearError()
                  }}
                >
                  {authDialogMode === 'signup'
                    ? 'Already have an account? Sign in'
                    : "Don't have an account? Create one"}
                </button>
              </div>
            )}
            {emailAuthNotice && (
              <div className="auth-card__notice" role="status">
                <p>{emailAuthNotice}</p>
                {authDialogMode === 'signup' && emailInput.trim() && (
                  <button
                    type="button"
                    className="auth-card__switch"
                    disabled={emailAuthBusy}
                    onClick={() => void handleResendConfirmation()}
                  >
                    {emailAuthBusy && emailAuthAction === 'resend' ? 'Sending...' : 'Resend email'}
                  </button>
                )}
              </div>
            )}
            {(emailAuthError || (authDialogMode !== 'reset' ? auth.error : null)) && (
              <p className="auth-card__error" role="alert">{emailAuthError || auth.error}</p>
            )}
            {(authDialogMode === 'signin' || authDialogMode === 'signup') && (
              <AuthPrivacyNotice onOpenPrivacy={openPrivacyFromAuthDialog} />
            )}
          </div>
        </div>
      )}

      {graphLoaded && onboardingStep >= 0 && (
        <OnboardingCoach
          surface={onboardingSurface}
          step={onboardingStep}
          completed={completedOnboardingStep === onboardingStep}
          onNext={onboardingNext}
          onBack={onboardingBack}
          onSkip={finishOnboarding}
        />
      )}

    </main>
  )
}



// The canvas board engine (spatial index, hit-testing, rendering) lives in
// lib/board/render.ts; App owns chrome/inspector/menu UI and calls into it.

function parseCSV(text: string): string[][] {
  const lines: string[][] = []
  let row: string[] = []
  let inQuotes = false
  let currentValue = ''

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"'
        i++ // skip next quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentValue.trim())
      currentValue = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++
      }
      row.push(currentValue.trim())
      if (row.length > 0 && row.some(val => val !== '')) {
        lines.push(row)
      }
      row = []
      currentValue = ''
    } else {
      currentValue += char
    }
  }
  if (currentValue || row.length > 0) {
    row.push(currentValue.trim())
    if (row.some(val => val !== '')) {
      lines.push(row)
    }
  }
  return lines
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0))
}

function findLinkedInConnectionsHeader(rows: string[][]) {
  for (let index = 0; index < rows.length; index += 1) {
    const normalized = rows[index].map((cell) => cell.toLowerCase().replace(/\s+/g, ''))
    if (normalized.includes('firstname') && normalized.includes('lastname') && normalized.includes('company')) {
      return index
    }
  }
  return -1
}

async function buildLinkedInConnectionsGraph(
  current: GraphState,
  csvText: string,
): Promise<LinkedInConnectionsImportResult> {
  const rows = parseCSV(csvText)
  if (rows.length === 0) {
    throw new Error('Connections.csv is empty or invalid.')
  }

  await yieldToBrowser()

  const headerIdx = findLinkedInConnectionsHeader(rows)
  if (headerIdx === -1) {
    throw new Error('Could not find standard headers in Connections.csv.')
  }

  const headers = rows[headerIdx].map((cell) => cell.toLowerCase().replace(/\s+/g, ''))
  const importHeaders: LinkedInConnectionsHeaders = {
    firstNameIdx: headers.indexOf('firstname'),
    lastNameIdx: headers.indexOf('lastname'),
    companyIdx: headers.indexOf('company'),
    positionIdx: headers.indexOf('position'),
    urlIdx: headers.indexOf('url'),
    emailIdx: headers.indexOf('emailaddress'),
    connectedOnIdx: headers.indexOf('connectedon'),
  }
  const dataRows = rows.slice(headerIdx + 1)
  const companyGroups = new Map<string, string[][]>()
  const requiredWidth = Math.max(importHeaders.firstNameIdx, importHeaders.lastNameIdx, importHeaders.companyIdx)

  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index]
    if (row.length <= requiredWidth) continue
    const company = row[importHeaders.companyIdx]?.trim() || ''
    const members = companyGroups.get(company) ?? []
    members.push(row)
    companyGroups.set(company, members)
    if (index > 0 && index % 250 === 0) {
      await yieldToBrowser()
    }
  }

  const nextCircles = current.circles.map((circle) => ({ ...circle }))
  for (const circle of nextCircles) {
    if (shouldRecolorLegacyLinkedInCompany(circle)) {
      circle.tone = toneForLinkedInCompany(circle.id)
    }
  }
  const nextPeople = current.people.map((person) => ({
    ...person,
    notes: person.notes ? person.notes.map((note) => ({ ...note })) : person.notes,
    links: person.links ? person.links.map((link) => ({ ...link })) : person.links,
  }))
  const existingPersonIds = new Set(nextPeople.map((person) => person.id))
  const circlesById = new Map(nextCircles.map((circle) => [circle.id, circle]))
  const youCircle = circlesById.get('you')
  const youX = youCircle ? youCircle.x : 0
  const youY = youCircle ? youCircle.y : 0
  const existingPeopleByCircle = new Map<string, number>()
  for (const person of nextPeople) {
    existingPeopleByCircle.set(person.circleId, (existingPeopleByCircle.get(person.circleId) ?? 0) + 1)
  }
  let importedPeople = 0
  let importedCompanies = 0

  // Plan every company up front: its id, whether it already exists, and the radius
  // it needs to hold its members (sunflower-packed). New companies are then placed
  // in compact, non-overlapping concentric rings around "you" so the O(n^2)
  // collision relaxer never has to untangle an import pile-up.
  type PlannedCompany = { id: string; name: string; members: string[][]; radius: number }
  const planned: PlannedCompany[] = []
  for (const [companyName, members] of companyGroups) {
    const cleanCompName = companyName ? companyName : 'No Company'
    const companyId = `linkedin-company-${slugifyId(cleanCompName)}`
    const existing = circlesById.get(companyId)
    const plannedCount = (existingPeopleByCircle.get(companyId) ?? 0) + members.length
    planned.push({
      id: companyId,
      name: cleanCompName,
      members,
      radius: Math.max(existing?.radius ?? 0, packedCircleRadius(plannedCount)),
    })
  }

  // Pack new companies outside the farthest existing top-level circle so we never
  // land on top of content already on the board (e.g. on a re-import).
  let startRadius = youCircle ? youCircle.radius : 104
  for (const circle of nextCircles) {
    if (circle.id === 'you' || circle.parentId != null) continue
    startRadius = Math.max(startRadius, Math.hypot(circle.x - youX, circle.y - youY) + circle.radius)
  }
  const companyPositions = packCirclesInRings(
    planned.filter((company) => !circlesById.has(company.id)).map((company) => ({ id: company.id, radius: company.radius })),
    youX,
    youY,
    CIRCLE_COLLISION_GAP + 24,
    startRadius,
  )

  // Sunflower slot per circle, so re-imports keep packing past existing members.
  const slotByCircle = new Map<string, number>()
  for (const person of nextPeople) slotByCircle.set(person.circleId, (slotByCircle.get(person.circleId) ?? 0) + 1)

  let processedCompanies = 0
  for (const company of planned) {
    let companyCircle = circlesById.get(company.id)
    if (!companyCircle) {
      const pos = companyPositions.get(company.id) ?? { x: youX, y: youY }
      companyCircle = {
        id: company.id,
        name: company.name,
        icon: makeInitials(company.name),
        x: pos.x,
        y: pos.y,
        radius: company.radius,
        minRadius: company.radius,
        parentId: null,
        connectedTo: null,
        tone: toneForLinkedInCompany(company.id),
        fillMode: 'transparent',
        shapeType: 'circle',
        shapeCustom: false,
        sides: 25,
        amplitude: 0,
      }
      nextCircles.push(companyCircle)
      circlesById.set(companyCircle.id, companyCircle)
      importedCompanies += 1
    } else {
      companyCircle = growCircleForPackedPeople(nextCircles, companyCircle, (slotByCircle.get(companyCircle.id) ?? 0) + company.members.length)
      circlesById.set(companyCircle.id, companyCircle)
    }

    let slot = slotByCircle.get(companyCircle.id) ?? 0
    for (const memberRow of company.members) {
      const firstName = memberRow[importHeaders.firstNameIdx] || ''
      const lastName = memberRow[importHeaders.lastNameIdx] || ''
      const name = `${firstName} ${lastName}`.trim()
      if (!name) continue

      const personId = `linkedin-person-${slugifyId(name)}`
      if (existingPersonIds.has(personId)) continue

      const position = importHeaders.positionIdx !== -1 ? memberRow[importHeaders.positionIdx] || '' : ''
      const url = importHeaders.urlIdx !== -1 ? memberRow[importHeaders.urlIdx] || '' : ''
      const email = importHeaders.emailIdx !== -1 ? memberRow[importHeaders.emailIdx] || '' : ''
      const connectedOn = importHeaders.connectedOnIdx !== -1 ? memberRow[importHeaders.connectedOnIdx] || '' : ''
      const offset = personPackOffset(slot)
      const notesList: PersonNote[] = []

      if (position) {
        notesList.push({
          id: `note-pos-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          title: 'Position',
          body: position,
        })
      }
      if (connectedOn) {
        notesList.push({
          id: `note-conn-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          title: 'Connected On',
          body: connectedOn,
        })
      }
      if (email) {
        notesList.push({
          id: `note-email-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          title: 'Email',
          body: email,
        })
      }

      const linksList: PersonLink[] = url
        ? [{
            id: `link-linkedin-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            service: 'linkedin',
            label: 'LinkedIn',
            url,
          }]
        : []

      nextPeople.push({
        id: personId,
        name,
        x: companyCircle.x + offset.x,
        y: companyCircle.y + offset.y,
        circleId: companyCircle.id,
        avatar: makeInitials(name),
        shapeType: 'circle',
        sides: 10,
        amplitude: 0,
        notes: notesList,
        links: linksList,
      })

      existingPersonIds.add(personId)
      importedPeople += 1
      slot += 1

      if (importedPeople > 0 && importedPeople % 250 === 0) {
        await yieldToBrowser()
      }
    }
    slotByCircle.set(companyCircle.id, slot)
    companyCircle = growCircleForPackedPeople(nextCircles, companyCircle, slot)
    circlesById.set(companyCircle.id, companyCircle)

    processedCompanies += 1
    if (processedCompanies % 50 === 0) await yieldToBrowser()
  }

  await yieldToBrowser()

  // The import builds a non-overlapping layout, so the O(n^2) containment relax is
  // pure cost on a large graph (it would re-freeze the tab). Run it only for small
  // imports, where it cheaply tidies any edge cases; trust the packing above it.
  const built = repackLinkedInCompanyCircles({ ...current, circles: nextCircles, people: nextPeople })
  return {
    graph: nextCircles.length + nextPeople.length > IMPORT_LAYOUT_LIMIT ? built : ensureContainment(built),
    importedPeople,
    importedCompanies,
  }
}

function slugifyId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item'
}

function makeUniqueId(baseId: string, existingIds: Set<string>) {
  if (!existingIds.has(baseId)) return baseId
  let index = 2
  while (existingIds.has(`${baseId}-${index}`)) index += 1
  return `${baseId}-${index}`
}

function growCircleForPackedPeople(circles: CircleNode[], circle: CircleNode, peopleCount: number): CircleNode {
  const requiredRadius = packedCircleRadius(peopleCount)
  if (requiredRadius <= circle.radius && requiredRadius <= circle.minRadius) return circle

  const updated = {
    ...circle,
    radius: Math.max(circle.radius, requiredRadius),
    minRadius: Math.max(circle.minRadius, requiredRadius),
  }
  const index = circles.findIndex((candidate) => candidate.id === circle.id)
  if (index !== -1) circles[index] = updated
  return updated
}

function repackLinkedInCompanyCircles(graph: GraphState): GraphState {
  const companyCircles = graph.circles.filter(
    (circle) => circle.parentId == null && circle.id.startsWith('linkedin-company-'),
  )
  if (companyCircles.length <= 1) return graph

  const youCircle = graph.circles.find((circle) => circle.id === 'you')
  const youX = youCircle?.x ?? 0
  const youY = youCircle?.y ?? 0
  let startRadius = youCircle?.radius ?? 104

  const companyIds = new Set(companyCircles.map((circle) => circle.id))
  for (const circle of graph.circles) {
    if (circle.id === 'you' || circle.parentId != null || companyIds.has(circle.id)) continue
    startRadius = Math.max(startRadius, Math.hypot(circle.x - youX, circle.y - youY) + circle.radius)
  }

  const positions = packCirclesInRings(
    companyCircles.map((circle) => ({ id: circle.id, radius: circle.radius })),
    youX,
    youY,
    CIRCLE_COLLISION_GAP + 24,
    startRadius,
  )

  const deltaByCircleId = new Map<string, { x: number; y: number }>()
  for (const circle of companyCircles) {
    const next = positions.get(circle.id)
    if (!next) continue
    const delta = { x: next.x - circle.x, y: next.y - circle.y }
    if (Math.abs(delta.x) < 0.001 && Math.abs(delta.y) < 0.001) continue

    deltaByCircleId.set(circle.id, delta)
    for (const descendantId of getDescendantCircleIds(graph.circles, circle.id)) {
      deltaByCircleId.set(descendantId, delta)
    }
  }

  if (deltaByCircleId.size === 0) return graph

  return {
    ...graph,
    circles: graph.circles.map((circle) => {
      const delta = deltaByCircleId.get(circle.id)
      return delta ? { ...circle, x: circle.x + delta.x, y: circle.y + delta.y } : circle
    }),
    people: graph.people.map((person) => {
      const delta = deltaByCircleId.get(person.circleId)
      return delta ? { ...person, x: person.x + delta.x, y: person.y + delta.y } : person
    }),
  }
}

function findPersonByLinkedInProfileUrl(people: PersonNode[], profileUrl: string) {
  return people.find((person) =>
    (person.links ?? []).some((link) => link.service === 'linkedin' && normalizeLinkedInProfileUrl(link.url) === profileUrl)
  )
}

function personNeedsLinkedInEnrichment(person: PersonNode, circles: CircleNode[]) {
  const circle = circles.find((candidate) => candidate.id === person.circleId)
  const hasProfileNote = (person.notes ?? []).some((note) => note.title === 'Profile' || note.title === 'Enrichment')
  return !person.imageUrl || !hasProfileNote || !circle || circle.name === 'Unknown Company' || circle.name === 'No Company'
}

function ensureLinkedInCompanyCircle(current: GraphState, profile: LinkedInProfileImport) {
  const nextCircles = [...current.circles]
  const companyName = profile.company || 'Unknown Company'
  const companyId = `linkedin-company-${slugifyId(companyName)}`
  let companyCircle = nextCircles.find((circle) => circle.id === companyId)

  if (!companyCircle) {
    const youCircle = nextCircles.find((circle) => circle.id === 'you')
    const youX = youCircle ? youCircle.x : 0
    const youY = youCircle ? youCircle.y : 0
    const linkedInCompanyCount = nextCircles.filter((circle) => circle.id.startsWith('linkedin-company-')).length
    const angle = (linkedInCompanyCount / Math.max(6, linkedInCompanyCount + 1)) * 2 * Math.PI
    const placementRadius = 680
    companyCircle = {
      id: companyId,
      name: companyName,
      icon: makeInitials(companyName),
      imageUrl: profile.companyLogoUrl,
      x: youX + Math.cos(angle) * placementRadius,
      y: youY + Math.sin(angle) * placementRadius,
      radius: 90,
      minRadius: 90,
      parentId: null,
      connectedTo: null,
      tone: toneForLinkedInCompany(companyId),
      fillMode: 'transparent',
      shapeType: 'circle',
      shapeCustom: false,
      sides: 25,
      amplitude: 0,
    }
    nextCircles.push(companyCircle)
  } else if (companyCircle && profile.companyLogoUrl && !companyCircle.imageUrl) {
    companyCircle = {
      ...companyCircle,
      imageUrl: profile.companyLogoUrl,
    }
    const idx = nextCircles.findIndex((c) => c.id === companyCircle!.id)
    if (idx !== -1) nextCircles[idx] = companyCircle
  }
  if (companyCircle && shouldRecolorLegacyLinkedInCompany(companyCircle)) {
    companyCircle = {
      ...companyCircle,
      tone: toneForLinkedInCompany(companyCircle.id),
    }
    const idx = nextCircles.findIndex((c) => c.id === companyCircle!.id)
    if (idx !== -1) nextCircles[idx] = companyCircle
  }

  return { nextCircles, companyCircle: companyCircle as CircleNode }
}

function buildLinkedInProfileNotes(profile: LinkedInProfileImport, existingNotes: PersonNote[] = []) {
  const notes = existingNotes.filter((note) => note.title !== 'Profile' && note.title !== 'Headline' && note.title !== 'Enrichment')
  const normalizedHeadline = normalizeLinkedInNoteText(profile.headline)
  const normalizedDescription = normalizeLinkedInNoteText(profile.description ?? '')
  if (profile.headline) {
    notes.push({
      id: `note-headline-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      title: 'Headline',
      body: profile.headline,
    })
  }
  if (profile.description && normalizedDescription !== normalizedHeadline) {
    notes.push({
      id: `note-profile-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      title: 'Profile',
      body: profile.description,
    })
  }
  return notes
}

function updateLinkedInProfileInGraph(
  current: GraphState,
  personId: string,
  profile: LinkedInProfileImport,
): { graph: GraphState; person: PersonNode } {
  const existingPerson = current.people.find((person) => person.id === personId)
  if (!existingPerson) return addLinkedInProfileToGraph(current, profile)

  const { nextCircles, companyCircle } = ensureLinkedInCompanyCircle(current, profile)
  const companyMembers = current.people.filter((person) => person.id !== personId && person.circleId === companyCircle.id)
  const resizedCompanyCircle = growCircleForPackedPeople(nextCircles, companyCircle, companyMembers.length + 1)
  const shouldReposition = existingPerson.circleId !== resizedCompanyCircle.id
  const offset = personPackOffset(companyMembers.length)
  const updatedPerson: PersonNode = {
    ...existingPerson,
    name: profile.name || existingPerson.name,
    x: shouldReposition ? resizedCompanyCircle.x + offset.x : existingPerson.x,
    y: shouldReposition ? resizedCompanyCircle.y + offset.y : existingPerson.y,
    circleId: resizedCompanyCircle.id,
    avatar: makeInitials(profile.name || existingPerson.name),
    imageUrl: profile.avatarUrl || existingPerson.imageUrl,
    notes: buildLinkedInProfileNotes(profile, existingPerson.notes),
    links: existingPerson.links?.length
      ? existingPerson.links.map((link) =>
          link.service === 'linkedin' && normalizeLinkedInProfileUrl(link.url) === profile.url
            ? { ...link, url: profile.url, label: 'LinkedIn' }
            : link
        )
      : [{
          id: `link-linkedin-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          service: 'linkedin',
          label: 'LinkedIn',
          url: profile.url,
        }],
  }

  return {
    graph: settleInteractionGraph({
      ...current,
      circles: nextCircles,
      people: current.people.map((person) => (person.id === personId ? updatedPerson : person)),
    }),
    person: updatedPerson,
  }
}

function addLinkedInProfileToGraph(
  current: GraphState,
  profile: LinkedInProfileImport,
): { graph: GraphState; person: PersonNode } {
  const existingPerson = findPersonByLinkedInProfileUrl(current.people, profile.url)
  if (existingPerson) return updateLinkedInProfileInGraph(current, existingPerson.id, profile)

  const { nextCircles, companyCircle } = ensureLinkedInCompanyCircle(current, profile)
  const nextPeople = [...current.people]
  const companyMembers = nextPeople.filter((person) => person.circleId === companyCircle.id)
  const resizedCompanyCircle = growCircleForPackedPeople(nextCircles, companyCircle, companyMembers.length + 1)
  const offset = personPackOffset(companyMembers.length)
  const existingIds = new Set(nextPeople.map((person) => person.id))
  const personId = makeUniqueId(`linkedin-person-${slugifyId(profile.slug || profile.name)}`, existingIds)
  const notes = buildLinkedInProfileNotes(profile)

  const person: PersonNode = {
    id: personId,
    name: profile.name,
    x: resizedCompanyCircle.x + offset.x,
    y: resizedCompanyCircle.y + offset.y,
    circleId: resizedCompanyCircle.id,
    avatar: makeInitials(profile.name),
    shapeType: 'circle',
    sides: 10,
    amplitude: 0,
    imageUrl: profile.avatarUrl,
    notes,
    links: [{
      id: `link-linkedin-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      service: 'linkedin',
      label: 'LinkedIn',
      url: profile.url,
    }],
  }

  nextPeople.push(person)

  return {
    graph: settleInteractionGraph({
      ...current,
      circles: nextCircles,
      people: nextPeople,
    }),
    person,
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return false
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false
      }
      return true
    }
    const aObj = a as Record<string, unknown>
    const bObj = b as Record<string, unknown>
    const keys = Object.keys(aObj)
    if (keys.length !== Object.keys(bObj).length) return false
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(bObj, key)) return false
      if (!deepEqual(aObj[key], bObj[key])) return false
    }
    return true
  }
  return false
}

function isGraphStateEqual(g1: GraphState | null, g2: GraphState | null): boolean {
  if (g1 === g2) return true
  if (!g1 || !g2) return false

  if (g1.circles.length !== g2.circles.length) return false
  if (g1.people.length !== g2.people.length) return false
  if (g1.connections.length !== g2.connections.length) return false

  const c1 = [...g1.circles].sort((a, b) => a.id.localeCompare(b.id))
  const c2 = [...g2.circles].sort((a, b) => a.id.localeCompare(b.id))
  for (let i = 0; i < c1.length; i++) {
    if (!deepEqual(c1[i], c2[i])) return false
  }

  const p1 = [...g1.people].sort((a, b) => a.id.localeCompare(b.id))
  const p2 = [...g2.people].sort((a, b) => a.id.localeCompare(b.id))
  for (let i = 0; i < p1.length; i++) {
    if (!deepEqual(p1[i], p2[i])) return false
  }

  const conn1 = [...g1.connections].sort((a, b) => a.id.localeCompare(b.id))
  const conn2 = [...g2.connections].sort((a, b) => a.id.localeCompare(b.id))
  for (let i = 0; i < conn1.length; i++) {
    if (!deepEqual(conn1[i], conn2[i])) return false
  }

  return true
}

// Put the signed-in user's Google avatar + name on the "you" circle. Only fills
// the avatar when none is set, so a custom upload from a previous session wins.
function stampYouIdentity(graph: GraphState, user: User): GraphState {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const avatarUrl =
    typeof meta.avatar_url === 'string'
      ? meta.avatar_url
      : typeof meta.picture === 'string'
        ? meta.picture
        : undefined
  const fullName =
    typeof meta.full_name === 'string'
      ? meta.full_name
      : typeof meta.name === 'string'
        ? meta.name
        : undefined
  if (!avatarUrl && !fullName) return graph
  return {
    ...graph,
    circles: graph.circles.map((circle) =>
      circle.id === 'you'
        ? {
            ...circle,
            imageUrl: circle.imageUrl ?? avatarUrl,
            name: circle.name && circle.name !== 'You' ? circle.name : fullName ?? circle.name,
          }
        : circle,
    ),
  }
}

function sanitizeLegacyDemoLinkedInText(value: string) {
  const legacyHeadline = `Co-founder & Chief ${String.fromCharCode(83)}hit-Eater`
  if (value === legacyHeadline) return 'Co-founder & CEO'
  if (value === `${legacyHeadline}.`) return 'Co-founder and CEO at SocialDataNode.'
  return value
}

function normalizeLinkedInNoteText(value: string) {
  return value
    .toLowerCase()
    .replace(/\bat\s+socialdatanode\b/g, '')
    .replace(/\band\b/g, '&')
    .replace(/[^a-z0-9&]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sanitizeLinkedInProfileNotes(notes: PersonNote[] | undefined) {
  const sanitizedNotes = notes?.map((note) => ({
    ...note,
    body: sanitizeLegacyDemoLinkedInText(note.body),
  }))
  if (!sanitizedNotes) return sanitizedNotes

  const headline = sanitizedNotes.find((note) => note.title === 'Headline')
  if (!headline) return sanitizedNotes
  const normalizedHeadline = normalizeLinkedInNoteText(headline.body)
  if (!normalizedHeadline) return sanitizedNotes

  return sanitizedNotes.filter((note) => (
    note.title !== 'Profile' ||
    normalizeLinkedInNoteText(note.body) !== normalizedHeadline
  ))
}

function sanitizeDefaultCircleStyles(graph: GraphState): GraphState {
  const peopleByCircle = new Map<string, number>()
  for (const person of graph.people) {
    peopleByCircle.set(person.circleId, (peopleByCircle.get(person.circleId) ?? 0) + 1)
  }

  return {
    ...graph,
    people: graph.people.map((person) => ({
      ...person,
      notes: sanitizeLinkedInProfileNotes(person.notes),
    })),
    circles: graph.circles.map((circle) => {
      const styledCircle = circle.shapeCustom === true ||
        (circle.shapeType === 'circle' && circle.fillMode === 'transparent' && circle.sides === 25 && circle.amplitude === 0)
        ? circle
        : {
            ...circle,
            fillMode: 'transparent' as const,
            shapeType: 'circle' as const,
            shapeCustom: false,
            sides: 25,
            amplitude: 0,
          }

      const memberCount = styledCircle.id.startsWith('linkedin-company-') ? peopleByCircle.get(styledCircle.id) ?? 0 : 0
      if (memberCount <= 0) return styledCircle

      const requiredRadius = packedCircleRadius(memberCount)
      if (requiredRadius <= styledCircle.radius && requiredRadius <= styledCircle.minRadius) return styledCircle

      return {
        ...styledCircle,
        radius: Math.max(styledCircle.radius, requiredRadius),
        minRadius: Math.max(styledCircle.minRadius, requiredRadius),
      }
    }),
  }
}

function menuPosition(menu: CreateMenu) {
  return {
    left: Math.min(window.innerWidth - 308, Math.max(14, menu.screenX + 12)),
    top: Math.min(window.innerHeight - 190, Math.max(74, menu.screenY + 12)),
  }
}

function makeAvatar(index: number) {
  const names = ['AL', 'BD', 'CE', 'DK', 'EV', 'FX', 'GN', 'HM', 'IR']
  return names[index % names.length]
}





function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}



function CircleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" />
    </svg>
  )
}

function LinkedInIcon() {
  return <span aria-hidden="true">in</span>
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.75 9a2.5 2.5 0 0 1 4.54-1.43c.86 1.13.55 2.57-.56 3.31-.94.62-1.73 1.24-1.73 2.62" />
      <path d="M12 17h.01" />
    </svg>
  )
}

function PointerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 3l9 18 2.4-7.6L21 11 5 3z" />
      <path d="m13.5 13.5 4 4" />
    </svg>
  )
}

function PanIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v18" />
      <path d="m8 7 4-4 4 4" />
      <path d="m8 17 4 4 4-4" />
      <path d="M3 12h18" />
      <path d="m7 8-4 4 4 4" />
      <path d="m17 8 4 4-4 4" />
    </svg>
  )
}

function SelectIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}



function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{
        width: '16px',
        height: '16px',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{
        width: '16px',
        height: '16px',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{
        width: '16px',
        height: '16px',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }}
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 15H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

function BackArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{
        width: '18px',
        height: '18px',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }}
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function PaletteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="13.5" cy="6.5" r=".5" />
      <circle cx="17.5" cy="10.5" r=".5" />
      <circle cx="8.5" cy="7.5" r=".5" />
      <circle cx="6.5" cy="12.5" r=".5" />
      <path d="M12 3a9 9 0 0 0 0 18h1.6a2.4 2.4 0 0 0 1.7-4.1l-.4-.4a1.2 1.2 0 0 1 .8-2h1.8A3.5 3.5 0 0 0 21 11c0-4.4-4-8-9-8Z" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

// Official full-color brand logos (gilbarbara/logos, CC0), imported as SVG assets
// so they stay crisp at any size. "website" is a generic globe (no brand).
const SERVICE_ICONS: Record<PersonLinkService, string> = {
  linkedin: linkedinIcon,
  telegram: telegramIcon,
  instagram: instagramIcon,
  facebook: facebookIcon,
  whatsapp: whatsappIcon,
  x: xIcon,
  website: websiteIcon,
}

function ConnectionServiceIcon({ service }: { service: PersonLinkService }) {
  return <img className="service-icon" src={SERVICE_ICONS[service]} alt="" aria-hidden="true" />
}

function GoogleIcon() {
  return <img className="google-icon" src={googleIcon} alt="" aria-hidden="true" />
}

function getResizeCursor(point: { x: number; y: number }, circle: { x: number; y: number }): string {
  const dx = point.x - circle.x
  const dy = point.y - circle.y
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI
  if (deg < 0) deg += 360

  if (deg >= 337.5 || deg < 22.5) return 'ew-resize'
  if (deg >= 22.5 && deg < 67.5) return 'nwse-resize'
  if (deg >= 67.5 && deg < 112.5) return 'ns-resize'
  if (deg >= 112.5 && deg < 157.5) return 'nesw-resize'
  if (deg >= 157.5 && deg < 202.5) return 'ew-resize'
  if (deg >= 202.5 && deg < 247.5) return 'nwse-resize'
  if (deg >= 247.5 && deg < 292.5) return 'ns-resize'
  return 'nesw-resize'
}

export default App
