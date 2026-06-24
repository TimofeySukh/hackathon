import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createClient } from 'npm:@supabase/supabase-js@2'

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

const DEFAULT_AGENT_SCOPES: Scope[] = ['graph:read', 'search:read', 'people:write', 'notes:write', 'links:write', 'connections:write']
const PERSON_RADIUS = 30

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
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

async function writeGraph(userId: string, graph: GraphState, expectedRevision: number | null) {
  const service = getServiceClient()

  if (expectedRevision === null) {
    const { data, error } = await service
      .from('user_graphs')
      .insert({ user_id: userId, graph })
      .select('revision')
      .single()
    if (error) {
      if (error.code === '23505') return jsonResponse({ error: 'Revision conflict.' }, 409)
      throw error
    }
    return jsonResponse({ graph, revision: data.revision ?? 1 })
  }

  const { data, error } = await service
    .from('user_graphs')
    .update({ graph })
    .eq('user_id', userId)
    .eq('revision', expectedRevision)
    .select('revision')
    .maybeSingle()

  if (error) throw error
  if (!data) return jsonResponse({ error: 'Revision conflict.' }, 409)
  return jsonResponse({ graph, revision: data.revision ?? expectedRevision + 1 })
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

function searchGraph(graph: GraphState, query: string, limit: number) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const circlesById = new Map(graph.circles.map((circle) => [circle.id, circle]))
  const people = graph.people
    .filter((person) => {
      const circle = circlesById.get(person.circleId)
      const notes = (person.notes ?? []).map((note) => `${note.title} ${note.body}`).join(' ')
      const links = (person.links ?? []).map((link) => `${link.label} ${link.url}`).join(' ')
      return [person.name, circle?.name, notes, links].filter(Boolean).join(' ').toLowerCase().includes(q)
    })
    .map((person) => ({
      type: 'person',
      id: person.id,
      name: person.name,
      circleId: person.circleId,
      circlePath: getCirclePath(graph, person.circleId).map((circle) => ({ id: circle.id, name: circle.name })),
    }))
  const circles = graph.circles
    .filter((circle) => circle.name.toLowerCase().includes(q))
    .map((circle) => ({
      type: 'circle',
      id: circle.id,
      name: circle.name,
      parentId: circle.parentId,
      path: getCirclePath(graph, circle.id).map((item) => ({ id: item.id, name: item.name })),
    }))
  return [...people, ...circles].slice(0, limit)
}

function parseBody(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
}

async function readJson(req: Request) {
  if (req.method === 'GET' || req.method === 'DELETE') return {}
  return parseBody(await req.json().catch(() => ({})))
}

function getExpectedRevision(body: Record<string, unknown>) {
  return typeof body.expectedRevision === 'number' ? body.expectedRevision : null
}

async function mutateGraph(req: Request, auth: AuthContext, body: Record<string, unknown>, mutate: (graph: GraphState) => unknown) {
  const current = await readGraph(auth.userId)
  if (!current.graph) return jsonResponse({ error: 'No graph exists yet.' }, 404)
  const expectedRevision = getExpectedRevision(body)
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
    return await writeGraph(auth.userId, graph, getExpectedRevision(body))
  }

  if (req.method === 'GET' && path === '/v1/search') {
    const { graph } = await readGraph(auth.userId)
    if (!graph) return jsonResponse({ results: [] })
    return jsonResponse({ results: searchGraph(graph, url.searchParams.get('q') ?? '', Math.min(Number(url.searchParams.get('limit') ?? 10), 50)) })
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
    const message = error instanceof Error ? error.message : 'Unexpected graph API error.'
    return jsonResponse({ error: message }, 500)
  }
})
