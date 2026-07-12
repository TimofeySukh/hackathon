import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

const port = 5192
const baseUrl = `http://127.0.0.1:${port}`

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
      await page.goto(baseUrl, { waitUntil: 'networkidle' })
      await page.getByRole('heading', { name: /Your network is full of answers/i }).waitFor()
      const landingImage = page.locator('.founder-product-frame__image')
      await landingImage.waitFor()
      assert.deepEqual(
        await landingImage.evaluate((image) => ({ width: image.naturalWidth, height: image.naturalHeight })),
        { width: 1437, height: 938 },
        'The optimized landing image must decode at its original dimensions.',
      )

      await page.goto(`${baseUrl}/#docs`, { waitUntil: 'networkidle' })
      await page.getByText('DataNode Developer Wiki', { exact: true }).waitFor()

      await page.goto(`${baseUrl}/#contact`, { waitUntil: 'networkidle' })
      await page.getByRole('heading', { name: 'Talk to the team' }).waitFor()
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
