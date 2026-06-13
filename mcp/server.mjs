import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { config as loadDotEnv } from 'dotenv'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createClient } from '@supabase/supabase-js'
import * as z from 'zod/v4'

const serverVersion = '0.1.0'
const fileDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(fileDir, '..')
const hexColorPattern = /^#[0-9A-Fa-f]{6}$/
const emptyRowsResult = { data: [], error: null }

for (const envPath of [
  resolve(repoRoot, '.env.mcp.local'),
  resolve(repoRoot, '.env.local'),
  resolve(repoRoot, '.env'),
]) {
  loadDotEnv({ path: envPath, override: false, quiet: true })
}

const server = new McpServer(
  {
    name: 'hackathon-board',
    version: serverVersion,
  },
  {
    capabilities: {
      logging: {},
    },
  },
)

let adminClient = null

function getConfig() {
  return {
    supabaseUrl: process.env.HACKATHON_MCP_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    serviceRoleKey:
      process.env.HACKATHON_MCP_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  }
}

function getSetupStatus() {
  const config = getConfig()

  return {
    repo_root: repoRoot,
    data_tools_available: Boolean(config.supabaseUrl && config.serviceRoleKey),
    has_supabase_url: Boolean(config.supabaseUrl),
    has_service_role_key: Boolean(config.serviceRoleKey),
    url_source: process.env.HACKATHON_MCP_SUPABASE_URL
      ? 'HACKATHON_MCP_SUPABASE_URL'
      : process.env.VITE_SUPABASE_URL
        ? 'VITE_SUPABASE_URL'
        : null,
    service_role_source: process.env.HACKATHON_MCP_SUPABASE_SERVICE_ROLE_KEY
      ? 'HACKATHON_MCP_SUPABASE_SERVICE_ROLE_KEY'
      : process.env.SUPABASE_SERVICE_ROLE_KEY
        ? 'SUPABASE_SERVICE_ROLE_KEY'
        : null,
  }
}

function getMissingConfigMessage() {
  return [
    'Board data tools require a Supabase service-role connection.',
    'Add HACKATHON_MCP_SUPABASE_URL (or rely on VITE_SUPABASE_URL) and HACKATHON_MCP_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY) in .env.mcp.local.',
    'Static project documentation resources stay available without those variables.',
  ].join(' ')
}

function getAdminClient() {
  if (adminClient) {
    return adminClient
  }

  const config = getConfig()

  if (!config.supabaseUrl || !config.serviceRoleKey) {
    throw new Error(getMissingConfigMessage())
  }

  adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return adminClient
}

function toJsonText(value) {
  return JSON.stringify(value, null, 2)
}

function normalizeName(name) {
  return name.trim().replace(/\s+/g, ' ')
}

function normalizeOptionalName(name) {
  if (name === undefined) return undefined

  return normalizeName(name)
}

function canonicalizeConnection(firstPersonId, secondPersonId) {
  return firstPersonId < secondPersonId
    ? { personAId: firstPersonId, personBId: secondPersonId }
    : { personAId: secondPersonId, personBId: firstPersonId }
}

function successResult(summary, data) {
  return {
    content: [
      {
        type: 'text',
        text: `${summary}\n\n${toJsonText(data)}`,
      },
    ],
    structuredContent: data,
  }
}

function errorResult(error) {
  const message = error instanceof Error ? error.message : 'Unexpected MCP server error.'

  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: message,
      },
    ],
  }
}

async function readRepoMarkdown(relativePath) {
  return readFile(resolve(repoRoot, relativePath), 'utf8')
}

async function readStaticResource(uri, relativePath) {
  return {
    contents: [
      {
        uri,
        mimeType: 'text/markdown',
        text: await readRepoMarkdown(relativePath),
      },
    ],
  }
}

async function maybeSingle(query, notFoundMessage) {
  const { data, error } = await query.maybeSingle()

  if (error) throw error
  if (!data) throw new Error(notFoundMessage)

  return data
}

async function getBoard(client, boardId) {
  return maybeSingle(client.from('boards').select('*').eq('id', boardId), `Board ${boardId} was not found.`)
}

async function getProfile(client, profileId) {
  const { data, error } = await client.from('profiles').select('*').eq('id', profileId).maybeSingle()

  if (error) throw error

  return data
}

async function getPerson(client, personId) {
  return maybeSingle(client.from('people').select('*').eq('id', personId), `Person ${personId} was not found.`)
}

async function getTag(client, tagId) {
  return maybeSingle(client.from('tags').select('*').eq('id', tagId), `Tag ${tagId} was not found.`)
}

async function getNote(client, noteId) {
  return maybeSingle(client.from('notes').select('*').eq('id', noteId), `Note ${noteId} was not found.`)
}

async function listBoards(query = '') {
  const client = getAdminClient()
  const { data: boards, error: boardsError } = await client
    .from('boards')
    .select('*')
    .order('created_at', { ascending: true })

  if (boardsError) throw boardsError

  const userIds = [...new Set((boards ?? []).map((board) => board.user_id))]
  const profilesResult =
    userIds.length > 0
      ? await client.from('profiles').select('*').in('id', userIds)
      : emptyRowsResult

  if (profilesResult.error) throw profilesResult.error

  const profilesById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]))
  const normalizedQuery = query.trim().toLowerCase()

  return (boards ?? [])
    .map((board) => ({
      ...board,
      owner_profile: profilesById.get(board.user_id) ?? null,
    }))
    .filter((board) => {
      if (!normalizedQuery) return true

      const searchableText = [
        board.title,
        board.owner_profile?.display_name,
        board.owner_profile?.email,
        board.user_id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchableText.includes(normalizedQuery)
    })
}

async function loadBoardGraph(boardId) {
  const client = getAdminClient()
  const board = await getBoard(client, boardId)

  const [ownerProfile, tagsResult, peopleResult, connectionsResult] = await Promise.all([
    getProfile(client, board.user_id),
    client.from('tags').select('*').eq('user_id', board.user_id).order('created_at', { ascending: true }),
    client
      .from('people')
      .select('*')
      .eq('board_id', board.id)
      .order('is_root', { ascending: false })
      .order('created_at', { ascending: true }),
    client.from('connections').select('*').eq('board_id', board.id).order('created_at', { ascending: true }),
  ])

  if (tagsResult.error) throw tagsResult.error
  if (peopleResult.error) throw peopleResult.error
  if (connectionsResult.error) throw connectionsResult.error

  const people = peopleResult.data ?? []
  const personIds = people.map((person) => person.id)

  const [notesResult, personAiNotesResult] =
    personIds.length > 0
      ? await Promise.all([
          client.from('notes').select('*').in('person_id', personIds).order('created_at', { ascending: true }),
          client
            .from('person_ai_notes')
            .select('*')
            .in('person_id', personIds)
            .order('created_at', { ascending: true }),
        ])
      : [emptyRowsResult, emptyRowsResult]

  if (notesResult.error) throw notesResult.error
  if (personAiNotesResult.error) throw personAiNotesResult.error

  return {
    board,
    owner_profile: ownerProfile,
    tags: tagsResult.data ?? [],
    people,
    notes: notesResult.data ?? [],
    person_ai_notes: personAiNotesResult.data ?? [],
    connections: connectionsResult.data ?? [],
  }
}

async function loadPersonContext(personId) {
  const client = getAdminClient()
  const person = await getPerson(client, personId)

  const [board, tag, notesResult, personAiNoteResult, connectionsResult] = await Promise.all([
    getBoard(client, person.board_id),
    person.tag_id ? getTag(client, person.tag_id) : Promise.resolve(null),
    client.from('notes').select('*').eq('person_id', person.id).order('created_at', { ascending: true }),
    client.from('person_ai_notes').select('*').eq('person_id', person.id).maybeSingle(),
    client
      .from('connections')
      .select('*')
      .eq('board_id', person.board_id)
      .or(`person_a_id.eq.${person.id},person_b_id.eq.${person.id}`)
      .order('created_at', { ascending: true }),
  ])

  if (notesResult.error) throw notesResult.error
  if (personAiNoteResult.error) throw personAiNoteResult.error
  if (connectionsResult.error) throw connectionsResult.error

  return {
    board,
    person,
    tag,
    notes: notesResult.data ?? [],
    person_ai_note: personAiNoteResult.data ?? null,
    connections: connectionsResult.data ?? [],
  }
}

async function listTags(boardId) {
  const client = getAdminClient()
  const board = await getBoard(client, boardId)
  const { data, error } = await client
    .from('tags')
    .select('*')
    .eq('user_id', board.user_id)
    .order('created_at', { ascending: true })

  if (error) throw error

  return {
    board_id: board.id,
    owner_user_id: board.user_id,
    tags: data ?? [],
  }
}

async function createTag({ board_id: boardId, name, color }) {
  const client = getAdminClient()
  const board = await getBoard(client, boardId)
  const payload = {
    user_id: board.user_id,
    name: normalizeName(name),
    ...(color ? { color } : {}),
  }

  const { data, error } = await client.from('tags').insert(payload).select('*').single()

  if (error) throw error

  return data
}

async function updateTag({ tag_id: tagId, name, color }) {
  const client = getAdminClient()
  const updates = {}

  if (name !== undefined) {
    updates.name = normalizeName(name)
  }

  if (color !== undefined) {
    updates.color = color
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('Provide at least one tag field to update.')
  }

  const { data, error } = await client.from('tags').update(updates).eq('id', tagId).select('*').single()

  if (error) throw error

  return data
}

async function deleteTag({ tag_id: tagId }) {
  const client = getAdminClient()
  await getTag(client, tagId)

  const { error } = await client.from('tags').delete().eq('id', tagId)

  if (error) throw error

  return { deleted_tag_id: tagId }
}

async function createPerson({ board_id: boardId, name, x, y, tag_id: tagId }) {
  const client = getAdminClient()
  const board = await getBoard(client, boardId)
  const { data, error } = await client
    .from('people')
    .insert({
      board_id: board.id,
      owner_user_id: board.user_id,
      name: normalizeName(name),
      tag_id: tagId ?? null,
      x,
      y,
    })
    .select('*')
    .single()

  if (error) throw error

  return data
}

async function updatePerson({ person_id: personId, name, tag_id: tagId }) {
  const client = getAdminClient()
  const updates = {}
  const normalizedName = normalizeOptionalName(name)

  if (normalizedName !== undefined) {
    updates.name = normalizedName
  }

  if (tagId !== undefined) {
    updates.tag_id = tagId
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('Provide at least one person field to update.')
  }

  const { data, error } = await client.from('people').update(updates).eq('id', personId).select('*').single()

  if (error) throw error

  return data
}

async function movePerson({ person_id: personId, x, y }) {
  const client = getAdminClient()
  const { data, error } = await client.from('people').update({ x, y }).eq('id', personId).select('*').single()

  if (error) throw error

  return data
}

async function deletePerson({ person_id: personId }) {
  const client = getAdminClient()
  await getPerson(client, personId)

  const { error } = await client.from('people').delete().eq('id', personId)

  if (error) throw error

  return { deleted_person_id: personId }
}

async function createConnection({ first_person_id: firstPersonId, second_person_id: secondPersonId }) {
  const client = getAdminClient()
  const firstPerson = await getPerson(client, firstPersonId)
  const { personAId, personBId } = canonicalizeConnection(firstPersonId, secondPersonId)

  const { data, error } = await client
    .from('connections')
    .insert({
      board_id: firstPerson.board_id,
      owner_user_id: firstPerson.owner_user_id,
      person_a_id: personAId,
      person_b_id: personBId,
    })
    .select('*')
    .single()

  if (error?.code === '23505') {
    return maybeSingle(
      client
        .from('connections')
        .select('*')
        .eq('board_id', firstPerson.board_id)
        .eq('person_a_id', personAId)
        .eq('person_b_id', personBId),
      'Connection already exists but could not be loaded.',
    )
  }

  if (error) throw error

  return data
}

async function deleteConnection({ connection_id: connectionId }) {
  const client = getAdminClient()
  await maybeSingle(
    client.from('connections').select('*').eq('id', connectionId),
    `Connection ${connectionId} was not found.`,
  )

  const { error } = await client.from('connections').delete().eq('id', connectionId)

  if (error) throw error

  return { deleted_connection_id: connectionId }
}

async function createNote({ person_id: personId, title, body }) {
  const client = getAdminClient()
  const person = await getPerson(client, personId)
  const { data, error } = await client
    .from('notes')
    .insert({
      person_id: person.id,
      owner_user_id: person.owner_user_id,
      title,
      body,
    })
    .select('*')
    .single()

  if (error) throw error

  return data
}

async function updateNote({ note_id: noteId, title, body }) {
  const client = getAdminClient()
  const updates = {}

  if (title !== undefined) {
    updates.title = title
  }

  if (body !== undefined) {
    updates.body = body
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('Provide at least one note field to update.')
  }

  const { data, error } = await client.from('notes').update(updates).eq('id', noteId).select('*').single()

  if (error) throw error

  return data
}

async function deleteNote({ note_id: noteId }) {
  const client = getAdminClient()
  await getNote(client, noteId)

  const { error } = await client.from('notes').delete().eq('id', noteId)

  if (error) throw error

  return { deleted_note_id: noteId }
}

function registerJsonTool(name, config, handler) {
  server.registerTool(name, config, async (args) => {
    try {
      return await handler(args)
    } catch (error) {
      return errorResult(error)
    }
  })
}

server.registerResource(
  'project-map',
  'hackathon://docs/project-map',
  {
    title: 'Project Map',
    description: 'Current project map and important files.',
    mimeType: 'text/markdown',
  },
  async (uri) => readStaticResource(uri.href, 'docs/PROJECT_MAP.md'),
)

server.registerResource(
  'runbook',
  'hackathon://docs/runbook',
  {
    title: 'Runbook',
    description: 'Setup, verification, and project MCP run instructions.',
    mimeType: 'text/markdown',
  },
  async (uri) => readStaticResource(uri.href, 'docs/RUNBOOK.md'),
)

server.registerResource(
  'architecture',
  'hackathon://docs/architecture',
  {
    title: 'Architecture',
    description: 'Runtime boundaries and project invariants.',
    mimeType: 'text/markdown',
  },
  async (uri) => readStaticResource(uri.href, 'docs/ARCHITECTURE.md'),
)

server.registerResource(
  'mcp-setup',
  'hackathon://mcp/setup',
  {
    title: 'MCP Setup',
    description: 'Project MCP setup status and required environment variables.',
    mimeType: 'application/json',
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: 'application/json',
        text: toJsonText({
          ...getSetupStatus(),
          env_files_checked: ['.env.mcp.local', '.env.local', '.env'],
          missing_config_help: getMissingConfigMessage(),
        }),
      },
    ],
  }),
)

server.registerResource(
  'graph-schema',
  'hackathon://schema/graph-model',
  {
    title: 'Graph Schema',
    description: 'High-level schema and MCP assumptions for the board graph.',
    mimeType: 'text/markdown',
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: 'text/markdown',
        text: [
          '# Hackathon Graph Schema',
          '',
          'Primary tables:',
          '- `profiles`: user profile mirror keyed by auth user id.',
          '- `boards`: one personal board per user.',
          '- `tags`: reusable user-owned labels with a hex color.',
          '- `people`: positioned nodes on a board. Root nodes stay fixed at `0,0`.',
          '- `notes`: free-form notes attached to a person.',
          '- `connections`: undirected edges between two people on the same board.',
          '- `person_ai_notes`: one AI summary row per person.',
          '',
          'Project MCP assumptions:',
          '- Data tools use a Supabase service-role key on the local machine.',
          '- The server never exposes service-role secrets to the browser.',
          '- Board graph reads return tags, people, notes, AI notes, and connections together.',
          '- Mutation tools rely on the existing database triggers and constraints for integrity.',
        ].join('\n'),
      },
    ],
  }),
)

server.registerResource(
  'board-graph-resource',
  new ResourceTemplate('hackathon://boards/{boardId}/graph', { list: undefined }),
  {
    title: 'Board Graph',
    description: 'Full board graph payload for a specific board.',
    mimeType: 'application/json',
  },
  async (uri, { boardId }) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: 'application/json',
        text: toJsonText(await loadBoardGraph(boardId)),
      },
    ],
  }),
)

server.registerResource(
  'person-context-resource',
  new ResourceTemplate('hackathon://people/{personId}', { list: undefined }),
  {
    title: 'Person Context',
    description: 'Person details with notes, AI note, and direct connections.',
    mimeType: 'application/json',
  },
  async (uri, { personId }) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: 'application/json',
        text: toJsonText(await loadPersonContext(personId)),
      },
    ],
  }),
)

registerJsonTool(
  'list-boards',
  {
    title: 'List Boards',
    description: 'List personal boards together with owner profile information.',
    inputSchema: {
      query: z
        .string()
        .optional()
        .describe('Optional case-insensitive filter across board title, email, or display name.'),
    },
  },
  async ({ query }) => {
    const boards = await listBoards(query)
    return successResult(`Loaded ${boards.length} board(s).`, { boards })
  },
)

registerJsonTool(
  'get-board-graph',
  {
    title: 'Get Board Graph',
    description: 'Load the full board graph, including people, tags, notes, AI notes, and connections.',
    inputSchema: {
      board_id: z.string().uuid().describe('Board id from list-boards or boards table.'),
    },
  },
  async ({ board_id: boardId }) => {
    const graph = await loadBoardGraph(boardId)
    return successResult(
      `Loaded board ${graph.board.title} with ${graph.people.length} people and ${graph.connections.length} connections.`,
      graph,
    )
  },
)

registerJsonTool(
  'get-person-context',
  {
    title: 'Get Person Context',
    description: 'Load one person with notes, AI note, tag, and direct connections.',
    inputSchema: {
      person_id: z.string().uuid().describe('Person id from a board graph payload.'),
    },
  },
  async ({ person_id: personId }) => {
    const personContext = await loadPersonContext(personId)
    return successResult(`Loaded context for ${personContext.person.name || personContext.person.id}.`, personContext)
  },
)

registerJsonTool(
  'list-tags',
  {
    title: 'List Tags',
    description: 'List all reusable tags for the owner of a board.',
    inputSchema: {
      board_id: z.string().uuid().describe('Board id used to resolve the owning user.'),
    },
  },
  async ({ board_id: boardId }) => {
    const result = await listTags(boardId)
    return successResult(`Loaded ${result.tags.length} tag(s) for board ${boardId}.`, result)
  },
)

registerJsonTool(
  'create-tag',
  {
    title: 'Create Tag',
    description: 'Create a reusable tag for the owner of a board.',
    inputSchema: {
      board_id: z.string().uuid().describe('Board id used to resolve the owning user.'),
      name: z.string().trim().min(1).describe('Human-readable tag name.'),
      color: z.string().regex(hexColorPattern).optional().describe('Optional hex color such as #39c795.'),
    },
  },
  async (args) => {
    const tag = await createTag(args)
    return successResult(`Created tag ${tag.name}.`, tag)
  },
)

registerJsonTool(
  'update-tag',
  {
    title: 'Update Tag',
    description: 'Rename a tag and or change its color.',
    inputSchema: {
      tag_id: z.string().uuid().describe('Tag id to update.'),
      name: z.string().trim().min(1).optional().describe('New tag name.'),
      color: z.string().regex(hexColorPattern).optional().describe('New hex color such as #3f7cff.'),
    },
  },
  async (args) => {
    const tag = await updateTag(args)
    return successResult(`Updated tag ${tag.name}.`, tag)
  },
)

registerJsonTool(
  'delete-tag',
  {
    title: 'Delete Tag',
    description: 'Delete a reusable tag. Tagged people keep working because their foreign key is set to null.',
    inputSchema: {
      tag_id: z.string().uuid().describe('Tag id to delete.'),
    },
  },
  async (args) => successResult(`Deleted tag ${args.tag_id}.`, await deleteTag(args)),
)

registerJsonTool(
  'create-person',
  {
    title: 'Create Person',
    description: 'Create a new person node on a board.',
    inputSchema: {
      board_id: z.string().uuid().describe('Board id that will own the new person.'),
      name: z.string().default('').describe('Person name.'),
      tag_id: z.string().uuid().nullable().optional().describe('Optional tag id or null to leave untagged.'),
      x: z.number().describe('Horizontal board coordinate.'),
      y: z.number().describe('Vertical board coordinate.'),
    },
  },
  async (args) => {
    const person = await createPerson(args)
    return successResult(`Created person ${person.name || person.id}.`, person)
  },
)

registerJsonTool(
  'update-person',
  {
    title: 'Update Person',
    description: 'Rename a person and or change their tag.',
    inputSchema: {
      person_id: z.string().uuid().describe('Person id to update.'),
      name: z.string().optional().describe('New person name.'),
      tag_id: z.string().uuid().nullable().optional().describe('New tag id or null to clear the tag.'),
    },
  },
  async (args) => {
    const person = await updatePerson(args)
    return successResult(`Updated person ${person.name || person.id}.`, person)
  },
)

registerJsonTool(
  'move-person',
  {
    title: 'Move Person',
    description: 'Update a person node position. Root-node protection remains enforced in the database.',
    inputSchema: {
      person_id: z.string().uuid().describe('Person id to move.'),
      x: z.number().describe('New horizontal board coordinate.'),
      y: z.number().describe('New vertical board coordinate.'),
    },
  },
  async (args) => {
    const person = await movePerson(args)
    return successResult(`Moved person ${person.name || person.id}.`, person)
  },
)

registerJsonTool(
  'delete-person',
  {
    title: 'Delete Person',
    description: 'Delete a non-root person node. Root-node protection remains enforced in the database.',
    inputSchema: {
      person_id: z.string().uuid().describe('Person id to delete.'),
    },
  },
  async (args) => successResult(`Deleted person ${args.person_id}.`, await deletePerson(args)),
)

registerJsonTool(
  'create-connection',
  {
    title: 'Create Connection',
    description: 'Create an undirected connection between two people on the same board.',
    inputSchema: {
      first_person_id: z.string().uuid().describe('First person id.'),
      second_person_id: z.string().uuid().describe('Second person id.'),
    },
  },
  async (args) => {
    const connection = await createConnection(args)
    return successResult(`Created or reused connection ${connection.id}.`, connection)
  },
)

registerJsonTool(
  'delete-connection',
  {
    title: 'Delete Connection',
    description: 'Delete an undirected connection.',
    inputSchema: {
      connection_id: z.string().uuid().describe('Connection id to delete.'),
    },
  },
  async (args) => successResult(`Deleted connection ${args.connection_id}.`, await deleteConnection(args)),
)

registerJsonTool(
  'create-note',
  {
    title: 'Create Note',
    description: 'Create a note for one person.',
    inputSchema: {
      person_id: z.string().uuid().describe('Person id that owns the note.'),
      title: z.string().default('').describe('Note title.'),
      body: z.string().default('').describe('Note body.'),
    },
  },
  async (args) => {
    const note = await createNote(args)
    return successResult(`Created note ${note.id}.`, note)
  },
)

registerJsonTool(
  'update-note',
  {
    title: 'Update Note',
    description: 'Update a note title and or body.',
    inputSchema: {
      note_id: z.string().uuid().describe('Note id to update.'),
      title: z.string().optional().describe('New note title.'),
      body: z.string().optional().describe('New note body.'),
    },
  },
  async (args) => {
    const note = await updateNote(args)
    return successResult(`Updated note ${note.id}.`, note)
  },
)

registerJsonTool(
  'delete-note',
  {
    title: 'Delete Note',
    description: 'Delete a note by id.',
    inputSchema: {
      note_id: z.string().uuid().describe('Note id to delete.'),
    },
  },
  async (args) => successResult(`Deleted note ${args.note_id}.`, await deleteNote(args)),
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[hackathon-board MCP] ready')
}

main().catch((error) => {
  console.error('[hackathon-board MCP] fatal error', error)
  process.exit(1)
})
