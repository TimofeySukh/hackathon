#!/usr/bin/env node

import {
  addLink,
  addNote,
  batchSearch,
  batchOperations,
  createConnection,
  createPerson,
  getPeople,
  getMeta,
  listCircles,
  search,
  smartSearch,
  discoverPeople,
  discoverPeopleLab,
  importLinkedInPerson,
  deletePerson,
  deleteNote,
  deleteLink,
  deleteConnection,
  exportGraph,
  importGraph,
  clearGraph,
  createCircle,
  updateCircle,
  deleteCircle,
  uploadAvatar
} from './datanode-api-client.mjs'

const SERVICE_VALUES = ['linkedin', 'telegram', 'instagram', 'facebook', 'whatsapp', 'x', 'website']
const TONE_VALUES = ['blue', 'red', 'green', 'amber', 'violet']
const SHAPE_VALUES = ['circle', 'wavy', 'polygon']
const FILL_MODE_VALUES = ['transparent', 'solid']
const RISK_VALUES = ['read_only', 'search_only', 'write_internal', 'destructive']

const resultEnvelopeSchema = strictObject({
  status: { type: 'string', enum: ['success', 'error'] },
  tool: { type: 'string' },
  summary: { type: 'string' },
  data: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'], additionalProperties: true },
  next_valid_actions: { type: 'array', items: { type: 'string' } },
  guidance: { type: 'string' },
})

const noteInputSchema = strictObject({
  id: { type: 'string' },
  title: { type: 'string' },
  body: { type: 'string' },
}, ['body'])

const linkInputSchema = strictObject({
  id: { type: 'string' },
  service: { type: 'string', enum: SERVICE_VALUES },
  url: { type: 'string' },
  label: { type: 'string' },
}, ['service', 'url'])

const personNoteSchema = strictObject({
  id: { type: 'string' },
  title: { type: 'string' },
  body: { type: 'string' },
}, ['id', 'title', 'body'])

const personLinkSchema = strictObject({
  id: { type: 'string' },
  service: { type: 'string', enum: SERVICE_VALUES },
  url: { type: 'string' },
  label: { type: 'string' },
}, ['id', 'service', 'url', 'label'])

const circleSchema = strictObject({
  id: { type: 'string' },
  name: { type: 'string' },
  icon: { type: 'string' },
  x: { type: 'number' },
  y: { type: 'number' },
  radius: { type: 'number' },
  minRadius: { type: 'number' },
  parentId: { type: ['string', 'null'] },
  connectedTo: { type: ['string', 'null'] },
  tone: { type: 'string', enum: TONE_VALUES },
  shapeType: { type: 'string', enum: SHAPE_VALUES },
  shapeCustom: { type: 'boolean' },
  sides: { type: 'number' },
  amplitude: { type: 'number' },
  imageUrl: { type: 'string' },
  customColor: { type: 'string' },
  fillMode: { type: 'string', enum: FILL_MODE_VALUES },
}, ['id', 'name', 'icon', 'x', 'y', 'radius', 'minRadius', 'parentId', 'connectedTo', 'tone'])

const personSchema = strictObject({
  id: { type: 'string' },
  name: { type: 'string' },
  x: { type: 'number' },
  y: { type: 'number' },
  circleId: { type: 'string' },
  avatar: { type: 'string' },
  shapeType: { type: 'string', enum: SHAPE_VALUES },
  sides: { type: 'number' },
  amplitude: { type: 'number' },
  imageUrl: { type: 'string' },
  isFavorite: { type: 'boolean' },
  notes: { type: 'array', items: personNoteSchema },
  links: { type: 'array', items: personLinkSchema },
}, ['id', 'name', 'x', 'y', 'circleId', 'avatar'])

const connectionSchema = strictObject({
  id: { type: 'string' },
  fromId: { type: 'string' },
  toId: { type: 'string' },
}, ['id', 'fromId', 'toId'])

const graphSchema = strictObject({
  circles: { type: 'array', items: circleSchema },
  people: { type: 'array', items: personSchema },
  connections: { type: 'array', items: connectionSchema },
}, ['circles', 'people', 'connections'])

const operationSchema = strictObject({
  type: { type: 'string', enum: ['person.create', 'note.create', 'link.create'] },
  data: {
    type: 'object',
    description: 'Operation payload. person.create requires circleId/name; note.create requires personId/body; link.create requires personId/service/url.',
    additionalProperties: true,
  },
}, ['type', 'data'])

const profileOptionsSchema = {
  includeNotes: { type: 'boolean', description: 'Include person notes. Defaults to true.' },
  includeLinks: { type: 'boolean', description: 'Include person links. Defaults to true.' },
  includeCirclePath: { type: 'boolean', description: 'Include circle path references. Defaults to true.' },
  includeSearchSummary: { type: 'boolean', description: 'Include compact search summary. Defaults to false.' },
}

const toolDefinitions = [
  tool({
    name: 'list_capabilities',
    description: 'List DataNode MCP capabilities with compact risk and side-effect metadata. Use this first when deciding which graph tool to call.',
    riskClass: 'read_only',
    sideEffect: 'none',
    schema: strictObject({
      riskClass: { type: 'string', enum: RISK_VALUES, description: 'Optional filter by risk class.' },
    }),
    annotations: { readOnlyHint: true },
  }),
  tool({
    name: 'search_people_and_circles',
    description: 'Search the user-owned DataNode graph by person name, circle, notes, links, or circle name. Read-only and result-limited.',
    riskClass: 'search_only',
    sideEffect: 'none',
    schema: strictObject({
      query: { type: 'string' },
      limit: { type: 'number', default: 10, minimum: 1, maximum: 50 },
    }, ['query']),
    annotations: { readOnlyHint: true },
  }),
  tool({
    name: 'batch_search_people_and_circles',
    description: 'Run up to 20 independent compact graph searches in one call. Use this to gather person references from large graphs before fetching exact profiles with get_people.',
    riskClass: 'search_only',
    sideEffect: 'none',
    schema: strictObject({
      queries: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 },
      limit: { type: 'number', default: 10, minimum: 1, maximum: 50 },
    }, ['queries']),
    annotations: { readOnlyHint: true },
  }),
  tool({
    name: 'smart_search_people_and_circles',
    description: 'Natural-language search over the graph. The server interprets the query with AI, then ranks people and circles using circle hierarchy, notes, and roles. Requires server-side AI search configuration.',
    riskClass: 'search_only',
    sideEffect: 'none',
    schema: strictObject({
      query: { type: 'string' },
      limit: { type: 'number', default: 10, minimum: 1, maximum: 50 },
    }, ['query']),
    annotations: { readOnlyHint: true },
  }),
  tool({
    name: 'discover_people',
    description: 'Exoskeleton people discovery: LLM plans groups, code prefilters thousands of profiles, AI matches in batches, returns clustered people with layout coordinates for map visualization. Best for multi-group queries (speakers + investors, who can help with X).',
    riskClass: 'search_only',
    sideEffect: 'none',
    schema: strictObject({
      query: { type: 'string' },
      perGroupLimit: { type: 'number', minimum: 1, maximum: 24 },
    }, ['query']),
    annotations: { readOnlyHint: true },
  }),
  tool({
    name: 'discover_people_lab',
    description: 'LLM people discovery on a provided graph JSON (Search Lab / synthetic bench). Same exoskeleton pipeline as discover_people but graph is sent in the request body instead of the saved board.',
    riskClass: 'search_only',
    sideEffect: 'none',
    schema: strictObject({
      query: { type: 'string' },
      graph: { type: 'object' },
      perGroupLimit: { type: 'number', minimum: 1, maximum: 24 },
    }, ['query', 'graph']),
    annotations: { readOnlyHint: true },
  }),
  tool({
    name: 'list_circles',
    description: 'List circles with ids, parent ids, paths, and people counts. Read-only.',
    riskClass: 'read_only',
    sideEffect: 'none',
    schema: strictObject({}),
    annotations: { readOnlyHint: true },
  }),
  tool({
    name: 'get_people',
    description: 'Fetch compact profiles for specific person ids. Returns only requested people, preserves id order, includes notes/links by default, and never returns image/base64 payloads.',
    riskClass: 'read_only',
    sideEffect: 'none',
    schema: strictObject({
      ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 250 },
      ...profileOptionsSchema,
    }, ['ids']),
    annotations: { readOnlyHint: true },
  }),
  tool({
    name: 'create_person',
    description: 'Create a person in a direct circle. The server chooses a safe position inside the circle.',
    riskClass: 'write_internal',
    sideEffect: 'creates graph node',
    schema: strictObject({
      circleId: { type: 'string' },
      name: { type: 'string' },
      notes: { type: 'array', items: noteInputSchema },
      links: { type: 'array', items: linkInputSchema },
    }, ['circleId', 'name']),
  }),
  tool({
    name: 'add_note',
    description: 'Add a note to a person.',
    riskClass: 'write_internal',
    sideEffect: 'adds note',
    schema: strictObject({
      personId: { type: 'string' },
      title: { type: 'string' },
      body: { type: 'string' },
    }, ['personId', 'body']),
  }),
  tool({
    name: 'add_link',
    description: 'Add a saved connection/link to a person.',
    riskClass: 'write_internal',
    sideEffect: 'adds link',
    schema: strictObject({
      personId: { type: 'string' },
      service: { type: 'string', enum: SERVICE_VALUES },
      url: { type: 'string' },
      label: { type: 'string' },
    }, ['personId', 'service', 'url']),
  }),
  tool({
    name: 'create_connection',
    description: 'Create a relationship connection between two node ids.',
    riskClass: 'write_internal',
    sideEffect: 'adds connection',
    schema: strictObject({
      fromId: { type: 'string' },
      toId: { type: 'string' },
    }, ['fromId', 'toId']),
  }),
  tool({
    name: 'batch_operations',
    description: 'Run a small transactional batch of person.create, note.create, or link.create operations. Prefer this over repeated single writes when the batch is deliberate and reviewable.',
    riskClass: 'write_internal',
    sideEffect: 'multiple graph writes',
    schema: strictObject({
      operations: { type: 'array', items: operationSchema, minItems: 1, maxItems: 25 },
    }, ['operations']),
  }),
  tool({
    name: 'import_linkedin_person',
    description: 'Import or update a person by their LinkedIn profile URL. Uses server-side enrichment.',
    riskClass: 'write_internal',
    sideEffect: 'creates or updates person and company circle',
    schema: strictObject({
      url: { type: 'string', description: 'LinkedIn profile URL.' },
    }, ['url']),
    annotations: { openWorldHint: true },
  }),
  tool({
    name: 'delete_person',
    description: 'Delete a person node from the graph. If this is part of a large cleanup, create a backup with export_graph or ask the user to confirm first.',
    riskClass: 'destructive',
    sideEffect: 'deletes person and related connections',
    schema: strictObject({
      personId: { type: 'string', description: 'The ID of the person to delete.' },
    }, ['personId']),
    annotations: { destructiveHint: true },
  }),
  tool({
    name: 'delete_note',
    description: 'Delete a specific note from a person.',
    riskClass: 'destructive',
    sideEffect: 'deletes note',
    schema: strictObject({
      personId: { type: 'string', description: 'The ID of the person who owns the note.' },
      noteId: { type: 'string', description: 'The ID of the note to delete.' },
    }, ['personId', 'noteId']),
    annotations: { destructiveHint: true },
  }),
  tool({
    name: 'delete_link',
    description: 'Delete a specific link/social connection from a person.',
    riskClass: 'destructive',
    sideEffect: 'deletes link',
    schema: strictObject({
      personId: { type: 'string', description: 'The ID of the person who owns the link.' },
      linkId: { type: 'string', description: 'The ID of the link to delete.' },
    }, ['personId', 'linkId']),
    annotations: { destructiveHint: true },
  }),
  tool({
    name: 'delete_connection',
    description: 'Delete a relationship connection between two nodes.',
    riskClass: 'destructive',
    sideEffect: 'deletes connection',
    schema: strictObject({
      connectionId: { type: 'string', description: 'The ID of the connection to delete.' },
    }, ['connectionId']),
    annotations: { destructiveHint: true },
  }),
  tool({
    name: 'export_graph',
    description: 'Retrieve the entire social graph and its revision. Use this as a backup before large, experimental, bulk, or destructive changes.',
    riskClass: 'read_only',
    sideEffect: 'none',
    schema: strictObject({}),
    annotations: { readOnlyHint: true },
  }),
  tool({
    name: 'import_graph',
    description: 'Replace the entire graph with a new graph JSON. For large replacements, ask the user to confirm or create a backup with export_graph first.',
    riskClass: 'destructive',
    sideEffect: 'replaces entire graph',
    schema: strictObject({
      graph: {
        ...graphSchema,
        description: 'The complete graph state containing circles, people, and connections arrays.',
      },
    }, ['graph']),
    annotations: { destructiveHint: true },
  }),
  tool({
    name: 'clear_graph',
    description: 'Reset the graph, deleting all circles, people, and connections, leaving only the central "You" circle. Ask for confirmation or create a backup first unless the user clearly requested a reset.',
    riskClass: 'destructive',
    sideEffect: 'deletes entire graph',
    schema: strictObject({}),
    annotations: { destructiveHint: true },
  }),
  tool({
    name: 'create_circle',
    description: 'Create a circle (standalone or nested).',
    riskClass: 'write_internal',
    sideEffect: 'creates circle',
    schema: strictObject({
      name: { type: 'string', description: 'The name of the circle.' },
      parentId: { type: ['string', 'null'], description: 'Optional. Parent circle ID to nest this circle.' },
      connectedTo: { type: ['string', 'null'], description: 'Optional. ID of another circle to connect this one to.' },
      tone: { type: 'string', enum: TONE_VALUES, description: 'Optional color tone.' },
    }, ['name']),
  }),
  tool({
    name: 'update_circle',
    description: 'Update circle properties (name, parent, connections, position, color/shape style). Ask before broad layout rewrites.',
    riskClass: 'write_internal',
    sideEffect: 'updates circle',
    schema: strictObject({
      circleId: { type: 'string' },
      name: { type: 'string' },
      parentId: { type: ['string', 'null'] },
      connectedTo: { type: ['string', 'null'] },
      tone: { type: 'string', enum: TONE_VALUES },
      x: { type: 'number' },
      y: { type: 'number' },
      radius: { type: 'number' },
      minRadius: { type: 'number' },
      shapeType: { type: 'string', enum: SHAPE_VALUES },
      sides: { type: 'number' },
      amplitude: { type: 'number' },
    }, ['circleId']),
  }),
  tool({
    name: 'delete_circle',
    description: 'Delete a circle. Its child circles/people are promoted to its parent circle. For large cleanups, create a backup or ask the user to confirm first.',
    riskClass: 'destructive',
    sideEffect: 'deletes circle and rewires children',
    schema: strictObject({
      circleId: { type: 'string' },
    }, ['circleId']),
    annotations: { destructiveHint: true },
  }),
  tool({
    name: 'upload_avatar',
    description: 'Upload/set a photo or avatar for a person or circle (accepts Base64 image data or URL).',
    riskClass: 'write_internal',
    sideEffect: 'updates avatar image',
    schema: strictObject({
      type: { type: 'string', enum: ['person', 'circle'], description: 'Whether it is a person or a circle.' },
      id: { type: 'string', description: 'The ID of the person or circle.' },
      imageUrl: { type: 'string', description: 'Base64 image string (with or without MIME prefix) or a URL.' },
    }, ['type', 'id', 'imageUrl']),
    annotations: { openWorldHint: true },
  }),
]

const tools = toolDefinitions.map(({ handler, riskClass, sideEffect, ...definition }) => definition)
const toolRegistry = new Map(toolDefinitions.map((definition) => [definition.name, definition]))

function strictObject(properties, required = []) {
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

function tool({ name, description, schema, riskClass, sideEffect, annotations = {}, handler }) {
  return {
    name,
    description,
    inputSchema: schema,
    outputSchema: resultEnvelopeSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
      ...annotations,
    },
    _meta: {
      riskClass,
      sideEffect,
      resourceScope: 'current_user_graph',
      permissionPolicy: 'server-enforced token scopes plus optimistic revision checks',
      resultFormat: 'JSON envelope with status, summary, data, and next_valid_actions',
    },
    riskClass,
    sideEffect,
    handler,
  }
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function summarizeValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (value.counts) {
      const counts = value.counts
      return `Graph has ${counts.people ?? 0} people, ${counts.circles ?? 0} circles, and ${counts.connections ?? 0} connections.`
    }
    if (value.results && Array.isArray(value.results)) {
      if (value.results.every((entry) => entry && typeof entry === 'object' && Array.isArray(entry.results))) {
        const total = value.results.reduce((sum, entry) => sum + entry.results.length, 0)
        return `Ran ${value.results.length} search(es), found ${total} result(s).`
      }
      return `Found ${value.results.length} result(s).`
    }
    if (value.people && Array.isArray(value.people)) {
      const missingCount = Array.isArray(value.missingIds) ? value.missingIds.length : 0
      return `Fetched ${value.people.length} people${missingCount ? `; ${missingCount} missing id(s)` : ''}.`
    }
    if (value.circles && Array.isArray(value.circles)) return `Listed ${value.circles.length} circle(s).`
    if (value.capabilities && Array.isArray(value.capabilities)) return `Listed ${value.capabilities.length} capability/capabilities.`
    if (value.revision !== undefined && value.graph) {
      const graph = value.graph
      return `Graph export at revision ${value.revision}: ${graph?.people?.length ?? 0} people, ${graph?.circles?.length ?? 0} circles, ${graph?.connections?.length ?? 0} connections.`
    }
    if (value.result !== undefined && value.revision !== undefined) return `Mutation succeeded at revision ${value.revision}.`
  }
  return 'Tool call completed.'
}

function resultEnvelope(toolName, value, extra = {}) {
  const envelope = {
    status: 'success',
    tool: toolName,
    summary: summarizeValue(value),
    data: value,
    next_valid_actions: nextActionsFor(toolName),
    ...extra,
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
    structuredContent: envelope,
  }
}

function errorEnvelope(toolName, error) {
  const message = error instanceof Error ? error.message : String(error)
  const envelope = {
    status: 'error',
    tool: toolName,
    error: {
      type: error?.status === 409 ? 'revision_conflict' : error?.status === 403 ? 'permission_denied' : 'tool_error',
      message,
    },
    next_valid_actions: error?.status === 409 ? ['retry_after_reading_graph_meta'] : ['inspect_error_and_retry_with_valid_arguments'],
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
    structuredContent: envelope,
    isError: true,
  }
}

function nextActionsFor(toolName) {
  if (toolName === 'list_capabilities') return ['search_people_and_circles', 'batch_search_people_and_circles', 'get_people', 'smart_search_people_and_circles', 'discover_people', 'discover_people_lab', 'list_circles']
  if (toolName === 'search_people_and_circles') return ['get_people', 'batch_search_people_and_circles', 'list_circles', 'create_person', 'add_note']
  if (toolName === 'batch_search_people_and_circles') return ['get_people', 'search_people_and_circles', 'smart_search_people_and_circles', 'add_note']
  if (toolName === 'get_people') return ['batch_search_people_and_circles', 'search_people_and_circles', 'add_note', 'add_link']
  if (toolName === 'smart_search_people_and_circles') return ['discover_people', 'list_circles', 'create_person', 'add_note']
  if (toolName === 'discover_people') return ['smart_search_people_and_circles', 'list_circles', 'add_note']
  if (toolName === 'list_circles') return ['create_person', 'create_circle', 'search_people_and_circles']
  if (toolName === 'export_graph') return ['import_graph', 'clear_graph', 'batch_operations']
  if (['import_graph', 'clear_graph'].includes(toolName)) return ['list_circles', 'search_people_and_circles']
  return ['search_people_and_circles', 'list_circles']
}

async function callTool(name, args = {}) {
  const definition = toolRegistry.get(name)
  if (!definition) throw new Error(`Unknown tool: ${name}`)
  validateSchema(args, definition.inputSchema, name)

  switch (name) {
    case 'list_capabilities':
      return resultEnvelope(name, {
        capabilities: toolDefinitions
          .filter((definition) => !args.riskClass || definition.riskClass === args.riskClass)
          .map((definition) => ({
            name: definition.name,
            description: definition.description,
            riskClass: definition.riskClass,
            sideEffect: definition.sideEffect,
            readOnly: definition.annotations.readOnlyHint,
            destructive: definition.annotations.destructiveHint,
          })),
      })
    case 'search_people_and_circles':
      return resultEnvelope(name, await search(args.query, Math.min(args.limit ?? 10, 50)))
    case 'batch_search_people_and_circles':
      return resultEnvelope(name, await batchSearch(args.queries, Math.min(args.limit ?? 10, 50)))
    case 'smart_search_people_and_circles':
      return resultEnvelope(name, await smartSearch(args.query, Math.min(args.limit ?? 10, 50)))
    case 'discover_people':
      return resultEnvelope(name, await discoverPeople(
        args.query,
        args.perGroupLimit == null ? undefined : Math.min(args.perGroupLimit, 24),
      ))
    case 'discover_people_lab':
      return resultEnvelope(name, await discoverPeopleLab(args.query, args.graph, args.perGroupLimit))
    case 'list_circles':
      return resultEnvelope(name, await listCircles())
    case 'get_people':
      return resultEnvelope(name, await getPeople(args.ids, {
        includeNotes: args.includeNotes ?? true,
        includeLinks: args.includeLinks ?? true,
        includeCirclePath: args.includeCirclePath ?? true,
        includeSearchSummary: args.includeSearchSummary ?? false,
      }))
    case 'create_person': {
      const meta = await getMeta()
      return resultEnvelope(name, await createPerson({ expectedRevision: meta.revision, ...args }))
    }
    case 'add_note': {
      const meta = await getMeta()
      return resultEnvelope(name, await addNote(args.personId, { expectedRevision: meta.revision, title: args.title, body: args.body }))
    }
    case 'add_link': {
      const meta = await getMeta()
      return resultEnvelope(name, await addLink(args.personId, { expectedRevision: meta.revision, service: args.service, url: args.url, label: args.label }))
    }
    case 'create_connection': {
      const meta = await getMeta()
      return resultEnvelope(name, await createConnection({ expectedRevision: meta.revision, fromId: args.fromId, toId: args.toId }))
    }
    case 'batch_operations': {
      validateOperations(args.operations)
      const meta = await getMeta()
      return resultEnvelope(name, await batchOperations({ expectedRevision: meta.revision, operations: args.operations }))
    }
    case 'import_linkedin_person': {
      const meta = await getMeta()
      return resultEnvelope(name, await importLinkedInPerson({ expectedRevision: meta.revision, url: args.url }))
    }
    case 'delete_person': {
      const meta = await getMeta()
      return resultEnvelope(name, await deletePerson(args.personId, { expectedRevision: meta.revision }))
    }
    case 'delete_note': {
      const meta = await getMeta()
      return resultEnvelope(name, await deleteNote(args.personId, args.noteId, { expectedRevision: meta.revision }))
    }
    case 'delete_link': {
      const meta = await getMeta()
      return resultEnvelope(name, await deleteLink(args.personId, args.linkId, { expectedRevision: meta.revision }))
    }
    case 'delete_connection': {
      const meta = await getMeta()
      return resultEnvelope(name, await deleteConnection(args.connectionId, { expectedRevision: meta.revision }))
    }
    case 'export_graph':
      return resultEnvelope(name, await exportGraph(), {
        guidance: 'Use this payload as a backup before large, bulk, or destructive graph changes.',
      })
    case 'import_graph': {
      const meta = await getMeta()
      return resultEnvelope(name, await importGraph({ graph: args.graph, expectedRevision: meta.revision }))
    }
    case 'clear_graph': {
      const meta = await getMeta()
      return resultEnvelope(name, await clearGraph({ expectedRevision: meta.revision }))
    }
    case 'create_circle': {
      const meta = await getMeta()
      return resultEnvelope(name, await createCircle({ expectedRevision: meta.revision, ...args }))
    }
    case 'update_circle': {
      const meta = await getMeta()
      const { circleId, ...rest } = args
      return resultEnvelope(name, await updateCircle(circleId, { expectedRevision: meta.revision, ...rest }))
    }
    case 'delete_circle': {
      const meta = await getMeta()
      return resultEnvelope(name, await deleteCircle(args.circleId, { expectedRevision: meta.revision }))
    }
    case 'upload_avatar': {
      const meta = await getMeta()
      return resultEnvelope(name, await uploadAvatar(args.type, args.id, args.imageUrl, meta.revision))
    }
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

function validateOperations(operations) {
  for (const [index, operation] of operations.entries()) {
    if (operation.type === 'person.create') {
      validateSchema(operation.data, strictObject({
        circleId: { type: 'string' },
        name: { type: 'string' },
        notes: { type: 'array', items: noteInputSchema },
        links: { type: 'array', items: linkInputSchema },
      }, ['circleId', 'name']), `batch_operations.operations[${index}].data`)
    } else if (operation.type === 'note.create') {
      validateSchema(operation.data, strictObject({
        personId: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
      }, ['personId', 'body']), `batch_operations.operations[${index}].data`)
    } else if (operation.type === 'link.create') {
      validateSchema(operation.data, strictObject({
        personId: { type: 'string' },
        service: { type: 'string', enum: SERVICE_VALUES },
        url: { type: 'string' },
        label: { type: 'string' },
      }, ['personId', 'service', 'url']), `batch_operations.operations[${index}].data`)
    }
  }
}

function validateSchema(value, schema, path) {
  const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type]
  const actualType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
  if (schema.type && !expectedTypes.includes(actualType)) {
    throw new Error(`${path} must be ${expectedTypes.join(' or ')}.`)
  }

  if (schema.enum && !schema.enum.includes(value)) {
    throw new Error(`${path} must be one of: ${schema.enum.join(', ')}.`)
  }

  if (actualType === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) throw new Error(`${path} must be at least ${schema.minimum}.`)
    if (typeof schema.maximum === 'number' && value > schema.maximum) throw new Error(`${path} must be at most ${schema.maximum}.`)
  }

  if (actualType === 'array') {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) throw new Error(`${path} must include at least ${schema.minItems} item(s).`)
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) throw new Error(`${path} must include at most ${schema.maxItems} item(s).`)
    if (schema.items) value.forEach((item, index) => validateSchema(item, schema.items, `${path}[${index}]`))
  }

  if (actualType === 'object' && schema.additionalProperties === false) {
    const properties = schema.properties ?? {}
    for (const requiredField of schema.required ?? []) {
      if (value[requiredField] === undefined) throw new Error(`${path}.${requiredField} is required.`)
    }
    for (const key of Object.keys(value)) {
      if (!Object.prototype.hasOwnProperty.call(properties, key)) throw new Error(`${path}.${key} is not allowed.`)
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (value[key] !== undefined) validateSchema(value[key], childSchema, `${path}.${key}`)
    }
  }
}

let buffer = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  buffer += chunk
  let newlineIndex = buffer.indexOf('\n')
  while (newlineIndex !== -1) {
    const line = buffer.slice(0, newlineIndex).trim()
    buffer = buffer.slice(newlineIndex + 1)
    newlineIndex = buffer.indexOf('\n')
    if (line) void handleLine(line)
  }
})

async function handleLine(line) {
  let request
  try {
    request = JSON.parse(line)
  } catch (error) {
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON-RPC request.' } })
    return
  }

  try {
    if (request.method === 'initialize') {
      send({
        jsonrpc: '2.0',
        id: request.id,
        result: {
          protocolVersion: request.params?.protocolVersion ?? '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'datanode-mcp', version: '0.2.0' },
        },
      })
      return
    }
    if (request.method === 'tools/list') {
      send({ jsonrpc: '2.0', id: request.id, result: { tools } })
      return
    }
    if (request.method === 'tools/call') {
      const name = request.params?.name
      const result = await callTool(name, request.params?.arguments ?? {})
      send({ jsonrpc: '2.0', id: request.id, result })
      return
    }
    if (request.id !== undefined) send({ jsonrpc: '2.0', id: request.id, result: {} })
  } catch (error) {
    const toolName = request.params?.name ?? 'unknown'
    send({
      jsonrpc: '2.0',
      id: request.id,
      result: errorEnvelope(toolName, error),
    })
  }
}
