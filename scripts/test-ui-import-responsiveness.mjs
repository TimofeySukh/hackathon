import { spawn } from 'node:child_process'
import process from 'node:process'

import { BlobReader, BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js'

function parseArgs(argv) {
  const args = {
    people: 3000,
    companies: 60,
    maxLagMs: 1000,
    url: '',
    port: 4177,
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
    } else if (token === '--max-lag-ms' && next) {
      args.maxLagMs = Number.parseInt(next, 10)
      index += 1
    } else if (token === '--url' && next) {
      args.url = next
      index += 1
    } else if (token === '--port' && next) {
      args.port = Number.parseInt(next, 10)
      index += 1
    }
  }

  return args
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
      `Load${index + 1}`,
      `Person${index + 1}`,
      `https://www.linkedin.com/in/load-person-${index + 1}`,
      `load.person.${index + 1}@example.invalid`,
      `Load Company ${companyNumber}`,
      `Synthetic Role ${index + 1}`,
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

async function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Retry until Vite is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function startServerIfNeeded(args) {
  if (args.url) return { url: args.url, stop: () => {} }

  const url = `http://127.0.0.1:${args.port}`
  const server = spawn(
    'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(args.port), '--strictPort'],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BROWSER: 'none' },
    }
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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!Number.isInteger(args.people) || args.people <= 0) {
    throw new Error('--people must be a positive integer.')
  }
  if (!Number.isInteger(args.companies) || args.companies <= 0) {
    throw new Error('--companies must be a positive integer.')
  }

  let playwright
  try {
    playwright = await import('playwright')
  } catch {
    throw new Error('Missing playwright dependency. Run npm install first.')
  }

  const zipBuffer = await buildLinkedInZip(args)
  const server = await startServerIfNeeded(args)
  const browser = await playwright.chromium.launch({ headless: true })

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.on('console', (message) => {
      if (message.type() === 'error') console.error(message.text())
    })

    await page.goto(server.url, { waitUntil: 'networkidle' })
    await page.evaluate(() => {
      window.localStorage.clear()
      const monitor = {
        samples: 0,
        maxLagMs: 0,
        last: performance.now(),
        timer: 0,
      }
      monitor.timer = window.setInterval(() => {
        const now = performance.now()
        const lag = Math.max(0, now - monitor.last - 50)
        monitor.maxLagMs = Math.max(monitor.maxLagMs, lag)
        monitor.last = now
        monitor.samples += 1
      }, 50)
      Object.assign(window, { __importResponsivenessMonitor: monitor })
    })

    await page.getByLabel('Settings', { exact: true }).click()

    const dialogPromise = page.waitForEvent('dialog', { timeout: 60000 })
    const startedAt = performance.now()
    await page.locator('input[type="file"]').setInputFiles({
      name: 'linkedin-load-test.zip',
      mimeType: 'application/zip',
      buffer: zipBuffer,
    })
    const dialog = await dialogPromise
    const dialogMessage = dialog.message()
    await dialog.accept()

    const metrics = await page.evaluate(() => {
      const monitor = window.__importResponsivenessMonitor
      if (monitor?.timer) window.clearInterval(monitor.timer)
      return {
        maxLagMs: Math.round(monitor?.maxLagMs ?? 0),
        samples: monitor?.samples ?? 0,
      }
    })
    const totalMs = Math.round(performance.now() - startedAt)

    const result = {
      people: args.people,
      companies: args.companies,
      maxLagMs: metrics.maxLagMs,
      maxAllowedLagMs: args.maxLagMs,
      samples: metrics.samples,
      totalMs,
      dialogMessage,
    }
    console.log(JSON.stringify(result, null, 2))

    if (metrics.maxLagMs > args.maxLagMs) {
      throw new Error(`Import blocked the UI for ${metrics.maxLagMs}ms, above ${args.maxLagMs}ms.`)
    }

    if (!dialogMessage.includes('LinkedIn data imported successfully')) {
      throw new Error(`Unexpected import result: ${dialogMessage}`)
    }
  } finally {
    await browser.close()
    server.stop()
  }
}

main().catch((error) => {
  if (/Executable doesn't exist|browserType.launch/i.test(String(error))) {
    console.error('Playwright browser is missing. Run: npx playwright install chromium')
  }
  console.error(error)
  process.exit(1)
})
