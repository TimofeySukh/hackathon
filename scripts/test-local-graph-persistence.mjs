import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

const port = 5191
const baseUrl = `http://127.0.0.1:${port}`
const peopleCount = 4200

async function waitForServer(timeoutMs = 30000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if ((await fetch(baseUrl)).ok) return
    } catch {
      // Vite has not finished starting yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${baseUrl}`)
}

function buildLargeLocalGraph() {
  const people = Array.from({ length: peopleCount }, (_, index) => {
    const number = index + 1
    return {
      id: `local-person-${number}`,
      name: `Local Person ${number}`,
      x: 300 + ((index % 70) * 28),
      y: -800 + (Math.floor(index / 70) * 28),
      circleId: 'local-people',
      avatar: `L${number}`,
      shapeType: 'circle',
      sides: 10,
      amplitude: 0,
      notes: [{
        id: `local-note-${number}`,
        title: 'Local persistence payload',
        body: `${number}:${'x'.repeat(1400)}`,
      }],
      links: [],
    }
  })

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
        id: 'local-people',
        name: 'Local People',
        icon: 'LP',
        x: 1200,
        y: 0,
        radius: 2200,
        minRadius: 2200,
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
    people,
    connections: [],
  }
}

function buildLegacyLocalGraph() {
  const graph = buildLargeLocalGraph()
  return {
    ...graph,
    people: [{
      ...graph.people[0],
      id: 'legacy-local-person',
      name: 'Legacy Local Person',
      notes: [],
    }],
  }
}

async function readStoredPeopleCount(page) {
  return await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('social-datanode-local', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction('graphs', 'readonly')
      const getRequest = transaction.objectStore('graphs').get('active')
      getRequest.onerror = () => reject(getRequest.error)
      getRequest.onsuccess = () => {
        resolve(Array.isArray(getRequest.result?.people) ? getRequest.result.people.length : 0)
        database.close()
      }
    }
  }))
}

async function main() {
  const server = spawn(
    'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: {
        ...process.env,
        BROWSER: 'none',
        VITE_SUPABASE_URL: '',
        VITE_SUPABASE_PUBLISHABLE_KEY: '',
        VITE_SUPABASE_ANON_KEY: '',
      },
    },
  )

  try {
    await waitForServer()
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

    try {
      await page.addInitScript(({ legacyGraph }) => {
        if (!window.sessionStorage.getItem('local-persistence-seeded')) {
          window.localStorage.clear()
          window.localStorage.setItem('hackathon-board:local-graph', JSON.stringify(legacyGraph))
          window.sessionStorage.setItem('local-persistence-seeded', '1')
        }
        window.localStorage.setItem('social-board-onboarding-done-v3', '1')
      }, { legacyGraph: buildLegacyLocalGraph() })
      await page.goto(`${baseUrl}/#board`, { waitUntil: 'networkidle' })
      assert.equal(await readStoredPeopleCount(page), 1, 'The legacy localStorage graph must migrate to IndexedDB.')
      assert.equal(
        await page.evaluate(() => window.localStorage.getItem('hackathon-board:local-graph')),
        null,
        'The legacy graph key must be removed after migration.',
      )
      await page.getByRole('button', { name: 'Search', exact: true }).click()
      await page.locator('.search-box__input').fill('Legacy Local Person')
      await page.getByText('Legacy Local Person', { exact: true }).waitFor({ timeout: 10000 })
      await page.getByRole('button', { name: 'Search', exact: true }).click()
      await page.getByLabel('Settings', { exact: true }).click()

      const graph = buildLargeLocalGraph()
      const graphJson = JSON.stringify(graph)
      assert.ok(Buffer.byteLength(graphJson) > 5_000_000, 'Fixture must exceed five megabytes.')

      const dialogPromise = page.waitForEvent('dialog', { timeout: 60000 })
      await page.locator('input[type="file"][accept="application/json,.json"]').setInputFiles({
        name: 'large-local-graph.json',
        mimeType: 'application/json',
        buffer: Buffer.from(`${graphJson}\n`),
      })
      const dialog = await dialogPromise
      assert.equal(dialog.message(), 'Graph imported successfully.')
      await dialog.accept()

      assert.equal(await readStoredPeopleCount(page), peopleCount, 'IndexedDB must contain the complete imported graph.')

      await page.reload({ waitUntil: 'networkidle' })
      await page.getByRole('button', { name: 'Search', exact: true }).click()
      await page.locator('.search-box__input').fill(`Local Person ${peopleCount}`)
      await page.getByText(`Local Person ${peopleCount}`, { exact: true }).waitFor({ timeout: 10000 })
      assert.equal(await readStoredPeopleCount(page), peopleCount, 'The complete local graph must survive reload.')
    } finally {
      await browser.close()
    }
  } finally {
    server.kill('SIGTERM')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
