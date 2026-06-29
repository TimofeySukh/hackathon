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
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, accept-profile, content-profile, x-retry-count',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  })
  response.end(JSON.stringify(payload))
}

async function readBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

function startMockGraphApi({ port }) {
  const state = {
    graph: null,
    revision: null,
    writes: 0,
    reads: 0,
  }

  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === 'OPTIONS') {
        jsonResponse(response, 200, { ok: true })
        return
      }

      const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)
      const isGraphRoute = url.pathname === '/functions/v1/graph-api/v1/graph'
      const isUserGraphsRestRoute = url.pathname === '/rest/v1/user_graphs'

      if (isUserGraphsRestRoute && request.method === 'GET') {
        state.reads += 1
        jsonResponse(response, 200, state.graph ? { graph: state.graph, revision: state.revision } : {})
        return
      }

      if (!isGraphRoute) {
        jsonResponse(response, 404, { error: `Unhandled mock route: ${request.method} ${url.pathname}` })
        return
      }

      if (request.method === 'GET') {
        state.reads += 1
        jsonResponse(response, 200, { graph: state.graph, revision: state.revision })
        return
      }

      if (request.method === 'PUT') {
        const body = await readBody(request)
        if (!body || typeof body !== 'object' || !isGraphState(body.graph)) {
          jsonResponse(response, 400, { error: 'Invalid graph.' })
          return
        }
        if (body.expectedRevision !== state.revision) {
          jsonResponse(response, 409, { error: 'Revision conflict.', revision: state.revision })
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
      `Persist Company ${companyNumber}`,
      `Synthetic Position ${index + 1}`,
      '2026-06-14',
    ])
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

async function buildLinkedInZip(args) {
  const csv = buildConnectionsCsv(args)
  const zipWriter = new ZipWriter(new BlobWriter('application/zip'))
  await zipWriter.add('Connections.csv', new TextReader(csv))
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
      window.localStorage.setItem('social-onboarding-done-v1', '1')
    })

    await page.goto(`${vite.url}/#board`, { waitUntil: 'networkidle' })
    await waitForGraphRead(mock, 1)
    await page.getByLabel('Settings', { exact: true }).click()

    const zipBuffer = await buildLinkedInZip(args)
    const zipMessage = await uploadAndAcceptDialog(
      page,
      page.locator('input[type="file"][accept=".zip"]'),
      { name: 'linkedin-persistence-test.zip', mimeType: 'application/zip', buffer: zipBuffer },
    )

    if (mock.state.graph?.people?.length !== args.people) {
      throw new Error(`ZIP import saved ${mock.state.graph?.people?.length ?? 0} people, expected ${args.people}.`)
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

    console.log(JSON.stringify({
      zipMessage,
      graphMessage,
      revision: mock.state.revision,
      reads: mock.state.reads,
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
