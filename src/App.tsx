import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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

zip.configure({ useWebWorkers: false })
import { useAuth } from './lib/useAuth'
import LandingPage from './LandingPage'
import { loadGraph, saveGraph, loadLocalGraph, saveLocalGraph } from './lib/graphPersistence'
import { enrichLinkedInProfile } from './lib/linkedinEnrichment'
import { OnboardingCoach } from './Onboarding'
import { SelectionIndicator } from './components/SelectionIndicator'
import { M3Slider } from './components/M3Slider'
import { ONBOARDING_STEPS, ONBOARDING_DONE_STEP } from './onboardingSteps'
import type { OnboardingAction } from './onboardingSteps'
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
  GraphState,
  Camera,
  DragConnector,
  MarqueeState,
  SelectedItem,
  HsvColor,
  BoardAnim,
} from './lib/board/types'
import {
  MIN_SCALE,
  MAX_SCALE,
  CONNECT_THRESHOLD,
  PERSON_CONTAINMENT_RADIUS,
  CIRCLE_CONTAINMENT_PADDING,
  MERGE_LAYOUT_LIMIT,
  MATERIAL_TONES,
  CIRCLE_COLOR_PRESETS,
  LINK_SERVICE_OPTIONS,
} from './lib/board/constants'
import { getCircleColors, hexToHsv, hsvToHex, getReadableColor } from './lib/board/colors'
import { clamp } from './lib/board/geometry'
import {
  ensureContainment,
  resizeCircleFromPoint,
  createFreshGraph,
  findFreeSpaceInCircle,
  getDescendantCircleIds,
} from './lib/board/layout'
import { createBoardIndex, hitTestBoard, readAnimFrame, drawBoardLayer, setBoardRepaintCallback } from './lib/board/render'
import { makeInitials } from './lib/board/text'

export type { CircleNode, PersonNode, Connection, GraphState, CircleTone } from './lib/board/types'

// Undo history kept at module scope (not useRef) so the mutating helpers that
// read/write it aren't analyzed as accessing React refs during render. Single
// mount in this app, so a plain stack is enough; one snapshot per user action.
const MAX_UNDO_STEPS = 100
const undoHistory: GraphState[] = []

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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
}

type LinkedInProfileImport = {
  url: string
  slug: string
  name: string
  company: string
  headline: string
  description?: string
  avatarUrl?: string
  source: 'brightdata' | 'cache' | 'preview' | 'fallback'
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
}

type ResizeCircleState = {
  pointerId: number
  circleId: string
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
  const needsPreviewFallback = !enrichment?.name || !enrichment?.company || !enrichment?.headline || !enrichment?.avatarUrl
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

// First-run flag for the onboarding tour. Kept in localStorage so a returning
// visitor isn't shown the card on every load.
const ONBOARDING_STORAGE_KEY = 'social-onboarding-done-v1'

function hasSeenOnboarding(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function markOnboardingSeen() {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
  } catch {
    // ignore
  }
}

function App() {
  const [viewMode, setViewMode] = useState<'landing' | 'board'>(() => {
    // Show landing page only if #landing is explicitly requested in the URL
    return window.location.hash === '#landing' ? 'landing' : 'board';
  });

  const handleLaunchApp = () => {
    setViewMode('board');
    window.location.hash = ''; // clear hash to load the board workspace
  };

  useEffect(() => {
    const handleHashChange = () => {
      const isLanding = window.location.hash === '#landing';
      setViewMode(isLanding ? 'landing' : 'board');
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
  // Drag updates are coalesced to one React commit per animation frame (like the
  // pan/zoom gesture) so a move event flood doesn't trigger a re-render storm.
  const dragRafRef = useRef<number | null>(null)
  const pendingGraphRef = useRef<((current: GraphState) => GraphState) | null>(null)
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
  // Sign-in dialog: a single "Sign in" button opens this; it holds every
  // sign-in option so the Settings panel itself stays compact.
  const [showSignInModal, setShowSignInModal] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [emailAuthMode, setEmailAuthMode] = useState<'signin' | 'signup'>('signin')
  const [emailAuthBusy, setEmailAuthBusy] = useState(false)
  const [emailAuthNotice, setEmailAuthNotice] = useState<string | null>(null)

  const openSignInModal = () => {
    setEmailAuthMode('signin')
    setEmailAuthNotice(null)
    setShowSignInModal(true)
  }

  const handleEmailAuthSubmit = async () => {
    const email = emailInput.trim()
    if (!email || !passwordInput || emailAuthBusy) return
    setEmailAuthBusy(true)
    setEmailAuthNotice(null)
    try {
      if (emailAuthMode === 'signup') {
        const { error, needsConfirmation } = await auth.signUpWithEmail(email, passwordInput)
        if (!error && needsConfirmation) {
          setEmailAuthNotice('Check your email to confirm your account, then sign in.')
          setPasswordInput('')
        }
      } else {
        const { error } = await auth.signInWithEmail(email, passwordInput)
        if (!error) {
          setShowSignInModal(false)
          setPasswordInput('')
        }
      }
    } finally {
      setEmailAuthBusy(false)
    }
  }
  // True once we've pulled this user's saved graph (or confirmed they have none).
  // The board stays hidden until then so the demo seed never flashes or gets saved.
  const [graphLoaded, setGraphLoaded] = useState(false)
  // Bumped when an avatar image finishes decoding, to force a board repaint.
  const [imageEpoch, setImageEpoch] = useState(0)

  useEffect(() => {
    setBoardRepaintCallback(() => setImageEpoch((epoch) => epoch + 1))
    return () => {
      setBoardRepaintCallback(null)
    }
  }, [])

  // Load the signed-in user's graph; a brand-new account starts from a blank
  // canvas with only their "you" circle — the local demo data is never persisted.
  useEffect(() => {
    if (auth.status !== 'authenticated' || !userId || !auth.session) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGraphLoaded(false)
    loadGraph(userId)
      .then((saved) => {
        if (cancelled) return
        const base = saved ?? createFreshGraph()
        setGraph(stampYouIdentity(base, auth.session!.user))
        setGraphLoaded(true)
      })
      .catch((error) => {
        console.error('Failed to load graph', error)
        if (!cancelled) {
          setGraph(stampYouIdentity(createFreshGraph(), auth.session!.user))
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
    const timer = window.setTimeout(() => {
      void saveGraph(userId, graph).catch((error) => console.error('Failed to save graph', error))
    }, 800)
    return () => window.clearTimeout(timer)
  }, [graph, graphLoaded, auth.status, userId])

  // Signed-out visitors aren't blocked: their board is restored from (and saved
  // to) localStorage so work survives a reload without an account. Signing in
  // takes over with the Supabase-backed graph via the effects above.
  const isLocalMode = auth.status === 'anonymous' || auth.status === 'unconfigured'

  useEffect(() => {
    if (!isLocalMode) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGraphLoaded(false)
    const saved = loadLocalGraph()
    if (saved) {
      setGraph(saved)
    }
    setGraphLoaded(true)
  }, [isLocalMode])

  // Debounced local autosave for signed-out visitors.
  useEffect(() => {
    if (!graphLoaded || !isLocalMode) return
    const timer = window.setTimeout(() => {
      saveLocalGraph(graph)
    }, 800)
    return () => window.clearTimeout(timer)
  }, [graph, graphLoaded, isLocalMode])

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

  const [connector, setConnector] = useState<DragConnector | null>(null)
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)
  const [createMenu, setCreateMenu] = useState<CreateMenu | null>(null)
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null)
  const [showCircleDropdown, setShowCircleDropdown] = useState(false)
  const [showCircleStylePanel, setShowCircleStylePanel] = useState(false)
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([])
  const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>([])
  const [hoveredPersonId, setHoveredPersonId] = useState<string | null>(null)
  const [hoveredCircleEdgeId, setHoveredCircleEdgeId] = useState<string | null>(null)
 
  // Onboarding tour. -1 = inactive. A ref mirrors the step so board event
  // handlers (wired once in effects) always read the live value.
  const [onboardingStep, setOnboardingStep] = useState(-1)
  const onboardingStepRef = useRef(onboardingStep)
  useEffect(() => {
    onboardingStepRef.current = onboardingStep
  }, [onboardingStep])

  // True during the brief "Great!" beat that plays after a gesture, before the
  // card advances to the next step.
  const [onboardingCelebrating, setOnboardingCelebrating] = useState(false)
  const onboardingCelebrateRef = useRef(false)
  const onboardingTimerRef = useRef<number | null>(null)
  const onboardingDecidedRef = useRef(false)

  // Decide once per load whether to open the tour. On the dev server it always
  // opens for signed-out visitors (acts as the landing); in production it shows
  // only once ever, tracked in localStorage — so it isn't a popup on every visit.
  useEffect(() => {
    if (onboardingDecidedRef.current) return
    if (!graphLoaded || auth.status === 'loading') return
    onboardingDecidedRef.current = true
    const isSignedOut = auth.status === 'anonymous' || auth.status === 'unconfigured'
    const devAlwaysShow = import.meta.env.DEV && isSignedOut
    if (devAlwaysShow || !hasSeenOnboarding()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOnboardingStep(0)
      if (!devAlwaysShow) markOnboardingSeen()
    }
  }, [graphLoaded, auth.status])

  function clearOnboardingTimer() {
    if (onboardingTimerRef.current != null) {
      window.clearTimeout(onboardingTimerRef.current)
      onboardingTimerRef.current = null
    }
    onboardingCelebrateRef.current = false
    setOnboardingCelebrating(false)
  }

  function finishOnboarding() {
    clearOnboardingTimer()
    setOnboardingStep(-1)
    markOnboardingSeen()
  }

  function onboardingNext() {
    clearOnboardingTimer()
    setOnboardingStep((step) => {
      if (step < 0) return step
      if (step >= ONBOARDING_DONE_STEP) {
        markOnboardingSeen()
        return -1
      }
      const next = step + 1
      if (next === ONBOARDING_DONE_STEP) markOnboardingSeen()
      return next
    })
  }

  function onboardingBack() {
    clearOnboardingTimer()
    setOnboardingStep((step) => (step > 0 ? step - 1 : step))
  }

  // Called from board interaction handlers. When the action matches the step the
  // tour is waiting for, play a one-second "Great!" beat, then advance.
  function notifyOnboarding(action: OnboardingAction) {
    const step = onboardingStepRef.current
    if (step < 0 || step >= ONBOARDING_DONE_STEP) return
    if (ONBOARDING_STEPS[step].trigger !== action) return
    if (onboardingCelebrateRef.current) return
    onboardingCelebrateRef.current = true
    setOnboardingCelebrating(true)
    onboardingTimerRef.current = window.setTimeout(() => {
      onboardingTimerRef.current = null
      onboardingCelebrateRef.current = false
      setOnboardingCelebrating(false)
      setOnboardingStep((s) => {
        if (s < 0 || s >= ONBOARDING_DONE_STEP) return s
        const next = s + 1
        if (next === ONBOARDING_DONE_STEP) markOnboardingSeen()
        return next
      })
    }, 1100)
  }

  // The closing "you're ready" card dismisses itself after a beat so it never
  // lingers in the way; the Done button still closes it instantly.
  useEffect(() => {
    if (onboardingStep !== ONBOARDING_DONE_STEP) return
    const timer = window.setTimeout(() => setOnboardingStep(-1), 3600)
    return () => window.clearTimeout(timer)
  }, [onboardingStep])

  // Viewport size in CSS px, used to cull off-screen nodes. Updated on resize.
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })

  const [showSettings, setShowSettings] = useState(false)
  const [showLinkedInGuide, setShowLinkedInGuide] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [showCircleLabels, setShowCircleLabels] = useState(true)
  const [showPersonLabels, setShowPersonLabels] = useState(true)
  const [circleShapeMode, setCircleShapeMode] = useState<CircleShapeMode>('circles')
  const [circleFillMode, setCircleFillMode] = useState<CircleFillMode>('transparent')
  const [centerBehavior, setCenterBehavior] = useState<'connect' | 'move'>('connect')
  const [hoveredConnId, setHoveredConnId] = useState<string | null>(null)
  const [openNotesPersonId, setOpenNotesPersonId] = useState<string | null>(null)
  const [newNoteBody, setNewNoteBody] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [newLinkValue, setNewLinkValue] = useState('')
  const [newLinkService, setNewLinkService] = useState<PersonLinkService>('website')
  const [showLinkServicePicker, setShowLinkServicePicker] = useState(false)
  const noteInputRef = useRef<HTMLTextAreaElement>(null)

  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const settingsPanelRef = useRef<HTMLDivElement>(null)
  const linkedInGuidePanelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Search: a pill in the top toolbar that finds people (by name/role) and
  // circles (the "tags"), then flies the camera to the picked node.
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isImportingLinkedInProfile, setIsImportingLinkedInProfile] = useState(false)
  const [isImportingLinkedInZip, setIsImportingLinkedInZip] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchPanelRef = useRef<HTMLDivElement>(null)
  const focusAnimRef = useRef<number | null>(null)

  function selectItem(item: SelectedItem) {
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
    const cy = window.innerHeight * 0.44
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
  }

  async function handleImportLinkedInProfileFromSearch() {
    if (isImportingLinkedInProfile) return
    const profileUrl = getLinkedInProfileImportUrl(searchQuery)
    if (!profileUrl) return
    const existingPerson = findPersonByLinkedInProfileUrl(graph.people, profileUrl)
    if (existingPerson && !personNeedsLinkedInEnrichment(existingPerson, graph.circles)) {
      selectItem({ type: 'person', id: existingPerson.id })
      focusCameraOnWorld(existingPerson.x, existingPerson.y, 1.5)
      closeSearch()
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
      notifyOnboarding('import')
      selectItem({ type: 'person', id: next.person.id })
      focusCameraOnWorld(next.person.x, next.person.y, 1.5)
      closeSearch()
    } catch (err) {
      console.error(err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      alert(`Failed to import LinkedIn profile: ${errorMessage}`)
    } finally {
      setIsImportingLinkedInProfile(false)
    }
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
    setSelectedItem(null)
    setSelectedPeopleIds([])
    setCreateMenu(null)
  }

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
      undo()
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
      setGraph(result.graph)
      notifyOnboarding('import')

      alert(`LinkedIn data imported successfully: ${result.importedPeople} people across ${result.importedCompanies} companies.`)
    } catch (err) {
      console.error(err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      alert(`Failed to import LinkedIn ZIP: ${errorMessage}`)
    } finally {
      setIsImportingLinkedInZip(false)
      event.target.value = ''
    }
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
    pushHistory()
    setGraph((current) => ({
      ...current,
      people: current.people.map((p) =>
        p.id === personId ? { ...p, isFavorite: !p.isFavorite } : p
      ),
    }))
  }

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

  function setCircleColorFromHsv(circleId: string, hsv: HsvColor) {
    updateCircleStyle(circleId, { customColor: hsvToHex(hsv) })
  }

  function handleColorWheelPointer(event: ReactPointerEvent<HTMLButtonElement>, circle: CircleNode) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = event.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const dx = event.clientX - centerX
    const dy = event.clientY - centerY
    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2)
    const distance = Math.min(radius, Math.hypot(dx, dy))
    const current = hexToHsv(getCircleColors(circle).centerBg)
    const angle = Math.atan2(dy, dx)
    const hue = (angle * 180) / Math.PI + 180
    setCircleColorFromHsv(circle.id, {
      h: hue,
      s: distance / radius,
      v: current.v,
    })
  }

  function handleBrightnessPointer(event: ReactPointerEvent<HTMLButtonElement>, circle: CircleNode) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = event.currentTarget.getBoundingClientRect()
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    const current = hexToHsv(getCircleColors(circle).centerBg)
    setCircleColorFromHsv(circle.id, {
      ...current,
      v: x,
    })
  }

  function handleSwatchPointerDown(id: string, action: () => void) {
    ++swatchPressTxRef.current
    setPressingSwatchId(id)
    setReturningSwatchId(null)
    pressingSwatchIdRef.current = id
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
    const fromSides = circle.sides ?? 25
    const amplitude = circle.amplitude ?? 0
    const fromShapeType = circle.shapeType ?? (amplitude > 0 ? 'wavy' : fromSides >= 25 ? 'circle' : 'polygon')
    const toShapeType = amplitude > 0 ? 'wavy' : sides >= 25 ? 'circle' : 'polygon'
    updateCircleStyle(circle.id, {
      shapeType: toShapeType,
      sides,
      amplitude,
    })
    // Morph the shape smoothly over a snappy 250ms interval.
    if (fromSides !== sides) {
      startBoardAnim('morph:' + circle.id, 250, {
        fromSides,
        fromAmp: amplitude,
        toSides: sides,
        toAmp: amplitude,
        fromShapeType,
        toShapeType,
      })
    }
  }

  function updateCircleAmplitude(circle: CircleNode, amplitude: number) {
    const sides = circle.sides ?? 25
    const fromAmplitude = circle.amplitude ?? 0
    const fromShapeType = circle.shapeType ?? (fromAmplitude > 0 ? 'wavy' : sides >= 25 ? 'circle' : 'polygon')
    const toShapeType = amplitude > 0 ? 'wavy' : sides >= 25 ? 'circle' : 'polygon'
    updateCircleStyle(circle.id, {
      shapeType: toShapeType,
      sides,
      amplitude,
    })
    // Only schedule a morph animation for significant jumps (e.g. tapping the track).
    // Continuous drag steps update statically in real-time.
    if (Math.abs(amplitude - fromAmplitude) > 1.5) {
      startBoardAnim('morph:' + circle.id, 250, {
        fromSides: sides,
        fromAmp: fromAmplitude,
        toSides: sides,
        toAmp: amplitude,
        fromShapeType,
        toShapeType,
      })
    }
  }

  function deleteCircle(circleId: string) {
    if (circleId === 'you') return

    pushHistory()
    setGraph((current) => {
      // 1. Gather all descendant circle IDs recursively
      const deletedCircleIds = new Set<string>([circleId])
      let expanded = true
      while (expanded) {
        expanded = false
        for (const c of current.circles) {
          if (c.parentId && deletedCircleIds.has(c.parentId) && !deletedCircleIds.has(c.id)) {
            deletedCircleIds.add(c.id)
            expanded = true
          }
        }
      }

      // 2. Identify people inside those circles
      const deletedPeopleIds = new Set<string>()
      for (const p of current.people) {
        if (deletedCircleIds.has(p.circleId)) {
          deletedPeopleIds.add(p.id)
        }
      }

      // 3. Filter circles: remove deleted, update connectedTo if it points to a deleted circle
      const nextCircles = current.circles
        .filter((c) => !deletedCircleIds.has(c.id))
        .map((c) => {
          if (c.connectedTo && deletedCircleIds.has(c.connectedTo)) {
            return { ...c, connectedTo: 'you' }
          }
          return c
        })

      // 4. Filter people: remove deleted
      const nextPeople = current.people.filter((p) => !deletedPeopleIds.has(p.id))

      // 5. Filter connections: remove if fromId or toId is deleted
      const nextConnections = (current.connections || []).filter(
        (conn) =>
          !deletedPeopleIds.has(conn.fromId) &&
          !deletedCircleIds.has(conn.fromId) &&
          !deletedPeopleIds.has(conn.toId) &&
          !deletedCircleIds.has(conn.toId)
      )

      return ensureContainment({
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
    setGraph((current) => ({
      ...current,
      connections: (current.connections || []).filter((conn) => conn.id !== connId),
    }))
    selectItem(null)
  }

  function deleteSelectedItem() {
    if (selectedPeopleIds.length > 0 || selectedCircleIds.length > 0) {
      pushHistory()
      setGraph((current) => {
        const deletedCircleIds = new Set<string>(selectedCircleIds)
        let expanded = true
        while (expanded) {
          expanded = false
          for (const c of current.circles) {
            if (c.parentId && deletedCircleIds.has(c.parentId) && !deletedCircleIds.has(c.id)) {
              deletedCircleIds.add(c.id)
              expanded = true
            }
          }
        }

        const deletedPeopleIds = new Set<string>(selectedPeopleIds)
        for (const p of current.people) {
          if (deletedCircleIds.has(p.circleId)) {
            deletedPeopleIds.add(p.id)
          }
        }

        const nextCircles = current.circles
          .filter((c) => !deletedCircleIds.has(c.id))
          .map((c) => {
            if (c.connectedTo && deletedCircleIds.has(c.connectedTo)) {
              return { ...c, connectedTo: 'you' }
            }
            return c
          })

        const nextPeople = current.people.filter((p) => !deletedPeopleIds.has(p.id))

        const nextConnections = (current.connections || []).filter(
          (conn) =>
            !deletedPeopleIds.has(conn.fromId) &&
            !deletedPeopleIds.has(conn.toId) &&
            !deletedCircleIds.has(conn.fromId) &&
            !deletedCircleIds.has(conn.toId)
        )

        return ensureContainment({
          ...current,
          circles: nextCircles,
          people: nextPeople,
          connections: nextConnections,
        })
      })
      setSelectedPeopleIds([])
      setSelectedCircleIds([])
      selectItem(null)
    } else if (selectedItem?.type === 'person') {
      deletePerson(selectedItem.id)
    } else if (selectedItem?.type === 'circle') {
      deleteCircle(selectedItem.id)
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

  // Live search results: people matched on name/role, circles ("tags") on name.
  // Capped so the dropdown stays compact; people first since finding a person is
  // the primary use, circles after.
  const searchResults = useMemo<SearchResult[]>(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    const linkedInUrl = getLinkedInProfileImportUrl(searchQuery)
    const linkedInImport: SearchResult[] = linkedInUrl
      ? [{
          kind: 'linkedin-profile',
          id: linkedInUrl,
          name: isImportingLinkedInProfile ? 'Enriching with Bright Data...' : 'Add LinkedIn profile',
          sub: isImportingLinkedInProfile ? linkedInUrl : linkedInUrl,
        }]
      : []
    const people: SearchResult[] = displayPeople
      .filter((p) => p.name.toLowerCase().includes(q) || (p.role || '').toLowerCase().includes(q))
      .map((p) => ({ kind: 'person', id: p.id, name: p.name, sub: p.role || '' }))
    const circles: SearchResult[] = displayCircles
      .filter((c) => c.name.toLowerCase().includes(q))
      .map((c) => ({ kind: 'circle', id: c.id, name: c.name, sub: 'Circle' }))
    return [...linkedInImport, ...people, ...circles].slice(0, 8)
  }, [searchQuery, isImportingLinkedInProfile, displayPeople, displayCircles])
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





  const selectedCircle = selectedItem?.type === 'circle' ? circlesById.get(selectedItem.id) ?? null : null
  const selectedPerson = selectedItem?.type === 'person' ? graph.people.find((person) => person.id === selectedItem.id) ?? null : null
  const selectedConnection = selectedItem?.type === 'connection' ? (graph.connections || []).find((conn) => conn.id === selectedItem.id) ?? null : null



  // Push the live camera onto the dotted grid without going through React.
  function applyDomCamera(cam: Camera) {
    const surface = surfaceRef.current
    if (surface) {
      const minor = 32 * cam.scale
      const major = 160 * cam.scale
      surface.style.backgroundSize = `${major}px ${major}px, ${minor}px ${minor}px`
      surface.style.backgroundPosition = `${cam.x}px ${cam.y}px`
    }
  }

  // One imperative frame of a gesture: move the DOM and repaint the (culled)
  // people canvas at the live camera, so newly revealed people fill in mid-pan.
  function applyLiveCamera() {
    const cam = cameraRef.current
    applyDomCamera(cam)
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
        hoveredCircleEdgeId,
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
    gestureActiveRef.current = false
    setCamera(cameraRef.current)
  }

  // Keep stable refs pointing at the latest gesture closures (so the wheel
  // listener, registered once, always calls the current ones), and — if
  // anything re-renders App mid-gesture (e.g. the FPS meter ticks) — re-assert
  // the live transform before the browser paints so it can't snap back to the
  // stale settled camera.
  useLayoutEffect(() => {
    driveCameraRef.current = driveCamera
    settleGestureRef.current = settleGesture
    if (gestureActiveRef.current) applyDomCamera(cameraRef.current)
  })

  useEffect(() => () => {
    if (gestureRafRef.current != null) window.cancelAnimationFrame(gestureRafRef.current)
    if (settleTimerRef.current != null) window.clearTimeout(settleTimerRef.current)
    if (dragRafRef.current != null) window.cancelAnimationFrame(dragRafRef.current)
    if (boardAnimRafRef.current != null) window.cancelAnimationFrame(boardAnimRafRef.current)
    if (focusAnimRef.current != null) window.cancelAnimationFrame(focusAnimRef.current)
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
  const paintBoard = (now?: number) => {
    const canvas = peopleCanvasRef.current
    const surface = surfaceRef.current
    if (!canvas || !surface) return
    const frame = readAnimFrame(boardAnimsRef.current, now ?? animNowRef.current)
    drawBoardLayer(
      canvas,
      surface,
      camera,
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
      hoveredCircleEdgeId,
      frame,
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
    for (const [key, a] of boardAnimsRef.current) {
      const start = a.start < 0 ? now : a.start // anchor on first frame
      if (now - start >= a.duration) {
        boardAnimsRef.current.delete(key)
      } else {
        if (a.start < 0) boardAnimsRef.current.set(key, { ...a, start })
        active = true
      }
    }
    paintBoardRef.current(now)
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
      notifyOnboarding('move')
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

  // Cancel the pending frame and return the last pending graph updater (if any),
  // so pointer-up can apply the final position immediately (plus containment).
  function takePendingGraphUpdate() {
    if (dragRafRef.current != null) {
      window.cancelAnimationFrame(dragRafRef.current)
      dragRafRef.current = null
    }
    const update = pendingGraphRef.current
    pendingGraphRef.current = null
    return update
  }

  // Set the board cursor imperatively (avoids a re-render). The hand only shows
  // while a real pan/drag is happening; resting and clicking keep the arrow, and
  // anything interactive under the pointer shows the pointer cursor.
  function setSurfaceCursor(value: string) {
    const surface = surfaceRef.current
    if (surface && surface.style.cursor !== value) surface.style.cursor = value
  }

  function handleSurfacePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch' && event.button !== 0 && event.button !== 2) return
    const isRightClick = event.pointerType !== 'touch' && event.button === 2
    isRightClickDragRef.current = isRightClick

    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)

    activePointersRef.current = [
      ...activePointersRef.current.filter((p) => p.pointerId !== event.pointerId),
      event.nativeEvent,
    ]

    if (activePointersRef.current.length >= 2) {
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

    if (!demoMode) setCreateMenu(null)
    setOpenNotesPersonId(null)
    // A fresh gesture hasn't recorded its undo snapshot yet.
    gestureSnapshotTakenRef.current = false

    const hit = hitTestBoard(boardIndex, cameraRef.current, selectedItem, {
      x: event.clientX,
      y: event.clientY,
    })

    if (hit?.type === 'connector-handle') {
      if (isRightClick) return
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
        if (event.shiftKey) {
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
          if (!selectedPeopleIds.includes(hit.person.id)) {
            setSelectedPeopleIds([])
            setSelectedCircleIds([])
            selectItem({ type: 'person', id: hit.person.id })
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
        selectItem({ type: 'circle', id: hit.circle.id })
        startCircleMove(event, hit.circle)
      } else {
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
          if (!selectedCircleIds.includes(hit.circle.id)) {
            setSelectedPeopleIds([])
            setSelectedCircleIds([])
            selectItem({ type: 'circle', id: hit.circle.id })
          }
          // When this zone is part of a multi/mixed selection, grabbing its center
          // drags the whole group instead of starting a connector.
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

    if (isRightClick) {
      setSelectedPeopleIds([])
      setSelectedCircleIds([])
      selectItem(null)
      setOpenNotesPersonId(null)
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
        if (!selectedCircleIds.includes(hit.circle.id)) {
          setSelectedPeopleIds([])
          setSelectedCircleIds([])
          selectItem({ type: 'circle', id: hit.circle.id })
        }
        startCircleMove(event, hit.circle)
      }
      return
    }

    if (hit?.type === 'connection') {
      setSelectedPeopleIds([])
      setSelectedCircleIds([])
      selectItem({ type: 'connection', id: hit.connection.id })
      return
    }

    setSelectedPeopleIds([])
    setSelectedCircleIds([])
    selectItem(null)
    setOpenNotesPersonId(null)
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: camera.x,
      originY: camera.y,
    }
  }

  function handleSurfacePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    activePointersRef.current = activePointersRef.current.map((p) =>
      p.pointerId === event.pointerId ? event.nativeEvent : p
    )

    if (marqueeRef.current) {
      marqueeRef.current.currentX = event.clientX
      marqueeRef.current.currentY = event.clientY
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
      return
    }

    const pan = panRef.current
    if (pan?.pointerId === event.pointerId) {
      driveCamera({
        ...cameraRef.current,
        x: pan.originX + event.clientX - pan.startX,
        y: pan.originY + event.clientY - pan.startY,
      })
    }

    // During a drag, coalesce graph layout to one animation-frame commit. The
    // active item stays under the pointer while collision layout pushes blockers.
    const moving = moveCircleRef.current
    if (moving?.pointerId === event.pointerId) {
      ensureGestureSnapshot()
      const deltaX = (event.clientX - moving.startX) / camera.scale
      const deltaY = (event.clientY - moving.startY) / camera.scale
      const { circleOrigins, personOrigins } = moving
      pendingGraphRef.current = (current) =>
        ensureContainment(
          {
            ...current,
            circles: current.circles.map((c) =>
              circleOrigins && c.id in circleOrigins
                ? { ...c, x: circleOrigins[c.id].x + deltaX, y: circleOrigins[c.id].y + deltaY }
                : c
            ),
            people: current.people.map((p) =>
              personOrigins && p.id in personOrigins
                ? { ...p, x: personOrigins[p.id].x + deltaX, y: personOrigins[p.id].y + deltaY }
                : p
            ),
          },
          { activeCircleId: moving.circleId },
        )
      scheduleDrag()
    }

    const movingPerson = movePersonRef.current
    if (movingPerson?.pointerId === event.pointerId) {
      ensureGestureSnapshot()
      const deltaX = (event.clientX - movingPerson.startX) / camera.scale
      const deltaY = (event.clientY - movingPerson.startY) / camera.scale
      const { selectedOrigins, circleOrigins } = movingPerson
      pendingGraphRef.current = (current) =>
        ensureContainment(
          {
            ...current,
            circles: current.circles.map((c) =>
              circleOrigins && c.id in circleOrigins
                ? { ...c, x: circleOrigins[c.id].x + deltaX, y: circleOrigins[c.id].y + deltaY }
                : c
            ),
            people: current.people.map((person) => {
              if (selectedOrigins && person.id in selectedOrigins) {
                const origin = selectedOrigins[person.id]
                return { ...person, x: origin.x + deltaX, y: origin.y + deltaY }
              } else if (person.id === movingPerson.personId) {
                return { ...person, x: movingPerson.originX + deltaX, y: movingPerson.originY + deltaY }
              }
              return person
            }),
          },
          { activePersonId: movingPerson.personId },
        )
      scheduleDrag()
    }

    const resizing = resizeCircleRef.current
    if (resizing?.pointerId === event.pointerId) {
      ensureGestureSnapshot()
      const world = screenToWorld({ x: event.clientX, y: event.clientY })
      pendingGraphRef.current = (current) => resizeCircleFromPoint(current, resizing.circleId, world)
      scheduleDrag()
    }

    if (connector) {
      const world = screenToWorld({ x: event.clientX, y: event.clientY })
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
      })
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
      const hit = hitTestBoard(boardIndex, cameraRef.current, selectedItem, {
        x: event.clientX,
        y: event.clientY,
      })
      const id = hit?.type === 'person' ? hit.person.id : null
      if (id !== hoveredPersonId) setHoveredPersonId(id)
      const connId = hit?.type === 'connection' ? hit.connection.id : null
      if (connId !== hoveredConnId) setHoveredConnId(connId)
      const edgeId = hit?.type === 'circle-edge' ? hit.circle.id : null
      if (edgeId !== hoveredCircleEdgeId) setHoveredCircleEdgeId(edgeId)
    } else {
      if (hoveredPersonId) setHoveredPersonId(null)
      if (hoveredConnId) setHoveredConnId(null)
      if (hoveredCircleEdgeId) setHoveredCircleEdgeId(null)
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
    })
    setSurfaceCursor(upHit ? 'pointer' : 'default')

    if (marqueeRef.current) {
      const startX = marqueeRef.current.startX
      const startY = marqueeRef.current.startY
      const currentX = event.clientX
      const currentY = event.clientY

      const pStart = screenToWorld({ x: Math.min(startX, currentX), y: Math.min(startY, currentY) })
      const pEnd = screenToWorld({ x: Math.max(startX, currentX), y: Math.max(startY, currentY) })

      const selectedPIds = graph.people
        .filter((p) => p.x >= pStart.x && p.x <= pEnd.x && p.y >= pStart.y && p.y <= pEnd.y)
        .map((p) => p.id)

      const selectedCIds = graph.circles
        .filter((c) => c.id !== 'you' && c.x >= pStart.x && c.x <= pEnd.x && c.y >= pStart.y && c.y <= pEnd.y)
        .map((c) => c.id)

      setSelectedPeopleIds(selectedPIds)
      setSelectedCircleIds(selectedCIds)
      selectItem(null)

      marqueeRef.current = null
      setMarquee(null)
      settleGesture()
      isRightClickDragRef.current = false
      return
    }

    if (activePointersRef.current.length === 0) {
      settleGesture()
    }

    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null
      settleGesture()
      notifyOnboarding('move')
    }

    const movingPersonId = movePersonRef.current?.pointerId === event.pointerId ? movePersonRef.current.personId : null
    const movingCircleId = moveCircleRef.current?.pointerId === event.pointerId ? moveCircleRef.current.circleId : null
    const selectedOrigins = movePersonRef.current?.pointerId === event.pointerId ? movePersonRef.current.selectedOrigins : null
    const disconnectedCircleIds = moveCircleRef.current?.pointerId === event.pointerId ? moveCircleRef.current.disconnectedCircleIds : null
    const wasRightClickDrag = isRightClickDragRef.current

    const wasResize = resizeCircleRef.current?.pointerId === event.pointerId
    const wasNodeMove =
      moveCircleRef.current?.pointerId === event.pointerId ||
      movePersonRef.current?.pointerId === event.pointerId

    const endingMove = wasNodeMove || wasResize

    if (moveCircleRef.current?.pointerId === event.pointerId) moveCircleRef.current = null
    if (movePersonRef.current?.pointerId === event.pointerId) movePersonRef.current = null
    if (resizeCircleRef.current?.pointerId === event.pointerId) resizeCircleRef.current = null

    if (endingMove) {
      if (wasResize) notifyOnboarding('resize')
      else if (wasNodeMove) notifyOnboarding('move')

      // Apply the final dragged position immediately, including any queued layout pass.
      const pending = takePendingGraphUpdate()
      setGraph((prev) => {
        let next = pending ? pending(prev) : prev
        if (wasRightClickDrag) {
          if (movingPersonId) {
            const draggedIds = selectedOrigins ? Object.keys(selectedOrigins) : [movingPersonId]
            let nextPeople = next.people
            for (const pid of draggedIds) {
              const person = nextPeople.find((p) => p.id === pid)
              if (person) {
                const innermost = next.circles
                  .filter((c) => Math.hypot(person.x - c.x, person.y - c.y) <= c.radius)
                  .sort((a, b) => a.radius - b.radius)[0]
                const nextCircleId = innermost ? innermost.id : ''
                nextPeople = nextPeople.map((p) => p.id === pid ? { ...p, circleId: nextCircleId } : p)
              }
            }
            next = { ...next, people: nextPeople }
          } else if (movingCircleId) {
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
        }
        return ensureContainment(next)
      })
      isRightClickDragRef.current = false
      settleGesture()
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

    const distance = Math.hypot(conn.endX - conn.startX, conn.endY - conn.startY)
    if (distance > CONNECT_THRESHOLD) {
      const targetPerson = graph.people.find((p) => Math.hypot(p.x - conn.endX, p.y - conn.endY) < 30)
      const targetCircle = graph.circles.find((c) => Math.hypot(c.x - conn.endX, c.y - conn.endY) < 30)

      if (targetPerson && targetPerson.id !== conn.sourceId) {
        pushHistory()
        setGraph((current) => ({
          ...current,
          connections: [
            ...(current.connections || []),
            {
              id: `conn-${Date.now()}`,
              fromId: conn.sourceId,
              toId: targetPerson.id,
            },
          ],
        }))
      } else if (targetCircle && targetCircle.id !== conn.sourceId) {
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
              return {
                ...current,
                connections: [
                  ...(current.connections || []),
                  {
                    id: `conn-${Date.now()}`,
                    fromId: conn.sourceId,
                    toId: targetCircle.id,
                  },
                ],
              }
            }
          })
        } else {
          setGraph((current) => ({
            ...current,
            connections: [
              ...(current.connections || []),
              {
                id: `conn-${Date.now()}`,
                fromId: conn.sourceId,
                toId: targetCircle.id,
              },
            ],
          }))
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
    if (demoMode) return
    const hit = hitTestBoard(boardIndex, cameraRef.current, selectedItem, {
      x: event.clientX,
      y: event.clientY,
    })
    if (hit?.type !== 'circle-body' && hit?.type !== 'circle-edge' && hit?.type !== 'circle-center') return

    selectItem({ type: 'circle', id: hit.circle.id })
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
    }
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

    movePersonRef.current = {
      pointerId: event.pointerId,
      personId: person.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: person.x,
      originY: person.y,
      selectedOrigins,
      circleOrigins,
    }
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
    }
  }

  // Double-tap creates a person exactly where you tapped. It only adopts a
  // circle when the tap lands inside one (or on someone already in a circle);
  // tapping empty space leaves the person free-floating instead of dragging it
  // into the "you" blob. We deliberately skip ensureContainment so the rest of
  // the board never reflows or visibly jumps around the new person.
  function handleSurfaceDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    if (demoMode) return
    const hit = hitTestBoard(boardIndex, cameraRef.current, selectedItem, {
      x: event.clientX,
      y: event.clientY,
    })

    // An empty-space tap yields no owning circle (''), so the person stays put.
    let circleId = ''
    if (hit && (hit.type === 'circle-body' || hit.type === 'circle-center' || hit.type === 'circle-edge')) {
      circleId = hit.circle.id
    } else if (hit && hit.type === 'person') {
      circleId = hit.person.circleId ?? ''
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
          role: circleId ? `Inside ${circlesById.get(circleId)?.name ?? ''}` : '',
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
    setSelectedItem({ type: 'person', id })
    // Grow the new person in so it feels placed, not blinked into existence.
    startBoardAnim('pop:' + id, 360)
    notifyOnboarding('create')
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
        tone: 'violet' as const,
        shapeType: 'circle' as const,
        sides: 25,
        amplitude: 0,
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
            role: circleId ? `Inside ${circlesById.get(circleId)?.name ?? ''}` : '',
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
        return {
          ...nextGraph,
          connections: [
            ...(nextGraph.connections || []),
            {
              id: `conn-${Date.now()}`,
              fromId: createMenu.dragSourceId,
              toId: id,
            },
          ],
        }
      }
      return nextGraph
    })
    selectItem({ type: 'person', id })
    // Grow the new person in so it feels placed, not blinked into existence.
    startBoardAnim('pop:' + id, 360)
    setCreateMenu(null)
    notifyOnboarding('create')
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
      const nextGraph = ensureContainment({
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
            tone: isNested ? 'violet' : nextTone(current.circles.length),
            shapeType: 'circle',
            sides: 25,
            amplitude: 0,
          },
        ],
      })
      if (createMenu.dragSourceType === 'person' && createMenu.dragSourceId) {
        return {
          ...nextGraph,
          connections: [
            ...(nextGraph.connections || []),
            {
              id: `conn-${Date.now()}`,
              fromId: createMenu.dragSourceId,
              toId: id,
            },
          ],
        }
      }
      return nextGraph
    })
    selectItem({ type: 'circle', id })
    setCreateMenu(null)
    notifyOnboarding('create')
  }

  /* Commented out to hide from menu, keeping in code for future use
  function addDemoCluster() {
    const source = selectedCircle ?? circlesById.get('you')
    if (!source) return

    const nextIndex = graph.people.length + 1
    const points = [-58, 0, 58].map((offset, index) => {
      const sides = Math.floor(Math.random() * 5) + 8
      return {
        id: `person-${Date.now()}-${index}`,
        name: ['Alex', 'Daria', 'Sam'][index],
        role: `Added to ${source.name}`,
        x: source.x + offset,
        y: source.y + source.radius * 0.42 + index * 18,
        circleId: source.id,
        avatar: makeAvatar(nextIndex + index),
        shapeType: 'wavy' as ShapeType,
        sides,
        amplitude: 1,
      }
    })
    setGraph((current) => ensureContainment({ ...current, people: [...current.people, ...points] }))
  }
  */



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

  function applyCircleShapeMode(nextMode: CircleShapeMode) {
    setCircleShapeMode(nextMode)
    if (nextMode !== 'figures') return

    setGraph((current) => ({
      ...current,
      circles: current.circles.map((circle) => ({
        ...circle,
        shapeType: 'wavy',
        sides: circle.sides ?? Math.max(8, Math.round(circle.radius / 10)),
        amplitude: Math.max(4, circle.amplitude && circle.amplitude > 0 ? circle.amplitude : Math.round(circle.radius * 0.055)),
      })),
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

  // Keep references to unused features so they remain in codebase for future use and satisfy TS/ESLint checks
  if (false as boolean) {
    console.log(setDemoMode, setShowCircleLabels, setShowPersonLabels, setCircleFillMode, setCenterBehavior, applyCircleShapeMode, CheckIcon, SubsetIcon)
  }

  if (viewMode === 'landing') {
    return (
      <div className="app-shell">
        <LandingPage onLaunchApp={handleLaunchApp} />
      </div>
    )
  }

  return (
    <main className={`app-shell ${demoMode ? 'is-demo-mode' : ''} ${searchOpen ? 'is-search-open' : ''} ${showSettings ? 'is-settings-open' : ''}`}>
      <div className="toolbar" aria-label="Graph controls" style={{ justifyContent: 'flex-end' }}>
        <div
          ref={searchPanelRef}
          className={`search-box ${searchOpen ? 'is-open' : ''}`}
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
                placeholder="Search people or circles…"
                aria-label="Search people or circles"
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    closeSearch()
                  } else if (event.key === 'Enter' && searchResults.length > 0) {
                    event.preventDefault()
                    handleSelectSearchResult(searchResults[0])
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
          {searchOpen && searchQuery.trim() !== '' && (
            <div className="search-results" role="listbox">
              {searchResults.length === 0 ? (
                <div className="search-results__empty">No matches</div>
              ) : (
                searchResults.map((result) => (
                  <button
                    key={`${result.kind}:${result.id}`}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="search-results__item"
                    disabled={result.kind === 'linkedin-profile' && isImportingLinkedInProfile}
                    // eslint-disable-next-line react-hooks/refs
                    onClick={() => handleSelectSearchResult(result)}
                  >
                    <span className={`search-results__icon search-results__icon--${result.kind}`}>
                      {result.kind === 'person'
                        ? <PersonIcon />
                        : result.kind === 'linkedin-profile'
                          ? isImportingLinkedInProfile ? <span className="search-results__spinner" aria-hidden="true" /> : <LinkedInIcon />
                          : <CircleIcon />}
                    </span>
                    <span className="search-results__text">
                      <span className="search-results__name">{result.name || 'Untitled'}</span>
                      {result.sub ? <span className="search-results__sub">{result.sub}</span> : null}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <div className={`toolbar__group ${demoMode ? 'toolbar__group--demo' : ''}`}>
          <button
            ref={settingsButtonRef}
            type="button"
            onClick={() => {
              if (!showSettings) closeSearch()
              setShowSettings(!showSettings)
            }}
            aria-label="Settings"
            style={{
              background: showSettings ? 'var(--md-secondary-container)' : 'transparent',
              color: showSettings ? 'var(--md-on-secondary-container)' : 'var(--md-on-surface-variant)',
            }}
          >
            <SettingsIcon />
          </button>
        </div>
      </div>

      {showSettings && (
        <div
          ref={settingsPanelRef}
          className="settings-panel"
        >
          <strong style={{ fontSize: '16px', fontWeight: 500, color: 'var(--md-on-surface)' }}>
            Settings
          </strong>
          <div style={{ marginTop: '12px', display: 'grid', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(28, 37, 40, 0.64)' }}>
                  LinkedIn Data Import
                </label>
                <button
                  type="button"
                  className="linkedin-guide-help"
                  aria-label="How to sync your LinkedIn"
                  title="How to sync your LinkedIn"
                  onClick={() => {
                    setShowSettings(false)
                    setShowLinkedInGuide(true)
                  }}
                >
                  ?
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
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(28, 37, 40, 0.64)', display: 'block', marginBottom: '8px' }}>
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
                    if (userId) {
                      try {
                        await saveGraph(userId, graph)
                      } catch (error) {
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
            {auth.status === 'anonymous' && (
              <div style={{ borderTop: '1px solid var(--md-outline-variant)', paddingTop: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(28, 37, 40, 0.64)', display: 'block', marginBottom: '8px' }}>
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

          </div>
        </div>
      )}

      {showLinkedInGuide && (
        <div ref={linkedInGuidePanelRef} className="linkedin-guide-panel">
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
      )}

      <div
        ref={surfaceRef}
        className="graph-surface"
        tabIndex={0}
        style={{
          backgroundSize: `${160 * camera.scale}px ${160 * camera.scale}px, ${32 * camera.scale}px ${32 * camera.scale}px`,
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
          if (hoveredCircleEdgeId) setHoveredCircleEdgeId(null)
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

      {!demoMode && selectedItem && (
      <aside key={`${selectedItem.type}:${selectedItem.id}`} className="inspector" aria-label="Selection details" style={{ overflow: 'visible', maxHeight: 'calc(100vh - 120px)' }}>

            {selectedItem.type !== 'connection' ? (
              <input
                className="inspector__name-input"
                value={selectedCircle?.name ?? selectedPerson?.name ?? ''}
                onChange={(event) => renameSelected(event.target.value)}
                aria-label="Selected item name"
              />
            ) : (
              <div style={{ fontSize: '15px', fontWeight: 500, padding: '4px 0 12px 0', borderBottom: '1px solid rgba(28, 37, 40, 0.08)', marginBottom: '8px' }}>
                Relationship Link
              </div>
            )}
            
            {selectedCircle && (
              <>
                {(() => {
                  const selectedCircleColors = getCircleColors(selectedCircle)
                  const selectedCircleHsv = hexToHsv(selectedCircleColors.centerBg)
                  const selectedCircleSides = selectedCircle.sides ?? 25
                  const selectedCircleAmplitude = selectedCircle.amplitude ?? 0
                  return (
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
                          onPointerDown={() => handleSwatchPointerDown(id, () => updateCircleStyle(selectedCircle.id, { tone, customColor: undefined }))}
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
                      style={
                        selectedCircle.customColor
                          ? {
                              backgroundColor: selectedCircleColors.centerBg,
                              color: getReadableColor(selectedCircleColors.centerBg),
                            }
                          : undefined
                      }
                      onClick={() => setShowCircleStylePanel(!showCircleStylePanel)}
                      title="Customize circle"
                      aria-label="Customize circle"
                    >
                      <PaletteIcon />
                    </button>
                  </div>
                  <button
                    type="button"
                    className={`circle-fill-toggle ${(selectedCircle.fillMode ?? circleFillMode) === 'transparent' ? 'is-transparent' : 'is-solid'}`}
                    onClick={() => updateCircleStyle(selectedCircle.id, { fillMode: (selectedCircle.fillMode ?? circleFillMode) === 'transparent' ? 'solid' : 'transparent' })}
                    title={(selectedCircle.fillMode ?? circleFillMode) === 'transparent' ? 'Switch to solid fill' : 'Switch to transparent fill'}
                    aria-label={(selectedCircle.fillMode ?? circleFillMode) === 'transparent' ? 'Switch to solid fill' : 'Switch to transparent fill'}
                  >
                    <TransparencyIcon />
                  </button>
                    {showCircleStylePanel && (
                      <div className="circle-style-popover">
                        <div className="circle-style-theme-tabs">
                          <SelectionIndicator
                            variant="pill"
                            activeKey={selectedCircle.fillMode ?? circleFillMode}
                          />
                          <button
                            type="button"
                            data-ind-key="transparent"
                            className={(selectedCircle.fillMode ?? circleFillMode) === 'transparent' ? 'is-selected' : ''}
                            onClick={() => updateCircleStyle(selectedCircle.id, { fillMode: 'transparent' })}
                          >
                            Transparent
                          </button>
                          <button
                            type="button"
                            data-ind-key="solid"
                            className={(selectedCircle.fillMode ?? circleFillMode) === 'solid' ? 'is-selected' : ''}
                            onClick={() => updateCircleStyle(selectedCircle.id, { fillMode: 'solid' })}
                          >
                            Solid
                          </button>
                        </div>
                        <button
                          type="button"
                          className="color-wheel"
                          style={{
                            '--wheel-color': selectedCircleColors.centerBg,
                            '--wheel-x': `${50 + Math.cos((selectedCircleHsv.h - 180) * Math.PI / 180) * selectedCircleHsv.s * 50}%`,
                            '--wheel-y': `${50 + Math.sin((selectedCircleHsv.h - 180) * Math.PI / 180) * selectedCircleHsv.s * 50}%`,
                          } as CSSProperties}
                          onPointerDown={(event) => handleColorWheelPointer(event, selectedCircle)}
                          onPointerMove={(event) => {
                            if (event.buttons === 1) handleColorWheelPointer(event, selectedCircle)
                          }}
                          aria-label="Pick circle color"
                        >
                          <span className="color-wheel__thumb" />
                        </button>
                        <button
                          type="button"
                          className="brightness-slider"
                          style={{
                            '--brightness-color': hsvToHex({ ...selectedCircleHsv, v: 1 }),
                            '--brightness-pos': `${selectedCircleHsv.v * 100}%`,
                          } as CSSProperties}
                          onPointerDown={(event) => handleBrightnessPointer(event, selectedCircle)}
                          onPointerMove={(event) => {
                            if (event.buttons === 1) handleBrightnessPointer(event, selectedCircle)
                          }}
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
                                onPointerDown={() => handleSwatchPointerDown(id, () => updateCircleStyle(selectedCircle.id, { customColor: color }))}
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
                            label={selectedCircleSides >= 25 ? 'Corners — circle' : `Corners ${selectedCircleSides}`}
                            min={5}
                            max={25}
                            value={selectedCircleSides}
                            onChange={(value) => updateCircleCorners(selectedCircle, value)}
                          />
                        </div>
                      </div>
                    )}

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
                          const updates: Partial<CircleNode> = { shapeType: 'wavy' }
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
                          const updates: Partial<CircleNode> = { shapeType: 'polygon' }
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
                          updateCircleStyle(selectedCircle.id, { shapeType: 'circle' })
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
                  {/* Commented out Add 3 demo people to hide from menu, keeping in code for future use
                  <button type="button" className="primary-action" onClick={addDemoCluster}>
                    Add 3 demo people
                  </button>
                  */}

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
                {/* Favorite Star Button at top-right of inspector */}
                <button
                  type="button"
                  className="star-favorite-btn"
                  onClick={() => togglePersonFavorite(selectedPerson.id)}
                  style={{
                    position: 'absolute',
                    top: 18,
                    right: 18,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                    padding: 4,
                    zIndex: 20,
                    outline: 'none',
                  }}
                  title={selectedPerson.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <svg viewBox="0 0 24 24" style={{ width: 20, height: 20 }}>
                    <path
                      d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                      fill={selectedPerson.isFavorite ? 'var(--md-favorite-fill)' : 'none'}
                      stroke={selectedPerson.isFavorite ? 'var(--md-favorite-stroke)' : 'var(--md-outline-variant)'}
                      strokeWidth={2}
                    />
                  </svg>
                </button>

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
                                         return ensureContainment({
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
                    </div>
                  );
                })()}

                {/* Commented out Role to hide from menu, keeping in code for future use
                <div className="inspector-field" style={{ marginTop: '4px' }}>
                  <label>Role</label>
                  <input
                    type="text"
                    value={selectedPerson.role}
                    onChange={(e) => {
                      const newRole = e.target.value
                      setGraph((current) => ({
                        ...current,
                        people: current.people.map((p) =>
                          p.id === selectedPerson.id ? { ...p, role: newRole } : p
                        ),
                      }))
                    }}
                    placeholder="E.g., Software Developer"
                    className="m3-input-field"
                  />
                </div>
                */}

                {/* Notes Section (Trello-Style) */}
                <div className="trello-list">
                  <div className="trello-list__header">
                    <h4 className="trello-list__title">Notes</h4>
                  </div>
 
                  {/* Scrollable list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedPerson.notes?.map((note) => (
                      <div key={note.id}>
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
                            e.target.style.height = 'auto'
                            e.target.style.height = `${e.target.scrollHeight}px`
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
                      <span>Add a card</span>
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
            <span className="brand__mark">DN</span>
            <p style={{ margin: 0, color: 'var(--md-on-surface-variant)' }}>Loading your board…</p>
          </div>
        </div>
      )}

      {showSignInModal && auth.status === 'anonymous' && (
        <div
          style={{ ...authOverlayStyle, background: 'rgba(0, 0, 0, 0.4)' }}
          onClick={() => setShowSignInModal(false)}
        >
          <div
            style={{ ...authCardStyle, alignItems: 'stretch', gap: '0', width: '320px', position: 'relative' }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setShowSignInModal(false)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'none',
                border: 'none',
                fontSize: '20px',
                lineHeight: 1,
                cursor: 'pointer',
                color: 'var(--md-on-surface-variant)',
              }}
            >
              ×
            </button>
            <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600, color: 'var(--md-on-surface)' }}>
              {emailAuthMode === 'signup' ? 'Create account' : 'Sign in'}
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--md-on-surface-variant)' }}>
              Save your board across devices.
            </p>
            <button
              type="button"
              className="m3-primary-button"
              onClick={() => void auth.signInWithGoogle()}
            >
              <GoogleIcon />
              Continue with Google
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0' }}>
              <span style={{ flex: 1, height: '1px', background: 'var(--md-outline-variant)' }} />
              <span style={{ fontSize: '12px', color: 'var(--md-on-surface-variant)' }}>or</span>
              <span style={{ flex: 1, height: '1px', background: 'var(--md-outline-variant)' }} />
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void handleEmailAuthSubmit()
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <input
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--md-outline, rgba(28, 37, 40, 0.24))',
                  fontSize: '14px',
                  background: 'var(--md-surface, #fff)',
                  color: 'var(--md-on-surface, #1c2528)',
                }}
              />
              <input
                type="password"
                autoComplete={emailAuthMode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="Password"
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--md-outline, rgba(28, 37, 40, 0.24))',
                  fontSize: '14px',
                  background: 'var(--md-surface, #fff)',
                  color: 'var(--md-on-surface, #1c2528)',
                }}
              />
              <button
                type="submit"
                className="m3-primary-button"
                disabled={emailAuthBusy || !emailInput.trim() || !passwordInput}
              >
                {emailAuthBusy
                  ? 'Please wait…'
                  : emailAuthMode === 'signup'
                    ? 'Create account'
                    : 'Sign in with email'}
              </button>
            </form>
            <button
              type="button"
              onClick={() => {
                setEmailAuthMode((mode) => (mode === 'signup' ? 'signin' : 'signup'))
                setEmailAuthNotice(null)
              }}
              style={{
                marginTop: '12px',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--md-primary, #00696e)',
                alignSelf: 'center',
              }}
            >
              {emailAuthMode === 'signup'
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
            {emailAuthNotice && (
              <p style={{ margin: '12px 0 0', color: 'var(--md-on-surface-variant)', fontSize: '13px', textAlign: 'center' }}>{emailAuthNotice}</p>
            )}
            {auth.error && (
              <p style={{ margin: '12px 0 0', color: 'var(--md-error, #b3261e)', fontSize: '13px', textAlign: 'center' }}>{auth.error}</p>
            )}
          </div>
        </div>
      )}

      {auth.status === 'anonymous' && (
        <div className="local-save-hint" role="note">
          <span>Sign in to save your data — your board is kept locally for now.</span>
          <button
            type="button"
            className="local-save-hint__action"
            onClick={() => openSignInModal()}
          >
            Sign in
          </button>
        </div>
      )}
 
      {graphLoaded && !demoMode && onboardingStep >= 0 && (
        <OnboardingCoach
          step={onboardingStep}
          celebrating={onboardingCelebrating}
          onNext={onboardingNext}
          onBack={onboardingBack}
          onSkip={finishOnboarding}
          onOpenSearch={() => {
            setShowSettings(false)
            setSearchOpen(true)
            window.requestAnimationFrame(() => searchInputRef.current?.focus())
          }}
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

  const nextCircles = [...current.circles]
  const nextPeople = [...current.people]
  const existingPersonIds = new Set(nextPeople.map((person) => person.id))
  const youCircle = nextCircles.find((circle) => circle.id === 'you')
  const youX = youCircle ? youCircle.x : 0
  const youY = youCircle ? youCircle.y : 0
  const totalCompanies = Math.max(1, companyGroups.size)
  let companyIndex = 0
  let importedPeople = 0
  let importedCompanies = 0

  for (const [companyName, members] of companyGroups) {
    const cleanCompName = companyName ? companyName : 'No Company'
    const companyId = `linkedin-company-${slugifyId(cleanCompName)}`

    let companyCircle = nextCircles.find((circle) => circle.id === companyId)
    if (!companyCircle) {
      const angle = (companyIndex / totalCompanies) * 2 * Math.PI
      const placementRadius = 680
      const icon = makeInitials(cleanCompName)

      companyCircle = {
        id: companyId,
        name: cleanCompName,
        icon,
        x: youX + Math.cos(angle) * placementRadius,
        y: youY + Math.sin(angle) * placementRadius,
        radius: 90,
        minRadius: 90,
        parentId: null,
        connectedTo: 'you',
        tone: nextTone(nextCircles.length),
        shapeType: 'wavy',
        sides: 12,
        amplitude: 8,
      }
      nextCircles.push(companyCircle)
      importedCompanies += 1
    }
    companyIndex += 1

    let personIndex = 0
    for (const memberRow of members) {
      const firstName = memberRow[importHeaders.firstNameIdx] || ''
      const lastName = memberRow[importHeaders.lastNameIdx] || ''
      const name = `${firstName} ${lastName}`.trim()
      if (!name) continue

      const personId = `linkedin-person-${slugifyId(name)}`
      if (existingPersonIds.has(personId)) {
        personIndex += 1
        continue
      }

      const position = importHeaders.positionIdx !== -1 ? memberRow[importHeaders.positionIdx] || '' : ''
      const url = importHeaders.urlIdx !== -1 ? memberRow[importHeaders.urlIdx] || '' : ''
      const email = importHeaders.emailIdx !== -1 ? memberRow[importHeaders.emailIdx] || '' : ''
      const connectedOn = importHeaders.connectedOnIdx !== -1 ? memberRow[importHeaders.connectedOnIdx] || '' : ''
      const pAngle = (personIndex / members.length) * 2 * Math.PI
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
        role: position || 'Connection',
        x: companyCircle.x + Math.cos(pAngle) * 35,
        y: companyCircle.y + Math.sin(pAngle) * 35,
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
      personIndex += 1

      if (importedPeople > 0 && importedPeople % 250 === 0) {
        await yieldToBrowser()
      }
    }
  }

  await yieldToBrowser()

  return {
    graph: ensureContainment({
      ...current,
      circles: nextCircles,
      people: nextPeople,
    }),
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
      x: youX + Math.cos(angle) * placementRadius,
      y: youY + Math.sin(angle) * placementRadius,
      radius: 90,
      minRadius: 90,
      parentId: null,
      connectedTo: 'you',
      tone: nextTone(nextCircles.length),
      shapeType: 'wavy',
      sides: 12,
      amplitude: 8,
    }
    nextCircles.push(companyCircle)
  }

  return { nextCircles, companyCircle }
}

function buildLinkedInProfileNotes(profile: LinkedInProfileImport, existingNotes: PersonNote[] = []) {
  const notes = existingNotes.filter((note) => note.title !== 'Profile' && note.title !== 'Enrichment')
  if (profile.description) {
    notes.push({
      id: `note-profile-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      title: 'Profile',
      body: profile.description,
    })
  }
  if (profile.source === 'brightdata') {
    notes.push({
      id: `note-enriched-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      title: 'Enrichment',
      body: 'Imported with Bright Data LinkedIn enrichment.',
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
  const updatedPerson: PersonNode = {
    ...existingPerson,
    name: profile.name || existingPerson.name,
    role: profile.headline || existingPerson.role,
    circleId: companyCircle.id,
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
    graph: ensureContainment({
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
  const pAngle = (companyMembers.length / Math.max(6, companyMembers.length + 1)) * 2 * Math.PI
  const existingIds = new Set(nextPeople.map((person) => person.id))
  const personId = makeUniqueId(`linkedin-person-${slugifyId(profile.slug || profile.name)}`, existingIds)
  const notes = buildLinkedInProfileNotes(profile)

  const person: PersonNode = {
    id: personId,
    name: profile.name,
    role: profile.headline || 'LinkedIn connection',
    x: companyCircle.x + Math.cos(pAngle) * 35,
    y: companyCircle.y + Math.sin(pAngle) * 35,
    circleId: companyCircle.id,
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
    graph: ensureContainment({
      ...current,
      circles: nextCircles,
      people: nextPeople,
    }),
    person,
  }
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

function nextTone(index: number): CircleTone {
  return (['blue', 'red', 'green', 'amber', 'violet'] as CircleTone[])[index % 5]
}



function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}

function SubsetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
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

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{
        width: '14px',
        height: '14px',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 3,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        marginRight: '6px',
      }}
    >
      <path d="M20 6L9 17l-5-5" />
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

function TransparencyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M8 6.9v10.2" />
      <path d="M12 4v16" />
      <path d="M16 6.9v10.2" />
      <path d="M5.4 10h13.2" />
      <path d="M5.4 14h13.2" />
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

