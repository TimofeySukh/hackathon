#!/usr/bin/env node

import {
  addLink,
  addNote,
  createConnection,
  createPerson,
  getMeta,
  listCircles,
  search,
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

const tools = [
  {
    name: 'search_people_and_circles',
    description: 'Search the user-owned DataNode graph by person name, circle, notes, links, or circle name.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number', default: 10 },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_circles',
    description: 'List circles with ids, parent ids, paths, and people counts.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create_person',
    description: 'Create a person in a direct circle. The server chooses a safe position inside the circle.',
    inputSchema: {
      type: 'object',
      properties: {
        circleId: { type: 'string' },
        name: { type: 'string' },
        notes: { type: 'array', items: { type: 'object' } },
        links: { type: 'array', items: { type: 'object' } },
      },
      required: ['circleId', 'name'],
    },
  },
  {
    name: 'add_note',
    description: 'Add a note to a person.',
    inputSchema: {
      type: 'object',
      properties: {
        personId: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['personId', 'body'],
    },
  },
  {
    name: 'add_link',
    description: 'Add a saved connection/link to a person.',
    inputSchema: {
      type: 'object',
      properties: {
        personId: { type: 'string' },
        service: { type: 'string', enum: ['linkedin', 'telegram', 'instagram', 'facebook', 'whatsapp', 'x', 'website'] },
        url: { type: 'string' },
        label: { type: 'string' },
      },
      required: ['personId', 'service', 'url'],
    },
  },
  {
    name: 'create_connection',
    description: 'Create a relationship connection between two node ids.',
    inputSchema: {
      type: 'object',
      properties: {
        fromId: { type: 'string' },
        toId: { type: 'string' },
      },
      required: ['fromId', 'toId'],
    },
  },
  {
    name: 'import_linkedin_person',
    description: 'Import or update a person by their LinkedIn profile URL.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'LinkedIn profile URL.' },
      },
      required: ['url'],
    },
  },
  {
    name: 'delete_person',
    description: 'Delete a person node from the graph.',
    inputSchema: {
      type: 'object',
      properties: {
        personId: { type: 'string', description: 'The ID of the person to delete.' },
      },
      required: ['personId'],
    },
  },
  {
    name: 'delete_note',
    description: 'Delete a specific note from a person.',
    inputSchema: {
      type: 'object',
      properties: {
        personId: { type: 'string', description: 'The ID of the person who owns the note.' },
        noteId: { type: 'string', description: 'The ID of the note to delete.' },
      },
      required: ['personId', 'noteId'],
    },
  },
  {
    name: 'delete_link',
    description: 'Delete a specific link/social connection from a person.',
    inputSchema: {
      type: 'object',
      properties: {
        personId: { type: 'string', description: 'The ID of the person who owns the link.' },
        linkId: { type: 'string', description: 'The ID of the link to delete.' },
      },
      required: ['personId', 'linkId'],
    },
  },
  {
    name: 'delete_connection',
    description: 'Delete a relationship connection between two nodes.',
    inputSchema: {
      type: 'object',
      properties: {
        connectionId: { type: 'string', description: 'The ID of the connection to delete.' },
      },
      required: ['connectionId'],
    },
  },
  {
    name: 'export_graph',
    description: 'Retrieve the entire social graph (circles, people, connections) and its revision. RECOMMENDED: Run this tool to create a backup file locally before making any large or experimental changes to the graph.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'import_graph',
    description: 'Replace the entire graph with a new graph JSON.',
    inputSchema: {
      type: 'object',
      properties: {
        graph: {
          type: 'object',
          description: 'The complete graph state containing circles, people, and connections arrays.'
        },
      },
      required: ['graph'],
    },
  },
  {
    name: 'clear_graph',
    description: 'Reset the graph, deleting all circles, people, and connections, leaving only the central "You" circle.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create_circle',
    description: 'Create a circle (standalone or nested).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The name of the circle.' },
        parentId: { type: 'string', description: 'Optional. Parent circle ID to nest this circle.' },
        connectedTo: { type: 'string', description: 'Optional. ID of another circle to connect this one to.' },
        tone: { type: 'string', enum: ['blue', 'red', 'green', 'amber', 'violet'], description: 'Optional color tone.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_circle',
    description: 'Update circle properties (name, parent, connections, position, color/shape style).',
    inputSchema: {
      type: 'object',
      properties: {
        circleId: { type: 'string' },
        name: { type: 'string' },
        parentId: { type: 'string' },
        connectedTo: { type: 'string' },
        tone: { type: 'string', enum: ['blue', 'red', 'green', 'amber', 'violet'] },
        x: { type: 'number' },
        y: { type: 'number' },
        radius: { type: 'number' },
        minRadius: { type: 'number' },
        shapeType: { type: 'string', enum: ['circle', 'wavy', 'polygon'] },
        sides: { type: 'number' },
        amplitude: { type: 'number' },
      },
      required: ['circleId'],
    },
  },
  {
    name: 'delete_circle',
    description: 'Delete a circle. Its child circles/people are promoted to its parent circle.',
    inputSchema: {
      type: 'object',
      properties: {
        circleId: { type: 'string' },
      },
      required: ['circleId'],
    },
  },
  {
    name: 'upload_avatar',
    description: 'Upload/set a photo or avatar for a person or circle (accepts Base64 image data or URL).',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['person', 'circle'], description: 'Whether it is a person or a circle.' },
        id: { type: 'string', description: 'The ID of the person or circle.' },
        imageUrl: { type: 'string', description: 'Base64 image string (with or without MIME prefix) or a URL.' },
      },
      required: ['type', 'id', 'imageUrl'],
    },
  },
]

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function textResult(value) {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
  }
}

async function callTool(name, args = {}) {
  switch (name) {
    case 'search_people_and_circles':
      return textResult(await search(args.query, args.limit ?? 10))
    case 'list_circles':
      return textResult(await listCircles())
    case 'create_person': {
      const meta = await getMeta()
      return textResult(await createPerson({ expectedRevision: meta.revision, ...args }))
    }
    case 'add_note': {
      const meta = await getMeta()
      return textResult(await addNote(args.personId, { expectedRevision: meta.revision, title: args.title, body: args.body }))
    }
    case 'add_link': {
      const meta = await getMeta()
      return textResult(await addLink(args.personId, { expectedRevision: meta.revision, service: args.service, url: args.url, label: args.label }))
    }
    case 'create_connection': {
      const meta = await getMeta()
      return textResult(await createConnection({ expectedRevision: meta.revision, fromId: args.fromId, toId: args.toId }))
    }
    case 'import_linkedin_person': {
      const meta = await getMeta()
      return textResult(await importLinkedInPerson({ expectedRevision: meta.revision, url: args.url }))
    }
    case 'delete_person': {
      const meta = await getMeta()
      return textResult(await deletePerson(args.personId, { expectedRevision: meta.revision }))
    }
    case 'delete_note': {
      const meta = await getMeta()
      return textResult(await deleteNote(args.personId, args.noteId, { expectedRevision: meta.revision }))
    }
    case 'delete_link': {
      const meta = await getMeta()
      return textResult(await deleteLink(args.personId, args.linkId, { expectedRevision: meta.revision }))
    }
    case 'delete_connection': {
      const meta = await getMeta()
      return textResult(await deleteConnection(args.connectionId, { expectedRevision: meta.revision }))
    }
    case 'export_graph':
      return textResult(await exportGraph())
    case 'import_graph': {
      const meta = await getMeta()
      return textResult(await importGraph({ graph: args.graph, expectedRevision: meta.revision }))
    }
    case 'clear_graph': {
      const meta = await getMeta()
      return textResult(await clearGraph({ expectedRevision: meta.revision }))
    }
    case 'create_circle': {
      const meta = await getMeta()
      return textResult(await createCircle({ expectedRevision: meta.revision, ...args }))
    }
    case 'update_circle': {
      const meta = await getMeta()
      const { circleId, ...rest } = args
      return textResult(await updateCircle(circleId, { expectedRevision: meta.revision, ...rest }))
    }
    case 'delete_circle': {
      const meta = await getMeta()
      return textResult(await deleteCircle(args.circleId, { expectedRevision: meta.revision }))
    }
    case 'upload_avatar': {
      const meta = await getMeta()
      return textResult(await uploadAvatar(args.type, args.id, args.imageUrl, meta.revision))
    }
    default:
      throw new Error(`Unknown tool: ${name}`)
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
  const request = JSON.parse(line)
  try {
    if (request.method === 'initialize') {
      send({
        jsonrpc: '2.0',
        id: request.id,
        result: {
          protocolVersion: request.params?.protocolVersion ?? '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'datanode-mcp', version: '0.1.0' },
        },
      })
      return
    }
    if (request.method === 'tools/list') {
      send({ jsonrpc: '2.0', id: request.id, result: { tools } })
      return
    }
    if (request.method === 'tools/call') {
      const result = await callTool(request.params?.name, request.params?.arguments ?? {})
      send({ jsonrpc: '2.0', id: request.id, result })
      return
    }
    if (request.id !== undefined) send({ jsonrpc: '2.0', id: request.id, result: {} })
  } catch (error) {
    send({
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32000, message: error instanceof Error ? error.message : String(error) },
    })
  }
}
