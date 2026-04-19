import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(repoRoot, '.env.local') })
dotenv.config({ path: path.join(repoRoot, '.env.mcp.local'), override: true })

const SUPABASE_URL =
  process.env.HACKATHON_MCP_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.HACKATHON_MCP_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing Supabase configuration. Expected .env.mcp.local with HACKATHON_MCP_SUPABASE_URL and HACKATHON_MCP_SUPABASE_SERVICE_ROLE_KEY.'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const firstNames = [
  'Ava',
  'Milo',
  'Nora',
  'Felix',
  'Lina',
  'Erik',
  'Zara',
  'Theo',
  'Maya',
  'Owen',
  'Ella',
  'Luca',
  'Ivy',
  'Hugo',
  'Alma',
  'Niko',
  'Lea',
  'Roman',
  'Mira',
  'Anton',
  'Sofia',
  'Emil',
  'Clara',
  'Jonas',
  'Elin',
]

const lastNames = [
  'Hansen',
  'Petrov',
  'Silva',
  'Novak',
  'Rossi',
  'Klein',
  'Meyer',
  'Costa',
  'Berg',
  'Dahl',
  'Weber',
  'Marin',
  'Jensen',
  'Popov',
  'Larsen',
  'Fischer',
  'Ivanov',
  'Santos',
  'Kovac',
  'Lind',
]

function parseArgs(argv) {
  const args = {
    boardId: '',
    count: 100,
    connectCenter: false,
    randomLinks: 0,
    ringStart: 1400,
    ringStep: 180,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    const next = argv[index + 1]

    if (token === '--board-id' && next) {
      args.boardId = next
      index += 1
      continue
    }
    if (token === '--count' && next) {
      args.count = Number.parseInt(next, 10)
      index += 1
      continue
    }
    if (token === '--random-links' && next) {
      args.randomLinks = Number.parseInt(next, 10)
      index += 1
      continue
    }
    if (token === '--ring-start' && next) {
      args.ringStart = Number.parseInt(next, 10)
      index += 1
      continue
    }
    if (token === '--ring-step' && next) {
      args.ringStep = Number.parseInt(next, 10)
      index += 1
      continue
    }
    if (token === '--connect-center') {
      args.connectCenter = true
    }
  }

  return args
}

function buildName(index, existingNameSet) {
  const name = `${firstNames[index % firstNames.length]} ${
    lastNames[Math.floor(index / firstNames.length) % lastNames.length]
  } Seed ${index + 1}`

  if (!existingNameSet.has(name)) {
    existingNameSet.add(name)
    return name
  }

  let suffix = 2
  while (existingNameSet.has(`${name} ${suffix}`)) {
    suffix += 1
  }

  const uniqueName = `${name} ${suffix}`
  existingNameSet.add(uniqueName)
  return uniqueName
}

function pairKey(a, b) {
  return [a, b].sort().join('|')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.boardId) {
    console.error(
      'Usage: npm run seed:board -- --board-id <uuid> [--count 1000] [--connect-center] [--random-links 0]'
    )
    process.exit(1)
  }

  if (!Number.isFinite(args.count) || args.count <= 0) {
    console.error('--count must be a positive integer.')
    process.exit(1)
  }

  const { data: board, error: boardError } = await supabase
    .from('boards')
    .select('id,user_id')
    .eq('id', args.boardId)
    .single()

  if (boardError) {
    throw boardError
  }

  const [{ data: tags, error: tagsError }, { data: people, error: peopleError }] =
    await Promise.all([
      supabase
        .from('tags')
        .select('id')
        .eq('user_id', board.user_id)
        .order('created_at', { ascending: true }),
      supabase
        .from('people')
        .select('id,name,is_root,created_at')
        .eq('board_id', board.id)
        .order('created_at', { ascending: true }),
    ])

  if (tagsError) {
    throw tagsError
  }

  if (peopleError) {
    throw peopleError
  }

  const rootPerson = people.find((person) => person.is_root)
  if (args.connectCenter && !rootPerson) {
    throw new Error('Could not find the root person for the board.')
  }

  const tagIds = tags.map((tag) => tag.id)
  const existingNameSet = new Set(people.map((person) => person.name))
  const startIndex = people.length
  const rows = []
  const pointsPerRing = 36

  for (let index = 0; index < args.count; index += 1) {
    const absoluteIndex = startIndex + index
    const ring = Math.floor(index / pointsPerRing)
    const positionInRing = index % pointsPerRing
    const angle = (positionInRing / pointsPerRing) * Math.PI * 2
    const radius = args.ringStart + ring * args.ringStep
    const jitterX = ((index * 17) % 5) * 16
    const jitterY = ((index * 29) % 7) * 12

    rows.push({
      board_id: board.id,
      owner_user_id: board.user_id,
      name: buildName(absoluteIndex, existingNameSet),
      tag_id: tagIds.length > 0 ? tagIds[index % tagIds.length] : null,
      x: Math.round(Math.cos(angle) * radius + jitterX),
      y: Math.round(Math.sin(angle) * radius + jitterY),
    })
  }

  const { data: insertedPeople, error: insertPeopleError } = await supabase
    .from('people')
    .insert(rows)
    .select('id,name')

  if (insertPeopleError) {
    throw insertPeopleError
  }

  let insertedConnections = 0
  if (args.connectCenter || args.randomLinks > 0) {
    const { data: existingConnections, error: connectionFetchError } =
      await supabase
        .from('connections')
        .select('person_a_id,person_b_id')
        .eq('board_id', board.id)

    if (connectionFetchError) {
      throw connectionFetchError
    }

    const existingPairs = new Set(
      existingConnections.map((connection) =>
        pairKey(connection.person_a_id, connection.person_b_id)
      )
    )
    const connectionRows = []

    if (args.connectCenter && rootPerson) {
      for (const person of insertedPeople) {
        const key = pairKey(rootPerson.id, person.id)
        if (existingPairs.has(key)) {
          continue
        }

        existingPairs.add(key)
        const [person_a_id, person_b_id] = [rootPerson.id, person.id].sort()
        connectionRows.push({
          board_id: board.id,
          owner_user_id: board.user_id,
          person_a_id,
          person_b_id,
        })
      }
    }

    if (args.randomLinks > 0) {
      const insertedIds = insertedPeople.map((person) => person.id)
      let cursor = 0
      while (
        connectionRows.length < insertedConnections + args.randomLinks &&
        cursor < args.randomLinks * 50
      ) {
        const firstIndex = cursor % insertedIds.length
        const secondIndex = (cursor * 37 + 17) % insertedIds.length
        cursor += 1

        if (firstIndex === secondIndex) {
          continue
        }

        const firstId = insertedIds[firstIndex]
        const secondId = insertedIds[secondIndex]
        const key = pairKey(firstId, secondId)
        if (existingPairs.has(key)) {
          continue
        }

        existingPairs.add(key)
        const [person_a_id, person_b_id] = [firstId, secondId].sort()
        connectionRows.push({
          board_id: board.id,
          owner_user_id: board.user_id,
          person_a_id,
          person_b_id,
        })
      }
    }

    if (connectionRows.length > 0) {
      const { error: insertConnectionsError } = await supabase
        .from('connections')
        .insert(connectionRows)

      if (insertConnectionsError) {
        throw insertConnectionsError
      }

      insertedConnections = connectionRows.length
    }
  }

  const [{ count: totalPeople, error: totalPeopleError }, { count: totalConnections, error: totalConnectionsError }] =
    await Promise.all([
      supabase
        .from('people')
        .select('*', { count: 'exact', head: true })
        .eq('board_id', board.id),
      supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .eq('board_id', board.id),
    ])

  if (totalPeopleError) {
    throw totalPeopleError
  }

  if (totalConnectionsError) {
    throw totalConnectionsError
  }

  console.log(
    JSON.stringify(
      {
        boardId: board.id,
        insertedPeople: insertedPeople.length,
        insertedConnections,
        totalPeople,
        totalConnections,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
