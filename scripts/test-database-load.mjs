import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const productionEnv = dotenv.parse(
  fs.existsSync(path.join(repoRoot, '.env.production'))
    ? fs.readFileSync(path.join(repoRoot, '.env.production'))
    : ''
)

dotenv.config({ path: path.join(repoRoot, '.env.local') })

function parseArgs(argv) {
  const args = {
    people: 3000,
    connections: 3000,
    companies: 60,
    write: false,
    cleanup: false,
    runId: `load-${new Date().toISOString().replace(/[:.]/g, '-')}`,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    const next = argv[index + 1]

    if (token === '--people' && next) {
      args.people = Number.parseInt(next, 10)
      index += 1
    } else if (token === '--connections' && next) {
      args.connections = Number.parseInt(next, 10)
      index += 1
    } else if (token === '--companies' && next) {
      args.companies = Number.parseInt(next, 10)
      index += 1
    } else if (token === '--run-id' && next) {
      args.runId = next
      index += 1
    } else if (token === '--write') {
      args.write = true
    } else if (token === '--cleanup') {
      args.cleanup = true
    }
  }

  return args
}

function assertPositiveInteger(name, value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`)
  }
}

function makeCircle(id, name, x, y, radius, connectedTo = 'you') {
  return {
    id,
    name,
    icon: name.slice(0, 2).toUpperCase(),
    x,
    y,
    radius,
    minRadius: radius,
    parentId: null,
    connectedTo,
    tone: 'blue',
    fillMode: 'transparent',
    shapeType: 'circle',
    shapeCustom: false,
    sides: 25,
    amplitude: 0,
  }
}

function buildSyntheticGraph({ people, connections, companies, runId }) {
  const circles = [makeCircle('you', 'You', 0, 0, 104, null)]
  const personRows = []
  const connectionRows = []
  const companyCount = Math.max(1, companies)
  const radius = 760

  for (let index = 0; index < companyCount; index += 1) {
    const angle = (index / companyCount) * Math.PI * 2
    circles.push(
      makeCircle(
        `load-company-${runId}-${index}`,
        `Load Company ${index + 1}`,
        Math.round(Math.cos(angle) * radius),
        Math.round(Math.sin(angle) * radius),
        120
      )
    )
  }

  for (let index = 0; index < people; index += 1) {
    const companyIndex = index % companyCount
    const companyCircle = circles[companyIndex + 1]
    const membersInCompany = Math.ceil(people / companyCount)
    const localIndex = Math.floor(index / companyCount)
    const angle = (localIndex / membersInCompany) * Math.PI * 2
    const ring = 34 + Math.floor(localIndex / 36) * 18

    personRows.push({
      id: `load-person-${runId}-${index}`,
      name: `Load Person ${index + 1}`,
      x: Math.round(companyCircle.x + Math.cos(angle) * ring),
      y: Math.round(companyCircle.y + Math.sin(angle) * ring),
      circleId: companyCircle.id,
      avatar: `L${index % 10}`,
      shapeType: 'circle',
      sides: 10,
      amplitude: 0,
      links: [
        {
          id: `load-linkedin-${runId}-${index}`,
          service: 'linkedin',
          label: 'LinkedIn',
          url: `https://www.linkedin.com/in/load-person-${runId}-${index}`,
        },
      ],
      notes: [
        {
          id: `load-note-${runId}-${index}`,
          title: 'Import source',
          body: `Synthetic database load test ${runId}`,
        },
      ],
    })
  }

  for (let index = 0; index < connections && personRows.length > 1; index += 1) {
    const from = personRows[index % personRows.length]
    const to = personRows[(index * 37 + 17) % personRows.length]
    if (from.id === to.id) continue
    connectionRows.push({
      id: `load-connection-${runId}-${index}`,
      fromId: from.id,
      toId: to.id,
    })
  }

  return {
    circles,
    people: personRows,
    connections: connectionRows,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  assertPositiveInteger('--people', args.people)
  assertPositiveInteger('--connections', args.connections)
  assertPositiveInteger('--companies', args.companies)

  const graph = buildSyntheticGraph(args)
  const serialized = JSON.stringify(graph)
  const summary = {
    runId: args.runId,
    people: graph.people.length,
    circles: graph.circles.length,
    connections: graph.connections.length,
    jsonBytes: Buffer.byteLength(serialized),
    write: args.write,
  }

  if (!args.write) {
    console.log(JSON.stringify({ ...summary, mode: 'dry-run' }, null, 2))
    return
  }

  const supabaseUrl = process.env.HACKATHON_LOAD_TEST_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey =
    process.env.HACKATHON_LOAD_TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  const productionUrl = productionEnv.VITE_SUPABASE_URL

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing load-test Supabase URL or service-role key for database load testing.')
  }

  if (productionUrl && supabaseUrl === productionUrl) {
    throw new Error('Refusing to run database load test against .env.production Supabase URL.')
  }

  if (process.env.HACKATHON_ALLOW_DATABASE_LOAD_TEST !== 'true') {
    throw new Error('Set HACKATHON_ALLOW_DATABASE_LOAD_TEST=true to write load-test data.')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
  const email = `load-test+${args.runId}@example.invalid`
  const password = `load-test-${args.runId}-${crypto.randomUUID()}`
  const startedAt = performance.now()
  let userId = ''

  try {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { load_test_run_id: args.runId },
    })
    if (createError) throw createError
    if (!created.user?.id) throw new Error('Supabase did not return a created user id.')
    userId = created.user.id

    const writeStart = performance.now()
    const { error: upsertError } = await supabase
      .from('user_graphs')
      .upsert({ user_id: userId, graph }, { onConflict: 'user_id' })
    if (upsertError) throw upsertError

    const { data: saved, error: readError } = await supabase
      .from('user_graphs')
      .select('graph')
      .eq('user_id', userId)
      .single()
    if (readError) throw readError

    const readGraph = saved.graph
    if (!Array.isArray(readGraph?.people) || readGraph.people.length !== graph.people.length) {
      throw new Error('Persisted graph people count did not match the generated payload.')
    }

    console.log(
      JSON.stringify(
        {
          ...summary,
          mode: 'write',
          userId,
          email,
          writeMs: Math.round(performance.now() - writeStart),
          totalMs: Math.round(performance.now() - startedAt),
        },
        null,
        2
      )
    )
  } finally {
    if (args.cleanup && userId) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
      if (deleteError) throw deleteError
      console.log(JSON.stringify({ cleanup: 'deleted-auth-user', userId }, null, 2))
    } else if (userId) {
      console.log(JSON.stringify({ cleanup: 'skipped', userId }, null, 2))
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
