import http from 'node:http'
import { spawn } from 'node:child_process'
import process from 'node:process'

import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js'

function parseArgs(argv) {
  const args = {
    people: 120,
    companies: 12,
    appPort: 4188,
    mockPort: 54321,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    const next = argv[index + 1]
    if (token === '--people' && next) {
      args.people = Number.parseInt(next, 10)
      index += 1
    } else if (token === '--companies' && next) {
      args.companies = Number.parseInt(next, 10)
      index += 1
    } else if (token === '--app-port' && next) {
      args.appPort = Number.parseInt(next, 10)
      index += 1
    } else if (token === '--mock-port' && next) {
      args.mockPort = Number.parseInt(next, 10)
      index += 1
    }
  }

  return args
}

function jsonResponse(response, status, payload) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'accept-profile, authorization, content-profile, content-type, apikey, prefer, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  })
  response.end(JSON.stringify(payload))
}

async function readBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  assertPostgresJsonbSafeBody(text)
  return text ? JSON.parse(text) : {}
}

function assertPostgresJsonbSafeBody(text) {
  const lower = text.toLowerCase()
  if (lower.includes('\\u0000') || lower.includes('\\ud800')) {
    const error = new Error('Empty or invalid json')
    error.code = 'PGRST102'
    throw error
  }
}

function startMockGraphApi({ port }) {
  const state = {
    graph: null,
    revision: null,
    writes: 0,
    reads: 0,
    metaReads: 0,
    restReads: 0,
    restWrites: 0,
    failGraphReads: 0,
    failGraphWrites: 0,
    graphConflictIncludesRevision: true,
    enrichmentRequests: [],
  }

  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === 'OPTIONS') {
        jsonResponse(response, 200, { ok: true })
        return
      }

      const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)
      const isGraphRoute = url.pathname === '/functions/v1/graph-api/v1/graph'
      const isGraphMetaRoute = url.pathname === '/functions/v1/graph-api/v1/graph/meta'
      const isLinkedInArchiveEnrichmentRoute = url.pathname === '/functions/v1/enrich-linkedin-archive'
      const isRestGraphRoute = url.pathname === '/rest/v1/user_graphs'
      if (!isGraphRoute && !isGraphMetaRoute && !isRestGraphRoute && !isLinkedInArchiveEnrichmentRoute) {
        jsonResponse(response, 404, { error: `Unhandled mock route: ${request.method} ${url.pathname}` })
        return
      }

      if (request.method === 'POST' && isLinkedInArchiveEnrichmentRoute) {
        const body = await readBody(request)
        state.enrichmentRequests.push(body)
        jsonResponse(response, 200, { notes: [] })
        return
      }

      if (isRestGraphRoute) {
        if (request.method === 'GET') {
          state.restReads += 1
          jsonResponse(response, 200, state.revision === null ? [] : [{ revision: state.revision }])
          return
        }

        if (request.method === 'POST') {
          const body = await readBody(request)
          if (state.revision !== null) {
            jsonResponse(response, 409, {
              code: '23505',
              message: 'duplicate key value violates unique constraint "user_graphs_pkey"',
            })
            return
          }
          if (!body || typeof body !== 'object' || !isGraphState(body.graph)) {
            jsonResponse(response, 400, { error: 'Invalid graph.' })
            return
          }
          state.graph = body.graph
          state.revision = 1
          state.restWrites += 1
          jsonResponse(response, 201, [{ revision: state.revision }])
          return
        }

        if (request.method === 'PATCH') {
          const body = await readBody(request)
          const expectedRevision = Number(String(url.searchParams.get('revision') ?? '').replace(/^eq\./, ''))
          if (!body || typeof body !== 'object' || !isGraphState(body.graph)) {
            jsonResponse(response, 400, { error: 'Invalid graph.' })
            return
          }
          if (!Number.isFinite(expectedRevision) || expectedRevision !== state.revision) {
            jsonResponse(response, 200, [])
            return
          }

          state.graph = body.graph
          state.revision += 1
          state.restWrites += 1
          jsonResponse(response, 200, [{ revision: state.revision }])
          return
        }
      }

      if (request.method === 'GET' && isGraphMetaRoute) {
        state.metaReads += 1
        jsonResponse(response, 200, {
          revision: state.revision,
          counts: {
            circles: state.graph?.circles?.length ?? 0,
            people: state.graph?.people?.length ?? 0,
            connections: state.graph?.connections?.length ?? 0,
          },
        })
        return
      }

      if (request.method === 'GET') {
        state.reads += 1
        if (state.failGraphReads > 0) {
          state.failGraphReads -= 1
          jsonResponse(response, 500, { error: 'Simulated graph load failure.' })
          return
        }
        jsonResponse(response, 200, { graph: state.graph, revision: state.revision })
        return
      }

      if (request.method === 'PUT') {
        if (state.failGraphWrites > 0) {
          state.failGraphWrites -= 1
          jsonResponse(response, 500, { error: 'Unexpected graph API error.' })
          return
        }

        const body = await readBody(request)
        if (!body || typeof body !== 'object' || !isGraphState(body.graph)) {
          jsonResponse(response, 400, { error: 'Invalid graph.' })
          return
        }
        if (body.expectedRevision !== state.revision) {
          jsonResponse(
            response,
            409,
            state.graphConflictIncludesRevision
              ? { error: 'Revision conflict.', revision: state.revision }
              : { error: 'Revision conflict.' },
          )
          return
        }

        state.graph = body.graph
        state.revision = state.revision === null ? 1 : state.revision + 1
        state.writes += 1
        jsonResponse(response, 200, { graph: state.graph, revision: state.revision })
        return
      }

      jsonResponse(response, 405, { error: `Unsupported method: ${request.method}` })
    } catch (error) {
      if (error?.code === 'PGRST102') {
        jsonResponse(response, 400, { message: 'Empty or invalid json', code: 'PGRST102' })
        return
      }
      jsonResponse(response, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject)
      resolve({
        state,
        url: `http://127.0.0.1:${port}`,
        stop: () => new Promise((stopResolve) => server.close(stopResolve)),
      })
    })
  })
}

function isGraphState(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      Array.isArray(value.circles) &&
      Array.isArray(value.people) &&
      Array.isArray(value.connections),
  )
}

function csvCell(value) {
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function buildConnectionsCsv({ people, companies }) {
  const rows = [
    ['First Name', 'Last Name', 'URL', 'Email Address', 'Company', 'Position', 'Connected On'],
  ]
  for (let index = 0; index < people; index += 1) {
    const companyNumber = (index % companies) + 1
    rows.push([
      `Persist${index + 1}`,
      `Person${index + 1}`,
      `https://www.linkedin.com/in/persist-person-${index + 1}`,
      `persist.person.${index + 1}@example.invalid`,
      index === 0 ? `Persist Company ${companyNumber}\u0000` : `Persist Company ${companyNumber}`,
      index === 0 ? `Synthetic Position ${index + 1}\uD800` : `Synthetic Position ${index + 1}`,
      '2026-06-14',
    ])
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

function buildSharesCsv() {
  return [
    ['Date', 'Share Commentary'],
    ['2026-06-14', 'Great conversations at #RoyalHacks with builders, founders, and AI engineers.'],
  ].map((row) => row.map(csvCell).join(',')).join('\n')
}

function buildMessagesCsv() {
  const rows = [
    ['CONVERSATION ID', 'FROM', 'TO', 'DATE', 'CONTENT'],
  ]
  for (let index = 0; index < 200; index += 1) {
    rows.push([
      'conversation-1',
      'Persist1 Person1',
      'Me',
      '2026-06-14',
      `Long thread message ${index + 1} about product discovery and follow-up.`,
    ])
  }
  rows.push([
    'conversation-3',
    'Persist3 Person3',
    'Me',
    '2026-06-15',
    'We discussed the roadmap, implementation details, and a concrete follow-up meeting.',
  ])
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

async function buildLinkedInZip(args) {
  const csv = buildConnectionsCsv(args)
  const zipWriter = new ZipWriter(new BlobWriter('application/zip'))
  await zipWriter.add('Connections.csv', new TextReader(csv))
  await zipWriter.add('Shares.csv', new TextReader(buildSharesCsv()))
  await zipWriter.add('messages.csv', new TextReader(buildMessagesCsv()))
  await zipWriter.add('guide_messages.csv', new TextReader('CONVERSATION ID,CONVERSATION TITLE,FROM,SENDER PROFILE URL,TO,RECIPIENT PROFILE URLS,DATE,SUBJECT,CONTENT,FOLDER\n'))
  const blob = await zipWriter.close()
  return Buffer.from(await blob.arrayBuffer())
}

function buildGraphImportFixture() {
  return {
    circles: [
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
      },
      {
        id: 'json-import-circle',
        name: 'JSON Import Circle',
        icon: 'JI',
        x: 280,
        y: 0,
        radius: 120,
        minRadius: 120,
        parentId: null,
        connectedTo: null,
        tone: 'green',
        fillMode: 'transparent',
        shapeType: 'circle',
        shapeCustom: false,
        sides: 25,
        amplitude: 0,
      },
    ],
    people: [
      {
        id: 'json-import-person',
        name: 'JSON Import Person',
        x: 280,
        y: 42,
        circleId: 'json-import-circle',
        avatar: 'JI',
        shapeType: 'circle',
        sides: 10,
        amplitude: 0,
        notes: [],
        links: [],
      },
    ],
    connections: [],
  }
}

async function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Keep waiting for Vite.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function startVite({ appPort, mockUrl }) {
  const url = `http://127.0.0.1:${appPort}`
  const server = spawn(
    'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(appPort), '--strictPort'],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        BROWSER: 'none',
        VITE_SUPABASE_URL: mockUrl,
        VITE_SUPABASE_PUBLISHABLE_KEY: 'local-e2e-publishable-key',
        VITE_E2E_FAKE_AUTH: 'true',
        VITE_E2E_FAKE_USER_ID: 'local-e2e-user',
        VITE_E2E_FAKE_ACCESS_TOKEN: 'local-e2e-token',
      },
    },
  )

  server.stdout.on('data', (chunk) => process.stdout.write(chunk))
  server.stderr.on('data', (chunk) => process.stderr.write(chunk))

  await waitForServer(url)
  return {
    url,
    stop: () => {
      if (!server.killed) server.kill('SIGTERM')
    },
  }
}

async function waitForGraphRead(mock, minReads) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 10000) {
    if (mock.state.reads >= minReads) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for graph read ${minReads}; got ${mock.state.reads}.`)
}

async function uploadAndAcceptDialog(page, locator, file) {
  const dialogPromise = page.waitForEvent('dialog', { timeout: 60000 })
  await locator.setInputFiles(file)
  const dialog = await dialogPromise
  const message = dialog.message()
  await dialog.accept()
  if (!message.includes('successfully')) {
    throw new Error(`Unexpected import dialog: ${message}`)
  }
  return message
}

async function waitForImportedPeople(mock, expectedPeople) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 60000) {
    if (mock.state.graph?.people?.length === expectedPeople) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for ${expectedPeople} imported people; got ${mock.state.graph?.people?.length ?? 0}.`)
}

async function waitForEnrichmentRequest(mock) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 60000) {
    if (mock.state.enrichmentRequests.length > 0) return mock.state.enrichmentRequests[0]
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Timed out waiting for LinkedIn archive enrichment request.')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!Number.isInteger(args.people) || args.people <= 0) throw new Error('--people must be a positive integer.')
  if (!Number.isInteger(args.companies) || args.companies <= 0) throw new Error('--companies must be a positive integer.')

  const playwright = await import('playwright')
  const mock = await startMockGraphApi({ port: args.mockPort })
  const vite = await startVite({ appPort: args.appPort, mockUrl: mock.url })
  const browser = await playwright.chromium.launch({ headless: true })

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.on('console', (message) => {
      if (message.type() === 'error') console.error(message.text())
    })
    page.on('pageerror', (error) => console.error(error))
    await page.addInitScript(() => {
      window.localStorage.clear()
      window.localStorage.setItem('social-board-onboarding-done-v3', '1')
    })

    await page.goto(`${vite.url}/#board`, { waitUntil: 'networkidle' })
    await waitForGraphRead(mock, 1)
    await page.getByLabel('Settings', { exact: true }).click()

    const zipBuffer = await buildLinkedInZip(args)
    await page.locator('input[type="file"][accept=".zip"]').setInputFiles({
      name: 'linkedin-persistence-test.zip',
      mimeType: 'application/zip',
      buffer: zipBuffer,
    })
    await waitForImportedPeople(mock, args.people)
    const enrichmentRequest = await waitForEnrichmentRequest(mock)
    const zipMessage = 'LinkedIn ZIP imported without blocking dialog'

    if (mock.state.graph?.people?.length !== args.people) {
      throw new Error(`ZIP import saved ${mock.state.graph?.people?.length ?? 0} people, expected ${args.people}.`)
    }

    const firstImportedPerson = mock.state.graph?.people?.find((person) => person.id === 'linkedin-person-persist1-person1')
    const eventContext = firstImportedPerson?.notes?.find((note) => note.title === 'Event Context')
    if (!eventContext?.body.includes('RoyalHacks')) {
      throw new Error(`ZIP import did not add deterministic event context from Shares.csv: ${JSON.stringify(firstImportedPerson?.notes ?? [])}.`)
    }
    const thirdPersonMessage = enrichmentRequest.messages?.find((message) =>
      Array.isArray(message.personIds) && message.personIds.includes('linkedin-person-persist3-person3')
    )
    if (!thirdPersonMessage) {
      throw new Error(`Archive AI request did not preserve matched personIds for later long-thread messages: ${JSON.stringify(enrichmentRequest.messages ?? [])}.`)
    }

    const importedCompanyTones = new Set(
      (mock.state.graph?.circles ?? [])
        .filter((circle) => circle.id.startsWith('linkedin-company-'))
        .map((circle) => circle.tone),
    )
    if (importedCompanyTones.size <= 1) {
      throw new Error(`ZIP import used only one LinkedIn company tone: ${JSON.stringify([...importedCompanyTones])}.`)
    }

    const readsBeforeReload = mock.state.reads
    await page.reload({ waitUntil: 'networkidle' })
    await waitForGraphRead(mock, readsBeforeReload + 1)

    if (mock.state.graph?.people?.length !== args.people) {
      throw new Error('ZIP import did not survive reload in mock persistence.')
    }

    await page.getByLabel('Settings', { exact: true }).click()
    const graphImport = buildGraphImportFixture()
    const graphMessage = await uploadAndAcceptDialog(
      page,
      page.locator('input[type="file"][accept="application/json,.json"]'),
      {
        name: 'graph-import-test.json',
        mimeType: 'application/json',
        buffer: Buffer.from(`${JSON.stringify(graphImport)}\n`),
      },
    )

    if (mock.state.graph?.people?.length !== graphImport.people.length) {
      throw new Error(`Graph import saved ${mock.state.graph?.people?.length ?? 0} people, expected ${graphImport.people.length}.`)
    }

    const readsBeforeSecondReload = mock.state.reads
    await page.reload({ waitUntil: 'networkidle' })
    await waitForGraphRead(mock, readsBeforeSecondReload + 1)

    if (mock.state.graph?.people?.[0]?.id !== 'json-import-person') {
      throw new Error('Graph import did not survive reload in mock persistence.')
    }

    mock.state.graph = buildGraphImportFixture()
    mock.state.revision = 10
    mock.state.failGraphReads = 2
    mock.state.graphConflictIncludesRevision = false
    const metaReadsBeforeConflictRecovery = mock.state.metaReads
    const failedLoadPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await failedLoadPage.addInitScript(() => {
      window.localStorage.clear()
      window.localStorage.setItem('social-board-onboarding-done-v3', '1')
    })
    await failedLoadPage.goto(`${vite.url}/#board`, { waitUntil: 'networkidle' })
    await failedLoadPage.getByLabel('Settings', { exact: true }).waitFor({ timeout: 10000 })
    await failedLoadPage.getByLabel('Settings', { exact: true }).click()
    const replacementGraph = buildGraphImportFixture()
    replacementGraph.people[0].id = 'replaced-after-load-failure'
    replacementGraph.people[0].name = 'Replaced After Load Failure'
    const replacementMessage = await uploadAndAcceptDialog(
      failedLoadPage,
      failedLoadPage.locator('input[type="file"][accept="application/json,.json"]'),
      {
        name: 'graph-replace-after-load-failure.json',
        mimeType: 'application/json',
        buffer: Buffer.from(`${JSON.stringify(replacementGraph)}\n`),
      },
    )

    if (mock.state.graph?.people?.[0]?.id !== 'replaced-after-load-failure') {
      throw new Error('Graph import after failed initial load did not replace the saved graph.')
    }
    if (mock.state.revision !== 11) {
      throw new Error(`Expected retry write to advance revision to 11, got ${mock.state.revision}.`)
    }
    if (mock.state.metaReads <= metaReadsBeforeConflictRecovery) {
      throw new Error('Graph import after failed load did not recover the latest revision through /graph/meta.')
    }

    mock.state.graphConflictIncludesRevision = true
    mock.state.failGraphWrites = 1
    const restWritesBeforeFallback = mock.state.restWrites
    const fallbackGraph = buildGraphImportFixture()
    fallbackGraph.people[0].id = 'replaced-after-api-failure'
    fallbackGraph.people[0].name = 'Replaced After API Failure'
    const fallbackMessage = await uploadAndAcceptDialog(
      failedLoadPage,
      failedLoadPage.locator('input[type="file"][accept="application/json,.json"]'),
      {
        name: 'graph-replace-after-api-failure.json',
        mimeType: 'application/json',
        buffer: Buffer.from(`${JSON.stringify(fallbackGraph)}\n`),
      },
    )

    if (mock.state.graph?.people?.[0]?.id !== 'replaced-after-api-failure') {
      throw new Error('Graph import did not fall back to direct Supabase persistence after graph API failure.')
    }
    if (mock.state.restWrites !== restWritesBeforeFallback + 1) {
      throw new Error('Expected graph API failure recovery to use exactly one direct Supabase write.')
    }
    if (mock.state.revision !== 12) {
      throw new Error(`Expected direct fallback write to advance revision to 12, got ${mock.state.revision}.`)
    }
    await failedLoadPage.close()

    console.log(JSON.stringify({
      zipMessage,
      graphMessage,
      replacementMessage,
      fallbackMessage,
      revision: mock.state.revision,
      reads: mock.state.reads,
      metaReads: mock.state.metaReads,
      restReads: mock.state.restReads,
      restWrites: mock.state.restWrites,
      writes: mock.state.writes,
      finalCounts: {
        circles: mock.state.graph.circles.length,
        people: mock.state.graph.people.length,
        connections: mock.state.graph.connections.length,
      },
    }, null, 2))
  } finally {
    await browser.close()
    vite.stop()
    await mock.stop()
  }
}

main().catch((error) => {
  if (/Executable doesn't exist|browserType.launch/i.test(String(error))) {
    console.error('Playwright browser is missing. Run: npx playwright install chromium')
  }
  console.error(error)
  process.exit(1)
})
