#!/usr/bin/env node

import { addLink, addNote, createConnection, createPerson, getMeta, listCircles, search } from './datanode-api-client.mjs'

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
