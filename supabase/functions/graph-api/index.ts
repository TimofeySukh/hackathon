import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createClient } from 'npm:@supabase/supabase-js@2'

import { isAiSearchConfigured } from './interpretSearch.ts'
import { runAgentSearch } from './agentSearch.ts'
import { searchGraphByQuery, toApiSearchResults } from './graphSearch.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
}

type Scope =
  | 'graph:read'
  | 'search:read'
  | 'people:write'
  | 'notes:write'
  | 'links:write'
  | 'connections:write'
  | 'circles:write'
  | 'graph:replace'

type CircleNode = {
  id: string
  name: string
  icon: string
  x: number
  y: number
  radius: number
  minRadius: number
  parentId: string | null
  connectedTo: string | null
  tone: 'blue' | 'red' | 'green' | 'amber' | 'violet'
  shapeType?: 'circle' | 'wavy' | 'polygon'
  shapeCustom?: boolean
  sides?: number
  amplitude?: number
  imageUrl?: string
  customColor?: string
  fillMode?: 'transparent' | 'solid'
}

type PersonNote = { id: string; title: string; body: string }

type PersonLink = {
  id: string
  service: 'linkedin' | 'telegram' | 'instagram' | 'facebook' | 'whatsapp' | 'x' | 'website'
  label: string
  url: string
}

type PersonNode = {
  id: string
  name: string
  x: number
  y: number
  circleId: string
  avatar: string
  shapeType?: 'circle' | 'wavy' | 'polygon'
  sides?: number
  amplitude?: number
  imageUrl?: string
  isFavorite?: boolean
  notes?: PersonNote[]
  links?: PersonLink[]
}

type Connection = { id: string; fromId: string; toId: string }
type GraphState = { circles: CircleNode[]; people: PersonNode[]; connections: Connection[] }
type GraphRecord = { graph: GraphState | null; revision: number | null }
type AuthContext = { userId: string; scopes: Set<string>; authType: 'session' | 'agent'; tokenId?: string }

const DEFAULT_AGENT_SCOPES: Scope[] = ['graph:read', 'search:read', 'people:write', 'notes:write', 'links:write', 'connections:write', 'circles:write']
const PERSON_RADIUS = 30

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function formatError(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  if (!error || typeof error !== 'object') return String(error)
  const record = error as Record<string, unknown>
  const parts = [
    typeof record.message === 'string' ? record.message : null,
    typeof record.details === 'string' ? record.details : null,
    typeof record.hint === 'string' ? record.hint : null,
    typeof record.code === 'string' ? `code ${record.code}` : null,
  ].filter(Boolean)
  if (parts.length > 0) return parts.join(' ')
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function getServiceClient() {
  return createClient(getRequiredEnv('SUPABASE_URL'), getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function getAnonClient(authHeader: string) {
  return createClient(getRequiredEnv('SUPABASE_URL'), getRequiredEnv('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  })
}

function normalizePath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  const index = parts.indexOf('graph-api')
  const relevant = index >= 0 ? parts.slice(index + 1) : parts
  return `/${relevant.join('/')}`.replace(/\/$/, '') || '/'
}

function assertString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Response(`${field} is required.`, { status: 400 })
  return value.trim()
}

function isGraphState(value: unknown): value is GraphState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return Array.isArray(record.circles) && Array.isArray(record.people) && Array.isArray(record.connections)
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
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

const LINKEDIN_COMPANY_TONES: CircleNode['tone'][] = ['red', 'green', 'amber', 'violet', 'blue']

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

function toneForLinkedInCompany(companyId: string): CircleNode['tone'] {
  if (companyId === 'linkedin-company-socialdatanode') return 'blue'
  return LINKEDIN_COMPANY_TONES[hashString(companyId) % LINKEDIN_COMPANY_TONES.length]
}

function shouldRecolorLegacyLinkedInCompany(circle: CircleNode) {
  return circle.id.startsWith('linkedin-company-') &&
    circle.id !== 'linkedin-company-socialdatanode' &&
    circle.tone === 'blue' &&
    !circle.customColor
}

function extractLinkedInProfileUrlCandidate(rawValue: string) {
  const value = rawValue.trim()
  if (!value) return ''
  const match = value.match(/(?:(?:https?|ps):\/\/)?(?:[\w-]+\.)?linkedin\.com\/(?:in|pub)\/[^\s"'<>]+/i)
  return (match?.[0] ?? value).replace(/[),.;]+$/, '')
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

function ensureLinkedInCompanyCircle(graph: GraphState, companyName: string, companyLogoUrl?: string) {
  const companyId = `linkedin-company-${slugifyId(companyName)}`
  let companyCircle = graph.circles.find((circle) => circle.id === companyId)

  if (!companyCircle) {
    const youCircle = graph.circles.find((circle) => circle.id === 'you')
    const youX = youCircle ? youCircle.x : 0
    const youY = youCircle ? youCircle.y : 0
    const linkedInCompanyCount = graph.circles.filter((circle) => circle.id.startsWith('linkedin-company-')).length
    const angle = (linkedInCompanyCount / Math.max(6, linkedInCompanyCount + 1)) * 2 * Math.PI
    const placementRadius = 680
    companyCircle = {
      id: companyId,
      name: companyName,
      icon: makeInitials(companyName),
      imageUrl: companyLogoUrl,
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
    graph.circles.push(companyCircle)
  } else if (companyLogoUrl && !companyCircle.imageUrl) {
    companyCircle.imageUrl = companyLogoUrl
  }
  if (shouldRecolorLegacyLinkedInCompany(companyCircle)) {
    companyCircle.tone = toneForLinkedInCompany(companyCircle.id)
  }

  return companyCircle
}

function makeInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
  return initials || '?'
}

function titleForLink(service: PersonLink['service']) {
  const titles: Record<PersonLink['service'], string> = {
    linkedin: 'LinkedIn',
    telegram: 'Telegram',
    instagram: 'Instagram',
    facebook: 'Facebook',
    whatsapp: 'WhatsApp',
    x: 'X',
    website: 'Website',
  }
  return titles[service]
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function randomToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const body = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return `dn_live_${body}`
}

async function requireAuth(req: Request, requiredScopes: Scope[] = []): Promise<AuthContext> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) throw new Response('Missing authorization header.', { status: 401 })
  const credential = authHeader.slice('Bearer '.length).trim()

  if (credential.startsWith('dn_live_')) {
    const service = getServiceClient()
    const tokenHash = await sha256(credential)
    const { data, error } = await service
      .from('agent_tokens')
      .select('id, user_id, scopes, expires_at, revoked_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (error || !data || data.revoked_at || (data.expires_at && new Date(data.expires_at).getTime() <= Date.now())) {
      throw new Response('Invalid agent token.', { status: 401 })
    }

    const scopes = new Set<string>(Array.isArray(data.scopes) ? data.scopes : [])
    for (const scope of requiredScopes) {
      if (!scopes.has(scope)) throw new Response(`Missing scope: ${scope}`, { status: 403 })
    }

    await service.from('agent_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)
    return { userId: data.user_id, scopes, authType: 'agent', tokenId: data.id }
  }

  const anon = getAnonClient(authHeader)
  const {
    data: { user },
    error,
  } = await anon.auth.getUser(credential)

  if (error || !user) throw new Response('Invalid user session.', { status: 401 })
  return {
    userId: user.id,
    scopes: new Set<Scope>(['graph:read', 'search:read', 'people:write', 'notes:write', 'links:write', 'connections:write', 'circles:write', 'graph:replace']),
    authType: 'session',
  }
}

async function readGraph(userId: string): Promise<GraphRecord> {
  const service = getServiceClient()
  const { data, error } = await service
    .from('user_graphs')
    .select('graph, revision')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return { graph: null, revision: null }
  if (!isGraphState(data.graph)) return { graph: null, revision: typeof data.revision === 'number' ? data.revision : 1 }
  return { graph: data.graph, revision: typeof data.revision === 'number' ? data.revision : 1 }
}

function sanitizeJsonbText(value: string) {
  let sanitized = ''
  let changed = false

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code === 0) {
      changed = true
      continue
    }

    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        sanitized += value[index] + value[index + 1]
        index += 1
      } else {
        sanitized += '\uFFFD'
        changed = true
      }
      continue
    }

    if (code >= 0xdc00 && code <= 0xdfff) {
      sanitized += '\uFFFD'
      changed = true
      continue
    }

    sanitized += value[index]
  }

  return changed ? sanitized : value
}

function finiteNumber(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback
}

function sanitizeGraphForJsonb(graph: GraphState): GraphState {
  return {
    circles: graph.circles.map((circle) => ({
      ...circle,
      id: sanitizeJsonbText(circle.id),
      name: sanitizeJsonbText(circle.name),
      icon: sanitizeJsonbText(circle.icon),
      x: finiteNumber(circle.x),
      y: finiteNumber(circle.y),
      radius: finiteNumber(circle.radius, 104),
      minRadius: finiteNumber(circle.minRadius, 104),
      parentId: circle.parentId === null ? null : sanitizeJsonbText(circle.parentId),
      connectedTo: circle.connectedTo === null ? null : sanitizeJsonbText(circle.connectedTo),
      imageUrl: typeof circle.imageUrl === 'string' ? sanitizeJsonbText(circle.imageUrl) : circle.imageUrl,
      customColor: typeof circle.customColor === 'string' ? sanitizeJsonbText(circle.customColor) : circle.customColor,
      sides: typeof circle.sides === 'number' ? finiteNumber(circle.sides, 25) : circle.sides,
      amplitude: typeof circle.amplitude === 'number' ? finiteNumber(circle.amplitude, 0) : circle.amplitude,
    })),
    people: graph.people.map((person) => ({
      ...person,
      id: sanitizeJsonbText(person.id),
      name: sanitizeJsonbText(person.name),
      x: finiteNumber(person.x),
      y: finiteNumber(person.y),
      circleId: sanitizeJsonbText(person.circleId),
      avatar: sanitizeJsonbText(person.avatar),
      imageUrl: typeof person.imageUrl === 'string' ? sanitizeJsonbText(person.imageUrl) : person.imageUrl,
      sides: typeof person.sides === 'number' ? finiteNumber(person.sides, 10) : person.sides,
      amplitude: typeof person.amplitude === 'number' ? finiteNumber(person.amplitude, 0) : person.amplitude,
      notes: person.notes?.map((note) => ({
        ...note,
        id: sanitizeJsonbText(note.id),
        title: sanitizeJsonbText(note.title),
        body: sanitizeJsonbText(note.body),
      })),
      links: person.links?.map((link) => ({
        ...link,
        id: sanitizeJsonbText(link.id),
        label: sanitizeJsonbText(link.label),
        url: sanitizeJsonbText(link.url),
      })),
    })),
    connections: graph.connections.map((connection) => ({
      ...connection,
      id: sanitizeJsonbText(connection.id),
      fromId: sanitizeJsonbText(connection.fromId),
      toId: sanitizeJsonbText(connection.toId),
    })),
  }
}

async function writeGraph(userId: string, graph: GraphState, expectedRevision: number | null) {
  const service = getServiceClient()
  const safeGraph = sanitizeGraphForJsonb(graph)

  if (expectedRevision === null) {
    const { data, error } = await service
      .from('user_graphs')
      .insert({ user_id: userId, graph: safeGraph })
      .select('revision')
      .single()
    if (error) {
      if (error.code === '23505') {
        const current = await readGraph(userId)
        return jsonResponse({ error: 'Revision conflict.', revision: current.revision }, 409)
      }
      throw error
    }
    return jsonResponse({ graph: safeGraph, revision: data.revision ?? 1 })
  }

  const { data, error } = await service
    .from('user_graphs')
    .update({ graph: safeGraph })
    .eq('user_id', userId)
    .eq('revision', expectedRevision)
    .select('revision')
    .maybeSingle()

  if (error) throw error
  if (!data) {
    const current = await readGraph(userId)
    return jsonResponse({ error: 'Revision conflict.', revision: current.revision }, 409)
  }
  return jsonResponse({ graph: safeGraph, revision: data.revision ?? expectedRevision + 1 })
}

function getCirclePath(graph: GraphState, circleId: string | null) {
  const circlesById = new Map(graph.circles.map((circle) => [circle.id, circle]))
  const path: CircleNode[] = []
  let current = circleId ? circlesById.get(circleId) : null
  const seen = new Set<string>()
  while (current && !seen.has(current.id)) {
    path.unshift(current)
    seen.add(current.id)
    current = current.parentId ? circlesById.get(current.parentId) ?? null : null
  }
  return path
}

function graphMeta(graph: GraphState | null, revision: number | null) {
  return {
    revision,
    counts: {
      people: graph?.people.length ?? 0,
      circles: graph?.circles.length ?? 0,
      connections: graph?.connections.length ?? 0,
    },
  }
}

function findFreePersonPosition(graph: GraphState, circleId: string) {
  const circle = graph.circles.find((candidate) => candidate.id === circleId)
  const peopleInCircle = graph.people.filter((person) => person.circleId === circleId)
  const centerX = circle?.x ?? 0
  const centerY = circle?.y ?? 0
  const index = peopleInCircle.length
  if (!circle) return { x: centerX, y: centerY }
  const angle = index * 2.399963229728653
  const ring = Math.min(Math.max(34, Math.sqrt(index + 1) * 24), Math.max(34, circle.radius - PERSON_RADIUS))
  return { x: Math.round(centerX + Math.cos(angle) * ring), y: Math.round(centerY + Math.sin(angle) * ring) }
}

function growCircleForPoint(circle: CircleNode, x: number, y: number): CircleNode {
  const needed = Math.ceil(Math.hypot(x - circle.x, y - circle.y) + PERSON_RADIUS + 18)
  if (needed <= circle.radius) return circle
  return { ...circle, radius: needed, minRadius: Math.max(circle.minRadius, needed) }
}

function refitParents(graph: GraphState, startingCircleId: string) {
  const circlesById = new Map(graph.circles.map((circle) => [circle.id, circle]))
  let currentId: string | null = startingCircleId
  while (currentId) {
    const circle = circlesById.get(currentId)
    if (!circle) break
    let nextCircle = circle
    for (const person of graph.people) {
      if (person.circleId === currentId) nextCircle = growCircleForPoint(nextCircle, person.x, person.y)
    }
    for (const child of graph.circles) {
      if (child.parentId === currentId) {
        const needed = Math.ceil(Math.hypot(child.x - nextCircle.x, child.y - nextCircle.y) + child.radius + 24)
        if (needed > nextCircle.radius) nextCircle = { ...nextCircle, radius: needed, minRadius: Math.max(nextCircle.minRadius, needed) }
      }
    }
    circlesById.set(currentId, nextCircle)
    currentId = nextCircle.parentId
  }
  graph.circles = graph.circles.map((circle) => circlesById.get(circle.id) ?? circle)
}

function createCircle(graph: GraphState, data: Record<string, unknown>) {
  const name = assertString(data.name, 'name')
  const id = typeof data.id === 'string' && data.id.trim() ? data.id.trim() : makeId('circle')
  if (graph.circles.some((circle) => circle.id === id)) {
    throw new Response('Circle ID already exists.', { status: 400 })
  }
  const parentId = typeof data.parentId === 'string' && data.parentId.trim() ? data.parentId.trim() : null
  if (parentId && !graph.circles.some((circle) => circle.id === parentId)) {
    throw new Response('Unknown parentId.', { status: 400 })
  }
  const connectedTo = typeof data.connectedTo === 'string' && data.connectedTo.trim() ? data.connectedTo.trim() : null
  if (connectedTo && !graph.circles.some((circle) => circle.id === connectedTo)) {
    throw new Response('Unknown connectedTo.', { status: 400 })
  }
  const tone = typeof data.tone === 'string' && ['blue', 'red', 'green', 'amber', 'violet'].includes(data.tone) ? data.tone : 'blue'
  const fillMode = typeof data.fillMode === 'string' && ['transparent', 'solid'].includes(data.fillMode) ? data.fillMode : 'transparent'
  const shapeType = typeof data.shapeType === 'string' && ['circle', 'wavy', 'polygon'].includes(data.shapeType) ? data.shapeType : 'circle'

  let x = typeof data.x === 'number' ? data.x : 0
  let y = typeof data.y === 'number' ? data.y : 0
  if (typeof data.x !== 'number' || typeof data.y !== 'number') {
    const relativeCircle = parentId ? graph.circles.find(c => c.id === parentId) : graph.circles.find(c => c.id === 'you')
    if (relativeCircle) {
      const angle = Math.random() * 2 * Math.PI
      const dist = parentId ? 150 : 400
      x = Math.round(relativeCircle.x + Math.cos(angle) * dist)
      y = Math.round(relativeCircle.y + Math.sin(angle) * dist)
    }
  }

  const circle: CircleNode = {
    id,
    name,
    icon: typeof data.icon === 'string' && data.icon.trim() ? data.icon.trim() : makeInitials(name),
    x,
    y,
    radius: typeof data.radius === 'number' ? data.radius : 90,
    minRadius: typeof data.minRadius === 'number' ? data.minRadius : 90,
    parentId,
    connectedTo,
    tone: tone as CircleNode['tone'],
    fillMode: fillMode as CircleNode['fillMode'],
    shapeType: shapeType as CircleNode['shapeType'],
    shapeCustom: typeof data.shapeCustom === 'boolean' ? data.shapeCustom : false,
    sides: typeof data.sides === 'number' ? data.sides : 25,
    amplitude: typeof data.amplitude === 'number' ? data.amplitude : 0,
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined,
    customColor: typeof data.customColor === 'string' ? data.customColor : undefined,
  }
  graph.circles.push(circle)
  if (parentId) {
    refitParents(graph, parentId)
  }
  return circle
}

function deleteCircle(graph: GraphState, circleId: string) {
  if (circleId === 'you') throw new Response('Cannot delete the "you" circle.', { status: 400 })
  const deletedCircle = graph.circles.find((c) => c.id === circleId)
  if (!deletedCircle) throw new Response('Circle not found.', { status: 404 })

  const newParentId = deletedCircle.parentId ?? 'you'

  graph.circles = graph.circles
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

  graph.people = graph.people.map((p) => {
    if (p.circleId === circleId) {
      return { ...p, circleId: newParentId }
    }
    return p
  })

  graph.connections = graph.connections.filter(
    (conn) => conn.fromId !== circleId && conn.toId !== circleId
  )

  refitParents(graph, newParentId)
  return { deleted: circleId }
}

async function getUploadedImageUrl(req: Request, body: Record<string, unknown>): Promise<string> {
  const contentType = req.headers.get('content-type') || ''
  if (contentType.startsWith('image/') || contentType === 'application/octet-stream') {
    const buffer = await req.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)
    const mime = contentType === 'application/octet-stream' ? 'image/png' : contentType
    return `data:${mime};base64,${base64}`
  }

  const urlVal = typeof body.imageUrl === 'string' ? body.imageUrl : typeof body.base64 === 'string' ? body.base64 : ''
  if (!urlVal) {
    throw new Response('Request body must contain imageUrl/base64, or be a raw image payload.', { status: 400 })
  }
  if (urlVal.startsWith('data:')) {
    return urlVal
  }
  if (/^[a-zA-Z0-9+/=]+$/.test(urlVal)) {
    return `data:image/png;base64,${urlVal}`
  }
  return urlVal
}

function createPerson(graph: GraphState, data: Record<string, unknown>) {
  const name = assertString(data.name, 'name')
  const circleId = assertString(data.circleId, 'circleId')
  if (!graph.circles.some((circle) => circle.id === circleId)) throw new Response('Unknown circleId.', { status: 400 })
  const position = findFreePersonPosition(graph, circleId)
  const links = Array.isArray(data.links) ? normalizeLinks(data.links) : []
  const notes = Array.isArray(data.notes) ? normalizeNotes(data.notes) : []
  const person: PersonNode = {
    id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : makeId('person'),
    name,
    x: typeof data.x === 'number' ? data.x : position.x,
    y: typeof data.y === 'number' ? data.y : position.y,
    circleId,
    avatar: makeInitials(name),
    shapeType: 'circle',
    sides: 10,
    amplitude: 0,
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : undefined,
    isFavorite: typeof data.isFavorite === 'boolean' ? data.isFavorite : undefined,
    notes,
    links,
  }
  graph.people.push(person)
  refitParents(graph, circleId)
  return person
}

function normalizeNotes(values: unknown[]): PersonNote[] {
  return values.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Response('Invalid note.', { status: 400 })
    const record = value as Record<string, unknown>
    const body = assertString(record.body, 'note.body')
    return {
      id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : makeId('note'),
      title: typeof record.title === 'string' && record.title.trim() ? record.title.trim() : body.split('\n')[0].slice(0, 30) || 'Untitled note',
      body,
    }
  })
}

function normalizeLinks(values: unknown[]): PersonLink[] {
  return values.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Response('Invalid link.', { status: 400 })
    const record = value as Record<string, unknown>
    const service = typeof record.service === 'string' ? record.service : 'website'
    if (!['linkedin', 'telegram', 'instagram', 'facebook', 'whatsapp', 'x', 'website'].includes(service)) {
      throw new Response('Invalid link.service.', { status: 400 })
    }
    const url = assertString(record.url, 'link.url')
    return {
      id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : makeId('link'),
      service: service as PersonLink['service'],
      label: typeof record.label === 'string' && record.label.trim() ? record.label.trim() : titleForLink(service as PersonLink['service']),
      url,
    }
  })
}

function clampSearchLimit(value: unknown, fallback = 10) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), 1), 50)
}

function parseBody(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
}

async function readJson(req: Request) {
  if (req.method === 'GET') return {}
  const contentType = req.headers.get('content-type') || ''
  if (contentType.startsWith('image/') || contentType === 'application/octet-stream') {
    return {}
  }
  const rawBody = await req.text()
  if (!rawBody.trim()) return {}
  try {
    return parseBody(JSON.parse(rawBody))
  } catch {
    throw new Response('Request body must be valid JSON.', { status: 400 })
  }
}

function getExpectedRevision(req: Request, body: Record<string, unknown>) {
  if (typeof body.expectedRevision === 'number') return body.expectedRevision

  try {
    const url = new URL(req.url)
    const param = url.searchParams.get('expectedRevision')
    if (param !== null && !isNaN(Number(param))) return Number(param)
  } catch {
    // Ignore URL parse error
  }

  const header = req.headers.get('x-expected-revision')
  if (header !== null && !isNaN(Number(header))) return Number(header)

  return null
}

async function mutateGraph(req: Request, auth: AuthContext, body: Record<string, unknown>, mutate: (graph: GraphState) => unknown) {
  const current = await readGraph(auth.userId)
  if (!current.graph) return jsonResponse({ error: 'No graph exists yet.' }, 404)
  const expectedRevision = getExpectedRevision(req, body)
  if (current.revision !== expectedRevision) return jsonResponse({ error: 'Revision conflict.', revision: current.revision }, 409)
  const result = mutate(current.graph)
  const response = await writeGraph(auth.userId, current.graph, expectedRevision)
  const payload = await response.json()
  return jsonResponse({ ...payload, result }, response.status)
}

async function handleTokenRoutes(req: Request, path: string, auth: AuthContext, body: Record<string, unknown>) {
  if (path !== '/v1/agent-tokens' && !path.startsWith('/v1/agent-tokens/')) return null
  if (auth.authType !== 'session') return jsonResponse({ error: 'User session required.' }, 403)
  const service = getServiceClient()

  if (req.method === 'GET' && path === '/v1/agent-tokens') {
    const { data, error } = await service
      .from('agent_tokens')
      .select('id, name, token_prefix, scopes, expires_at, revoked_at, last_used_at, created_at')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return jsonResponse({ tokens: data ?? [] })
  }

  if (req.method === 'POST' && path === '/v1/agent-tokens') {
    const name = assertString(body.name, 'name')
    const scopes = Array.isArray(body.scopes) && body.scopes.length ? body.scopes : DEFAULT_AGENT_SCOPES
    for (const scope of scopes) {
      if (!DEFAULT_AGENT_SCOPES.concat(['circles:write', 'graph:replace']).includes(scope as Scope)) {
        return jsonResponse({ error: `Invalid scope: ${scope}` }, 400)
      }
    }
    const token = randomToken()
    const tokenHash = await sha256(token)
    const tokenPrefix = `${token.slice(0, 15)}...${token.slice(-4)}`
    const { data, error } = await service
      .from('agent_tokens')
      .insert({
        user_id: auth.userId,
        name,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        scopes,
        expires_at: typeof body.expiresAt === 'string' && body.expiresAt ? body.expiresAt : null,
      })
      .select('id, name, token_prefix, scopes, expires_at, revoked_at, last_used_at, created_at')
      .single()
    if (error) throw error
    return jsonResponse({ token, record: data }, 201)
  }

  const revokeMatch = path.match(/^\/v1\/agent-tokens\/([^/]+)\/revoke$/)
  if (req.method === 'POST' && revokeMatch) {
    const { data, error } = await service
      .from('agent_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', revokeMatch[1])
      .eq('user_id', auth.userId)
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!data) return jsonResponse({ error: 'Token not found.' }, 404)
    return jsonResponse({ ok: true })
  }

  return null
}

async function handleGraphRoutes(req: Request, path: string, auth: AuthContext, body: Record<string, unknown>, url: URL) {
  if (req.method === 'GET' && path === '/v1/graph/meta') {
    const { graph, revision } = await readGraph(auth.userId)
    return jsonResponse(graphMeta(graph, revision))
  }

  if (req.method === 'GET' && path === '/v1/graph') {
    const { graph, revision } = await readGraph(auth.userId)
    return jsonResponse({ graph, revision })
  }

  if (req.method === 'PUT' && path === '/v1/graph') {
    if (!auth.scopes.has('graph:replace')) return jsonResponse({ error: 'Missing scope: graph:replace' }, 403)
    const graph = body.graph
    if (!isGraphState(graph)) return jsonResponse({ error: 'Invalid graph.' }, 400)
    const expectedRevision = getExpectedRevision(req, body)
    const current = await readGraph(auth.userId)
    if (current.revision !== expectedRevision) {
      return jsonResponse({ error: 'Revision conflict.', revision: current.revision }, 409)
    }
    return await writeGraph(auth.userId, graph, expectedRevision)
  }

  if (req.method === 'GET' && path === '/v1/search') {
    if (!auth.scopes.has('search:read')) return jsonResponse({ error: 'Missing scope: search:read' }, 403)
    const { graph } = await readGraph(auth.userId)
    if (!graph) return jsonResponse({ results: [] })
    const limit = clampSearchLimit(url.searchParams.get('limit'))
    return jsonResponse({ results: toApiSearchResults(searchGraphByQuery(graph, url.searchParams.get('q') ?? '', limit)) })
  }

  if (req.method === 'POST' && path === '/v1/search/smart') {
    if (!auth.scopes.has('search:read')) return jsonResponse({ error: 'Missing scope: search:read' }, 403)
    if (!isAiSearchConfigured()) return jsonResponse({ error: 'AI search is not configured on the server.' }, 503)
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    if (!query) return jsonResponse({ error: 'query is required.' }, 400)
    const limit = clampSearchLimit(body.limit)
    const { graph } = await readGraph(auth.userId)
    if (!graph) {
      return jsonResponse({
        query,
        mode: 'agent',
        explanation: 'No graph loaded yet.',
        steps: [],
        suggestions: [],
        results: [],
      })
    }
    return jsonResponse(await runAgentSearch(graph, query, limit))
  }

  if (req.method === 'GET' && path === '/v1/circles') {
    const { graph, revision } = await readGraph(auth.userId)
    const circles = graph?.circles.map((circle) => ({
      id: circle.id,
      name: circle.name,
      parentId: circle.parentId,
      connectedTo: circle.connectedTo,
      path: getCirclePath(graph, circle.id).map((item) => ({ id: item.id, name: item.name })),
      peopleCount: graph.people.filter((person) => person.circleId === circle.id).length,
    })) ?? []
    return jsonResponse({ circles, revision })
  }

  const circlePeopleMatch = path.match(/^\/v1\/circles\/([^/]+)\/people$/)
  if (req.method === 'GET' && circlePeopleMatch) {
    const { graph, revision } = await readGraph(auth.userId)
    const people = graph?.people.filter((person) => person.circleId === circlePeopleMatch[1]) ?? []
    return jsonResponse({ people, revision })
  }

  if (req.method === 'POST' && path === '/v1/people/import-linkedin') {
    if (!auth.scopes.has('people:write')) return jsonResponse({ error: 'Missing scope: people:write' }, 403)
    const linkedinUrlStr = typeof body.url === 'string' ? body.url : ''
    const normalizedUrl = normalizeLinkedInProfileUrl(linkedinUrlStr)
    if (!normalizedUrl) return jsonResponse({ error: 'A valid LinkedIn profile URL is required.' }, 400)

    const supabaseUrl = getRequiredEnv('SUPABASE_URL')
    const serviceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')

    let profileData
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/enrich-linkedin-profile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: normalizedUrl }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const message = payload?.error || `LinkedIn profile provider returned status ${response.status}.`
        return jsonResponse({ error: message }, 502)
      }
      profileData = await response.json()
    } catch (err) {
      return jsonResponse({ error: `Failed to invoke LinkedIn enrichment: ${err instanceof Error ? err.message : String(err)}` }, 500)
    }

    return await mutateGraph(req, auth, body, (graph) => {
      let person = graph.people.find((p) =>
        (p.links ?? []).some((link) => link.service === 'linkedin' && normalizeLinkedInProfileUrl(link.url) === normalizedUrl)
      )

      const companyName = (profileData.company || 'Unknown Company').trim()
      const companyCircle = ensureLinkedInCompanyCircle(graph, companyName, profileData.companyLogoUrl)
      const slug = getLinkedInSlug(normalizedUrl)
      const fallbackName = titleCaseSlug(slug)
      const name = (profileData.name || fallbackName || 'LinkedIn Connection').trim()
      const avatar = makeInitials(name)
      const headline = profileData.headline?.trim()
      const description = profileData.description?.trim()

      if (person) {
        person.name = name || person.name
        person.avatar = makeInitials(person.name)
        if (profileData.avatarUrl) person.imageUrl = profileData.avatarUrl

        person.links ??= []
        const hasLinkedinLink = person.links.some((l) => l.service === 'linkedin' && normalizeLinkedInProfileUrl(l.url) === normalizedUrl)
        if (!hasLinkedinLink) {
          person.links.push({
            id: makeId('link'),
            service: 'linkedin',
            label: 'LinkedIn',
            url: normalizedUrl,
          })
        }

        person.notes = (person.notes ?? []).filter((n) => n.title !== 'Headline' && n.title !== 'Profile')
        if (headline) {
          person.notes.push({
            id: makeId('note'),
            title: 'Headline',
            body: headline,
          })
        }
        if (description) {
          person.notes.push({
            id: makeId('note'),
            title: 'Profile',
            body: description,
          })
        }

        if (person.circleId !== companyCircle.id) {
          person.circleId = companyCircle.id
          const pos = findFreePersonPosition(graph, companyCircle.id)
          person.x = pos.x
          person.y = pos.y
        }
      } else {
        const existingIds = new Set(graph.people.map((p) => p.id))
        const personId = makeUniqueId(`linkedin-person-${slugifyId(slug || name)}`, existingIds)
        const pos = findFreePersonPosition(graph, companyCircle.id)

        const links = [{
          id: makeId('link'),
          service: 'linkedin' as const,
          label: 'LinkedIn',
          url: normalizedUrl,
        }]

        const notes = []
        if (headline) {
          notes.push({
            id: makeId('note'),
            title: 'Headline',
            body: headline,
          })
        }
        if (description) {
          notes.push({
            id: makeId('note'),
            title: 'Profile',
            body: description,
          })
        }

        person = {
          id: personId,
          name,
          x: pos.x,
          y: pos.y,
          circleId: companyCircle.id,
          avatar,
          shapeType: 'circle',
          sides: 10,
          amplitude: 0,
          imageUrl: profileData.avatarUrl,
          notes,
          links,
        }
        graph.people.push(person)
      }

      refitParents(graph, companyCircle.id)
      return person
    })
  }

  if (req.method === 'POST' && path === '/v1/people') {
    if (!auth.scopes.has('people:write')) return jsonResponse({ error: 'Missing scope: people:write' }, 403)
    return await mutateGraph(req, auth, body, (graph) => createPerson(graph, body))
  }

  const personMatch = path.match(/^\/v1\/people\/([^/]+)$/)
  if (personMatch && req.method === 'GET') {
    const { graph, revision } = await readGraph(auth.userId)
    const person = graph?.people.find((candidate) => candidate.id === personMatch[1]) ?? null
    return person ? jsonResponse({ person, revision }) : jsonResponse({ error: 'Person not found.' }, 404)
  }

  if (personMatch && req.method === 'PATCH') {
    if (!auth.scopes.has('people:write')) return jsonResponse({ error: 'Missing scope: people:write' }, 403)
    return await mutateGraph(req, auth, body, (graph) => {
      const person = graph.people.find((candidate) => candidate.id === personMatch[1])
      if (!person) throw new Response('Person not found.', { status: 404 })
      if (typeof body.name === 'string' && body.name.trim()) person.name = body.name.trim()
      if (typeof body.imageUrl === 'string') person.imageUrl = body.imageUrl
      if (typeof body.isFavorite === 'boolean') person.isFavorite = body.isFavorite
      return person
    })
  }

  if (personMatch && req.method === 'DELETE') {
    if (!auth.scopes.has('people:write')) return jsonResponse({ error: 'Missing scope: people:write' }, 403)
    return await mutateGraph(req, auth, body, (graph) => {
      graph.people = graph.people.filter((person) => person.id !== personMatch[1])
      graph.connections = graph.connections.filter((connection) => connection.fromId !== personMatch[1] && connection.toId !== personMatch[1])
      return { deleted: personMatch[1] }
    })
  }

  const moveMatch = path.match(/^\/v1\/people\/([^/]+)\/move$/)
  if (moveMatch && req.method === 'POST') {
    if (!auth.scopes.has('people:write')) return jsonResponse({ error: 'Missing scope: people:write' }, 403)
    return await mutateGraph(req, auth, body, (graph) => {
      const circleId = assertString(body.circleId, 'circleId')
      if (!graph.circles.some((circle) => circle.id === circleId)) throw new Response('Unknown circleId.', { status: 400 })
      const person = graph.people.find((candidate) => candidate.id === moveMatch[1])
      if (!person) throw new Response('Person not found.', { status: 404 })
      const position = findFreePersonPosition(graph, circleId)
      person.circleId = circleId
      person.x = position.x
      person.y = position.y
      refitParents(graph, circleId)
      return person
    })
  }

  const notesMatch = path.match(/^\/v1\/people\/([^/]+)\/notes(?:\/([^/]+))?$/)
  if (notesMatch) {
    if (!auth.scopes.has('notes:write')) return jsonResponse({ error: 'Missing scope: notes:write' }, 403)
    return await mutateGraph(req, auth, body, (graph) => {
      const person = graph.people.find((candidate) => candidate.id === notesMatch[1])
      if (!person) throw new Response('Person not found.', { status: 404 })
      person.notes ??= []
      if (req.method === 'POST' && !notesMatch[2]) {
        const [note] = normalizeNotes([body])
        person.notes.push(note)
        return note
      }
      if (req.method === 'PATCH' && notesMatch[2]) {
        const note = person.notes.find((candidate) => candidate.id === notesMatch[2])
        if (!note) throw new Response('Note not found.', { status: 404 })
        if (typeof body.title === 'string' && body.title.trim()) note.title = body.title.trim()
        if (typeof body.body === 'string' && body.body.trim()) note.body = body.body.trim()
        return note
      }
      if (req.method === 'DELETE' && notesMatch[2]) {
        person.notes = person.notes.filter((note) => note.id !== notesMatch[2])
        return { deleted: notesMatch[2] }
      }
      throw new Response('Method not allowed.', { status: 405 })
    })
  }

  const linksMatch = path.match(/^\/v1\/people\/([^/]+)\/links(?:\/([^/]+))?$/)
  if (linksMatch) {
    if (!auth.scopes.has('links:write')) return jsonResponse({ error: 'Missing scope: links:write' }, 403)
    return await mutateGraph(req, auth, body, (graph) => {
      const person = graph.people.find((candidate) => candidate.id === linksMatch[1])
      if (!person) throw new Response('Person not found.', { status: 404 })
      person.links ??= []
      if (req.method === 'POST' && !linksMatch[2]) {
        const [link] = normalizeLinks([body])
        person.links.push(link)
        return link
      }
      if (req.method === 'DELETE' && linksMatch[2]) {
        person.links = person.links.filter((link) => link.id !== linksMatch[2])
        return { deleted: linksMatch[2] }
      }
      throw new Response('Method not allowed.', { status: 405 })
    })
  }

  if (req.method === 'POST' && path === '/v1/connections') {
    if (!auth.scopes.has('connections:write')) return jsonResponse({ error: 'Missing scope: connections:write' }, 403)
    return await mutateGraph(req, auth, body, (graph) => {
      const fromId = assertString(body.fromId, 'fromId')
      const toId = assertString(body.toId, 'toId')
      if (fromId === toId) throw new Response('Connection endpoints must differ.', { status: 400 })
      const exists = graph.connections.some((connection) =>
        (connection.fromId === fromId && connection.toId === toId) ||
        (connection.fromId === toId && connection.toId === fromId)
      )
      if (!exists) graph.connections.push({ id: makeId('connection'), fromId, toId })
      return { fromId, toId }
    })
  }

  const connectionMatch = path.match(/^\/v1\/connections\/([^/]+)$/)
  if (connectionMatch && req.method === 'DELETE') {
    if (!auth.scopes.has('connections:write')) return jsonResponse({ error: 'Missing scope: connections:write' }, 403)
    return await mutateGraph(req, auth, body, (graph) => {
      graph.connections = graph.connections.filter((connection) => connection.id !== connectionMatch[1])
      return { deleted: connectionMatch[1] }
    })
  }

  if (req.method === 'POST' && path === '/v1/operations') {
    return await mutateGraph(req, auth, body, (graph) => {
      const operations = Array.isArray(body.operations) ? body.operations : []
      const results: unknown[] = []
      for (const operation of operations) {
        if (!operation || typeof operation !== 'object' || Array.isArray(operation)) continue
        const record = operation as Record<string, unknown>
        const data = parseBody(record.data)
        switch (record.type) {
          case 'person.create':
            if (!auth.scopes.has('people:write')) throw new Response('Missing scope: people:write', { status: 403 })
            results.push(createPerson(graph, data))
            break
          case 'note.create': {
            if (!auth.scopes.has('notes:write')) throw new Response('Missing scope: notes:write', { status: 403 })
            const personId = assertString(data.personId, 'personId')
            const person = graph.people.find((candidate) => candidate.id === personId)
            if (!person) throw new Response('Person not found.', { status: 404 })
            person.notes ??= []
            const [note] = normalizeNotes([data])
            person.notes.push(note)
            results.push(note)
            break
          }
          case 'link.create': {
            if (!auth.scopes.has('links:write')) throw new Response('Missing scope: links:write', { status: 403 })
            const personId = assertString(data.personId, 'personId')
            const person = graph.people.find((candidate) => candidate.id === personId)
            if (!person) throw new Response('Person not found.', { status: 404 })
            person.links ??= []
            const [link] = normalizeLinks([data])
            person.links.push(link)
            results.push(link)
            break
          }
          default:
            throw new Response(`Unknown operation: ${String(record.type)}`, { status: 400 })
        }
      }
      return results
    })
  }

  if (req.method === 'POST' && path === '/v1/graph/clear') {
    if (!auth.scopes.has('graph:replace')) return jsonResponse({ error: 'Missing scope: graph:replace' }, 403)
    return await mutateGraph(req, auth, body, (graph) => {
      graph.circles = [
        {
          id: 'you',
          name: 'You',
          icon: 'YOU',
          x: 0,
          y: 0,
          radius: 104,
          minRadius: 104,
          parentId: null,
          connectedTo: null,
          tone: 'blue',
          fillMode: 'transparent',
          shapeType: 'circle',
          shapeCustom: false,
          sides: 25,
          amplitude: 0,
        }
      ]
      graph.people = []
      graph.connections = []
      return { cleared: true }
    })
  }

  if (req.method === 'POST' && path === '/v1/circles') {
    if (!auth.scopes.has('circles:write')) return jsonResponse({ error: 'Missing scope: circles:write' }, 403)
    return await mutateGraph(req, auth, body, (graph) => createCircle(graph, body))
  }

  const circleMatch = path.match(/^\/v1\/circles\/([^/]+)$/)
  if (circleMatch) {
    if (req.method === 'PATCH') {
      if (!auth.scopes.has('circles:write')) return jsonResponse({ error: 'Missing scope: circles:write' }, 403)
      return await mutateGraph(req, auth, body, (graph) => {
        const circle = graph.circles.find((candidate) => candidate.id === circleMatch[1])
        if (!circle) throw new Response('Circle not found.', { status: 404 })

        if (typeof body.name === 'string' && body.name.trim()) {
          circle.name = body.name.trim()
          if (!body.icon) circle.icon = makeInitials(circle.name)
        }
        if (typeof body.icon === 'string') circle.icon = body.icon.trim()
        if (typeof body.x === 'number') circle.x = body.x
        if (typeof body.y === 'number') circle.y = body.y
        if (typeof body.radius === 'number') circle.radius = body.radius
        if (typeof body.minRadius === 'number') circle.minRadius = body.minRadius

        if ('parentId' in body) {
          const pId = typeof body.parentId === 'string' && body.parentId.trim() ? body.parentId.trim() : null
          if (pId && !graph.circles.some((c) => c.id === pId)) throw new Response('Unknown parentId.', { status: 400 })
          circle.parentId = pId
        }

        if ('connectedTo' in body) {
          const cTo = typeof body.connectedTo === 'string' && body.connectedTo.trim() ? body.connectedTo.trim() : null
          if (cTo && !graph.circles.some((c) => c.id === cTo)) throw new Response('Unknown connectedTo.', { status: 400 })
          circle.connectedTo = cTo
        }

        if (typeof body.tone === 'string' && ['blue', 'red', 'green', 'amber', 'violet'].includes(body.tone)) {
          circle.tone = body.tone as CircleNode['tone']
        }
        if (typeof body.fillMode === 'string' && ['transparent', 'solid'].includes(body.fillMode)) {
          circle.fillMode = body.fillMode as CircleNode['fillMode']
        }
        if (typeof body.shapeType === 'string' && ['circle', 'wavy', 'polygon'].includes(body.shapeType)) {
          circle.shapeType = body.shapeType as CircleNode['shapeType']
        }
        if (typeof body.shapeCustom === 'boolean') {
          circle.shapeCustom = body.shapeCustom
        }
        if (typeof body.sides === 'number') {
          circle.sides = body.sides
        }
        if (typeof body.amplitude === 'number') {
          circle.amplitude = body.amplitude
        }
        if ('imageUrl' in body) {
          circle.imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl : undefined
        }
        if ('customColor' in body) {
          circle.customColor = typeof body.customColor === 'string' ? body.customColor : undefined
        }

        if (circle.parentId) {
          refitParents(graph, circle.parentId)
        }
        return circle
      })
    }

    if (req.method === 'DELETE') {
      if (!auth.scopes.has('circles:write')) return jsonResponse({ error: 'Missing scope: circles:write' }, 403)
      return await mutateGraph(req, auth, body, (graph) => deleteCircle(graph, circleMatch[1]))
    }
  }

  const personAvatarMatch = path.match(/^\/v1\/people\/([^/]+)\/avatar$/)
  if (personAvatarMatch && req.method === 'POST') {
    if (!auth.scopes.has('people:write')) return jsonResponse({ error: 'Missing scope: people:write' }, 403)
    const imageUrl = await getUploadedImageUrl(req, body)
    return await mutateGraph(req, auth, body, (graph) => {
      const person = graph.people.find((candidate) => candidate.id === personAvatarMatch[1])
      if (!person) throw new Response('Person not found.', { status: 404 })
      person.imageUrl = imageUrl
      return person
    })
  }

  const circleAvatarMatch = path.match(/^\/v1\/circles\/([^/]+)\/avatar$/)
  if (circleAvatarMatch && req.method === 'POST') {
    if (!auth.scopes.has('circles:write')) return jsonResponse({ error: 'Missing scope: circles:write' }, 403)
    const imageUrl = await getUploadedImageUrl(req, body)
    return await mutateGraph(req, auth, body, (graph) => {
      const circle = graph.circles.find((candidate) => candidate.id === circleAvatarMatch[1])
      if (!circle) throw new Response('Circle not found.', { status: 404 })
      circle.imageUrl = imageUrl
      return circle
    })
  }

  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const path = normalizePath(url.pathname)
    const body = await readJson(req)
    const auth = await requireAuth(req)
    const tokenResponse = await handleTokenRoutes(req, path, auth, body)
    if (tokenResponse) return tokenResponse
    const graphResponse = await handleGraphRoutes(req, path, auth, body, url)
    if (graphResponse) return graphResponse
    return jsonResponse({ error: 'Not found.' }, 404)
  } catch (error) {
    if (error instanceof Response) {
      const message = await error.text()
      return jsonResponse({ error: message || error.statusText }, error.status)
    }
    return jsonResponse({ error: formatError(error) }, 500)
  }
})
